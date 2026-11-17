import React, { useState } from 'react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import {
  Award,
  BookOpen,
  Briefcase,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  FileText,
  LogOut,
  MessageSquare,
  Plus,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { CORPORATE_TRAINING_CATEGORIES } from '../data/seedData';
import {
  ADDIS_SUB_CITIES,
  AVAILABILITY_DAYS,
  AppRoute,
  Booking,
  Conversation,
  CorporateNegotiation,
  CorporateTrainer,
  MAX_TEXT_LENGTHS,
  Message,
  MessagingRestriction,
  ProgressReport,
  Review,
  TrainerAssignmentAgreement,
  TrainerCompensationRecord,
  TrainerPortfolioItem,
  TrainingAttendance,
  TrainingContract,
  TrainingProposal,
  TrainingReport,
  TrainingSchedule,
  TutorDocument,
  TutorProfile,
  UserAccount,
  UserViolation,
  clampText,
} from '../types';
import { MessagingCenter } from './MessagingCenter';

interface TutorDashboardProps {
  currentUser: UserAccount;
  tutorProfile: TutorProfile | null;
  corporateTrainerProfile: CorporateTrainer | null;
  tutorDocuments: TutorDocument[];
  bookings: Booking[];
  progressReports: ProgressReport[];
  reviews: Review[];
  trainingProposals: TrainingProposal[];
  trainingContracts: TrainingContract[];
  trainingSchedules: TrainingSchedule[];
  trainingAttendance: TrainingAttendance[];
  trainingReports: TrainingReport[];
  portfolioItems: TrainerPortfolioItem[];
  trainerAssignments: TrainerAssignmentAgreement[];
  trainerCompensations: TrainerCompensationRecord[];
  trainerNegotiations: CorporateNegotiation[];
  conversations: Conversation[];
  messages: Message[];
  messagingRestriction: MessagingRestriction | null;
  userViolations: UserViolation[];
  onSignOut: () => void;
  onNavigate: (route: AppRoute) => void;
}

type TutorTab =
  | 'overview'
  | 'bookings'
  | 'progress'
  | 'corporate'
  | 'messages'
  | 'earnings'
  | 'profile'
  | 'credentials';

