export type UserRole = 'parent' | 'tutor' | 'trainer' | 'organization' | 'admin';
export type LanguageCode = 'en' | 'am';

export type ServiceDivision =
  | 'Academic Tutoring'
  | 'Languages & Personal Development'
  | 'Professional & Practical Skills'
  | 'Corporate & Organizational Training';

export const SERVICE_DIVISIONS: ServiceDivision[] = [
  'Academic Tutoring',
  'Languages & Personal Development',
  'Professional & Practical Skills',
];

export const ALL_SERVICE_DIVISIONS: ServiceDivision[] = [
  ...SERVICE_DIVISIONS,
  'Corporate & Organizational Training',
];

export const ADDIS_SUB_CITIES = [
  'Bole',
  'Yeka',
  'Kirkos',
  'Arada',
  'Lideta',
  'Nifas Silk-Lafto',
  'Kolfe Keranio',
  'Gulele',
  'Akaki Kality',
  'Lemi Kura',
  'Addis Ketema',
] as const;

export const GRADE_LEVELS = [
  'Kindergarten',
  'Primary (Grades 1–6)',
  'Middle (Grades 7–8)',
  'Secondary (Grades 9–12)',
  'National Exam Prep (Grade 12)',
  'University Level',
  'Adult / Professional',
] as const;

export const AVAILABILITY_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export const ORGANIZATION_TYPES = [
  'Private Company',
  'NGO',
  'Government Institution',
  'School / University',
  'Development Organization',
  'SME',
  'Other',
] as const;

export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

export const CORPORATE_DURATIONS = [
  'One day',
  'Two to three days',
  'One week',
  'Several weeks',
  'Monthly / Customized',
] as const;

export type CorporateDuration = (typeof CORPORATE_DURATIONS)[number];

export const COMMISSION_RATE = 0.15;

