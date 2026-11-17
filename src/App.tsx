import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './firebase';
import { SEED_CORPORATE_TRAINERS, SEED_TUTORS } from './data/seedData';
import {
  AdminLog,
  AdminRecord,
  AppRoute,
  AuditLog,
  Booking,
  CategoryRecord,
  Conversation,
  CorporateFeedback,
  CorporateInvoice,
  CorporateNegotiation,
  CorporateRefundRecord,
  CorporateRequest,
  CorporateTrainer,
  LanguageCode,
  Message,
  MessageReport,
  MessagingRestriction,
  ModerationAction,
  ModerationFlag,
  Organization,
  PaymentRecord,
  PlatformModerationSetting,
  ProgressReport,
  Review,
  SavedTrainer,
  StudentProfile,
  SupportTicket,
  TrainerAssignmentAgreement,
  TrainerCompensationRecord,
  TrainerPortfolioItem,
  TrainerSelectionRequest,
  TrainingAttendance,
  TrainingContract,
  TrainingParticipant,
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
} from './types';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LOCALES } from './i18n';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { PolicyModal } from './components/PolicyModal';
import { BookingModal } from './components/BookingModal';
import { AuthModal, SignupRoleChoice } from './components/AuthModal';
import { HomePage } from './components/HomePage';
import { FindTutorPage } from './components/FindTutorPage';
import { TutorProfilePage } from './components/TutorProfilePage';
import { RequestMatchingPage } from './components/RequestMatchingPage';
import { BecomeTutorPage } from './components/BecomeTutorPage';
import { CorporateTrainingPage } from './components/CorporateTrainingPage';
import { ParentDashboard } from './components/ParentDashboard';
import { TutorDashboard } from './components/TutorDashboard';
import { OrganizationDashboard } from './components/OrganizationDashboard';
import { AdminDashboard } from './components/AdminDashboard';

function isAdminLocation(): boolean {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const hash = window.location.hash.replace(/\/+$/, '');
  return (
    path === '/admin' ||
    path === '/admin/login' ||
    hash === '#admin' ||
    hash === '#admin/login'
  );
}

