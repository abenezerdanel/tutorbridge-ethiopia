import React, { useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Heart,
  LogOut,
  MessageSquare,
  Plus,
  ShieldAlert,
  Star,
  User,
  Users,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  ADDIS_SUB_CITIES,
  AppRoute,
  Booking,
  Conversation,
  GRADE_LEVELS,
  MAX_TEXT_LENGTHS,
  Message,
  MessagingRestriction,
  PaymentRecord,
  ProgressReport,
  StudentProfile,
  SupportTicket,
  TutorProfile,
  TutorRequest,
  UserAccount,
  UserViolation,
  clampText,
} from '../types';
import { MessagingCenter } from './MessagingCenter';

interface ParentDashboardProps {
  currentUser: UserAccount;
  students: StudentProfile[];
  bookings: Booking[];
  payments: PaymentRecord[];
  tutorRequests: TutorRequest[];
  progressReports: ProgressReport[];
  supportTickets: SupportTicket[];
  tutors: TutorProfile[];
  favoriteIds: string[];
  conversations: Conversation[];
  messages: Message[];
  messagingRestriction: MessagingRestriction | null;
  userViolations: UserViolation[];
  initialConversationId?: string | null;
  onSignOut: () => void;
  onNavigate: (route: AppRoute) => void;
  onSelectTutor: (tutor: TutorProfile) => void;
  onBookTutor: (tutor: TutorProfile) => void;
}

type ParentTab =
  | 'overview'
  | 'students'
  | 'bookings'
  | 'matching'
  | 'messages'
  | 'progress'
  | 'favorites'
  | 'support'
  | 'profile';

