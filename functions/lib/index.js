"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onMessageCreatedFilter = exports.scanMessageAttachment = exports.sendFilteredMessage = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const firebase_functions_1 = require("firebase-functions");
const v2_1 = require("firebase-functions/v2");
const https_1 = require("firebase-functions/v2/https");
const firestore_2 = require("firebase-functions/v2/firestore");
const contactFilter_1 = require("./contactFilter");
const FIRESTORE_DATABASE_ID = 'ai-studio-2afa6791-239c-400a-9b7a-098728ef9e9e';
const BOOTSTRAPPED_ADMIN_EMAIL = 'abenezerdaniel69@gmail.com';
(0, v2_1.setGlobalOptions)({
    region: 'europe-west1',
    maxInstances: 20,
});
const app = (0, app_1.getApps)().length > 0 ? (0, app_1.getApps)()[0] : (0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)(app, FIRESTORE_DATABASE_ID);
function makeDocId(prefix) {
    return `${prefix}_${Date.now()}_${node_crypto_1.default.randomBytes(4).toString('hex')}`;
}
function clampString(val, max) {
    return typeof val === 'string' ? val.trim().slice(0, max) : '';
}
async function isUserAdmin(uid, email) {
    if (email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL) {
        return true;
    }
    const adminSnap = await db.collection('admins').doc(uid).get();
    return adminSnap.exists;
}
async function loadModerationSettings() {
    try {
        const snap = await db.collection('platform_moderation_settings').doc('default').get();
        if (!snap.exists) {
            return contactFilter_1.DEFAULT_MODERATION_SETTINGS;
        }
        const data = snap.data() ?? {};
        return {
            blockPhoneNumbers: data.blockPhoneNumbers !== false,
            blockWhatsApp: data.blockWhatsApp !== false,
            blockEmails: data.blockEmails !== false,
            blockUrls: data.blockUrls !== false,
            blockSocialMedia: data.blockSocialMedia !== false,
            blockMeetingLinks: data.blockMeetingLinks !== false,
            detectSplitMessages: data.detectSplitMessages !== false,
            scanAttachments: data.scanAttachments !== false,
            warningThreshold: typeof data.warningThreshold === 'number' ? data.warningThreshold : 1,
            tempRestrictionThreshold: typeof data.tempRestrictionThreshold === 'number' ? data.tempRestrictionThreshold : 3,
            suspensionReviewThreshold: typeof data.suspensionReviewThreshold === 'number' ? data.suspensionReviewThreshold : 5,
            tempRestrictionHours: typeof data.tempRestrictionHours === 'number' ? data.tempRestrictionHours : 24,
            approvedExceptions: Array.isArray(data.approvedExceptions)
                ? data.approvedExceptions.filter((x) => typeof x === 'string')
                : contactFilter_1.DEFAULT_MODERATION_SETTINGS.approvedExceptions,
        };
    }
    catch (err) {
        firebase_functions_1.logger.warn('Falling back to default moderation settings', err);
        return contactFilter_1.DEFAULT_MODERATION_SETTINGS;
    }
}
async function fetchRecentSenderMessages(conversationId, senderUid, excludeMessageId) {
    try {
        const snap = await db
            .collection('messages')
            .where('conversationId', '==', conversationId)
            .limit(50)
            .get();
        const cutoffMs = Date.now() - 15 * 60 * 1000;
        const rows = snap.docs
            .filter((d) => d.id !== excludeMessageId)
            .map((d) => d.data())
            .filter((data) => {
            if (data.senderUid !== senderUid)
                return false;
            if (data.moderationStatus === 'removed')
                return false;
            const createdAt = data.createdAt;
            if (createdAt instanceof firestore_1.Timestamp) {
                return createdAt.toMillis() >= cutoffMs;
            }
            return true;
        })
            .sort((a, b) => {
            const ta = a.createdAt instanceof firestore_1.Timestamp ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt instanceof firestore_1.Timestamp ? b.createdAt.toMillis() : 0;
            return ta - tb;
        });
        return rows
            .slice(-5)
            .map((r) => (typeof r.text === 'string' ? r.text : ''))
            .filter((t) => t.length > 0);
    }
    catch (err) {
        firebase_functions_1.logger.warn('Failed to fetch recent messages for split-contact inspection', err);
        return [];
    }
}
async function recordViolationAndEscalate(params) {
    const { userId, userName, senderRole, conversationId, messageId, attemptedText, violationType, matchedIndicators, reason, settings, } = params;
    const restrictionRef = db.collection('messaging_restrictions').doc(userId);
    const existingRestrictionSnap = await restrictionRef.get();
    const existingData = existingRestrictionSnap.exists ? existingRestrictionSnap.data() : null;
    const currentCount = existingData && typeof existingData.violationCount === 'number'
        ? existingData.violationCount
        : 0;
    const nextCount = currentCount + 1;
    let enforcementAction = 'warning';
    let restrictionLevel = 'warning';
    let restrictedUntilIso = '';
    if (nextCount >= settings.suspensionReviewThreshold) {
        enforcementAction = 'admin_review';
        restrictionLevel = 'suspended_review';
    }
    else if (nextCount >= settings.tempRestrictionThreshold) {
        enforcementAction = 'temp_restriction';
        restrictionLevel = 'temp_restricted';
        restrictedUntilIso = new Date(Date.now() + settings.tempRestrictionHours * 3600 * 1000).toISOString();
    }
    const flagId = makeDocId('flag');
    const violationId = makeDocId('viol');
    const auditId = makeDocId('audit');
    const batch = db.batch();
    batch.set(db.collection('moderation_flags').doc(flagId), {
        userId,
        userName,
        conversationId,
        ...(messageId ? { messageId } : {}),
        attemptedText: attemptedText.slice(0, 2000),
        violationType,
        detectionResult: 'blocked',
        matchedIndicators: matchedIndicators.slice(0, 20),
        enforcementAction,
        reviewStatus: 'pending',
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    batch.set(db.collection('user_violations').doc(violationId), {
        userId,
        userName,
        conversationId,
        violationType,
        detectionResult: 'blocked',
        enforcementAction,
        details: reason.slice(0, 600),
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    batch.set(db.collection('audit_logs').doc(auditId), {
        actorUid: userId,
        actorRole: senderRole,
        eventType: 'contact_sharing_blocked',
        conversationId,
        targetId: flagId,
        summary: `Cloud Function blocked ${violationType} attempt (${enforcementAction})`.slice(0, 500),
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    const restrictionPayload = {
        userId,
        userName,
        violationCount: nextCount,
        restrictionLevel,
        status: 'active',
        reason: reason.slice(0, 500),
        appealStatus: existingData && typeof existingData.appealStatus === 'string'
            ? existingData.appealStatus
            : 'none',
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    };
    if (restrictedUntilIso) {
        restrictionPayload.restrictedUntilIso = restrictedUntilIso;
    }
    if (!existingRestrictionSnap.exists) {
        restrictionPayload.createdAt = firestore_1.FieldValue.serverTimestamp();
        batch.set(restrictionRef, restrictionPayload);
    }
    else {
        batch.update(restrictionRef, restrictionPayload);
    }
    await batch.commit();
    return {
        enforcementAction,
        restrictionLevel,
        violationCount: nextCount,
        restrictedUntilIso,
    };
}
/**
 * Primary backend-enforced callable Cloud Function for sending messages.
 * Detects and blocks telephone numbers, email addresses, and external social media links
 * before any message document is persisted or delivered.
 */
exports.sendFilteredMessage = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication is required to send messages.');
    }
    const uid = request.auth.uid;
    const email = typeof request.auth.token.email === 'string' ? request.auth.token.email : '';
    if (request.auth.token.email_verified !== true) {
        throw new https_1.HttpsError('permission-denied', 'Verified email account required to send messages.');
    }
    const payload = (request.data ?? {});
    const conversationId = clampString(payload.conversationId, 128);
    const rawText = clampString(payload.text, 2000);
    if (!conversationId || (!rawText && !payload.attachment)) {
        throw new https_1.HttpsError('invalid-argument', 'conversationId and message text or attachment are required.');
    }
    const adminCaller = await isUserAdmin(uid, email);
    const userSnap = await db.collection('users').doc(uid).get();
    const userAccount = userSnap.exists ? userSnap.data() ?? {} : {};
    if (!adminCaller && userAccount.status === 'suspended') {
        throw new https_1.HttpsError('permission-denied', 'Your account is currently suspended. Contact TutorBridge Support for assistance.', { blocked: true, restricted: true });
    }
    const senderName = clampString(userAccount.fullName, 120) ||
        clampString(request.auth.token.name, 120) ||
        'TutorBridge User';
    const roleRaw = clampString(userAccount.role, 40);
    const senderRole = roleRaw === 'parent' ||
        roleRaw === 'tutor' ||
        roleRaw === 'trainer' ||
        roleRaw === 'organization' ||
        roleRaw === 'admin'
        ? roleRaw
        : adminCaller
            ? 'admin'
            : 'parent';
    const convRef = db.collection('conversations').doc(conversationId);
    const convSnap = await convRef.get();
    if (!convSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Conversation not found.');
    }
    const convData = convSnap.data() ?? {};
    const participantUids = Array.isArray(convData.participantUids)
        ? convData.participantUids.filter((x) => typeof x === 'string')
        : [];
    if (!adminCaller && !participantUids.includes(uid)) {
        throw new https_1.HttpsError('permission-denied', 'You are not a participant in this conversation.');
    }
    if (convData.conversationType === 'organization_trainer') {
        throw new https_1.HttpsError('permission-denied', 'Direct messaging between organizations and corporate trainers is not permitted. Please coordinate through TutorBridge Support.', { blocked: true, restricted: true });
    }
    if (!adminCaller && convData.status === 'locked') {
        throw new https_1.HttpsError('permission-denied', 'This conversation has been locked by TutorBridge Moderation.', { blocked: true, restricted: true });
    }
    const restrictionSnap = await db.collection('messaging_restrictions').doc(uid).get();
    if (!adminCaller && restrictionSnap.exists) {
        const rData = restrictionSnap.data() ?? {};
        if (rData.status === 'active') {
            if (rData.restrictionLevel === 'suspended_review') {
                throw new https_1.HttpsError('permission-denied', 'Your messaging privileges are suspended pending administrator review due to repeated policy violations. You may submit an appeal.', { blocked: true, restricted: true, restrictionLevel: 'suspended_review' });
            }
            if (rData.restrictionLevel === 'temp_restricted') {
                const untilIso = typeof rData.restrictedUntilIso === 'string' ? rData.restrictedUntilIso : '';
                const untilMs = untilIso ? Date.parse(untilIso) : Infinity;
                if (!Number.isFinite(untilMs) || untilMs > Date.now()) {
                    throw new https_1.HttpsError('permission-denied', 'Your messaging is temporarily restricted due to repeated contact-protection violations. Please wait until the cooldown ends or submit an appeal.', {
                        blocked: true,
                        restricted: true,
                        restrictionLevel: 'temp_restricted',
                        restrictedUntilIso: untilIso,
                    });
                }
            }
        }
    }
    const settings = await loadModerationSettings();
    const effectiveText = rawText ||
        (payload.attachment ? `[Attachment: ${clampString(payload.attachment.fileName, 120)}]` : '');
    const attachmentResult = payload.attachment
        ? (0, contactFilter_1.scanAttachmentPayload)(payload.attachment, settings)
        : null;
    const recentMessages = !adminCaller
        ? await fetchRecentSenderMessages(conversationId, uid)
        : [];
    const detection = adminCaller
        ? {
            verdict: 'approved',
            violationType: null,
            matchedIndicators: [],
            reason: 'Authorized admin communication',
            normalizedSample: effectiveText.slice(0, 200),
        }
        : (0, contactFilter_1.analyzeMessageText)(effectiveText, settings, recentMessages);
    const isBlocked = !adminCaller && (detection.verdict === 'blocked' || attachmentResult?.status === 'blocked');
    if (isBlocked) {
        const violationType = detection.verdict === 'blocked'
            ? detection.violationType ?? 'obfuscated_contact'
            : 'suspicious_attachment';
        const matchedIndicators = detection.verdict === 'blocked'
            ? detection.matchedIndicators
            : attachmentResult?.matchedIndicators ?? ['suspicious_attachment'];
        const blockReason = detection.verdict === 'blocked'
            ? detection.reason
            : attachmentResult?.scanNote ?? 'Attachment blocked by Contact Protection.';
        const escalation = await recordViolationAndEscalate({
            userId: uid,
            userName: senderName,
            senderRole,
            conversationId,
            attemptedText: effectiveText,
            violationType,
            matchedIndicators,
            reason: blockReason,
            settings,
        });
        throw new https_1.HttpsError('invalid-argument', contactFilter_1.CONTACT_PROTECTION_WARNING_TEXT, {
            blocked: true,
            delivered: false,
            warning: contactFilter_1.CONTACT_PROTECTION_WARNING_TEXT,
            violationType,
            enforcementAction: escalation.enforcementAction,
            restrictionLevel: escalation.restrictionLevel,
            violationCount: escalation.violationCount,
            restrictedUntilIso: escalation.restrictedUntilIso || undefined,
            matchedIndicators,
            reason: blockReason,
        });
    }
    const isFlagged = !adminCaller &&
        (detection.verdict === 'flagged_for_review' || attachmentResult?.status === 'flagged');
    const moderationStatus = isFlagged ? 'flagged' : 'approved';
    const moderationReason = isFlagged
        ? detection.verdict === 'flagged_for_review'
            ? detection.reason
            : attachmentResult?.scanNote ?? 'Flagged for review'
        : undefined;
    const messageId = makeDocId('msg');
    const unreadByUids = participantUids.filter((u) => u !== uid);
    const msgPayload = {
        conversationId,
        participantUids,
        senderUid: uid,
        senderName,
        senderRole,
        text: effectiveText,
        attachmentScanStatus: attachmentResult ? attachmentResult.status : 'none',
        moderationStatus,
        readByUids: [uid],
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    };
    if (payload.attachment) {
        msgPayload.attachmentName = clampString(payload.attachment.fileName, 160);
        msgPayload.attachmentType =
            clampString(payload.attachment.mimeType, 80) || 'application/octet-stream';
        msgPayload.attachmentSizeBytes = Math.max(0, Math.min(2097152, Number(payload.attachment.sizeBytes) || 0));
    }
    if (moderationReason) {
        msgPayload.moderationReason = moderationReason.slice(0, 300);
    }
    const convStatus = isFlagged
        ? 'flagged'
        : convData.status === 'flagged'
            ? 'flagged'
            : 'active';
    const batch = db.batch();
    batch.set(db.collection('messages').doc(messageId), msgPayload);
    batch.update(convRef, {
        lastMessagePreview: effectiveText.slice(0, 200),
        lastSenderUid: uid,
        unreadByUids,
        status: convStatus,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    if (isFlagged) {
        const flagId = makeDocId('flag');
        const auditId = makeDocId('audit');
        const flagType = attachmentResult?.status === 'flagged'
            ? 'suspicious_attachment'
            : detection.violationType ?? 'uncertain_review';
        const indicators = attachmentResult?.status === 'flagged'
            ? attachmentResult.matchedIndicators
            : detection.matchedIndicators;
        batch.set(db.collection('moderation_flags').doc(flagId), {
            userId: uid,
            userName: senderName,
            conversationId,
            messageId,
            attemptedText: effectiveText.slice(0, 2000),
            violationType: flagType,
            detectionResult: 'flagged_for_review',
            matchedIndicators: indicators.slice(0, 20),
            enforcementAction: 'flagged_only',
            reviewStatus: 'pending',
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        batch.set(db.collection('audit_logs').doc(auditId), {
            actorUid: uid,
            actorRole: senderRole,
            eventType: 'message_flagged_for_review',
            conversationId,
            targetId: messageId,
            summary: `Delivered message flagged for review: ${moderationReason ?? flagType}`.slice(0, 500),
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    await batch.commit();
    return {
        delivered: true,
        blocked: false,
        messageId,
        moderationStatus,
        scanNote: attachmentResult?.scanNote ?? moderationReason ?? undefined,
    };
});
/**
 * Attachment pre-screening callable Cloud Function.
 */
exports.scanMessageAttachment = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required.');
    }
    if (request.auth.token.email_verified !== true) {
        throw new https_1.HttpsError('permission-denied', 'Verified email required.');
    }
    const body = (request.data ?? {});
    const fileName = clampString(body.fileName, 160);
    if (!fileName) {
        throw new https_1.HttpsError('invalid-argument', 'fileName is required.');
    }
    const settings = await loadModerationSettings();
    return (0, contactFilter_1.scanAttachmentPayload)({
        fileName,
        mimeType: clampString(body.mimeType, 80),
        sizeBytes: typeof body.sizeBytes === 'number' ? body.sizeBytes : 0,
        base64Content: typeof body.base64Content === 'string' ? body.base64Content : undefined,
        textPreview: typeof body.textPreview === 'string' ? body.textPreview : undefined,
    }, settings);
});
/**
 * Firestore trigger defense-in-depth: inspects every created document in `messages/{messageId}`
 * on database `ai-studio-2afa6791-239c-400a-9b7a-098728ef9e9e`. If any obfuscated phone number,
 * email address, or external social media link was written outside the callable endpoint, this
 * trigger immediately redacts the message, flags the conversation, records a violation, and
 * escalates the sender's messaging restriction.
 */
exports.onMessageCreatedFilter = (0, firestore_2.onDocumentCreated)({
    database: FIRESTORE_DATABASE_ID,
    document: 'messages/{messageId}',
}, async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const data = snap.data();
    const messageId = event.params.messageId;
    const senderUid = typeof data.senderUid === 'string' ? data.senderUid : '';
    const senderName = typeof data.senderName === 'string' ? data.senderName : 'TutorBridge User';
    const senderRole = typeof data.senderRole === 'string' ? data.senderRole : 'parent';
    const conversationId = typeof data.conversationId === 'string' ? data.conversationId : '';
    const text = typeof data.text === 'string' ? data.text : '';
    if (!senderUid || !conversationId || !text)
        return;
    if (data.moderationStatus === 'removed')
        return;
    // Skip moderation for authorized administrators
    if (senderRole === 'admin') {
        const adminSnap = await db.collection('admins').doc(senderUid).get();
        if (adminSnap.exists)
            return;
    }
    const settings = await loadModerationSettings();
    const recentMessages = await fetchRecentSenderMessages(conversationId, senderUid, messageId);
    const detection = (0, contactFilter_1.analyzeMessageText)(text, settings, recentMessages);
    if (detection.verdict === 'blocked') {
        const violationType = detection.violationType ?? 'obfuscated_contact';
        await snap.ref.update({
            text: '[Removed by TutorBridge Contact Protection]',
            moderationStatus: 'removed',
            moderationReason: detection.reason.slice(0, 300),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        const convRef = db.collection('conversations').doc(conversationId);
        await convRef.update({
            lastMessagePreview: '[Message removed by TutorBridge Contact Protection]',
            status: 'flagged',
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        await recordViolationAndEscalate({
            userId: senderUid,
            userName: senderName,
            senderRole,
            conversationId,
            messageId,
            attemptedText: text,
            violationType,
            matchedIndicators: detection.matchedIndicators,
            reason: detection.reason,
            settings,
        });
        firebase_functions_1.logger.warn('onMessageCreatedFilter redacted prohibited contact message', {
            messageId,
            conversationId,
            senderUid,
            violationType,
        });
        return;
    }
    if (detection.verdict === 'flagged_for_review' && data.moderationStatus !== 'flagged') {
        const flagId = makeDocId('flag');
        const auditId = makeDocId('audit');
        const batch = db.batch();
        batch.update(snap.ref, {
            moderationStatus: 'flagged',
            moderationReason: detection.reason.slice(0, 300),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        batch.update(db.collection('conversations').doc(conversationId), {
            status: 'flagged',
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        batch.set(db.collection('moderation_flags').doc(flagId), {
            userId: senderUid,
            userName: senderName,
            conversationId,
            messageId,
            attemptedText: text.slice(0, 2000),
            violationType: detection.violationType ?? 'uncertain_review',
            detectionResult: 'flagged_for_review',
            matchedIndicators: detection.matchedIndicators.slice(0, 20),
            enforcementAction: 'flagged_only',
            reviewStatus: 'pending',
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        batch.set(db.collection('audit_logs').doc(auditId), {
            actorUid: senderUid,
            actorRole: senderRole,
            eventType: 'message_flagged_for_review',
            conversationId,
            targetId: messageId,
            summary: `Firestore trigger flagged message: ${detection.reason}`.slice(0, 500),
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
        await batch.commit();
    }
});
//# sourceMappingURL=index.js.map