export interface UserAccount {
  uid: string;
  email: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  city?: string;
  subCity?: string;
  languagePreference?: LanguageCode;
  status: 'active' | 'suspended';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CategoryRecord {
  id: string;
  division: string;
  name: string;
  topics: string[];
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TutorProfile {
  id: string;
  userId: string;
  fullName: string;
  headline: string;
  bio: string;
  photoUrl?: string;
  qualifications: string;
  experienceYears: number;
  division: 'Academic Tutoring' | 'Languages & Personal Development' | 'Professional & Practical Skills';
  subjects: string[];
  grades: string[];
  city: string;
  subCities: string[];
  hourlyRateEtb: number;
  availabilityDays: string[];
  languages: string[];
  ratingAvg: number;
  reviewCount: number;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  isVerified: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TutorDocument {
  id: string;
  tutorId: string;
  userId: string;
  docType: 'national_id' | 'degree_certificate' | 'teaching_license' | 'reference_letter';
  title: string;
  referenceCode: string;
  notes?: string;
  status: 'pending' | 'verified' | 'rejected';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StudentProfile {
  id: string;
  parentId: string;
  fullName: string;
  age: number;
  gradeLevel: string;
  schoolName?: string;
  subjectsNeeded: string[];
  learningGoals?: string;
  preferredSchedule?: string;
  parentConsent: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TutorRequest {
  id: string;
  parentId: string;
  parentName: string;
  studentName: string;
  gradeLevel: string;
  division: 'Academic Tutoring' | 'Languages & Personal Development' | 'Professional & Practical Skills';
  subjects: string[];
  city: string;
  subCity: string;
  preferredSchedule: string;
  budgetMaxEtb: number;
  notes?: string;
  status: 'pending_review' | 'candidates_proposed' | 'matched' | 'cancelled';
  proposedTutorId?: string;
  proposedTutorName?: string;
  adminNotes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Booking {
  id: string;
  parentId: string;
  parentName: string;
  studentId?: string;
  studentName: string;
  tutorId: string;
  tutorUserId: string;
  tutorName: string;
  subject: string;
  sessionCount: number;
  ratePerSessionEtb: number;
  totalAmountEtb: number;
  commissionRate: number;
  commissionAmountEtb: number;
  tutorPayoutEtb: number;
  locationNeighborhood: string;
  scheduleSummary: string;
  status: 'pending_tutor' | 'pending_payment' | 'confirmed' | 'completed' | 'cancelled';
  paymentStatus: 'unpaid' | 'submitted' | 'verified' | 'refunded';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PaymentRecord {
  id: string;
  bookingId: string;
  parentId: string;
  tutorId: string;
  tutorUserId: string;
  method: 'Telebirr' | 'CBE Birr' | 'Bank Transfer';
  transactionRef: string;
  amountEtb: number;
  commissionEtb: number;
  tutorPayoutEtb: number;
  status: 'pending_verification' | 'verified' | 'rejected' | 'refunded';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ProgressReport {
  id: string;
  bookingId: string;
  parentId: string;
  tutorId: string;
  tutorUserId: string;
  tutorName: string;
  studentName: string;
  subject: string;
  sessionDate: string;
  attendanceStatus: 'present' | 'absent' | 'rescheduled';
  summary: string;
  parentComment?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Review {
  id: string;
  bookingId: string;
  tutorId: string;
  parentId: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt?: unknown;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  category: 'general' | 'payment' | 'reschedule' | 'safeguarding' | 'corporate';
  subject: string;
  message: string;
  status: 'open' | 'in_review' | 'resolved';
  adminResponse?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AdminLog {
  id: string;
  adminUid: string;
  action: string;
  targetCollection: string;
  targetId: string;
  details?: string;
  createdAt?: unknown;
}

export interface AdminRecord {
  uid: string;
  email: string;
  grantedAt?: unknown;
}

// =========================================================================
// V1.1 CORPORATE TRAINING TYPES
// =========================================================================

export interface Organization {
  id: string;
  ownerUid: string;
  name: string;
  orgType: OrganizationType;
  industry: string;
  contactPerson: string;
  officialEmail: string;
  phone: string;
  address: string;
  logoUrl?: string;
  billingInfo?: string;
  status: 'pending' | 'approved' | 'suspended';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface OrganizationUser {
  id: string;
  organizationId: string;
  userId: string;
  role: 'owner' | 'coordinator' | 'viewer';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CorporateRequest {
  id: string;
  organizationId: string;
  ownerUid: string;
  organizationName: string;
  category: string;
  topics: string[];
  objectives: string;
  participantCount: number;
  preferredDates: string;
  duration: CorporateDuration;
  location: string;
  budgetMinEtb: number;
  budgetMaxEtb: number;
  status:
    | 'pending_review'
    | 'trainers_sourced'
    | 'proposal_sent'
    | 'approved'
    | 'in_progress'
    | 'completed'
    | 'rejected';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CorporateTrainer {
  id: string;
  userId: string;
  fullName: string;
  headline: string;
  bio?: string;
  photoUrl?: string;
  qualifications: string;
  certifications?: string[];
  workExperience?: string;
  experienceYears: number;
  categories: string[];
  topics: string[];
  pastProjects?: string[];
  portfolioSamples?: string[];
  methodology: string;
  availability: string;
  preferredLocations: string[];
  languages?: string[];
  ratingAvg?: number;
  reviewCount?: number;
  proposedDailyRateEtb: number;
  isTutorAlso: boolean;
  pendingQualificationUpdate?: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  isVerified: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TrainerPortfolioItem {
  id: string;
  trainerId: string;
  trainerUserId: string;
  title: string;
  category: string;
  summary: string;
  outcomeMetrics?: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNotes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SavedTrainer {
  id: string;
  organizationId: string;
  organizationOwnerUid: string;
  trainerId: string;
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TrainerSelectionRequest {
  id: string;
  organizationId: string;
  organizationOwnerUid: string;
  organizationName: string;
  corporateRequestId?: string;
  selectedTrainerId: string;
  selectedTrainerUserId: string;
  selectedTrainerName: string;
  rankedTrainerIds: string[];
  rankedTrainerNames: string[];
  notes?: string;
  status:
    | 'pending_tutorbridge_review'
    | 'in_coordination'
    | 'approved'
    | 'alternative_suggested'
    | 'rejected';
  suggestedTrainerId?: string;
  suggestedTrainerName?: string;
  adminNotes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CorporateNegotiation {
  id: string;
  targetType: 'organization_quote' | 'trainer_compensation';
  requestId?: string;
  selectionRequestId?: string;
  organizationOwnerUid?: string;
  trainerUserId?: string;
  participantLabel: string;
  proposedAmountEtb: number;
  proposedTerms: string;
  notes?: string;
  status: 'open' | 'agreed' | 'superseded';
  adminUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TrainingProposal {
  id: string;
  requestId: string;
  organizationId: string;
  organizationOwnerUid: string;
  trainerId: string;
  trainerUserId: string;
  trainerName: string;
  trainerQualifications: string;
  trainerMethodology: string;
  proposedSchedule: string;
  status:
    | 'proposed'
    | 'accepted_by_trainer'
    | 'declined_by_trainer'
    | 'approved_by_org'
    | 'rejected_by_org';
  trainerResponseNotes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TrainingQuotation {
  id: string;
  requestId: string;
  proposalId: string;
  organizationId: string;
  organizationOwnerUid: string;
  trainerCompensationEtb: number;
  logisticalExpensesEtb: number;
  serviceFeeEtb: number;
  coordinationFeeEtb?: number;
  additionalChargesEtb?: number;
  totalAmountEtb: number;
  paymentTerms?: string;
  cancellationTerms?: string;
  validityDays?: number;
  pricingNotes?: string;
  status: 'sent' | 'approved' | 'rejected';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TrainingContract {
  id: string;
  requestId: string;
  quotationId: string;
  organizationId: string;
  organizationOwnerUid: string;
  organizationName: string;
  trainerId: string;
  trainerUserId: string;
  trainerName: string;
  title: string;
  agreementNumber?: string;
  totalAmountEtb: number;
  trainerCompensationEtb: number;
  serviceFeeEtb: number;
  paymentTerms: string;
  serviceTermsSummary?: string;
  cancellationTerms?: string;
  governingLawClause?: string;
  orgAcceptedAt?: string;
  orgAcceptedByName?: string;
  orgAcceptedRole?: string;
  replacementHistory?: string[];
  status: 'active' | 'completed' | 'cancelled';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TrainerAssignmentAgreement {
  id: string;
  contractId: string;
  requestId: string;
  trainerId: string;
  trainerUserId: string;
  trainerName: string;
  organizationLabel: string;
  title: string;
  scopeOfWork: string;
  scheduleSummary: string;
  trainerCompensationEtb: number;
  paymentSchedule: string;
  cancellationTerms: string;
  governingLawClause: string;
  trainerAcceptedAt?: string;
  trainerAcceptedName?: string;
  status: 'pending_acceptance' | 'active' | 'completed' | 'cancelled';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TrainerCompensationRecord {
  id: string;
  agreementId: string;
  contractId: string;
  trainerId: string;
  trainerUserId: string;
  trainerName: string;
  amountEtb: number;
  paymentMethod: 'Telebirr' | 'CBE Birr' | 'Bank Transfer';
  transactionRef: string;
  status: 'scheduled' | 'paid' | 'withheld' | 'cancelled';
  paidDate?: string;
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CorporateRefundRecord {
  id: string;
  contractId: string;
  invoiceId?: string;
  organizationId: string;
  organizationOwnerUid: string;
  organizationName: string;
  refundAmountEtb: number;
  cancellationFeeEtb: number;
  reason: string;
  status: 'requested' | 'approved' | 'processed' | 'rejected';
  processedRef?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TrainingSchedule {
  id: string;
  contractId: string;
  organizationId: string;
  organizationOwnerUid: string;
  trainerUserId: string;
  sessionTitle: string;
  sessionDate: string;
  timeRange: string;
  venue: string;
  status: 'scheduled' | 'completed' | 'rescheduled';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TrainingParticipant {
  id: string;
  contractId: string;
  organizationId: string;
  organizationOwnerUid: string;
  fullName: string;
  department?: string;
  email?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TrainingAttendance {
  id: string;
  contractId: string;
  organizationId: string;
  organizationOwnerUid: string;
  trainerUserId: string;
  sessionDate: string;
  presentCount: number;
  totalParticipants: number;
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TrainingReport {
  id: string;
  contractId: string;
  organizationId: string;
  organizationOwnerUid: string;
  trainerUserId: string;
  trainerName: string;
  organizationName: string;
  summary: string;
  outcomesAchieved: string;
  attendanceRatePct: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CorporateInvoice {
  id: string;
  contractId: string;
  organizationId: string;
  organizationOwnerUid: string;
  invoiceNumber: string;
  amountEtb: number;
  trainerCompensationEtb: number;
  serviceFeeEtb: number;
  paymentMethod?: string;
  transactionRef?: string;
  status: 'unpaid' | 'payment_submitted' | 'paid' | 'refunded';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CorporateFeedback {
  id: string;
  contractId: string;
  organizationId: string;
  organizationOwnerUid: string;
  trainerId: string;
  rating: number;
  comment: string;
  createdAt?: unknown;
}

export type AppRoute =
  | 'home'
  | 'tutors'
  | 'tutor-profile'
  | 'request-matching'
  | 'become-tutor'
  | 'corporate'
  | 'parent-dashboard'
  | 'tutor-dashboard'
  | 'organization-dashboard'
  | 'admin';

// =========================================================================
// CONTACT PROTECTION & SECURE MESSAGING TYPES
// =========================================================================

export const CONTACT_PROTECTION_WARNING =
  'To protect your privacy and ensure secure transactions, TutorBridge requires all communication and service arrangements to remain within the platform. Sharing personal contact information or external links is not permitted.';

export type ConversationType =
  | 'parent_tutor'
  | 'student_tutor'
  | 'organization_trainer'
  | 'client_support'
  | 'admin_user';

export type ConversationRelatedType =
  | 'booking'
  | 'tutor_request'
  | 'corporate_request'
  | 'corporate_contract'
  | 'support'
  | 'general';

export interface Conversation {
  id: string;
  conversationType: ConversationType;
  participantUids: string[];
  participantSummary: string;
  guardianUid?: string;
  relatedType: ConversationRelatedType;
  relatedId?: string;
  subject: string;
  lastMessagePreview: string;
  lastSenderUid?: string;
  unreadByUids: string[];
  status: 'active' | 'flagged' | 'locked' | 'archived';
  createdByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Message {
  id: string;
  conversationId: string;
  participantUids: string[];
  senderUid: string;
  senderName: string;
  senderRole: UserRole;
  text: string;
  attachmentName?: string;
  attachmentType?: string;
  attachmentSizeBytes?: number;
  attachmentScanStatus: 'none' | 'clean' | 'flagged';
  moderationStatus: 'approved' | 'flagged' | 'removed';
  moderationReason?: string;
  readByUids: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MessageReport {
  id: string;
  conversationId: string;
  messageId: string;
  reporterUid: string;
  reporterName: string;
  reportedUserUid: string;
  reason:
    | 'contact_sharing'
    | 'off_platform_solicitation'
    | 'harassment'
    | 'inappropriate_attachment'
    | 'other';
  details: string;
  status: 'open' | 'under_review' | 'resolved' | 'dismissed';
  adminNotes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type ModerationViolationType =
  | 'phone_number'
  | 'whatsapp'
  | 'email'
  | 'website_url'
  | 'social_media'
  | 'external_meeting'
  | 'split_contact'
  | 'suspicious_attachment'
  | 'obfuscated_contact'
  | 'uncertain_review';

export interface ModerationFlag {
  id: string;
  userId: string;
  userName: string;
  conversationId: string;
  messageId?: string;
  attemptedText: string;
  violationType: ModerationViolationType;
  detectionResult: 'blocked' | 'flagged_for_review' | 'approved_exception';
  matchedIndicators: string[];
  enforcementAction: 'warning' | 'flagged_only' | 'temp_restriction' | 'admin_review' | 'none';
  reviewStatus: 'pending' | 'confirmed_violation' | 'false_positive' | 'exception_granted';
  reviewedByUid?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserViolation {
  id: string;
  userId: string;
  userName: string;
  conversationId: string;
  violationType: string;
  detectionResult: string;
  enforcementAction: string;
  details: string;
  createdAt?: unknown;
}

export interface MessagingRestriction {
  id: string;
  userId: string;
  userName: string;
  violationCount: number;
  restrictionLevel: 'none' | 'warning' | 'temp_restricted' | 'suspended_review';
  status: 'none' | 'active' | 'lifted';
  reason: string;
  restrictedUntilIso?: string;
  appealStatus: 'none' | 'pending' | 'approved' | 'rejected';
  appealText?: string;
  adminDecisionNotes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ModerationAction {
  id: string;
  adminUid: string;
  targetUserId: string;
  conversationId?: string;
  flagId?: string;
  actionType:
    | 'issue_warning'
    | 'restrict_messaging'
    | 'lift_restriction'
    | 'suspend_account'
    | 'approve_exception'
    | 'dismiss_flag'
    | 'resolve_appeal'
    | 'update_settings';
  notes: string;
  createdAt?: unknown;
}

export interface PlatformModerationSetting {
  id: string;
  key: string;
  blockPhoneNumbers: boolean;
  blockWhatsApp: boolean;
  blockEmails: boolean;
  blockUrls: boolean;
  blockSocialMedia: boolean;
  blockMeetingLinks: boolean;
  detectSplitMessages: boolean;
  scanAttachments: boolean;
  warningThreshold: number;
  tempRestrictionThreshold: number;
  suspensionReviewThreshold: number;
  tempRestrictionHours: number;
  approvedExceptions: string[];
  updatedAt?: unknown;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  actorRole: string;
  eventType: string;
  conversationId?: string;
  targetId?: string;
  summary: string;
  createdAt?: unknown;
}

export const DEFAULT_PLATFORM_MODERATION_SETTINGS: Omit<PlatformModerationSetting, 'id'> = {
  key: 'contact_protection',
  blockPhoneNumbers: true,
  blockWhatsApp: true,
  blockEmails: true,
  blockUrls: true,
  blockSocialMedia: true,
  blockMeetingLinks: true,
  detectSplitMessages: true,
  scanAttachments: true,
  warningThreshold: 1,
  tempRestrictionThreshold: 3,
  suspensionReviewThreshold: 5,
  tempRestrictionHours: 24,
  approvedExceptions: ['tutorbridge.et', 'support@tutorbridge.et'],
};

export const MAX_TEXT_LENGTHS = {
  fullName: 120,
  headline: 160,
  bio: 2000,
  qualifications: 300,
  notes: 1000,
  comment: 800,
  subject: 100,
  transactionRef: 120,
  messageText: 2000,
};

export function clampText(value: string, max: number): string {
  return value.trim().slice(0, max);
}

