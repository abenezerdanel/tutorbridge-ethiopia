import crypto from 'node:crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import {
  analyzeMessageText,
  CONTACT_PROTECTION_WARNING_TEXT,
  DEFAULT_MODERATION_SETTINGS,
  scanAttachmentPayload,
  type AttachmentScanInput,
  type ModerationSettingsConfig,
} from './contactFilter';

const FIRESTORE_DATABASE_ID = 'ai-studio-2afa6791-239c-400a-9b7a-098728ef9e9e';
const BOOTSTRAPPED_ADMIN_EMAIL = 'abenezerdaniel69@gmail.com';

setGlobalOptions({
  region: 'europe-west1',
  maxInstances: 20,
});

const app = getApps().length > 0 ? getApps()[0] : initializeApp();
const db = getFirestore(app, FIRESTORE_DATABASE_ID);

function makeDocId(prefix: string): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function clampString(val: unknown, max: number): string {
  return typeof val === 'string' ? val.trim().slice(0, max) : '';
}

async function isUserAdmin(uid: string, email: string): Promise<boolean> {
  if (email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL) {
    return true;
  }
  const adminSnap = await db.collection('admins').doc(uid).get();
  return adminSnap.exists;
}

async function loadModerationSettings(): Promise<ModerationSettingsConfig> {
  try {
    const snap = await db.collection('platform_moderation_settings').doc('default').get();
    if (!snap.exists) {
      return DEFAULT_MODERATION_SETTINGS;
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
      tempRestrictionThreshold:
        typeof data.tempRestrictionThreshold === 'number' ? data.tempRestrictionThreshold : 3,
      suspensionReviewThreshold:
        typeof data.suspensionReviewThreshold === 'number' ? data.suspensionReviewThreshold : 5,
      tempRestrictionHours:
        typeof data.tempRestrictionHours === 'number' ? data.tempRestrictionHours : 24,
      approvedExceptions: Array.isArray(data.approvedExceptions)
        ? data.approvedExceptions.filter((x): x is string => typeof x === 'string')
        : DEFAULT_MODERATION_SETTINGS.approvedExceptions,
    };
  } catch (err) {
    logger.warn('Falling back to default moderation settings', err);
    return DEFAULT_MODERATION_SETTINGS;
  }
}

async function fetchRecentSenderMessages(
  conversationId: string,
  senderUid: string,
  excludeMessageId?: string
): Promise<string[]> {
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
        if (data.senderUid !== senderUid) return false;
        if (data.moderationStatus === 'removed') return false;
        const createdAt = data.createdAt;
        if (createdAt instanceof Timestamp) {
          return createdAt.toMillis() >= cutoffMs;
        }
        return true;
      })
      .sort((a, b) => {
        const ta = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
        const tb = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
        return ta - tb;
      });

    return rows
      .slice(-5)
      .map((r) => (typeof r.text === 'string' ? r.text : ''))
      .filter((t) => t.length > 0);
  } catch (err) {
    logger.warn('Failed to fetch recent messages for split-contact inspection', err);
    return [];
  }
}