export const TutorDashboard: React.FC<TutorDashboardProps> = ({
  currentUser,
  tutorProfile,
  corporateTrainerProfile,
  tutorDocuments,
  bookings,
  progressReports,
  reviews,
  trainingProposals,
  trainingContracts,
  trainingSchedules,
  trainingAttendance,
  trainingReports,
  portfolioItems,
  trainerAssignments,
  trainerCompensations,
  trainerNegotiations,
  conversations,
  messages,
  messagingRestriction,
  userViolations,
  onSignOut,
  onNavigate,
}) => {
  const [tab, setTab] = useState<TutorTab>(
    !tutorProfile && (corporateTrainerProfile || currentUser.role === 'trainer')
      ? 'corporate'
      : 'overview'
  );

  // Tutor profile editor state
  const [headline, setHeadline] = useState(tutorProfile?.headline || '');
  const [bio, setBio] = useState(tutorProfile?.bio || '');
  const [rate, setRate] = useState(tutorProfile?.hourlyRateEtb || 500);
  const [days, setDays] = useState<string[]>(tutorProfile?.availabilityDays || []);
  const [subCities, setSubCities] = useState<string[]>(tutorProfile?.subCities || []);
  const [profileSaved, setProfileSaved] = useState(false);

  // Corporate trainer profile editor state
  const [trainerHeadline, setTrainerHeadline] = useState(corporateTrainerProfile?.headline || '');
  const [trainerBio, setTrainerBio] = useState(corporateTrainerProfile?.bio || '');
  const [trainerWorkExp, setTrainerWorkExp] = useState(
    corporateTrainerProfile?.workExperience || ''
  );
  const [trainerPastProjectsText, setTrainerPastProjectsText] = useState(
    (corporateTrainerProfile?.pastProjects || []).join('\n')
  );
  const [trainerLanguagesText, setTrainerLanguagesText] = useState(
    (corporateTrainerProfile?.languages || ['Amharic', 'English']).join(', ')
  );
  const [trainerPendingQual, setTrainerPendingQual] = useState(
    corporateTrainerProfile?.pendingQualificationUpdate || ''
  );
  const [trainerMethodology, setTrainerMethodology] = useState(
    corporateTrainerProfile?.methodology || ''
  );
  const [trainerAvailability, setTrainerAvailability] = useState(
    corporateTrainerProfile?.availability || ''
  );
  const [trainerDailyRate, setTrainerDailyRate] = useState(
    corporateTrainerProfile?.proposedDailyRateEtb || 5000
  );
  const [trainerLocations, setTrainerLocations] = useState<string[]>(
    corporateTrainerProfile?.preferredLocations || []
  );
  const [trainerSaved, setTrainerSaved] = useState(false);
  const [trainerProfileErr, setTrainerProfileErr] = useState('');

  // Portfolio item creator state
  const [portTitle, setPortTitle] = useState('');
  const [portCategory, setPortCategory] = useState(
    CORPORATE_TRAINING_CATEGORIES[0]?.name || 'Digital Literacy'
  );
  const [portSummary, setPortSummary] = useState('');
  const [portMetrics, setPortMetrics] = useState('');
  const [portErr, setPortErr] = useState('');

  // Trainer assignment acceptance signature state
  const [assignSignerName, setAssignSignerName] = useState<Record<string, string>>({});

  // Proposal response notes
  const [proposalNotes, setProposalNotes] = useState<Record<string, string>>({});

  // Corporate attendance & completion report logger state
  const [attContractId, setAttContractId] = useState('');
  const [attDate, setAttDate] = useState(new Date().toISOString().slice(0, 10));
  const [attPresent, setAttPresent] = useState<number>(15);
  const [attTotal, setAttTotal] = useState<number>(20);
  const [attNotes, setAttNotes] = useState('');

  const [repContractId, setRepContractId] = useState('');
  const [repSummary, setRepSummary] = useState('');
  const [repOutcomes, setRepOutcomes] = useState('');
  const [repAttendancePct, setRepAttendancePct] = useState<number>(92);

  // Individual tutoring progress report logger state
  const [reportBookingId, setReportBookingId] = useState('');
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceStatus, setAttendanceStatus] = useState<'present' | 'absent' | 'rescheduled'>(
    'present'
  );
  const [reportSummary, setReportSummary] = useState('');

  // Extra credential upload state
  const [docType, setDocType] = useState<TutorDocument['docType']>('teaching_license');
  const [docTitle, setDocTitle] = useState('');
  const [docRef, setDocRef] = useState('');

  if (!tutorProfile && !corporateTrainerProfile) {
    return (
      <div className="bg-[#F5F7FA] min-h-screen py-16 px-4">
        <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4">
          <h2 className="font-display text-2xl font-bold text-[#142B46]">
            Complete Your Educator or Trainer Application
          </h2>
          <p className="text-sm text-slate-600">
            You do not have an active Tutor or Corporate Trainer profile yet. Submit your
            qualifications and credentials to start teaching on TutorBridge Ethiopia.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('become-tutor')}
              className="px-5 py-2.5 bg-[#142B46] text-white text-sm font-semibold rounded-lg"
            >
              Apply as Tutor or Corporate Trainer
            </button>
            <button
              type="button"
              onClick={() => onNavigate('parent-dashboard')}
              className="px-5 py-2.5 border border-slate-300 text-sm font-semibold rounded-lg"
            >
              Switch to Parent View
            </button>
          </div>
        </div>
      </div>
    );
  }

  const tutorReviews = tutorProfile ? reviews.filter((r) => r.tutorId === tutorProfile.id) : [];
  const completedBookings = bookings.filter((b) => b.status === 'completed');
  const totalGrossEtb = completedBookings.reduce((sum, b) => sum + b.totalAmountEtb, 0);
  const totalCommissionEtb = completedBookings.reduce((sum, b) => sum + b.commissionAmountEtb, 0);
  const totalNetEarningsEtb = completedBookings.reduce((sum, b) => sum + b.tutorPayoutEtb, 0);

  const corporateEarningsEtb = trainingContracts
    .filter((c) => c.status !== 'cancelled')
    .reduce((sum, c) => sum + c.trainerCompensationEtb, 0);

  const activeDisplayName =
    tutorProfile?.fullName || corporateTrainerProfile?.fullName || currentUser.fullName;
  const activeStatusLabel = tutorProfile
    ? `Tutor: ${tutorProfile.status}`
    : `Trainer: ${corporateTrainerProfile?.status}`;

  const handleBookingTransition = async (
    bookingId: string,
    nextStatus: 'pending_payment' | 'cancelled' | 'completed'
  ) => {
    try {
      await updateDoc(doc(db, 'bookings', bookingId), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bookings/${bookingId}`);
    }
  };

  const handleLogProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tutorProfile) return;
    const b = bookings.find((bk) => bk.id === reportBookingId);
    if (!b || !reportSummary.trim()) return;
    try {
      await addDoc(collection(db, 'progress_reports'), {
        bookingId: b.id,
        parentId: b.parentId,
        tutorId: tutorProfile.id,
        tutorUserId: currentUser.uid,
        tutorName: tutorProfile.fullName,
        studentName: b.studentName,
        subject: b.subject,
        sessionDate,
        attendanceStatus,
        summary: clampText(reportSummary, 1000),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setReportSummary('');
      setReportBookingId('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'progress_reports');
    }
  };

  const handleSaveTutorProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tutorProfile) return;
    try {
      await updateDoc(doc(db, 'tutors', tutorProfile.id), {
        headline: clampText(headline, MAX_TEXT_LENGTHS.headline),
        bio: clampText(bio, MAX_TEXT_LENGTHS.bio),
        hourlyRateEtb: rate,
        availabilityDays: days.length > 0 ? days : tutorProfile.availabilityDays,
        subCities: subCities.length > 0 ? subCities : tutorProfile.subCities,
        languages: tutorProfile.languages,
        updatedAt: serverTimestamp(),
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tutors/${tutorProfile.id}`);
    }
  };

  const handleSaveTrainerProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!corporateTrainerProfile) return;
    setTrainerProfileErr('');
    const pastProjects = trainerPastProjectsText
      .split('\n')
      .map((s) => clampText(s, 120))
      .filter(Boolean)
      .slice(0, 20);
    const languages = trainerLanguagesText
      .split(',')
      .map((s) => clampText(s, 60))
      .filter(Boolean)
      .slice(0, 10);
    try {
      await updateDoc(doc(db, 'corporate_trainers', corporateTrainerProfile.id), {
        headline: clampText(trainerHeadline, MAX_TEXT_LENGTHS.headline),
        bio: clampText(trainerBio, MAX_TEXT_LENGTHS.bio),
        workExperience: clampText(trainerWorkExp, 1500),
        pastProjects,
        languages: languages.length > 0 ? languages : ['Amharic', 'English'],
        methodology: clampText(trainerMethodology, 1500),
        availability: clampText(trainerAvailability, 200),
        preferredLocations:
          trainerLocations.length > 0
            ? trainerLocations
            : corporateTrainerProfile.preferredLocations,
        proposedDailyRateEtb: trainerDailyRate,
        pendingQualificationUpdate: clampText(trainerPendingQual, 600),
        updatedAt: serverTimestamp(),
      });
      setTrainerSaved(true);
      setTimeout(() => setTrainerSaved(false), 2500);
    } catch (error) {
      setTrainerProfileErr(
        'Could not update trainer profile. Ensure no personal phone numbers, emails, or external links are included.'
      );
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `corporate_trainers/${corporateTrainerProfile.id}`
      );
    }
  };

  const handleAddPortfolioItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!corporateTrainerProfile || !portTitle.trim() || !portSummary.trim()) return;
    setPortErr('');
    try {
      await addDoc(collection(db, 'trainer_portfolio_items'), {
        trainerId: corporateTrainerProfile.id,
        trainerUserId: currentUser.uid,
        title: clampText(portTitle, 160),
        category: clampText(portCategory, 120),
        summary: clampText(portSummary, 1500),
        outcomeMetrics: clampText(portMetrics, 400),
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setPortTitle('');
      setPortSummary('');
      setPortMetrics('');
    } catch (error) {
      setPortErr(
        'Submission blocked. Ensure portfolio summaries do not include phone numbers, emails, or external URLs.'
      );
      handleFirestoreError(error, OperationType.CREATE, 'trainer_portfolio_items');
    }
  };

  const handleDeletePortfolioItem = async (itemId: string) => {
    try {
      await deleteDoc(doc(db, 'trainer_portfolio_items', itemId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `trainer_portfolio_items/${itemId}`);
    }
  };

  const handleAcceptAssignmentAgreement = async (ag: TrainerAssignmentAgreement) => {
    const signedBy = clampText(
      assignSignerName[ag.id] || corporateTrainerProfile?.fullName || currentUser.fullName,
      120
    );
    if (signedBy.length < 2) return;
    try {
      await updateDoc(doc(db, 'trainer_assignment_agreements', ag.id), {
        status: 'active',
        trainerAcceptedAt: new Date().toISOString(),
        trainerAcceptedName: signedBy,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `trainer_assignment_agreements/${ag.id}`
      );
    }
  };

  const handleProposalResponse = async (
    proposal: TrainingProposal,
    decision: 'accepted_by_trainer' | 'declined_by_trainer'
  ) => {
    try {
      await updateDoc(doc(db, 'training_proposals', proposal.id), {
        status: decision,
        trainerResponseNotes: clampText(
          proposalNotes[proposal.id] ||
            (decision === 'accepted_by_trainer'
              ? 'Confirmed availability and training outline.'
              : 'Unavailable on requested dates.'),
          500
        ),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `training_proposals/${proposal.id}`);
    }
  };

  const handleLogCorporateAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    const contract = trainingContracts.find((c) => c.id === attContractId);
    if (!contract) return;
    try {
      await addDoc(collection(db, 'training_attendance'), {
        contractId: contract.id,
        organizationId: contract.organizationId,
        organizationOwnerUid: contract.organizationOwnerUid,
        trainerUserId: currentUser.uid,
        sessionDate: attDate,
        presentCount: attPresent,
        totalParticipants: Math.max(1, attTotal),
        notes: clampText(attNotes, 600),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setAttNotes('');
      setAttContractId('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'training_attendance');
    }
  };

  const handleSubmitCorporateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    const contract = trainingContracts.find((c) => c.id === repContractId);
    if (!contract || !repSummary.trim() || !repOutcomes.trim()) return;
    try {
      await addDoc(collection(db, 'training_reports'), {
        contractId: contract.id,
        organizationId: contract.organizationId,
        organizationOwnerUid: contract.organizationOwnerUid,
        trainerUserId: currentUser.uid,
        trainerName: corporateTrainerProfile?.fullName || activeDisplayName,
        organizationName: contract.organizationName,
        summary: clampText(repSummary, 1500),
        outcomesAchieved: clampText(repOutcomes, 1000),
        attendanceRatePct: Math.min(100, Math.max(0, repAttendancePct)),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setRepSummary('');
      setRepOutcomes('');
      setRepContractId('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'training_reports');
    }
  };

  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    const ownerDocId = tutorProfile?.id || corporateTrainerProfile?.id;
    if (!ownerDocId || !docTitle.trim() || !docRef.trim()) return;
    try {
      await addDoc(collection(db, 'tutor_documents'), {
        tutorId: ownerDocId,
        userId: currentUser.uid,
        docType,
        title: clampText(docTitle, 160),
        referenceCode: clampText(docRef, 120),
        notes: 'Submitted via Educator / Trainer Dashboard',
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setDocTitle('');
      setDocRef('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tutor_documents');
    }
  };

  const toggleArr = (arr: string[], setArr: (v: string[]) => void, item: string) => {
    setArr(arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]);
  };

  const unreadCount = conversations.filter((c) => c.unreadByUids?.includes(currentUser.uid)).length;

  const navItems: { id: TutorTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <BookOpen className="w-4 h-4" /> },
    ...(tutorProfile
      ? [
          {
            id: 'bookings' as const,
            label: 'Tutoring Bookings',
            icon: <ClipboardList className="w-4 h-4" />,
          },
          {
            id: 'progress' as const,
            label: 'Session Progress',
            icon: <CalendarCheck className="w-4 h-4" />,
          },
        ]
      : []),
    {
      id: 'corporate',
      label: 'Corporate Training',
      icon: <Briefcase className="w-4 h-4" />,
    },
    {
      id: 'messages',
      label: unreadCount > 0 ? `Messages (${unreadCount})` : 'Messages',
      icon: <MessageSquare className="w-4 h-4" />,
    },
    { id: 'earnings', label: 'Earnings & Payouts', icon: <DollarSign className="w-4 h-4" /> },
    ...(tutorProfile
      ? [
          {
            id: 'profile' as const,
            label: 'Tutor Profile',
            icon: <UserCheck className="w-4 h-4" />,
          },
        ]
      : []),
    { id: 'credentials', label: 'Credentials & Reviews', icon: <Award className="w-4 h-4" /> },
  ];

  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <aside className="lg:col-span-3 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs font-semibold text-[#39836B]">Educator & Trainer Workspace</p>
            <h2 className="font-display text-lg font-bold text-[#142B46] mt-0.5 truncate">
              {activeDisplayName}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{activeStatusLabel}</p>
            {corporateTrainerProfile && tutorProfile && (
              <p className="text-xs text-slate-500 mt-0.5">
                Trainer: {corporateTrainerProfile.status}
              </p>
            )}

            <nav className="mt-5 space-y-1">
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
            </nav>

            <div className="mt-5 pt-4 border-t border-slate-200 space-y-2">
              {(!tutorProfile || !corporateTrainerProfile) && (
                <button
                  type="button"
                  onClick={() => onNavigate('become-tutor')}
                  className="w-full py-2 text-xs font-semibold bg-[#F5F7FA] text-[#142B46] rounded-lg hover:bg-slate-200"
                >
                  {!corporateTrainerProfile ? 'Add Corporate Trainer Track' : 'Add Individual Tutor Track'}
                </button>
              )}
              <button
                type="button"
                onClick={onSignOut}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-slate-600 hover:text-red-600"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        </aside>

        <main className="lg:col-span-9 space-y-6">
          {((tutorProfile && tutorProfile.status !== 'approved') ||
            (corporateTrainerProfile && corporateTrainerProfile.status !== 'approved')) && (
            <div className="bg-[#F5BD54]/20 border border-[#F5BD54] rounded-xl p-4 text-sm text-[#142B46]">
              <strong>Verification Notice:</strong>{' '}
              {tutorProfile && tutorProfile.status !== 'approved' && (
                <span>Tutor status: {tutorProfile.status.toUpperCase()}. </span>
              )}
              {corporateTrainerProfile && corporateTrainerProfile.status !== 'approved' && (
                <span>Corporate trainer status: {corporateTrainerProfile.status.toUpperCase()}. </span>
              )}
              Administrator approval is required before public discovery or corporate assignments.
            </div>
          )}

          {tab === 'overview' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs text-slate-500">Tutoring Bookings</p>
                <p className="font-mono-tabular text-2xl font-bold text-[#142B46] mt-1">
                  {bookings.filter((b) => b.status !== 'cancelled').length}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs text-slate-500">Corporate Proposals</p>
                <p className="font-mono-tabular text-2xl font-bold text-[#142B46] mt-1">
                  {trainingProposals.length}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs text-slate-500">Corporate Contracts</p>
                <p className="font-mono-tabular text-2xl font-bold text-[#142B46] mt-1">
                  {trainingContracts.length}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs text-slate-500">Total Net Earnings</p>
                <p className="font-mono-tabular text-2xl font-bold text-[#39836B] mt-1">
                  {(totalNetEarningsEtb + corporateEarningsEtb).toLocaleString()} ETB
                </p>
              </div>
            </div>
          )}

          {tab === 'bookings' && tutorProfile && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="font-display text-lg font-bold text-[#142B46]">
                Incoming Tutoring Requests & Assigned Students
              </h2>
              {bookings.length === 0 ? (
                <p className="text-sm text-slate-500">No bookings assigned yet.</p>
              ) : (
                <div className="space-y-4">
                  {bookings.map((b) => (
                    <div
                      key={b.id}
                      className="border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-[#39836B]">
                          {b.status.replace('_', ' ')} · Payment: {b.paymentStatus}
                        </p>
                        <h3 className="font-display font-bold text-[#142B46]">
                          {b.subject} — Student: {b.studentName}
                        </h3>
                        <p className="text-xs text-slate-600">
                          Parent: {b.parentName} · {b.locationNeighborhood} · {b.sessionCount}{' '}
                          sessions
                        </p>
                        <p className="text-xs text-slate-500">{b.scheduleSummary}</p>
                      </div>
                      <div className="flex flex-col sm:items-end gap-2">
                        <p className="font-mono-tabular font-bold text-[#142B46]">
                          Net: {b.tutorPayoutEtb.toLocaleString()} ETB
                        </p>
                        <div className="flex gap-2">
                          {b.status === 'pending_tutor' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleBookingTransition(b.id, 'pending_payment')}
                                className="px-3.5 py-2 bg-[#39836B] text-white text-xs font-semibold rounded-lg"
                              >
                                Accept Booking
                              </button>
                              <button
                                type="button"
                                onClick={() => handleBookingTransition(b.id, 'cancelled')}
                                className="px-3.5 py-2 border border-slate-300 text-slate-600 text-xs font-semibold rounded-lg"
                              >
                                Decline
                              </button>
                            </>
                          )}
                          {b.status === 'confirmed' && (
                            <button
                              type="button"
                              onClick={() => handleBookingTransition(b.id, 'completed')}
                              className="px-3.5 py-2 bg-[#142B46] text-white text-xs font-semibold rounded-lg"
                            >
                              Mark Completed
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'progress' && tutorProfile && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <h2 className="font-display text-lg font-bold text-[#142B46] mb-4">
                  Record Session Attendance & Progress Note
                </h2>
                <form onSubmit={handleLogProgress} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <select
                      required
                      value={reportBookingId}
                      onChange={(e) => setReportBookingId(e.target.value)}
                      className="px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white"
                    >
                      <option value="">Select Booking</option>
                      {bookings
                        .filter((b) => b.status === 'confirmed' || b.status === 'completed')
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.studentName} ({b.subject})
                          </option>
                        ))}
                    </select>
                    <input
                      type="date"
                      required
                      value={sessionDate}
                      onChange={(e) => setSessionDate(e.target.value)}
                      className="px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm font-mono-tabular"
                    />
                    <select
                      value={attendanceStatus}
                      onChange={(e) =>
                        setAttendanceStatus(e.target.value as 'present' | 'absent' | 'rescheduled')
                      }
                      className="px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white"
                    >
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="rescheduled">Rescheduled</option>
                    </select>
                  </div>
                  <textarea
                    rows={3}
                    required
                    maxLength={1000}
                    value={reportSummary}
                    onChange={(e) => setReportSummary(e.target.value)}
                    placeholder="Summarize topics covered, homework assigned, and student progress..."
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#142B46] text-white text-xs font-semibold rounded-lg"
                  >
                    Publish Report to Parent
                  </button>
                </form>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                <h3 className="font-display font-bold text-[#142B46]">Submitted Reports</h3>
                {progressReports.length === 0 ? (
                  <p className="text-sm text-slate-500">No session reports logged yet.</p>
                ) : (
                  progressReports.map((rep) => (
                    <div key={rep.id} className="p-4 border border-slate-200 rounded-lg space-y-1">
                      <p className="text-xs font-bold text-[#142B46]">
                        {rep.studentName} · {rep.subject} · {rep.sessionDate} ({rep.attendanceStatus})
                      </p>
                      <p className="text-xs text-slate-600">{rep.summary}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === 'corporate' && (
            <div className="space-y-6">
              {!corporateTrainerProfile ? (
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                  <h2 className="font-display text-lg font-bold text-[#142B46]">
                    Register as a Corporate Trainer
                  </h2>
                  <p className="text-xs text-slate-600">
                    Deliver customized staff workshops for Ethiopian companies, NGOs, schools, and
                    government institutions.
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate('become-tutor')}
                    className="px-4 py-2 bg-[#142B46] text-white text-xs font-semibold rounded-lg"
                  >
                    Apply for Corporate Trainer Track
                  </button>
                </div>
              ) : (
                <>
                  {/* Separate Trainer Assignment Agreements (Trainer ↔ TutorBridge) */}
                  <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                    <div>
                      <h2 className="font-display text-lg font-bold text-[#142B46]">
                        Trainer Assignment Agreements (TutorBridge Ethiopia)
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Your deployment scope, confidentiality, compensation, and Ethiopian-law
                        agreement are executed exclusively with TutorBridge Ethiopia.
                      </p>
                    </div>
                    {trainerAssignments.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        No separate trainer assignment agreements issued yet.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {trainerAssignments.map((ag) => (
                          <div
                            key={ag.id}
                            className="border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs"
                          >
                            <div className="flex flex-wrap justify-between gap-2">
                              <div>
                                <span className="font-bold text-sm text-[#142B46]">
                                  {ag.title}
                                </span>
                                <p className="text-slate-600">
                                  Client Context: {ag.organizationLabel} · Status:{' '}
                                  <span className="font-semibold text-[#39836B]">{ag.status}</span>
                                </p>
                              </div>
                              <span className="font-mono-tabular font-bold text-sm text-[#39836B]">
                                {ag.trainerCompensationEtb.toLocaleString()} ETB
                              </span>
                            </div>
                            <p className="text-slate-700 bg-[#F5F7FA] p-3 rounded-lg">
                              <strong>Scope of Work:</strong> {ag.scopeOfWork}
                            </p>
                            <p className="text-slate-600">
                              <strong>Schedule:</strong> {ag.scheduleSummary} ·{' '}
                              <strong>Payment Schedule:</strong> {ag.paymentSchedule}
                            </p>
                            <p className="text-slate-500">
                              <strong>Cancellation & Law:</strong> {ag.cancellationTerms} —{' '}
                              {ag.governingLawClause}
                            </p>
                            {ag.trainerAcceptedAt ? (
                              <p className="font-semibold text-[#39836B]">
                                Electronically accepted by {ag.trainerAcceptedName} on{' '}
                                {ag.trainerAcceptedAt.slice(0, 10)}
                              </p>
                            ) : (
                              ag.status === 'pending_acceptance' && (
                                <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2">
                                  <input
                                    type="text"
                                    maxLength={120}
                                    value={
                                      assignSignerName[ag.id] ??
                                      corporateTrainerProfile.fullName ??
                                      currentUser.fullName
                                    }
                                    onChange={(e) =>
                                      setAssignSignerName((prev) => ({
                                        ...prev,
                                        [ag.id]: e.target.value,
                                      }))
                                    }
                                    placeholder="Your Full Name (Electronic Signature)"
                                    className="flex-1 min-w-[200px] px-3 py-2 border border-slate-300 rounded-lg text-xs"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleAcceptAssignmentAgreement(ag)}
                                    className="px-4 py-2 bg-[#39836B] text-white font-semibold rounded-lg"
                                  >
                                    Accept Assignment Agreement
                                  </button>
                                </div>
                              )
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {trainerNegotiations.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                      <h3 className="font-display font-bold text-[#142B46]">
                        TutorBridge Compensation Negotiation Log
                      </h3>
                      {trainerNegotiations.map((neg) => (
                        <div
                          key={neg.id}
                          className="border border-slate-200 rounded-lg p-4 text-xs space-y-1"
                        >
                          <div className="flex justify-between">
                            <span className="font-mono-tabular font-bold text-[#142B46]">
                              Proposed Trainer Fee: {neg.proposedAmountEtb.toLocaleString()} ETB
                            </span>
                            <span className="font-semibold text-[#39836B]">{neg.status}</span>
                          </div>
                          <p className="text-slate-700">{neg.proposedTerms}</p>
                          {neg.notes && <p className="text-slate-500">Notes: {neg.notes}</p>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Incoming Training Proposals */}
                  <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                    <h2 className="font-display text-lg font-bold text-[#142B46]">
                      Corporate Training Proposals & Invitations
                    </h2>
                    {trainingProposals.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        No corporate training proposals assigned yet.
                      </p>
                    ) : (
                      trainingProposals.map((prop) => (
                        <div key={prop.id} className="border border-slate-200 rounded-xl p-4 space-y-3">
                          <div className="flex flex-wrap justify-between gap-2 text-xs">
                            <span className="font-bold text-[#142B46]">
                              Schedule: {prop.proposedSchedule}
                            </span>
                            <span className="font-semibold text-[#39836B]">{prop.status}</span>
                          </div>
                          <p className="text-xs text-slate-600">{prop.trainerMethodology}</p>
                          {prop.trainerResponseNotes && (
                            <p className="text-xs text-slate-500">
                              Your note: {prop.trainerResponseNotes}
                            </p>
                          )}
                          {prop.status === 'proposed' && (
                            <div className="space-y-2 pt-1">
                              <input
                                type="text"
                                value={proposalNotes[prop.id] || ''}
                                onChange={(e) =>
                                  setProposalNotes((prev) => ({
                                    ...prev,
                                    [prop.id]: e.target.value,
                                  }))
                                }
                                placeholder="Availability confirmation or outline notes (optional)"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleProposalResponse(prop, 'accepted_by_trainer')
                                  }
                                  className="px-4 py-2 bg-[#39836B] text-white text-xs font-semibold rounded-lg"
                                >
                                  Confirm Availability & Accept
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleProposalResponse(prop, 'declined_by_trainer')
                                  }
                                  className="px-4 py-2 border border-slate-300 text-slate-600 text-xs font-semibold rounded-lg"
                                >
                                  Decline
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Active Corporate Contracts & Schedules */}
                  <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                    <h3 className="font-display font-bold text-[#142B46]">
                      Assigned Training Programs & Schedules
                    </h3>
                    {trainingContracts.length === 0 ? (
                      <p className="text-sm text-slate-500">No active corporate contracts yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {trainingContracts.map((c) => {
                          const cScheds = trainingSchedules.filter((s) => s.contractId === c.id);
                          return (
                            <div key={c.id} className="border border-slate-200 rounded-xl p-4 space-y-2">
                              <div className="flex flex-wrap justify-between gap-2 text-xs">
                                <span className="font-bold text-[#142B46]">
                                  {c.organizationName} — {c.title}
                                </span>
                                <span className="font-mono-tabular font-bold text-[#39836B]">
                                  Trainer Compensation: {c.trainerCompensationEtb.toLocaleString()}{' '}
                                  ETB
                                </span>
                              </div>
                              {cScheds.length > 0 && (
                                <div className="bg-[#F5F7FA] rounded-lg p-3 space-y-1 text-xs">
                                  {cScheds.map((s) => (
                                    <p key={s.id} className="text-slate-700 font-mono-tabular">
                                      • {s.sessionDate} ({s.timeRange}) — {s.sessionTitle} @ {s.venue}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Log Corporate Attendance & Completion Report */}
                  {trainingContracts.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                        <h3 className="font-display font-bold text-[#142B46]">
                          Log Workshop Attendance
                        </h3>
                        <form onSubmit={handleLogCorporateAttendance} className="space-y-3">
                          <select
                            required
                            value={attContractId}
                            onChange={(e) => setAttContractId(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                          >
                            <option value="">Select Contract</option>
                            {trainingContracts.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.organizationName} — {c.title}
                              </option>
                            ))}
                          </select>
                          <div className="grid grid-cols-3 gap-2">
                            <input
                              type="date"
                              required
                              value={attDate}
                              onChange={(e) => setAttDate(e.target.value)}
                              className="px-2.5 py-2 border border-slate-300 rounded-lg text-xs font-mono-tabular"
                            />
                            <input
                              type="number"
                              min={0}
                              required
                              value={attPresent}
                              onChange={(e) => setAttPresent(Number(e.target.value) || 0)}
                              placeholder="Present"
                              className="px-2.5 py-2 border border-slate-300 rounded-lg text-xs tabular-nums"
                            />
                            <input
                              type="number"
                              min={1}
                              required
                              value={attTotal}
                              onChange={(e) => setAttTotal(Number(e.target.value) || 1)}
                              placeholder="Total"
                              className="px-2.5 py-2 border border-slate-300 rounded-lg text-xs tabular-nums"
                            />
                          </div>
                          <input
                            type="text"
                            maxLength={600}
                            value={attNotes}
                            onChange={(e) => setAttNotes(e.target.value)}
                            placeholder="Session notes (optional)"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                          />
                          <button
                            type="submit"
                            className="px-4 py-2 bg-[#142B46] text-white text-xs font-semibold rounded-lg"
                          >
                            Save Attendance Log
                          </button>
                        </form>
                        {trainingAttendance.length > 0 && (
                          <div className="pt-2 border-t border-slate-100 space-y-1 text-xs">
                            {trainingAttendance.map((a) => (
                              <p key={a.id} className="text-slate-600 font-mono-tabular">
                                {a.sessionDate}: {a.presentCount}/{a.totalParticipants} present
                              </p>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                        <h3 className="font-display font-bold text-[#142B46]">
                          Submit Training Completion Report
                        </h3>
                        <form onSubmit={handleSubmitCorporateReport} className="space-y-3">
                          <select
                            required
                            value={repContractId}
                            onChange={(e) => setRepContractId(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                          >
                            <option value="">Select Contract</option>
                            {trainingContracts.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.organizationName} — {c.title}
                              </option>
                            ))}
                          </select>
                          <textarea
                            rows={2}
                            required
                            minLength={5}
                            maxLength={1500}
                            value={repSummary}
                            onChange={(e) => setRepSummary(e.target.value)}
                            placeholder="Program summary & modules delivered..."
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                          />
                          <textarea
                            rows={2}
                            required
                            minLength={5}
                            maxLength={1000}
                            value={repOutcomes}
                            onChange={(e) => setRepOutcomes(e.target.value)}
                            placeholder="Key outcomes & participant competencies achieved..."
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                          />
                          <div className="flex items-center gap-3">
                            <label className="text-xs font-semibold text-[#142B46]">
                              Attendance %
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              required
                              value={repAttendancePct}
                              onChange={(e) => setRepAttendancePct(Number(e.target.value) || 0)}
                              className="w-24 px-3 py-1.5 border border-slate-300 rounded-lg text-xs tabular-nums"
                            />
                            <button
                              type="submit"
                              className="ml-auto px-4 py-2 bg-[#39836B] text-white text-xs font-semibold rounded-lg"
                            >
                              Publish Completion Report
                            </button>
                          </div>
                        </form>
                        {trainingReports.length > 0 && (
                          <div className="pt-2 border-t border-slate-100 space-y-1 text-xs">
                            {trainingReports.map((r) => (
                              <p key={r.id} className="text-slate-600">
                                <strong>{r.organizationName}</strong> ({r.attendanceRatePct}%):{' '}
                                {r.summary}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Portfolio Samples & Curriculum Manager */}
                  <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                    <div>
                      <h3 className="font-display font-bold text-[#142B46] inline-flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-[#39836B]" />
                        Approved Portfolio Samples & Curriculum Outlines
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Submitted curriculum samples require administrator approval before appearing
                        to organizations in the Corporate Trainer Directory. Never include phone
                        numbers, emails, or external links.
                      </p>
                    </div>

                    <form onSubmit={handleAddPortfolioItem} className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          required
                          minLength={2}
                          maxLength={160}
                          value={portTitle}
                          onChange={(e) => setPortTitle(e.target.value)}
                          placeholder="Curriculum / Sample Title (e.g., 3-Day Power Query Workshop)"
                          className="px-3 py-2 border border-slate-300 rounded-lg text-xs"
                        />
                        <select
                          value={portCategory}
                          onChange={(e) => setPortCategory(e.target.value)}
                          className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                        >
                          {CORPORATE_TRAINING_CATEGORIES.map((c) => (
                            <option key={c.name} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <textarea
                        rows={2}
                        required
                        minLength={5}
                        maxLength={1500}
                        value={portSummary}
                        onChange={(e) => setPortSummary(e.target.value)}
                        placeholder="Summarize modules, hands-on exercises, and target audience..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                      />
                      <input
                        type="text"
                        maxLength={400}
                        value={portMetrics}
                        onChange={(e) => setPortMetrics(e.target.value)}
                        placeholder="Verified Outcome Metrics (optional, e.g., 94% assessment pass rate)"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                      />
                      {portErr && <p className="text-xs text-red-600 font-semibold">{portErr}</p>}
                      <button
                        type="submit"
                        className="px-4 py-2 bg-[#142B46] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Submit Portfolio Sample for Approval
                      </button>
                    </form>

                    {portfolioItems.length > 0 && (
                      <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                        {portfolioItems.map((item) => (
                          <div
                            key={item.id}
                            className="border border-slate-200 rounded-lg p-3 flex items-start justify-between gap-3"
                          >
                            <div className="space-y-0.5">
                              <p className="font-bold text-[#142B46]">
                                {item.title}{' '}
                                <span className="text-[#39836B] font-semibold">
                                  [{item.status}]
                                </span>
                              </p>
                              <p className="text-slate-600">{item.summary}</p>
                              {item.outcomeMetrics && (
                                <p className="text-slate-500">Outcomes: {item.outcomeMetrics}</p>
                              )}
                              {item.adminNotes && (
                                <p className="text-[#142B46] font-medium">
                                  Admin Note: {item.adminNotes}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeletePortfolioItem(item.id)}
                              className="text-slate-400 hover:text-red-600"
                              aria-label="Delete portfolio sample"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Edit Corporate Trainer Profile */}
                  <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                    <div>
                      <h3 className="font-display font-bold text-[#142B46]">
                        Corporate Trainer Profile, Projects & Availability
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Verified qualifications ({corporateTrainerProfile.qualifications}) are locked
                        and require administrator approval to update. Your daily rate is confidential
                        and never shared with organizations.
                      </p>
                    </div>
                    <form onSubmit={handleSaveTrainerProfile} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#142B46] mb-1">
                          Professional Headline
                        </label>
                        <input
                          type="text"
                          required
                          minLength={4}
                          maxLength={160}
                          value={trainerHeadline}
                          onChange={(e) => setTrainerHeadline(e.target.value)}
                          className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#142B46] mb-1">
                          Professional Biography
                        </label>
                        <textarea
                          rows={2}
                          maxLength={2000}
                          value={trainerBio}
                          onChange={(e) => setTrainerBio(e.target.value)}
                          placeholder="Summarize your corporate training specialization and impact..."
                          className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#142B46] mb-1">
                          Work Experience Summary
                        </label>
                        <textarea
                          rows={2}
                          maxLength={1500}
                          value={trainerWorkExp}
                          onChange={(e) => setTrainerWorkExp(e.target.value)}
                          placeholder="Outline institutional workshops, sectors served, and leadership experience..."
                          className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#142B46] mb-1">
                          Training Methodology & Teaching Approach
                        </label>
                        <textarea
                          rows={3}
                          required
                          minLength={10}
                          maxLength={1500}
                          value={trainerMethodology}
                          onChange={(e) => setTrainerMethodology(e.target.value)}
                          className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#142B46] mb-1">
                          Previous Corporate Projects (one per line, max 120 chars each)
                        </label>
                        <textarea
                          rows={2}
                          value={trainerPastProjectsText}
                          onChange={(e) => setTrainerPastProjectsText(e.target.value)}
                          placeholder="e.g., Financial Excel Cohort for 80 Bank Staff (2025)"
                          className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-[#142B46] mb-1">
                            Published Availability
                          </label>
                          <input
                            type="text"
                            required
                            minLength={2}
                            maxLength={200}
                            value={trainerAvailability}
                            onChange={(e) => setTrainerAvailability(e.target.value)}
                            className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#142B46] mb-1">
                            Languages Spoken (comma-separated)
                          </label>
                          <input
                            type="text"
                            value={trainerLanguagesText}
                            onChange={(e) => setTrainerLanguagesText(e.target.value)}
                            className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#142B46] mb-1">
                            Confidential Daily Rate (ETB — Admin Only)
                          </label>
                          <input
                            type="number"
                            min={500}
                            max={250000}
                            value={trainerDailyRate}
                            onChange={(e) => setTrainerDailyRate(Number(e.target.value) || 5000)}
                            className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm tabular-nums"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#142B46] mb-1">
                          Request Qualification / Certification Update (Requires Admin Verification)
                        </label>
                        <input
                          type="text"
                          maxLength={600}
                          value={trainerPendingQual}
                          onChange={(e) => setTrainerPendingQual(e.target.value)}
                          placeholder="Enter new degree, license, or certification for admin review..."
                          className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {ADDIS_SUB_CITIES.map((sc) => (
                          <button
                            key={sc}
                            type="button"
                            onClick={() => toggleArr(trainerLocations, setTrainerLocations, sc)}
                            className={`px-3 py-1.5 text-xs rounded-lg border ${
                              trainerLocations.includes(sc)
                                ? 'bg-[#142B46] text-white border-[#142B46]'
                                : 'bg-white text-slate-600 border-slate-300'
                            }`}
                          >
                            {sc}
                          </button>
                        ))}
                      </div>
                      {trainerProfileErr && (
                        <p className="text-xs text-red-600 font-semibold">{trainerProfileErr}</p>
                      )}
                      <div className="flex items-center gap-3">
                        <button
                          type="submit"
                          className="px-4 py-2 bg-[#142B46] text-white text-xs font-semibold rounded-lg"
                        >
                          Save Trainer Profile
                        </button>
                        {trainerSaved && (
                          <span className="text-xs font-semibold text-[#39836B] inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                          </span>
                        )}
                      </div>
                    </form>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === 'earnings' && (
            <div className="space-y-6">
              {tutorProfile && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <div>
                    <h2 className="font-display text-lg font-bold text-[#142B46]">
                      Tutoring Earnings & 15% Commission Ledger
                    </h2>
                    <p className="text-xs text-slate-500">
                      Gross: {totalGrossEtb.toLocaleString()} ETB · Commission (15%):{' '}
                      {totalCommissionEtb.toLocaleString()} ETB · Net Payout:{' '}
                      {totalNetEarningsEtb.toLocaleString()} ETB
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-2.5 pr-4">Student / Subject</th>
                          <th className="py-2.5 pr-4 text-right">Gross (ETB)</th>
                          <th className="py-2.5 pr-4 text-right">15% Fee</th>
                          <th className="py-2.5 pr-4 text-right">Your Earnings (85%)</th>
                          <th className="py-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {bookings.map((b) => (
                          <tr key={b.id}>
                            <td className="py-3 pr-4 font-semibold text-[#142B46]">
                              {b.studentName} · {b.subject}
                            </td>
                            <td className="py-3 pr-4 text-right font-mono-tabular">
                              {b.totalAmountEtb.toLocaleString()}
                            </td>
                            <td className="py-3 pr-4 text-right font-mono-tabular text-slate-500">
                              -{b.commissionAmountEtb.toLocaleString()}
                            </td>
                            <td className="py-3 pr-4 text-right font-mono-tabular font-bold text-[#39836B]">
                              {b.tutorPayoutEtb.toLocaleString()}
                            </td>
                            <td className="py-3">{b.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {corporateTrainerProfile && (
                <div className="space-y-6">
                  <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                    <div>
                      <h2 className="font-display text-lg font-bold text-[#142B46]">
                        Corporate Training Compensation
                      </h2>
                      <p className="text-xs text-slate-500">
                        Total Contracted Trainer Compensation:{' '}
                        <span className="font-mono-tabular font-bold text-[#39836B]">
                          {corporateEarningsEtb.toLocaleString()} ETB
                        </span>
                      </p>
                    </div>
                    {trainingContracts.length === 0 ? (
                      <p className="text-xs text-slate-500">No corporate contracts recorded yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                              <th className="py-2.5 pr-4">Program & Client Context</th>
                              <th className="py-2.5 pr-4 text-right">Trainer Compensation (ETB)</th>
                              <th className="py-2.5">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {trainingContracts.map((c) => (
                              <tr key={c.id}>
                                <td className="py-3 pr-4 font-semibold text-[#142B46]">
                                  {c.organizationName} — {c.title}
                                </td>
                                <td className="py-3 pr-4 text-right font-mono-tabular font-bold text-[#39836B]">
                                  {c.trainerCompensationEtb.toLocaleString()}
                                </td>
                                <td className="py-3">{c.status}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                    <h3 className="font-display font-bold text-[#142B46]">
                      Corporate Trainer Payout Ledger
                    </h3>
                    {trainerCompensations.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        No disbursement payouts scheduled yet.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                              <th className="py-2.5 pr-4">Method & Reference</th>
                              <th className="py-2.5 pr-4 text-right">Amount (ETB)</th>
                              <th className="py-2.5 pr-4">Status</th>
                              <th className="py-2.5">Paid Date / Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {trainerCompensations.map((rec) => (
                              <tr key={rec.id}>
                                <td className="py-3 pr-4 font-mono-tabular font-semibold text-[#142B46]">
                                  {rec.paymentMethod} · {rec.transactionRef}
                                </td>
                                <td className="py-3 pr-4 text-right font-mono-tabular font-bold text-[#39836B]">
                                  {rec.amountEtb.toLocaleString()}
                                </td>
                                <td className="py-3 pr-4 font-semibold">{rec.status}</td>
                                <td className="py-3 text-slate-600">
                                  {rec.paidDate || 'Scheduled'}
                                  {rec.notes ? ` — ${rec.notes}` : ''}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'profile' && tutorProfile && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div>
                <h2 className="font-display text-lg font-bold text-[#142B46]">
                  Edit Public Teaching Profile & Availability
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Verified qualifications ({tutorProfile.qualifications}) are locked and require
                  administrator review to change.
                </p>
              </div>
              <form onSubmit={handleSaveTutorProfile} className="space-y-4">
                <input
                  type="text"
                  required
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm"
                />
                <textarea
                  rows={4}
                  required
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm"
                />
                <div>
                  <label className="block text-xs font-semibold text-[#142B46] mb-1">
                    Hourly Rate (ETB)
                  </label>
                  <input
                    type="number"
                    min={150}
                    max={10000}
                    value={rate}
                    onChange={(e) => setRate(Number(e.target.value) || 400)}
                    className="w-48 px-3.5 py-2 border border-slate-300 rounded-lg text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#142B46] mb-1.5">
                    Available Days
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABILITY_DAYS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleArr(days, setDays, d)}
                        className={`px-3 py-1.5 text-xs rounded-lg border ${
                          days.includes(d)
                            ? 'bg-[#39836B] text-white border-[#39836B]'
                            : 'bg-white text-slate-600 border-slate-300'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#142B46] mb-1.5">
                    Teaching Sub-Cities
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {ADDIS_SUB_CITIES.map((sc) => (
                      <button
                        key={sc}
                        type="button"
                        onClick={() => toggleArr(subCities, setSubCities, sc)}
                        className={`px-3 py-1.5 text-xs rounded-lg border ${
                          subCities.includes(sc)
                            ? 'bg-[#142B46] text-white border-[#142B46]'
                            : 'bg-white text-slate-600 border-slate-300'
                        }`}
                      >
                        {sc}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#142B46] text-white text-xs font-semibold rounded-lg"
                  >
                    Save Profile Updates
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

          {tab === 'credentials' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-[#142B46]">
                  Submitted Verification Credentials
                </h2>
                {tutorDocuments.length === 0 ? (
                  <p className="text-sm text-slate-500">No credentials submitted yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {tutorDocuments.map((d) => (
                      <div key={d.id} className="py-3 flex justify-between text-xs">
                        <div>
                          <p className="font-bold text-[#142B46]">
                            {d.title} ({d.docType})
                          </p>
                          <p className="font-mono-tabular text-slate-500">Ref: {d.referenceCode}</p>
                        </div>
                        <span className="font-semibold text-[#39836B]">{d.status}</span>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleUploadDoc} className="pt-4 border-t border-slate-200 space-y-3">
                  <h3 className="text-xs font-bold text-[#142B46]">Add Supporting Credential</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <select
                      value={docType}
                      onChange={(e) => setDocType(e.target.value as TutorDocument['docType'])}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                    >
                      <option value="teaching_license">Teaching / Trainer License</option>
                      <option value="degree_certificate">Degree Certificate</option>
                      <option value="reference_letter">Reference Letter</option>
                      <option value="national_id">National ID</option>
                    </select>
                    <input
                      type="text"
                      required
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                      placeholder="Document Title"
                      className="px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                    <input
                      type="text"
                      required
                      value={docRef}
                      onChange={(e) => setDocRef(e.target.value)}
                      placeholder="Serial / Reference Code"
                      className="px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#142B46] text-white text-xs font-semibold rounded-lg"
                  >
                    Submit for Admin Verification
                  </button>
                </form>
              </div>

              {tutorProfile && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                  <h3 className="font-display font-bold text-[#142B46]">Parent Reviews</h3>
                  {tutorReviews.length === 0 ? (
                    <p className="text-sm text-slate-500">No parent reviews recorded yet.</p>
                  ) : (
                    tutorReviews.map((rev) => (
                      <div key={rev.id} className="p-3 bg-[#F5F7FA] rounded-lg text-xs space-y-1">
                        <p className="font-bold text-[#142B46]">
                          {rev.authorName} · {rev.rating}/5
                        </p>
                        <p className="text-slate-600">{rev.comment}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
          {tab === 'messages' && (
            <MessagingCenter
              currentUser={currentUser}
              roleContext="tutor"
              conversations={conversations}
              messages={messages}
              restriction={messagingRestriction}
              violations={userViolations}
              bookings={bookings}
              trainingContracts={trainingContracts}
              trainingProposals={trainingProposals}
            />
          )}
        </main>
      </div>
    </div>
  );
};
