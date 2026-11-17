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
  ArrowDown,
  ArrowUp,
  Award,
  Bookmark,
  BookmarkCheck,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  GitCompare,
  ListOrdered,
  LogOut,
  MapPin,
  MessageSquare,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { CORPORATE_TRAINING_CATEGORIES } from '../data/seedData';
import {
  ADDIS_SUB_CITIES,
  AppRoute,
  CORPORATE_DURATIONS,
  CategoryRecord,
  Conversation,
  CorporateDuration,
  CorporateFeedback,
  CorporateInvoice,
  CorporateNegotiation,
  CorporateRefundRecord,
  CorporateRequest,
  CorporateTrainer,
  Message,
  MessagingRestriction,
  ORGANIZATION_TYPES,
  Organization,
  OrganizationType,
  SavedTrainer,
  SupportTicket,
  TrainerPortfolioItem,
  TrainerSelectionRequest,
  TrainingAttendance,
  TrainingContract,
  TrainingParticipant,
  TrainingProposal,
  TrainingQuotation,
  TrainingReport,
  TrainingSchedule,
  UserAccount,
  UserViolation,
  clampText,
} from '../types';
import { MessagingCenter } from './MessagingCenter';

interface OrganizationDashboardProps {
  currentUser: UserAccount;
  organization: Organization | null;
  corporateTrainers: CorporateTrainer[];
  approvedPortfolioItems: TrainerPortfolioItem[];
  savedTrainers: SavedTrainer[];
  selectionRequests: TrainerSelectionRequest[];
  negotiations: CorporateNegotiation[];
  refunds: CorporateRefundRecord[];
  requests: CorporateRequest[];
  proposals: TrainingProposal[];
  quotations: TrainingQuotation[];
  contracts: TrainingContract[];
  schedules: TrainingSchedule[];
  participants: TrainingParticipant[];
  attendance: TrainingAttendance[];
  reports: TrainingReport[];
  invoices: CorporateInvoice[];
  feedbacks: CorporateFeedback[];
  supportTickets: SupportTicket[];
  customCategories: CategoryRecord[];
  conversations: Conversation[];
  messages: Message[];
  messagingRestriction: MessagingRestriction | null;
  userViolations: UserViolation[];
  onSignOut: () => void;
  onNavigate: (route: AppRoute) => void;
}

type OrgTab =
  | 'overview'
  | 'profile'
  | 'directory'
  | 'compare'
  | 'saved'
  | 'requests'
  | 'proposals'
  | 'contracts'
  | 'schedules'
  | 'messages'
  | 'invoices'
  | 'feedback';

const ETHIOPIAN_GOVERNING_LAW =
  'Governed by the Ethiopian Civil Code (Proclamation No. 165/1960) and the Commercial Code of Ethiopia under TutorBridge Ethiopia managed intermediation.';