function MainApp() {
  const [route, setRoute] = useState<AppRoute>(() =>
    isAdminLocation() ? 'admin' : 'home'
  );
  const [lang, setLang] = useState<LanguageCode>(() => {
    try {
      const saved = localStorage.getItem('tb_lang');
      return saved === 'am' ? 'am' : 'en';
    } catch {
      return 'en';
    }
  });
  const [selectedTutorId, setSelectedTutorId] = useState<string | null>(null);
  const [bookingTutor, setBookingTutor] = useState<TutorProfile | null>(null);
  const [policyModal, setPolicyModal] = useState<'terms' | 'privacy' | 'safeguarding' | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authError, setAuthError] = useState('');
  const [adminAuthError, setAdminAuthError] = useState('');
  const [pendingRoleChoice, setPendingRoleChoice] = useState<SignupRoleChoice>('parent');
  const pendingRoleRef = useRef<SignupRoleChoice>('parent');
  const langRef = useRef<LanguageCode>('en');
  pendingRoleRef.current = pendingRoleChoice;
  langRef.current = lang;

  const handleLanguageChange = (nextLang: LanguageCode) => {
    setLang(nextLang);
    try {
      localStorage.setItem('tb_lang', nextLang);
    } catch {
      // Ignore storage quota errors
    }
  };

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = LOCALES[lang].meta.title;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', LOCALES[lang].meta.description);
    }
  }, [lang]);

  const [searchFilter, setSearchFilter] = useState({ query: '', subCity: '', division: '' });
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('tb_favorites') || '[]');
    } catch {
      return [];
    }
  });

  // Firebase Auth & Account state
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [serverAdminVerified, setServerAdminVerified] = useState(false);
  const [adminVerifyBusy, setAdminVerifyBusy] = useState(false);

  // Public Firestore collections
  const [publicTutors, setPublicTutors] = useState<TutorProfile[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);

  // User-scoped Tutoring collections
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [parentBookings, setParentBookings] = useState<Booking[]>([]);
  const [tutorBookings, setTutorBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [tutorRequests, setTutorRequests] = useState<TutorRequest[]>([]);
  const [parentProgress, setParentProgress] = useState<ProgressReport[]>([]);
  const [tutorProgress, setTutorProgress] = useState<ProgressReport[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [ownTutorProfile, setOwnTutorProfile] = useState<TutorProfile | null>(null);
  const [ownTutorDocs, setOwnTutorDocs] = useState<TutorDocument[]>([]);

  // User-scoped v1.1 Corporate Training & Marketplace collections
  const [ownOrganization, setOwnOrganization] = useState<Organization | null>(null);
  const [ownCorporateTrainer, setOwnCorporateTrainer] = useState<CorporateTrainer | null>(null);
  const [approvedCorporateTrainers, setApprovedCorporateTrainers] = useState<CorporateTrainer[]>([]);
  const [approvedPortfolioItems, setApprovedPortfolioItems] = useState<TrainerPortfolioItem[]>([]);
  const [ownPortfolioItems, setOwnPortfolioItems] = useState<TrainerPortfolioItem[]>([]);
  const [orgSavedTrainers, setOrgSavedTrainers] = useState<SavedTrainer[]>([]);
  const [orgSelectionRequests, setOrgSelectionRequests] = useState<TrainerSelectionRequest[]>([]);
  const [orgNegotiations, setOrgNegotiations] = useState<CorporateNegotiation[]>([]);
  const [trainerNegotiations, setTrainerNegotiations] = useState<CorporateNegotiation[]>([]);
  const [trainerAssignments, setTrainerAssignments] = useState<TrainerAssignmentAgreement[]>([]);
  const [trainerCompensations, setTrainerCompensations] = useState<TrainerCompensationRecord[]>([]);
  const [orgRefunds, setOrgRefunds] = useState<CorporateRefundRecord[]>([]);
  const [orgRequests, setOrgRequests] = useState<CorporateRequest[]>([]);
  const [orgProposals, setOrgProposals] = useState<TrainingProposal[]>([]);
  const [trainerProposals, setTrainerProposals] = useState<TrainingProposal[]>([]);
  const [orgQuotations, setOrgQuotations] = useState<TrainingQuotation[]>([]);
  const [orgContracts, setOrgContracts] = useState<TrainingContract[]>([]);
  const [trainerContracts, setTrainerContracts] = useState<TrainingContract[]>([]);
  const [orgSchedules, setOrgSchedules] = useState<TrainingSchedule[]>([]);
  const [trainerSchedules, setTrainerSchedules] = useState<TrainingSchedule[]>([]);
  const [orgParticipants, setOrgParticipants] = useState<TrainingParticipant[]>([]);
  const [orgAttendance, setOrgAttendance] = useState<TrainingAttendance[]>([]);
  const [trainerAttendance, setTrainerAttendance] = useState<TrainingAttendance[]>([]);
  const [orgReports, setOrgReports] = useState<TrainingReport[]>([]);
  const [trainerReports, setTrainerReports] = useState<TrainingReport[]>([]);
  const [orgInvoices, setOrgInvoices] = useState<CorporateInvoice[]>([]);
  const [orgFeedbacks, setOrgFeedbacks] = useState<CorporateFeedback[]>([]);

  // User-scoped Contact Protection & Messaging state
  const [userConversations, setUserConversations] = useState<Conversation[]>([]);
  const [userMessages, setUserMessages] = useState<Message[]>([]);
  const [ownRestriction, setOwnRestriction] = useState<MessagingRestriction | null>(null);
  const [ownViolations, setOwnViolations] = useState<UserViolation[]>([]);
  const [initialParentConvId, setInitialParentConvId] = useState<string | null>(null);

  // Admin-scoped collections
  const [allUsers, setAllUsers] = useState<UserAccount[]>([]);
  const [allTutors, setAllTutors] = useState<TutorProfile[]>([]);
  const [allTutorDocs, setAllTutorDocs] = useState<TutorDocument[]>([]);
  const [allStudentsCount, setAllStudentsCount] = useState(0);
  const [allRequests, setAllRequests] = useState<TutorRequest[]>([]);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [allPayments, setAllPayments] = useState<PaymentRecord[]>([]);
  const [allTickets, setAllTickets] = useState<SupportTicket[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
  const [allAdmins, setAllAdmins] = useState<AdminRecord[]>([]);

  // Admin-scoped v1.1 Corporate collections
  const [allOrganizations, setAllOrganizations] = useState<Organization[]>([]);
  const [allCorporateTrainers, setAllCorporateTrainers] = useState<CorporateTrainer[]>([]);
  const [allTrainerPortfolioItems, setAllTrainerPortfolioItems] = useState<TrainerPortfolioItem[]>([]);
  const [allTrainerSelections, setAllTrainerSelections] = useState<TrainerSelectionRequest[]>([]);
  const [allCorporateNegotiations, setAllCorporateNegotiations] = useState<CorporateNegotiation[]>([]);
  const [allTrainerAssignments, setAllTrainerAssignments] = useState<TrainerAssignmentAgreement[]>([]);
  const [allTrainerCompensations, setAllTrainerCompensations] = useState<TrainerCompensationRecord[]>([]);
  const [allCorporateRefunds, setAllCorporateRefunds] = useState<CorporateRefundRecord[]>([]);
  const [allCorporateRequests, setAllCorporateRequests] = useState<CorporateRequest[]>([]);
  const [allTrainingProposals, setAllTrainingProposals] = useState<TrainingProposal[]>([]);
  const [allTrainingQuotations, setAllTrainingQuotations] = useState<TrainingQuotation[]>([]);
  const [allTrainingContracts, setAllTrainingContracts] = useState<TrainingContract[]>([]);
  const [allTrainingSchedules, setAllTrainingSchedules] = useState<TrainingSchedule[]>([]);
  const [allTrainingAttendance, setAllTrainingAttendance] = useState<TrainingAttendance[]>([]);
  const [allTrainingReports, setAllTrainingReports] = useState<TrainingReport[]>([]);
  const [allCorporateInvoices, setAllCorporateInvoices] = useState<CorporateInvoice[]>([]);

  // Admin-scoped Contact Protection collections
  const [allConversations, setAllConversations] = useState<Conversation[]>([]);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [allModerationFlags, setAllModerationFlags] = useState<ModerationFlag[]>([]);
  const [allMessageReports, setAllMessageReports] = useState<MessageReport[]>([]);
  const [allUserViolations, setAllUserViolations] = useState<UserViolation[]>([]);
  const [allMessagingRestrictions, setAllMessagingRestrictions] = useState<MessagingRestriction[]>(
    []
  );
  const [allModerationActions, setAllModerationActions] = useState<ModerationAction[]>([]);
  const [allAuditLogs, setAllAuditLogs] = useState<AuditLog[]>([]);
  const [moderationSettings, setModerationSettings] = useState<PlatformModerationSetting | null>(
    null
  );

  // Sync private /admin and /admin/login navigation (path & hash)
  useEffect(() => {
    const syncAdminLocation = () => {
      if (isAdminLocation()) {
        setRoute('admin');
      } else if (route === 'admin') {
        setRoute('home');
      }
    };
    window.addEventListener('hashchange', syncAdminLocation);
    window.addEventListener('popstate', syncAdminLocation);
    return () => {
      window.removeEventListener('hashchange', syncAdminLocation);
      window.removeEventListener('popstate', syncAdminLocation);
    };
  }, [route]);

  // Keep canonical /admin URL cleanly without hash fragments
  useEffect(() => {
    if (route !== 'admin') return;
    const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
    if (currentPath !== '/admin' || window.location.hash) {
      window.history.replaceState(null, '', '/admin');
    }
  }, [route]);

  // Verify admin role against Express backend whenever accessing /admin
  useEffect(() => {
    if (route !== 'admin' || !authReady || !firebaseUser || !isAdmin) {
      setServerAdminVerified(false);
      setAdminVerifyBusy(false);
      return;
    }
    let cancelled = false;
    setAdminVerifyBusy(true);
    (async () => {
      try {
        const token = await firebaseUser.getIdToken();
        const res = await fetch('/api/admin/verify', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          if (!cancelled) {
            setServerAdminVerified(false);
            setAdminAuthError(body.error || 'Administrator privileges could not be verified.');
          }
          return;
        }
        const data = (await res.json()) as { authorized?: boolean };
        if (!cancelled) {
          setServerAdminVerified(Boolean(data.authorized));
          if (data.authorized) setAdminAuthError('');
        }
      } catch {
        if (!cancelled) {
          setServerAdminVerified(false);
          setAdminAuthError('Unable to verify administrator session with server.');
        }
      } finally {
        if (!cancelled) {
          setAdminVerifyBusy(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [route, authReady, firebaseUser, isAdmin]);

  // Auth listener & user account provisioning
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (!user) {
        setCurrentUser(null);
        setIsAdmin(false);
        setServerAdminVerified(false);
        setAuthReady(true);
        return;
      }

      const bootstrappedAdmin = Boolean(
        user.emailVerified &&
          user.email &&
          user.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()
      );

      let hasAdminDoc = false;
      try {
        const adminSnap = await getDoc(doc(db, 'admins', user.uid));
        hasAdminDoc = adminSnap.exists();
      } catch {
        hasAdminDoc = false;
      }

      const resolvedAdmin = bootstrappedAdmin || hasAdminDoc;
      setIsAdmin(resolvedAdmin);

      // Ensure primary bootstrapped admin also has an /admins/{uid} record
      if (bootstrappedAdmin && !hasAdminDoc) {
        try {
          await setDoc(doc(db, 'admins', user.uid), {
            uid: user.uid,
            email: (user.email || BOOTSTRAPPED_ADMIN_EMAIL).toLowerCase(),
            grantedAt: serverTimestamp(),
          });
        } catch {
          // Non-fatal if already written concurrently
        }
      }

      try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          const initialRole =
            resolvedAdmin && isAdminLocation() ? 'admin' : pendingRoleRef.current;
          const payload: UserAccount = {
            uid: user.uid,
            email: user.email || '',
            fullName: clampText(user.displayName || 'TutorBridge User', 120),
            role: initialRole,
            city: 'Addis Ababa',
            languagePreference: langRef.current,
            status: 'active',
          };
          await setDoc(userRef, {
            ...payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setCurrentUser(payload);
        } else {
          const existingData = snap.data() as UserAccount;
          setCurrentUser(existingData);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  // Public Listeners: Approved Tutors + Reviews + Categories
  useEffect(() => {
    const unsubTutors = onSnapshot(
      query(collection(db, 'tutors'), where('status', '==', 'approved')),
      (snap) => {
        setPublicTutors(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TutorProfile)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'tutors')
    );

    const unsubReviews = onSnapshot(
      collection(db, 'reviews'),
      (snap) => {
        setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Review)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'reviews')
    );

    const unsubCategories = onSnapshot(
      collection(db, 'categories'),
      (snap) => {
        setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CategoryRecord)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'categories')
    );

    return () => {
      unsubTutors();
      unsubReviews();
      unsubCategories();
    };
  }, []);

  // Authenticated User-Scoped Listeners
  useEffect(() => {
    if (!authReady || !firebaseUser || auth.currentUser?.uid !== firebaseUser.uid) return;
    const uid = firebaseUser.uid;

    const unsubUser = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (snap.exists()) {
          setCurrentUser(snap.data() as UserAccount);
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, `users/${uid}`)
    );

    const unsubStudents = onSnapshot(
      query(collection(db, 'students'), where('parentId', '==', uid)),
      (snap) => setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentProfile))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'students')
    );

    const unsubParentBookings = onSnapshot(
      query(collection(db, 'bookings'), where('parentId', '==', uid)),
      (snap) => setParentBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Booking))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'bookings')
    );

    const unsubTutorBookings = onSnapshot(
      query(collection(db, 'bookings'), where('tutorUserId', '==', uid)),
      (snap) => setTutorBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Booking))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'bookings')
    );

    const unsubPayments = onSnapshot(
      query(collection(db, 'payments'), where('parentId', '==', uid)),
      (snap) => setPayments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentRecord))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'payments')
    );

    const unsubRequests = onSnapshot(
      query(collection(db, 'tutor_requests'), where('parentId', '==', uid)),
      (snap) => setTutorRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TutorRequest))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'tutor_requests')
    );

    const unsubParentProg = onSnapshot(
      query(collection(db, 'progress_reports'), where('parentId', '==', uid)),
      (snap) =>
        setParentProgress(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProgressReport))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'progress_reports')
    );

    const unsubTutorProg = onSnapshot(
      query(collection(db, 'progress_reports'), where('tutorUserId', '==', uid)),
      (snap) =>
        setTutorProgress(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProgressReport))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'progress_reports')
    );

    const unsubTickets = onSnapshot(
      query(collection(db, 'support_tickets'), where('userId', '==', uid)),
      (snap) => setSupportTickets(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SupportTicket))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'support_tickets')
    );

    const unsubOwnTutor = onSnapshot(
      query(collection(db, 'tutors'), where('userId', '==', uid)),
      (snap) => {
        if (!snap.empty) {
          const d = snap.docs[0];
          setOwnTutorProfile({ id: d.id, ...d.data() } as TutorProfile);
        } else {
          setOwnTutorProfile(null);
        }
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'tutors')
    );

    const unsubOwnDocs = onSnapshot(
      query(collection(db, 'tutor_documents'), where('userId', '==', uid)),
      (snap) => setOwnTutorDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TutorDocument))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'tutor_documents')
    );

    // V1.1 User-scoped Corporate Training Listeners
    const unsubOwnOrg = onSnapshot(
      query(collection(db, 'organizations'), where('ownerUid', '==', uid)),
      (snap) => {
        if (!snap.empty) {
          const d = snap.docs[0];
          setOwnOrganization({ id: d.id, ...d.data() } as Organization);
        } else {
          setOwnOrganization(null);
        }
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'organizations')
    );

    const unsubOwnTrainer = onSnapshot(
      query(collection(db, 'corporate_trainers'), where('userId', '==', uid)),
      (snap) => {
        if (!snap.empty) {
          const d = snap.docs[0];
          setOwnCorporateTrainer({ id: d.id, ...d.data() } as CorporateTrainer);
        } else {
          setOwnCorporateTrainer(null);
        }
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'corporate_trainers')
    );

    const unsubOrgReqs = onSnapshot(
      query(collection(db, 'corporate_requests'), where('ownerUid', '==', uid)),
      (snap) =>
        setOrgRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CorporateRequest))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'corporate_requests')
    );

    const unsubOrgProps = onSnapshot(
      query(collection(db, 'training_proposals'), where('organizationOwnerUid', '==', uid)),
      (snap) =>
        setOrgProposals(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingProposal))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'training_proposals')
    );

    const unsubTrainerProps = onSnapshot(
      query(collection(db, 'training_proposals'), where('trainerUserId', '==', uid)),
      (snap) =>
        setTrainerProposals(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingProposal))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'training_proposals')
    );

    const unsubOrgQuotes = onSnapshot(
      query(collection(db, 'training_quotations'), where('organizationOwnerUid', '==', uid)),
      (snap) =>
        setOrgQuotations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingQuotation))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'training_quotations')
    );

    const unsubOrgContracts = onSnapshot(
      query(collection(db, 'training_contracts'), where('organizationOwnerUid', '==', uid)),
      (snap) =>
        setOrgContracts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingContract))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'training_contracts')
    );

    const unsubTrainerContracts = onSnapshot(
      query(collection(db, 'training_contracts'), where('trainerUserId', '==', uid)),
      (snap) =>
        setTrainerContracts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingContract))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'training_contracts')
    );

    const unsubOrgSchedules = onSnapshot(
      query(collection(db, 'training_schedules'), where('organizationOwnerUid', '==', uid)),
      (snap) =>
        setOrgSchedules(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingSchedule))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'training_schedules')
    );

    const unsubTrainerSchedules = onSnapshot(
      query(collection(db, 'training_schedules'), where('trainerUserId', '==', uid)),
      (snap) =>
        setTrainerSchedules(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingSchedule))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'training_schedules')
    );

    const unsubOrgParticipants = onSnapshot(
      query(collection(db, 'training_participants'), where('organizationOwnerUid', '==', uid)),
      (snap) =>
        setOrgParticipants(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingParticipant))
        ),
      (error) => handleFirestoreError(error, OperationType.LIST, 'training_participants')
    );

    const unsubOrgAtt = onSnapshot(
      query(collection(db, 'training_attendance'), where('organizationOwnerUid', '==', uid)),
      (snap) =>
        setOrgAttendance(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingAttendance))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'training_attendance')
    );

    const unsubTrainerAtt = onSnapshot(
      query(collection(db, 'training_attendance'), where('trainerUserId', '==', uid)),
      (snap) =>
        setTrainerAttendance(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingAttendance))
        ),
      (error) => handleFirestoreError(error, OperationType.LIST, 'training_attendance')
    );

    const unsubOrgReports = onSnapshot(
      query(collection(db, 'training_reports'), where('organizationOwnerUid', '==', uid)),
      (snap) =>
        setOrgReports(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingReport))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'training_reports')
    );

    const unsubTrainerReports = onSnapshot(
      query(collection(db, 'training_reports'), where('trainerUserId', '==', uid)),
      (snap) =>
        setTrainerReports(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingReport))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'training_reports')
    );

    const unsubOrgInvoices = onSnapshot(
      query(collection(db, 'corporate_invoices'), where('organizationOwnerUid', '==', uid)),
      (snap) =>
        setOrgInvoices(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CorporateInvoice))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'corporate_invoices')
    );

    const unsubOrgFeedback = onSnapshot(
      query(collection(db, 'corporate_feedback'), where('organizationOwnerUid', '==', uid)),
      (snap) =>
        setOrgFeedbacks(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CorporateFeedback))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'corporate_feedback')
    );

    // Corporate Trainer Directory, Marketplace, Dual Contracts & Negotiations Listeners
    const unsubApprovedCorpTrainers = onSnapshot(
      query(collection(db, 'corporate_trainers'), where('status', '==', 'approved')),
      (snap) =>
        setApprovedCorporateTrainers(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as CorporateTrainer))
        ),
      (error) => handleFirestoreError(error, OperationType.LIST, 'corporate_trainers')
    );

    const unsubApprovedPortfolios = onSnapshot(
      query(collection(db, 'trainer_portfolio_items'), where('status', '==', 'approved')),
      (snap) =>
        setApprovedPortfolioItems(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainerPortfolioItem))
        ),
      (error) => handleFirestoreError(error, OperationType.LIST, 'trainer_portfolio_items')
    );

    const unsubOwnPortfolios = onSnapshot(
      query(collection(db, 'trainer_portfolio_items'), where('trainerUserId', '==', uid)),
      (snap) =>
        setOwnPortfolioItems(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainerPortfolioItem))
        ),
      (error) => handleFirestoreError(error, OperationType.LIST, 'trainer_portfolio_items')
    );

    const unsubSavedTrainers = onSnapshot(
      query(collection(db, 'saved_trainers'), where('organizationOwnerUid', '==', uid)),
      (snap) =>
        setOrgSavedTrainers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SavedTrainer))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'saved_trainers')
    );

    const unsubSelectionRequests = onSnapshot(
      query(collection(db, 'trainer_selection_requests'), where('organizationOwnerUid', '==', uid)),
      (snap) =>
        setOrgSelectionRequests(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainerSelectionRequest))
        ),
      (error) => handleFirestoreError(error, OperationType.LIST, 'trainer_selection_requests')
    );

    const unsubOrgNegotiations = onSnapshot(
      query(
        collection(db, 'corporate_negotiations'),
        where('targetType', '==', 'organization_quote'),
        where('organizationOwnerUid', '==', uid)
      ),
      (snap) =>
        setOrgNegotiations(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as CorporateNegotiation))
        ),
      (error) => handleFirestoreError(error, OperationType.LIST, 'corporate_negotiations')
    );

    const unsubTrainerNegotiations = onSnapshot(
      query(
        collection(db, 'corporate_negotiations'),
        where('targetType', '==', 'trainer_compensation'),
        where('trainerUserId', '==', uid)
      ),
      (snap) =>
        setTrainerNegotiations(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as CorporateNegotiation))
        ),
      (error) => handleFirestoreError(error, OperationType.LIST, 'corporate_negotiations')
    );

    const unsubTrainerAssignments = onSnapshot(
      query(collection(db, 'trainer_assignment_agreements'), where('trainerUserId', '==', uid)),
      (snap) =>
        setTrainerAssignments(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainerAssignmentAgreement))
        ),
      (error) => handleFirestoreError(error, OperationType.LIST, 'trainer_assignment_agreements')
    );

    const unsubTrainerCompensations = onSnapshot(
      query(collection(db, 'trainer_compensation_records'), where('trainerUserId', '==', uid)),
      (snap) =>
        setTrainerCompensations(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainerCompensationRecord))
        ),
      (error) => handleFirestoreError(error, OperationType.LIST, 'trainer_compensation_records')
    );

    const unsubOrgRefunds = onSnapshot(
      query(collection(db, 'corporate_refunds'), where('organizationOwnerUid', '==', uid)),
      (snap) =>
        setOrgRefunds(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CorporateRefundRecord))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'corporate_refunds')
    );

    // Contact Protection & User-scoped Messaging Listeners
    const unsubUserConvs = onSnapshot(
      query(collection(db, 'conversations'), where('participantUids', 'array-contains', uid)),
      (snap) => setUserConversations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Conversation))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'conversations')
    );

    const unsubUserMsgs = onSnapshot(
      query(collection(db, 'messages'), where('participantUids', 'array-contains', uid)),
      (snap) => setUserMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'messages')
    );

    const unsubOwnRestriction = onSnapshot(
      doc(db, 'messaging_restrictions', uid),
      (snap) => {
        if (snap.exists()) {
          setOwnRestriction({ id: snap.id, ...snap.data() } as MessagingRestriction);
        } else {
          setOwnRestriction(null);
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, `messaging_restrictions/${uid}`)
    );

    const unsubOwnViolations = onSnapshot(
      query(collection(db, 'user_violations'), where('userId', '==', uid)),
      (snap) => setOwnViolations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as UserViolation))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'user_violations')
    );

    return () => {
      unsubUser();
      unsubStudents();
      unsubParentBookings();
      unsubTutorBookings();
      unsubPayments();
      unsubRequests();
      unsubParentProg();
      unsubTutorProg();
      unsubTickets();
      unsubOwnTutor();
      unsubOwnDocs();
      unsubOwnOrg();
      unsubOwnTrainer();
      unsubOrgReqs();
      unsubOrgProps();
      unsubTrainerProps();
      unsubOrgQuotes();
      unsubOrgContracts();
      unsubTrainerContracts();
      unsubOrgSchedules();
      unsubTrainerSchedules();
      unsubOrgParticipants();
      unsubOrgAtt();
      unsubTrainerAtt();
      unsubOrgReports();
      unsubTrainerReports();
      unsubOrgInvoices();
      unsubOrgFeedback();
      unsubApprovedCorpTrainers();
      unsubApprovedPortfolios();
      unsubOwnPortfolios();
      unsubSavedTrainers();
      unsubSelectionRequests();
      unsubOrgNegotiations();
      unsubTrainerNegotiations();
      unsubTrainerAssignments();
      unsubTrainerCompensations();
      unsubOrgRefunds();
      unsubUserConvs();
      unsubUserMsgs();
      unsubOwnRestriction();
      unsubOwnViolations();
    };
  }, [authReady, firebaseUser]);

  // Admin-only listeners & automatic seed check (strictly isolated to verified /admin sessions)
  useEffect(() => {
    if (
      !authReady ||
      !firebaseUser ||
      auth.currentUser?.uid !== firebaseUser.uid ||
      !isAdmin ||
      !serverAdminVerified ||
      route !== 'admin'
    ) {
      setAllUsers([]);
      setAllTutors([]);
      setAllTutorDocs([]);
      setAllStudentsCount(0);
      setAllRequests([]);
      setAllBookings([]);
      setAllPayments([]);
      setAllTickets([]);
      setAdminLogs([]);
      setAllAdmins([]);
      setAllOrganizations([]);
      setAllCorporateTrainers([]);
      setAllTrainerPortfolioItems([]);
      setAllTrainerSelections([]);
      setAllCorporateNegotiations([]);
      setAllTrainerAssignments([]);
      setAllTrainerCompensations([]);
      setAllCorporateRefunds([]);
      setAllCorporateRequests([]);
      setAllTrainingProposals([]);
      setAllTrainingQuotations([]);
      setAllTrainingContracts([]);
      setAllTrainingSchedules([]);
      setAllTrainingAttendance([]);
      setAllTrainingReports([]);
      setAllCorporateInvoices([]);
      setAllConversations([]);
      setAllMessages([]);
      setAllModerationFlags([]);
      setAllMessageReports([]);
      setAllUserViolations([]);
      setAllMessagingRestrictions([]);
      setAllModerationActions([]);
      setAllAuditLogs([]);
      setModerationSettings(null);
      return;
    }

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => setAllUsers(snap.docs.map((d) => d.data() as UserAccount)),
      (error) => handleFirestoreError(error, OperationType.LIST, 'users')
    );

    const unsubTutors = onSnapshot(
      collection(db, 'tutors'),
      async (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TutorProfile));
        setAllTutors(list);
        if (list.length === 0) {
          try {
            for (const st of SEED_TUTORS) {
              const { id: tutorDocId, ...tutorPayload } = st;
              await setDoc(doc(db, 'tutors', tutorDocId), {
                ...tutorPayload,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            }
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, 'tutors');
          }
        }
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'tutors')
    );

    const unsubDocs = onSnapshot(
      collection(db, 'tutor_documents'),
      (snap) => setAllTutorDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TutorDocument))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'tutor_documents')
    );

    const unsubStudents = onSnapshot(
      collection(db, 'students'),
      (snap) => setAllStudentsCount(snap.size),
      (error) => handleFirestoreError(error, OperationType.LIST, 'students')
    );

    const unsubReq = onSnapshot(
      collection(db, 'tutor_requests'),
      (snap) => setAllRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TutorRequest))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'tutor_requests')
    );

    const unsubBook = onSnapshot(
      collection(db, 'bookings'),
      (snap) => setAllBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Booking))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'bookings')
    );

    const unsubPay = onSnapshot(
      collection(db, 'payments'),
      (snap) => setAllPayments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentRecord))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'payments')
    );

    const unsubTk = onSnapshot(
      collection(db, 'support_tickets'),
      (snap) => setAllTickets(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SupportTicket))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'support_tickets')
    );

    const unsubLogs = onSnapshot(
      collection(db, 'admin_logs'),
      (snap) => setAdminLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminLog))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'admin_logs')
    );

    const unsubAdmins = onSnapshot(
      collection(db, 'admins'),
      (snap) => setAllAdmins(snap.docs.map((d) => d.data() as AdminRecord)),
      (error) => handleFirestoreError(error, OperationType.LIST, 'admins')
    );

    // Admin Corporate Listeners
    const unsubOrgs = onSnapshot(
      collection(db, 'organizations'),
      (snap) =>
        setAllOrganizations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Organization))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'organizations')
    );

    const unsubCorpTrainers = onSnapshot(
      collection(db, 'corporate_trainers'),
      async (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CorporateTrainer));
        setAllCorporateTrainers(list);
        if (list.length === 0) {
          try {
            for (const st of SEED_CORPORATE_TRAINERS) {
              const { id: trainerDocId, ...trainerPayload } = st;
              await setDoc(doc(db, 'corporate_trainers', trainerDocId), {
                ...trainerPayload,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            }
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, 'corporate_trainers');
          }
        }
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'corporate_trainers')
    );

    const unsubAllPortfolios = onSnapshot(
      collection(db, 'trainer_portfolio_items'),
      (snap) =>
        setAllTrainerPortfolioItems(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainerPortfolioItem))
        ),
      (error) => handleFirestoreError(error, OperationType.LIST, 'trainer_portfolio_items')
    );

    const unsubAllSelections = onSnapshot(
      collection(db, 'trainer_selection_requests'),
      (snap) =>
        setAllTrainerSelections(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainerSelectionRequest))
        ),
      (error) => handleFirestoreError(error, OperationType.LIST, 'trainer_selection_requests')
    );

    const unsubAllNegotiations = onSnapshot(
      collection(db, 'corporate_negotiations'),
      (snap) =>
        setAllCorporateNegotiations(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as CorporateNegotiation))
        ),
      (error) => handleFirestoreError(error, OperationType.LIST, 'corporate_negotiations')
    );

    const unsubAllAssignments = onSnapshot(
      collection(db, 'trainer_assignment_agreements'),
      (snap) =>
        setAllTrainerAssignments(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainerAssignmentAgreement))
        ),
      (error) => handleFirestoreError(error, OperationType.LIST, 'trainer_assignment_agreements')
    );

    const unsubAllCompensations = onSnapshot(
      collection(db, 'trainer_compensation_records'),
      (snap) =>
        setAllTrainerCompensations(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainerCompensationRecord))
        ),
      (error) => handleFirestoreError(error, OperationType.LIST, 'trainer_compensation_records')
    );

    const unsubAllRefunds = onSnapshot(
      collection(db, 'corporate_refunds'),
      (snap) =>
        setAllCorporateRefunds(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as CorporateRefundRecord))
        ),
      (error) => handleFirestoreError(error, OperationType.LIST, 'corporate_refunds')
    );

    const unsubCorpReqs = onSnapshot(
      collection(db, 'corporate_requests'),
      (snap) =>
        setAllCorporateRequests(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as CorporateRequest))
        ),
      (error) => handleFirestoreError(error, OperationType.LIST, 'corporate_requests')
    );

    const unsubCorpProps = onSnapshot(
      collection(db, 'training_proposals'),
      (snap) =>
        setAllTrainingProposals(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingProposal))
        ),
      (error) => handleFirestoreError(error, OperationType.LIST, 'training_proposals')
    );

    const unsubCorpQuotes = onSnapshot(
      collection(db, 'training_quotations'),
      (snap) =>
        setAllTrainingQuotations(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingQuotation))
        ),
      (error) => handleFirestoreError(error, OperationType.LIST, 'training_quotations')
    );

    const unsubCorpContracts = onSnapshot(
      collection(db, 'training_contracts'),
      (snap) =>
        setAllTrainingContracts(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingContract))
        ),
      (error) => handleFirestoreError(error, OperationType.LIST, 'training_contracts')
    );

    const unsubCorpScheds = onSnapshot(
      collection(db, 'training_schedules'),
      (snap) =>
        setAllTrainingSchedules(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingSchedule))
        ),
      (error) => handleFirestoreError(error, OperationType.LIST, 'training_schedules')
    );

    const unsubCorpAtt = onSnapshot(
      collection(db, 'training_attendance'),
      (snap) =>
        setAllTrainingAttendance(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingAttendance))
        ),
      (error) => handleFirestoreError(error, OperationType.LIST, 'training_attendance')
    );

    const unsubCorpReps = onSnapshot(
      collection(db, 'training_reports'),
      (snap) =>
        setAllTrainingReports(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingReport))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'training_reports')
    );

    const unsubCorpInvs = onSnapshot(
      collection(db, 'corporate_invoices'),
      (snap) =>
        setAllCorporateInvoices(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as CorporateInvoice))
        ),
      (error) => handleFirestoreError(error, OperationType.LIST, 'corporate_invoices')
    );

    // Admin Contact Protection Listeners
    const unsubAllConvs = onSnapshot(
      collection(db, 'conversations'),
      (snap) => setAllConversations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Conversation))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'conversations')
    );

    const unsubAllMsgs = onSnapshot(
      collection(db, 'messages'),
      (snap) => setAllMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'messages')
    );

    const unsubAllFlags = onSnapshot(
      collection(db, 'moderation_flags'),
      (snap) => setAllModerationFlags(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ModerationFlag))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'moderation_flags')
    );

    const unsubAllMsgReports = onSnapshot(
      collection(db, 'message_reports'),
      (snap) => setAllMessageReports(snap.docs.map((d) => ({ id: d.id, ...d.data() } as MessageReport))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'message_reports')
    );

    const unsubAllViolations = onSnapshot(
      collection(db, 'user_violations'),
      (snap) => setAllUserViolations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as UserViolation))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'user_violations')
    );

    const unsubAllRestrictions = onSnapshot(
      collection(db, 'messaging_restrictions'),
      (snap) =>
        setAllMessagingRestrictions(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as MessagingRestriction))
        ),
      (error) => handleFirestoreError(error, OperationType.LIST, 'messaging_restrictions')
    );

    const unsubAllModActions = onSnapshot(
      collection(db, 'moderation_actions'),
      (snap) =>
        setAllModerationActions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ModerationAction))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'moderation_actions')
    );

    const unsubAllAuditLogs = onSnapshot(
      collection(db, 'audit_logs'),
      (snap) => setAllAuditLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLog))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'audit_logs')
    );

    const unsubModSettings = onSnapshot(
      doc(db, 'platform_moderation_settings', 'default'),
      (snap) => {
        if (snap.exists()) {
          setModerationSettings({ id: snap.id, ...snap.data() } as PlatformModerationSetting);
        } else {
          setModerationSettings(null);
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'platform_moderation_settings/default')
    );

    return () => {
      unsubUsers();
      unsubTutors();
      unsubDocs();
      unsubStudents();
      unsubReq();
      unsubBook();
      unsubPay();
      unsubTk();
      unsubLogs();
      unsubAdmins();
      unsubOrgs();
      unsubCorpTrainers();
      unsubAllPortfolios();
      unsubAllSelections();
      unsubAllNegotiations();
      unsubAllAssignments();
      unsubAllCompensations();
      unsubAllRefunds();
      unsubCorpReqs();
      unsubCorpProps();
      unsubCorpQuotes();
      unsubCorpContracts();
      unsubCorpScheds();
      unsubCorpAtt();
      unsubCorpReps();
      unsubCorpInvs();
      unsubAllConvs();
      unsubAllMsgs();
      unsubAllFlags();
      unsubAllMsgReports();
      unsubAllViolations();
      unsubAllRestrictions();
      unsubAllModActions();
      unsubAllAuditLogs();
      unsubModSettings();
    };
  }, [authReady, firebaseUser, isAdmin, serverAdminVerified, route]);

  const discoverableTutors = useMemo(() => {
    return publicTutors.length > 0 ? publicTutors : SEED_TUTORS;
  }, [publicTutors]);

  const selectedTutor = useMemo(() => {
    if (!selectedTutorId) return null;
    return discoverableTutors.find((t) => t.id === selectedTutorId) || null;
  }, [discoverableTutors, selectedTutorId]);

  const handleGoogleSignIn = async (chosenRole: SignupRoleChoice) => {
    setAuthError('');
    setPendingRoleChoice(chosenRole);
    pendingRoleRef.current = chosenRole;
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const userSnap = await getDoc(doc(db, 'users', cred.user.uid));
      const storedRole = userSnap.exists() ? (userSnap.data() as UserAccount).role : chosenRole;
      const effectiveRole = storedRole === 'admin' ? chosenRole : storedRole;
      setAuthModalOpen(false);
      if (
        route === 'home' ||
        route === 'parent-dashboard' ||
        route === 'tutor-dashboard' ||
        route === 'organization-dashboard'
      ) {
        if (effectiveRole === 'organization') {
          setRoute('organization-dashboard');
        } else if (effectiveRole === 'tutor' || effectiveRole === 'trainer') {
          setRoute(userSnap.exists() ? 'tutor-dashboard' : 'become-tutor');
        } else {
          setRoute('parent-dashboard');
        }
      }
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : 'Google Sign-In failed. Please try again.'
      );
    }
  };

  const handleAdminGoogleSignIn = async () => {
    setAdminAuthError('');
    try {
      const adminProvider = new GoogleAuthProvider();
      adminProvider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, adminProvider);
      const user = cred.user;
      const bootstrapped = Boolean(
        user.emailVerified &&
          user.email &&
          user.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()
      );
      let hasAdminDoc = false;
      try {
        const adminSnap = await getDoc(doc(db, 'admins', user.uid));
        hasAdminDoc = adminSnap.exists();
      } catch {
        hasAdminDoc = false;
      }
      if (!bootstrapped && !hasAdminDoc) {
        setServerAdminVerified(false);
        setAdminAuthError(
          `Access denied for ${user.email || 'this account'}. This account does not have TutorBridge administrator privileges.`
        );
        return;
      }
      const token = await user.getIdToken();
      const verifyRes = await fetch('/api/admin/verify', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!verifyRes.ok) {
        const body = (await verifyRes.json().catch(() => ({}))) as { error?: string };
        setServerAdminVerified(false);
        setAdminAuthError(body.error || 'Server-side administrator verification failed.');
        return;
      }
      const verifyData = (await verifyRes.json()) as { authorized?: boolean };
      if (!verifyData.authorized) {
        setServerAdminVerified(false);
        setAdminAuthError('Administrator authorization could not be confirmed.');
        return;
      }
      setServerAdminVerified(true);
      setRoute('admin');
      window.history.replaceState(null, '', '/admin');
    } catch (error) {
      setServerAdminVerified(false);
      setAdminAuthError(
        error instanceof Error ? error.message : 'Administrator Google Sign-In failed.'
      );
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setServerAdminVerified(false);
    window.history.pushState(null, '', '/');
    setRoute('home');
  };

  const handleAdminSignOut = async () => {
    await signOut(auth);
    setServerAdminVerified(false);
    setAdminAuthError('');
    window.history.replaceState(null, '', '/admin');
    setRoute('admin');
  };

  const navigate = (nextRoute: AppRoute) => {
    if (nextRoute === 'admin') {
      window.history.pushState(null, '', '/admin');
    } else if (isAdminLocation()) {
      window.history.pushState(null, '', '/');
    }
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleFavorite = (tutorId: string) => {
    setFavoriteIds((prev) => {
      const next = prev.includes(tutorId) ? prev.filter((id) => id !== tutorId) : [...prev, tutorId];
      localStorage.setItem('tb_favorites', JSON.stringify(next));
      return next;
    });
  };

  const handleStartTutorConversation = async (tutor: TutorProfile) => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    const existing = userConversations.find(
      (c) =>
        c.conversationType === 'parent_tutor' &&
        c.participantUids.includes(currentUser.uid) &&
        c.participantUids.includes(tutor.userId)
    );
    if (existing) {
      setInitialParentConvId(existing.id);
      navigate('parent-dashboard');
      return;
    }
    try {
      const convId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const participantUids = Array.from(new Set([currentUser.uid, tutor.userId]));
      if (participantUids.length < 2) {
        participantUids.push('tutorbridge-support');
      }
      await setDoc(doc(db, 'conversations', convId), {
        conversationType: 'parent_tutor',
        participantUids,
        participantSummary: clampText(`${currentUser.fullName} · ${tutor.fullName}`, 240),
        relatedType: 'general',
        relatedId: tutor.id,
        subject: clampText(`Tutoring Inquiry — ${tutor.fullName}`, 160),
        lastMessagePreview: 'Conversation started via TutorBridge Secure Messaging',
        lastSenderUid: currentUser.uid,
        unreadByUids: participantUids.filter((u) => u !== currentUser.uid),
        status: 'active',
        createdByUid: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setInitialParentConvId(convId);
      navigate('parent-dashboard');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'conversations');
    }
  };

  // Private Admin Route renders completely separate interface (no public navbar/footer)
  if (route === 'admin') {
    return (
      <AdminDashboard
        authReady={authReady && !adminVerifyBusy}
        firebaseUid={firebaseUser?.uid || null}
        firebaseEmail={firebaseUser?.email || null}
        firebaseEmailVerified={Boolean(firebaseUser?.emailVerified)}
        adminAuthError={adminAuthError}
        currentUser={currentUser}
        isAdmin={isAdmin && serverAdminVerified}
        admins={allAdmins}
        users={allUsers}
        studentsCount={allStudentsCount}
        tutors={allTutors}
        tutorDocuments={allTutorDocs}
        tutorRequests={allRequests}
        bookings={allBookings}
        payments={allPayments}
        supportTickets={allTickets}
        adminLogs={adminLogs}
        organizations={allOrganizations}
        corporateTrainers={allCorporateTrainers}
        trainerPortfolioItems={allTrainerPortfolioItems}
        trainerSelectionRequests={allTrainerSelections}
        corporateNegotiations={allCorporateNegotiations}
        trainerAssignmentAgreements={allTrainerAssignments}
        trainerCompensationRecords={allTrainerCompensations}
        corporateRefunds={allCorporateRefunds}
        corporateRequests={allCorporateRequests}
        trainingProposals={allTrainingProposals}
        trainingQuotations={allTrainingQuotations}
        trainingContracts={allTrainingContracts}
        trainingSchedules={allTrainingSchedules}
        trainingAttendance={allTrainingAttendance}
        trainingReports={allTrainingReports}
        corporateInvoices={allCorporateInvoices}
        categories={categories}
        conversations={allConversations}
        messages={allMessages}
        moderationFlags={allModerationFlags}
        messageReports={allMessageReports}
        userViolations={allUserViolations}
        messagingRestrictions={allMessagingRestrictions}
        moderationActions={allModerationActions}
        auditLogs={allAuditLogs}
        moderationSettings={moderationSettings}
        onAdminSignIn={handleAdminGoogleSignIn}
        onSignOut={handleAdminSignOut}
        onExitAdmin={() => navigate('home')}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#142B46]">
      <Navbar
        route={route}
        onNavigate={navigate}
        lang={lang}
        onLanguageChange={handleLanguageChange}
        currentUser={currentUser}
        onSignInClick={() => setAuthModalOpen(true)}
      />

      {/* Discreet Workspace Switcher Strip shown ONLY when authenticated inside a dashboard */}
      {currentUser &&
        (route === 'parent-dashboard' ||
          route === 'tutor-dashboard' ||
          route === 'organization-dashboard') && (
          <div className="bg-[#142B46] text-white border-b border-slate-800 px-4 sm:px-6 lg:px-8 py-2">
            <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('parent-dashboard')}
                  className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                    route === 'parent-dashboard'
                      ? 'bg-white text-[#142B46]'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Parent & Student View
                </button>
                <button
                  type="button"
                  onClick={() => navigate('tutor-dashboard')}
                  className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                    route === 'tutor-dashboard'
                      ? 'bg-white text-[#142B46]'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Tutor / Trainer View
                </button>
                <button
                  type="button"
                  onClick={() => navigate('organization-dashboard')}
                  className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                    route === 'organization-dashboard'
                      ? 'bg-white text-[#142B46]'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Organization Portal
                </button>
              </div>
            </div>
          </div>
        )}

      <main className="flex-1">
        {route === 'home' && (
          <HomePage
            lang={lang}
            onLanguageChange={handleLanguageChange}
            tutors={discoverableTutors}
            onNavigate={navigate}
            onSelectTutor={(tutor) => {
              setSelectedTutorId(tutor.id);
              navigate('tutor-profile');
            }}
            onSearchFilter={(params) => setSearchFilter(params)}
          />
        )}

        {route === 'tutors' && (
          <FindTutorPage
            lang={lang}
            tutors={discoverableTutors}
            initialQuery={searchFilter.query}
            initialSubCity={searchFilter.subCity}
            initialDivision={searchFilter.division}
            favoriteIds={favoriteIds}
            onToggleFavorite={toggleFavorite}
            onSelectTutor={(tutor) => {
              setSelectedTutorId(tutor.id);
              navigate('tutor-profile');
            }}
            onRequestMatching={() => navigate('request-matching')}
          />
        )}

        {route === 'tutor-profile' &&
          (selectedTutor ? (
            <TutorProfilePage
              lang={lang}
              tutor={selectedTutor}
              reviews={reviews}
              onBack={() => navigate('tutors')}
              onBookClick={(tutor) => setBookingTutor(tutor)}
              onMessageTutor={handleStartTutorConversation}
            />
          ) : (
            <FindTutorPage
              lang={lang}
              tutors={discoverableTutors}
              favoriteIds={favoriteIds}
              onToggleFavorite={toggleFavorite}
              onSelectTutor={(tutor) => {
                setSelectedTutorId(tutor.id);
                navigate('tutor-profile');
              }}
              onRequestMatching={() => navigate('request-matching')}
            />
          ))}

        {route === 'request-matching' && (
          <RequestMatchingPage
            lang={lang}
            currentUser={currentUser}
            onRequireSignIn={() => setAuthModalOpen(true)}
            onSuccessNavigate={() => navigate('parent-dashboard')}
          />
        )}

        {route === 'corporate' && (
          <CorporateTrainingPage
            lang={lang}
            currentUser={currentUser}
            customCategories={categories}
            onRequireSignIn={() => setAuthModalOpen(true)}
            onNavigate={navigate}
          />
        )}

        {route === 'become-tutor' && (
          <BecomeTutorPage
            lang={lang}
            currentUser={currentUser}
            existingTutorProfile={ownTutorProfile}
            existingCorporateTrainer={ownCorporateTrainer}
            customCategories={categories}
            onRequireSignIn={() => setAuthModalOpen(true)}
            onGoToTutorDashboard={() => navigate('tutor-dashboard')}
          />
        )}

        {(route === 'parent-dashboard' ||
          route === 'tutor-dashboard' ||
          route === 'organization-dashboard') &&
          !currentUser && (
            <div className="bg-[#F5F7FA] min-h-[70vh] flex items-center justify-center p-6">
              <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4">
                <h2 className="font-display text-xl font-bold text-[#142B46]">
                  Sign In to Access Your Dashboard
                </h2>
                <p className="text-sm text-slate-600">
                  Sign in with your Google account to manage student profiles, bookings, corporate
                  training requests, invoices, and progress reports.
                </p>
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="px-6 py-2.5 bg-[#142B46] text-white text-sm font-semibold rounded-lg"
                >
                  Sign In
                </button>
              </div>
            </div>
          )}

        {route === 'parent-dashboard' && currentUser && (
          <ParentDashboard
            currentUser={currentUser}
            students={students}
            bookings={parentBookings}
            payments={payments}
            tutorRequests={tutorRequests}
            progressReports={parentProgress}
            supportTickets={supportTickets}
            tutors={discoverableTutors}
            favoriteIds={favoriteIds}
            conversations={userConversations}
            messages={userMessages}
            messagingRestriction={ownRestriction}
            userViolations={ownViolations}
            initialConversationId={initialParentConvId}
            onSignOut={handleSignOut}
            onNavigate={navigate}
            onSelectTutor={(tutor) => {
              setSelectedTutorId(tutor.id);
              navigate('tutor-profile');
            }}
            onBookTutor={(tutor) => setBookingTutor(tutor)}
          />
        )}

        {route === 'tutor-dashboard' && currentUser && (
          <TutorDashboard
            key={`${ownTutorProfile?.id || 'no-tutor'}_${ownCorporateTrainer?.id || 'no-trainer'}`}
            currentUser={currentUser}
            tutorProfile={ownTutorProfile}
            corporateTrainerProfile={ownCorporateTrainer}
            tutorDocuments={ownTutorDocs}
            bookings={tutorBookings}
            progressReports={tutorProgress}
            reviews={reviews}
            trainingProposals={trainerProposals}
            trainingContracts={trainerContracts}
            trainingSchedules={trainerSchedules}
            trainingAttendance={trainerAttendance}
            trainingReports={trainerReports}
            portfolioItems={ownPortfolioItems}
            trainerAssignments={trainerAssignments}
            trainerCompensations={trainerCompensations}
            trainerNegotiations={trainerNegotiations}
            conversations={userConversations}
            messages={userMessages}
            messagingRestriction={ownRestriction}
            userViolations={ownViolations}
            onSignOut={handleSignOut}
            onNavigate={navigate}
          />
        )}

        {route === 'organization-dashboard' && currentUser && (
          <OrganizationDashboard
            key={ownOrganization?.id || 'no-org'}
            currentUser={currentUser}
            organization={ownOrganization}
            corporateTrainers={approvedCorporateTrainers.map((t) => ({
              ...t,
              proposedDailyRateEtb: 0,
            }))}
            approvedPortfolioItems={approvedPortfolioItems}
            savedTrainers={orgSavedTrainers}
            selectionRequests={orgSelectionRequests}
            negotiations={orgNegotiations}
            refunds={orgRefunds}
            requests={orgRequests}
            proposals={orgProposals}
            quotations={orgQuotations}
            contracts={orgContracts}
            schedules={orgSchedules}
            participants={orgParticipants}
            attendance={orgAttendance}
            reports={orgReports}
            invoices={orgInvoices}
            feedbacks={orgFeedbacks}
            supportTickets={supportTickets}
            customCategories={categories}
            conversations={userConversations}
            messages={userMessages}
            messagingRestriction={ownRestriction}
            userViolations={ownViolations}
            onSignOut={handleSignOut}
            onNavigate={navigate}
          />
        )}
      </main>

      <Footer
        lang={lang}
        onLanguageChange={handleLanguageChange}
        onNavigate={navigate}
        onOpenPolicy={(p) => setPolicyModal(p)}
      />

      <AuthModal
        open={authModalOpen}
        lang={lang}
        onClose={() => setAuthModalOpen(false)}
        onGoogleSignIn={handleGoogleSignIn}
        errorMsg={authError}
      />

      {bookingTutor && (
        <BookingModal
          tutor={bookingTutor}
          lang={lang}
          currentUser={currentUser}
          students={students}
          onClose={() => setBookingTutor(null)}
          onRequireSignIn={() => {
            setBookingTutor(null);
            setAuthModalOpen(true);
          }}
          onBookingCreated={() => navigate('parent-dashboard')}
        />
      )}

      <PolicyModal policy={policyModal} lang={lang} onClose={() => setPolicyModal(null)} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}