export const ParentDashboard: React.FC<ParentDashboardProps> = ({
  currentUser,
  students,
  bookings,
  payments,
  tutorRequests,
  progressReports,
  supportTickets,
  tutors,
  favoriteIds,
  conversations,
  messages,
  messagingRestriction,
  userViolations,
  initialConversationId = null,
  onSignOut,
  onNavigate,
  onSelectTutor,
  onBookTutor,
}) => {
  const [tab, setTab] = useState<ParentTab>(initialConversationId ? 'messages' : 'overview');

  // Add student state
  const [stName, setStName] = useState('');
  const [stAge, setStAge] = useState(12);
  const [stGrade, setStGrade] = useState<string>(GRADE_LEVELS[1]);
  const [stSchool, setStSchool] = useState('');
  const [stSubjects, setStSubjects] = useState('Mathematics, English');
  const [stGoals, setStGoals] = useState('');
  const [stSchedule, setStSchedule] = useState('Weekdays after 4:00 PM');
  const [stConsent, setStConsent] = useState(false);
  const [savingStudent, setSavingStudent] = useState(false);

  // Payment submission modal state
  const [payingBooking, setPayingBooking] = useState<Booking | null>(null);
  const [payMethod, setPayMethod] = useState<'Telebirr' | 'CBE Birr' | 'Bank Transfer'>('Telebirr');
  const [payRef, setPayRef] = useState('');
  const [submittingPay, setSubmittingPay] = useState(false);

  // Review state
  const [reviewingBooking, setReviewingBooking] = useState<Booking | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  // Parent progress comment state
  const [commentMap, setCommentMap] = useState<Record<string, string>>({});

  // Support ticket state
  const [ticketCategory, setTicketCategory] = useState<
    'general' | 'payment' | 'reschedule' | 'safeguarding'
  >('general');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');

  // Account edit state
  const [accName, setAccName] = useState(currentUser.fullName);
  const [accPhone, setAccPhone] = useState(currentUser.phone || '');
  const [accSubCity, setAccSubCity] = useState(currentUser.subCity || 'Bole');
  const [profileSaved, setProfileSaved] = useState(false);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stConsent) return;
    const subjectsNeeded = stSubjects
      .split(',')
      .map((s) => clampText(s, 60))
      .filter(Boolean)
      .slice(0, 12);
    if (subjectsNeeded.length === 0) return;

    setSavingStudent(true);
    try {
      await addDoc(collection(db, 'students'), {
        parentId: currentUser.uid,
        fullName: clampText(stName, MAX_TEXT_LENGTHS.fullName),
        age: stAge,
        gradeLevel: stGrade,
        schoolName: clampText(stSchool, 120),
        subjectsNeeded,
        learningGoals: clampText(stGoals, 600),
        preferredSchedule: clampText(stSchedule, 200),
        parentConsent: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setStName('');
      setStSchool('');
      setStGoals('');
      setStConsent(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'students');
    } finally {
      setSavingStudent(false);
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    try {
      await deleteDoc(doc(db, 'students', studentId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `students/${studentId}`);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    try {
      await updateDoc(doc(db, 'bookings', bookingId), {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bookings/${bookingId}`);
    }
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingBooking || !payRef.trim()) return;
    setSubmittingPay(true);
    try {
      await addDoc(collection(db, 'payments'), {
        bookingId: payingBooking.id,
        parentId: currentUser.uid,
        tutorId: payingBooking.tutorId,
        tutorUserId: payingBooking.tutorUserId,
        method: payMethod,
        transactionRef: clampText(payRef, MAX_TEXT_LENGTHS.transactionRef),
        amountEtb: payingBooking.totalAmountEtb,
        commissionEtb: payingBooking.commissionAmountEtb,
        tutorPayoutEtb: payingBooking.tutorPayoutEtb,
        status: 'pending_verification',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'bookings', payingBooking.id), {
        paymentStatus: 'submitted',
        updatedAt: serverTimestamp(),
      });
      setPayingBooking(null);
      setPayRef('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'payments');
    } finally {
      setSubmittingPay(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingBooking || !reviewComment.trim()) return;
    try {
      await addDoc(collection(db, 'reviews'), {
        bookingId: reviewingBooking.id,
        tutorId: reviewingBooking.tutorId,
        parentId: currentUser.uid,
        authorName: clampText(currentUser.fullName, 100),
        rating: reviewRating,
        comment: clampText(reviewComment, MAX_TEXT_LENGTHS.comment),
        createdAt: serverTimestamp(),
      });
      setReviewingBooking(null);
      setReviewComment('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'reviews');
    }
  };

  const handleApproveMatch = async (req: TutorRequest) => {
    try {
      await updateDoc(doc(db, 'tutor_requests', req.id), {
        status: 'matched',
        updatedAt: serverTimestamp(),
      });
      const proposed = tutors.find((t) => t.id === req.proposedTutorId);
      if (proposed) {
        onBookTutor(proposed);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tutor_requests/${req.id}`);
    }
  };

  const handleSaveParentComment = async (reportId: string) => {
    const text = commentMap[reportId]?.trim();
    if (!text) return;
    try {
      await updateDoc(doc(db, 'progress_reports', reportId), {
        parentComment: clampText(text, 500),
        updatedAt: serverTimestamp(),
      });
      setCommentMap((prev) => ({ ...prev, [reportId]: '' }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `progress_reports/${reportId}`);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'support_tickets'), {
        userId: currentUser.uid,
        userName: clampText(currentUser.fullName, MAX_TEXT_LENGTHS.fullName),
        category: ticketCategory,
        subject: clampText(ticketSubject, 160),
        message: clampText(ticketMessage, 1500),
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setTicketSubject('');
      setTicketMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'support_tickets');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        fullName: clampText(accName, MAX_TEXT_LENGTHS.fullName),
        phone: clampText(accPhone, 40),
        city: 'Addis Ababa',
        subCity: accSubCity,
        updatedAt: serverTimestamp(),
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${currentUser.uid}`);
    }
  };

  const favoriteTutors = tutors.filter((t) => favoriteIds.includes(t.id));

  const unreadCount = conversations.filter((c) => c.unreadByUids?.includes(currentUser.uid)).length;

  const navItems: { id: ParentTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'students', label: 'My Students', icon: <Users className="w-4 h-4" /> },
    { id: 'bookings', label: 'Bookings & Payments', icon: <CreditCard className="w-4 h-4" /> },
    {
      id: 'messages',
      label: unreadCount > 0 ? `Messages (${unreadCount})` : 'Messages',
      icon: <MessageSquare className="w-4 h-4" />,
    },
    { id: 'matching', label: 'Matching Requests', icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'progress', label: 'Learning Progress', icon: <Calendar className="w-4 h-4" /> },
    { id: 'favorites', label: 'Saved Tutors', icon: <Heart className="w-4 h-4" /> },
    { id: 'support', label: 'Support & Safeguarding', icon: <ShieldAlert className="w-4 h-4" /> },
    { id: 'profile', label: 'Account Settings', icon: <User className="w-4 h-4" /> },
  ];

  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar */}
        <aside className="lg:col-span-3 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs font-semibold text-[#39836B]">Parent & Student Portal</p>
            <h2 className="font-display text-lg font-bold text-[#142B46] mt-0.5 truncate">
              {currentUser.fullName}
            </h2>
            <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>

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
              <button
                type="button"
                onClick={() => onNavigate('tutors')}
                className="w-full py-2 px-3 bg-[#F5BD54] text-[#142B46] text-xs font-bold rounded-lg hover:bg-[#e5ad43]"
              >
                Find a New Tutor
              </button>
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

        {/* Main Content */}
        <main className="lg:col-span-9 space-y-6">
          {tab === 'overview' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-500">Registered Students</p>
                  <p className="font-mono-tabular text-2xl font-bold text-[#142B46] mt-1">
                    {students.length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-500">Active & Pending Bookings</p>
                  <p className="font-mono-tabular text-2xl font-bold text-[#142B46] mt-1">
                    {bookings.filter((b) => b.status !== 'cancelled').length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-500">Matching Requests</p>
                  <p className="font-mono-tabular text-2xl font-bold text-[#142B46] mt-1">
                    {tutorRequests.length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-500">Progress Reports</p>
                  <p className="font-mono-tabular text-2xl font-bold text-[#39836B] mt-1">
                    {progressReports.length}
                  </p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-bold text-[#142B46]">
                    Recent Bookings
                  </h3>
                  <button
                    type="button"
                    onClick={() => setTab('bookings')}
                    className="text-xs font-semibold text-[#142B46] underline"
                  >
                    Manage All
                  </button>
                </div>
                {bookings.length === 0 ? (
                  <div className="py-6 text-center space-y-3">
                    <p className="text-sm text-slate-600">
                      No tutoring bookings yet. Browse verified educators or request managed
                      matching.
                    </p>
                    <div className="flex justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => onNavigate('tutors')}
                        className="px-4 py-2 bg-[#142B46] text-white text-xs font-semibold rounded-lg"
                      >
                        Browse Tutors
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate('request-matching')}
                        className="px-4 py-2 bg-[#F5BD54] text-[#142B46] text-xs font-bold rounded-lg"
                      >
                        Request Matching
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {bookings.slice(0, 4).map((b) => (
                      <div
                        key={b.id}
                        className="py-3.5 flex flex-wrap items-center justify-between gap-3 text-sm"
                      >
                        <div>
                          <p className="font-semibold text-[#142B46]">
                            {b.subject} · {b.tutorName}
                          </p>
                          <p className="text-xs text-slate-500">
                            Student: {b.studentName} · {b.sessionCount} sessions ·{' '}
                            {b.locationNeighborhood}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono-tabular font-semibold text-[#142B46]">
                            {b.totalAmountEtb.toLocaleString()} ETB
                          </p>
                          <p className="text-xs text-slate-500">
                            Status: {b.status.replace('_', ' ')} · Payment: {b.paymentStatus}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'students' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <h2 className="font-display text-lg font-bold text-[#142B46] mb-4 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[#39836B]" />
                  Add Student / Child Profile
                </h2>
                <form onSubmit={handleAddStudent} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <input
                      type="text"
                      required
                      maxLength={MAX_TEXT_LENGTHS.fullName}
                      value={stName}
                      onChange={(e) => setStName(e.target.value)}
                      placeholder="Student Full Name"
                      className="px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm"
                    />
                    <input
                      type="number"
                      min={3}
                      max={65}
                      required
                      value={stAge}
                      onChange={(e) => setStAge(Number(e.target.value) || 10)}
                      placeholder="Age"
                      className="px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm tabular-nums"
                    />
                    <select
                      value={stGrade}
                      onChange={(e) => setStGrade(e.target.value)}
                      className="px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white"
                    >
                      {GRADE_LEVELS.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input
                      type="text"
                      maxLength={120}
                      value={stSchool}
                      onChange={(e) => setStSchool(e.target.value)}
                      placeholder="School Name (Optional)"
                      className="px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm"
                    />
                    <input
                      type="text"
                      required
                      value={stSubjects}
                      onChange={(e) => setStSubjects(e.target.value)}
                      placeholder="Subjects needed (comma-separated)"
                      className="px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input
                      type="text"
                      maxLength={200}
                      value={stSchedule}
                      onChange={(e) => setStSchedule(e.target.value)}
                      placeholder="Preferred Schedule"
                      className="px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm"
                    />
                    <input
                      type="text"
                      maxLength={600}
                      value={stGoals}
                      onChange={(e) => setStGoals(e.target.value)}
                      placeholder="Learning Goals"
                      className="px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      required
                      checked={stConsent}
                      onChange={(e) => setStConsent(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-[#142B46]"
                    />
                    <span>
                      I confirm that I am the parent or legal guardian and give consent to store
                      this student profile privately for TutorBridge matching and progress tracking.
                    </span>
                  </label>
                  <button
                    type="submit"
                    disabled={savingStudent}
                    className="px-5 py-2.5 bg-[#142B46] text-white text-xs font-semibold rounded-lg"
                  >
                    {savingStudent ? 'Saving...' : 'Save Student Profile'}
                  </button>
                </form>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <h3 className="font-display text-lg font-bold text-[#142B46] mb-4">
                  Saved Student Profiles ({students.length})
                </h3>
                {students.length === 0 ? (
                  <p className="text-sm text-slate-500">No student profiles added yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {students.map((st) => (
                      <div key={st.id} className="py-4 flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <p className="font-bold text-sm text-[#142B46]">
                            {st.fullName} · Age {st.age} · {st.gradeLevel}
                          </p>
                          <p className="text-xs text-slate-600">
                            Subjects: {st.subjectsNeeded.join(', ')}
                            {st.schoolName ? ` · School: ${st.schoolName}` : ''}
                          </p>
                          {st.learningGoals && (
                            <p className="text-xs text-slate-500">{st.learningGoals}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteStudent(st.id)}
                          className="text-xs font-semibold text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'bookings' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-[#142B46]">
                  Bookings & Manual Payments
                </h2>
                {bookings.length === 0 ? (
                  <p className="text-sm text-slate-500">No bookings created yet.</p>
                ) : (
                  <div className="space-y-4">
                    {bookings.map((b) => (
                      <div
                        key={b.id}
                        className="border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-[#39836B]">
                            Status: {b.status.replace('_', ' ')} · Payment: {b.paymentStatus}
                          </p>
                          <h3 className="font-display text-base font-bold text-[#142B46]">
                            {b.subject} with {b.tutorName}
                          </h3>
                          <p className="text-xs text-slate-600">
                            Student: {b.studentName} · {b.sessionCount} sessions ·{' '}
                            {b.locationNeighborhood}
                          </p>
                          <p className="text-xs text-slate-500">Schedule: {b.scheduleSummary}</p>
                        </div>
                        <div className="flex flex-col sm:items-end gap-2">
                          <p className="font-mono-tabular text-lg font-bold text-[#142B46]">
                            {b.totalAmountEtb.toLocaleString()} ETB
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {b.status === 'pending_payment' && b.paymentStatus === 'unpaid' && (
                              <button
                                type="button"
                                onClick={() => setPayingBooking(b)}
                                className="px-3.5 py-2 bg-[#F5BD54] text-[#142B46] text-xs font-bold rounded-lg"
                              >
                                Submit Payment Reference
                              </button>
                            )}
                            {(b.status === 'pending_tutor' || b.status === 'pending_payment') && (
                              <button
                                type="button"
                                onClick={() => handleCancelBooking(b.id)}
                                className="px-3 py-2 border border-slate-300 text-slate-600 text-xs font-semibold rounded-lg hover:text-red-600"
                              >
                                Cancel
                              </button>
                            )}
                            {b.status === 'completed' && (
                              <button
                                type="button"
                                onClick={() => setReviewingBooking(b)}
                                className="px-3.5 py-2 bg-[#142B46] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1"
                              >
                                <Star className="w-3.5 h-3.5" />
                                Leave Review
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <h3 className="font-display text-lg font-bold text-[#142B46] mb-3">
                  Payment History & Receipts
                </h3>
                {payments.length === 0 ? (
                  <p className="text-sm text-slate-500">No payment references submitted yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-2.5 pr-4">Method</th>
                          <th className="py-2.5 pr-4">Transaction Reference</th>
                          <th className="py-2.5 pr-4 text-right">Amount (ETB)</th>
                          <th className="py-2.5">Verification Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {payments.map((p) => (
                          <tr key={p.id}>
                            <td className="py-3 pr-4 font-semibold text-[#142B46]">{p.method}</td>
                            <td className="py-3 pr-4 font-mono-tabular">{p.transactionRef}</td>
                            <td className="py-3 pr-4 text-right font-mono-tabular font-semibold">
                              {p.amountEtb.toLocaleString()}
                            </td>
                            <td className="py-3 font-semibold text-[#39836B]">
                              {p.status.replace('_', ' ')}
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

          {tab === 'matching' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-[#142B46]">
                  Managed Tutor Matching Requests
                </h2>
                <button
                  type="button"
                  onClick={() => onNavigate('request-matching')}
                  className="px-4 py-2 bg-[#142B46] text-white text-xs font-semibold rounded-lg"
                >
                  New Matching Request
                </button>
              </div>
              {tutorRequests.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No managed matching requests submitted yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {tutorRequests.map((req) => (
                    <div
                      key={req.id}
                      className="border border-slate-200 rounded-xl p-5 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-display font-bold text-[#142B46]">
                          {req.studentName} · {req.gradeLevel}
                        </h3>
                        <span className="text-xs font-semibold text-[#39836B]">
                          {req.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">
                        {req.subjects.join(', ')} · {req.subCity} · Max Budget:{' '}
                        <span className="font-mono-tabular">{req.budgetMaxEtb} ETB/hr</span>
                      </p>
                      {req.proposedTutorName && (
                        <div className="p-4 bg-[#F5F7FA] border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold text-[#142B46]">
                              Recommended Candidate: {req.proposedTutorName}
                            </p>
                            {req.adminNotes && (
                              <p className="text-xs text-slate-600 mt-0.5">{req.adminNotes}</p>
                            )}
                          </div>
                          {req.status === 'candidates_proposed' && (
                            <button
                              type="button"
                              onClick={() => handleApproveMatch(req)}
                              className="px-4 py-2 bg-[#39836B] text-white text-xs font-semibold rounded-lg"
                            >
                              Approve Match & Book
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'progress' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="font-display text-lg font-bold text-[#142B46]">
                Attendance & Learning Progress Reports
              </h2>
              {progressReports.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Your tutor’s session attendance and progress notes will appear here after sessions
                  begin.
                </p>
              ) : (
                <div className="space-y-4">
                  {progressReports.map((rep) => (
                    <div key={rep.id} className="border border-slate-200 rounded-xl p-5 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-[#142B46]">
                          {rep.studentName} · {rep.subject} (Tutor: {rep.tutorName})
                        </span>
                        <span className="font-mono-tabular text-slate-500">
                          {rep.sessionDate} · Attendance: {rep.attendanceStatus}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700">{rep.summary}</p>
                      {rep.parentComment ? (
                        <p className="text-xs text-[#39836B] font-medium">
                          Your Comment: {rep.parentComment}
                        </p>
                      ) : (
                        <div className="flex gap-2 pt-1">
                          <input
                            type="text"
                            maxLength={500}
                            value={commentMap[rep.id] || ''}
                            onChange={(e) =>
                              setCommentMap((prev) => ({ ...prev, [rep.id]: e.target.value }))
                            }
                            placeholder="Add parent feedback..."
                            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveParentComment(rep.id)}
                            className="px-3.5 py-2 bg-[#142B46] text-white text-xs font-semibold rounded-lg"
                          >
                            Save Note
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'favorites' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="font-display text-lg font-bold text-[#142B46]">
                Saved Favorite Tutors
              </h2>
              {favoriteTutors.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Save tutors while browsing to quickly compare or book later.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {favoriteTutors.map((t) => (
                    <div
                      key={t.id}
                      className="border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="font-bold text-sm text-[#142B46]">{t.fullName}</p>
                        <p className="text-xs text-slate-500">
                          {t.subjects.slice(0, 2).join(', ')} · {t.hourlyRateEtb} ETB/hr
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onSelectTutor(t)}
                        className="px-3 py-1.5 bg-[#142B46] text-white text-xs font-semibold rounded-lg"
                      >
                        View
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'support' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <h2 className="font-display text-lg font-bold text-[#142B46] mb-2">
                  Family Support & Safeguarding Reporting
                </h2>
                <p className="text-xs text-slate-600 mb-4">
                  Submit rescheduling requests, payment verification inquiries, or urgent child
                  safeguarding reports directly to our coordination team.
                </p>
                <form onSubmit={handleCreateTicket} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select
                      value={ticketCategory}
                      onChange={(e) =>
                        setTicketCategory(
                          e.target.value as 'general' | 'payment' | 'reschedule' | 'safeguarding'
                        )
                      }
                      className="px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white"
                    >
                      <option value="general">General Inquiry</option>
                      <option value="reschedule">Rescheduling Request</option>
                      <option value="payment">Payment / Refund</option>
                      <option value="safeguarding">Safeguarding Incident Report</option>
                    </select>
                    <input
                      type="text"
                      required
                      maxLength={160}
                      value={ticketSubject}
                      onChange={(e) => setTicketSubject(e.target.value)}
                      placeholder="Subject"
                      className="px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <textarea
                    rows={3}
                    required
                    maxLength={1500}
                    value={ticketMessage}
                    onChange={(e) => setTicketMessage(e.target.value)}
                    placeholder="Describe your request or safeguarding concern..."
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#142B46] text-white text-xs font-semibold rounded-lg"
                  >
                    Submit Ticket
                  </button>
                </form>
              </div>

              {supportTickets.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                  <h3 className="font-display font-bold text-[#142B46]">Your Tickets</h3>
                  {supportTickets.map((tk) => (
                    <div key={tk.id} className="p-4 border border-slate-200 rounded-lg space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-bold text-[#142B46]">
                          [{tk.category}] {tk.subject}
                        </span>
                        <span className="font-semibold text-[#39836B]">{tk.status}</span>
                      </div>
                      <p className="text-xs text-slate-600">{tk.message}</p>
                      {tk.adminResponse && (
                        <p className="text-xs text-[#142B46] bg-[#F5F7FA] p-2 rounded mt-2">
                          <strong>Admin Response:</strong> {tk.adminResponse}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'profile' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="font-display text-lg font-bold text-[#142B46] mb-4">
                Parent Account Profile
              </h2>
              <form onSubmit={handleSaveProfile} className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-xs font-semibold text-[#142B46] mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={accName}
                    onChange={(e) => setAccName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#142B46] mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={accPhone}
                    onChange={(e) => setAccPhone(e.target.value)}
                    placeholder="+251 9..."
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#142B46] mb-1">
                    Addis Ababa Sub-City
                  </label>
                  <select
                    value={accSubCity}
                    onChange={(e) => setAccSubCity(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    {ADDIS_SUB_CITIES.map((sc) => (
                      <option key={sc} value={sc}>
                        {sc}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#142B46] text-white text-xs font-semibold rounded-lg"
                  >
                    Save Account Details
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
          {tab === 'messages' && (
            <MessagingCenter
              currentUser={currentUser}
              roleContext="parent"
              conversations={conversations}
              messages={messages}
              restriction={messagingRestriction}
              violations={userViolations}
              bookings={bookings}
              initialConversationId={initialConversationId}
            />
          )}
        </main>
      </div>

      {/* Payment Reference Modal */}
      {payingBooking && (
        <div className="fixed inset-0 z-50 bg-[#142B46]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-[#142B46]">
              Submit Manual Payment Reference
            </h3>
            <div className="p-4 bg-[#F5F7FA] border border-slate-200 rounded-lg text-xs space-y-1">
              <p>
                <strong>Amount Due:</strong>{' '}
                <span className="font-mono-tabular">
                  {payingBooking.totalAmountEtb.toLocaleString()} ETB
                </span>
              </p>
              <p>
                <strong>Telebirr Merchant:</strong> 0911-000-000 (TutorBridge Ethiopia)
              </p>
              <p>
                <strong>CBE Account:</strong> 1000-000-000-000 (TutorBridge Ethiopia)
              </p>
            </div>
            <form onSubmit={handleSubmitPayment} className="space-y-3">
              <select
                value={payMethod}
                onChange={(e) =>
                  setPayMethod(e.target.value as 'Telebirr' | 'CBE Birr' | 'Bank Transfer')
                }
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white"
              >
                <option value="Telebirr">Telebirr</option>
                <option value="CBE Birr">CBE Birr</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
              <input
                type="text"
                required
                minLength={3}
                maxLength={120}
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                placeholder="Transaction Reference / FT Number"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm font-mono-tabular"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayingBooking(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPay}
                  className="px-5 py-2 bg-[#142B46] text-white text-xs font-semibold rounded-lg"
                >
                  {submittingPay ? 'Submitting...' : 'Submit for Verification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewingBooking && (
        <div className="fixed inset-0 z-50 bg-[#142B46]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-[#142B46]">
              Review {reviewingBooking.tutorName}
            </h3>
            <form onSubmit={handleSubmitReview} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#142B46] mb-1">
                  Rating (1 to 5)
                </label>
                <select
                  value={reviewRating}
                  onChange={(e) => setReviewRating(Number(e.target.value))}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} Stars
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                rows={3}
                required
                minLength={4}
                maxLength={MAX_TEXT_LENGTHS.comment}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share how sessions helped your student..."
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReviewingBooking(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#142B46] text-white text-xs font-semibold rounded-lg"
                >
                  Publish Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