const TrainerAvatar: React.FC<{ trainer: CorporateTrainer; sizeClass?: string }> = ({
  trainer,
  sizeClass = 'w-14 h-14',
}) => {
  const [imgError, setImgError] = useState(false);
  const initials = trainer.fullName
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (trainer.photoUrl && !imgError) {
    return (
      <img
        src={trainer.photoUrl}
        alt={trainer.fullName}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className={`${sizeClass} rounded-xl object-cover border border-slate-200 shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-xl bg-gradient-to-br from-[#142B46] to-[#39836B] text-white font-display font-bold flex items-center justify-center shrink-0`}
    >
      {initials || 'TB'}
    </div>
  );
};

export const OrganizationDashboard: React.FC<OrganizationDashboardProps> = ({
  currentUser,
  organization,
  corporateTrainers,
  approvedPortfolioItems,
  savedTrainers,
  selectionRequests,
  negotiations,
  refunds,
  requests,
  proposals,
  quotations,
  contracts,
  schedules,
  participants,
  attendance,
  reports,
  invoices,
  feedbacks,
  supportTickets,
  customCategories,
  conversations,
  messages,
  messagingRestriction,
  userViolations,
  onSignOut,
  onNavigate,
}) => {
  const [tab, setTab] = useState<OrgTab>(organization ? 'overview' : 'profile');
  const [feedbackNotice, setFeedbackNotice] = useState('');

  // Organization Profile State
  const [orgName, setOrgName] = useState(organization?.name || '');
  const [orgType, setOrgType] = useState<OrganizationType>(
    organization?.orgType || 'Private Company'
  );
  const [industry, setIndustry] = useState(organization?.industry || '');
  const [contactPerson, setContactPerson] = useState(
    organization?.contactPerson || currentUser.fullName
  );
  const [officialEmail, setOfficialEmail] = useState(
    organization?.officialEmail || currentUser.email
  );
  const [phone, setPhone] = useState(organization?.phone || currentUser.phone || '');
  const [address, setAddress] = useState(organization?.address || 'Addis Ababa, Ethiopia');
  const [billingInfo, setBillingInfo] = useState(organization?.billingInfo || '');
  const [profileSaved, setProfileSaved] = useState(false);

  // Corporate Trainer Directory Filters & Selection State
  const [dirSearch, setDirSearch] = useState('');
  const [dirCategory, setDirCategory] = useState('');
  const [dirQualKeyword, setDirQualKeyword] = useState('');
  const [dirMinExp, setDirMinExp] = useState<number>(0);
  const [dirLocation, setDirLocation] = useState('');
  const [dirAvailKeyword, setDirAvailKeyword] = useState('');
  const [inspectTrainer, setInspectTrainer] = useState<CorporateTrainer | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [shortlistIds, setShortlistIds] = useState<string[]>([]);
  const [savedNotesDraft, setSavedNotesDraft] = useState<Record<string, string>>({});

  // Trainer Selection Request Builder State
  const [selectionCorpReqId, setSelectionCorpReqId] = useState('');
  const [selectionNotes, setSelectionNotes] = useState('');

  // New Training Request State
  const allCategoryNames = useMemo(
    () => [
      ...CORPORATE_TRAINING_CATEGORIES.map((c) => c.name),
      ...customCategories.filter((c) => c.isActive).map((c) => c.name),
    ],
    [customCategories]
  );
  const [reqCategory, setReqCategory] = useState(allCategoryNames[0] || 'Digital Literacy');
  const [reqTopicsText, setReqTopicsText] = useState(
    'Excel and data management, Digital productivity'
  );
  const [reqObjectives, setReqObjectives] = useState('');
  const [reqParticipants, setReqParticipants] = useState<number>(20);
  const [reqDates, setReqDates] = useState('');
  const [reqDuration, setReqDuration] = useState<CorporateDuration>('Two to three days');
  const [reqLocation, setReqLocation] = useState('Organization premises — Bole, Addis Ababa');
  const [reqBudgetMin, setReqBudgetMin] = useState<number>(25000);
  const [reqBudgetMax, setReqBudgetMax] = useState<number>(50000);
  const [reqSuccess, setReqSuccess] = useState('');

  // Quotation / Contract Electronic Signature State
  const [quoteSignerName, setQuoteSignerName] = useState<Record<string, string>>({});
  const [quoteSignerRole, setQuoteSignerRole] = useState<Record<string, string>>({});
  const [contractSignerName, setContractSignerName] = useState<Record<string, string>>({});
  const [contractSignerRole, setContractSignerRole] = useState<Record<string, string>>({});

  // Participant Registration State
  const [partContractId, setPartContractId] = useState('');
  const [partName, setPartName] = useState('');
  const [partDept, setPartDept] = useState('');
  const [partEmail, setPartEmail] = useState('');

  // Invoice Payment & Refund Request State
  const [payMethod, setPayMethod] = useState<
    Record<string, 'Telebirr' | 'CBE Birr' | 'Bank Transfer'>
  >({});
  const [payRef, setPayRef] = useState<Record<string, string>>({});
  const [refContractId, setRefContractId] = useState('');
  const [refInvoiceId, setRefInvoiceId] = useState('');
  const [refAmountEtb, setRefAmountEtb] = useState<number>(0);
  const [refReason, setRefReason] = useState('');

  // Feedback & Support State
  const [fbContractId, setFbContractId] = useState('');
  const [fbRating, setFbRating] = useState<number>(5);
  const [fbComment, setFbComment] = useState('');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMsg, setTicketMsg] = useState('');

  const [actionBusy, setActionBusy] = useState(false);

  const notify = (msg: string) => {
    setFeedbackNotice(msg);
    setTimeout(() => setFeedbackNotice(''), 4000);
  };

  const filteredTrainers = useMemo(() => {
    const q = dirSearch.trim().toLowerCase();
    const qualQ = dirQualKeyword.trim().toLowerCase();
    const availQ = dirAvailKeyword.trim().toLowerCase();
    return corporateTrainers.filter((tr) => {
      if (dirCategory && !tr.categories.includes(dirCategory)) return false;
      if (dirMinExp > 0 && tr.experienceYears < dirMinExp) return false;
      if (dirLocation && !tr.preferredLocations.includes(dirLocation)) return false;
      if (qualQ) {
        const qualHay = [
          tr.qualifications,
          ...(tr.certifications || []),
        ]
          .join(' ')
          .toLowerCase();
        if (!qualHay.includes(qualQ)) return false;
      }
      if (availQ && !tr.availability.toLowerCase().includes(availQ)) return false;
      if (q) {
        const hay = [
          tr.fullName,
          tr.headline,
          tr.bio || '',
          tr.qualifications,
          tr.workExperience || '',
          tr.methodology,
          ...(tr.certifications || []),
          ...tr.categories,
          ...tr.topics,
          ...(tr.pastProjects || []),
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    corporateTrainers,
    dirSearch,
    dirCategory,
    dirQualKeyword,
    dirMinExp,
    dirLocation,
    dirAvailKeyword,
  ]);

  const compareTrainers = useMemo(
    () =>
      compareIds
        .map((id) => corporateTrainers.find((t) => t.id === id))
        .filter((t): t is CorporateTrainer => Boolean(t)),
    [compareIds, corporateTrainers]
  );

  const shortlistTrainers = useMemo(
    () =>
      shortlistIds
        .map((id) => corporateTrainers.find((t) => t.id === id))
        .filter((t): t is CorporateTrainer => Boolean(t)),
    [shortlistIds, corporateTrainers]
  );

  const handleToggleCompare = (trainerId: string) => {
    setCompareIds((prev) => {
      if (prev.includes(trainerId)) return prev.filter((id) => id !== trainerId);
      if (prev.length >= 4) {
        notify('You can compare up to 4 corporate trainers side-by-side.');
        return prev;
      }
      return [...prev, trainerId];
    });
  };

  const handleToggleShortlist = (trainerId: string) => {
    setShortlistIds((prev) =>
      prev.includes(trainerId) ? prev.filter((id) => id !== trainerId) : [...prev, trainerId]
    );
  };

  const handleMoveShortlist = (index: number, direction: -1 | 1) => {
    const nextIdx = index + direction;
    if (nextIdx < 0 || nextIdx >= shortlistIds.length) return;
    setShortlistIds((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIdx, 0, item);
      return copy;
    });
  };

  const handleToggleSaveTrainer = async (trainer: CorporateTrainer) => {
    if (!organization) {
      setTab('profile');
      notify('Complete your Organization Profile before saving preferred trainers.');
      return;
    }
    const existing = savedTrainers.find((s) => s.trainerId === trainer.id);
    try {
      if (existing) {
        await deleteDoc(doc(db, 'saved_trainers', existing.id));
      } else {
        const savedId = `saved_${organization.id}_${trainer.id}`;
        await setDoc(doc(db, 'saved_trainers', savedId), {
          organizationId: organization.id,
          organizationOwnerUid: currentUser.uid,
          trainerId: trainer.id,
          notes: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'saved_trainers');
    }
  };

  const handleUpdateSavedNote = async (saved: SavedTrainer) => {
    const noteText = clampText(savedNotesDraft[saved.id] ?? saved.notes ?? '', 500);
    try {
      await updateDoc(doc(db, 'saved_trainers', saved.id), {
        notes: noteText,
        updatedAt: serverTimestamp(),
      });
      notify('Saved trainer note updated.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `saved_trainers/${saved.id}`);
    }
  };

  const handleSubmitSelectionRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) {
      setTab('profile');
      return;
    }
    if (shortlistTrainers.length === 0) return;
    const primary = shortlistTrainers[0];
    setActionBusy(true);
    try {
      await addDoc(collection(db, 'trainer_selection_requests'), {
        organizationId: organization.id,
        organizationOwnerUid: currentUser.uid,
        organizationName: organization.name,
        ...(selectionCorpReqId ? { corporateRequestId: selectionCorpReqId } : {}),
        selectedTrainerId: primary.id,
        selectedTrainerUserId: primary.userId,
        selectedTrainerName: primary.fullName,
        rankedTrainerIds: shortlistTrainers.map((t) => t.id).slice(0, 10),
        rankedTrainerNames: shortlistTrainers.map((t) => clampText(t.fullName, 120)).slice(0, 10),
        notes: clampText(selectionNotes, 1000),
        status: 'pending_tutorbridge_review',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setShortlistIds([]);
      setSelectionNotes('');
      setSelectionCorpReqId('');
      notify(
        'Trainer selection request submitted to TutorBridge. Our team will verify availability and coordinate your proposal.'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'trainer_selection_requests');
    } finally {
      setActionBusy(false);
    }
  };

  const handleSaveOrgProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionBusy(true);
    try {
      const orgId = organization?.id || `org_${currentUser.uid}`;
      if (!organization) {
        await setDoc(doc(db, 'organizations', orgId), {
          ownerUid: currentUser.uid,
          name: clampText(orgName, 160),
          orgType,
          industry: clampText(industry, 120),
          contactPerson: clampText(contactPerson, 120),
          officialEmail: clampText(officialEmail, 200),
          phone: clampText(phone, 40),
          address: clampText(address, 240),
          logoUrl: '',
          billingInfo: clampText(billingInfo, 400),
          status: 'pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await setDoc(doc(db, 'organization_users', `ou_${currentUser.uid}`), {
          organizationId: orgId,
          userId: currentUser.uid,
          role: 'owner',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, 'organizations', orgId), {
          name: clampText(orgName, 160),
          orgType,
          industry: clampText(industry, 120),
          contactPerson: clampText(contactPerson, 120),
          officialEmail: clampText(officialEmail, 200),
          phone: clampText(phone, 40),
          address: clampText(address, 240),
          logoUrl: organization.logoUrl || '',
          billingInfo: clampText(billingInfo, 400),
          updatedAt: serverTimestamp(),
        });
      }
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'organizations');
    } finally {
      setActionBusy(false);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;
    const topics = reqTopicsText
      .split(',')
      .map((s) => clampText(s, 100))
      .filter(Boolean)
      .slice(0, 20);
    if (topics.length === 0) return;

    setActionBusy(true);
    try {
      await addDoc(collection(db, 'corporate_requests'), {
        organizationId: organization.id,
        ownerUid: currentUser.uid,
        organizationName: organization.name,
        category: clampText(reqCategory, 120),
        topics,
        objectives: clampText(reqObjectives, 1500),
        participantCount: reqParticipants,
        preferredDates: clampText(reqDates, 160),
        duration: reqDuration,
        location: clampText(reqLocation, 200),
        budgetMinEtb: reqBudgetMin,
        budgetMaxEtb: Math.max(reqBudgetMin, reqBudgetMax),
        status: 'pending_review',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setReqObjectives('');
      setReqDates('');
      setReqSuccess('Training request submitted. TutorBridge is reviewing trainer availability.');
      setTimeout(() => setReqSuccess(''), 4000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'corporate_requests');
    } finally {
      setActionBusy(false);
    }
  };

  const handleApproveProposalAndQuotation = async (
    quotation: TrainingQuotation,
    proposal: TrainingProposal | undefined,
    req: CorporateRequest | undefined
  ) => {
    if (!organization || !proposal) return;
    const signerName = clampText(
      quoteSignerName[quotation.id] || organization.contactPerson || currentUser.fullName,
      120
    );
    const signerRole = clampText(
      quoteSignerRole[quotation.id] || 'Authorized Organization Representative',
      120
    );
    setActionBusy(true);
    try {
      await updateDoc(doc(db, 'training_quotations', quotation.id), {
        status: 'approved',
        updatedAt: serverTimestamp(),
      });

      if (proposal.status === 'accepted_by_trainer') {
        await updateDoc(doc(db, 'training_proposals', proposal.id), {
          status: 'approved_by_org',
          updatedAt: serverTimestamp(),
        });
      }

      if (req && req.status === 'proposal_sent') {
        await updateDoc(doc(db, 'corporate_requests', req.id), {
          status: 'approved',
          updatedAt: serverTimestamp(),
        });
      }

      const contractRef = doc(collection(db, 'training_contracts'));
      const agreementNum = `TB-CORP-${Date.now().toString().slice(-6)}`;
      await setDoc(contractRef, {
        requestId: quotation.requestId,
        quotationId: quotation.id,
        organizationId: organization.id,
        organizationOwnerUid: currentUser.uid,
        organizationName: organization.name,
        trainerId: proposal.trainerId,
        trainerUserId: proposal.trainerUserId,
        trainerName: proposal.trainerName,
        title: clampText(
          req ? `${req.category} — ${req.duration}` : 'Corporate Training Program',
          200
        ),
        agreementNumber: agreementNum,
        totalAmountEtb: quotation.totalAmountEtb,
        trainerCompensationEtb: quotation.trainerCompensationEtb,
        serviceFeeEtb: quotation.serviceFeeEtb,
        paymentTerms: clampText(
          quotation.paymentTerms ||
            '50% mobilization upon contract execution, 50% upon training completion via Telebirr / CBE Birr / Bank Transfer',
          200
        ),
        serviceTermsSummary: clampText(
          `TutorBridge Ethiopia delivers managed facilitator coordination, curriculum alignment, attendance tracking, and completion reporting for ${organization.name}.`,
          1500
        ),
        cancellationTerms: clampText(
          quotation.cancellationTerms ||
            'Written notice 7+ days prior allows full rescheduling or refund less 10% administrative fee; under 7 days incurs 25% coordination retention.',
          600
        ),
        governingLawClause: ETHIOPIAN_GOVERNING_LAW,
        orgAcceptedAt: new Date().toISOString(),
        orgAcceptedByName: signerName,
        orgAcceptedRole: signerRole,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, 'corporate_invoices'), {
        contractId: contractRef.id,
        organizationId: organization.id,
        organizationOwnerUid: currentUser.uid,
        invoiceNumber: `INV-CORP-${Date.now().toString().slice(-6)}`,
        amountEtb: quotation.totalAmountEtb,
        trainerCompensationEtb: quotation.trainerCompensationEtb,
        serviceFeeEtb: quotation.serviceFeeEtb,
        status: 'unpaid',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setTab('contracts');
      notify('Service Agreement electronically executed and invoice generated.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'training_contracts');
    } finally {
      setActionBusy(false);
    }
  };

  const handleSignExistingContract = async (contract: TrainingContract) => {
    const signerName = clampText(
      contractSignerName[contract.id] || organization?.contactPerson || currentUser.fullName,
      120
    );
    const signerRole = clampText(
      contractSignerRole[contract.id] || 'Authorized Organization Representative',
      120
    );
    if (signerName.length < 2) return;
    try {
      await updateDoc(doc(db, 'training_contracts', contract.id), {
        orgAcceptedAt: new Date().toISOString(),
        orgAcceptedByName: signerName,
        orgAcceptedRole: signerRole,
        updatedAt: serverTimestamp(),
      });
      notify(`Agreement ${contract.agreementNumber || contract.id} electronically signed.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `training_contracts/${contract.id}`);
    }
  };

  const handleDeclineProposal = async (
    quotation: TrainingQuotation,
    proposal: TrainingProposal | undefined,
    req: CorporateRequest | undefined
  ) => {
    setActionBusy(true);
    try {
      await updateDoc(doc(db, 'training_quotations', quotation.id), {
        status: 'rejected',
        updatedAt: serverTimestamp(),
      });
      if (proposal && proposal.status === 'accepted_by_trainer') {
        await updateDoc(doc(db, 'training_proposals', proposal.id), {
          status: 'rejected_by_org',
          updatedAt: serverTimestamp(),
        });
      }
      if (req && req.status === 'proposal_sent') {
        await updateDoc(doc(db, 'corporate_requests', req.id), {
          status: 'rejected',
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'training_quotations');
    } finally {
      setActionBusy(false);
    }
  };

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !partContractId || !partName.trim()) return;
    try {
      await addDoc(collection(db, 'training_participants'), {
        contractId: partContractId,
        organizationId: organization.id,
        organizationOwnerUid: currentUser.uid,
        fullName: clampText(partName, 120),
        department: clampText(partDept, 120),
        email: clampText(partEmail, 200),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setPartName('');
      setPartDept('');
      setPartEmail('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'training_participants');
    }
  };

  const handleDeleteParticipant = async (participantId: string) => {
    try {
      await deleteDoc(doc(db, 'training_participants', participantId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `training_participants/${participantId}`);
    }
  };

  const handleSubmitInvoicePayment = async (inv: CorporateInvoice) => {
    const ref = clampText(payRef[inv.id] || '', 120);
    if (ref.length < 3) return;
    const method = payMethod[inv.id] || 'Bank Transfer';
    try {
      await updateDoc(doc(db, 'corporate_invoices', inv.id), {
        paymentMethod: method,
        transactionRef: ref,
        status: 'payment_submitted',
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `corporate_invoices/${inv.id}`);
    }
  };

  const handleSubmitRefundRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !refContractId || refReason.trim().length < 4) return;
    try {
      await addDoc(collection(db, 'corporate_refunds'), {
        contractId: refContractId,
        ...(refInvoiceId ? { invoiceId: refInvoiceId } : {}),
        organizationId: organization.id,
        organizationOwnerUid: currentUser.uid,
        organizationName: organization.name,
        refundAmountEtb: Math.max(0, refAmountEtb),
        cancellationFeeEtb: 0,
        reason: clampText(refReason, 1000),
        status: 'requested',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setRefContractId('');
      setRefInvoiceId('');
      setRefAmountEtb(0);
      setRefReason('');
      notify('Cancellation / refund request submitted for TutorBridge settlement review.');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'corporate_refunds');
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !fbContractId || !fbComment.trim()) return;
    const contract = contracts.find((c) => c.id === fbContractId);
    if (!contract) return;
    try {
      await addDoc(collection(db, 'corporate_feedback'), {
        contractId: contract.id,
        organizationId: organization.id,
        organizationOwnerUid: currentUser.uid,
        trainerId: contract.trainerId,
        rating: fbRating,
        comment: clampText(fbComment, 1000),
        createdAt: serverTimestamp(),
      });
      setFbComment('');
      setFbContractId('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'corporate_feedback');
    }
  };

  const handleSubmitSupport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketMsg.trim()) return;
    try {
      await addDoc(collection(db, 'support_tickets'), {
        userId: currentUser.uid,
        userName: organization?.name || currentUser.fullName,
        category: 'corporate',
        subject: clampText(ticketSubject, 160),
        message: clampText(ticketMsg, 1500),
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setTicketSubject('');
      setTicketMsg('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'support_tickets');
    }
  };

  const unreadCount = conversations.filter(
    (c) => c.conversationType !== 'organization_trainer' && c.unreadByUids?.includes(currentUser.uid)
  ).length;

  const navItems: { id: OrgTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Building2 className="w-4 h-4" /> },
    { id: 'profile', label: 'Organization Profile', icon: <FileCheck2 className="w-4 h-4" /> },
    { id: 'directory', label: 'Browse Trainers', icon: <Search className="w-4 h-4" /> },
    {
      id: 'compare',
      label: compareIds.length > 0 ? `Compare (${compareIds.length}/4)` : 'Compare Trainers',
      icon: <GitCompare className="w-4 h-4" />,
    },
    {
      id: 'saved',
      label: savedTrainers.length > 0 ? `Saved (${savedTrainers.length})` : 'Saved Trainers',
      icon: <Bookmark className="w-4 h-4" />,
    },
    {
      id: 'requests',
      label:
        shortlistIds.length > 0
          ? `Requests & Shortlist (${shortlistIds.length})`
          : 'Requests & Selections',
      icon: <ClipboardList className="w-4 h-4" />,
    },
    { id: 'proposals', label: 'Proposals & Quotations', icon: <FileSpreadsheet className="w-4 h-4" /> },
    { id: 'contracts', label: 'Contracts & Participants', icon: <Users className="w-4 h-4" /> },
    { id: 'schedules', label: 'Schedules & Reports', icon: <Calendar className="w-4 h-4" /> },
    {
      id: 'messages',
      label: unreadCount > 0 ? `Support Desk (${unreadCount})` : 'TutorBridge Support',
      icon: <MessageSquare className="w-4 h-4" />,
    },
    { id: 'invoices', label: 'Invoices & Refunds', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'feedback', label: 'Evaluations & Tickets', icon: <MessageSquare className="w-4 h-4" /> },
  ];

  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <aside className="lg:col-span-3 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs font-semibold text-[#39836B]">Corporate Training Portal</p>
            <h2 className="font-display text-lg font-bold text-[#142B46] mt-0.5 truncate">
              {organization?.name || currentUser.fullName}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Status:{' '}
              <span className="font-semibold text-[#142B46]">
                {organization ? organization.status : 'Profile Required'}
              </span>
            </p>

            <nav className="mt-5 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    tab === item.id
                      ? 'bg-[#142B46] text-white'
                      : 'text-slate-600 hover:bg-[#F5F7FA] hover:text-[#142B46]'
                  }`}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </nav>

            <div className="mt-5 pt-4 border-t border-slate-200 space-y-2">
              <button
                type="button"
                onClick={() => onNavigate('corporate')}
                className="w-full py-2 text-xs font-semibold bg-[#F5F7FA] text-[#142B46] rounded-lg hover:bg-slate-200 whitespace-nowrap"
              >
                Explore Training Categories
              </button>
              <button
                type="button"
                onClick={onSignOut}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-slate-600 hover:text-red-600 whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        </aside>

        <main className="lg:col-span-9 space-y-6">
          {!organization && (
            <div className="bg-[#F5BD54]/20 border border-[#F5BD54] rounded-xl p-4 text-sm text-[#142B46]">
              <strong>Complete your Organization Profile first</strong> before saving trainers,
              submitting trainer selection requests, or requesting custom training programs.
            </div>
          )}

          {organization && organization.status === 'pending' && (
            <div className="bg-[#F5BD54]/20 border border-[#F5BD54] rounded-xl p-4 text-xs sm:text-sm text-[#142B46]">
              <strong>Organization Verification Pending:</strong> You can browse trainers and submit
              selection or training requests now while TutorBridge confirms your institutional details.
            </div>
          )}

          {feedbackNotice && (
            <div className="bg-[#39836B]/10 border border-[#39836B]/30 rounded-xl px-4 py-3 text-xs font-semibold text-[#142B46]">
              {feedbackNotice}
            </div>
          )}

          {tab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-500">Verified Trainers</p>
                  <p className="font-mono-tabular text-2xl font-bold text-[#142B46] mt-1">
                    {corporateTrainers.length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-500">Trainer Selections</p>
                  <p className="font-mono-tabular text-2xl font-bold text-[#142B46] mt-1">
                    {selectionRequests.length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-500">Active Contracts</p>
                  <p className="font-mono-tabular text-2xl font-bold text-[#39836B] mt-1">
                    {contracts.filter((c) => c.status === 'active').length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-500">Pending Quotations</p>
                  <p className="font-mono-tabular text-2xl font-bold text-[#142B46] mt-1">
                    {quotations.filter((q) => q.status === 'sent').length}
                  </p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
                <div className="max-w-xl">
                  <h3 className="font-display font-bold text-[#142B46]">
                    Browse Qualified Trainers or Request a Custom Program
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Evaluate verified trainer credentials, compare up to 4 specialists side-by-side,
                    and submit your ranked selection. TutorBridge exclusively manages availability,
                    quotations, contracting, and delivery coordination.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setTab('directory')}
                    className="px-4 py-2.5 bg-[#39836B] text-white text-xs font-semibold rounded-lg whitespace-nowrap"
                  >
                    Browse Trainer Directory
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab(organization ? 'requests' : 'profile')}
                    className="px-4 py-2.5 bg-[#142B46] text-white text-xs font-semibold rounded-lg whitespace-nowrap"
                  >
                    {organization ? 'Submit Training Request' : 'Setup Organization Profile'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'directory' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold text-[#142B46]">
                      Verified Corporate Trainer Directory
                    </h2>
                    <p className="text-xs text-slate-600 mt-1">
                      Review administrator-verified qualifications, certifications, past projects,
                      and portfolios. To preserve managed marketplace integrity, all coordination,
                      pricing, and contracting go exclusively through TutorBridge Ethiopia.
                    </p>
                  </div>
                  {shortlistIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setTab('requests')}
                      className="px-3.5 py-2 bg-[#39836B] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <ListOrdered className="w-3.5 h-3.5" />
                      Review Ranked Shortlist ({shortlistIds.length})
                    </button>
                  )}
                </div>

                {/* Search & Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="relative sm:col-span-2">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={dirSearch}
                      onChange={(e) => setDirSearch(e.target.value)}
                      placeholder="Search by subject, skill, name, or past project..."
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <select
                    value={dirCategory}
                    onChange={(e) => setDirCategory(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    <option value="">All Training Categories</option>
                    {allCategoryNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={dirQualKeyword}
                    onChange={(e) => setDirQualKeyword(e.target.value)}
                    placeholder="Filter by qualification / certification (e.g., PMP, AWS, M.Sc.)"
                    className="px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                  <select
                    value={dirMinExp}
                    onChange={(e) => setDirMinExp(Number(e.target.value))}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    <option value={0}>Any Experience Level</option>
                    <option value={3}>3+ Years Verified</option>
                    <option value={5}>5+ Years Verified</option>
                    <option value={8}>8+ Years Senior</option>
                  </select>
                  <select
                    value={dirLocation}
                    onChange={(e) => setDirLocation(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    <option value="">All Addis Ababa Locations</option>
                    {ADDIS_SUB_CITIES.map((sc) => (
                      <option key={sc} value={sc}>
                        {sc}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    value={dirAvailKeyword}
                    onChange={(e) => setDirAvailKeyword(e.target.value)}
                    placeholder="Filter by availability (e.g., Weekdays, Saturday)..."
                    className="flex-1 min-w-[220px] px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                  <span className="text-xs font-mono-tabular text-slate-500">
                    Showing {filteredTrainers.length} of {corporateTrainers.length} verified trainers
                  </span>
                </div>
              </div>

              {filteredTrainers.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
                  No verified corporate trainers match the current search filters.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredTrainers.map((tr) => {
                    const isSaved = savedTrainers.some((s) => s.trainerId === tr.id);
                    const inCompare = compareIds.includes(tr.id);
                    const inShortlist = shortlistIds.includes(tr.id);
                    const itemCount = approvedPortfolioItems.filter(
                      (p) => p.trainerId === tr.id
                    ).length;
                    return (
                      <div
                        key={tr.id}
                        className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start gap-3.5">
                            <TrainerAvatar trainer={tr} />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#39836B]">
                                <span className="inline-flex items-center gap-1">
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  {tr.isVerified ? 'Admin Verified' : 'Approved'}
                                </span>
                                <span className="text-slate-300">·</span>
                                <span className="font-mono-tabular text-[#142B46]">
                                  {tr.experienceYears} yrs exp
                                </span>
                                {(tr.ratingAvg || 0) > 0 && (
                                  <>
                                    <span className="text-slate-300">·</span>
                                    <span className="inline-flex items-center gap-0.5 text-[#142B46] font-mono-tabular">
                                      <Star className="w-3 h-3 fill-[#F5BD54] text-[#F5BD54]" />
                                      {(tr.ratingAvg || 0).toFixed(1)} ({tr.reviewCount || 0})
                                    </span>
                                  </>
                                )}
                              </div>
                              <h3 className="font-display font-bold text-base text-[#142B46] mt-0.5">
                                {tr.fullName}
                              </h3>
                              <p className="text-xs text-slate-600 line-clamp-2">{tr.headline}</p>
                            </div>
                          </div>

                          {tr.bio && (
                            <p className="text-xs text-slate-600 line-clamp-2">{tr.bio}</p>
                          )}

                          <div className="space-y-1.5 text-xs">
                            <p className="text-slate-700">
                              <span className="font-semibold text-[#142B46]">Qualifications:</span>{' '}
                              {tr.qualifications}
                            </p>
                            {tr.certifications && tr.certifications.length > 0 && (
                              <p className="text-slate-600">
                                <span className="font-semibold text-[#142B46]">Certifications:</span>{' '}
                                {tr.certifications.join(' · ')}
                              </p>
                            )}
                            <p className="text-slate-600">
                              <span className="font-semibold text-[#142B46]">Specializations:</span>{' '}
                              {tr.categories.join(' · ')}
                            </p>
                            <p className="text-slate-600">
                              <span className="font-semibold text-[#142B46]">Topics:</span>{' '}
                              {tr.topics.slice(0, 5).join(' · ')}
                              {tr.topics.length > 5 ? ` (+${tr.topics.length - 5} more)` : ''}
                            </p>
                            <p className="text-slate-500 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-[#39836B] shrink-0" />
                              <span>
                                {tr.preferredLocations.join(', ')} ·{' '}
                                {(tr.languages || ['English', 'Amharic']).join(' / ')}
                              </span>
                            </p>
                            <p className="text-slate-500">
                              <span className="font-semibold text-[#142B46]">Availability:</span>{' '}
                              {tr.availability}
                              {itemCount > 0 ? ` · ${itemCount} approved portfolio sample(s)` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setInspectTrainer(tr)}
                            className="px-3 py-1.5 bg-[#142B46] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1 whitespace-nowrap"
                          >
                            <Eye className="w-3.5 h-3.5" /> Full Profile
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleSaveTrainer(tr)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border inline-flex items-center gap-1 whitespace-nowrap ${
                              isSaved
                                ? 'bg-[#39836B]/10 border-[#39836B] text-[#39836B]'
                                : 'border-slate-300 text-slate-600 hover:text-[#142B46]'
                            }`}
                          >
                            {isSaved ? (
                              <BookmarkCheck className="w-3.5 h-3.5" />
                            ) : (
                              <Bookmark className="w-3.5 h-3.5" />
                            )}
                            {isSaved ? 'Saved' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleCompare(tr.id)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border inline-flex items-center gap-1 whitespace-nowrap ${
                              inCompare
                                ? 'bg-[#F5BD54]/25 border-[#F5BD54] text-[#142B46]'
                                : 'border-slate-300 text-slate-600 hover:text-[#142B46]'
                            }`}
                          >
                            <GitCompare className="w-3.5 h-3.5" />
                            {inCompare ? 'In Compare' : 'Compare'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleShortlist(tr.id)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border inline-flex items-center gap-1 whitespace-nowrap ${
                              inShortlist
                                ? 'bg-[#39836B] border-[#39836B] text-white'
                                : 'border-slate-300 text-[#142B46] hover:bg-slate-50'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {inShortlist ? 'Shortlisted' : 'Shortlist'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'compare' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold text-[#142B46]">
                    Side-by-Side Trainer Comparison
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Compare up to 4 verified trainers across qualifications, experience,
                    methodologies, and service coverage. Commercial fees are issued exclusively via
                    TutorBridge itemized quotations.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTab('directory')}
                  className="px-3.5 py-2 border border-slate-300 text-[#142B46] text-xs font-semibold rounded-lg whitespace-nowrap"
                >
                  Select More Trainers
                </button>
              </div>

              {compareTrainers.length === 0 ? (
                <div className="py-10 text-center space-y-3">
                  <p className="text-sm text-slate-500">
                    No trainers added to comparison yet. Select up to 4 trainers in Browse Trainers.
                  </p>
                  <button
                    type="button"
                    onClick={() => setTab('directory')}
                    className="px-4 py-2 bg-[#142B46] text-white text-xs font-semibold rounded-lg"
                  >
                    Open Trainer Directory
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="py-3 pr-4 text-slate-500 font-semibold w-44 align-top">
                          Evaluation Criteria
                        </th>
                        {compareTrainers.map((tr) => (
                          <th key={tr.id} className="py-3 px-3 align-top min-w-[210px]">
                            <div className="flex items-center gap-2.5">
                              <TrainerAvatar trainer={tr} sizeClass="w-10 h-10" />
                              <div>
                                <p className="font-display font-bold text-sm text-[#142B46]">
                                  {tr.fullName}
                                </p>
                                <p className="font-normal text-[11px] text-[#39836B]">
                                  {tr.experienceYears} yrs exp ·{' '}
                                  {(tr.ratingAvg || 0) > 0
                                    ? `${(tr.ratingAvg || 0).toFixed(1)}/5`
                                    : 'Verified'}
                                </p>
                              </div>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="py-3 pr-4 font-semibold text-[#142B46]">Headline</td>
                        {compareTrainers.map((tr) => (
                          <td key={tr.id} className="py-3 px-3 text-slate-700 align-top">
                            {tr.headline}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-3 pr-4 font-semibold text-[#142B46]">Qualifications</td>
                        {compareTrainers.map((tr) => (
                          <td key={tr.id} className="py-3 px-3 text-slate-700 align-top">
                            {tr.qualifications}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-3 pr-4 font-semibold text-[#142B46]">Certifications</td>
                        {compareTrainers.map((tr) => (
                          <td key={tr.id} className="py-3 px-3 text-slate-600 align-top">
                            {tr.certifications && tr.certifications.length > 0
                              ? tr.certifications.join(' · ')
                              : 'On file with TutorBridge'}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-3 pr-4 font-semibold text-[#142B46]">Work Experience</td>
                        {compareTrainers.map((tr) => (
                          <td key={tr.id} className="py-3 px-3 text-slate-600 align-top">
                            {tr.workExperience || `${tr.experienceYears} years verified delivery`}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-3 pr-4 font-semibold text-[#142B46]">
                          Categories & Subjects
                        </td>
                        {compareTrainers.map((tr) => (
                          <td key={tr.id} className="py-3 px-3 text-slate-600 align-top">
                            <p className="font-semibold text-[#142B46]">
                              {tr.categories.join(' · ')}
                            </p>
                            <p className="mt-1">{tr.topics.join(', ')}</p>
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-3 pr-4 font-semibold text-[#142B46]">Past Projects</td>
                        {compareTrainers.map((tr) => (
                          <td key={tr.id} className="py-3 px-3 text-slate-600 align-top">
                            {tr.pastProjects && tr.pastProjects.length > 0
                              ? tr.pastProjects.join(' | ')
                              : 'Delivered via TutorBridge'}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-3 pr-4 font-semibold text-[#142B46]">Methodology</td>
                        {compareTrainers.map((tr) => (
                          <td key={tr.id} className="py-3 px-3 text-slate-600 align-top">
                            {tr.methodology}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-3 pr-4 font-semibold text-[#142B46]">
                          Languages & Locations
                        </td>
                        {compareTrainers.map((tr) => (
                          <td key={tr.id} className="py-3 px-3 text-slate-600 align-top">
                            <p>{(tr.languages || ['English', 'Amharic']).join(' · ')}</p>
                            <p className="text-slate-500 mt-0.5">
                              {tr.preferredLocations.join(', ')}
                            </p>
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-3 pr-4 font-semibold text-[#142B46]">Availability</td>
                        {compareTrainers.map((tr) => (
                          <td key={tr.id} className="py-3 px-3 text-slate-600 align-top">
                            {tr.availability}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-3 pr-4 font-semibold text-[#142B46]">Actions</td>
                        {compareTrainers.map((tr) => {
                          const inShortlist = shortlistIds.includes(tr.id);
                          return (
                            <td key={tr.id} className="py-3 px-3 align-top space-y-2">
                              <button
                                type="button"
                                onClick={() => handleToggleShortlist(tr.id)}
                                className={`w-full px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap ${
                                  inShortlist
                                    ? 'bg-[#39836B] text-white'
                                    : 'bg-[#142B46] text-white'
                                }`}
                              >
                                {inShortlist ? 'In Selection Shortlist' : 'Add to Shortlist'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleCompare(tr.id)}
                                className="w-full px-3 py-1.5 border border-slate-300 text-slate-600 rounded-lg font-semibold whitespace-nowrap"
                              >
                                Remove
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'saved' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold text-[#142B46]">
                    Saved Preferred Trainers
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Bookmark verified corporate trainers and keep internal selection notes for your
                    procurement or HR committee.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTab('directory')}
                  className="px-3.5 py-2 bg-[#142B46] text-white text-xs font-semibold rounded-lg whitespace-nowrap"
                >
                  Browse Directory
                </button>
              </div>

              {savedTrainers.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No trainers saved yet. Bookmark trainers from the directory to organize your
                  shortlist.
                </p>
              ) : (
                <div className="space-y-4">
                  {savedTrainers.map((saved) => {
                    const tr = corporateTrainers.find((t) => t.id === saved.trainerId);
                    if (!tr) return null;
                    const inShortlist = shortlistIds.includes(tr.id);
                    return (
                      <div
                        key={saved.id}
                        className="border border-slate-200 rounded-xl p-4 space-y-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <TrainerAvatar trainer={tr} sizeClass="w-12 h-12" />
                            <div>
                              <h3 className="font-display font-bold text-sm text-[#142B46]">
                                {tr.fullName}
                              </h3>
                              <p className="text-xs text-slate-600">{tr.headline}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {tr.categories.join(' · ')} ·{' '}
                                <span className="font-mono-tabular">
                                  {tr.experienceYears} yrs exp
                                </span>
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setInspectTrainer(tr)}
                              className="px-3 py-1.5 border border-slate-300 text-xs font-semibold rounded-lg text-[#142B46] whitespace-nowrap"
                            >
                              Full Profile
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleShortlist(tr.id)}
                              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap ${
                                inShortlist
                                  ? 'bg-[#39836B] text-white'
                                  : 'bg-[#142B46] text-white'
                              }`}
                            >
                              {inShortlist ? 'Shortlisted' : 'Add to Shortlist'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleSaveTrainer(tr)}
                              className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-red-600"
                              aria-label="Remove saved trainer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            maxLength={500}
                            value={savedNotesDraft[saved.id] ?? saved.notes ?? ''}
                            onChange={(e) =>
                              setSavedNotesDraft((prev) => ({
                                ...prev,
                                [saved.id]: e.target.value,
                              }))
                            }
                            placeholder="Internal committee notes (e.g., Ideal for Q3 Finance Excel cohort)"
                            className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateSavedNote(saved)}
                            className="px-3.5 py-1.5 bg-[#F5F7FA] border border-slate-300 text-[#142B46] text-xs font-semibold rounded-lg whitespace-nowrap"
                          >
                            Save Note
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'profile' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div>
                <h2 className="font-display text-lg font-bold text-[#142B46]">
                  Organization Profile & Billing Contact
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Used on corporate training quotations, service agreements, and official payment
                  receipts.
                </p>
              </div>
              <form onSubmit={handleSaveOrgProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#142B46] mb-1">
                      Organization Name
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={160}
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="e.g., Abyssinia Logistics PLC"
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#142B46] mb-1">
                      Organization Type
                    </label>
                    <select
                      value={orgType}
                      onChange={(e) => setOrgType(e.target.value as OrganizationType)}
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                    >
                      {ORGANIZATION_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#142B46] mb-1">
                      Industry / Sector
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={120}
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      placeholder="e.g., Banking, Humanitarian NGO, Education"
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#142B46] mb-1">
                      Contact Person
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={120}
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#142B46] mb-1">
                      Official Email
                    </label>
                    <input
                      type="email"
                      required
                      maxLength={200}
                      value={officialEmail}
                      onChange={(e) => setOfficialEmail(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#142B46] mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      required
                      minLength={4}
                      maxLength={40}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+251 911 ..."
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#142B46] mb-1">
                    Office / Training Premises Address
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={240}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#142B46] mb-1">
                    TIN / Billing Reference (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={400}
                    value={billingInfo}
                    onChange={(e) => setBillingInfo(e.target.value)}
                    placeholder="TIN number, finance contact, or PO billing instructions"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={actionBusy}
                    className="px-5 py-2.5 bg-[#142B46] text-white text-xs font-semibold rounded-lg disabled:opacity-50"
                  >
                    {organization ? 'Save Organization Profile' : 'Create Organization Profile'}
                  </button>
                  {profileSaved && (
                    <span className="text-xs font-semibold text-[#39836B] inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                    </span>
                  )}
                </div>
              </form>
            </div>
          )}

          {tab === 'requests' && (
            <div className="space-y-6">
              {/* Ranked Trainer Selection Shortlist Builder */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold text-[#142B46]">
                      Ranked Trainer Selection Request
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Rank preferred trainers from the directory and submit to TutorBridge for
                      managed coordination, availability confirmation, and official quotation.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab('directory')}
                    className="px-3.5 py-2 border border-slate-300 text-[#142B46] text-xs font-semibold rounded-lg whitespace-nowrap"
                  >
                    Add Trainers from Directory
                  </button>
                </div>

                {!organization ? (
                  <p className="text-xs text-slate-600">
                    Please create your Organization Profile before submitting trainer selection
                    requests.
                  </p>
                ) : shortlistTrainers.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Your selection shortlist is empty. Click &ldquo;Shortlist&rdquo; on any trainer
                    in Browse Trainers or Compare Trainers to build a ranked request.
                  </p>
                ) : (
                  <form onSubmit={handleSubmitSelectionRequest} className="space-y-4">
                    <div className="space-y-2">
                      {shortlistTrainers.map((tr, idx) => (
                        <div
                          key={tr.id}
                          className="border border-slate-200 bg-[#F5F7FA] rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono-tabular font-bold text-[#142B46]">
                              #{idx + 1}
                            </span>
                            <div>
                              <p className="font-bold text-[#142B46]">
                                {tr.fullName}{' '}
                                {idx === 0 && (
                                  <span className="text-[#39836B] font-semibold">
                                    (Primary Choice)
                                  </span>
                                )}
                              </p>
                              <p className="text-slate-600">
                                {tr.headline} · {tr.categories.join(', ')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveShortlist(idx, -1)}
                              className="p-1.5 border border-slate-300 bg-white rounded text-slate-600 disabled:opacity-40"
                              aria-label="Move preference up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === shortlistTrainers.length - 1}
                              onClick={() => handleMoveShortlist(idx, 1)}
                              className="p-1.5 border border-slate-300 bg-white rounded text-slate-600 disabled:opacity-40"
                              aria-label="Move preference down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleShortlist(tr.id)}
                              className="p-1.5 border border-slate-300 bg-white rounded text-slate-500 hover:text-red-600"
                              aria-label="Remove from shortlist"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <select
                        value={selectionCorpReqId}
                        onChange={(e) => setSelectionCorpReqId(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                      >
                        <option value="">Optional: Link to Existing Training Request</option>
                        {requests.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.category} ({r.preferredDates})
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        maxLength={1000}
                        value={selectionNotes}
                        onChange={(e) => setSelectionNotes(e.target.value)}
                        placeholder="Dates, target department, or briefing notes for TutorBridge..."
                        className="px-3 py-2 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={actionBusy}
                      className="px-4 py-2.5 bg-[#39836B] text-white text-xs font-semibold rounded-lg disabled:opacity-50"
                    >
                      Submit Trainer Selection Request to TutorBridge
                    </button>
                  </form>
                )}

                {selectionRequests.length > 0 && (
                  <div className="pt-4 border-t border-slate-200 space-y-2.5">
                    <h3 className="text-xs font-bold text-[#142B46]">
                      Submitted Trainer Selection Requests
                    </h3>
                    {selectionRequests.map((sel) => (
                      <div
                        key={sel.id}
                        className="border border-slate-200 rounded-xl p-4 space-y-1.5 text-xs"
                      >
                        <div className="flex flex-wrap justify-between gap-2">
                          <span className="font-bold text-[#142B46]">
                            Primary Preference: {sel.selectedTrainerName}
                          </span>
                          <span className="font-semibold text-[#39836B]">{sel.status}</span>
                        </div>
                        <p className="text-slate-600">
                          Ranked Preferences: {sel.rankedTrainerNames.join(' → ')}
                        </p>
                        {sel.suggestedTrainerName && (
                          <p className="text-[#142B46] font-semibold">
                            TutorBridge Suggested Alternative: {sel.suggestedTrainerName}
                          </p>
                        )}
                        {sel.notes && <p className="text-slate-500">Your notes: {sel.notes}</p>}
                        {sel.adminNotes && (
                          <p className="text-[#142B46] bg-[#F5F7FA] p-2.5 rounded-lg">
                            <strong>Coordinator Update:</strong> {sel.adminNotes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-[#142B46]">
                  Submit New Corporate Training Request
                </h2>
                {!organization ? (
                  <p className="text-xs text-slate-600">
                    Please create your Organization Profile first under the Organization Profile tab.
                  </p>
                ) : (
                  <form onSubmit={handleCreateRequest} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#142B46] mb-1">
                          Training Category
                        </label>
                        <select
                          value={reqCategory}
                          onChange={(e) => setReqCategory(e.target.value)}
                          className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                        >
                          {allCategoryNames.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#142B46] mb-1">
                          Program Duration
                        </label>
                        <select
                          value={reqDuration}
                          onChange={(e) => setReqDuration(e.target.value as CorporateDuration)}
                          className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                        >
                          {CORPORATE_DURATIONS.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#142B46] mb-1">
                        Specific Topics (comma-separated)
                      </label>
                      <input
                        type="text"
                        required
                        value={reqTopicsText}
                        onChange={(e) => setReqTopicsText(e.target.value)}
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#142B46] mb-1">
                        Training Objectives & Target Outcomes
                      </label>
                      <textarea
                        rows={3}
                        required
                        minLength={5}
                        maxLength={1500}
                        value={reqObjectives}
                        onChange={(e) => setReqObjectives(e.target.value)}
                        placeholder="Describe current skill level, departmental goals, and desired practical outputs..."
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#142B46] mb-1">
                          Participant Count
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={5000}
                          required
                          value={reqParticipants}
                          onChange={(e) => setReqParticipants(Number(e.target.value) || 1)}
                          className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#142B46] mb-1">
                          Preferred Training Dates
                        </label>
                        <input
                          type="text"
                          required
                          minLength={2}
                          maxLength={160}
                          value={reqDates}
                          onChange={(e) => setReqDates(e.target.value)}
                          placeholder="e.g., May 12 – May 15"
                          className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#142B46] mb-1">
                          Training Location / Venue
                        </label>
                        <input
                          type="text"
                          required
                          minLength={2}
                          maxLength={200}
                          value={reqLocation}
                          onChange={(e) => setReqLocation(e.target.value)}
                          className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#142B46] mb-1">
                          Minimum Budget (ETB)
                        </label>
                        <input
                          type="number"
                          min={500}
                          required
                          value={reqBudgetMin}
                          onChange={(e) => setReqBudgetMin(Number(e.target.value) || 500)}
                          className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#142B46] mb-1">
                          Maximum Budget (ETB)
                        </label>
                        <input
                          type="number"
                          min={reqBudgetMin}
                          required
                          value={reqBudgetMax}
                          onChange={(e) => setReqBudgetMax(Number(e.target.value) || reqBudgetMin)}
                          className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm tabular-nums"
                        />
                      </div>
                    </div>

                    {reqSuccess && (
                      <p className="text-xs font-semibold text-[#39836B]">{reqSuccess}</p>
                    )}

                    <button
                      type="submit"
                      disabled={actionBusy}
                      className="px-5 py-2.5 bg-[#142B46] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" /> Submit Training Request
                    </button>
                  </form>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                <h3 className="font-display font-bold text-[#142B46]">Submitted Requests</h3>
                {requests.length === 0 ? (
                  <p className="text-sm text-slate-500">No training requests submitted yet.</p>
                ) : (
                  requests.map((r) => (
                    <div key={r.id} className="border border-slate-200 rounded-xl p-4 space-y-1">
                      <div className="flex flex-wrap justify-between gap-2 text-xs">
                        <span className="font-bold text-[#142B46]">
                          {r.category} · {r.duration} ({r.participantCount} staff)
                        </span>
                        <span className="font-semibold text-[#39836B]">{r.status}</span>
                      </div>
                      <p className="text-xs text-slate-600">{r.topics.join(', ')}</p>
                      <p className="text-xs text-slate-500">
                        {r.preferredDates} · {r.location} · Budget:{' '}
                        <span className="font-mono-tabular">
                          {r.budgetMinEtb.toLocaleString()}–{r.budgetMaxEtb.toLocaleString()} ETB
                        </span>
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === 'proposals' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-[#142B46]">
                    Trainer Proposals & TutorBridge Commercial Quotations
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    All commercial terms are issued directly by TutorBridge Ethiopia as your
                    contracting intermediary.
                  </p>
                </div>

                {quotations.length === 0 && proposals.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No trainer proposals or quotations received yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {quotations.map((q) => {
                      const prop = proposals.find((p) => p.id === q.proposalId);
                      const req = requests.find((r) => r.id === q.requestId);
                      const canApprove =
                        q.status === 'sent' && prop && prop.status === 'accepted_by_trainer';
                      const facilitationAndCoordEtb =
                        q.trainerCompensationEtb + (q.coordinationFeeEtb || 0);
                      const extraChargesEtb = q.additionalChargesEtb || 0;
                      return (
                        <div key={q.id} className="border border-slate-200 rounded-xl p-5 space-y-4">
                          <div className="flex flex-wrap justify-between gap-2">
                            <div>
                              <p className="text-xs font-semibold text-[#39836B]">
                                Quotation Status: {q.status}
                                {prop ? ` · Facilitator Status: ${prop.status}` : ''}
                              </p>
                              <h3 className="font-display font-bold text-[#142B46] mt-0.5">
                                {req
                                  ? `${req.category} (${req.duration})`
                                  : 'Corporate Training Proposal'}
                              </h3>
                            </div>
                            <p className="font-mono-tabular text-lg font-bold text-[#142B46]">
                              Total: {q.totalAmountEtb.toLocaleString()} ETB
                            </p>
                          </div>

                          {prop && (
                            <div className="bg-[#F5F7FA] rounded-lg p-4 space-y-1 text-xs">
                              <p className="font-bold text-[#142B46]">
                                Assigned Facilitator: {prop.trainerName}
                              </p>
                              <p className="text-slate-600">{prop.trainerQualifications}</p>
                              <p className="text-slate-600">
                                <strong>Methodology:</strong> {prop.trainerMethodology}
                              </p>
                              <p className="text-slate-500">Schedule: {prop.proposedSchedule}</p>
                            </div>
                          )}

                          {/* Organizational Quotation Breakdown — internal trainer payout is never exposed */}
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs border-t border-slate-100 pt-3">
                            <div>
                              <p className="text-slate-500">Program Facilitation & Coordination</p>
                              <p className="font-mono-tabular font-bold text-[#142B46]">
                                {facilitationAndCoordEtb.toLocaleString()} ETB
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">Logistical Expenses</p>
                              <p className="font-mono-tabular font-bold text-[#142B46]">
                                {q.logisticalExpensesEtb.toLocaleString()} ETB
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">Platform Service Fee</p>
                              <p className="font-mono-tabular font-bold text-[#39836B]">
                                {q.serviceFeeEtb.toLocaleString()} ETB
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">Additional Charges</p>
                              <p className="font-mono-tabular font-bold text-[#142B46]">
                                {extraChargesEtb.toLocaleString()} ETB
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-[#F5F7FA] p-3 rounded-lg">
                            <div>
                              <p className="font-semibold text-[#142B46]">Payment Terms</p>
                              <p className="text-slate-600 mt-0.5">
                                {q.paymentTerms || 'Telebirr / CBE Birr / Bank Transfer'}
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold text-[#142B46]">Cancellation Terms</p>
                              <p className="text-slate-600 mt-0.5">
                                {q.cancellationTerms || '7-day notice standard corporate policy'}
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold text-[#142B46]">Quote Validity</p>
                              <p className="text-slate-600 font-mono-tabular mt-0.5">
                                {q.validityDays || 14} days from issue
                              </p>
                            </div>
                          </div>

                          {q.pricingNotes && (
                            <p className="text-xs text-slate-600">Commercial Notes: {q.pricingNotes}</p>
                          )}

                          {q.status === 'sent' && (
                            <div className="space-y-3 pt-2 border-t border-slate-100">
                              {canApprove && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <input
                                    type="text"
                                    maxLength={120}
                                    value={
                                      quoteSignerName[q.id] ??
                                      organization?.contactPerson ??
                                      currentUser.fullName
                                    }
                                    onChange={(e) =>
                                      setQuoteSignerName((prev) => ({
                                        ...prev,
                                        [q.id]: e.target.value,
                                      }))
                                    }
                                    placeholder="Authorized Signer Full Name"
                                    className="px-3 py-2 border border-slate-300 rounded-lg text-xs"
                                  />
                                  <input
                                    type="text"
                                    maxLength={120}
                                    value={
                                      quoteSignerRole[q.id] ?? 'Authorized Organization Representative'
                                    }
                                    onChange={(e) =>
                                      setQuoteSignerRole((prev) => ({
                                        ...prev,
                                        [q.id]: e.target.value,
                                      }))
                                    }
                                    placeholder="Signer Title / Role"
                                    className="px-3 py-2 border border-slate-300 rounded-lg text-xs"
                                  />
                                </div>
                              )}
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  disabled={!canApprove || actionBusy}
                                  onClick={() => handleApproveProposalAndQuotation(q, prop, req)}
                                  className="px-4 py-2 bg-[#39836B] text-white text-xs font-semibold rounded-lg disabled:opacity-50"
                                >
                                  {canApprove
                                    ? 'Approve Quotation & Sign Service Agreement'
                                    : 'Awaiting Facilitator Confirmation'}
                                </button>
                                <button
                                  type="button"
                                  disabled={actionBusy}
                                  onClick={() => handleDeclineProposal(q, prop, req)}
                                  className="px-4 py-2 border border-slate-300 text-slate-600 text-xs font-semibold rounded-lg"
                                >
                                  Decline Quotation
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {proposals
                      .filter((p) => !quotations.some((q) => q.proposalId === p.id))
                      .map((p) => (
                        <div key={p.id} className="border border-slate-200 rounded-xl p-4 space-y-1">
                          <p className="text-xs font-semibold text-[#39836B]">
                            Trainer Proposal ({p.status})
                          </p>
                          <p className="text-sm font-bold text-[#142B46]">{p.trainerName}</p>
                          <p className="text-xs text-slate-600">{p.trainerQualifications}</p>
                          <p className="text-xs text-slate-500">
                            Itemized quotation from TutorBridge will appear here once finalized.
                          </p>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {negotiations.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                  <h3 className="font-display font-bold text-[#142B46]">
                    TutorBridge Commercial Negotiation Updates
                  </h3>
                  {negotiations.map((neg) => (
                    <div
                      key={neg.id}
                      className="border border-slate-200 rounded-lg p-4 text-xs space-y-1"
                    >
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="font-bold text-[#142B46]">
                          Proposed Total: {neg.proposedAmountEtb.toLocaleString()} ETB
                        </span>
                        <span className="font-semibold text-[#39836B]">{neg.status}</span>
                      </div>
                      <p className="text-slate-700">{neg.proposedTerms}</p>
                      {neg.notes && <p className="text-slate-500">Notes: {neg.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'contracts' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-[#142B46]">
                    Corporate Service Agreements (Organization ↔ TutorBridge Ethiopia)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Service agreements are executed between {organization?.name || 'your organization'}{' '}
                    and TutorBridge Ethiopia. Trainer deployment agreements are managed separately by
                    TutorBridge.
                  </p>
                </div>
                {contracts.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No active training contracts yet. Approve a proposal & quotation to activate a
                    contract.
                  </p>
                ) : (
                  contracts.map((c) => (
                    <div key={c.id} className="border border-slate-200 rounded-xl p-5 space-y-3">
                      <div className="flex flex-wrap justify-between gap-2 text-xs">
                        <div>
                          {c.agreementNumber && (
                            <p className="font-mono-tabular text-[11px] font-semibold text-slate-500">
                              Agreement No: {c.agreementNumber}
                            </p>
                          )}
                          <span className="font-bold text-[#142B46] text-sm">{c.title}</span>
                        </div>
                        <span className="font-semibold text-[#39836B]">{c.status}</span>
                      </div>
                      <p className="text-xs text-slate-600">
                        Assigned Facilitator: <strong>{c.trainerName}</strong> · Total Contract
                        Value:{' '}
                        <span className="font-mono-tabular font-semibold text-[#142B46]">
                          {c.totalAmountEtb.toLocaleString()} ETB
                        </span>
                      </p>
                      {c.serviceTermsSummary && (
                        <p className="text-xs text-slate-600 bg-[#F5F7FA] p-3 rounded-lg">
                          <strong>Scope & Service Terms:</strong> {c.serviceTermsSummary}
                        </p>
                      )}
                      <div className="text-xs text-slate-500 space-y-1">
                        <p>
                          <strong>Payment Terms:</strong> {c.paymentTerms}
                        </p>
                        {c.cancellationTerms && (
                          <p>
                            <strong>Cancellation Terms:</strong> {c.cancellationTerms}
                          </p>
                        )}
                        <p>
                          <strong>Governing Law:</strong>{' '}
                          {c.governingLawClause || ETHIOPIAN_GOVERNING_LAW}
                        </p>
                      </div>

                      {c.replacementHistory && c.replacementHistory.length > 0 && (
                        <div className="bg-[#F5BD54]/15 border border-[#F5BD54]/50 rounded-lg p-3 text-xs space-y-1">
                          <p className="font-bold text-[#142B46] inline-flex items-center gap-1">
                            <RefreshCw className="w-3.5 h-3.5" /> Managed Trainer Continuity Log
                          </p>
                          {c.replacementHistory.map((entry, idx) => (
                            <p key={idx} className="text-slate-700">
                              • {entry}
                            </p>
                          ))}
                        </div>
                      )}

                      {c.orgAcceptedAt ? (
                        <p className="text-xs font-semibold text-[#39836B]">
                          Electronically signed by {c.orgAcceptedByName} ({c.orgAcceptedRole}) on{' '}
                          {c.orgAcceptedAt.slice(0, 10)}
                        </p>
                      ) : (
                        <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            maxLength={120}
                            value={
                              contractSignerName[c.id] ??
                              organization?.contactPerson ??
                              currentUser.fullName
                            }
                            onChange={(e) =>
                              setContractSignerName((prev) => ({
                                ...prev,
                                [c.id]: e.target.value,
                              }))
                            }
                            placeholder="Authorized Signer Full Name"
                            className="px-3 py-2 border border-slate-300 rounded-lg text-xs"
                          />
                          <input
                            type="text"
                            maxLength={120}
                            value={
                              contractSignerRole[c.id] ?? 'Authorized Organization Representative'
                            }
                            onChange={(e) =>
                              setContractSignerRole((prev) => ({
                                ...prev,
                                [c.id]: e.target.value,
                              }))
                            }
                            placeholder="Title / Role"
                            className="px-3 py-2 border border-slate-300 rounded-lg text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleSignExistingContract(c)}
                            className="px-3.5 py-2 bg-[#142B46] text-white text-xs font-semibold rounded-lg"
                          >
                            Sign & Accept Agreement
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h3 className="font-display font-bold text-[#142B46]">
                  Participant Roster Management
                </h3>
                {contracts.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Activate a training contract to register staff participants.
                  </p>
                ) : (
                  <>
                    <form onSubmit={handleAddParticipant} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <select
                        required
                        value={partContractId}
                        onChange={(e) => setPartContractId(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                      >
                        <option value="">Select Contract</option>
                        {contracts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        required
                        maxLength={120}
                        value={partName}
                        onChange={(e) => setPartName(e.target.value)}
                        placeholder="Participant Full Name"
                        className="px-3 py-2 border border-slate-300 rounded-lg text-xs"
                      />
                      <input
                        type="text"
                        maxLength={120}
                        value={partDept}
                        onChange={(e) => setPartDept(e.target.value)}
                        placeholder="Department (optional)"
                        className="px-3 py-2 border border-slate-300 rounded-lg text-xs"
                      />
                      <div className="flex gap-2">
                        <input
                          type="email"
                          maxLength={200}
                          value={partEmail}
                          onChange={(e) => setPartEmail(e.target.value)}
                          placeholder="Email (optional)"
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                        />
                        <button
                          type="submit"
                          className="px-3 py-2 bg-[#142B46] text-white text-xs font-semibold rounded-lg shrink-0"
                        >
                          Add
                        </button>
                      </div>
                    </form>

                    {participants.length > 0 && (
                      <div className="divide-y divide-slate-100 text-xs pt-2">
                        {participants.map((p) => (
                          <div key={p.id} className="py-2.5 flex items-center justify-between gap-4">
                            <div>
                              <span className="font-semibold text-[#142B46]">{p.fullName}</span>
                              {p.department && (
                                <span className="text-slate-500"> · {p.department}</span>
                              )}
                              {p.email && <span className="text-slate-400"> · {p.email}</span>}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteParticipant(p.id)}
                              className="text-slate-400 hover:text-red-600"
                              aria-label="Remove participant"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {tab === 'schedules' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                <h2 className="font-display text-lg font-bold text-[#142B46]">
                  Training Schedules & Venues
                </h2>
                {schedules.length === 0 ? (
                  <p className="text-sm text-slate-500">No training sessions scheduled yet.</p>
                ) : (
                  schedules.map((s) => (
                    <div key={s.id} className="p-4 border border-slate-200 rounded-lg text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="font-bold text-[#142B46]">{s.sessionTitle}</span>
                        <span className="font-semibold text-[#39836B]">{s.status}</span>
                      </div>
                      <p className="text-slate-600 font-mono-tabular">
                        {s.sessionDate} · {s.timeRange} · Venue: {s.venue}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                <h3 className="font-display font-bold text-[#142B46]">Attendance Records</h3>
                {attendance.length === 0 ? (
                  <p className="text-sm text-slate-500">No attendance logs recorded yet.</p>
                ) : (
                  attendance.map((a) => (
                    <div key={a.id} className="p-4 border border-slate-200 rounded-lg text-xs">
                      <p className="font-bold text-[#142B46] font-mono-tabular">
                        {a.sessionDate} · Present: {a.presentCount} / {a.totalParticipants}
                      </p>
                      {a.notes && <p className="text-slate-600 mt-1">{a.notes}</p>}
                    </div>
                  ))
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-[#142B46]">
                    Training Completion Reports
                  </h3>
                  {reports.length > 0 && (
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-[#142B46] hover:bg-slate-50"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print Report
                    </button>
                  )}
                </div>
                {reports.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Completion reports appear here once your training concludes.
                  </p>
                ) : (
                  reports.map((rep) => (
                    <div
                      key={rep.id}
                      className="p-4 bg-[#F5F7FA] border border-slate-200 rounded-xl space-y-2 text-xs"
                    >
                      <div className="flex justify-between">
                        <span className="font-bold text-[#142B46]">
                          Facilitator: {rep.trainerName}
                        </span>
                        <span className="font-mono-tabular font-semibold text-[#39836B]">
                          Attendance: {rep.attendanceRatePct}%
                        </span>
                      </div>
                      <p className="text-slate-700">{rep.summary}</p>
                      <p className="text-slate-600">
                        <strong>Outcomes Achieved:</strong> {rep.outcomesAchieved}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === 'invoices' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-[#142B46]">
                    Corporate Invoices & Payment Submission
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Pay TutorBridge Ethiopia via Telebirr, CBE Birr, or Bank Transfer and submit
                    your transaction reference for verification.
                  </p>
                </div>
                {invoices.length === 0 ? (
                  <p className="text-sm text-slate-500">No corporate invoices issued yet.</p>
                ) : (
                  invoices.map((inv) => (
                    <div key={inv.id} className="border border-slate-200 rounded-xl p-5 space-y-3">
                      <div className="flex flex-wrap justify-between gap-2 text-xs">
                        <span className="font-mono-tabular font-bold text-[#142B46]">
                          {inv.invoiceNumber}
                        </span>
                        <span className="font-semibold text-[#39836B]">{inv.status}</span>
                      </div>
                      <p className="font-mono-tabular text-sm font-bold text-[#142B46]">
                        Amount Due: {inv.amountEtb.toLocaleString()} ETB
                      </p>
                      {inv.transactionRef && (
                        <p className="text-xs text-slate-600 font-mono-tabular">
                          Submitted: {inv.paymentMethod} · Ref: {inv.transactionRef}
                        </p>
                      )}
                      {inv.status === 'unpaid' && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                          <select
                            value={payMethod[inv.id] || 'Bank Transfer'}
                            onChange={(e) =>
                              setPayMethod((prev) => ({
                                ...prev,
                                [inv.id]: e.target.value as 'Telebirr' | 'CBE Birr' | 'Bank Transfer',
                              }))
                            }
                            className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                          >
                            <option value="Bank Transfer">Bank Transfer (CBE / Awash)</option>
                            <option value="Telebirr">Telebirr</option>
                            <option value="CBE Birr">CBE Birr</option>
                          </select>
                          <input
                            type="text"
                            value={payRef[inv.id] || ''}
                            onChange={(e) =>
                              setPayRef((prev) => ({ ...prev, [inv.id]: e.target.value }))
                            }
                            placeholder="Transaction / Slip Reference"
                            className="px-3 py-2 border border-slate-300 rounded-lg text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleSubmitInvoicePayment(inv)}
                            className="px-4 py-2 bg-[#142B46] text-white text-xs font-semibold rounded-lg"
                          >
                            Submit Payment Reference
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div>
                  <h3 className="font-display font-bold text-[#142B46]">
                    Cancellation & Refund Requests
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Request a contract adjustment or refund in accordance with your signed
                    Service Agreement cancellation terms.
                  </p>
                </div>

                {contracts.length === 0 ? (
                  <p className="text-xs text-slate-500">No contracts available for refund request.</p>
                ) : (
                  <form onSubmit={handleSubmitRefundRequest} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <select
                        required
                        value={refContractId}
                        onChange={(e) => setRefContractId(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                      >
                        <option value="">Select Contract</option>
                        {contracts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.agreementNumber || c.title}
                          </option>
                        ))}
                      </select>
                      <select
                        value={refInvoiceId}
                        onChange={(e) => setRefInvoiceId(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                      >
                        <option value="">Optional: Related Invoice</option>
                        {invoices.map((inv) => (
                          <option key={inv.id} value={inv.id}>
                            {inv.invoiceNumber} ({inv.amountEtb.toLocaleString()} ETB)
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={0}
                        required
                        value={refAmountEtb}
                        onChange={(e) => setRefAmountEtb(Number(e.target.value) || 0)}
                        placeholder="Requested Refund (ETB)"
                        className="px-3 py-2 border border-slate-300 rounded-lg text-xs tabular-nums"
                      />
                    </div>
                    <textarea
                      rows={2}
                      required
                      minLength={4}
                      maxLength={1000}
                      value={refReason}
                      onChange={(e) => setRefReason(e.target.value)}
                      placeholder="Explain cancellation or schedule adjustment details..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#142B46] text-white text-xs font-semibold rounded-lg"
                    >
                      Submit Refund Request
                    </button>
                  </form>
                )}

                {refunds.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                    {refunds.map((rf) => (
                      <div key={rf.id} className="border border-slate-200 rounded-lg p-3 space-y-1">
                        <div className="flex justify-between">
                          <span className="font-mono-tabular font-bold text-[#142B46]">
                            Requested: {rf.refundAmountEtb.toLocaleString()} ETB
                            {rf.cancellationFeeEtb > 0
                              ? ` (Retention fee: ${rf.cancellationFeeEtb.toLocaleString()} ETB)`
                              : ''}
                          </span>
                          <span className="font-semibold text-[#39836B]">{rf.status}</span>
                        </div>
                        <p className="text-slate-600">{rf.reason}</p>
                        {rf.processedRef && (
                          <p className="font-mono-tabular text-slate-500">
                            Settlement Ref: {rf.processedRef}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'feedback' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-[#142B46]">
                  Submit Training Program Evaluation
                </h2>
                {contracts.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Feedback can be submitted once you have an active or completed training contract.
                  </p>
                ) : (
                  <form onSubmit={handleSubmitFeedback} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <select
                        required
                        value={fbContractId}
                        onChange={(e) => setFbContractId(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                      >
                        <option value="">Select Contract</option>
                        {contracts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title} ({c.trainerName})
                          </option>
                        ))}
                      </select>
                      <select
                        value={fbRating}
                        onChange={(e) => setFbRating(Number(e.target.value))}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                      >
                        <option value={5}>5 / 5 — Excellent</option>
                        <option value={4}>4 / 5 — Strong</option>
                        <option value={3}>3 / 5 — Satisfactory</option>
                        <option value={2}>2 / 5 — Needs Improvement</option>
                        <option value={1}>1 / 5 — Unsatisfactory</option>
                      </select>
                    </div>
                    <textarea
                      rows={3}
                      required
                      minLength={4}
                      maxLength={1000}
                      value={fbComment}
                      onChange={(e) => setFbComment(e.target.value)}
                      placeholder="Evaluate trainer delivery, practical exercises, and staff satisfaction..."
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#142B46] text-white text-xs font-semibold rounded-lg"
                    >
                      Submit Organization Feedback
                    </button>
                  </form>
                )}

                {feedbacks.length > 0 && (
                  <div className="pt-4 border-t border-slate-100 space-y-2">
                    <p className="text-xs font-bold text-[#142B46]">Submitted Evaluations</p>
                    {feedbacks.map((f) => (
                      <div key={f.id} className="p-3 bg-[#F5F7FA] rounded-lg text-xs">
                        <p className="font-bold text-[#142B46]">Rating: {f.rating}/5</p>
                        <p className="text-slate-600 mt-0.5">{f.comment}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h3 className="font-display font-bold text-[#142B46]">
                  Corporate Coordination Support Desk
                </h3>
                <form onSubmit={handleSubmitSupport} className="space-y-3">
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={160}
                    value={ticketSubject}
                    onChange={(e) => setTicketSubject(e.target.value)}
                    placeholder="Subject (e.g., Venue coordination or invoice inquiry)"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                  <textarea
                    rows={3}
                    required
                    minLength={5}
                    maxLength={1500}
                    value={ticketMsg}
                    onChange={(e) => setTicketMsg(e.target.value)}
                    placeholder="Message for TutorBridge Corporate Coordination team..."
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#142B46] text-white text-xs font-semibold rounded-lg"
                  >
                    Send Support Message
                  </button>
                </form>

                {supportTickets.length > 0 && (
                  <div className="space-y-2 pt-2">
                    {supportTickets.map((tk) => (
                      <div key={tk.id} className="p-3 border border-slate-200 rounded-lg text-xs">
                        <div className="flex justify-between">
                          <span className="font-bold text-[#142B46]">{tk.subject}</span>
                          <span className="text-[#39836B] font-semibold">{tk.status}</span>
                        </div>
                        <p className="text-slate-600 mt-1">{tk.message}</p>
                        {tk.adminResponse && (
                          <p className="text-[#142B46] mt-1 font-medium">
                            Reply: {tk.adminResponse}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'messages' && (
            <MessagingCenter
              currentUser={currentUser}
              roleContext="organization"
              conversations={conversations}
              messages={messages}
              restriction={messagingRestriction}
              violations={userViolations}
              trainingContracts={contracts}
              trainingProposals={proposals}
            />
          )}
        </main>
      </div>

      {/* Full Corporate Trainer Profile Modal (Professional Information Only — Zero PII / Zero Rates) */}
      {inspectTrainer && (
        <div className="fixed inset-0 z-50 bg-[#142B46]/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <TrainerAvatar trainer={inspectTrainer} sizeClass="w-16 h-16" />
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#39836B]">
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {inspectTrainer.isVerified ? 'Verified Corporate Trainer' : 'Approved'}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="font-mono-tabular text-[#142B46]">
                      {inspectTrainer.experienceYears} years experience
                    </span>
                    {(inspectTrainer.ratingAvg || 0) > 0 && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span className="font-mono-tabular text-[#142B46]">
                          {(inspectTrainer.ratingAvg || 0).toFixed(1)}/5 (
                          {inspectTrainer.reviewCount || 0} reviews)
                        </span>
                      </>
                    )}
                  </div>
                  <h3 className="font-display text-xl font-bold text-[#142B46] mt-0.5">
                    {inspectTrainer.fullName}
                  </h3>
                  <p className="text-xs text-slate-600">{inspectTrainer.headline}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectTrainer(null)}
                className="p-1.5 text-slate-400 hover:text-[#142B46]"
                aria-label="Close profile modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {inspectTrainer.bio && (
              <div className="text-xs text-slate-700 leading-relaxed">{inspectTrainer.bio}</div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#F5F7FA] rounded-xl p-4 text-xs">
              <div>
                <p className="font-bold text-[#142B46] inline-flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-[#39836B]" /> Academic Qualifications
                </p>
                <p className="text-slate-700 mt-1">{inspectTrainer.qualifications}</p>
              </div>
              <div>
                <p className="font-bold text-[#142B46]">Professional Certifications</p>
                <p className="text-slate-700 mt-1">
                  {inspectTrainer.certifications && inspectTrainer.certifications.length > 0
                    ? inspectTrainer.certifications.join(' · ')
                    : 'Verified credentials on file with TutorBridge'}
                </p>
              </div>
              <div>
                <p className="font-bold text-[#142B46]">Languages & Locations</p>
                <p className="text-slate-700 mt-1">
                  {(inspectTrainer.languages || ['English', 'Amharic']).join(' · ')} —{' '}
                  {inspectTrainer.preferredLocations.join(', ')}
                </p>
              </div>
              <div>
                <p className="font-bold text-[#142B46]">Published Availability</p>
                <p className="text-slate-700 mt-1">{inspectTrainer.availability}</p>
              </div>
            </div>

            {inspectTrainer.workExperience && (
              <div className="text-xs space-y-1">
                <p className="font-bold text-[#142B46]">Work Experience</p>
                <p className="text-slate-600">{inspectTrainer.workExperience}</p>
              </div>
            )}

            <div className="text-xs space-y-1">
              <p className="font-bold text-[#142B46]">Training Methodology & Teaching Approach</p>
              <p className="text-slate-600">{inspectTrainer.methodology}</p>
            </div>

            <div className="text-xs space-y-1">
              <p className="font-bold text-[#142B46]">Subjects & Training Capabilities</p>
              <p className="text-slate-700">
                <strong>Categories:</strong> {inspectTrainer.categories.join(' · ')}
              </p>
              <p className="text-slate-600">
                <strong>Topics:</strong> {inspectTrainer.topics.join(', ')}
              </p>
            </div>

            {inspectTrainer.pastProjects && inspectTrainer.pastProjects.length > 0 && (
              <div className="text-xs space-y-1">
                <p className="font-bold text-[#142B46]">Previous Corporate Projects</p>
                {inspectTrainer.pastProjects.map((proj, idx) => (
                  <p key={idx} className="text-slate-600">
                    • {proj}
                  </p>
                ))}
              </div>
            )}

            {((inspectTrainer.portfolioSamples && inspectTrainer.portfolioSamples.length > 0) ||
              approvedPortfolioItems.some((p) => p.trainerId === inspectTrainer.id)) && (
              <div className="text-xs space-y-2">
                <p className="font-bold text-[#142B46]">Approved Curriculum & Portfolio Samples</p>
                {inspectTrainer.portfolioSamples?.map((sample, idx) => (
                  <p key={idx} className="text-slate-600">
                    • {sample}
                  </p>
                ))}
                {approvedPortfolioItems
                  .filter((p) => p.trainerId === inspectTrainer.id)
                  .map((item) => (
                    <div key={item.id} className="p-3 bg-[#F5F7FA] rounded-lg space-y-1">
                      <p className="font-bold text-[#142B46]">
                        {item.title} ({item.category})
                      </p>
                      <p className="text-slate-600">{item.summary}</p>
                      {item.outcomeMetrics && (
                        <p className="text-[#39836B] font-semibold">
                          Outcomes: {item.outcomeMetrics}
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            )}

            <div className="bg-[#142B46]/5 ring-1 ring-inset ring-[#142B46]/20 rounded-lg p-3 text-xs text-[#142B46]">
              <strong>Managed Intermediary Notice:</strong> TutorBridge Ethiopia coordinates all
              trainer scheduling, commercial quotations, and contracts. Direct communication or
              off-platform engagement is prohibited.
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleToggleSaveTrainer(inspectTrainer)}
                className="px-3.5 py-2 border border-slate-300 text-xs font-semibold rounded-lg text-[#142B46]"
              >
                {savedTrainers.some((s) => s.trainerId === inspectTrainer.id)
                  ? 'Unsave Trainer'
                  : 'Save Trainer'}
              </button>
              <button
                type="button"
                onClick={() => handleToggleCompare(inspectTrainer.id)}
                className="px-3.5 py-2 border border-slate-300 text-xs font-semibold rounded-lg text-[#142B46]"
              >
                {compareIds.includes(inspectTrainer.id) ? 'Remove from Compare' : 'Add to Compare'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!shortlistIds.includes(inspectTrainer.id)) {
                    handleToggleShortlist(inspectTrainer.id);
                  }
                  setInspectTrainer(null);
                  setTab('requests');
                }}
                className="px-4 py-2 bg-[#39836B] text-white text-xs font-semibold rounded-lg"
              >
                Select & Request via TutorBridge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
