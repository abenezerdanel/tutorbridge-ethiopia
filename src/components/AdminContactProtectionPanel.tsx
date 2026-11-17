import React, { useState } from 'react';
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
  Ban,
  CheckCircle2,
  Eye,
  FlaskConical,
  Lock,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Unlock,
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  AuditLog,
  DEFAULT_PLATFORM_MODERATION_SETTINGS,
  MessageReport,
  MessagingRestriction,
  ModerationAction,
  ModerationFlag,
  PlatformModerationSetting,
  UserAccount,
  UserViolation,
  clampText,
} from '../types';

interface AdminContactProtectionPanelProps {
  adminUser: UserAccount;
  users: UserAccount[];
  moderationFlags: ModerationFlag[];
  messageReports: MessageReport[];
  userViolations: UserViolation[];
  messagingRestrictions: MessagingRestriction[];
  moderationActions: ModerationAction[];
  auditLogs: AuditLog[];
  moderationSettings: PlatformModerationSetting | null;
  onInspectConversation: (conversationId: string) => void;
}

type SubTab = 'flags' | 'reports' | 'restrictions' | 'settings' | 'audit';

interface SelfTestCase {
  label: string;
  text: string;
  recentMessages?: string[];
  expectedVerdict: 'blocked' | 'approved' | 'flagged_for_review';
}

const BUILTIN_SELF_TESTS: SelfTestCase[] = [
  {
    label: 'Direct Ethiopian Mobile (+251)',
    text: 'Call me on +251 91 122 3344 after class',
    expectedVerdict: 'blocked',
  },
  {
    label: 'Obfuscated Spaced Phone (09..)',
    text: 'Reach me at 09 11 - 22 - 33 - 44',
    expectedVerdict: 'blocked',
  },
  {
    label: 'Word-Spelled Phone Number',
    text: 'My number is zero nine one one two two three three four four',
    expectedVerdict: 'blocked',
  },
  {
    label: 'WhatsApp Invite Link',
    text: 'Join my chat https://wa.me/251911223344',
    expectedVerdict: 'blocked',
  },
  {
    label: 'Obfuscated Email ([at]/[dot])',
    text: 'Send syllabus to abebe [at] gmail [dot] com',
    expectedVerdict: 'blocked',
  },
  {
    label: 'Telegram Username (@handle)',
    text: 'Message me on Telegram @abebe_math',
    expectedVerdict: 'blocked',
  },
  {
    label: 'External Zoom Meeting Link',
    text: 'Let us meet on https://zoom.us/j/9988776655',
    expectedVerdict: 'blocked',
  },
  {
    label: 'Split-Message Phone Attempt',
    text: '3344',
    recentMessages: ['Here is my digits 0911', '22'],
    expectedVerdict: 'blocked',
  },
  {
    label: 'Allowed Academic & Budget Message',
    text: 'We will cover Grade 10 Algebra Chapter 4 for 4 sessions at 2400 ETB total.',
    expectedVerdict: 'approved',
  },
  {
    label: 'Allowed Official TutorBridge Link & Invoice',
    text: 'Review INV-CORP-2026-001 at https://tutorbridge.et/proposal/123 or email support@tutorbridge.et',
    expectedVerdict: 'approved',
  },
  {
    label: 'Allowed Corporate Digital Marketing Topic',
    text: 'Our corporate training module covers Facebook Ads and Instagram strategy for your team.',
    expectedVerdict: 'approved',
  },
  {
    label: 'Uncertain Off-Platform Payment Phrase',
    text: 'Can we arrange cash in hand outside TutorBridge?',
    expectedVerdict: 'flagged_for_review',
  },
];

