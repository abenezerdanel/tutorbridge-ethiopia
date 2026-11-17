import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  AlertTriangle,
  CheckCheck,
  FileText,
  Flag,
  Lock,
  MessageSquare,
  Paperclip,
  Plus,
  Send,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  X,
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import {
  auth,
  db,
  functions,
  handleFirestoreError,
  OperationType,
  USE_FIREBASE_CLOUD_FUNCTIONS,
} from '../firebase';
import {
  Booking,
  CONTACT_PROTECTION_WARNING,
  Conversation,
  ConversationRelatedType,
  ConversationType,
  MAX_TEXT_LENGTHS,
  Message,
  MessagingRestriction,
  TrainingContract,
  TrainingProposal,
  UserAccount,
  UserViolation,
  clampText,
} from '../types';

interface MessagingCenterProps {
  currentUser: UserAccount;
  roleContext: 'parent' | 'tutor' | 'organization' | 'admin';
  conversations: Conversation[];
  messages: Message[];
  restriction: MessagingRestriction | null;
  violations: UserViolation[];
  bookings?: Booking[];
  trainingContracts?: TrainingContract[];
  trainingProposals?: TrainingProposal[];
  allUsers?: UserAccount[];
  initialConversationId?: string | null;
  onConversationCreated?: (conversationId: string) => void;
}

interface PendingAttachment {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  base64Content: string;
  scanStatus: 'clean' | 'flagged' | 'blocked';
  scanNote: string;
}

function formatTimestamp(ts: unknown): string {
  if (!ts) return 'Just now';
  if (typeof ts === 'string') {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? ts : d.toLocaleString();
  }
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
    return (ts as { toDate: () => Date }).toDate().toLocaleString();
  }
  if (typeof ts === 'object' && ts !== null && 'seconds' in ts && typeof (ts as { seconds: number }).seconds === 'number') {
    return new Date((ts as { seconds: number }).seconds * 1000).toLocaleString();
  }
  return 'Just now';
}

function timestampToMs(ts: unknown): number {
  if (!ts) return Date.now();
  if (typeof ts === 'string') {
    const n = Date.parse(ts);
    return Number.isNaN(n) ? 0 : n;
  }
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
    return (ts as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof ts === 'object' && ts !== null && 'seconds' in ts && typeof (ts as { seconds: number }).seconds === 'number') {
    return (ts as { seconds: number }).seconds * 1000;
  }
  return 0;
}

function conversationTypeLabel(type: ConversationType): string {
  switch (type) {
    case 'parent_tutor':
      return 'Parent ↔ Tutor';
    case 'student_tutor':
      return 'Student ↔ Tutor (Guardian Oversight)';
    case 'organization_trainer':
      return 'Direct Channel (Disabled — Use TutorBridge Support)';
    case 'client_support':
      return 'TutorBridge Support & Coordination Desk';
    case 'admin_user':
      return 'TutorBridge Admin ↔ User';
  }
}

