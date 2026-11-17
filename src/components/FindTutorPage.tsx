import React, { useMemo, useState } from 'react';
import { CheckCircle2, Heart, Scale, Search, Star, X } from 'lucide-react';
import {
  ADDIS_SUB_CITIES,
  GRADE_LEVELS,
  LanguageCode,
  SERVICE_DIVISIONS,
  TutorProfile,
} from '../types';
import {
  LOCALES,
  localizeTutorDisplay,
  translateDivision,
  translateGrade,
  translateSubCity,
} from '../i18n';

interface FindTutorPageProps {
  lang: LanguageCode;
  tutors: TutorProfile[];
  initialQuery?: string;
  initialSubCity?: string;
  initialDivision?: string;
  favoriteIds: string[];
  onToggleFavorite: (tutorId: string) => void;
  onSelectTutor: (tutor: TutorProfile) => void;
  onRequestMatching: () => void;
}

export const FindTutorPage: React.FC<FindTutorPageProps> = ({
  lang,
  tutors,
  initialQuery = '',
  initialSubCity = '',
  initialDivision = '',
  favoriteIds,
  onToggleFavorite,
  onSelectTutor,
  onRequestMatching,
}) => {
  const dict = LOCALES[lang];
  const t = dict.findTutor;

  const [query, setQuery] = useState(initialQuery);
  const [division, setDivision] = useState(initialDivision);
  const [grade, setGrade] = useState('');
  const [subCity, setSubCity] = useState(initialSubCity);
  const [maxRate, setMaxRate] = useState<number>(2000);
  const [minExp, setMinExp] = useState<number>(0);
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  const approvedTutors = useMemo(
    () => tutors.filter((tu) => tu.status === 'approved'),
    [tutors]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return approvedTutors.filter((tu) => {
      if (verifiedOnly && !tu.isVerified) return false;
      if (division && tu.division !== division) return false;
      if (grade && !tu.grades.includes(grade)) return false;
      if (subCity && !tu.subCities.includes(subCity)) return false;
      if (tu.hourlyRateEtb > maxRate) return false;
      if (tu.experienceYears < minExp) return false;
      if (q) {
        const localized = localizeTutorDisplay(lang, tu);
        const hay = [
          tu.fullName,
          tu.headline,
          tu.qualifications,
          tu.division,
          ...tu.subjects,
          ...tu.subCities,
          localized.headline,
          localized.qualifications,
          localized.division,
          ...localized.subjects,
          ...localized.subCities,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [approvedTutors, query, division, grade, subCity, maxRate, minExp, verifiedOnly, lang]);

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const comparedTutors = approvedTutors.filter((tu) => compareIds.includes(tu.id));

  return (
    <div className="bg-[#F5F7FA] min-h-screen py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-[#142B46] tracking-tight">
              {t.title}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              {t.showingPrefix} {filtered.length} {t.showingSuffix}
            </p>
          </div>
          <button
            type="button"
            onClick={onRequestMatching}
            className="px-4 py-2.5 bg-[#F5BD54] text-[#142B46] text-xs font-bold rounded-lg hover:bg-[#e5ad43] transition-colors whitespace-nowrap self-start md:self-auto"
          >
            {t.managedCta}
          </button>
        </div>

        {/* Multi-Filter Control Panel */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#142B46]"
              />
            </div>

            <select
              value={division}
              onChange={(e) => setDivision(e.target.value)}
              aria-label={t.allDivisions}
              className="px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#142B46]"
            >
              <option value="">{t.allDivisions}</option>
              {SERVICE_DIVISIONS.map((div) => (
                <option key={div} value={div}>
                  {translateDivision(lang, div)}
                </option>
              ))}
            </select>

            <select
              value={subCity}
              onChange={(e) => setSubCity(e.target.value)}
              aria-label={t.allSubCities}
              className="px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#142B46]"
            >
              <option value="">{t.allSubCities}</option>
              {ADDIS_SUB_CITIES.map((sc) => (
                <option key={sc} value={sc}>
                  {translateSubCity(lang, sc)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-slate-100 items-center">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {t.gradeLabel}
              </label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#142B46]"
              >
                <option value="">{t.allLevels}</option>
                {GRADE_LEVELS.map((g) => (
                  <option key={g} value={g}>
                    {translateGrade(lang, g)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {t.maxRateLabel}{' '}
                <span className="font-mono-tabular text-[#142B46]">
                  {maxRate} {dict.common.perHourEtb}
                </span>
              </label>
              <input
                type="range"
                min={300}
                max={2000}
                step={50}
                value={maxRate}
                onChange={(e) => setMaxRate(Number(e.target.value))}
                className="w-full accent-[#142B46]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {t.minExpLabel}{' '}
                <span className="font-mono-tabular text-[#142B46]">
                  {minExp}+ {dict.common.yearsFull}
                </span>
              </label>
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={minExp}
                onChange={(e) => setMinExp(Number(e.target.value))}
                className="w-full accent-[#142B46]"
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-4 sm:pt-0">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#142B46] cursor-pointer">
                <input
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={(e) => setVerifiedOnly(e.target.checked)}
                  className="rounded border-slate-300 text-[#142B46] focus:ring-[#142B46]"
                />
                {t.verifiedOnly}
              </label>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setDivision('');
                  setGrade('');
                  setSubCity('');
                  setMaxRate(2000);
                  setMinExp(0);
                  setVerifiedOnly(true);
                }}
                className="text-xs font-semibold text-slate-500 hover:text-[#142B46] underline"
              >
                {t.resetFilters}
              </button>
            </div>
          </div>
        </div>

        {/* Comparison Tray */}
        {comparedTutors.length > 0 && (
          <div className="bg-[#142B46] text-white rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm">
              <Scale className="w-4 h-4 text-[#F5BD54]" />
              <span>
                {t.comparingPrefix} {comparedTutors.map((tu) => tu.fullName).join(' / ')}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {comparedTutors.length === 2 && (
                <button
                  type="button"
                  onClick={() => setShowCompareModal(true)}
                  className="px-4 py-1.5 bg-[#F5BD54] text-[#142B46] text-xs font-bold rounded-lg hover:bg-[#e5ad43]"
                >
                  {t.compareBtn}
                </button>
              )}
              <button
                type="button"
                onClick={() => setCompareIds([])}
                className="text-xs text-slate-300 hover:text-white"
              >
                {t.clearBtn}
              </button>
            </div>
          </div>
        )}

        {/* Tutor Results */}
        {filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
            <h3 className="font-display text-lg font-bold text-[#142B46]">{t.emptyTitle}</h3>
            <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">{t.emptyDesc}</p>
            <button
              type="button"
              onClick={onRequestMatching}
              className="px-5 py-2.5 bg-[#142B46] text-white text-sm font-semibold rounded-lg"
            >
              {t.emptyCta}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((tutor) => {
              const isFav = favoriteIds.includes(tutor.id);
              const isCompared = compareIds.includes(tutor.id);
              const localized = localizeTutorDisplay(lang, tutor);
              return (
                <article
                  key={tutor.id}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between"
                >
                  <div className="p-6 space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#F5F7FA] border border-slate-200 shrink-0">
                        {tutor.photoUrl ? (
                          <img
                            src={tutor.photoUrl}
                            alt={tutor.fullName}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-[#142B46] text-white font-display font-bold">
                            {tutor.fullName
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="font-display text-lg font-bold text-[#142B46] truncate">
                            {tutor.fullName}
                          </h2>
                          <button
                            type="button"
                            onClick={() => onToggleFavorite(tutor.id)}
                            aria-label={t.saveFavoriteAria}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                          >
                            <Heart
                              className={`w-4 h-4 ${
                                isFav ? 'fill-red-500 text-red-500' : 'text-slate-400'
                              }`}
                            />
                          </button>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-2 mt-0.5 leading-relaxed">
                          {localized.headline}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                          {tutor.isVerified && (
                            <span className="inline-flex items-center gap-1 font-semibold text-[#39836B]">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              {dict.common.verified}
                            </span>
                          )}
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span className="inline-flex items-center gap-1 font-mono-tabular font-semibold text-[#142B46]">
                            <Star className="w-3.5 h-3.5 fill-[#F5BD54] text-[#F5BD54]" />
                            {tutor.ratingAvg > 0
                              ? tutor.ratingAvg.toFixed(1)
                              : dict.common.newLabel}{' '}
                            ({tutor.reviewCount})
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                      <p>
                        <span className="font-semibold text-[#142B46]">{t.subjectsLabel}</span>{' '}
                        {localized.subjects.join(' · ')}
                      </p>
                      <p>
                        <span className="font-semibold text-[#142B46]">
                          {t.qualificationsLabel}
                        </span>{' '}
                        {localized.qualifications}
                      </p>
                      <p>
                        <span className="font-semibold text-[#142B46]">{t.locationsLabel}</span>{' '}
                        {localized.city} ({localized.subCities.join(', ')})
                      </p>
                      <p>
                        <span className="font-semibold text-[#142B46]">{t.experienceLabel}</span>{' '}
                        <span className="tabular-nums">
                          {tutor.experienceYears} {dict.common.yearsFull}
                        </span>{' '}
                        · {localized.languages.join(', ')}
                      </p>
                    </div>
                  </div>

                  <div className="px-6 py-4 bg-[#F5F7FA] border-t border-slate-200 flex items-center justify-between gap-2">
                    <div>
                      <span className="font-mono-tabular text-lg font-bold text-[#142B46]">
                        {tutor.hourlyRateEtb.toLocaleString()}
                      </span>{' '}
                      <span className="text-xs text-slate-600">{dict.common.perHourEtb}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleCompare(tutor.id)}
                        className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                          isCompared
                            ? 'bg-[#142B46] text-white border-[#142B46]'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-[#142B46]'
                        }`}
                      >
                        {isCompared ? t.compareSelected : t.compareSelect}
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectTutor(tutor)}
                        className="px-4 py-2 bg-[#142B46] text-white text-xs font-semibold rounded-lg hover:bg-[#1e3d63] transition-colors whitespace-nowrap"
                      >
                        {dict.common.viewProfile}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Side-by-Side Comparison Modal */}
      {showCompareModal && comparedTutors.length === 2 && (
        <div className="fixed inset-0 z-50 bg-[#142B46]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6 sm:p-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h2 className="font-display text-xl font-bold text-[#142B46]">{t.modalTitle}</h2>
              <button
                type="button"
                onClick={() => setShowCompareModal(false)}
                aria-label={dict.common.close}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-5">
              {comparedTutors.map((tu) => {
                const localized = localizeTutorDisplay(lang, tu);
                return (
                  <div key={tu.id} className="border border-slate-200 rounded-xl p-5 space-y-3">
                    <h3 className="font-display text-lg font-bold text-[#142B46]">
                      {tu.fullName}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">{localized.headline}</p>
                    <div className="space-y-2 text-xs pt-2 border-t border-slate-100">
                      <p>
                        <strong>{t.modalRate}</strong>{' '}
                        <span className="font-mono-tabular">
                          {tu.hourlyRateEtb.toLocaleString()} {dict.common.perHourEtb}
                        </span>
                      </p>
                      <p>
                        <strong>{t.modalExperience}</strong> {tu.experienceYears}{' '}
                        {dict.common.yearsFull}
                      </p>
                      <p>
                        <strong>{t.modalQualifications}</strong> {localized.qualifications}
                      </p>
                      <p>
                        <strong>{t.modalSubjects}</strong> {localized.subjects.join(', ')}
                      </p>
                      <p>
                        <strong>{t.modalLocations}</strong> {localized.subCities.join(', ')}
                      </p>
                      <p>
                        <strong>{t.modalAvailability}</strong>{' '}
                        {localized.availabilityDays.join(', ')}
                      </p>
                      <p>
                        <strong>{t.modalLanguages}</strong> {localized.languages.join(', ')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCompareModal(false);
                        onSelectTutor(tu);
                      }}
                      className="w-full py-2.5 bg-[#142B46] text-white text-xs font-semibold rounded-lg"
                    >
                      {t.modalCta}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
