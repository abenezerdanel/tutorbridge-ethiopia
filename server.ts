import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  analyzeMessageText,
  CONTACT_PROTECTION_WARNING_TEXT,
  DEFAULT_MODERATION_SETTINGS,
  scanAttachmentPayload,
  type AttachmentScanInput,
  type ModerationSettingsConfig,
} from './server/contactDetector.ts';
import {
  commitWritesRest,
  docResourceName,
  getDocRest,
  runQueryRest,
  toFirestoreFields,
  verifyFirebaseIdToken,
  type FirestoreRestWrite,
} from './server/firestoreRest.ts';

const PORT = Number(process.env.PORT || 3000);
const BOOTSTRAPPED_ADMIN_EMAIL = 'abenezerdaniel69@gmail.com';

function makeDocId(prefix: string): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function clampString(val: unknown, max: number): string {
  return typeof val === 'string' ? val.trim().slice(0, max) : '';
}

async function isCallerAdmin(uid: string, email: string, idToken: string): Promise<boolean> {
  if (email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL) {
    return true;
  }
  const adminDoc = await getDocRest('admins', uid, idToken);
  return adminDoc !== null;
}

async function loadModerationSettings(idToken: string): Promise<ModerationSettingsConfig> {
  try {
    const doc = await getDocRest('platform_moderation_settings', 'default', idToken);
    if (!doc) {
      return DEFAULT_MODERATION_SETTINGS;
    }
    return {
      blockPhoneNumbers: doc.blockPhoneNumbers !== false,
      blockWhatsApp: doc.blockWhatsApp !== false,
      blockEmails: doc.blockEmails !== false,
      blockUrls: doc.blockUrls !== false,
      blockSocialMedia: doc.blockSocialMedia !== false,
      blockMeetingLinks: doc.blockMeetingLinks !== false,
      detectSplitMessages: doc.detectSplitMessages !== false,
      scanAttachments: doc.scanAttachments !== false,
      warningThreshold: typeof doc.warningThreshold === 'number' ? doc.warningThreshold : 1,
      tempRestrictionThreshold:
        typeof doc.tempRestrictionThreshold === 'number' ? doc.tempRestrictionThreshold : 3,
      suspensionReviewThreshold:
        typeof doc.suspensionReviewThreshold === 'number' ? doc.suspensionReviewThreshold : 5,
      tempRestrictionHours:
        typeof doc.tempRestrictionHours === 'number' ? doc.tempRestrictionHours : 24,
      approvedExceptions: Array.isArray(doc.approvedExceptions)
        ? doc.approvedExceptions.filter((x): x is string => typeof x === 'string')
        : DEFAULT_MODERATION_SETTINGS.approvedExceptions,
    };
  } catch {
    return DEFAULT_MODERATION_SETTINGS;
  }
}

async function fetchRecentConversationUserMessages(
  conversationId: string,
  senderUid: string,
  idToken: string
): Promise<string[]> {
  try {
    const rows = await runQueryRest(
      {
        from: [{ collectionId: 'messages' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'participantUids' },
            op: 'ARRAY_CONTAINS',
            value: { stringValue: senderUid },
          },
        },
        limit: 40,
      },
      idToken
    );

    const cutoffMs = Date.now() - 15 * 60 * 1000;
    const matched = rows
      .filter((r) => {
        if (r.conversationId !== conversationId || r.senderUid !== senderUid) return false;
        if (typeof r.createdAt === 'string') {
          const ms = Date.parse(r.createdAt);
          return Number.isFinite(ms) && ms >= cutoffMs;
        }
        return true;
      })
      .sort((a, b) => {
        const ta = typeof a.createdAt === 'string' ? Date.parse(a.createdAt) : 0;
        const tb = typeof b.createdAt === 'string' ? Date.parse(b.createdAt) : 0;
        return ta - tb;
      });

    return matched
      .slice(-5)
      .map((m) => (typeof m.text === 'string' ? m.text : ''))
      .filter((t) => t.length > 0);
  } catch {
    return [];
  }
}