export const MessagingCenter: React.FC<MessagingCenterProps> = ({
  currentUser,
  roleContext,
  conversations,
  messages,
  restriction,
  violations,
  bookings = [],
  trainingContracts = [],
  trainingProposals = [],
  allUsers = [],
  initialConversationId = null,
  onConversationCreated,
}) => {
  const [selectedConvId, setSelectedConvId] = useState<string | null>(initialConversationId);
  const [draftText, setDraftText] = useState('');
  const [sending, setSending] = useState(false);
  const [warningBanner, setWarningBanner] = useState<{
    message: string;
    detail?: string;
    enforcement?: string;
  } | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const [scanningAttachment, setScanningAttachment] = useState(false);

  // New conversation modal/drawer state
  const [showNewThread, setShowNewThread] = useState(false);
  const [newThreadMode, setNewThreadMode] = useState<string>('support');
  const [newSubject, setNewSubject] = useState('');
  const [newTargetId, setNewTargetId] = useState('');
  const [creatingThread, setCreatingThread] = useState(false);

  // Report message modal state
  const [reportingMsg, setReportingMsg] = useState<Message | null>(null);
  const [reportReason, setReportReason] = useState<
    'contact_sharing' | 'off_platform_solicitation' | 'harassment' | 'inappropriate_attachment' | 'other'
  >('contact_sharing');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  // Appeal modal state
  const [showAppealForm, setShowAppealForm] = useState(false);
  const [appealText, setAppealText] = useState('');
  const [submittingAppeal, setSubmittingAppeal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (initialConversationId) {
      setSelectedConvId(initialConversationId);
    }
  }, [initialConversationId]);

  const sortedConversations = useMemo(() => {
    return [...conversations]
      .filter((c) => c.conversationType !== 'organization_trainer' || roleContext === 'admin')
      .sort((a, b) => timestampToMs(b.updatedAt) - timestampToMs(a.updatedAt));
  }, [conversations, roleContext]);

  const activeConversation = useMemo(() => {
    if (!selectedConvId) return sortedConversations[0] || null;
    return (
      sortedConversations.find((c) => c.id === selectedConvId) ||
      sortedConversations[0] ||
      null
    );
  }, [sortedConversations, selectedConvId]);

  const threadMessages = useMemo(() => {
    if (!activeConversation) return [];
    return messages
      .filter((m) => m.conversationId === activeConversation.id)
      .sort((a, b) => timestampToMs(a.createdAt) - timestampToMs(b.createdAt));
  }, [messages, activeConversation]);

  // Mark conversation & visible messages as read when opened
  useEffect(() => {
    if (!activeConversation) return;
    const convHasUnread = activeConversation.unreadByUids?.includes(currentUser.uid);
    if (convHasUnread) {
      const nextUnread = activeConversation.unreadByUids.filter((u) => u !== currentUser.uid);
      updateDoc(doc(db, 'conversations', activeConversation.id), {
        unreadByUids: nextUnread,
        updatedAt: serverTimestamp(),
      }).catch((err) => handleFirestoreError(err, OperationType.UPDATE, `conversations/${activeConversation.id}`));
    }

    const unreadMsgs = threadMessages.filter(
      (m) =>
        m.senderUid !== currentUser.uid &&
        !m.readByUids.includes(currentUser.uid) &&
        m.participantUids.includes(currentUser.uid)
    );
    for (const msg of unreadMsgs) {
      updateDoc(doc(db, 'messages', msg.id), {
        readByUids: [...msg.readByUids, currentUser.uid],
        updatedAt: serverTimestamp(),
      }).catch(() => {
        // Non-fatal if concurrent read already marked
      });
    }
  }, [activeConversation, threadMessages, currentUser.uid]);

  const isTempRestricted =
    restriction?.status === 'active' &&
    restriction.restrictionLevel === 'temp_restricted' &&
    (!restriction.restrictedUntilIso || Date.parse(restriction.restrictedUntilIso) > Date.now());
  const isSuspendedReview =
    restriction?.status === 'active' && restriction.restrictionLevel === 'suspended_review';
  const isBlockedFromSending =
    roleContext !== 'admin' && (isTempRestricted || isSuspendedReview || currentUser.status === 'suspended');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setWarningBanner(null);

    if (file.size > 2 * 1024 * 1024) {
      setWarningBanner({
        message: 'Attachment exceeds the 2 MB maximum file limit.',
      });
      e.target.value = '';
      return;
    }

    setScanningAttachment(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Authentication session required.');

      const base64Content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = typeof reader.result === 'string' ? reader.result : '';
          const commaIdx = result.indexOf(',');
          resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
        };
        reader.onerror = () => reject(new Error('Failed to read file.'));
        reader.readAsDataURL(file);
      });

      let data: {
        allowed?: boolean;
        status?: 'clean' | 'flagged' | 'blocked';
        scanNote?: string;
        error?: string;
      };

      if (USE_FIREBASE_CLOUD_FUNCTIONS) {
        const scanCallable = httpsCallable(functions, 'scanMessageAttachment');
        const result = await scanCallable({
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          base64Content,
        });
        data = result.data as typeof data;
      } else {
        const res = await fetch('/api/attachments/scan', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
            base64Content,
          }),
        });
        data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Attachment scan failed');
        }
      }

      if (!data.allowed || data.status === 'blocked') {
        setWarningBanner({
          message: CONTACT_PROTECTION_WARNING,
          detail: data.scanNote,
        });
        setPendingAttachment(null);
      } else {
        setPendingAttachment({
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          base64Content,
          scanStatus: data.status ?? 'clean',
          scanNote: data.scanNote ?? '',
        });
      }
    } catch (err) {
      setWarningBanner({
        message: err instanceof Error ? err.message : 'Unable to scan attachment.',
      });
    } finally {
      setScanningAttachment(false);
      e.target.value = '';
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversation) return;
    const text = clampText(draftText, MAX_TEXT_LENGTHS.messageText);
    if (!text && !pendingAttachment) return;

    setSending(true);
    setWarningBanner(null);
    setStatusNote('');

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error('Please sign in again to send messages.');
      }

      const requestPayload = {
        conversationId: activeConversation.id,
        text,
        attachment: pendingAttachment
          ? {
              fileName: pendingAttachment.fileName,
              mimeType: pendingAttachment.mimeType,
              sizeBytes: pendingAttachment.sizeBytes,
              base64Content: pendingAttachment.base64Content,
            }
          : undefined,
      };

      let data: {
        delivered?: boolean;
        blocked?: boolean;
        warning?: string;
        reason?: string;
        matchedIndicators?: string[];
        enforcementAction?: string;
        violationCount?: number;
        moderationStatus?: string;
        scanNote?: string;
        error?: string;
      };

      if (USE_FIREBASE_CLOUD_FUNCTIONS) {
        try {
          const sendCallable = httpsCallable(functions, 'sendFilteredMessage');
          const result = await sendCallable(requestPayload);
          data = result.data as typeof data;
        } catch (fnErr: unknown) {
          const errObj = fnErr as { details?: typeof data; message?: string };
          if (errObj?.details && errObj.details.blocked) {
            setWarningBanner({
              message: errObj.details.warning || CONTACT_PROTECTION_WARNING,
              detail: errObj.details.reason
                ? `${errObj.details.reason}${
                    Array.isArray(errObj.details.matchedIndicators) &&
                    errObj.details.matchedIndicators.length > 0
                      ? ` (Detected: ${errObj.details.matchedIndicators.join(', ')})`
                      : ''
                  }`
                : undefined,
              enforcement: errObj.details.enforcementAction
                ? `Action: ${errObj.details.enforcementAction.replace('_', ' ')} · Violation #${errObj.details.violationCount ?? 1}`
                : undefined,
            });
            return;
          }
          throw new Error(errObj?.message || 'Failed to send message via Cloud Functions.');
        }
      } else {
        const res = await fetch('/api/messages/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestPayload),
        });

        data = await res.json();

        if (res.status === 422 || data.blocked) {
          // Keep draftText so user can edit and resend without losing their work
          setWarningBanner({
            message: data.warning || CONTACT_PROTECTION_WARNING,
            detail: data.reason
              ? `${data.reason}${
                  Array.isArray(data.matchedIndicators) && data.matchedIndicators.length > 0
                    ? ` (Detected: ${data.matchedIndicators.join(', ')})`
                    : ''
                }`
              : undefined,
            enforcement: data.enforcementAction
              ? `Action: ${data.enforcementAction.replace('_', ' ')} · Violation #${data.violationCount ?? 1}`
              : undefined,
          });
          return;
        }

        if (!res.ok) {
          throw new Error(data.warning || data.error || 'Failed to send message.');
        }
      }

      setDraftText('');
      setPendingAttachment(null);
      if (data.moderationStatus === 'flagged') {
        setStatusNote(
          data.scanNote ||
            'Message delivered and flagged for routine TutorBridge moderation review.'
        );
      }
    } catch (err) {
      setWarningBanner({
        message: err instanceof Error ? err.message : 'Unable to send message.',
      });
    } finally {
      setSending(false);
    }
  };

  const handleCreateConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingThread(true);
    setWarningBanner(null);

    try {
      let conversationType: ConversationType = 'client_support';
      let participantUids: string[] = [currentUser.uid, 'tutorbridge-support'];
      let participantSummary = `${currentUser.fullName} · TutorBridge Support`;
      let relatedType: ConversationRelatedType = 'support';
      let relatedId = '';
      let guardianUid: string | undefined;
      let subject = clampText(newSubject, 160);

      if (newThreadMode === 'support') {
        conversationType = 'client_support';
        participantUids = [currentUser.uid, 'tutorbridge-support'];
        participantSummary = `${currentUser.fullName} · TutorBridge Support`;
        const linkedContract = trainingContracts.find((c) => c.id === newTargetId);
        const linkedProposal = trainingProposals.find((p) => p.id === newTargetId);
        if (linkedContract) {
          relatedType = 'corporate_contract';
          relatedId = linkedContract.id;
          if (!subject) subject = `Corporate Training Coordination: ${linkedContract.title}`;
        } else if (linkedProposal) {
          relatedType = 'corporate_request';
          relatedId = linkedProposal.requestId;
          if (!subject) subject = `Training Assignment Inquiry: ${linkedProposal.trainerName}`;
        } else {
          relatedType = 'support';
          if (!subject) subject = 'TutorBridge Support & Coordination Inquiry';
        }
      } else if (newThreadMode === 'parent_tutor' || newThreadMode === 'student_tutor') {
        const booking = bookings.find((b) => b.id === newTargetId);
        if (!booking) throw new Error('Please select a booking.');
        conversationType = newThreadMode;
        const otherUid =
          currentUser.uid === booking.parentId ? booking.tutorUserId : booking.parentId;
        participantUids = Array.from(new Set([currentUser.uid, otherUid]));
        if (participantUids.length < 2) {
          participantUids.push('tutorbridge-support');
        }
        participantSummary = `${booking.parentName} · ${booking.tutorName} (${booking.studentName})`;
        relatedType = 'booking';
        relatedId = booking.id;
        if (newThreadMode === 'student_tutor') {
          guardianUid = booking.parentId;
        }
        if (!subject) {
          subject = `${booking.subject} Tutoring — ${booking.studentName}`;
        }
      } else if (newThreadMode === 'admin_user' && roleContext === 'admin') {
        const target = allUsers.find((u) => u.uid === newTargetId);
        if (!target) throw new Error('Please select a user.');
        conversationType = 'admin_user';
        participantUids = Array.from(new Set([currentUser.uid, target.uid]));
        if (participantUids.length < 2) participantUids.push('tutorbridge-support');
        participantSummary = `TutorBridge Admin · ${target.fullName} (${target.role})`;
        relatedType = 'general';
        if (!subject) subject = `Platform Compliance & Support — ${target.fullName}`;
      }

      const convId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const payload: Record<string, unknown> = {
        conversationType,
        participantUids,
        participantSummary: clampText(participantSummary, 240),
        relatedType,
        ...(relatedId ? { relatedId } : {}),
        ...(guardianUid ? { guardianUid } : {}),
        subject: clampText(subject, 160),
        lastMessagePreview: 'Conversation started via TutorBridge Secure Messaging',
        lastSenderUid: currentUser.uid,
        unreadByUids: participantUids.filter((u) => u !== currentUser.uid),
        status: 'active',
        createdByUid: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'conversations', convId), payload);
      setSelectedConvId(convId);
      setShowNewThread(false);
      setNewSubject('');
      setNewTargetId('');
      onConversationCreated?.(convId);
    } catch (err) {
      if (err instanceof Error && !err.message.startsWith('{')) {
        setWarningBanner({ message: err.message });
      } else {
        handleFirestoreError(err, OperationType.CREATE, 'conversations');
      }
    } finally {
      setCreatingThread(false);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingMsg) return;
    setSubmittingReport(true);
    try {
      await addDoc(collection(db, 'message_reports'), {
        conversationId: reportingMsg.conversationId,
        messageId: reportingMsg.id,
        reporterUid: currentUser.uid,
        reporterName: currentUser.fullName,
        reportedUserUid: reportingMsg.senderUid,
        reason: reportReason,
        details: clampText(reportDetails || 'Reported via internal messaging safety tools.', 1000),
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await addDoc(collection(db, 'audit_logs'), {
        actorUid: currentUser.uid,
        actorRole: currentUser.role,
        eventType: 'message_reported',
        conversationId: reportingMsg.conversationId,
        targetId: reportingMsg.id,
        summary: `User reported message (${reportReason})`,
        createdAt: serverTimestamp(),
      });
      setReportingMsg(null);
      setReportDetails('');
      setStatusNote('Report submitted to TutorBridge Trust & Safety Administrators.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'message_reports');
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleAppealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restriction || !appealText.trim()) return;
    setSubmittingAppeal(true);
    try {
      await updateDoc(doc(db, 'messaging_restrictions', currentUser.uid), {
        appealText: clampText(appealText, 1000),
        appealStatus: 'pending',
        updatedAt: serverTimestamp(),
      });
      setShowAppealForm(false);
      setAppealText('');
      setStatusNote('Your moderation appeal has been submitted for administrator review.');
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `messaging_restrictions/${currentUser.uid}`
      );
    } finally {
      setSubmittingAppeal(false);
    }
  };

  const handleAdminToggleLock = async (conv: Conversation) => {
    if (roleContext !== 'admin') return;
    const nextStatus = conv.status === 'locked' ? 'active' : 'locked';
    try {
      await updateDoc(doc(db, 'conversations', conv.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      await addDoc(collection(db, 'audit_logs'), {
        actorUid: currentUser.uid,
        actorRole: 'admin',
        eventType: nextStatus === 'locked' ? 'conversation_locked' : 'conversation_unlocked',
        conversationId: conv.id,
        targetId: conv.id,
        summary: `Admin set conversation status to ${nextStatus}`,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `conversations/${conv.id}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Platform Communication Policy Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#39836B]/10 text-[#39836B] flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#142B46]">
              TutorBridge Protected Communication Channel
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              {roleContext === 'organization'
                ? 'Corporate organizations communicate exclusively with TutorBridge Support and Administrators. Direct messaging or negotiation with trainers is disabled.'
                : 'All tutoring and corporate training coordination happens securely via TutorBridge. Sharing phone numbers, WhatsApp, personal emails, social handles, or external links is automatically blocked.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowNewThread((prev) => !prev)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#142B46] text-white text-xs font-semibold rounded-lg shrink-0 hover:bg-[#1e3d63]"
        >
          <Plus className="w-4 h-4" />
          New Conversation
        </button>
      </div>

      {/* Active Violation / Restriction Notice */}
      {restriction && restriction.status === 'active' && restriction.violationCount > 0 && (
        <div
          className={`rounded-xl border p-4 space-y-2 ${
            isBlockedFromSending
              ? 'bg-red-50 border-red-200 text-red-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>
                Contact Protection Notice · Level: {restriction.restrictionLevel.replace('_', ' ')} (
                {restriction.violationCount} recorded{' '}
                {restriction.violationCount === 1 ? 'warning' : 'violations'})
              </span>
            </div>
            {restriction.appealStatus === 'pending' ? (
              <span className="text-xs font-semibold px-2.5 py-1 rounded bg-white/80 border border-current">
                Appeal Under Admin Review
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setShowAppealForm((p) => !p)}
                className="text-xs font-semibold underline"
              >
                {showAppealForm ? 'Cancel Appeal' : 'Appeal Moderation Decision'}
              </button>
            )}
          </div>
          <p className="text-xs">
            {isSuspendedReview
              ? 'Your messaging privileges are paused pending administrator review. Please submit an appeal below.'
              : isTempRestricted
              ? `Temporary messaging restriction active${
                  restriction.restrictedUntilIso
                    ? ` until ${new Date(restriction.restrictedUntilIso).toLocaleString()}`
                    : ''
                }.`
              : restriction.reason}
          </p>
          {violations.length > 0 && (
            <p className="text-[11px] opacity-80">
              Latest policy event: {violations[0]?.violationType} — {violations[0]?.details}
            </p>
          )}
          {showAppealForm && (
            <form onSubmit={handleAppealSubmit} className="pt-2 space-y-2">
              <textarea
                rows={2}
                required
                value={appealText}
                onChange={(e) => setAppealText(e.target.value)}
                placeholder="Explain why this message was academic/operational or confirm future compliance..."
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-[#142B46]"
              />
              <button
                type="submit"
                disabled={submittingAppeal}
                className="px-3.5 py-1.5 bg-[#142B46] text-white text-xs font-semibold rounded-lg disabled:opacity-50"
              >
                {submittingAppeal ? 'Submitting...' : 'Submit Appeal to Admin'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* New Conversation Drawer */}
      {showNewThread && (
        <form
          onSubmit={handleCreateConversation}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="font-display text-sm font-bold text-[#142B46]">
              Start a Protected Conversation
            </h4>
            <button
              type="button"
              onClick={() => setShowNewThread(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Channel Type
              </label>
              <select
                value={newThreadMode}
                onChange={(e) => {
                  setNewThreadMode(e.target.value);
                  setNewTargetId('');
                }}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-[#F5F7FA]"
              >
                <option value="support">TutorBridge Support & Coordination Desk</option>
                {(roleContext === 'parent' || roleContext === 'tutor') && bookings.length > 0 && (
                  <option value="parent_tutor">Parent ↔ Tutor (Booking)</option>
                )}
                {roleContext === 'parent' && bookings.length > 0 && (
                  <option value="student_tutor">
                    Student ↔ Tutor (With Guardian Oversight)
                  </option>
                )}
                {roleContext === 'admin' && allUsers.length > 0 && (
                  <option value="admin_user">Administrator ↔ Platform User</option>
                )}
              </select>
            </div>

            {newThreadMode === 'parent_tutor' || newThreadMode === 'student_tutor' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Select Booking
                </label>
                <select
                  required
                  value={newTargetId}
                  onChange={(e) => setNewTargetId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-[#F5F7FA]"
                >
                  <option value="">Choose booking...</option>
                  {bookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.subject} — {b.studentName} ({b.tutorName})
                    </option>
                  ))}
                </select>
              </div>
            ) : newThreadMode === 'support' && (trainingContracts.length > 0 || trainingProposals.length > 0) ? (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Related Corporate Engagement (Optional)
                </label>
                <select
                  value={newTargetId}
                  onChange={(e) => setNewTargetId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-[#F5F7FA]"
                >
                  <option value="">General TutorBridge Support Inquiry</option>
                  {trainingContracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      Contract: {c.title}
                    </option>
                  ))}
                  {trainingProposals.map((p) => (
                    <option key={p.id} value={p.id}>
                      Assignment Proposal: {p.proposedSchedule}
                    </option>
                  ))}
                </select>
              </div>
            ) : newThreadMode === 'admin_user' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Select Platform User
                </label>
                <select
                  required
                  value={newTargetId}
                  onChange={(e) => setNewTargetId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-[#F5F7FA]"
                >
                  <option value="">Choose user...</option>
                  {allUsers.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.fullName} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Subject / Topic
              </label>
              <input
                type="text"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="e.g., Schedule coordination for Grade 10 Math"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-[#F5F7FA]"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={creatingThread}
              className="px-4 py-2 bg-[#39836B] text-white text-xs font-semibold rounded-lg disabled:opacity-50"
            >
              {creatingThread ? 'Opening Thread...' : 'Create Secure Thread'}
            </button>
          </div>
        </form>
      )}

      {/* Split Messaging Workspace */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[540px]">
        {/* Left: Conversations List */}
        <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col max-h-[540px]">
          <div className="px-4 py-3 bg-[#F5F7FA] border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-[#142B46] uppercase tracking-wide">
              Conversations ({sortedConversations.length})
            </span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {sortedConversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 space-y-2">
                <MessageSquare className="w-7 h-7 mx-auto text-slate-300" />
                <p>No conversations yet. Start a thread with TutorBridge Support or a booking participant.</p>
              </div>
            ) : (
              sortedConversations.map((conv) => {
                const isSelected = activeConversation?.id === conv.id;
                const isUnread = conv.unreadByUids?.includes(currentUser.uid);
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => {
                      setSelectedConvId(conv.id);
                      setWarningBanner(null);
                      setStatusNote('');
                    }}
                    className={`w-full text-left p-3.5 transition-colors ${
                      isSelected ? 'bg-[#142B46]/5 ring-1 ring-inset ring-[#142B46]/25' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-bold text-[#142B46] line-clamp-1">
                        {conv.subject}
                      </p>
                      {isUnread && (
                        <span className="w-2.5 h-2.5 rounded-full bg-[#39836B] shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-[11px] font-medium text-slate-500 mt-0.5 line-clamp-1">
                      {conv.participantSummary}
                    </p>
                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      <span className="text-[10px] font-semibold text-[#39836B]">
                        {conversationTypeLabel(conv.conversationType)}
                      </span>
                      {conv.status !== 'active' && (
                        <span
                          className={`text-[10px] font-bold uppercase ${
                            conv.status === 'locked' ? 'text-red-600' : 'text-amber-600'
                          }`}
                        >
                          {conv.status}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-1">
                      {conv.lastMessagePreview}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Active Thread */}
        <div className="lg:col-span-8 flex flex-col max-h-[540px]">
          {!activeConversation ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-2">
              <ShieldCheck className="w-10 h-10 text-[#39836B]/50" />
              <p className="text-sm font-semibold text-[#142B46]">
                Select or start a protected conversation
              </p>
              <p className="text-xs max-w-sm">
                Messages are encrypted in transit and screened automatically to prevent unauthorized
                sharing of phone numbers, emails, or off-platform links.
              </p>
            </div>
          ) : (
            <>
              {/* Thread Header */}
              <div className="px-5 py-3.5 bg-[#F5F7FA] border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-display text-sm font-bold text-[#142B46]">
                      {activeConversation.subject}
                    </h4>
                    {activeConversation.conversationType === 'student_tutor' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#39836B]/10 text-[#39836B]">
                        Guardian Oversight Active
                      </span>
                    )}
                    {activeConversation.status === 'flagged' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                        Moderation Flagged
                      </span>
                    )}
                    {activeConversation.status === 'locked' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-700">
                        Locked
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeConversation.participantSummary}
                  </p>
                </div>

                {roleContext === 'admin' && (
                  <button
                    type="button"
                    onClick={() => handleAdminToggleLock(activeConversation)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-[#142B46] hover:bg-slate-100"
                  >
                    {activeConversation.status === 'locked' ? (
                      <>
                        <Unlock className="w-3.5 h-3.5 text-[#39836B]" />
                        Unlock Thread
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5 text-red-600" />
                        Lock Thread
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Messages Feed */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-white">
                {threadMessages.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">
                    No messages sent yet. Write your first message below.
                  </p>
                ) : (
                  threadMessages.map((msg) => {
                    const isMine = msg.senderUid === currentUser.uid;
                    const readByOthers = msg.readByUids.some((u) => u !== msg.senderUid);
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-xl px-4 py-2.5 border ${
                            isMine
                              ? 'bg-[#142B46] text-white border-[#142B46]'
                              : 'bg-[#F5F7FA] text-[#142B46] border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4 text-[10px] opacity-80 mb-1">
                            <span className="font-bold">
                              {msg.senderName} ({msg.senderRole})
                            </span>
                            <span>{formatTimestamp(msg.createdAt)}</span>
                          </div>
                          {msg.moderationStatus === 'removed' ? (
                            <p className="text-xs italic opacity-75">
                              [Removed by TutorBridge Moderation]
                            </p>
                          ) : (
                            <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                              {msg.text}
                            </p>
                          )}
                          {msg.attachmentName && (
                            <div
                              className={`mt-2 px-2.5 py-1.5 rounded-lg text-[11px] flex items-center gap-2 ${
                                isMine ? 'bg-white/10 text-white' : 'bg-white border border-slate-200 text-slate-700'
                              }`}
                            >
                              <FileText className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate max-w-[200px]">{msg.attachmentName}</span>
                              <span className="opacity-75">
                                ({msg.attachmentScanStatus})
                              </span>
                            </div>
                          )}
                          {msg.moderationStatus === 'flagged' && (
                            <p className="mt-1.5 text-[10px] font-semibold text-[#F5BD54]">
                              Flagged for routine moderation review
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 px-1 text-[10px] text-slate-400">
                          {isMine && (
                            <span className="inline-flex items-center gap-1">
                              <CheckCheck
                                className={`w-3 h-3 ${
                                  readByOthers ? 'text-[#39836B]' : 'text-slate-300'
                                }`}
                              />
                              {readByOthers ? 'Read' : 'Delivered'}
                            </span>
                          )}
                          {!isMine && (
                            <button
                              type="button"
                              onClick={() => setReportingMsg(msg)}
                              className="inline-flex items-center gap-1 hover:text-red-600 font-semibold"
                            >
                              <Flag className="w-3 h-3" />
                              Report
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Warning / Status Banners */}
              {warningBanner && (
                <div className="mx-4 mb-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 space-y-1">
                  <div className="flex items-start gap-2 font-semibold">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{warningBanner.message}</span>
                  </div>
                  {warningBanner.detail && (
                    <p className="pl-6 text-[11px] text-red-800">{warningBanner.detail}</p>
                  )}
                  {warningBanner.enforcement && (
                    <p className="pl-6 text-[11px] font-bold text-red-700">
                      {warningBanner.enforcement} — Edit your draft below and resend without contact
                      details.
                    </p>
                  )}
                </div>
              )}

              {statusNote && (
                <div className="mx-4 mb-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900">
                  {statusNote}
                </div>
              )}

              {pendingAttachment && (
                <div className="mx-4 mb-2 p-2.5 bg-[#F5F7FA] border border-slate-200 rounded-lg text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-[#39836B] shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-[#142B46] truncate">
                        {pendingAttachment.fileName} ({pendingAttachment.scanStatus})
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {pendingAttachment.scanNote}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingAttachment(null)}
                    className="text-slate-400 hover:text-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Message Composer */}
              <form
                onSubmit={handleSendMessage}
                className="p-3.5 bg-[#F5F7FA] border-t border-slate-200 flex items-end gap-2"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.csv,.png,.jpg,.jpeg,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={
                    isBlockedFromSending ||
                    activeConversation.status === 'locked' ||
                    activeConversation.conversationType === 'organization_trainer' ||
                    scanningAttachment
                  }
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach syllabus or study file (max 2MB)"
                  className="p-2.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-[#142B46] disabled:opacity-50"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <textarea
                  rows={2}
                  disabled={
                    isBlockedFromSending ||
                    activeConversation.status === 'locked' ||
                    activeConversation.conversationType === 'organization_trainer'
                  }
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  placeholder={
                    activeConversation.conversationType === 'organization_trainer'
                      ? 'Direct organization-to-trainer messaging is disabled. Use TutorBridge Support.'
                      : activeConversation.status === 'locked'
                      ? 'This conversation is locked by Moderation.'
                      : isBlockedFromSending
                      ? 'Messaging is restricted. Submit an appeal above.'
                      : 'Write a message (no phone numbers, emails, or external links)...'
                  }
                  className="flex-1 px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#142B46]/20"
                />
                <button
                  type="submit"
                  disabled={
                    sending ||
                    scanningAttachment ||
                    isBlockedFromSending ||
                    activeConversation.status === 'locked' ||
                    activeConversation.conversationType === 'organization_trainer' ||
                    (!draftText.trim() && !pendingAttachment)
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#142B46] text-white text-xs font-semibold rounded-lg hover:bg-[#1e3d63] disabled:opacity-50 whitespace-nowrap"
                >
                  <Send className="w-4 h-4" />
                  {sending ? 'Checking...' : 'Send'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Report Message Modal */}
      {reportingMsg && (
        <div className="fixed inset-0 z-50 bg-[#142B46]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleReportSubmit}
            className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-display text-base font-bold text-[#142B46]">
                Report Message to Moderation
              </h4>
              <button
                type="button"
                onClick={() => setReportingMsg(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 bg-[#F5F7FA] p-2.5 rounded-lg border border-slate-200 line-clamp-3">
              “{reportingMsg.text}”
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Reason</label>
              <select
                value={reportReason}
                onChange={(e) =>
                  setReportReason(
                    e.target.value as
                      | 'contact_sharing'
                      | 'off_platform_solicitation'
                      | 'harassment'
                      | 'inappropriate_attachment'
                      | 'other'
                  )
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-[#F5F7FA]"
              >
                <option value="contact_sharing">Shared or requested private contact info</option>
                <option value="off_platform_solicitation">Asked to book or pay off-platform</option>
                <option value="inappropriate_attachment">Suspicious attachment or QR code</option>
                <option value="harassment">Unprofessional behavior / harassment</option>
                <option value="other">Other policy concern</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Additional Details
              </label>
              <textarea
                rows={3}
                required
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Describe what happened so our moderation team can investigate..."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-[#F5F7FA]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReportingMsg(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingReport}
                className="px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
              >
                {submittingReport ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