async function recordViolationAndEscalate(params: {
  userId: string;
  userName: string;
  senderRole: string;
  conversationId: string;
  messageId?: string;
  attemptedText: string;
  violationType: string;
  matchedIndicators: string[];
  reason: string;
  settings: ModerationSettingsConfig;
}) {
  const {
    userId,
    userName,
    senderRole,
    conversationId,
    messageId,
    attemptedText,
    violationType,
    matchedIndicators,
    reason,
    settings,
  } = params;

  const restrictionRef = db.collection('messaging_restrictions').doc(userId);
  const existingRestrictionSnap = await restrictionRef.get();
  const existingData = existingRestrictionSnap.exists ? existingRestrictionSnap.data() : null;

  const currentCount =
    existingData && typeof existingData.violationCount === 'number'
      ? existingData.violationCount
      : 0;
  const nextCount = currentCount + 1;

  let enforcementAction: 'warning' | 'temp_restriction' | 'admin_review' = 'warning';
  let restrictionLevel: 'warning' | 'temp_restricted' | 'suspended_review' = 'warning';
  let restrictedUntilIso = '';

  if (nextCount >= settings.suspensionReviewThreshold) {
    enforcementAction = 'admin_review';
    restrictionLevel = 'suspended_review';
  } else if (nextCount >= settings.tempRestrictionThreshold) {
    enforcementAction = 'temp_restriction';
    restrictionLevel = 'temp_restricted';
    restrictedUntilIso = new Date(
      Date.now() + settings.tempRestrictionHours * 3600 * 1000
    ).toISOString();
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
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  batch.set(db.collection('user_violations').doc(violationId), {
    userId,
    userName,
    conversationId,
    violationType,
    detectionResult: 'blocked',
    enforcementAction,
    details: reason.slice(0, 600),
    createdAt: FieldValue.serverTimestamp(),
  });

  batch.set(db.collection('audit_logs').doc(auditId), {
    actorUid: userId,
    actorRole: senderRole,
    eventType: 'contact_sharing_blocked',
    conversationId,
    targetId: flagId,
    summary: `Cloud Function blocked ${violationType} attempt (${enforcementAction})`.slice(0, 500),
    createdAt: FieldValue.serverTimestamp(),
  });

  const restrictionPayload: Record<string, unknown> = {
    userId,
    userName,
    violationCount: nextCount,
    restrictionLevel,
    status: 'active',
    reason: reason.slice(0, 500),
    appealStatus:
      existingData && typeof existingData.appealStatus === 'string'
        ? existingData.appealStatus
        : 'none',
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (restrictedUntilIso) {
    restrictionPayload.restrictedUntilIso = restrictedUntilIso;
  }

  if (!existingRestrictionSnap.exists) {
    restrictionPayload.createdAt = FieldValue.serverTimestamp();
    batch.set(restrictionRef, restrictionPayload);
  } else {
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
export const sendFilteredMessage = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication is required to send messages.');
  }

  const uid = request.auth.uid;
  const email = typeof request.auth.token.email === 'string' ? request.auth.token.email : '';
  if (request.auth.token.email_verified !== true) {
    throw new HttpsError(
      'permission-denied',
      'Verified email account required to send messages.'
    );
  }

  const payload = (request.data ?? {}) as {
    conversationId?: string;
    text?: string;
    attachment?: AttachmentScanInput;
  };

  const conversationId = clampString(payload.conversationId, 128);
  const rawText = clampString(payload.text, 2000);

  if (!conversationId || (!rawText && !payload.attachment)) {
    throw new HttpsError(
      'invalid-argument',
      'conversationId and message text or attachment are required.'
    );
  }

  const adminCaller = await isUserAdmin(uid, email);
  const userSnap = await db.collection('users').doc(uid).get();
  const userAccount = userSnap.exists ? userSnap.data() ?? {} : {};

  if (!adminCaller && userAccount.status === 'suspended') {
    throw new HttpsError(
      'permission-denied',
      'Your account is currently suspended. Contact TutorBridge Support for assistance.',
      { blocked: true, restricted: true }
    );
  }

  const senderName =
    clampString(userAccount.fullName, 120) ||
    clampString(request.auth.token.name, 120) ||
    'TutorBridge User';
  const roleRaw = clampString(userAccount.role, 40);
  const senderRole =
    roleRaw === 'parent' ||
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
    throw new HttpsError('not-found', 'Conversation not found.');
  }

  const convData = convSnap.data() ?? {};
  const participantUids = Array.isArray(convData.participantUids)
    ? convData.participantUids.filter((x): x is string => typeof x === 'string')
    : [];

  if (!adminCaller && !participantUids.includes(uid)) {
    throw new HttpsError('permission-denied', 'You are not a participant in this conversation.');
  }

  if (convData.conversationType === 'organization_trainer') {
    throw new HttpsError(
      'permission-denied',
      'Direct messaging between organizations and corporate trainers is not permitted. Please coordinate through TutorBridge Support.',
      { blocked: true, restricted: true }
    );
  }

  if (!adminCaller && convData.status === 'locked') {
    throw new HttpsError(
      'permission-denied',
      'This conversation has been locked by TutorBridge Moderation.',
      { blocked: true, restricted: true }
    );
  }

  const restrictionSnap = await db.collection('messaging_restrictions').doc(uid).get();
  if (!adminCaller && restrictionSnap.exists) {
    const rData = restrictionSnap.data() ?? {};
    if (rData.status === 'active') {
      if (rData.restrictionLevel === 'suspended_review') {
        throw new HttpsError(
          'permission-denied',
          'Your messaging privileges are suspended pending administrator review due to repeated policy violations. You may submit an appeal.',
          { blocked: true, restricted: true, restrictionLevel: 'suspended_review' }
        );
      }
      if (rData.restrictionLevel === 'temp_restricted') {
        const untilIso =
          typeof rData.restrictedUntilIso === 'string' ? rData.restrictedUntilIso : '';
        const untilMs = untilIso ? Date.parse(untilIso) : Infinity;
        if (!Number.isFinite(untilMs) || untilMs > Date.now()) {
          throw new HttpsError(
            'permission-denied',
            'Your messaging is temporarily restricted due to repeated contact-protection violations. Please wait until the cooldown ends or submit an appeal.',
            {
              blocked: true,
              restricted: true,
              restrictionLevel: 'temp_restricted',
              restrictedUntilIso: untilIso,
            }
          );
        }
      }
    }
  }

  const settings = await loadModerationSettings();
  const effectiveText =
    rawText ||
    (payload.attachment ? `[Attachment: ${clampString(payload.attachment.fileName, 120)}]` : '');

  const attachmentResult = payload.attachment
    ? scanAttachmentPayload(payload.attachment, settings)
    : null;

  const recentMessages = !adminCaller
    ? await fetchRecentSenderMessages(conversationId, uid)
    : [];

  const detection = adminCaller
    ? {
        verdict: 'approved' as const,
        violationType: null,
        matchedIndicators: [] as string[],
        reason: 'Authorized admin communication',
        normalizedSample: effectiveText.slice(0, 200),
      }
    : analyzeMessageText(effectiveText, settings, recentMessages);

  const isBlocked =
    !adminCaller && (detection.verdict === 'blocked' || attachmentResult?.status === 'blocked');

  if (isBlocked) {
    const violationType =
      detection.verdict === 'blocked'
        ? detection.violationType ?? 'obfuscated_contact'
        : 'suspicious_attachment';
    const matchedIndicators =
      detection.verdict === 'blocked'
        ? detection.matchedIndicators
        : attachmentResult?.matchedIndicators ?? ['suspicious_attachment'];
    const blockReason =
      detection.verdict === 'blocked'
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

    throw new HttpsError('invalid-argument', CONTACT_PROTECTION_WARNING_TEXT, {
      blocked: true,
      delivered: false,
      warning: CONTACT_PROTECTION_WARNING_TEXT,
      violationType,
      enforcementAction: escalation.enforcementAction,
      restrictionLevel: escalation.restrictionLevel,
      violationCount: escalation.violationCount,
      restrictedUntilIso: escalation.restrictedUntilIso || undefined,
      matchedIndicators,
      reason: blockReason,
    });
  }

  const isFlagged =
    !adminCaller &&
    (detection.verdict === 'flagged_for_review' || attachmentResult?.status === 'flagged');
  const moderationStatus = isFlagged ? 'flagged' : 'approved';
  const moderationReason = isFlagged
    ? detection.verdict === 'flagged_for_review'
      ? detection.reason
      : attachmentResult?.scanNote ?? 'Flagged for review'
    : undefined;

  const messageId = makeDocId('msg');
  const unreadByUids = participantUids.filter((u) => u !== uid);

  const msgPayload: Record<string, unknown> = {
    conversationId,
    participantUids,
    senderUid: uid,
    senderName,
    senderRole,
    text: effectiveText,
    attachmentScanStatus: attachmentResult ? attachmentResult.status : 'none',
    moderationStatus,
    readByUids: [uid],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (payload.attachment) {
    msgPayload.attachmentName = clampString(payload.attachment.fileName, 160);
    msgPayload.attachmentType =
      clampString(payload.attachment.mimeType, 80) || 'application/octet-stream';
    msgPayload.attachmentSizeBytes = Math.max(
      0,
      Math.min(2097152, Number(payload.attachment.sizeBytes) || 0)
    );
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
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (isFlagged) {
    const flagId = makeDocId('flag');
    const auditId = makeDocId('audit');
    const flagType =
      attachmentResult?.status === 'flagged'
        ? 'suspicious_attachment'
        : detection.violationType ?? 'uncertain_review';
    const indicators =
      attachmentResult?.status === 'flagged'
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
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    batch.set(db.collection('audit_logs').doc(auditId), {
      actorUid: uid,
      actorRole: senderRole,
      eventType: 'message_flagged_for_review',
      conversationId,
      targetId: messageId,
      summary: `Delivered message flagged for review: ${moderationReason ?? flagType}`.slice(0, 500),
      createdAt: FieldValue.serverTimestamp(),
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
export const scanMessageAttachment = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  if (request.auth.token.email_verified !== true) {
    throw new HttpsError('permission-denied', 'Verified email required.');
  }

  const body = (request.data ?? {}) as Partial<AttachmentScanInput>;
  const fileName = clampString(body.fileName, 160);
  if (!fileName) {
    throw new HttpsError('invalid-argument', 'fileName is required.');
  }

  const settings = await loadModerationSettings();
  return scanAttachmentPayload(
    {
      fileName,
      mimeType: clampString(body.mimeType, 80),
      sizeBytes: typeof body.sizeBytes === 'number' ? body.sizeBytes : 0,
      base64Content: typeof body.base64Content === 'string' ? body.base64Content : undefined,
      textPreview: typeof body.textPreview === 'string' ? body.textPreview : undefined,
    },
    settings
  );
});

/**
 * Firestore trigger defense-in-depth: inspects every created document in `messages/{messageId}`
 * on database `ai-studio-2afa6791-239c-400a-9b7a-098728ef9e9e`. If any obfuscated phone number,
 * email address, or external social media link was written outside the callable endpoint, this
 * trigger immediately redacts the message, flags the conversation, records a violation, and
 * escalates the sender's messaging restriction.
 */
export const onMessageCreatedFilter = onDocumentCreated(
  {
    database: FIRESTORE_DATABASE_ID,
    document: 'messages/{messageId}',
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const messageId = event.params.messageId;
    const senderUid = typeof data.senderUid === 'string' ? data.senderUid : '';
    const senderName = typeof data.senderName === 'string' ? data.senderName : 'TutorBridge User';
    const senderRole = typeof data.senderRole === 'string' ? data.senderRole : 'parent';
    const conversationId = typeof data.conversationId === 'string' ? data.conversationId : '';
    const text = typeof data.text === 'string' ? data.text : '';

    if (!senderUid || !conversationId || !text) return;
    if (data.moderationStatus === 'removed') return;

    // Skip moderation for authorized administrators
    if (senderRole === 'admin') {
      const adminSnap = await db.collection('admins').doc(senderUid).get();
      if (adminSnap.exists) return;
    }

    const settings = await loadModerationSettings();
    const recentMessages = await fetchRecentSenderMessages(conversationId, senderUid, messageId);
    const detection = analyzeMessageText(text, settings, recentMessages);

    if (detection.verdict === 'blocked') {
      const violationType = detection.violationType ?? 'obfuscated_contact';

      await snap.ref.update({
        text: '[Removed by TutorBridge Contact Protection]',
        moderationStatus: 'removed',
        moderationReason: detection.reason.slice(0, 300),
        updatedAt: FieldValue.serverTimestamp(),
      });

      const convRef = db.collection('conversations').doc(conversationId);
      await convRef.update({
        lastMessagePreview: '[Message removed by TutorBridge Contact Protection]',
        status: 'flagged',
        updatedAt: FieldValue.serverTimestamp(),
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

      logger.warn('onMessageCreatedFilter redacted prohibited contact message', {
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
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.update(db.collection('conversations').doc(conversationId), {
        status: 'flagged',
        updatedAt: FieldValue.serverTimestamp(),
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
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.set(db.collection('audit_logs').doc(auditId), {
        actorUid: senderUid,
        actorRole: senderRole,
        eventType: 'message_flagged_for_review',
        conversationId,
        targetId: messageId,
        summary: `Firestore trigger flagged message: ${detection.reason}`.slice(0, 500),
        createdAt: FieldValue.serverTimestamp(),
      });

      await batch.commit();
    }
  }
);