export const AdminContactProtectionPanel: React.FC<AdminContactProtectionPanelProps> = ({
  adminUser,
  users,
  moderationFlags,
  messageReports,
  userViolations,
  messagingRestrictions,
  moderationActions,
  auditLogs,
  moderationSettings,
  onInspectConversation,
}) => {
  const [subTab, setSubTab] = useState<SubTab>('flags');
  const [actionNotes, setActionNotes] = useState<Record<string, string>>({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState('');

  // Settings form state
  const activeSettings = moderationSettings ?? {
    id: 'default',
    ...DEFAULT_PLATFORM_MODERATION_SETTINGS,
  };

  const [blockPhoneNumbers, setBlockPhoneNumbers] = useState(activeSettings.blockPhoneNumbers);
  const [blockWhatsApp, setBlockWhatsApp] = useState(activeSettings.blockWhatsApp);
  const [blockEmails, setBlockEmails] = useState(activeSettings.blockEmails);
  const [blockUrls, setBlockUrls] = useState(activeSettings.blockUrls);
  const [blockSocialMedia, setBlockSocialMedia] = useState(activeSettings.blockSocialMedia);
  const [blockMeetingLinks, setBlockMeetingLinks] = useState(activeSettings.blockMeetingLinks);
  const [detectSplitMessages, setDetectSplitMessages] = useState(activeSettings.detectSplitMessages);
  const [scanAttachments, setScanAttachments] = useState(activeSettings.scanAttachments);
  const [warningThreshold, setWarningThreshold] = useState(activeSettings.warningThreshold);
  const [tempRestrictionThreshold, setTempRestrictionThreshold] = useState(
    activeSettings.tempRestrictionThreshold
  );
  const [suspensionReviewThreshold, setSuspensionReviewThreshold] = useState(
    activeSettings.suspensionReviewThreshold
  );
  const [tempRestrictionHours, setTempRestrictionHours] = useState(
    activeSettings.tempRestrictionHours
  );
  const [exceptionsText, setExceptionsText] = useState(
    activeSettings.approvedExceptions.join('\n')
  );

  // Self-test runner state
  const [customTestText, setCustomTestText] = useState('');
  const [customTestResult, setCustomTestResult] = useState<string>('');
  const [suiteResults, setSuiteResults] = useState<
    Array<{ label: string; pass: boolean; actual: string; expected: string; reason: string }>
  >([]);
  const [runningSuite, setRunningSuite] = useState(false);

  const recordModerationAction = async (
    targetUserId: string,
    actionType: ModerationAction['actionType'],
    notes: string,
    conversationId?: string,
    flagId?: string
  ) => {
    await addDoc(collection(db, 'moderation_actions'), {
      adminUid: adminUser.uid,
      targetUserId,
      ...(conversationId ? { conversationId } : {}),
      ...(flagId ? { flagId } : {}),
      actionType,
      notes: clampText(notes, 600),
      createdAt: serverTimestamp(),
    });
    await addDoc(collection(db, 'audit_logs'), {
      actorUid: adminUser.uid,
      actorRole: 'admin',
      eventType: `admin_${actionType}`,
      ...(conversationId ? { conversationId } : {}),
      targetId: targetUserId,
      summary: clampText(notes, 500),
      createdAt: serverTimestamp(),
    });
  };

  const handleFlagReview = async (
    flag: ModerationFlag,
    reviewStatus: ModerationFlag['reviewStatus']
  ) => {
    try {
      await updateDoc(doc(db, 'moderation_flags', flag.id), {
        reviewStatus,
        reviewedByUid: adminUser.uid,
        updatedAt: serverTimestamp(),
      });
      const actionType: ModerationAction['actionType'] =
        reviewStatus === 'exception_granted'
          ? 'approve_exception'
          : reviewStatus === 'false_positive'
          ? 'dismiss_flag'
          : 'issue_warning';
      await recordModerationAction(
        flag.userId,
        actionType,
        `Flag ${flag.id} marked ${reviewStatus}`,
        flag.conversationId,
        flag.id
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `moderation_flags/${flag.id}`);
    }
  };

  const handleApplyRestriction = async (
    userId: string,
    userName: string,
    level: 'warning' | 'temp_restricted' | 'suspended_review' | 'lifted',
    notes: string,
    conversationId?: string,
    flagId?: string
  ) => {
    try {
      const existing = messagingRestrictions.find((r) => r.userId === userId);
      const nextStatus = level === 'lifted' ? 'lifted' : 'active';
      const nextLevel = level === 'lifted' ? 'none' : level;
      const untilIso =
        level === 'temp_restricted'
          ? new Date(Date.now() + tempRestrictionHours * 3600 * 1000).toISOString()
          : '';

      if (!existing) {
        await setDoc(doc(db, 'messaging_restrictions', userId), {
          userId,
          userName,
          violationCount: level === 'lifted' ? 0 : 1,
          restrictionLevel: nextLevel,
          status: nextStatus,
          reason: clampText(notes || `Admin set messaging status to ${level}`, 500),
          ...(untilIso ? { restrictedUntilIso: untilIso } : {}),
          appealStatus: 'none',
          adminDecisionNotes: clampText(notes || `Updated by ${adminUser.fullName}`, 600),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, 'messaging_restrictions', userId), {
          restrictionLevel: nextLevel,
          status: nextStatus,
          reason: clampText(notes || existing.reason, 500),
          ...(untilIso ? { restrictedUntilIso: untilIso } : {}),
          adminDecisionNotes: clampText(notes || `Updated by ${adminUser.fullName}`, 600),
          updatedAt: serverTimestamp(),
        });
      }

      const actionType: ModerationAction['actionType'] =
        level === 'lifted'
          ? 'lift_restriction'
          : level === 'warning'
          ? 'issue_warning'
          : 'restrict_messaging';
      await recordModerationAction(
        userId,
        actionType,
        notes || `Set restriction level to ${level}`,
        conversationId,
        flagId
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `messaging_restrictions/${userId}`);
    }
  };

  const handleResolveAppeal = async (
    restriction: MessagingRestriction,
    decision: 'approved' | 'rejected'
  ) => {
    const notes =
      actionNotes[restriction.userId] ||
      (decision === 'approved'
        ? 'Appeal approved and messaging restriction lifted.'
        : 'Appeal rejected; restriction remains active.');
    try {
      await updateDoc(doc(db, 'messaging_restrictions', restriction.userId), {
        appealStatus: decision,
        status: decision === 'approved' ? 'lifted' : restriction.status,
        restrictionLevel: decision === 'approved' ? 'none' : restriction.restrictionLevel,
        adminDecisionNotes: clampText(notes, 600),
        updatedAt: serverTimestamp(),
      });
      await recordModerationAction(restriction.userId, 'resolve_appeal', notes);
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `messaging_restrictions/${restriction.userId}`
      );
    }
  };

  const handleToggleUserAccountSuspension = async (userId: string, suspend: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        status: suspend ? 'suspended' : 'active',
        updatedAt: serverTimestamp(),
      });
      await recordModerationAction(
        userId,
        'suspend_account',
        suspend ? 'Suspended account for severe contact-sharing violations' : 'Reactivated user account'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleResolveReport = async (
    report: MessageReport,
    status: 'resolved' | 'dismissed',
    restrictReportedUser: boolean
  ) => {
    const notes = actionNotes[report.id] || `Report ${status} by administrator.`;
    try {
      await updateDoc(doc(db, 'message_reports', report.id), {
        status,
        adminNotes: clampText(notes, 600),
        updatedAt: serverTimestamp(),
      });
      if (restrictReportedUser) {
        const target = users.find((u) => u.uid === report.reportedUserUid);
        await handleApplyRestriction(
          report.reportedUserUid,
          target?.fullName || 'Reported User',
          'temp_restricted',
          notes,
          report.conversationId
        );
      } else {
        await recordModerationAction(
          report.reportedUserUid,
          'dismiss_flag',
          notes,
          report.conversationId
        );
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `message_reports/${report.id}`);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSavedMsg('');
    try {
      const approvedExceptions = exceptionsText
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length >= 3)
        .slice(0, 100);

      await setDoc(doc(db, 'platform_moderation_settings', 'default'), {
        key: 'contact_protection',
        blockPhoneNumbers,
        blockWhatsApp,
        blockEmails,
        blockUrls,
        blockSocialMedia,
        blockMeetingLinks,
        detectSplitMessages,
        scanAttachments,
        warningThreshold: Math.max(1, Math.min(10, Number(warningThreshold) || 1)),
        tempRestrictionThreshold: Math.max(
          1,
          Math.min(20, Number(tempRestrictionThreshold) || 3)
        ),
        suspensionReviewThreshold: Math.max(
          2,
          Math.min(50, Number(suspensionReviewThreshold) || 5)
        ),
        tempRestrictionHours: Math.max(1, Math.min(720, Number(tempRestrictionHours) || 24)),
        approvedExceptions,
        updatedAt: serverTimestamp(),
      });

      await recordModerationAction(
        adminUser.uid,
        'update_settings',
        'Updated Contact Protection detection toggles, thresholds, and exception allowlist'
      );
      setSettingsSavedMsg('Contact Protection settings saved and enforced immediately.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'platform_moderation_settings/default');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleRunCustomTest = async () => {
    if (!customTestText.trim()) return;
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) return;
      const res = await fetch('/api/moderation/test', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: customTestText }),
      });
      const data = await res.json();
      if (data.detection) {
        setCustomTestResult(
          `Verdict: ${data.detection.verdict.toUpperCase()} · Type: ${
            data.detection.violationType || 'none'
          } · Reason: ${data.detection.reason}${
            data.detection.matchedIndicators?.length
              ? ` · Matched: [${data.detection.matchedIndicators.join(', ')}]`
              : ''
          }`
        );
      }
    } catch (err) {
      setCustomTestResult(err instanceof Error ? err.message : 'Test failed');
    }
  };

  const handleRunBuiltinSuite = async () => {
    setRunningSuite(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) return;
      const results: Array<{
        label: string;
        pass: boolean;
        actual: string;
        expected: string;
        reason: string;
      }> = [];
      for (const tc of BUILTIN_SELF_TESTS) {
        const res = await fetch('/api/moderation/test', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: tc.text,
            recentMessages: tc.recentMessages,
          }),
        });
        const data = await res.json();
        const actual = data.detection?.verdict || 'error';
        results.push({
          label: tc.label,
          pass: actual === tc.expectedVerdict,
          actual,
          expected: tc.expectedVerdict,
          reason: data.detection?.reason || '',
        });
      }
      setSuiteResults(results);
    } finally {
      setRunningSuite(false);
    }
  };

  const pendingFlagsCount = moderationFlags.filter((f) => f.reviewStatus === 'pending').length;
  const openReportsCount = messageReports.filter(
    (r) => r.status === 'open' || r.status === 'under_review'
  ).length;
  const activeRestrictionsCount = messagingRestrictions.filter((r) => r.status === 'active').length;
  const pendingAppealsCount = messagingRestrictions.filter(
    (r) => r.appealStatus === 'pending'
  ).length;

  return (
    <div className="space-y-6">
      {/* Executive Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Flagged / Blocked Events</p>
          <p className="font-mono-tabular text-2xl font-bold text-[#142B46] mt-1">
            {moderationFlags.length}{' '}
            <span className="text-xs font-semibold text-amber-600">({pendingFlagsCount} pending)</span>
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">User Message Reports</p>
          <p className="font-mono-tabular text-2xl font-bold text-[#142B46] mt-1">
            {messageReports.length}{' '}
            <span className="text-xs font-semibold text-red-600">({openReportsCount} open)</span>
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Active Restrictions / Appeals</p>
          <p className="font-mono-tabular text-2xl font-bold text-[#142B46] mt-1">
            {activeRestrictionsCount}{' '}
            <span className="text-xs font-semibold text-[#39836B]">
              ({pendingAppealsCount} appeals)
            </span>
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Total Violations / Actions</p>
          <p className="font-mono-tabular text-2xl font-bold text-[#142B46] mt-1">
            {userViolations.length} / {moderationActions.length}
          </p>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'flags', label: `Blocked & Flagged Attempts (${moderationFlags.length})` },
            { id: 'reports', label: `Reported Messages (${messageReports.length})` },
            { id: 'restrictions', label: `Restrictions & Appeals (${messagingRestrictions.length})` },
            { id: 'settings', label: 'Rules, Thresholds & Self-Test' },
            { id: 'audit', label: `Moderation & Audit Logs (${auditLogs.length})` },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSubTab(item.id)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors ${
              subTab === item.id
                ? 'bg-[#142B46] text-white border-[#142B46]'
                : 'bg-white text-slate-600 border-slate-200 hover:text-[#142B46]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* 1. Flagged & Blocked Attempts */}
      {subTab === 'flags' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-[#142B46]">
              Contact Protection Detection Log
            </h2>
          </div>
          {moderationFlags.length === 0 ? (
            <p className="text-sm text-slate-500">No blocked or flagged contact-sharing attempts recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {moderationFlags.map((flag) => (
                <div key={flag.id} className="border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-[#142B46]">{flag.userName}</span>
                      <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 font-semibold">
                        {flag.violationType}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                        {flag.detectionResult}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#F5BD54]/30 text-[#142B46] font-semibold">
                        Action: {flag.enforcementAction}
                      </span>
                    </div>
                    <span className="font-semibold text-[#39836B]">
                      Review: {flag.reviewStatus}
                    </span>
                  </div>
                  <p className="p-2.5 bg-[#F5F7FA] rounded-lg border border-slate-200 font-mono text-[11px] text-slate-800">
                    “{flag.attemptedText}”
                  </p>
                  {flag.matchedIndicators?.length > 0 && (
                    <p className="text-[11px] text-slate-500">
                      Matched Indicators: {flag.matchedIndicators.join(', ')}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onInspectConversation(flag.conversationId)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded-lg font-semibold text-[#142B46] hover:bg-slate-50"
                    >
                      <Eye className="w-3.5 h-3.5" /> Inspect Thread
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFlagReview(flag, 'confirmed_violation')}
                      className="px-3 py-1.5 bg-[#142B46] text-white rounded-lg font-semibold"
                    >
                      Confirm Violation
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFlagReview(flag, 'false_positive')}
                      className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg font-semibold"
                    >
                      Mark False Positive
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFlagReview(flag, 'exception_granted')}
                      className="px-3 py-1.5 bg-[#39836B] text-white rounded-lg font-semibold"
                    >
                      Approve Exception
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleApplyRestriction(
                          flag.userId,
                          flag.userName,
                          'temp_restricted',
                          `Restricted following ${flag.violationType} detection`,
                          flag.conversationId,
                          flag.id
                        )
                      }
                      className="px-3 py-1.5 border border-red-300 text-red-600 rounded-lg font-semibold"
                    >
                      Restrict Messaging
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. Reported Messages */}
      {subTab === 'reports' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-[#142B46]">
            User-Reported Conversations & Messages
          </h2>
          {messageReports.length === 0 ? (
            <p className="text-sm text-slate-500">No user message reports submitted.</p>
          ) : (
            <div className="space-y-3">
              {messageReports.map((rep) => (
                <div key={rep.id} className="border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-bold text-[#142B46]">
                      Reporter: {rep.reporterName} · Reason: {rep.reason}
                    </span>
                    <span className="font-semibold text-[#39836B]">Status: {rep.status}</span>
                  </div>
                  <p className="text-slate-700">{rep.details}</p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={actionNotes[rep.id] || ''}
                      onChange={(e) =>
                        setActionNotes((p) => ({ ...p, [rep.id]: e.target.value }))
                      }
                      placeholder="Moderation resolution notes..."
                      className="flex-1 min-w-[200px] px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => onInspectConversation(rep.conversationId)}
                      className="px-3 py-1.5 border border-slate-300 rounded-lg font-semibold text-[#142B46]"
                    >
                      Open Thread
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResolveReport(rep, 'resolved', true)}
                      className="px-3 py-1.5 bg-red-600 text-white rounded-lg font-semibold"
                    >
                      Resolve & Restrict User
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResolveReport(rep, 'dismissed', false)}
                      className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg font-semibold"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. User Violations, Restrictions & Appeals */}
      {subTab === 'restrictions' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-[#142B46]">
              User Messaging Restrictions & Appeals
            </h2>
            {messagingRestrictions.length === 0 ? (
              <p className="text-sm text-slate-500">No user restrictions or appeals on record.</p>
            ) : (
              <div className="space-y-3">
                {messagingRestrictions.map((r) => {
                  const account = users.find((u) => u.uid === r.userId);
                  const isSuspended = account?.status === 'suspended';
                  return (
                    <div key={r.userId} className="border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-bold text-[#142B46] text-sm">{r.userName}</span>
                          <span className="ml-2 font-mono text-[11px] text-slate-500">
                            ({r.violationCount} violations · level: {r.restrictionLevel} · status: {r.status})
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded font-semibold ${
                            r.appealStatus === 'pending'
                              ? 'bg-[#F5BD54]/30 text-[#142B46]'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          Appeal: {r.appealStatus}
                        </span>
                      </div>
                      <p className="text-slate-600">Latest Reason: {r.reason}</p>
                      {r.appealText && (
                        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">
                          <strong>User Appeal:</strong> {r.appealText}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <input
                          type="text"
                          value={actionNotes[r.userId] || ''}
                          onChange={(e) =>
                            setActionNotes((p) => ({ ...p, [r.userId]: e.target.value }))
                          }
                          placeholder="Admin decision notes..."
                          className="flex-1 min-w-[200px] px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                        />
                        {r.appealStatus === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleResolveAppeal(r, 'approved')}
                              className="px-3 py-1.5 bg-[#39836B] text-white rounded-lg font-semibold"
                            >
                              Approve Appeal & Lift
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResolveAppeal(r, 'rejected')}
                              className="px-3 py-1.5 border border-red-300 text-red-600 rounded-lg font-semibold"
                            >
                              Reject Appeal
                            </button>
                          </>
                        )}
                        {r.status === 'active' ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleApplyRestriction(
                                r.userId,
                                r.userName,
                                'lifted',
                                actionNotes[r.userId] || 'Restriction lifted by admin'
                              )
                            }
                            className="inline-flex items-center gap-1 px-3 py-1.5 border border-[#39836B] text-[#39836B] rounded-lg font-semibold"
                          >
                            <Unlock className="w-3.5 h-3.5" /> Lift Restriction
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              handleApplyRestriction(
                                r.userId,
                                r.userName,
                                'temp_restricted',
                                actionNotes[r.userId] || 'Restricted by admin'
                              )
                            }
                            className="inline-flex items-center gap-1 px-3 py-1.5 border border-amber-400 text-amber-800 rounded-lg font-semibold"
                          >
                            <Lock className="w-3.5 h-3.5" /> Restrict Messaging
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleToggleUserAccountSuspension(r.userId, !isSuspended)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold ${
                            isSuspended
                              ? 'bg-[#39836B] text-white'
                              : 'bg-red-600 text-white'
                          }`}
                        >
                          <Ban className="w-3.5 h-3.5" />
                          {isSuspended ? 'Reactivate Account' : 'Suspend Account'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <h3 className="font-display text-base font-bold text-[#142B46]">
              Violation History ({userViolations.length})
            </h3>
            {userViolations.length === 0 ? (
              <p className="text-xs text-slate-500">No user violations recorded.</p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {userViolations.slice(0, 30).map((v) => (
                  <div key={v.id} className="py-2.5 flex flex-wrap justify-between gap-2">
                    <div>
                      <span className="font-bold text-[#142B46]">{v.userName}</span> ·{' '}
                      <span className="text-red-600 font-semibold">{v.violationType}</span> ·{' '}
                      <span className="text-slate-600">{v.details}</span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-400">
                      {v.enforcementAction}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Rules, Thresholds & Live Detector Self-Test */}
      {subTab === 'settings' && (
        <div className="space-y-6">
          <form
            onSubmit={handleSaveSettings}
            className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
          >
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-[#142B46]" />
              <h2 className="font-display text-lg font-bold text-[#142B46]">
                Blocked Categories, Enforcement Thresholds & Approved Exceptions
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {[
                { label: 'Block Phone Numbers', val: blockPhoneNumbers, set: setBlockPhoneNumbers },
                { label: 'Block WhatsApp Links', val: blockWhatsApp, set: setBlockWhatsApp },
                { label: 'Block Email Addresses', val: blockEmails, set: setBlockEmails },
                { label: 'Block External URLs', val: blockUrls, set: setBlockUrls },
                { label: 'Block Social Handles', val: blockSocialMedia, set: setBlockSocialMedia },
                { label: 'Block External Meetings', val: blockMeetingLinks, set: setBlockMeetingLinks },
                { label: 'Cross-Message Split Scan', val: detectSplitMessages, set: setDetectSplitMessages },
                { label: 'Scan File Attachments', val: scanAttachments, set: setScanAttachments },
              ].map((toggle) => (
                <label
                  key={toggle.label}
                  className="flex items-center justify-between p-3 bg-[#F5F7FA] border border-slate-200 rounded-lg cursor-pointer"
                >
                  <span className="font-semibold text-[#142B46]">{toggle.label}</span>
                  <input
                    type="checkbox"
                    checked={toggle.val}
                    onChange={(e) => toggle.set(e.target.checked)}
                    className="w-4 h-4 accent-[#142B46]"
                  />
                </label>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">
                  1st Warning Threshold
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={warningThreshold}
                  onChange={(e) => setWarningThreshold(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">
                  Temp Restriction Threshold
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={tempRestrictionThreshold}
                  onChange={(e) => setTempRestrictionThreshold(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">
                  Admin Review / Suspension Threshold
                </label>
                <input
                  type="number"
                  min={2}
                  max={50}
                  value={suspensionReviewThreshold}
                  onChange={(e) => setSuspensionReviewThreshold(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">
                  Temp Restriction Hours
                </label>
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={tempRestrictionHours}
                  onChange={(e) => setTempRestrictionHours(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Approved Operational Exceptions (one domain, email, or link prefix per line)
              </label>
              <textarea
                rows={4}
                value={exceptionsText}
                onChange={(e) => setExceptionsText(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg bg-[#F5F7FA]"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={savingSettings}
                className="px-5 py-2.5 bg-[#142B46] text-white text-xs font-semibold rounded-lg disabled:opacity-50"
              >
                {savingSettings ? 'Saving...' : 'Save Moderation Rules'}
              </button>
              {settingsSavedMsg && (
                <span className="text-xs font-semibold text-[#39836B] inline-flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  {settingsSavedMsg}
                </span>
              )}
            </div>
          </form>

          {/* Backend Contact Detection Live Tester & Automated Suite */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-[#39836B]" />
                <div>
                  <h3 className="font-display text-base font-bold text-[#142B46]">
                    Backend Contact-Detection Verification Suite
                  </h3>
                  <p className="text-xs text-slate-500">
                    Test the live Express detection engine against obfuscation, split-messages, and
                    legitimate academic/corporate exceptions.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRunBuiltinSuite}
                disabled={runningSuite}
                className="px-4 py-2 bg-[#39836B] text-white text-xs font-semibold rounded-lg disabled:opacity-50"
              >
                {runningSuite ? 'Running 12 Cases...' : 'Run 12-Case Security Suite'}
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={customTestText}
                onChange={(e) => setCustomTestText(e.target.value)}
                placeholder="Enter custom test message (e.g. 'zero nine one one...' or 'https://tutorbridge.et/booking/123')..."
                className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
              <button
                type="button"
                onClick={handleRunCustomTest}
                className="px-4 py-2 bg-[#142B46] text-white text-xs font-semibold rounded-lg"
              >
                Test Payload
              </button>
            </div>

            {customTestResult && (
              <p className="p-3 bg-[#F5F7FA] border border-slate-200 rounded-lg text-xs font-mono text-[#142B46]">
                {customTestResult}
              </p>
            )}

            {suiteResults.length > 0 && (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                {suiteResults.map((r) => (
                  <div
                    key={r.label}
                    className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs bg-white"
                  >
                    <div>
                      <span className="font-bold text-[#142B46]">{r.label}</span>
                      <p className="text-[11px] text-slate-500">{r.reason}</p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded font-bold ${
                        r.pass
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {r.pass ? `PASS (${r.actual})` : `FAIL (got ${r.actual}, expected ${r.expected})`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Moderation & Audit Logs */}
      {subTab === 'audit' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <h3 className="font-display text-base font-bold text-[#142B46] inline-flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#142B46]" />
              Moderation Actions ({moderationActions.length})
            </h3>
            {moderationActions.length === 0 ? (
              <p className="text-xs text-slate-500">No moderation actions recorded.</p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {moderationActions.slice(0, 40).map((act) => (
                  <div key={act.id} className="py-2.5 space-y-0.5">
                    <div className="flex justify-between">
                      <span className="font-bold text-[#142B46]">{act.actionType}</span>
                      <span className="font-mono text-[11px] text-slate-400">
                        Target: {act.targetUserId}
                      </span>
                    </div>
                    <p className="text-slate-600">{act.notes}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <h3 className="font-display text-base font-bold text-[#142B46] inline-flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#39836B]" />
              System Communication Audit Logs ({auditLogs.length})
            </h3>
            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-500">No communication audit events yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {auditLogs.slice(0, 40).map((log) => (
                  <div key={log.id} className="py-2.5 space-y-0.5">
                    <div className="flex justify-between">
                      <span className="font-bold text-[#142B46]">{log.eventType}</span>
                      <span className="font-mono text-[11px] text-slate-400">
                        {log.actorRole} · {log.actorUid.slice(0, 8)}
                      </span>
                    </div>
                    <p className="text-slate-600">{log.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
