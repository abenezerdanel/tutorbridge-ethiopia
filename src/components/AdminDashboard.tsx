import React, { useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  Activity,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileText,
  GitCompare,
  KeyRound,
  Lock,
  LogOut,
  MessageSquare,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { BOOTSTRAPPED_ADMIN_EMAIL, db, handleFirestoreError, OperationType } from '../firebase';
import { SEED_CORPORATE_TRAINERS, SEED_TUTORS } from '../data/seedData';
import {
  AdminLog,
  AdminRecord,
  AuditLog,
  Booking,
  CategoryRecord,
  Conversation,
  CorporateInvoice,
  CorporateNegotiation,
  CorporateRefundRecord,
  CorporateRequest,
  CorporateTrainer,
  Message,
  MessageReport,
  MessagingRestriction,
  ModerationAction,
  ModerationFlag,
  Organization,
  PaymentRecord,
  PlatformModerationSetting,
  SupportTicket,
  TrainerAssignmentAgreement,
  TrainerCompensationRecord,
  TrainerPortfolioItem,
  TrainerSelectionRequest,
  TrainingAttendance,
  TrainingContract,
  TrainingProposal,
  TrainingQuotation,
  TrainingReport,
  TrainingSchedule,
  TutorDocument,
  TutorProfile,
  TutorRequest,
  UserAccount,
  UserViolation,
  clampText,
} from '../types';
import { AdminContactProtectionPanel } from './AdminContactProtectionPanel';
import { BrandMark } from './BrandMark';
import { MessagingCenter } from './MessagingCenter';

interface AdminDashboardProps {
  authReady: boolean;
  firebaseUid: string | null;
  firebaseEmail: string | null;
  firebaseEmailVerified: boolean;
  adminAuthError: string;
  currentUser: UserAccount | null;
  isAdmin: boolean;
  admins: AdminRecord[];
  users: UserAccount[];
  studentsCount: number;
  tutors: TutorProfile[];
  tutorDocuments: TutorDocument[];
  tutorRequests: TutorRequest[];
  bookings: Booking[];
  payments: PaymentRecord[];
  supportTickets: SupportTicket[];
  adminLogs: AdminLog[];
  // V1.1 Corporate Training props
  organizations: Organization[];
  corporateTrainers: CorporateTrainer[];
  trainerPortfolioItems: TrainerPortfolioItem[];
  trainerSelectionRequests: TrainerSelectionRequest[];
  corporateNegotiations: CorporateNegotiation[];
  trainerAssignmentAgreements: TrainerAssignmentAgreement[];
  trainerCompensationRecords: TrainerCompensationRecord[];
  corporateRefunds: CorporateRefundRecord[];
  corporateRequests: CorporateRequest[];
  trainingProposals: TrainingProposal[];
  trainingQuotations: TrainingQuotation[];
  trainingContracts: TrainingContract[];
  trainingSchedules: TrainingSchedule[];
  trainingAttendance: TrainingAttendance[];
  trainingReports: TrainingReport[];
  corporateInvoices: CorporateInvoice[];
  categories: CategoryRecord[];
  // Contact Protection & Messaging props
  conversations: Conversation[];
  messages: Message[];
  moderationFlags: ModerationFlag[];
  messageReports: MessageReport[];
  userViolations: UserViolation[];
  messagingRestrictions: MessagingRestriction[];
  moderationActions: ModerationAction[];
  auditLogs: AuditLog[];
  moderationSettings: PlatformModerationSetting | null;
  onAdminSignIn: () => Promise<void>;
  onSignOut: () => void;
  onExitAdmin: () => void;
}

type AdminTab =
  | 'overview'
  | 'verification'
  | 'matching'
  | 'payments'
  | 'bookings'
  | 'corp-orgs'
  | 'corp-trainers'
  | 'corp-requests'
  | 'corp-delivery'
  | 'corp-invoices'
  | 'contact-protection'
  | 'messages'
  | 'support'
  | 'admin-access'
  | 'logs';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  authReady,
  firebaseUid,
  firebaseEmail,
  firebaseEmailVerified,
  adminAuthError,
  currentUser,
  isAdmin,
  admins,
  users,
  studentsCount,
  tutors,
  tutorDocuments,
  tutorRequests,
  bookings,
  payments,
  supportTickets,
  adminLogs,
  organizations,
  corporateTrainers,
  trainerPortfolioItems,
  trainerSelectionRequests,
  corporateNegotiations,
  trainerAssignmentAgreements,
  trainerCompensationRecords,
  corporateRefunds,
  corporateRequests,
  trainingProposals,
  trainingQuotations,
  trainingContracts,
  trainingSchedules,
  trainingAttendance,
  trainingReports,
  corporateInvoices,
  categories,
  conversations,
  messages,
  moderationFlags,
  messageReports,
  userViolations,
  messagingRestrictions,
  moderationActions,
  auditLogs,
  moderationSettings,
  onAdminSignIn,
  onSignOut,
  onExitAdmin,
}) => {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [inspectConvId, setInspectConvId] = useState<string | null>(null);
  const [matchSelection, setMatchSelection] = useState<Record<string, string>>({});
  const [matchNotes, setMatchNotes] = useState<Record<string, string>>({});
  const [ticketReply, setTicketReply] = useState<Record<string, string>>({});
  const [seeding, setSeeding] = useState(false);

  // Corporate Trainer Search, Comparison & Portfolio Review state
  const [adminTrainerSearch, setAdminTrainerSearch] = useState('');
  const [adminCompareIds, setAdminCompareIds] = useState<string[]>([]);
  const [portfolioNotes, setPortfolioNotes] = useState<Record<string, string>>({});

  // Trainer Selection Requests Review state
  const [selAdminNotes, setSelAdminNotes] = useState<Record<string, string>>({});
  const [selAltTrainerId, setSelAltTrainerId] = useState<Record<string, string>>({});
  const [selLinkReqId, setSelLinkReqId] = useState<Record<string, string>>({});

  // Role-Isolated Negotiation Logger state
  const [negTargetType, setNegTargetType] = useState<'organization_quote' | 'trainer_compensation'>(
    'organization_quote'
  );
  const [negOrgOwnerUid, setNegOrgOwnerUid] = useState('');
  const [negTrainerUserId, setNegTrainerUserId] = useState('');
  const [negRequestId, setNegRequestId] = useState('');
  const [negAmountEtb, setNegAmountEtb] = useState<number>(25000);
  const [negTerms, setNegTerms] = useState('');
  const [negNotes, setNegNotes] = useState('');
  const [negStatus, setNegStatus] = useState<'open' | 'agreed'>('open');

  // Corporate Matching & Enhanced Quotation state
  const [corpTrainerChoice, setCorpTrainerChoice] = useState<Record<string, string>>({});
  const [corpScheduleInput, setCorpScheduleInput] = useState<Record<string, string>>({});
  const [quoteComp, setQuoteComp] = useState<Record<string, number>>({});
  const [quoteCoord, setQuoteCoord] = useState<Record<string, number>>({});
  const [quoteLogistics, setQuoteLogistics] = useState<Record<string, number>>({});
  const [quoteFee, setQuoteFee] = useState<Record<string, number>>({});
  const [quoteExtra, setQuoteExtra] = useState<Record<string, number>>({});
  const [quotePayTerms, setQuotePayTerms] = useState<Record<string, string>>({});
  const [quoteCancelTerms, setQuoteCancelTerms] = useState<Record<string, string>>({});
  const [quoteValidity, setQuoteValidity] = useState<Record<string, number>>({});
  const [quoteNotes, setQuoteNotes] = useState<Record<string, string>>({});

  // Trainer Replacement & Dual Assignment Agreement state
  const [replaceTrainerId, setReplaceTrainerId] = useState<Record<string, string>>({});
  const [replaceReason, setReplaceReason] = useState<Record<string, string>>({});
  const [assignContractId, setAssignContractId] = useState('');
  const [assignScope, setAssignScope] = useState('');
  const [assignSchedule, setAssignSchedule] = useState('');
  const [assignPaySchedule, setAssignPaySchedule] = useState(
    '50% after first week, 50% upon verified completion report'
  );
  const [assignCancelTerms, setAssignCancelTerms] = useState(
    '7-day advance written notice required; TutorBridge reserves right of replacement.'
  );

  // Trainer Compensation Payout & Corporate Refund Settlement state
  const [payoutAgreementId, setPayoutAgreementId] = useState('');
  const [payoutAmount, setPayoutAmount] = useState<number>(0);
  const [payoutMethod, setPayoutMethod] = useState<'Telebirr' | 'CBE Birr' | 'Bank Transfer'>(
    'Bank Transfer'
  );
  const [payoutRef, setPayoutRef] = useState('');
  const [payoutNotes, setPayoutNotes] = useState('');
  const [refundFeeInput, setRefundFeeInput] = useState<Record<string, number>>({});
  const [refundRefInput, setRefundRefInput] = useState<Record<string, string>>({});

  // Corporate Schedule creator state
  const [schedContractId, setSchedContractId] = useState('');
  const [schedTitle, setSchedTitle] = useState('');
  const [schedDate, setSchedDate] = useState(new Date().toISOString().slice(0, 10));
  const [schedTime, setSchedTime] = useState('09:00 AM – 04:00 PM');
  const [schedVenue, setSchedVenue] = useState('');

  // Custom Category state
  const [catName, setCatName] = useState('');
  const [catTopics, setCatTopics] = useState('');

  // Administrator Account Setup & Access state
  const [adminAuthLoading, setAdminAuthLoading] = useState(false);
  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [adminSetupNotice, setAdminSetupNotice] = useState('');
  const [adminSetupError, setAdminSetupError] = useState('');
  const [adminSetupBusy, setAdminSetupBusy] = useState(false);

  const logAdminAction = async (
    action: string,
    targetCollection: string,
    targetId: string,
    details: string
  ) => {
    if (!currentUser) return;
    try {
      await addDoc(collection(db, 'admin_logs'), {
        adminUid: currentUser.uid,
        action,
        targetCollection,
        targetId,
        details: clampText(details, 500),
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'admin_logs');
    }
  };

  const handleSeedTutors = async () => {
    setSeeding(true);
    try {
      for (const st of SEED_TUTORS) {
        const { id: tutorDocId, ...tutorPayload } = st;
        await setDoc(doc(db, 'tutors', tutorDocId), {
          ...tutorPayload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const ct of SEED_CORPORATE_TRAINERS) {
        const { id: trainerDocId, ...trainerPayload } = ct;
        await setDoc(doc(db, 'corporate_trainers', trainerDocId), {
          ...trainerPayload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await setDoc(doc(db, 'platform_settings', 'general'), {
        key: 'commission',
        commissionRate: 0.15,
        updatedAt: serverTimestamp(),
      });
      await logAdminAction(
        'seed_initial_tutors',
        'tutors',
        'seed_batch',
        'Seeded verified tutors, corporate trainers, and 15% commission config'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'tutors');
    } finally {
      setSeeding(false);
    }
  };

  const handleTutorStatus = async (
    tutor: TutorProfile,
    status: 'approved' | 'rejected' | 'suspended'
  ) => {
    try {
      await updateDoc(doc(db, 'tutors', tutor.id), {
        status,
        isVerified: status === 'approved',
        updatedAt: serverTimestamp(),
      });
      if (status === 'approved') {
        const docs = tutorDocuments.filter((d) => d.tutorId === tutor.id && d.status === 'pending');
        for (const td of docs) {
          await updateDoc(doc(db, 'tutor_documents', td.id), {
            status: 'verified',
            updatedAt: serverTimestamp(),
          });
        }
      }
      await logAdminAction(
        `tutor_${status}`,
        'tutors',
        tutor.id,
        `Updated ${tutor.fullName} to ${status}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tutors/${tutor.id}`);
    }
  };

  const handleProposeMatch = async (req: TutorRequest) => {
    const selectedId = matchSelection[req.id];
    const tutor = tutors.find((t) => t.id === selectedId);
    if (!tutor) return;
    try {
      await updateDoc(doc(db, 'tutor_requests', req.id), {
        status: 'candidates_proposed',
        proposedTutorId: tutor.id,
        proposedTutorName: tutor.fullName,
        adminNotes: clampText(
          matchNotes[req.id] || `Recommended ${tutor.fullName} (${tutor.hourlyRateEtb} ETB/hr)`,
          600
        ),
        updatedAt: serverTimestamp(),
      });
      await logAdminAction(
        'propose_tutor_match',
        'tutor_requests',
        req.id,
        `Proposed ${tutor.fullName} for student ${req.studentName}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tutor_requests/${req.id}`);
    }
  };

  const handleVerifyPayment = async (
    pay: PaymentRecord,
    decision: 'verified' | 'rejected' | 'refunded'
  ) => {
    try {
      await updateDoc(doc(db, 'payments', pay.id), {
        status: decision,
        updatedAt: serverTimestamp(),
      });
      if (decision === 'verified') {
        await updateDoc(doc(db, 'bookings', pay.bookingId), {
          paymentStatus: 'verified',
          status: 'confirmed',
          updatedAt: serverTimestamp(),
        });
      } else if (decision === 'refunded') {
        await updateDoc(doc(db, 'bookings', pay.bookingId), {
          paymentStatus: 'refunded',
          status: 'cancelled',
          updatedAt: serverTimestamp(),
        });
      }
      await logAdminAction(
        `payment_${decision}`,
        'payments',
        pay.id,
        `Marked payment ${pay.transactionRef} (${pay.amountEtb} ETB) as ${decision}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `payments/${pay.id}`);
    }
  };

  const handleResolveTicket = async (ticket: SupportTicket, nextStatus: 'in_review' | 'resolved') => {
    try {
      await updateDoc(doc(db, 'support_tickets', ticket.id), {
        status: nextStatus,
        adminResponse: clampText(ticketReply[ticket.id] || ticket.adminResponse || '', 1000),
        updatedAt: serverTimestamp(),
      });
      await logAdminAction(
        `ticket_${nextStatus}`,
        'support_tickets',
        ticket.id,
        `Updated ticket "${ticket.subject}" to ${nextStatus}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `support_tickets/${ticket.id}`);
    }
  };

  // V1.1 Corporate Training Admin Actions
  const handleOrgStatus = async (
    org: Organization,
    status: 'approved' | 'suspended'
  ) => {
    try {
      await updateDoc(doc(db, 'organizations', org.id), {
        status,
        updatedAt: serverTimestamp(),
      });
      await logAdminAction(
        `org_${status}`,
        'organizations',
        org.id,
        `Updated organization ${org.name} to ${status}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `organizations/${org.id}`);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const topics = catTopics
      .split(',')
      .map((s) => clampText(s, 100))
      .filter(Boolean)
      .slice(0, 30);
    if (!catName.trim() || topics.length === 0) return;
    try {
      const ref = await addDoc(collection(db, 'categories'), {
        division: 'Corporate & Organizational Training',
        name: clampText(catName, 120),
        topics,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logAdminAction('create_category', 'categories', ref.id, `Added category ${catName}`);
      setCatName('');
      setCatTopics('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'categories');
    }
  };

  const handleToggleCategory = async (cat: CategoryRecord) => {
    try {
      await updateDoc(doc(db, 'categories', cat.id), {
        isActive: !cat.isActive,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `categories/${cat.id}`);
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    try {
      await deleteDoc(doc(db, 'categories', catId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `categories/${catId}`);
    }
  };

  const handleCorporateTrainerStatus = async (
    trainer: CorporateTrainer,
    status: 'approved' | 'rejected' | 'suspended'
  ) => {
    try {
      await updateDoc(doc(db, 'corporate_trainers', trainer.id), {
        status,
        isVerified: status === 'approved',
        updatedAt: serverTimestamp(),
      });
      if (status === 'approved') {
        const docs = tutorDocuments.filter(
          (d) =>
            (d.tutorId === trainer.id || d.userId === trainer.userId) && d.status === 'pending'
        );
        for (const td of docs) {
          await updateDoc(doc(db, 'tutor_documents', td.id), {
            status: 'verified',
            updatedAt: serverTimestamp(),
          });
        }
      }
      await logAdminAction(
        `corporate_trainer_${status}`,
        'corporate_trainers',
        trainer.id,
        `Updated corporate trainer ${trainer.fullName} to ${status}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `corporate_trainers/${trainer.id}`);
    }
  };

  const handleApplyPendingQualification = async (
    trainer: CorporateTrainer,
    approve: boolean
  ) => {
    if (!trainer.pendingQualificationUpdate) return;
    try {
      await updateDoc(doc(db, 'corporate_trainers', trainer.id), {
        ...(approve
          ? {
              qualifications: clampText(
                `${trainer.qualifications}; ${trainer.pendingQualificationUpdate}`,
                400
              ),
            }
          : {}),
        pendingQualificationUpdate: '',
        updatedAt: serverTimestamp(),
      });
      await logAdminAction(
        approve ? 'approve_trainer_qualification' : 'dismiss_trainer_qualification',
        'corporate_trainers',
        trainer.id,
        `${approve ? 'Approved' : 'Dismissed'} qualification update for ${trainer.fullName}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `corporate_trainers/${trainer.id}`);
    }
  };

  const handleReviewPortfolioItem = async (
    item: TrainerPortfolioItem,
    decision: 'approved' | 'rejected'
  ) => {
    try {
      await updateDoc(doc(db, 'trainer_portfolio_items', item.id), {
        status: decision,
        adminNotes: clampText(portfolioNotes[item.id] || '', 400),
        updatedAt: serverTimestamp(),
      });
      await logAdminAction(
        `portfolio_${decision}`,
        'trainer_portfolio_items',
        item.id,
        `Marked portfolio sample "${item.title}" as ${decision}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `trainer_portfolio_items/${item.id}`);
    }
  };

  const handleSelectionAction = async (
    sel: TrainerSelectionRequest,
    decision: 'in_coordination' | 'approved' | 'alternative_suggested' | 'rejected'
  ) => {
    const altTrainer = corporateTrainers.find((t) => t.id === selAltTrainerId[sel.id]);
    const linkedReqId = selLinkReqId[sel.id] || sel.corporateRequestId || '';
    const linkedReq = corporateRequests.find((r) => r.id === linkedReqId);
    const chosenTrainer =
      corporateTrainers.find((t) => t.id === sel.selectedTrainerId) || altTrainer;

    try {
      await updateDoc(doc(db, 'trainer_selection_requests', sel.id), {
        status: decision,
        ...(decision === 'alternative_suggested' && altTrainer
          ? {
              suggestedTrainerId: altTrainer.id,
              suggestedTrainerName: altTrainer.fullName,
            }
          : {}),
        adminNotes: clampText(selAdminNotes[sel.id] || sel.adminNotes || '', 600),
        updatedAt: serverTimestamp(),
      });

      if (decision === 'approved' && linkedReq && chosenTrainer) {
        await addDoc(collection(db, 'training_proposals'), {
          requestId: linkedReq.id,
          organizationId: linkedReq.organizationId,
          organizationOwnerUid: linkedReq.ownerUid,
          trainerId: chosenTrainer.id,
          trainerUserId: chosenTrainer.userId,
          trainerName: chosenTrainer.fullName,
          trainerQualifications: chosenTrainer.qualifications,
          trainerMethodology: chosenTrainer.methodology,
          proposedSchedule: `${linkedReq.preferredDates} (${linkedReq.duration})`,
          status: 'proposed',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await updateDoc(doc(db, 'corporate_requests', linkedReq.id), {
          status: 'trainers_sourced',
          updatedAt: serverTimestamp(),
        });
      }

      await logAdminAction(
        `selection_${decision}`,
        'trainer_selection_requests',
        sel.id,
        `Updated selection request for ${sel.organizationName} (${sel.selectedTrainerName}) to ${decision}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `trainer_selection_requests/${sel.id}`);
    }
  };

  const handleLogNegotiation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!negTerms.trim()) return;
    if (negTargetType === 'organization_quote' && !negOrgOwnerUid) return;
    if (!currentUser) return;
    if (negTargetType === 'trainer_compensation' && !negTrainerUserId) return;

    const orgMatch = organizations.find((o) => o.ownerUid === negOrgOwnerUid);
    const trMatch = corporateTrainers.find((t) => t.userId === negTrainerUserId);
    const participantLabel =
      negTargetType === 'organization_quote'
        ? orgMatch?.name || 'Corporate Organization'
        : trMatch?.fullName || 'Corporate Trainer';

    try {
      const ref = await addDoc(collection(db, 'corporate_negotiations'), {
        targetType: negTargetType,
        ...(negRequestId ? { requestId: negRequestId } : {}),
        ...(negTargetType === 'organization_quote'
          ? { organizationOwnerUid: negOrgOwnerUid }
          : { trainerUserId: negTrainerUserId }),
        participantLabel: clampText(participantLabel, 160),
        proposedAmountEtb: Math.max(0, negAmountEtb),
        proposedTerms: clampText(negTerms, 600),
        notes: clampText(negNotes, 600),
        status: negStatus,
        adminUid: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logAdminAction(
        `log_negotiation_${negTargetType}`,
        'corporate_negotiations',
        ref.id,
        `Logged ${negTargetType} for ${participantLabel} (${negAmountEtb} ETB)`
      );
      setNegTerms('');
      setNegNotes('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'corporate_negotiations');
    }
  };

  const handleAssignCorporateTrainer = async (req: CorporateRequest) => {
    const trainerId = corpTrainerChoice[req.id];
    const trainer = corporateTrainers.find((t) => t.id === trainerId);
    if (!trainer) return;
    try {
      const propRef = await addDoc(collection(db, 'training_proposals'), {
        requestId: req.id,
        organizationId: req.organizationId,
        organizationOwnerUid: req.ownerUid,
        trainerId: trainer.id,
        trainerUserId: trainer.userId,
        trainerName: trainer.fullName,
        trainerQualifications: trainer.qualifications,
        trainerMethodology: trainer.methodology,
        proposedSchedule: clampText(
          corpScheduleInput[req.id] || `${req.preferredDates} (${req.duration})`,
          240
        ),
        status: 'proposed',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'corporate_requests', req.id), {
        status: 'trainers_sourced',
        updatedAt: serverTimestamp(),
      });
      await logAdminAction(
        'assign_corporate_trainer',
        'training_proposals',
        propRef.id,
        `Proposed trainer ${trainer.fullName} for ${req.organizationName}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'training_proposals');
    }
  };

  const handleAdminConfirmTrainerProposal = async (prop: TrainingProposal) => {
    try {
      await updateDoc(doc(db, 'training_proposals', prop.id), {
        status: 'accepted_by_trainer',
        trainerResponseNotes: prop.trainerResponseNotes || 'Confirmed via TutorBridge coordinator',
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `training_proposals/${prop.id}`);
    }
  };

  const handleCreateQuotation = async (req: CorporateRequest, prop: TrainingProposal) => {
    const trainerComp = quoteComp[prop.id] ?? 20000;
    const coordFee = quoteCoord[prop.id] ?? 0;
    const logistics = quoteLogistics[prop.id] ?? 3000;
    const serviceFee = quoteFee[prop.id] ?? 5000;
    const extraCharges = quoteExtra[prop.id] ?? 0;
    const total = Math.max(100, trainerComp + coordFee + logistics + serviceFee + extraCharges);
    try {
      const qRef = await addDoc(collection(db, 'training_quotations'), {
        requestId: req.id,
        proposalId: prop.id,
        organizationId: req.organizationId,
        organizationOwnerUid: req.ownerUid,
        trainerCompensationEtb: trainerComp,
        coordinationFeeEtb: coordFee,
        logisticalExpensesEtb: logistics,
        serviceFeeEtb: serviceFee,
        additionalChargesEtb: extraCharges,
        totalAmountEtb: total,
        paymentTerms: clampText(
          quotePayTerms[prop.id] ||
            '50% mobilization upon contract execution, 50% upon training completion',
          400
        ),
        cancellationTerms: clampText(
          quoteCancelTerms[prop.id] ||
            '7+ days prior: full rescheduling or refund less 10% coordination fee.',
          600
        ),
        validityDays: Math.min(365, Math.max(1, quoteValidity[prop.id] ?? 14)),
        pricingNotes: clampText(
          quoteNotes[prop.id] || `Itemized quotation for ${req.participantCount} staff`,
          600
        ),
        status: 'sent',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'corporate_requests', req.id), {
        status: 'proposal_sent',
        updatedAt: serverTimestamp(),
      });
      await logAdminAction(
        'send_corporate_quotation',
        'training_quotations',
        qRef.id,
        `Sent quotation (${total} ETB) to ${req.organizationName}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'training_quotations');
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    const contract = trainingContracts.find((c) => c.id === schedContractId);
    if (!contract || !schedTitle.trim() || !schedVenue.trim()) return;
    try {
      const ref = await addDoc(collection(db, 'training_schedules'), {
        contractId: contract.id,
        organizationId: contract.organizationId,
        organizationOwnerUid: contract.organizationOwnerUid,
        trainerUserId: contract.trainerUserId,
        sessionTitle: clampText(schedTitle, 160),
        sessionDate: schedDate,
        timeRange: clampText(schedTime, 80),
        venue: clampText(schedVenue, 200),
        status: 'scheduled',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logAdminAction(
        'create_training_schedule',
        'training_schedules',
        ref.id,
        `Scheduled "${schedTitle}" for ${contract.organizationName}`
      );
      setSchedTitle('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'training_schedules');
    }
  };

  const handleReplaceContractTrainer = async (contract: TrainingContract) => {
    const newTrainerId = replaceTrainerId[contract.id];
    const newTrainer = corporateTrainers.find((t) => t.id === newTrainerId);
    if (!newTrainer || newTrainer.id === contract.trainerId) return;
    const reason = clampText(replaceReason[contract.id] || 'Continuity reassignment', 60);
    const entry = clampText(
      `${new Date().toISOString().slice(0, 10)}: ${contract.trainerName} -> ${newTrainer.fullName} (${reason})`,
      120
    );
    const updatedHistory = [...(contract.replacementHistory || []), entry].slice(-30);
    try {
      await updateDoc(doc(db, 'training_contracts', contract.id), {
        trainerId: newTrainer.id,
        trainerUserId: newTrainer.userId,
        trainerName: newTrainer.fullName,
        replacementHistory: updatedHistory,
        updatedAt: serverTimestamp(),
      });
      // Reassign scheduled future sessions on this contract to the replacement trainer
      const contractScheds = trainingSchedules.filter(
        (s) => s.contractId === contract.id && s.status !== 'completed'
      );
      for (const s of contractScheds) {
        await updateDoc(doc(db, 'training_schedules', s.id), {
          trainerUserId: newTrainer.userId,
          updatedAt: serverTimestamp(),
        });
      }
      await logAdminAction(
        'replace_contract_trainer',
        'training_contracts',
        contract.id,
        `Replaced ${contract.trainerName} with ${newTrainer.fullName}`
      );
      setReplaceTrainerId((prev) => ({ ...prev, [contract.id]: '' }));
      setReplaceReason((prev) => ({ ...prev, [contract.id]: '' }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `training_contracts/${contract.id}`);
    }
  };

  const handleUpdateContractStatus = async (
    contract: TrainingContract,
    nextStatus: 'completed' | 'cancelled'
  ) => {
    try {
      await updateDoc(doc(db, 'training_contracts', contract.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      if (nextStatus === 'completed') {
        await updateDoc(doc(db, 'corporate_requests', contract.requestId), {
          status: 'completed',
          updatedAt: serverTimestamp(),
        });
      }
      await logAdminAction(
        `contract_${nextStatus}`,
        'training_contracts',
        contract.id,
        `Marked contract "${contract.title}" ${nextStatus}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `training_contracts/${contract.id}`);
    }
  };

  const handleIssueTrainerAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    const contract = trainingContracts.find((c) => c.id === assignContractId);
    if (!contract || !assignScope.trim() || !assignSchedule.trim()) return;
    try {
      const ref = await addDoc(collection(db, 'trainer_assignment_agreements'), {
        contractId: contract.id,
        requestId: contract.requestId,
        trainerId: contract.trainerId,
        trainerUserId: contract.trainerUserId,
        trainerName: contract.trainerName,
        organizationLabel: contract.organizationName,
        title: clampText(`Trainer Assignment — ${contract.title}`, 200),
        scopeOfWork: clampText(assignScope, 1500),
        scheduleSummary: clampText(assignSchedule, 240),
        trainerCompensationEtb: contract.trainerCompensationEtb,
        paymentSchedule: clampText(assignPaySchedule, 400),
        cancellationTerms: clampText(assignCancelTerms, 600),
        governingLawClause:
          'Governed by the Ethiopian Civil Code (Proclamation No. 165/1960) between Trainer and TutorBridge Ethiopia.',
        status: 'pending_acceptance',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logAdminAction(
        'issue_trainer_assignment',
        'trainer_assignment_agreements',
        ref.id,
        `Issued separate trainer assignment agreement to ${contract.trainerName}`
      );
      setAssignContractId('');
      setAssignScope('');
      setAssignSchedule('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'trainer_assignment_agreements');
    }
  };

  const handleRecordTrainerPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    const ag = trainerAssignmentAgreements.find((a) => a.id === payoutAgreementId);
    if (!ag || !payoutRef.trim()) return;
    try {
      const ref = await addDoc(collection(db, 'trainer_compensation_records'), {
        agreementId: ag.id,
        contractId: ag.contractId,
        trainerId: ag.trainerId,
        trainerUserId: ag.trainerUserId,
        trainerName: ag.trainerName,
        amountEtb: payoutAmount > 0 ? payoutAmount : ag.trainerCompensationEtb,
        paymentMethod: payoutMethod,
        transactionRef: clampText(payoutRef, 120),
        status: 'scheduled',
        notes: clampText(payoutNotes, 500),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logAdminAction(
        'schedule_trainer_payout',
        'trainer_compensation_records',
        ref.id,
        `Scheduled ${payoutAmount || ag.trainerCompensationEtb} ETB payout for ${ag.trainerName}`
      );
      setPayoutAgreementId('');
      setPayoutAmount(0);
      setPayoutRef('');
      setPayoutNotes('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'trainer_compensation_records');
    }
  };

  const handleMarkPayoutPaid = async (rec: TrainerCompensationRecord) => {
    try {
      await updateDoc(doc(db, 'trainer_compensation_records', rec.id), {
        status: 'paid',
        paidDate: new Date().toISOString().slice(0, 10),
        updatedAt: serverTimestamp(),
      });
      await logAdminAction(
        'mark_trainer_payout_paid',
        'trainer_compensation_records',
        rec.id,
        `Marked trainer payout ${rec.amountEtb} ETB (${rec.transactionRef}) as paid`
      );
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `trainer_compensation_records/${rec.id}`
      );
    }
  };

  const handleResolveRefund = async (
    rf: CorporateRefundRecord,
    decision: 'approved' | 'processed' | 'rejected'
  ) => {
    const fee = refundFeeInput[rf.id] ?? rf.cancellationFeeEtb ?? 0;
    const procRef = clampText(refundRefInput[rf.id] || rf.processedRef || '', 120);
    try {
      await updateDoc(doc(db, 'corporate_refunds', rf.id), {
        cancellationFeeEtb: Math.max(0, fee),
        ...(procRef ? { processedRef: procRef } : {}),
        status: decision,
        updatedAt: serverTimestamp(),
      });
      if (decision === 'processed' && rf.invoiceId) {
        await updateDoc(doc(db, 'corporate_invoices', rf.invoiceId), {
          status: 'refunded',
          updatedAt: serverTimestamp(),
        });
      }
      await logAdminAction(
        `corporate_refund_${decision}`,
        'corporate_refunds',
        rf.id,
        `Updated refund for ${rf.organizationName} (${rf.refundAmountEtb} ETB) to ${decision}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `corporate_refunds/${rf.id}`);
    }
  };

  const handleVerifyCorporateInvoice = async (
    inv: CorporateInvoice,
    decision: 'paid' | 'refunded'
  ) => {
    try {
      await updateDoc(doc(db, 'corporate_invoices', inv.id), {
        status: decision,
        updatedAt: serverTimestamp(),
      });
      await logAdminAction(
        `corporate_invoice_${decision}`,
        'corporate_invoices',
        inv.id,
        `Updated invoice ${inv.invoiceNumber} (${inv.amountEtb} ETB) to ${decision}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `corporate_invoices/${inv.id}`);
    }
  };

  const filteredAdminTrainers = useMemo(() => {
    const q = adminTrainerSearch.trim().toLowerCase();
    if (!q) return corporateTrainers;
    return corporateTrainers.filter((tr) =>
      [tr.fullName, tr.headline, tr.qualifications, ...tr.categories, ...tr.topics]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [corporateTrainers, adminTrainerSearch]);

  const adminComparedTrainers = useMemo(
    () =>
      adminCompareIds
        .map((id) => corporateTrainers.find((t) => t.id === id))
        .filter((t): t is CorporateTrainer => Boolean(t)),
    [adminCompareIds, corporateTrainers]
  );

  const toggleAdminCompare = (trainerId: string) => {
    setAdminCompareIds((prev) =>
      prev.includes(trainerId)
        ? prev.filter((id) => id !== trainerId)
        : prev.length >= 4
          ? prev
          : [...prev, trainerId]
    );
  };

  const handleGrantAdminAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminSetupNotice('');
    setAdminSetupError('');
    const uidTrimmed = newAdminUid.trim();
    const emailTrimmed = newAdminEmail.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(uidTrimmed)) {
      setAdminSetupError('Invalid Firebase UID format (letters, numbers, _ or - only).');
      return;
    }
    if (!emailTrimmed || !emailTrimmed.includes('@')) {
      setAdminSetupError('Please provide the verified Google email address for this user.');
      return;
    }
    setAdminSetupBusy(true);
    try {
      await setDoc(doc(db, 'admins', uidTrimmed), {
        uid: uidTrimmed,
        email: emailTrimmed,
        grantedAt: serverTimestamp(),
      });
      const matchingUser = users.find((u) => u.uid === uidTrimmed);
      if (matchingUser && matchingUser.role !== 'admin') {
        await updateDoc(doc(db, 'users', uidTrimmed), {
          role: 'admin',
          updatedAt: serverTimestamp(),
        });
      }
      await logAdminAction(
        'grant_admin_access',
        'admins',
        uidTrimmed,
        `Authorized administrator access for ${emailTrimmed}`
      );
      setNewAdminUid('');
      setNewAdminEmail('');
      setAdminSetupNotice(
        `Administrator access granted to ${emailTrimmed}. They can now sign in at /admin.`
      );
    } catch (error) {
      setAdminSetupError(
        error instanceof Error ? error.message : 'Unable to grant administrator access.'
      );
    } finally {
      setAdminSetupBusy(false);
    }
  };

  const handleSyncSelfAdminRecord = async () => {
    if (!currentUser) return;
    setAdminSetupNotice('');
    setAdminSetupError('');
    setAdminSetupBusy(true);
    try {
      await setDoc(doc(db, 'admins', currentUser.uid), {
        uid: currentUser.uid,
        email: currentUser.email.toLowerCase(),
        grantedAt: serverTimestamp(),
      });
      if (currentUser.role !== 'admin') {
        await updateDoc(doc(db, 'users', currentUser.uid), {
          role: 'admin',
          updatedAt: serverTimestamp(),
        });
      }
      setAdminSetupNotice('Primary administrator record synchronized in Firestore.');
    } catch (error) {
      setAdminSetupError(
        error instanceof Error ? error.message : 'Unable to synchronize admin record.'
      );
    } finally {
      setAdminSetupBusy(false);
    }
  };

  const handleRevokeAdminAccess = async (record: AdminRecord) => {
    if (!currentUser) return;
    setAdminSetupNotice('');
    setAdminSetupError('');
    if (record.uid === currentUser.uid) {
      setAdminSetupError('You cannot revoke your own active administrator session.');
      return;
    }
    if (record.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()) {
      setAdminSetupError('The primary bootstrapped administrator account cannot be revoked.');
      return;
    }
    setAdminSetupBusy(true);
    try {
      await deleteDoc(doc(db, 'admins', record.uid));
      const matchingUser = users.find((u) => u.uid === record.uid);
      if (matchingUser && matchingUser.role === 'admin') {
        await updateDoc(doc(db, 'users', record.uid), {
          role: 'parent',
          updatedAt: serverTimestamp(),
        });
      }
      await logAdminAction(
        'revoke_admin_access',
        'admins',
        record.uid,
        `Revoked administrator access for ${record.email}`
      );
      setAdminSetupNotice(`Administrator access revoked for ${record.email}.`);
    } catch (error) {
      setAdminSetupError(
        error instanceof Error ? error.message : 'Unable to revoke administrator access.'
      );
    } finally {
      setAdminSetupBusy(false);
    }
  };

  const triggerAdminGoogleSignIn = async () => {
    setAdminAuthLoading(true);
    try {
      await onAdminSignIn();
    } finally {
      setAdminAuthLoading(false);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#142B46] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
          <BrandMark className="w-10 h-10 mx-auto" />
          <h1 className="font-display text-lg font-bold text-[#142B46]">
            TutorBridge Private Admin Portal
          </h1>
          <p className="text-sm text-slate-600">Verifying administrator session...</p>
        </div>
      </div>
    );
  }

  if (!firebaseUid || !currentUser || !isAdmin) {
    const isSignedInUnauthorized = Boolean(firebaseUid);
    return (
      <div className="min-h-screen bg-[#142B46] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8 space-y-5">
          <div className="flex items-center gap-3">
            <BrandMark className="w-9 h-9 shrink-0" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#39836B]">
                Private Operations Portal
              </p>
              <h1 className="font-display text-xl font-bold text-[#142B46]">
                Administrator Sign In
              </h1>
            </div>
          </div>

          {!isSignedInUnauthorized ? (
            <p className="text-sm text-slate-600 leading-relaxed">
              Sign in with an authorized TutorBridge Ethiopia administrator Google account. Public
              user accounts do not have access to this console.
            </p>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2 text-xs text-red-900">
              <p className="font-bold flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                Administrator Access Not Authorized
              </p>
              <p>
                Signed in as <span className="font-semibold">{firebaseEmail || 'unknown email'}</span>
                {!firebaseEmailVerified && ' (email not verified)'}.
              </p>
              <p className="text-red-800">
                This account does not have TutorBridge administrator privileges. Only authorized
                administrators registered in the TutorBridge Administrator registry may access this
                console.
              </p>
              <p className="font-mono-tabular bg-white/80 border border-red-200 rounded px-2.5 py-1.5 text-[11px] break-all">
                UID: {firebaseUid}
              </p>
            </div>
          )}

          {adminAuthError && (
            <p className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {adminAuthError}
            </p>
          )}

          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={triggerAdminGoogleSignIn}
              disabled={adminAuthLoading}
              className="w-full py-2.5 px-4 bg-[#142B46] text-white text-sm font-semibold rounded-lg hover:bg-[#1e3d63] disabled:opacity-60 transition-colors"
            >
              {adminAuthLoading
                ? 'Authenticating...'
                : isSignedInUnauthorized
                  ? 'Switch Administrator Google Account'
                  : 'Sign In with Administrator Google Account'}
            </button>

            {isSignedInUnauthorized && (
              <button
                type="button"
                onClick={onSignOut}
                className="w-full py-2 px-4 border border-slate-300 text-[#142B46] text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors"
              >
                Sign Out Current Account
              </button>
            )}

            <button
              type="button"
              onClick={onExitAdmin}
              className="w-full py-2 px-4 text-xs font-medium text-slate-500 hover:text-[#142B46] transition-colors"
            >
              Return to Public Website
            </button>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-start gap-2">
            <Lock className="w-3.5 h-3.5 text-[#39836B] shrink-0 mt-0.5" />
            <span>
              Protected by Firebase Authentication, verified-email enforcement, and Firestore RBAC
              security rules.
            </span>
          </div>
        </div>
      </div>
    );
  }

  const approvedTutors = tutors.filter((t) => t.status === 'approved');
  const pendingTutors = tutors.filter((t) => t.status === 'pending');
  const verifiedPayments = payments.filter((p) => p.status === 'verified');
  const totalVolumeEtb = verifiedPayments.reduce((s, p) => s + p.amountEtb, 0);
  const totalCommissionEtb = verifiedPayments.reduce((s, p) => s + p.commissionEtb, 0);

  const approvedCorpTrainers = corporateTrainers.filter((t) => t.status === 'approved');
  const paidCorpInvoices = corporateInvoices.filter((i) => i.status === 'paid');
  const corpVolumeEtb = paidCorpInvoices.reduce((s, i) => s + i.amountEtb, 0);
  const corpRevenueEtb = paidCorpInvoices.reduce((s, i) => s + i.serviceFeeEtb, 0);

  const pendingProtectionCount =
    moderationFlags.filter((f) => f.reviewStatus === 'pending').length +
    messageReports.filter((r) => r.status === 'open').length;

  const navItems: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Executive Overview', icon: <Activity className="w-4 h-4" /> },
    { id: 'verification', label: 'Tutor Verification', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'matching', label: 'Tutor Matching', icon: <ClipboardCheck className="w-4 h-4" /> },
    { id: 'payments', label: 'Tutoring Payments', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'bookings', label: 'Tutoring Bookings', icon: <Users className="w-4 h-4" /> },
    { id: 'corp-orgs', label: 'Corporate Orgs & Categories', icon: <Building2 className="w-4 h-4" /> },
    { id: 'corp-trainers', label: 'Corporate Trainers', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'corp-requests', label: 'Corporate Requests & Quotes', icon: <FileText className="w-4 h-4" /> },
    { id: 'corp-delivery', label: 'Contracts & Delivery', icon: <Calendar className="w-4 h-4" /> },
    { id: 'corp-invoices', label: 'Corporate Invoices', icon: <Receipt className="w-4 h-4" /> },
    {
      id: 'contact-protection',
      label:
        pendingProtectionCount > 0
          ? `Contact Protection (${pendingProtectionCount})`
          : 'Contact Protection',
      icon: <ShieldAlert className="w-4 h-4" />,
    },
    {
      id: 'messages',
      label: `All Conversations (${conversations.length})`,
      icon: <MessageSquare className="w-4 h-4" />,
    },
    { id: 'support', label: 'Support & Safeguarding', icon: <FileText className="w-4 h-4" /> },
    { id: 'admin-access', label: 'Admin Setup & Access', icon: <KeyRound className="w-4 h-4" /> },
    { id: 'logs', label: 'Audit Logs', icon: <Lock className="w-4 h-4" /> },
  ];

  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      <div className="bg-[#142B46] text-white px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#F5BD54]">
            Private Administration Console · v1.1 Operations
          </p>
          <h1 className="font-display text-lg font-bold">TutorBridge Ethiopia Operations</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSeedTutors}
            disabled={seeding}
            className="px-3.5 py-1.5 bg-[#39836B] text-white text-xs font-semibold rounded-lg"
          >
            {seeding ? 'Syncing...' : 'Sync Verified Seed Tutors'}
          </button>
          <button
            type="button"
            onClick={onExitAdmin}
            className="px-3.5 py-1.5 bg-white/10 text-white text-xs font-semibold rounded-lg hover:bg-white/20"
          >
            Exit to Public Site
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <aside className="lg:col-span-3">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                  tab === item.id
                    ? 'bg-[#142B46] text-white'
                    : 'text-slate-600 hover:bg-[#F5F7FA] hover:text-[#142B46]'
                }`}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="lg:col-span-9 space-y-6">
          {tab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-500">Registered Users / Students</p>
                  <p className="font-mono-tabular text-2xl font-bold text-[#142B46] mt-1">
                    {users.length} / {studentsCount}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-500">Verified Tutors / Pending Apps</p>
                  <p className="font-mono-tabular text-2xl font-bold text-[#142B46] mt-1">
                    {approvedTutors.length} / {pendingTutors.length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-500">Tutoring Commission (15%)</p>
                  <p className="font-mono-tabular text-2xl font-bold text-[#39836B] mt-1">
                    {totalCommissionEtb.toLocaleString()} ETB
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-500">Organizations / Corp Trainers</p>
                  <p className="font-mono-tabular text-2xl font-bold text-[#142B46] mt-1">
                    {organizations.length} / {corporateTrainers.length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-500">Corp Requests / Contracts</p>
                  <p className="font-mono-tabular text-2xl font-bold text-[#142B46] mt-1">
                    {corporateRequests.length} / {trainingContracts.length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-500">Corporate Service Revenue</p>
                  <p className="font-mono-tabular text-2xl font-bold text-[#39836B] mt-1">
                    {corpRevenueEtb.toLocaleString()} ETB
                  </p>
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <p className="text-slate-500">Tutoring Payment Volume</p>
                  <p className="font-mono-tabular font-bold text-base text-[#142B46]">
                    {totalVolumeEtb.toLocaleString()} ETB
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Corporate Paid Volume</p>
                  <p className="font-mono-tabular font-bold text-base text-[#142B46]">
                    {corpVolumeEtb.toLocaleString()} ETB
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Open Support Tickets</p>
                  <p className="font-mono-tabular font-bold text-base text-[#142B46]">
                    {supportTickets.filter((tk) => tk.status !== 'resolved').length}
                  </p>
                </div>
              </div>
            </div>
          )}

          {tab === 'verification' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="font-display text-lg font-bold text-[#142B46]">
                Tutor Applications & Credential Verification
              </h2>
              {tutors.map((t) => {
                const docs = tutorDocuments.filter((d) => d.tutorId === t.id);
                return (
                  <div key={t.id} className="border border-slate-200 rounded-xl p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-display font-bold text-[#142B46]">{t.fullName}</h3>
                        <p className="text-xs text-slate-600">
                          {t.headline} · {t.qualifications}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-[#39836B]">{t.status}</span>
                    </div>
                    {docs.length > 0 && (
                      <div className="bg-[#F5F7FA] rounded-lg p-3 space-y-1 text-xs">
                        <p className="font-semibold text-[#142B46]">Private Credentials:</p>
                        {docs.map((d) => (
                          <p key={d.id} className="text-slate-600 font-mono-tabular">
                            • {d.docType}: {d.title} (Ref: {d.referenceCode}) [{d.status}]
                          </p>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {t.status !== 'approved' && (
                        <button
                          type="button"
                          onClick={() => handleTutorStatus(t, 'approved')}
                          className="px-3.5 py-2 bg-[#39836B] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Verify
                        </button>
                      )}
                      {t.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => handleTutorStatus(t, 'rejected')}
                          className="px-3.5 py-2 border border-slate-300 text-slate-600 text-xs font-semibold rounded-lg"
                        >
                          Reject
                        </button>
                      )}
                      {t.status === 'approved' && (
                        <button
                          type="button"
                          onClick={() => handleTutorStatus(t, 'suspended')}
                          className="px-3.5 py-2 border border-red-300 text-red-600 text-xs font-semibold rounded-lg"
                        >
                          Suspend Account
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'matching' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="font-display text-lg font-bold text-[#142B46]">
                Managed Tutor Matching Queue
              </h2>
              {tutorRequests.length === 0 ? (
                <p className="text-sm text-slate-500">No managed matching requests yet.</p>
              ) : (
                tutorRequests.map((req) => (
                  <div key={req.id} className="border border-slate-200 rounded-xl p-5 space-y-3">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-[#142B46]">
                        Parent: {req.parentName} · Student: {req.studentName} ({req.gradeLevel})
                      </span>
                      <span className="font-semibold text-[#39836B]">{req.status}</span>
                    </div>
                    <p className="text-xs text-slate-600">
                      {req.subjects.join(', ')} · {req.subCity} · Budget: {req.budgetMaxEtb} ETB/hr
                      · {req.preferredSchedule}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                      <select
                        value={matchSelection[req.id] || ''}
                        onChange={(e) =>
                          setMatchSelection((prev) => ({ ...prev, [req.id]: e.target.value }))
                        }
                        className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                      >
                        <option value="">Select Approved Tutor</option>
                        {approvedTutors.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.fullName} ({t.hourlyRateEtb} ETB/hr)
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={matchNotes[req.id] || ''}
                        onChange={(e) =>
                          setMatchNotes((prev) => ({ ...prev, [req.id]: e.target.value }))
                        }
                        placeholder="Matching notes for parent"
                        className="px-3 py-2 border border-slate-300 rounded-lg text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleProposeMatch(req)}
                        className="px-4 py-2 bg-[#142B46] text-white text-xs font-semibold rounded-lg"
                      >
                        Propose Candidate
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'payments' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="font-display text-lg font-bold text-[#142B46]">
                Manual Tutoring Payment Verification
              </h2>
              {payments.length === 0 ? (
                <p className="text-sm text-slate-500">No payment submissions yet.</p>
              ) : (
                <div className="space-y-3">
                  {payments.map((p) => (
                    <div
                      key={p.id}
                      className="border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4"
                    >
                      <div className="text-xs space-y-1">
                        <p className="font-bold text-[#142B46]">
                          {p.method} · Ref:{' '}
                          <span className="font-mono-tabular">{p.transactionRef}</span>
                        </p>
                        <p className="text-slate-600 font-mono-tabular">
                          Amount: {p.amountEtb.toLocaleString()} ETB · Commission:{' '}
                          {p.commissionEtb.toLocaleString()} ETB · Tutor Payout:{' '}
                          {p.tutorPayoutEtb.toLocaleString()} ETB
                        </p>
                        <p className="font-semibold text-[#39836B]">Status: {p.status}</p>
                      </div>
                      {p.status === 'pending_verification' && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleVerifyPayment(p, 'verified')}
                            className="px-3.5 py-2 bg-[#39836B] text-white text-xs font-semibold rounded-lg"
                          >
                            Verify & Confirm Booking
                          </button>
                          <button
                            type="button"
                            onClick={() => handleVerifyPayment(p, 'rejected')}
                            className="px-3.5 py-2 border border-red-300 text-red-600 text-xs font-semibold rounded-lg"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'bookings' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="font-display text-lg font-bold text-[#142B46]">All Tutoring Bookings</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-3">Parent / Student</th>
                      <th className="py-2 pr-3">Tutor</th>
                      <th className="py-2 pr-3">Subject</th>
                      <th className="py-2 pr-3 text-right">Total (ETB)</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2">Payment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bookings.map((b) => (
                      <tr key={b.id}>
                        <td className="py-3 pr-3 font-semibold text-[#142B46]">
                          {b.parentName} / {b.studentName}
                        </td>
                        <td className="py-3 pr-3">{b.tutorName}</td>
                        <td className="py-3 pr-3">{b.subject}</td>
                        <td className="py-3 pr-3 text-right font-mono-tabular">
                          {b.totalAmountEtb.toLocaleString()}
                        </td>
                        <td className="py-3 pr-3">{b.status}</td>
                        <td className="py-3">{b.paymentStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'corp-orgs' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-[#142B46]">
                  Registered Corporate Organizations
                </h2>
                {organizations.length === 0 ? (
                  <p className="text-sm text-slate-500">No organizations registered yet.</p>
                ) : (
                  organizations.map((org) => (
                    <div
                      key={org.id}
                      className="border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4"
                    >
                      <div className="text-xs space-y-1">
                        <p className="font-bold text-sm text-[#142B46]">
                          {org.name} ({org.orgType})
                        </p>
                        <p className="text-slate-600">
                          {org.industry} · Contact: {org.contactPerson} · {org.officialEmail} ·{' '}
                          {org.phone}
                        </p>
                        <p className="text-slate-500">
                          Address: {org.address} · Status:{' '}
                          <span className="font-semibold text-[#39836B]">{org.status}</span>
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {org.status !== 'approved' && (
                          <button
                            type="button"
                            onClick={() => handleOrgStatus(org, 'approved')}
                            className="px-3.5 py-2 bg-[#39836B] text-white text-xs font-semibold rounded-lg"
                          >
                            Approve Organization
                          </button>
                        )}
                        {org.status !== 'suspended' && (
                          <button
                            type="button"
                            onClick={() => handleOrgStatus(org, 'suspended')}
                            className="px-3.5 py-2 border border-red-300 text-red-600 text-xs font-semibold rounded-lg"
                          >
                            Suspend
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h3 className="font-display font-bold text-[#142B46]">
                  Create Custom Corporate Training Category
                </h3>
                <form onSubmit={handleCreateCategory} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    placeholder="Category Name (e.g., NGO Grant Writing)"
                    className="px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                  <input
                    type="text"
                    required
                    value={catTopics}
                    onChange={(e) => setCatTopics(e.target.value)}
                    placeholder="Topics (comma-separated)"
                    className="px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#142B46] text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Category
                  </button>
                </form>

                {categories.length > 0 && (
                  <div className="divide-y divide-slate-100 text-xs pt-2">
                    {categories.map((cat) => (
                      <div key={cat.id} className="py-2.5 flex items-center justify-between gap-4">
                        <div>
                          <span className="font-bold text-[#142B46]">{cat.name}</span>{' '}
                          <span className="text-slate-500">({cat.topics.join(', ')})</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleToggleCategory(cat)}
                            className="text-[#39836B] font-semibold"
                          >
                            {cat.isActive ? 'Active (Disable)' : 'Inactive (Enable)'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="text-slate-400 hover:text-red-600"
                            aria-label="Delete category"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'corp-trainers' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold text-[#142B46]">
                      Corporate Trainer Directory, Comparison & Verification
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Review credentials, verify pending qualification updates, and compare up to 4
                      trainers internally (with confidential daily rates).
                    </p>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={adminTrainerSearch}
                      onChange={(e) => setAdminTrainerSearch(e.target.value)}
                      placeholder="Search trainers or skills..."
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </div>

                {adminComparedTrainers.length > 0 && (
                  <div className="border border-slate-200 bg-[#F5F7FA] rounded-xl p-4 space-y-3 overflow-x-auto">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-[#142B46] inline-flex items-center gap-1.5">
                        <GitCompare className="w-4 h-4 text-[#39836B]" /> Internal Admin Comparison (
                        {adminComparedTrainers.length}/4)
                      </p>
                      <button
                        type="button"
                        onClick={() => setAdminCompareIds([])}
                        className="text-xs text-slate-500 hover:text-[#142B46]"
                      >
                        Clear
                      </button>
                    </div>
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="py-2 pr-3">Trainer</th>
                          <th className="py-2 pr-3">Daily Rate (Confidential)</th>
                          <th className="py-2 pr-3">Experience</th>
                          <th className="py-2 pr-3">Categories</th>
                          <th className="py-2">Availability</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70">
                        {adminComparedTrainers.map((tr) => (
                          <tr key={tr.id}>
                            <td className="py-2 pr-3 font-bold text-[#142B46]">{tr.fullName}</td>
                            <td className="py-2 pr-3 font-mono-tabular font-semibold text-[#39836B]">
                              {tr.proposedDailyRateEtb.toLocaleString()} ETB/day
                            </td>
                            <td className="py-2 pr-3 font-mono-tabular">{tr.experienceYears} yrs</td>
                            <td className="py-2 pr-3">{tr.categories.join(', ')}</td>
                            <td className="py-2">{tr.availability}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {filteredAdminTrainers.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No corporate trainers match your filter. Click &ldquo;Sync Verified Seed
                    Tutors&rdquo; above to seed baseline verified trainers.
                  </p>
                ) : (
                  filteredAdminTrainers.map((tr) => {
                    const docs = tutorDocuments.filter(
                      (d) => d.tutorId === tr.id || d.userId === tr.userId
                    );
                    const inCompare = adminCompareIds.includes(tr.id);
                    return (
                      <div key={tr.id} className="border border-slate-200 rounded-xl p-5 space-y-3">
                        <div className="flex flex-wrap justify-between gap-2">
                          <div>
                            <h3 className="font-display font-bold text-[#142B46]">{tr.fullName}</h3>
                            <p className="text-xs text-slate-600">
                              {tr.headline} · {tr.qualifications}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Categories: {tr.categories.join(', ')} · Rate:{' '}
                              <span className="font-mono-tabular font-semibold">
                                {tr.proposedDailyRateEtb.toLocaleString()} ETB/day
                              </span>
                            </p>
                          </div>
                          <span className="text-xs font-semibold text-[#39836B]">{tr.status}</span>
                        </div>
                        <p className="text-xs text-slate-600">{tr.methodology}</p>

                        {tr.pendingQualificationUpdate && (
                          <div className="bg-[#F5BD54]/20 border border-[#F5BD54] rounded-lg p-3 space-y-2 text-xs">
                            <p className="font-bold text-[#142B46]">
                              Pending Qualification Update Request:
                            </p>
                            <p className="text-slate-700">{tr.pendingQualificationUpdate}</p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleApplyPendingQualification(tr, true)}
                                className="px-3 py-1.5 bg-[#39836B] text-white font-semibold rounded-lg"
                              >
                                Approve & Apply Qualification
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApplyPendingQualification(tr, false)}
                                className="px-3 py-1.5 border border-slate-300 text-slate-600 font-semibold rounded-lg"
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                        )}

                        {docs.length > 0 && (
                          <div className="bg-[#F5F7FA] rounded-lg p-3 space-y-1 text-xs">
                            <p className="font-semibold text-[#142B46]">Submitted Credentials:</p>
                            {docs.map((d) => (
                              <p key={d.id} className="text-slate-600 font-mono-tabular">
                                • {d.docType}: {d.title} (Ref: {d.referenceCode}) [{d.status}]
                              </p>
                            ))}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {tr.status !== 'approved' && (
                            <button
                              type="button"
                              onClick={() => handleCorporateTrainerStatus(tr, 'approved')}
                              className="px-3.5 py-2 bg-[#39836B] text-white text-xs font-semibold rounded-lg"
                            >
                              Approve & Verify Trainer
                            </button>
                          )}
                          {tr.status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => handleCorporateTrainerStatus(tr, 'rejected')}
                              className="px-3.5 py-2 border border-slate-300 text-slate-600 text-xs font-semibold rounded-lg"
                            >
                              Reject
                            </button>
                          )}
                          {tr.status === 'approved' && (
                            <button
                              type="button"
                              onClick={() => handleCorporateTrainerStatus(tr, 'suspended')}
                              className="px-3.5 py-2 border border-red-300 text-red-600 text-xs font-semibold rounded-lg"
                            >
                              Suspend
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleAdminCompare(tr.id)}
                            className={`px-3.5 py-2 text-xs font-semibold rounded-lg border ${
                              inCompare
                                ? 'bg-[#142B46] text-white border-[#142B46]'
                                : 'border-slate-300 text-[#142B46]'
                            }`}
                          >
                            {inCompare ? 'Remove from Compare' : 'Compare'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Portfolio Samples Moderation Queue */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h3 className="font-display font-bold text-[#142B46]">
                  Trainer Portfolio Samples Approval Queue ({trainerPortfolioItems.length})
                </h3>
                {trainerPortfolioItems.length === 0 ? (
                  <p className="text-xs text-slate-500">No portfolio samples submitted yet.</p>
                ) : (
                  trainerPortfolioItems.map((item) => {
                    const tr = corporateTrainers.find((t) => t.id === item.trainerId);
                    return (
                      <div
                        key={item.id}
                        className="border border-slate-200 rounded-xl p-4 space-y-2 text-xs"
                      >
                        <div className="flex flex-wrap justify-between gap-2">
                          <span className="font-bold text-[#142B46]">
                            {item.title} ({item.category}) — {tr?.fullName || item.trainerId}
                          </span>
                          <span className="font-semibold text-[#39836B]">{item.status}</span>
                        </div>
                        <p className="text-slate-600">{item.summary}</p>
                        {item.outcomeMetrics && (
                          <p className="text-slate-500">Outcomes: {item.outcomeMetrics}</p>
                        )}
                        <div className="flex flex-wrap gap-2 pt-1">
                          <input
                            type="text"
                            maxLength={400}
                            value={portfolioNotes[item.id] ?? item.adminNotes ?? ''}
                            onChange={(e) =>
                              setPortfolioNotes((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                            placeholder="Review notes (optional)"
                            className="flex-1 min-w-[200px] px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                          />
                          {item.status !== 'approved' && (
                            <button
                              type="button"
                              onClick={() => handleReviewPortfolioItem(item, 'approved')}
                              className="px-3 py-1.5 bg-[#39836B] text-white font-semibold rounded-lg"
                            >
                              Approve Sample
                            </button>
                          )}
                          {item.status !== 'rejected' && (
                            <button
                              type="button"
                              onClick={() => handleReviewPortfolioItem(item, 'rejected')}
                              className="px-3 py-1.5 border border-red-300 text-red-600 font-semibold rounded-lg"
                            >
                              Reject
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {tab === 'corp-requests' && (
            <div className="space-y-6">
              {/* Organization Trainer Selection Requests Queue */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-[#142B46]">
                  Organization Trainer Selection Requests ({trainerSelectionRequests.length})
                </h2>
                {trainerSelectionRequests.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No organization trainer selection requests submitted yet.
                  </p>
                ) : (
                  trainerSelectionRequests.map((sel) => {
                    const orgReqs = corporateRequests.filter(
                      (r) => r.organizationId === sel.organizationId
                    );
                    return (
                      <div
                        key={sel.id}
                        className="border border-slate-200 rounded-xl p-4 space-y-3 text-xs"
                      >
                        <div className="flex flex-wrap justify-between gap-2">
                          <div>
                            <span className="font-bold text-sm text-[#142B46]">
                              {sel.organizationName} — Primary: {sel.selectedTrainerName}
                            </span>
                            <p className="text-slate-600">
                              Ranked: {sel.rankedTrainerNames.join(' → ')}
                            </p>
                          </div>
                          <span className="font-semibold text-[#39836B]">{sel.status}</span>
                        </div>
                        {sel.notes && <p className="text-slate-600">Org notes: {sel.notes}</p>}

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <select
                            value={selLinkReqId[sel.id] ?? sel.corporateRequestId ?? ''}
                            onChange={(e) =>
                              setSelLinkReqId((prev) => ({ ...prev, [sel.id]: e.target.value }))
                            }
                            className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-xs"
                          >
                            <option value="">Link Training Request (for auto-proposal)</option>
                            {orgReqs.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.category} ({r.preferredDates})
                              </option>
                            ))}
                          </select>
                          <select
                            value={selAltTrainerId[sel.id] || ''}
                            onChange={(e) =>
                              setSelAltTrainerId((prev) => ({ ...prev, [sel.id]: e.target.value }))
                            }
                            className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-xs"
                          >
                            <option value="">Optional Alternative Trainer</option>
                            {approvedCorpTrainers.map((tr) => (
                              <option key={tr.id} value={tr.id}>
                                {tr.fullName}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            maxLength={600}
                            value={selAdminNotes[sel.id] ?? sel.adminNotes ?? ''}
                            onChange={(e) =>
                              setSelAdminNotes((prev) => ({ ...prev, [sel.id]: e.target.value }))
                            }
                            placeholder="Coordinator note to organization..."
                            className="px-3 py-2 border border-slate-300 rounded-lg text-xs"
                          />
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleSelectionAction(sel, 'in_coordination')}
                            className="px-3 py-1.5 bg-[#142B46] text-white font-semibold rounded-lg"
                          >
                            Mark In Coordination
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectionAction(sel, 'approved')}
                            className="px-3 py-1.5 bg-[#39836B] text-white font-semibold rounded-lg"
                          >
                            Approve Selection
                            {selLinkReqId[sel.id] || sel.corporateRequestId
                              ? ' & Draft Proposal'
                              : ''}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectionAction(sel, 'alternative_suggested')}
                            className="px-3 py-1.5 border border-slate-300 text-[#142B46] font-semibold rounded-lg"
                          >
                            Suggest Alternative
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectionAction(sel, 'rejected')}
                            className="px-3 py-1.5 border border-red-300 text-red-600 font-semibold rounded-lg"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Role-Isolated Negotiation Logger */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-[#142B46]">
                    Role-Isolated Commercial Negotiation Logger
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Organization quote negotiations and trainer compensation negotiations are stored
                    in strictly isolated records so neither side sees the other&rsquo;s terms.
                  </p>
                </div>
                <form onSubmit={handleLogNegotiation} className="space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <select
                      value={negTargetType}
                      onChange={(e) =>
                        setNegTargetType(
                          e.target.value as 'organization_quote' | 'trainer_compensation'
                        )
                      }
                      className="px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="organization_quote">Organization Quote Side</option>
                      <option value="trainer_compensation">Trainer Compensation Side</option>
                    </select>
                    {negTargetType === 'organization_quote' ? (
                      <select
                        required
                        value={negOrgOwnerUid}
                        onChange={(e) => setNegOrgOwnerUid(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="">Select Organization</option>
                        {organizations.map((o) => (
                          <option key={o.id} value={o.ownerUid}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        required
                        value={negTrainerUserId}
                        onChange={(e) => setNegTrainerUserId(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="">Select Trainer</option>
                        {corporateTrainers.map((t) => (
                          <option key={t.id} value={t.userId}>
                            {t.fullName}
                          </option>
                        ))}
                      </select>
                    )}
                    <select
                      value={negRequestId}
                      onChange={(e) => setNegRequestId(e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="">Optional: Link Request</option>
                      {corporateRequests.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.organizationName} — {r.category}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      required
                      value={negAmountEtb}
                      onChange={(e) => setNegAmountEtb(Number(e.target.value) || 0)}
                      placeholder="Proposed Amount (ETB)"
                      className="px-3 py-2 border border-slate-300 rounded-lg tabular-nums"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={600}
                      value={negTerms}
                      onChange={(e) => setNegTerms(e.target.value)}
                      placeholder="Commercial / Payment terms proposed..."
                      className="sm:col-span-2 px-3 py-2 border border-slate-300 rounded-lg"
                    />
                    <select
                      value={negStatus}
                      onChange={(e) => setNegStatus(e.target.value as 'open' | 'agreed')}
                      className="px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="open">Open Discussion</option>
                      <option value="agreed">Agreed</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={600}
                      value={negNotes}
                      onChange={(e) => setNegNotes(e.target.value)}
                      placeholder="Coordination notes (optional)"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#142B46] text-white font-semibold rounded-lg"
                    >
                      Log Negotiation Entry
                    </button>
                  </div>
                </form>

                {corporateNegotiations.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100 text-xs">
                    <div className="space-y-2">
                      <p className="font-bold text-[#142B46]">Organization Quote Logs</p>
                      {corporateNegotiations
                        .filter((n) => n.targetType === 'organization_quote')
                        .map((n) => (
                          <div key={n.id} className="p-3 bg-[#F5F7FA] rounded-lg space-y-0.5">
                            <p className="font-bold text-[#142B46]">
                              {n.participantLabel} · {n.proposedAmountEtb.toLocaleString()} ETB [
                              {n.status}]
                            </p>
                            <p className="text-slate-600">{n.proposedTerms}</p>
                          </div>
                        ))}
                    </div>
                    <div className="space-y-2">
                      <p className="font-bold text-[#142B46]">Trainer Compensation Logs</p>
                      {corporateNegotiations
                        .filter((n) => n.targetType === 'trainer_compensation')
                        .map((n) => (
                          <div key={n.id} className="p-3 bg-[#F5F7FA] rounded-lg space-y-0.5">
                            <p className="font-bold text-[#142B46]">
                              {n.participantLabel} · {n.proposedAmountEtb.toLocaleString()} ETB [
                              {n.status}]
                            </p>
                            <p className="text-slate-600">{n.proposedTerms}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Corporate Training Requests, Proposals & Itemized Quotations */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                <h2 className="font-display text-lg font-bold text-[#142B46]">
                  Corporate Training Requests, Proposals & Itemized Quotations
                </h2>
                {corporateRequests.length === 0 ? (
                  <p className="text-sm text-slate-500">No corporate training requests submitted yet.</p>
                ) : (
                  corporateRequests.map((req) => {
                    const reqProposals = trainingProposals.filter((p) => p.requestId === req.id);
                    const reqQuotes = trainingQuotations.filter((q) => q.requestId === req.id);
                    return (
                      <div key={req.id} className="border border-slate-200 rounded-xl p-5 space-y-4">
                        <div className="flex flex-wrap justify-between gap-2 text-xs">
                          <div>
                            <span className="font-bold text-sm text-[#142B46]">
                              {req.organizationName} — {req.category}
                            </span>
                            <p className="text-slate-600 mt-0.5">
                              {req.duration} · {req.participantCount} staff · {req.location} ·{' '}
                              {req.preferredDates}
                            </p>
                            <p className="text-slate-500 mt-0.5">
                              Budget:{' '}
                              <span className="font-mono-tabular">
                                {req.budgetMinEtb.toLocaleString()}–{req.budgetMaxEtb.toLocaleString()}{' '}
                                ETB
                              </span>{' '}
                              · Topics: {req.topics.join(', ')}
                            </p>
                          </div>
                          <span className="font-semibold text-[#39836B]">{req.status}</span>
                        </div>
                        <p className="text-xs text-slate-600 bg-[#F5F7FA] p-3 rounded-lg">
                          <strong>Objectives:</strong> {req.objectives}
                        </p>

                        {/* Step 1: Source & Propose Approved Trainer */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <select
                            value={corpTrainerChoice[req.id] || ''}
                            onChange={(e) =>
                              setCorpTrainerChoice((prev) => ({ ...prev, [req.id]: e.target.value }))
                            }
                            className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                          >
                            <option value="">Select Verified Corporate Trainer</option>
                            {approvedCorpTrainers.map((tr) => (
                              <option key={tr.id} value={tr.id}>
                                {tr.fullName} ({tr.proposedDailyRateEtb.toLocaleString()} ETB/day)
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={corpScheduleInput[req.id] || ''}
                            onChange={(e) =>
                              setCorpScheduleInput((prev) => ({ ...prev, [req.id]: e.target.value }))
                            }
                            placeholder={`Schedule (default: ${req.preferredDates})`}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleAssignCorporateTrainer(req)}
                            className="px-4 py-2 bg-[#142B46] text-white text-xs font-semibold rounded-lg"
                          >
                            Propose Trainer
                          </button>
                        </div>

                        {/* Step 2: Trainer Proposals & Enhanced Itemized Quotation Builder */}
                        {reqProposals.map((prop) => {
                          const hasQuote = reqQuotes.some((q) => q.proposalId === prop.id);
                          return (
                            <div
                              key={prop.id}
                              className="border border-slate-200 bg-[#F5F7FA] rounded-lg p-4 space-y-3 text-xs"
                            >
                              <div className="flex flex-wrap justify-between gap-2">
                                <span className="font-bold text-[#142B46]">
                                  Proposal: {prop.trainerName} ({prop.proposedSchedule})
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-[#39836B]">{prop.status}</span>
                                  {prop.status === 'proposed' && (
                                    <button
                                      type="button"
                                      onClick={() => handleAdminConfirmTrainerProposal(prop)}
                                      className="px-2.5 py-1 bg-white border border-slate-300 rounded text-[11px] font-semibold text-[#142B46]"
                                    >
                                      Mark Trainer Confirmed
                                    </button>
                                  )}
                                </div>
                              </div>

                              {!hasQuote && prop.status !== 'declined_by_trainer' && (
                                <div className="space-y-2 pt-1">
                                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                    <div>
                                      <label className="block text-[11px] text-slate-500 mb-0.5">
                                        Trainer Pay (Internal)
                                      </label>
                                      <input
                                        type="number"
                                        min={0}
                                        value={quoteComp[prop.id] ?? 20000}
                                        onChange={(e) =>
                                          setQuoteComp((prev) => ({
                                            ...prev,
                                            [prop.id]: Number(e.target.value) || 0,
                                          }))
                                        }
                                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs tabular-nums"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[11px] text-slate-500 mb-0.5">
                                        Coordination Fee
                                      </label>
                                      <input
                                        type="number"
                                        min={0}
                                        value={quoteCoord[prop.id] ?? 0}
                                        onChange={(e) =>
                                          setQuoteCoord((prev) => ({
                                            ...prev,
                                            [prop.id]: Number(e.target.value) || 0,
                                          }))
                                        }
                                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs tabular-nums"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[11px] text-slate-500 mb-0.5">
                                        Logistical Expenses
                                      </label>
                                      <input
                                        type="number"
                                        min={0}
                                        value={quoteLogistics[prop.id] ?? 3000}
                                        onChange={(e) =>
                                          setQuoteLogistics((prev) => ({
                                            ...prev,
                                            [prop.id]: Number(e.target.value) || 0,
                                          }))
                                        }
                                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs tabular-nums"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[11px] text-slate-500 mb-0.5">
                                        Platform Service Fee
                                      </label>
                                      <input
                                        type="number"
                                        min={0}
                                        value={quoteFee[prop.id] ?? 5000}
                                        onChange={(e) =>
                                          setQuoteFee((prev) => ({
                                            ...prev,
                                            [prop.id]: Number(e.target.value) || 0,
                                          }))
                                        }
                                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs tabular-nums"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[11px] text-slate-500 mb-0.5">
                                        Additional Charges
                                      </label>
                                      <input
                                        type="number"
                                        min={0}
                                        value={quoteExtra[prop.id] ?? 0}
                                        onChange={(e) =>
                                          setQuoteExtra((prev) => ({
                                            ...prev,
                                            [prop.id]: Number(e.target.value) || 0,
                                          }))
                                        }
                                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs tabular-nums"
                                      />
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                                    <input
                                      type="text"
                                      value={quotePayTerms[prop.id] ?? ''}
                                      onChange={(e) =>
                                        setQuotePayTerms((prev) => ({
                                          ...prev,
                                          [prop.id]: e.target.value,
                                        }))
                                      }
                                      placeholder="Payment Terms (e.g., 50% upfront / 50% completion)"
                                      className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                                    />
                                    <input
                                      type="text"
                                      value={quoteCancelTerms[prop.id] ?? ''}
                                      onChange={(e) =>
                                        setQuoteCancelTerms((prev) => ({
                                          ...prev,
                                          [prop.id]: e.target.value,
                                        }))
                                      }
                                      placeholder="Cancellation Terms"
                                      className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                                    />
                                    <input
                                      type="number"
                                      min={1}
                                      max={365}
                                      value={quoteValidity[prop.id] ?? 14}
                                      onChange={(e) =>
                                        setQuoteValidity((prev) => ({
                                          ...prev,
                                          [prop.id]: Number(e.target.value) || 14,
                                        }))
                                      }
                                      placeholder="Validity Days"
                                      className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs tabular-nums"
                                    />
                                    <input
                                      type="text"
                                      value={quoteNotes[prop.id] || ''}
                                      onChange={(e) =>
                                        setQuoteNotes((prev) => ({
                                          ...prev,
                                          [prop.id]: e.target.value,
                                        }))
                                      }
                                      placeholder="Commercial pricing notes"
                                      className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleCreateQuotation(req, prop)}
                                    className="px-4 py-2 bg-[#39836B] text-white font-semibold rounded-lg"
                                  >
                                    Send Itemized Quotation (
                                    {(
                                      (quoteComp[prop.id] ?? 20000) +
                                      (quoteCoord[prop.id] ?? 0) +
                                      (quoteLogistics[prop.id] ?? 3000) +
                                      (quoteFee[prop.id] ?? 5000) +
                                      (quoteExtra[prop.id] ?? 0)
                                    ).toLocaleString()}{' '}
                                    ETB)
                                  </button>
                                </div>
                              )}

                              {reqQuotes
                                .filter((q) => q.proposalId === prop.id)
                                .map((q) => (
                                  <p key={q.id} className="font-mono-tabular text-[#142B46]">
                                    Quotation Sent ({q.status}): Internal Trainer Pay{' '}
                                    {q.trainerCompensationEtb.toLocaleString()} + Coord{' '}
                                    {(q.coordinationFeeEtb || 0).toLocaleString()} + Logistics{' '}
                                    {q.logisticalExpensesEtb.toLocaleString()} + Fee{' '}
                                    {q.serviceFeeEtb.toLocaleString()} + Extra{' '}
                                    {(q.additionalChargesEtb || 0).toLocaleString()} = Total{' '}
                                    <strong>{q.totalAmountEtb.toLocaleString()} ETB</strong>
                                  </p>
                                ))}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {tab === 'corp-delivery' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-[#142B46]">
                  Corporate Contracts, Trainer Continuity & Schedule Coordination
                </h2>
                {trainingContracts.length === 0 ? (
                  <p className="text-sm text-slate-500">No active corporate contracts yet.</p>
                ) : (
                  <>
                    <div className="space-y-3">
                      {trainingContracts.map((c) => (
                        <div
                          key={c.id}
                          className="border border-slate-200 rounded-xl p-4 space-y-3 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                              <p className="font-bold text-sm text-[#142B46]">
                                {c.agreementNumber ? `[${c.agreementNumber}] ` : ''}
                                {c.organizationName} — {c.title}
                              </p>
                              <p className="text-slate-600">
                                Trainer: <strong>{c.trainerName}</strong> · Total:{' '}
                                <span className="font-mono-tabular">
                                  {c.totalAmountEtb.toLocaleString()} ETB
                                </span>{' '}
                                (Internal Trainer Comp:{' '}
                                <span className="font-mono-tabular">
                                  {c.trainerCompensationEtb.toLocaleString()} ETB
                                </span>
                                ) · Status:{' '}
                                <span className="font-semibold text-[#39836B]">{c.status}</span>
                              </p>
                              {c.orgAcceptedAt && (
                                <p className="text-[#39836B] font-semibold">
                                  Org Signed: {c.orgAcceptedByName} ({c.orgAcceptedRole})
                                </p>
                              )}
                            </div>
                            {c.status === 'active' && (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateContractStatus(c, 'completed')}
                                  className="px-3.5 py-2 bg-[#142B46] text-white font-semibold rounded-lg"
                                >
                                  Mark Completed
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateContractStatus(c, 'cancelled')}
                                  className="px-3.5 py-2 border border-red-300 text-red-600 font-semibold rounded-lg"
                                >
                                  Cancel Contract
                                </button>
                              </div>
                            )}
                          </div>

                          {c.status === 'active' && (
                            <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <select
                                value={replaceTrainerId[c.id] || ''}
                                onChange={(e) =>
                                  setReplaceTrainerId((prev) => ({
                                    ...prev,
                                    [c.id]: e.target.value,
                                  }))
                                }
                                className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                              >
                                <option value="">Replace Assigned Trainer (Continuity)</option>
                                {approvedCorpTrainers
                                  .filter((t) => t.id !== c.trainerId)
                                  .map((t) => (
                                    <option key={t.id} value={t.id}>
                                      {t.fullName}
                                    </option>
                                  ))}
                              </select>
                              <input
                                type="text"
                                maxLength={60}
                                value={replaceReason[c.id] || ''}
                                onChange={(e) =>
                                  setReplaceReason((prev) => ({
                                    ...prev,
                                    [c.id]: e.target.value,
                                  }))
                                }
                                placeholder="Reason (e.g., Schedule conflict)"
                                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => handleReplaceContractTrainer(c)}
                                className="px-3 py-1.5 border border-[#142B46] text-[#142B46] font-semibold rounded-lg inline-flex items-center justify-center gap-1"
                              >
                                <RefreshCw className="w-3.5 h-3.5" /> Apply Replacement
                              </button>
                            </div>
                          )}

                          {c.replacementHistory && c.replacementHistory.length > 0 && (
                            <div className="bg-[#F5F7FA] rounded-lg p-2.5 space-y-0.5 text-[11px] text-slate-600">
                              <p className="font-bold text-[#142B46]">Replacement History:</p>
                              {c.replacementHistory.map((h, i) => (
                                <p key={i}>• {h}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <form
                      onSubmit={handleCreateSchedule}
                      className="pt-4 border-t border-slate-200 space-y-3"
                    >
                      <h3 className="text-xs font-bold text-[#142B46]">
                        Add Training Session Schedule
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                        <select
                          required
                          value={schedContractId}
                          onChange={(e) => setSchedContractId(e.target.value)}
                          className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                        >
                          <option value="">Select Contract</option>
                          {trainingContracts.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.organizationName} — {c.title}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          required
                          maxLength={160}
                          value={schedTitle}
                          onChange={(e) => setSchedTitle(e.target.value)}
                          placeholder="Session Title"
                          className="px-3 py-2 border border-slate-300 rounded-lg text-xs"
                        />
                        <input
                          type="date"
                          required
                          value={schedDate}
                          onChange={(e) => setSchedDate(e.target.value)}
                          className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono-tabular"
                        />
                        <input
                          type="text"
                          required
                          maxLength={80}
                          value={schedTime}
                          onChange={(e) => setSchedTime(e.target.value)}
                          className="px-3 py-2 border border-slate-300 rounded-lg text-xs"
                        />
                        <div className="flex gap-2">
                          <input
                            type="text"
                            required
                            maxLength={200}
                            value={schedVenue}
                            onChange={(e) => setSchedVenue(e.target.value)}
                            placeholder="Venue"
                            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                          />
                          <button
                            type="submit"
                            className="px-3 py-2 bg-[#39836B] text-white text-xs font-semibold rounded-lg shrink-0"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </form>
                  </>
                )}
              </div>

              {/* Separate Dual Contract Manager: Trainer Assignment Agreements */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div>
                  <h3 className="font-display font-bold text-[#142B46]">
                    Separate Dual Contracts: Trainer Assignment Agreements (Trainer ↔ TutorBridge)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Issue separate assignment agreements strictly visible to the assigned trainer
                    and administrators — completely isolated from organization accounts.
                  </p>
                </div>

                {trainingContracts.length > 0 && (
                  <form onSubmit={handleIssueTrainerAssignment} className="space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <select
                        required
                        value={assignContractId}
                        onChange={(e) => setAssignContractId(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="">Select Corporate Service Contract</option>
                        {trainingContracts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.organizationName} — {c.trainerName} (
                            {c.trainerCompensationEtb.toLocaleString()} ETB)
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        required
                        maxLength={240}
                        value={assignSchedule}
                        onChange={(e) => setAssignSchedule(e.target.value)}
                        placeholder="Delivery Schedule Summary"
                        className="px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <textarea
                      rows={2}
                      required
                      minLength={4}
                      maxLength={1500}
                      value={assignScope}
                      onChange={(e) => setAssignScope(e.target.value)}
                      placeholder="Trainer Scope of Work, deliverables, attendance & completion reporting duties..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        required
                        maxLength={400}
                        value={assignPaySchedule}
                        onChange={(e) => setAssignPaySchedule(e.target.value)}
                        placeholder="Trainer Payment Schedule"
                        className="px-3 py-2 border border-slate-300 rounded-lg"
                      />
                      <input
                        type="text"
                        required
                        maxLength={600}
                        value={assignCancelTerms}
                        onChange={(e) => setAssignCancelTerms(e.target.value)}
                        placeholder="Cancellation & Replacement Terms"
                        className="px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#142B46] text-white font-semibold rounded-lg"
                    >
                      Issue Separate Trainer Assignment Agreement
                    </button>
                  </form>
                )}

                {trainerAssignmentAgreements.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                    {trainerAssignmentAgreements.map((ag) => (
                      <div
                        key={ag.id}
                        className="border border-slate-200 rounded-lg p-3 flex flex-wrap justify-between gap-2"
                      >
                        <div>
                          <p className="font-bold text-[#142B46]">
                            {ag.trainerName} — {ag.title}
                          </p>
                          <p className="text-slate-600">
                            Client: {ag.organizationLabel} · Compensation:{' '}
                            <span className="font-mono-tabular font-semibold">
                              {ag.trainerCompensationEtb.toLocaleString()} ETB
                            </span>
                          </p>
                          {ag.trainerAcceptedAt && (
                            <p className="text-[#39836B] font-semibold">
                              Accepted by {ag.trainerAcceptedName} ({ag.trainerAcceptedAt.slice(0, 10)})
                            </p>
                          )}
                        </div>
                        <span className="font-semibold text-[#39836B]">{ag.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2 text-xs">
                  <h3 className="font-display font-bold text-sm text-[#142B46]">
                    Scheduled Sessions ({trainingSchedules.length})
                  </h3>
                  {trainingSchedules.map((s) => (
                    <p key={s.id} className="text-slate-600 font-mono-tabular">
                      • {s.sessionDate} ({s.timeRange}) — {s.sessionTitle} @ {s.venue}
                    </p>
                  ))}
                  <h3 className="font-display font-bold text-sm text-[#142B46] pt-3">
                    Attendance Logs ({trainingAttendance.length})
                  </h3>
                  {trainingAttendance.map((a) => (
                    <p key={a.id} className="text-slate-600 font-mono-tabular">
                      • {a.sessionDate}: {a.presentCount}/{a.totalParticipants} present
                    </p>
                  ))}
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2 text-xs">
                  <h3 className="font-display font-bold text-sm text-[#142B46]">
                    Completion Reports ({trainingReports.length})
                  </h3>
                  {trainingReports.map((r) => (
                    <div key={r.id} className="p-3 bg-[#F5F7FA] rounded-lg space-y-1">
                      <p className="font-bold text-[#142B46]">
                        {r.organizationName} — {r.trainerName} ({r.attendanceRatePct}%)
                      </p>
                      <p className="text-slate-600">{r.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'corp-invoices' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex flex-wrap justify-between gap-4">
                  <div>
                    <h2 className="font-display text-lg font-bold text-[#142B46]">
                      Corporate Invoices & Service Fee Revenue
                    </h2>
                    <p className="text-xs text-slate-500">
                      Paid Volume: {corpVolumeEtb.toLocaleString()} ETB · Service Fee Revenue:{' '}
                      {corpRevenueEtb.toLocaleString()} ETB
                    </p>
                  </div>
                </div>
                {corporateInvoices.length === 0 ? (
                  <p className="text-sm text-slate-500">No corporate invoices generated yet.</p>
                ) : (
                  corporateInvoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs"
                    >
                      <div className="space-y-1">
                        <p className="font-mono-tabular font-bold text-[#142B46]">
                          {inv.invoiceNumber} · Amount: {inv.amountEtb.toLocaleString()} ETB
                        </p>
                        <p className="text-slate-600 font-mono-tabular">
                          Internal Trainer Pay: {inv.trainerCompensationEtb.toLocaleString()} ETB ·
                          Service Fee: {inv.serviceFeeEtb.toLocaleString()} ETB
                        </p>
                        {inv.transactionRef && (
                          <p className="text-slate-600 font-mono-tabular">
                            Payment: {inv.paymentMethod} · Ref: {inv.transactionRef}
                          </p>
                        )}
                        <p className="font-semibold text-[#39836B]">Status: {inv.status}</p>
                      </div>
                      {inv.status === 'payment_submitted' && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleVerifyCorporateInvoice(inv, 'paid')}
                            className="px-3.5 py-2 bg-[#39836B] text-white font-semibold rounded-lg"
                          >
                            Verify Payment & Mark Paid
                          </button>
                          <button
                            type="button"
                            onClick={() => handleVerifyCorporateInvoice(inv, 'refunded')}
                            className="px-3.5 py-2 border border-red-300 text-red-600 font-semibold rounded-lg"
                          >
                            Refund
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Trainer Compensation Payout Tracker */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h3 className="font-display font-bold text-[#142B46]">
                  Trainer Compensation Payout Tracker ({trainerCompensationRecords.length})
                </h3>
                {trainerAssignmentAgreements.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Issue a Trainer Assignment Agreement under Contracts & Delivery to schedule
                    trainer disbursements.
                  </p>
                ) : (
                  <form onSubmit={handleRecordTrainerPayout} className="space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <select
                        required
                        value={payoutAgreementId}
                        onChange={(e) => {
                          const ag = trainerAssignmentAgreements.find(
                            (a) => a.id === e.target.value
                          );
                          setPayoutAgreementId(e.target.value);
                          if (ag) setPayoutAmount(ag.trainerCompensationEtb);
                        }}
                        className="px-3 py-2 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="">Select Assignment Agreement</option>
                        {trainerAssignmentAgreements.map((ag) => (
                          <option key={ag.id} value={ag.id}>
                            {ag.trainerName} — {ag.trainerCompensationEtb.toLocaleString()} ETB
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={0}
                        required
                        value={payoutAmount}
                        onChange={(e) => setPayoutAmount(Number(e.target.value) || 0)}
                        placeholder="Payout Amount (ETB)"
                        className="px-3 py-2 border border-slate-300 rounded-lg tabular-nums"
                      />
                      <select
                        value={payoutMethod}
                        onChange={(e) =>
                          setPayoutMethod(
                            e.target.value as 'Telebirr' | 'CBE Birr' | 'Bank Transfer'
                          )
                        }
                        className="px-3 py-2 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Telebirr">Telebirr</option>
                        <option value="CBE Birr">CBE Birr</option>
                      </select>
                      <input
                        type="text"
                        required
                        minLength={2}
                        maxLength={120}
                        value={payoutRef}
                        onChange={(e) => setPayoutRef(e.target.value)}
                        placeholder="Voucher / Transfer Ref"
                        className="px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={500}
                        value={payoutNotes}
                        onChange={(e) => setPayoutNotes(e.target.value)}
                        placeholder="Payout milestone notes (optional)"
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 bg-[#142B46] text-white font-semibold rounded-lg"
                      >
                        Schedule Trainer Payout
                      </button>
                    </div>
                  </form>
                )}

                {trainerCompensationRecords.length > 0 && (
                  <div className="pt-2 space-y-2 text-xs">
                    {trainerCompensationRecords.map((rec) => (
                      <div
                        key={rec.id}
                        className="border border-slate-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div>
                          <p className="font-bold text-[#142B46]">
                            {rec.trainerName} ·{' '}
                            <span className="font-mono-tabular">
                              {rec.amountEtb.toLocaleString()} ETB
                            </span>{' '}
                            ({rec.paymentMethod} · {rec.transactionRef})
                          </p>
                          <p className="text-slate-500">
                            Status: <strong className="text-[#39836B]">{rec.status}</strong>
                            {rec.paidDate ? ` · Paid: ${rec.paidDate}` : ''}
                          </p>
                        </div>
                        {rec.status === 'scheduled' && (
                          <button
                            type="button"
                            onClick={() => handleMarkPayoutPaid(rec)}
                            className="px-3 py-1.5 bg-[#39836B] text-white font-semibold rounded-lg"
                          >
                            Mark Payout Paid
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Corporate Cancellation & Refund Settlements */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h3 className="font-display font-bold text-[#142B46]">
                  Corporate Cancellation & Refund Settlements ({corporateRefunds.length})
                </h3>
                {corporateRefunds.length === 0 ? (
                  <p className="text-xs text-slate-500">No corporate refund requests submitted.</p>
                ) : (
                  corporateRefunds.map((rf) => (
                    <div
                      key={rf.id}
                      className="border border-slate-200 rounded-xl p-4 space-y-2 text-xs"
                    >
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="font-bold text-[#142B46]">
                          {rf.organizationName} — Requested:{' '}
                          <span className="font-mono-tabular">
                            {rf.refundAmountEtb.toLocaleString()} ETB
                          </span>
                        </span>
                        <span className="font-semibold text-[#39836B]">{rf.status}</span>
                      </div>
                      <p className="text-slate-600">{rf.reason}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                        <input
                          type="number"
                          min={0}
                          value={refundFeeInput[rf.id] ?? rf.cancellationFeeEtb}
                          onChange={(e) =>
                            setRefundFeeInput((prev) => ({
                              ...prev,
                              [rf.id]: Number(e.target.value) || 0,
                            }))
                          }
                          placeholder="Cancellation Fee (ETB)"
                          className="px-3 py-1.5 border border-slate-300 rounded-lg tabular-nums"
                        />
                        <input
                          type="text"
                          maxLength={120}
                          value={refundRefInput[rf.id] ?? rf.processedRef ?? ''}
                          onChange={(e) =>
                            setRefundRefInput((prev) => ({ ...prev, [rf.id]: e.target.value }))
                          }
                          placeholder="Refund Transfer Ref"
                          className="px-3 py-1.5 border border-slate-300 rounded-lg"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleResolveRefund(rf, 'approved')}
                            className="px-3 py-1.5 bg-[#142B46] text-white font-semibold rounded-lg"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResolveRefund(rf, 'processed')}
                            className="px-3 py-1.5 bg-[#39836B] text-white font-semibold rounded-lg"
                          >
                            Processed
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResolveRefund(rf, 'rejected')}
                            className="px-3 py-1.5 border border-red-300 text-red-600 font-semibold rounded-lg"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === 'support' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="font-display text-lg font-bold text-[#142B46]">
                Support & Child Safeguarding Reports
              </h2>
              {supportTickets.length === 0 ? (
                <p className="text-sm text-slate-500">No support tickets reported.</p>
              ) : (
                supportTickets.map((tk) => (
                  <div key={tk.id} className="border border-slate-200 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-[#142B46]">
                        [{tk.category}] {tk.subject} — {tk.userName}
                      </span>
                      <span className="font-semibold text-[#39836B]">{tk.status}</span>
                    </div>
                    <p className="text-xs text-slate-600">{tk.message}</p>
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        value={ticketReply[tk.id] || tk.adminResponse || ''}
                        onChange={(e) =>
                          setTicketReply((prev) => ({ ...prev, [tk.id]: e.target.value }))
                        }
                        placeholder="Write response..."
                        className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleResolveTicket(tk, 'resolved')}
                        className="px-3.5 py-1.5 bg-[#39836B] text-white text-xs font-semibold rounded-lg"
                      >
                        Resolve
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'admin-access' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-lg font-bold text-[#142B46]">
                      Private Administrator Setup & Access Control
                    </h2>
                    <p className="text-xs text-slate-600 mt-1">
                      Manage authorized TutorBridge Ethiopia administrators stored in Firestore (
                      <span className="font-mono-tabular">/admins</span>). Public signup never grants
                      administrator permissions.
                    </p>
                  </div>
                  {!admins.some((a) => a.uid === currentUser.uid) && (
                    <button
                      type="button"
                      onClick={handleSyncSelfAdminRecord}
                      disabled={adminSetupBusy}
                      className="px-3.5 py-2 bg-[#39836B] text-white text-xs font-semibold rounded-lg whitespace-nowrap"
                    >
                      Sync My /admins Record
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="bg-[#F5F7FA] border border-slate-200 rounded-lg p-3.5 space-y-1">
                    <p className="text-slate-500">Administrator Login URL</p>
                    <p className="font-mono-tabular font-bold text-[#142B46]">/admin</p>
                  </div>
                  <div className="bg-[#F5F7FA] border border-slate-200 rounded-lg p-3.5 space-y-1">
                    <p className="text-slate-500">Primary Bootstrapped Admin</p>
                    <p className="font-mono-tabular font-bold text-[#142B46] break-all">
                      {BOOTSTRAPPED_ADMIN_EMAIL}
                    </p>
                  </div>
                  <div className="bg-[#F5F7FA] border border-slate-200 rounded-lg p-3.5 space-y-1">
                    <p className="text-slate-500">Active Session UID</p>
                    <p className="font-mono-tabular font-bold text-[#39836B] break-all">
                      {currentUser.uid}
                    </p>
                  </div>
                </div>

                {adminSetupNotice && (
                  <p className="text-xs font-medium text-[#39836B] bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                    {adminSetupNotice}
                  </p>
                )}
                {adminSetupError && (
                  <p className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {adminSetupError}
                  </p>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h3 className="font-display font-bold text-[#142B46] flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-[#39836B]" />
                  Authorize Additional Administrator Account
                </h3>
                <p className="text-xs text-slate-600">
                  Select a registered verified user or enter their Firebase Auth UID and verified
                  Google email address. Once authorized, they can sign in directly at{' '}
                  <span className="font-mono-tabular font-semibold">/admin</span>.
                </p>

                <form onSubmit={handleGrantAdminAccess} className="space-y-3 text-xs">
                  {users.length > 0 && (
                    <div>
                      <label className="block font-semibold text-[#142B46] mb-1">
                        Quick-fill from Registered Users (Optional)
                      </label>
                      <select
                        value=""
                        onChange={(e) => {
                          const selected = users.find((u) => u.uid === e.target.value);
                          if (selected) {
                            setNewAdminUid(selected.uid);
                            setNewAdminEmail(selected.email);
                          }
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="">Choose an existing user account...</option>
                        {users
                          .filter(
                            (u) =>
                              !admins.some((a) => a.uid === u.uid) &&
                              u.email.toLowerCase() !== BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()
                          )
                          .map((u) => (
                            <option key={u.uid} value={u.uid}>
                              {u.fullName} ({u.email}) — {u.role}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-[#142B46] mb-1">
                        Firebase User UID
                      </label>
                      <input
                        type="text"
                        required
                        value={newAdminUid}
                        onChange={(e) => setNewAdminUid(e.target.value)}
                        placeholder="e.g. XyZ123abc..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-tabular"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#142B46] mb-1">
                        Verified Google Email
                      </label>
                      <input
                        type="email"
                        required
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                        placeholder="admin@tutorbridge.et"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={adminSetupBusy}
                    className="px-4 py-2 bg-[#142B46] text-white font-semibold rounded-lg hover:bg-[#1e3d63] disabled:opacity-60"
                  >
                    {adminSetupBusy ? 'Saving...' : 'Grant Administrator Access'}
                  </button>
                </form>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                <h3 className="font-display font-bold text-[#142B46]">
                  Authorized Administrators ({admins.length})
                </h3>
                {admins.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Primary bootstrapped admin ({BOOTSTRAPPED_ADMIN_EMAIL}) is active. Click "Sync
                    My /admins Record" above to persist the registry entry.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 text-xs">
                    {admins.map((adm) => {
                      const isPrimary =
                        adm.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();
                      const isSelf = adm.uid === currentUser.uid;
                      return (
                        <div
                          key={adm.uid}
                          className="py-3 flex flex-wrap items-center justify-between gap-3"
                        >
                          <div>
                            <p className="font-bold text-[#142B46]">
                              {adm.email}{' '}
                              <span className="font-normal text-[#39836B]">
                                · {isPrimary ? 'Primary Bootstrapped Admin' : 'Delegated Admin'}
                                {isSelf ? ' · Current Session' : ''}
                              </span>
                            </p>
                            <p className="font-mono-tabular text-slate-500 mt-0.5">UID: {adm.uid}</p>
                          </div>
                          {!isPrimary && !isSelf && (
                            <button
                              type="button"
                              onClick={() => handleRevokeAdminAccess(adm)}
                              disabled={adminSetupBusy}
                              className="px-3 py-1.5 border border-red-300 text-red-600 font-semibold rounded-lg hover:bg-red-50"
                            >
                              Revoke Access
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'logs' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <h2 className="font-display text-lg font-bold text-[#142B46]">
                Immutable Administrative Audit Logs
              </h2>
              {adminLogs.length === 0 ? (
                <p className="text-sm text-slate-500">No administrative actions logged yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {adminLogs.map((log) => (
                    <div key={log.id} className="py-2.5 flex justify-between gap-4">
                      <div>
                        <span className="font-mono-tabular font-semibold text-[#142B46]">
                          {log.action}
                        </span>{' '}
                        <span className="text-slate-600">({log.targetCollection})</span>
                        {log.details && <p className="text-slate-500 mt-0.5">{log.details}</p>}
                      </div>
                      <span className="font-mono-tabular text-slate-400 shrink-0">
                        {log.targetId}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {tab === 'contact-protection' && currentUser && (
            <AdminContactProtectionPanel
              adminUser={currentUser}
              users={users}
              moderationFlags={moderationFlags}
              messageReports={messageReports}
              userViolations={userViolations}
              messagingRestrictions={messagingRestrictions}
              moderationActions={moderationActions}
              auditLogs={auditLogs}
              moderationSettings={moderationSettings}
              onInspectConversation={(convId) => {
                setInspectConvId(convId);
                setTab('messages');
              }}
            />
          )}

          {tab === 'messages' && currentUser && (
            <MessagingCenter
              currentUser={currentUser}
              roleContext="admin"
              conversations={conversations}
              messages={messages}
              restriction={null}
              violations={[]}
              allUsers={users}
              initialConversationId={inspectConvId}
            />
          )}
        </main>
      </div>
    </div>
  );
};