async function createAppServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'tutorbridge-contact-protection' });
  });

  app.get('/api/admin/verify', async (req, res) => {
    try {
      const authHeader = req.headers.authorization ?? '';
      const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      if (!idToken) {
        res.status(401).json({ authorized: false, error: 'Missing Authorization Bearer token' });
        return;
      }
      const user = await verifyFirebaseIdToken(idToken);
      if (!user.emailVerified) {
        res.status(403).json({ authorized: false, error: 'Verified email account required' });
        return;
      }
      const adminOk = await isCallerAdmin(user.uid, user.email, idToken);
      if (!adminOk) {
        res.status(403).json({ authorized: false, error: 'Administrator privileges required' });
        return;
      }
      res.json({
        authorized: true,
        uid: user.uid,
        email: user.email,
        role: 'admin',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid authentication token';
      res.status(401).json({ authorized: false, error: msg });
    }
  });

  app.post('/api/attachments/scan', async (req, res) => {
    try {
      const authHeader = req.headers.authorization ?? '';
      const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      if (!idToken) {
        res.status(401).json({ error: 'Missing Authorization Bearer token' });
        return;
      }
      const user = await verifyFirebaseIdToken(idToken);
      if (!user.emailVerified) {
        res.status(403).json({ error: 'Verified email required' });
        return;
      }

      const body = req.body as Partial<AttachmentScanInput>;
      const fileName = clampString(body.fileName, 160);
      const mimeType = clampString(body.mimeType, 80);
      const sizeBytes = typeof body.sizeBytes === 'number' ? body.sizeBytes : 0;
      if (!fileName) {
        res.status(400).json({ error: 'fileName is required' });
        return;
      }

      const settings = await loadModerationSettings(idToken);
      const result = scanAttachmentPayload(
        {
          fileName,
          mimeType,
          sizeBytes,
          base64Content: typeof body.base64Content === 'string' ? body.base64Content : undefined,
          textPreview: typeof body.textPreview === 'string' ? body.textPreview : undefined,
        },
        settings
      );

      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Attachment scan failed';
      res.status(400).json({ error: msg });
    }
  });

  app.post('/api/moderation/test', async (req, res) => {
    try {
      const authHeader = req.headers.authorization ?? '';
      const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      if (!idToken) {
        res.status(401).json({ error: 'Missing Authorization Bearer token' });
        return;
      }
      const user = await verifyFirebaseIdToken(idToken);
      if (!user.emailVerified || !(await isCallerAdmin(user.uid, user.email, idToken))) {
        res.status(403).json({ error: 'Administrator privileges required' });
        return;
      }

      const body = req.body as { text?: string; recentMessages?: string[] };
      const text = clampString(body.text, 2000);
      const recent = Array.isArray(body.recentMessages)
        ? body.recentMessages.filter((x): x is string => typeof x === 'string')
        : [];
      const settings = await loadModerationSettings(idToken);
      const detection = analyzeMessageText(text, settings, recent);
      res.json({ detection, settings });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Moderation test failed';
      res.status(400).json({ error: msg });
    }
  });

  app.post('/api/messages/send', async (req, res) => {
    try {
      const authHeader = req.headers.authorization ?? '';
      const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      if (!idToken) {
        res.status(401).json({ error: 'Missing Authorization Bearer token' });
        return;
      }

      const verifiedUser = await verifyFirebaseIdToken(idToken);
      if (!verifiedUser.emailVerified) {
        res.status(403).json({ error: 'Verified email account required to send messages.' });
        return;
      }

      const body = req.body as {
        conversationId?: string;
        text?: string;
        attachment?: AttachmentScanInput;
      };
      const conversationId = clampString(body.conversationId, 128);
      const rawText = clampString(body.text, 2000);

      if (!conversationId || (!rawText && !body.attachment)) {
        res.status(400).json({ error: 'conversationId and message text or attachment are required.' });
        return;
      }

      const isAdmin = await isCallerAdmin(verifiedUser.uid, verifiedUser.email, idToken);
      const userAccount = await getDocRest('users', verifiedUser.uid, idToken);
      if (!isAdmin && userAccount?.status === 'suspended') {
        res.status(403).json({
          blocked: true,
          restricted: true,
          warning: 'Your account is currently suspended. Contact TutorBridge Support for assistance.',
        });
        return;
      }

      const senderName = clampString(userAccount?.fullName, 120) || clampString(verifiedUser.name, 120) || 'TutorBridge User';
      const senderRoleRaw = clampString(userAccount?.role, 40);
      const senderRole =
        senderRoleRaw === 'parent' ||
        senderRoleRaw === 'tutor' ||
        senderRoleRaw === 'trainer' ||
        senderRoleRaw === 'organization' ||
        senderRoleRaw === 'admin'
          ? senderRoleRaw
          : isAdmin
            ? 'admin'
            : 'parent';

      const conv = await getDocRest('conversations', conversationId, idToken);
      if (!conv) {
        res.status(404).json({ error: 'Conversation not found.' });
        return;
      }

      const participantUids = Array.isArray(conv.participantUids)
        ? conv.participantUids.filter((x): x is string => typeof x === 'string')
        : [];
      if (!isAdmin && !participantUids.includes(verifiedUser.uid)) {
        res.status(403).json({ error: 'You are not a participant in this conversation.' });
        return;
      }
      if (conv.conversationType === 'organization_trainer') {
        res.status(403).json({
          blocked: true,
          restricted: true,
          warning:
            'Direct messaging between organizations and corporate trainers is not permitted. Please coordinate through TutorBridge Support.',
        });
        return;
      }
      if (!isAdmin && conv.status === 'locked') {
        res.status(403).json({
          blocked: true,
          restricted: true,
          warning: 'This conversation has been locked by TutorBridge Moderation.',
        });
        return;
      }

      // Check existing messaging restriction
      const existingRestriction = await getDocRest('messaging_restrictions', verifiedUser.uid, idToken);
      if (!isAdmin && existingRestriction && existingRestriction.status === 'active') {
        const level = existingRestriction.restrictionLevel;
        if (level === 'suspended_review') {
          res.status(403).json({
            blocked: true,
            restricted: true,
            restrictionLevel: 'suspended_review',
            warning:
              'Your messaging privileges are suspended pending administrator review due to repeated policy violations. You may submit an appeal.',
          });
          return;
        }
        if (level === 'temp_restricted') {
          const untilIso = typeof existingRestriction.restrictedUntilIso === 'string'
            ? existingRestriction.restrictedUntilIso
            : '';
          const untilMs = untilIso ? Date.parse(untilIso) : Infinity;
          if (!Number.isFinite(untilMs) || untilMs > Date.now()) {
            res.status(403).json({
              blocked: true,
              restricted: true,
              restrictionLevel: 'temp_restricted',
              restrictedUntilIso: untilIso,
              warning:
                'Your messaging is temporarily restricted due to repeated contact-protection violations. Please wait until the cooldown ends or submit an appeal.',
            });
            return;
          }
        }
      }

      const settings = await loadModerationSettings(idToken);
      const effectiveText = rawText || (body.attachment ? `[Attachment: ${clampString(body.attachment.fileName, 120)}]` : '');

      let attachmentResult: ReturnType<typeof scanAttachmentPayload> | null = null;
      if (body.attachment) {
        attachmentResult = scanAttachmentPayload(body.attachment, settings);
      }

      const recentMessages = !isAdmin
        ? await fetchRecentConversationUserMessages(conversationId, verifiedUser.uid, idToken)
        : [];
      const detection = isAdmin
        ? {
            verdict: 'approved' as const,
            violationType: null,
            matchedIndicators: [] as string[],
            reason: 'Authorized admin communication',
            normalizedSample: effectiveText.slice(0, 200),
          }
        : analyzeMessageText(effectiveText, settings, recentMessages);

      // Blocked by text detector or blocked by attachment scanner
      const isBlocked =
        !isAdmin && (detection.verdict === 'blocked' || attachmentResult?.status === 'blocked');

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

        const currentCount =
          typeof existingRestriction?.violationCount === 'number'
            ? existingRestriction.violationCount
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

        const writes: FirestoreRestWrite[] = [
          {
            update: {
              name: docResourceName('moderation_flags', flagId),
              fields: toFirestoreFields({
                userId: verifiedUser.uid,
                userName: senderName,
                conversationId,
                attemptedText: effectiveText.slice(0, 2000),
                violationType,
                detectionResult: 'blocked',
                matchedIndicators: matchedIndicators.slice(0, 20),
                enforcementAction,
                reviewStatus: 'pending',
              }),
            },
            updateTransforms: [
              { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
              { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
            ],
            currentDocument: { exists: false },
          },
          {
            update: {
              name: docResourceName('user_violations', violationId),
              fields: toFirestoreFields({
                userId: verifiedUser.uid,
                userName: senderName,
                conversationId,
                violationType,
                detectionResult: 'blocked',
                enforcementAction,
                details: blockReason.slice(0, 600),
              }),
            },
            updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
            currentDocument: { exists: false },
          },
          {
            update: {
              name: docResourceName('audit_logs', auditId),
              fields: toFirestoreFields({
                actorUid: verifiedUser.uid,
                actorRole: senderRole,
                eventType: 'contact_sharing_blocked',
                conversationId,
                targetId: flagId,
                summary: `Blocked ${violationType} attempt (${enforcementAction})`.slice(0, 500),
              }),
            },
            updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
            currentDocument: { exists: false },
          },
        ];

        if (!existingRestriction) {
          writes.push({
            update: {
              name: docResourceName('messaging_restrictions', verifiedUser.uid),
              fields: toFirestoreFields({
                userId: verifiedUser.uid,
                userName: senderName,
                violationCount: nextCount,
                restrictionLevel,
                status: 'active',
                reason: blockReason.slice(0, 500),
                ...(restrictedUntilIso ? { restrictedUntilIso } : {}),
                appealStatus: 'none',
              }),
            },
            updateTransforms: [
              { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
              { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
            ],
            currentDocument: { exists: false },
          });
        } else {
          const prevAppealStatus =
            typeof existingRestriction.appealStatus === 'string'
              ? existingRestriction.appealStatus
              : 'none';
          const updateFields: Record<string, unknown> = {
            userId: verifiedUser.uid,
            userName: senderName,
            violationCount: nextCount,
            restrictionLevel,
            status: 'active',
            reason: blockReason.slice(0, 500),
            appealStatus: prevAppealStatus,
          };
          const fieldPaths = [
            'userId',
            'userName',
            'violationCount',
            'restrictionLevel',
            'status',
            'reason',
            'appealStatus',
            'updatedAt',
          ];
          if (restrictedUntilIso) {
            updateFields.restrictedUntilIso = restrictedUntilIso;
            fieldPaths.push('restrictedUntilIso');
          }
          writes.push({
            update: {
              name: docResourceName('messaging_restrictions', verifiedUser.uid),
              fields: toFirestoreFields(updateFields),
            },
            updateMask: { fieldPaths },
            updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
            currentDocument: { exists: true },
          });
        }

        await commitWritesRest(writes, idToken);

        res.status(422).json({
          blocked: true,
          delivered: false,
          warning: CONTACT_PROTECTION_WARNING_TEXT,
          violationType,
          enforcementAction,
          restrictionLevel,
          violationCount: nextCount,
          restrictedUntilIso: restrictedUntilIso || undefined,
          matchedIndicators,
          reason: blockReason,
        });
        return;
      }

      // Deliver message (either clean 'approved' or 'flagged' for admin oversight)
      const isFlagged =
        !isAdmin &&
        (detection.verdict === 'flagged_for_review' || attachmentResult?.status === 'flagged');
      const moderationStatus = isFlagged ? 'flagged' : 'approved';
      const moderationReason = isFlagged
        ? detection.verdict === 'flagged_for_review'
          ? detection.reason
          : attachmentResult?.scanNote ?? 'Flagged for review'
        : undefined;

      const messageId = makeDocId('msg');
      const unreadByUids = participantUids.filter((u) => u !== verifiedUser.uid);

      const msgPayload: Record<string, unknown> = {
        conversationId,
        participantUids,
        senderUid: verifiedUser.uid,
        senderName,
        senderRole,
        text: effectiveText,
        attachmentScanStatus: attachmentResult ? attachmentResult.status : 'none',
        moderationStatus,
        readByUids: [verifiedUser.uid],
      };

      if (body.attachment) {
        msgPayload.attachmentName = clampString(body.attachment.fileName, 160);
        msgPayload.attachmentType = clampString(body.attachment.mimeType, 80) || 'application/octet-stream';
        msgPayload.attachmentSizeBytes = Math.max(0, Math.min(2097152, Number(body.attachment.sizeBytes) || 0));
      }
      if (moderationReason) {
        msgPayload.moderationReason = moderationReason.slice(0, 300);
      }

      const convStatus = isFlagged
        ? 'flagged'
        : conv.status === 'flagged'
          ? 'flagged'
          : 'active';

      const writes: FirestoreRestWrite[] = [
        {
          update: {
            name: docResourceName('messages', messageId),
            fields: toFirestoreFields(msgPayload),
          },
          updateTransforms: [
            { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
            { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
          ],
          currentDocument: { exists: false },
        },
        {
          update: {
            name: docResourceName('conversations', conversationId),
            fields: toFirestoreFields({
              lastMessagePreview: effectiveText.slice(0, 200),
              lastSenderUid: verifiedUser.uid,
              unreadByUids,
              status: convStatus,
            }),
          },
          updateMask: {
            fieldPaths: ['lastMessagePreview', 'lastSenderUid', 'unreadByUids', 'status', 'updatedAt'],
          },
          updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
          currentDocument: { exists: true },
        },
      ];

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

        writes.push(
          {
            update: {
              name: docResourceName('moderation_flags', flagId),
              fields: toFirestoreFields({
                userId: verifiedUser.uid,
                userName: senderName,
                conversationId,
                messageId,
                attemptedText: effectiveText.slice(0, 2000),
                violationType: flagType,
                detectionResult: 'flagged_for_review',
                matchedIndicators: indicators.slice(0, 20),
                enforcementAction: 'flagged_only',
                reviewStatus: 'pending',
              }),
            },
            updateTransforms: [
              { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
              { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
            ],
            currentDocument: { exists: false },
          },
          {
            update: {
              name: docResourceName('audit_logs', auditId),
              fields: toFirestoreFields({
                actorUid: verifiedUser.uid,
                actorRole: senderRole,
                eventType: 'message_flagged_for_review',
                conversationId,
                targetId: messageId,
                summary: `Delivered message flagged for review: ${moderationReason ?? flagType}`.slice(0, 500),
              }),
            },
            updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
            currentDocument: { exists: false },
          }
        );
      }

      await commitWritesRest(writes, idToken);

      res.json({
        delivered: true,
        blocked: false,
        messageId,
        moderationStatus,
        scanNote: attachmentResult?.scanNote ?? moderationReason ?? undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to send message';
      res.status(500).json({ error: msg });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TutorBridge server listening on http://0.0.0.0:${PORT}`);
  });
}

createAppServer().catch((err) => {
  console.error('Failed to start TutorBridge server:', err);
  process.exit(1);
});
