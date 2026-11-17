import React, { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { CheckCircle2, ClipboardCheck } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  LOCALES,
  translateDivision,
  translateGrade,
  translateSubCity,
} from '../i18n';
import {
  ADDIS_SUB_CITIES,
  GRADE_LEVELS,
  LanguageCode,
  MAX_TEXT_LENGTHS,
  SERVICE_DIVISIONS,
  ServiceDivision,
  UserAccount,
  clampText,
} from '../types';

interface RequestMatchingPageProps {
  lang: LanguageCode;
  currentUser: UserAccount | null;
  onRequireSignIn: () => void;
  onSuccessNavigate: () => void;
}

export const RequestMatchingPage: React.FC<RequestMatchingPageProps> = ({
  lang,
  currentUser,
  onRequireSignIn,
  onSuccessNavigate,
}) => {
  const dict = LOCALES[lang];
  const t = dict.requestMatching;

  const [studentName, setStudentName] = useState('');
  const [gradeLevel, setGradeLevel] = useState<string>(GRADE_LEVELS[3]);
  const [division, setDivision] = useState<ServiceDivision>('Academic Tutoring');
  const [subjectsText, setSubjectsText] = useState('Mathematics, Physics');
  const [subCity, setSubCity] = useState<string>('Bole');
  const [preferredSchedule, setPreferredSchedule] = useState(
    '3 days per week after 4:00 PM'
  );
  const [budgetMaxEtb, setBudgetMaxEtb] = useState<number>(700);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireSignIn();
      return;
    }

    const subjects = subjectsText
      .split(',')
      .map((s) => clampText(s, 60))
      .filter(Boolean)
      .slice(0, 10);

    if (subjects.length === 0) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'tutor_requests'), {
        parentId: currentUser.uid,
        parentName: clampText(currentUser.fullName, MAX_TEXT_LENGTHS.fullName),
        studentName: clampText(studentName, MAX_TEXT_LENGTHS.fullName),
        gradeLevel,
        division,
        subjects,
        city: 'Addis Ababa',
        subCity,
        preferredSchedule: clampText(preferredSchedule, 200),
        budgetMaxEtb,
        notes: clampText(notes, MAX_TEXT_LENGTHS.notes),
        status: 'pending_review',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSubmitted(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tutor_requests');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-[#F5F7FA] min-h-screen py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white border border-slate-200 rounded-xl p-7 sm:p-10">
          <div className="pb-6 border-b border-slate-200">
            <p className="text-xs font-semibold text-[#39836B] inline-flex items-center gap-1.5 mb-2">
              <ClipboardCheck className="w-4 h-4 shrink-0" />
              {t.kicker}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#142B46]">
              {t.title}
            </h1>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">{t.subtitle}</p>
          </div>

          {submitted ? (
            <div className="py-12 text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-[#39836B] mx-auto" />
              <h2 className="font-display text-xl font-bold text-[#142B46]">{t.successTitle}</h2>
              <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                {t.successBodyPrefix} {translateSubCity(lang, subCity)}. {t.successBodySuffix}
              </p>
              <button
                type="button"
                onClick={onSuccessNavigate}
                className="px-6 py-2.5 bg-[#142B46] text-white text-sm font-semibold rounded-lg"
              >
                {t.openDashboard}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="pt-6 space-y-5">
              {!currentUser && (
                <div className="p-4 bg-[#F5F7FA] border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-[#142B46]">{t.signInBanner}</p>
                  <button
                    type="button"
                    onClick={onRequireSignIn}
                    className="px-4 py-2 bg-[#142B46] text-white text-xs font-semibold rounded-lg"
                  >
                    {dict.common.signIn}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#142B46] mb-1.5">
                    {t.studentNameLabel}
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={MAX_TEXT_LENGTHS.fullName}
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder={t.studentNamePlaceholder}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#142B46]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#142B46] mb-1.5">
                    {t.gradeLabel}
                  </label>
                  <select
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#142B46]"
                  >
                    {GRADE_LEVELS.map((g) => (
                      <option key={g} value={g}>
                        {translateGrade(lang, g)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#142B46] mb-1.5">
                    {t.divisionLabel}
                  </label>
                  <select
                    value={division}
                    onChange={(e) => setDivision(e.target.value as ServiceDivision)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#142B46]"
                  >
                    {SERVICE_DIVISIONS.map((div) => (
                      <option key={div} value={div}>
                        {translateDivision(lang, div)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#142B46] mb-1.5">
                    {t.subCityLabel}
                  </label>
                  <select
                    value={subCity}
                    onChange={(e) => setSubCity(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#142B46]"
                  >
                    {ADDIS_SUB_CITIES.map((sc) => (
                      <option key={sc} value={sc}>
                        {translateSubCity(lang, sc)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#142B46] mb-1.5">
                  {t.subjectsLabel}
                </label>
                <input
                  type="text"
                  required
                  value={subjectsText}
                  onChange={(e) => setSubjectsText(e.target.value)}
                  placeholder={t.subjectsPlaceholder}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#142B46]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#142B46] mb-1.5">
                    {t.scheduleLabel}
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={200}
                    value={preferredSchedule}
                    onChange={(e) => setPreferredSchedule(e.target.value)}
                    placeholder={t.defaultSchedule}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#142B46]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#142B46] mb-1.5">
                    {t.budgetLabel}
                  </label>
                  <input
                    type="number"
                    min={200}
                    max={10000}
                    required
                    value={budgetMaxEtb}
                    onChange={(e) => setBudgetMaxEtb(Number(e.target.value) || 500)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#142B46]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#142B46] mb-1.5">
                  {t.notesLabel}
                </label>
                <textarea
                  rows={4}
                  maxLength={MAX_TEXT_LENGTHS.notes}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t.notesPlaceholder}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#142B46]"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 bg-[#142B46] text-white text-sm font-semibold rounded-lg hover:bg-[#1e3d63] disabled:opacity-60 transition-colors"
                >
                  {submitting ? t.submitBusy : t.submitIdle}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
