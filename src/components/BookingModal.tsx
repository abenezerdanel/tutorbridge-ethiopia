import React, { useState } from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { LOCALES, translateGrade, translateSubCity, translateSubject } from '../i18n';
import {
  ADDIS_SUB_CITIES,
  COMMISSION_RATE,
  LanguageCode,
  MAX_TEXT_LENGTHS,
  StudentProfile,
  TutorProfile,
  UserAccount,
  clampText,
} from '../types';

interface BookingModalProps {
  tutor: TutorProfile | null;
  lang: LanguageCode;
  currentUser: UserAccount | null;
  students: StudentProfile[];
  onClose: () => void;
  onRequireSignIn: () => void;
  onBookingCreated: () => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  tutor,
  lang,
  currentUser,
  students,
  onClose,
  onRequireSignIn,
  onBookingCreated,
}) => {
  const dict = LOCALES[lang];
  const t = dict.bookingModal;

  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.id || '');
  const [customStudentName, setCustomStudentName] = useState('');
  const [subject, setSubject] = useState(tutor?.subjects[0] || '');
  const [sessionCount, setSessionCount] = useState<number>(4);
  const [neighborhood, setNeighborhood] = useState<string>(
    tutor?.subCities[0] || ADDIS_SUB_CITIES[0]
  );
  const [scheduleSummary, setScheduleSummary] = useState(t.defaultSchedule);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  if (!tutor) return null;

  const rate = tutor.hourlyRateEtb;
  const totalAmount = Math.round(rate * sessionCount);
  const commissionAmount = Math.round(totalAmount * COMMISSION_RATE);
  const tutorPayout = totalAmount - commissionAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireSignIn();
      return;
    }

    const chosenStudent = students.find((s) => s.id === selectedStudentId);
    const finalStudentName = chosenStudent
      ? chosenStudent.fullName
      : clampText(customStudentName || currentUser.fullName, MAX_TEXT_LENGTHS.fullName);

    if (finalStudentName.length < 2) {
      setErrorMsg(t.errors.studentRequired);
      return;
    }
    if (!scheduleSummary.trim()) {
      setErrorMsg(t.errors.scheduleRequired);
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      await addDoc(collection(db, 'bookings'), {
        parentId: currentUser.uid,
        parentName: clampText(currentUser.fullName, MAX_TEXT_LENGTHS.fullName),
        studentId: chosenStudent?.id || '',
        studentName: finalStudentName,
        tutorId: tutor.id,
        tutorUserId: tutor.userId,
        tutorName: clampText(tutor.fullName, MAX_TEXT_LENGTHS.fullName),
        subject: clampText(subject || tutor.subjects[0], MAX_TEXT_LENGTHS.subject),
        sessionCount,
        ratePerSessionEtb: rate,
        totalAmountEtb: totalAmount,
        commissionRate: COMMISSION_RATE,
        commissionAmountEtb: commissionAmount,
        tutorPayoutEtb: tutorPayout,
        locationNeighborhood: clampText(neighborhood, 120),
        scheduleSummary: clampText(scheduleSummary, 240),
        status: 'pending_tutor',
        paymentStatus: 'unpaid',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSuccess(true);
      setTimeout(() => {
        onBookingCreated();
        onClose();
      }, 1100);
    } catch (error) {
      setErrorMsg(
        error instanceof Error && error.message.includes('Missing or insufficient permissions')
          ? t.errors.permissions
          : t.errors.generic
      );
      handleFirestoreError(error, OperationType.CREATE, 'bookings');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#142B46]/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <p className="text-xs font-medium text-[#39836B] mb-1">{t.kicker}</p>
            <h2 className="font-display text-xl font-bold text-[#142B46]">
              {t.titlePrefix} {tutor.fullName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.closeAria}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="py-10 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-[#39836B] mx-auto" />
            <h3 className="font-display text-lg font-bold text-[#142B46]">{t.successTitle}</h3>
            <p className="text-sm text-slate-600">
              {t.successBodyPrefix} {tutor.fullName}. {t.successBodySuffix}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="pt-5 space-y-4">
            {!currentUser && (
              <div className="p-4 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm text-[#142B46]">
                {t.signInBanner}
              </div>
            )}

            {students.length > 0 ? (
              <div>
                <label className="block text-xs font-semibold text-[#142B46] mb-1.5">
                  {t.selectStudentLabel}
                </label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white text-[#142B46] focus:outline-none focus:ring-2 focus:ring-[#142B46]"
                >
                  {students.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.fullName} ({translateGrade(lang, st.gradeLevel)})
                    </option>
                  ))}
                  <option value="">{t.otherLearnerOption}</option>
                </select>
              </div>
            ) : null}

            {(students.length === 0 || selectedStudentId === '') && (
              <div>
                <label className="block text-xs font-semibold text-[#142B46] mb-1.5">
                  {t.studentNameLabel}
                </label>
                <input
                  type="text"
                  required
                  maxLength={MAX_TEXT_LENGTHS.fullName}
                  placeholder={t.studentNamePlaceholder}
                  value={customStudentName}
                  onChange={(e) => setCustomStudentName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#142B46]"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#142B46] mb-1.5">
                  {t.subjectLabel}
                </label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#142B46]"
                >
                  {tutor.subjects.map((sub) => (
                    <option key={sub} value={sub}>
                      {translateSubject(lang, sub)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#142B46] mb-1.5">
                  {t.sessionsLabel}
                </label>
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={sessionCount}
                  onChange={(e) =>
                    setSessionCount(Math.max(1, Math.min(40, Number(e.target.value) || 1)))
                  }
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-[#142B46]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#142B46] mb-1.5">
                {t.locationLabel}
              </label>
              <select
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#142B46]"
              >
                {tutor.subCities.map((sc) => (
                  <option key={sc} value={sc}>
                    {translateSubCity(lang, sc)}
                  </option>
                ))}
                {ADDIS_SUB_CITIES.filter((sc) => !tutor.subCities.includes(sc)).map((sc) => (
                  <option key={sc} value={sc}>
                    {translateSubCity(lang, sc)} ({t.requestTravel})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#142B46] mb-1.5">
                {t.scheduleLabel}
              </label>
              <input
                type="text"
                required
                maxLength={240}
                value={scheduleSummary}
                onChange={(e) => setScheduleSummary(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#142B46]"
              />
            </div>

            {/* Transparent Price Breakdown */}
            <div className="bg-[#F5F7FA] border border-slate-200 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>
                  {sessionCount} {t.sessionsUnit} × {rate.toLocaleString()} {dict.common.etb}
                </span>
                <span className="font-mono-tabular font-medium text-[#142B46]">
                  {totalAmount.toLocaleString()} {dict.common.etb}
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>{t.feeNote}</span>
                <span className="font-mono-tabular">
                  {commissionAmount.toLocaleString()} {dict.common.etb}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between font-semibold text-[#142B46]">
                <span>{t.totalDueLabel}</span>
                <span className="font-mono-tabular">
                  {totalAmount.toLocaleString()} {dict.common.etb}
                </span>
              </div>
            </div>

            {errorMsg && <p className="text-xs text-red-600 font-medium">{errorMsg}</p>}

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-[#142B46]"
              >
                {dict.common.cancel}
              </button>
              {currentUser ? (
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-[#142B46] text-white text-sm font-semibold rounded-lg hover:bg-[#1e3d63] disabled:opacity-60 transition-colors"
                >
                  {submitting ? t.submitBusy : t.submitIdle}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onRequireSignIn}
                  className="px-5 py-2.5 bg-[#F5BD54] text-[#142B46] text-sm font-bold rounded-lg hover:bg-[#e5ad43] transition-colors"
                >
                  {t.signInToBook}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
