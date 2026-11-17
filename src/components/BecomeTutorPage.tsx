import React, { useState } from 'react';
import { addDoc, collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { CORPORATE_TRAINING_CATEGORIES } from '../data/seedData';
import {
  LOCALES,
  translateDay,
  translateDivision,
  translateGrade,
  translateSubCity,
} from '../i18n';
import {
  ADDIS_SUB_CITIES,
  AVAILABILITY_DAYS,
  CategoryRecord,
  CorporateTrainer,
  GRADE_LEVELS,
  LanguageCode,
  MAX_TEXT_LENGTHS,
  SERVICE_DIVISIONS,
  ServiceDivision,
  TutorProfile,
  UserAccount,
  clampText,
} from '../types';

interface BecomeTutorPageProps {
  lang: LanguageCode;
  currentUser: UserAccount | null;
  existingTutorProfile: TutorProfile | null;
  existingCorporateTrainer: CorporateTrainer | null;
  customCategories: CategoryRecord[];
  onRequireSignIn: () => void;
  onGoToTutorDashboard: () => void;
}

type EducatorTrack = 'tutor' | 'trainer' | 'both';

export const BecomeTutorPage: React.FC<BecomeTutorPageProps> = ({
  lang,
  currentUser,
  existingTutorProfile,
  existingCorporateTrainer,
  customCategories,
  onRequireSignIn,
  onGoToTutorDashboard,
}) => {
  const dict = LOCALES[lang];
  const t = dict.becomeTutor;

  const [track, setTrack] = useState<EducatorTrack>(
    currentUser?.role === 'trainer' ? 'trainer' : 'tutor'
  );
  const [fullName, setFullName] = useState(currentUser?.fullName || '');
  const [headline, setHeadline] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [experienceYears, setExperienceYears] = useState<number>(3);

  // Individual Tutor fields
  const [division, setDivision] = useState<ServiceDivision>('Academic Tutoring');
  const [subjectsText, setSubjectsText] = useState('Mathematics, Chemistry');
  const [selectedGrades, setSelectedGrades] = useState<string[]>(['Secondary (Grades 9–12)']);
  const [selectedSubCities, setSelectedSubCities] = useState<string[]>(['Bole', 'Yeka']);
  const [selectedDays, setSelectedDays] = useState<string[]>(['Monday', 'Wednesday', 'Saturday']);
  const [hourlyRateEtb, setHourlyRateEtb] = useState<number>(600);
  const [bio, setBio] = useState('');

  // Corporate Trainer fields
  const allCorpCategoryNames = [
    ...CORPORATE_TRAINING_CATEGORIES.map((c) => c.name),
    ...customCategories.filter((c) => c.isActive).map((c) => c.name),
  ];

  const getCorporateCategoryLabel = (canonicalName: string) => {
    const coreIdx = CORPORATE_TRAINING_CATEGORIES.findIndex((c) => c.name === canonicalName);
    if (coreIdx >= 0 && dict.corporate.categories[coreIdx]) {
      return dict.corporate.categories[coreIdx].name;
    }
    return canonicalName;
  };

  const [trainerCategories, setTrainerCategories] = useState<string[]>(['Digital Literacy']);
  const [trainerTopicsText, setTrainerTopicsText] = useState(
    'Microsoft Office, Excel and data management, Digital productivity'
  );
  const [trainerMethodology, setTrainerMethodology] = useState('');
  const [trainerAvailability, setTrainerAvailability] = useState(
    'Weekdays & Saturdays (Full-day or half-day workshops)'
  );
  const [trainerDailyRateEtb, setTrainerDailyRateEtb] = useState<number>(6500);

  // Shared credentials
  const [idRef, setIdRef] = useState('');
  const [degreeRef, setDegreeRef] = useState('');
  const [agreedSafeguarding, setAgreedSafeguarding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const toggleItem = (list: string[], setList: (next: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  };

  const applyTutor = track === 'tutor' || track === 'both';
  const applyTrainer = track === 'trainer' || track === 'both';

  const alreadyCompletedSelectedTrack =
    (track === 'tutor' && Boolean(existingTutorProfile)) ||
    (track === 'trainer' && Boolean(existingCorporateTrainer)) ||
    (track === 'both' && Boolean(existingTutorProfile) && Boolean(existingCorporateTrainer));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireSignIn();
      return;
    }

    if (selectedSubCities.length === 0) {
      setErrorMsg(t.errors.locationRequired);
      return;
    }

    const subjects = subjectsText
      .split(',')
      .map((s) => clampText(s, 60))
      .filter(Boolean)
      .slice(0, 12);

    if (applyTutor && (subjects.length === 0 || selectedGrades.length === 0 || selectedDays.length === 0)) {
      setErrorMsg(t.errors.tutorFieldsRequired);
      return;
    }

    const trainerTopics = trainerTopicsText
      .split(',')
      .map((s) => clampText(s, 100))
      .filter(Boolean)
      .slice(0, 25);

    if (applyTrainer && (trainerCategories.length === 0 || trainerTopics.length === 0)) {
      setErrorMsg(t.errors.trainerFieldsRequired);
      return;
    }

    if (!agreedSafeguarding) {
      setErrorMsg(t.errors.safeguardingRequired);
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const tutorId = `tutor_${currentUser.uid}`;
      const trainerId = `trainer_${currentUser.uid}`;
      let credentialOwnerId = tutorId;

      if (applyTutor && !existingTutorProfile) {
        await setDoc(doc(db, 'tutors', tutorId), {
          userId: currentUser.uid,
          fullName: clampText(fullName || currentUser.fullName, MAX_TEXT_LENGTHS.fullName),
          headline: clampText(headline, MAX_TEXT_LENGTHS.headline),
          bio: clampText(bio || trainerMethodology, MAX_TEXT_LENGTHS.bio),
          photoUrl: '',
          qualifications: clampText(qualifications, MAX_TEXT_LENGTHS.qualifications),
          experienceYears,
          division:
            division === 'Corporate & Organizational Training'
              ? 'Professional & Practical Skills'
              : division,
          subjects,
          grades: selectedGrades.slice(0, 12),
          city: 'Addis Ababa',
          subCities: selectedSubCities.slice(0, 12),
          hourlyRateEtb,
          availabilityDays: selectedDays.slice(0, 7),
          languages: ['Amharic', 'English'],
          ratingAvg: 0,
          reviewCount: 0,
          status: 'pending',
          isVerified: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      if (applyTrainer && !existingCorporateTrainer) {
        await setDoc(doc(db, 'corporate_trainers', trainerId), {
          userId: currentUser.uid,
          fullName: clampText(fullName || currentUser.fullName, MAX_TEXT_LENGTHS.fullName),
          headline: clampText(headline, MAX_TEXT_LENGTHS.headline),
          qualifications: clampText(qualifications, 400),
          experienceYears,
          categories: trainerCategories.slice(0, 10),
          topics: trainerTopics,
          methodology: clampText(trainerMethodology || bio, 1500),
          availability: clampText(trainerAvailability, 200),
          preferredLocations: selectedSubCities.slice(0, 15),
          proposedDailyRateEtb: trainerDailyRateEtb,
          isTutorAlso: applyTutor || Boolean(existingTutorProfile),
          status: 'pending',
          isVerified: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        if (!applyTutor) {
          credentialOwnerId = trainerId;
        }
      }

      await addDoc(collection(db, 'tutor_documents'), {
        tutorId: credentialOwnerId,
        userId: currentUser.uid,
        docType: 'national_id',
        title: 'National ID / Kebele ID Verification',
        referenceCode: clampText(idRef, 120),
        notes: `Submitted during ${track} onboarding`,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, 'tutor_documents'), {
        tutorId: credentialOwnerId,
        userId: currentUser.uid,
        docType: 'degree_certificate',
        title: clampText(qualifications, 160),
        referenceCode: clampText(degreeRef, 120),
        notes: 'Educational / professional credential submitted for administrator verification',
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSubmitted(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, applyTrainer ? 'corporate_trainers' : 'tutors');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-[#F5F7FA] min-h-screen py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="bg-white border border-slate-200 rounded-xl p-7 sm:p-9 grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-4">
            <p className="text-xs font-semibold text-[#39836B]">{t.kicker}</p>
            <h1 className="font-display text-3xl font-bold text-[#142B46]">{t.title}</h1>
            <p className="text-sm text-slate-600 leading-relaxed">{t.subtitle}</p>
            <div className="pt-2 space-y-2 text-sm text-slate-700">
              <p>
                <strong className="text-[#142B46]">{t.trackTutorBold}</strong> {t.trackTutorDesc}
              </p>
              <p>
                <strong className="text-[#142B46]">{t.trackTrainerBold}</strong>{' '}
                {t.trackTrainerDesc}
              </p>
              <p>
                <strong className="text-[#142B46]">{t.trackVerifyBold}</strong>{' '}
                {t.trackVerifyDesc}
              </p>
            </div>
          </div>

          <div className="lg:col-span-5 bg-[#F5F7FA] border border-slate-200 rounded-xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-[#142B46] font-display font-bold">
              <ShieldCheck className="w-5 h-5 text-[#39836B] shrink-0" />
              {t.standardTitle}
            </div>
            <ul className="text-xs text-slate-600 space-y-2">
              {t.standardSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-7 sm:p-9 space-y-6">
          {/* Track Switcher */}
          <div className="flex flex-wrap gap-2 pb-4 border-b border-slate-200">
            {(
              [
                { id: 'tutor' as const, label: t.tracks.tutor },
                { id: 'trainer' as const, label: t.tracks.trainer },
                { id: 'both' as const, label: t.tracks.both },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTrack(item.id);
                  setSubmitted(false);
                }}
                className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                  track === item.id
                    ? 'bg-[#142B46] text-white border-[#142B46]'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {alreadyCompletedSelectedTrack || submitted ? (
            <div className="py-10 text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-[#39836B] mx-auto" />
              <h2 className="font-display text-xl font-bold text-[#142B46]">
                {t.submittedTitle}
              </h2>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                {existingTutorProfile && (
                  <span className="block">
                    {t.tutorStatusLabel}{' '}
                    <strong>{existingTutorProfile.status.toUpperCase()}</strong>
                  </span>
                )}
                {existingCorporateTrainer && (
                  <span className="block">
                    {t.trainerStatusLabel}{' '}
                    <strong>{existingCorporateTrainer.status.toUpperCase()}</strong>
                  </span>
                )}
                {t.submittedNote}
              </p>
              <button
                type="button"
                onClick={onGoToTutorDashboard}
                className="px-6 py-2.5 bg-[#142B46] text-white text-sm font-semibold rounded-lg"
              >
                {t.openDashboard}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="font-display text-xl font-bold text-[#142B46]">{t.formTitle}</h2>
                {!currentUser && (
                  <button
                    type="button"
                    onClick={onRequireSignIn}
                    className="px-4 py-2 bg-[#F5BD54] text-[#142B46] text-xs font-bold rounded-lg"
                  >
                    {t.signInApply}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#142B46] mb-1.5">
                    {t.fullNameLabel}
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={MAX_TEXT_LENGTHS.fullName}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t.fullNamePlaceholder}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#142B46] mb-1.5">
                    {t.headlineLabel}
                  </label>
                  <input
                    type="text"
                    required
                    minLength={4}
                    maxLength={MAX_TEXT_LENGTHS.headline}
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder={t.headlinePlaceholder}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#142B46] mb-1.5">
                    {t.qualificationsLabel}
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={MAX_TEXT_LENGTHS.qualifications}
                    value={qualifications}
                    onChange={(e) => setQualifications(e.target.value)}
                    placeholder={t.qualificationsPlaceholder}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#142B46] mb-1.5">
                    {t.experienceLabel}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    required
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(Number(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm tabular-nums"
                  />
                </div>
              </div>

              {applyTutor && (
                <div className="p-5 border border-slate-200 rounded-xl space-y-5 bg-[#F5F7FA]/60">
                  <p className="text-xs font-bold text-[#142B46]">{t.tutorSectionTitle}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#142B46] mb-1.5">
                        {t.divisionLabel}
                      </label>
                      <select
                        value={division}
                        onChange={(e) => setDivision(e.target.value as ServiceDivision)}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white"
                      >
                        {SERVICE_DIVISIONS.map((d) => (
                          <option key={d} value={d}>
                            {translateDivision(lang, d)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#142B46] mb-1.5">
                        {t.subjectsLabel}
                      </label>
                      <input
                        type="text"
                        required={applyTutor}
                        value={subjectsText}
                        onChange={(e) => setSubjectsText(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#142B46] mb-1.5">
                        {t.hourlyRateLabel}
                      </label>
                      <input
                        type="number"
                        min={150}
                        max={25000}
                        required={applyTutor}
                        value={hourlyRateEtb}
                        onChange={(e) => setHourlyRateEtb(Number(e.target.value) || 500)}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm tabular-nums bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#142B46] mb-2">
                      {t.gradesLabel}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {GRADE_LEVELS.map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => toggleItem(selectedGrades, setSelectedGrades, g)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                            selectedGrades.includes(g)
                              ? 'bg-[#142B46] text-white border-[#142B46]'
                              : 'bg-white text-slate-600 border-slate-300'
                          }`}
                        >
                          {translateGrade(lang, g)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#142B46] mb-2">
                      {t.daysLabel}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {AVAILABILITY_DAYS.map((day) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleItem(selectedDays, setSelectedDays, day)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                            selectedDays.includes(day)
                              ? 'bg-[#39836B] text-white border-[#39836B]'
                              : 'bg-white text-slate-600 border-slate-300'
                          }`}
                        >
                          {translateDay(lang, day)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#142B46] mb-1.5">
                      {t.bioLabel}
                    </label>
                    <textarea
                      rows={3}
                      required={applyTutor}
                      minLength={10}
                      maxLength={MAX_TEXT_LENGTHS.bio}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder={t.bioPlaceholder}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white"
                    />
                  </div>
                </div>
              )}

              {applyTrainer && (
                <div className="p-5 border border-slate-200 rounded-xl space-y-5 bg-[#F5F7FA]/60">
                  <p className="text-xs font-bold text-[#39836B]">{t.trainerSectionTitle}</p>
                  <div>
                    <label className="block text-xs font-semibold text-[#142B46] mb-2">
                      {t.trainerCategoriesLabel}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {allCorpCategoryNames.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => toggleItem(trainerCategories, setTrainerCategories, cat)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                            trainerCategories.includes(cat)
                              ? 'bg-[#142B46] text-white border-[#142B46]'
                              : 'bg-white text-slate-600 border-slate-300'
                          }`}
                        >
                          {getCorporateCategoryLabel(cat)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#142B46] mb-1.5">
                        {t.trainerTopicsLabel}
                      </label>
                      <input
                        type="text"
                        required={applyTrainer}
                        value={trainerTopicsText}
                        onChange={(e) => setTrainerTopicsText(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#142B46] mb-1.5">
                        {t.trainerDailyRateLabel}
                      </label>
                      <input
                        type="number"
                        min={500}
                        max={250000}
                        required={applyTrainer}
                        value={trainerDailyRateEtb}
                        onChange={(e) => setTrainerDailyRateEtb(Number(e.target.value) || 5000)}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm tabular-nums bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#142B46] mb-1.5">
                      {t.trainerAvailabilityLabel}
                    </label>
                    <input
                      type="text"
                      required={applyTrainer}
                      minLength={2}
                      maxLength={200}
                      value={trainerAvailability}
                      onChange={(e) => setTrainerAvailability(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#142B46] mb-1.5">
                      {t.trainerMethodologyLabel}
                    </label>
                    <textarea
                      rows={3}
                      required={applyTrainer}
                      minLength={10}
                      maxLength={1500}
                      value={trainerMethodology}
                      onChange={(e) => setTrainerMethodology(e.target.value)}
                      placeholder={t.trainerMethodologyPlaceholder}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#142B46] mb-2">
                  {t.locationsLabel}
                </label>
                <div className="flex flex-wrap gap-2">
                  {ADDIS_SUB_CITIES.map((sc) => (
                    <button
                      key={sc}
                      type="button"
                      onClick={() => toggleItem(selectedSubCities, setSelectedSubCities, sc)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        selectedSubCities.includes(sc)
                          ? 'bg-[#142B46] text-white border-[#142B46]'
                          : 'bg-white text-slate-600 border-slate-300'
                      }`}
                    >
                      {translateSubCity(lang, sc)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-5 bg-[#F5F7FA] border border-slate-200 rounded-xl space-y-4">
                <p className="text-xs font-semibold text-[#142B46]">{t.credentialsTitle}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      {t.nationalIdLabel}
                    </label>
                    <input
                      type="text"
                      required
                      minLength={3}
                      maxLength={120}
                      value={idRef}
                      onChange={(e) => setIdRef(e.target.value)}
                      placeholder={t.nationalIdPlaceholder}
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      {t.degreeRefLabel}
                    </label>
                    <input
                      type="text"
                      required
                      minLength={3}
                      maxLength={120}
                      value={degreeRef}
                      onChange={(e) => setDegreeRef(e.target.value)}
                      placeholder={t.degreeRefPlaceholder}
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>

              <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedSafeguarding}
                  onChange={(e) => setAgreedSafeguarding(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-[#142B46]"
                />
                <span>{t.safeguardingPledge}</span>
              </label>

              {errorMsg && <p className="text-xs text-red-600 font-semibold">{errorMsg}</p>}

              <div className="flex justify-end">
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
