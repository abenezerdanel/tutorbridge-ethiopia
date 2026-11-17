import React, { useState } from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  Search,
  ShieldCheck,
  Star,
  UserCheck,
} from 'lucide-react';
import {
  ADDIS_SUB_CITIES,
  AppRoute,
  LanguageCode,
  SERVICE_DIVISIONS,
  ServiceDivision,
  TutorProfile,
} from '../types';
import {
  LOCALES,
  localizeTutorDisplay,
  translateDivision,
  translateSubCity,
} from '../i18n';
import { CORPORATE_HERO_IMAGE_URL, HERO_IMAGE_URL } from '../data/seedData';

interface HomePageProps {
  lang: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  tutors: TutorProfile[];
  onNavigate: (route: AppRoute) => void;
  onSelectTutor: (tutor: TutorProfile) => void;
  onSearchFilter: (params: { query: string; subCity: string; division: string }) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  lang,
  onLanguageChange,
  tutors,
  onNavigate,
  onSelectTutor,
  onSearchFilter,
}) => {
  const dict = LOCALES[lang];
  const t = dict.home;
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSubCity, setSearchSubCity] = useState('');
  const [searchDivision, setSearchDivision] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [heroImgError, setHeroImgError] = useState(false);
  const [corpImgError, setCorpImgError] = useState(false);
  const [contactSent, setContactSent] = useState(false);

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchFilter({
      query: searchQuery,
      subCity: searchSubCity,
      division: searchDivision,
    });
    onNavigate('tutors');
  };

  const handleDivisionClick = (division: ServiceDivision) => {
    if (division === 'Corporate & Organizational Training') {
      onNavigate('corporate');
      return;
    }
    onSearchFilter({ query: '', subCity: '', division });
    onNavigate('tutors');
  };

  const featuredTutors = tutors.filter((tu) => tu.status === 'approved').slice(0, 4);

  return (
    <div>
      {/* HERO SECTION */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-14 lg:pt-14 lg:pb-16">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-8">
            <p className="text-xs font-semibold tracking-wide text-[#39836B]">
              {t.heroKicker}
            </p>
            <div className="flex items-center gap-1 p-1 bg-[#F5F7FA] border border-slate-200 rounded-lg">
              <button
                type="button"
                onClick={() => onLanguageChange('en')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  lang === 'en'
                    ? 'bg-white text-[#142B46] shadow-sm'
                    : 'text-slate-600 hover:text-[#142B46]'
                }`}
              >
                {dict.nav.langEnglishFull}
              </button>
              <button
                type="button"
                onClick={() => onLanguageChange('am')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  lang === 'am'
                    ? 'bg-white text-[#142B46] shadow-sm'
                    : 'text-slate-600 hover:text-[#142B46]'
                }`}
              >
                {dict.nav.langAmharicFull}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
              <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.2rem] font-extrabold text-[#142B46] leading-[1.15] tracking-tight text-balance">
                {t.heroHeadline}
              </h1>
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
                {t.heroSubhead}
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <button
                  type="button"
                  onClick={() => onNavigate('tutors')}
                  className="px-6 py-3.5 bg-[#142B46] text-white text-sm font-semibold rounded-lg hover:bg-[#1e3d63] transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                >
                  {t.heroPrimaryCta}
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('corporate')}
                  className="px-6 py-3.5 bg-[#F5BD54] text-[#142B46] text-sm font-bold rounded-lg hover:bg-[#e5ad43] transition-colors whitespace-nowrap"
                >
                  {t.heroSecondaryCta}
                </button>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative h-72 sm:h-96 lg:h-full min-h-[340px] rounded-xl overflow-hidden border border-slate-200 bg-[#F5F7FA]">
                {!heroImgError ? (
                  <img
                    src={HERO_IMAGE_URL}
                    alt={t.heroImgAlt}
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#142B46] to-[#23456e] flex flex-col items-center justify-center p-8 text-white text-center">
                    <ShieldCheck className="w-12 h-12 text-[#F5BD54] mb-3" />
                    <p className="font-display text-lg font-bold">{t.heroFallbackTitle}</p>
                    <p className="text-sm text-slate-200 mt-1">{t.heroFallbackSub}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <form
            onSubmit={handleHeroSearch}
            className="mt-10 p-4 sm:p-5 bg-[#F5F7FA] border border-slate-200 rounded-xl grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
          >
            <div className="md:col-span-5 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                aria-label={t.searchPlaceholder}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-[#142B46] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#142B46]"
              />
            </div>
            <div className="md:col-span-3">
              <select
                value={searchSubCity}
                onChange={(e) => setSearchSubCity(e.target.value)}
                aria-label={t.searchSubCityAll}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-[#142B46] focus:outline-none focus:ring-2 focus:ring-[#142B46]"
              >
                <option value="">{t.searchSubCityAll}</option>
                {ADDIS_SUB_CITIES.map((city) => (
                  <option key={city} value={city}>
                    {translateSubCity(lang, city)}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <select
                value={searchDivision}
                onChange={(e) => setSearchDivision(e.target.value)}
                aria-label={t.searchDivisionAll}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-[#142B46] focus:outline-none focus:ring-2 focus:ring-[#142B46]"
              >
                <option value="">{t.searchDivisionAll}</option>
                {SERVICE_DIVISIONS.map((div) => (
                  <option key={div} value={div}>
                    {translateDivision(lang, div)}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="w-full px-4 py-2.5 bg-[#142B46] text-white text-sm font-semibold rounded-lg hover:bg-[#1e3d63] transition-colors whitespace-nowrap"
              >
                {t.searchSubmit}
              </button>
            </div>
          </form>

          <div className="mt-10 pt-8 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {t.stats.map((stat, idx) => (
              <div key={stat.title}>
                <p
                  className={`font-mono-tabular text-2xl font-bold ${
                    idx === 3 ? 'text-[#39836B]' : 'text-[#142B46]'
                  }`}
                >
                  {stat.value}
                </p>
                <p className="text-sm font-semibold text-[#142B46] mt-1">{stat.title}</p>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{stat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOUR SERVICE DIVISIONS */}
      <section className="bg-[#F5F7FA] py-16 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#142B46] tracking-tight text-balance">
              {t.divisionsTitle}
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2 leading-relaxed">
              {t.divisionsLead}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {t.divisions.map((card) => (
              <div
                key={card.divisionKey}
                className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between"
              >
                <div>
                  <p className="font-mono-tabular text-xs font-semibold text-[#39836B] mb-2">
                    {card.index}
                  </p>
                  <h3 className="font-display text-lg font-bold text-[#142B46] mb-2.5">
                    {card.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                    {card.summary}
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {card.subjects.join(' · ')}
                  </p>
                </div>
                <div className="pt-5 mt-5 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleDivisionClick(card.divisionKey as ServiceDivision)}
                    className="text-xs sm:text-sm font-semibold text-[#142B46] hover:text-[#39836B] inline-flex items-center gap-1.5 transition-colors text-left"
                  >
                    {card.cta}
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SUBJECTS & PRACTICAL SKILLS DIRECTORY */}
      <section id="subjects-skills" className="bg-white py-16 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-10">
            <p className="text-xs font-semibold text-[#39836B] mb-2">
              {t.subjectsSection.kicker}
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#142B46] tracking-tight text-balance">
              {t.subjectsSection.title}
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2 leading-relaxed">
              {t.subjectsSection.lead}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {t.subjectsSection.categories.map((cat) => (
              <div
                key={cat.code}
                className="bg-[#F5F7FA] border border-slate-200 rounded-xl p-6 sm:p-7 flex flex-col justify-between space-y-5"
              >
                <div className="space-y-3">
                  <p className="font-mono-tabular text-xs font-semibold text-[#39836B]">
                    {cat.code}
                  </p>
                  <h3 className="font-display text-xl font-bold text-[#142B46]">{cat.name}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{cat.description}</p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-xs sm:text-sm text-[#142B46]">
                    {cat.items.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#39836B] shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={() => handleDivisionClick(cat.divisionKey as ServiceDivision)}
                    className="text-xs sm:text-sm font-semibold text-[#142B46] hover:text-[#39836B] inline-flex items-center gap-1.5 transition-colors"
                  >
                    {t.subjectsSection.browseCta}
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('corporate')}
                    className="text-xs sm:text-sm font-medium text-slate-600 hover:text-[#142B46] transition-colors"
                  >
                    {t.subjectsSection.corporateCta}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CORPORATE & ORGANIZATIONAL TRAINING SPOTLIGHT */}
      <section className="bg-[#F5F7FA] py-16 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-6">
            <div className="h-72 sm:h-96 lg:h-full min-h-[300px] rounded-xl overflow-hidden border border-slate-200 bg-white">
              {!corpImgError ? (
                <img
                  src={CORPORATE_HERO_IMAGE_URL}
                  alt={t.corporateSpotlight.imgAlt}
                  referrerPolicy="no-referrer"
                  onError={() => setCorpImgError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[#142B46] flex items-center justify-center p-8 text-white">
                  <Building2 className="w-12 h-12 text-[#F5BD54]" />
                </div>
              )}
            </div>
          </div>
          <div className="lg:col-span-6 flex flex-col justify-center space-y-5">
            <p className="text-xs font-semibold text-[#39836B]">
              {t.corporateSpotlight.kicker}
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#142B46] tracking-tight text-balance">
              {t.corporateSpotlight.title}
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              {t.corporateSpotlight.desc}
            </p>
            <ul className="text-sm text-slate-700 space-y-2">
              {t.corporateSpotlight.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#39836B] shrink-0 mt-0.5" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => onNavigate('corporate')}
                className="px-5 py-3 bg-[#142B46] text-white text-sm font-semibold rounded-lg hover:bg-[#1e3d63] inline-flex items-center gap-2"
              >
                {t.corporateSpotlight.primaryCta}
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('become-tutor')}
                className="px-5 py-3 bg-white border border-slate-300 text-[#142B46] text-sm font-semibold rounded-lg hover:border-[#142B46]"
              >
                {t.corporateSpotlight.secondaryCta}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURED VERIFIED TUTORS */}
      <section className="bg-white py-16 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div className="max-w-2xl">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#142B46] tracking-tight text-balance">
                {t.featuredTutorsTitle}
              </h2>
              <p className="text-sm sm:text-base text-slate-600 mt-2">{t.featuredTutorsLead}</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('tutors')}
              className="text-sm font-semibold text-[#142B46] hover:text-[#39836B] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              {t.viewAllTutors}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredTutors.map((tutor) => {
              const localized = localizeTutorDisplay(lang, tutor);
              return (
                <article
                  key={tutor.id}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between hover:border-[#142B46]/40 transition-colors"
                >
                  <div>
                    <div className="aspect-square bg-[#F5F7FA] overflow-hidden border-b border-slate-100">
                      {tutor.photoUrl ? (
                        <img
                          src={tutor.photoUrl}
                          alt={tutor.fullName}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#142B46] text-white font-display text-2xl font-bold">
                          {tutor.fullName
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)}
                        </div>
                      )}
                    </div>
                    <div className="p-5 space-y-2.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 font-semibold text-[#39836B]">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          {dict.common.verifiedEducator}
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono-tabular font-semibold text-[#142B46]">
                          <Star className="w-3.5 h-3.5 fill-[#F5BD54] text-[#F5BD54]" />
                          {tutor.ratingAvg > 0
                            ? tutor.ratingAvg.toFixed(1)
                            : dict.common.newLabel}{' '}
                          ({tutor.reviewCount})
                        </span>
                      </div>

                      <h3 className="font-display text-lg font-bold text-[#142B46]">
                        {tutor.fullName}
                      </h3>
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {localized.headline}
                      </p>
                      <p className="text-xs text-slate-500">
                        {localized.subjects.slice(0, 3).join(' · ')}
                      </p>
                      <p className="text-xs text-slate-500">
                        {localized.subCities.slice(0, 2).join(', ')} · {tutor.experienceYears}{' '}
                        {dict.common.yearsShort}
                      </p>
                    </div>
                  </div>

                  <div className="px-5 py-4 bg-[#F5F7FA] border-t border-slate-100 flex items-center justify-between gap-2">
                    <div>
                      <span className="font-mono-tabular text-base font-bold text-[#142B46]">
                        {tutor.hourlyRateEtb.toLocaleString()}
                      </span>{' '}
                      <span className="text-xs text-slate-600">{dict.common.perHourEtb}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectTutor(tutor)}
                      className="px-3.5 py-2 bg-[#142B46] text-white text-xs font-semibold rounded-lg hover:bg-[#1e3d63] transition-colors whitespace-nowrap"
                    >
                      {dict.common.viewProfile}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ABOUT US SECTION */}
      <section id="about-us" className="bg-[#F5F7FA] py-16 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-6 space-y-4">
              <p className="text-xs font-semibold text-[#39836B]">{t.aboutUs.kicker}</p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#142B46] tracking-tight text-balance">
                {t.aboutUs.title}
              </h2>
              <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
                {t.aboutUs.intro}
              </p>
              <div className="pt-2 space-y-2">
                <h3 className="font-display text-lg font-bold text-[#142B46]">
                  {t.aboutUs.storyTitle}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">{t.aboutUs.storyBody}</p>
              </div>
            </div>

            <div className="lg:col-span-6 grid grid-cols-1 gap-5">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
                <p className="text-xs font-semibold text-[#39836B]">{t.aboutUs.missionLabel}</p>
                <p className="text-sm sm:text-base font-medium text-[#142B46] leading-relaxed">
                  {t.aboutUs.missionBody}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
                <p className="text-xs font-semibold text-[#39836B]">{t.aboutUs.visionLabel}</p>
                <p className="text-sm sm:text-base font-medium text-[#142B46] leading-relaxed">
                  {t.aboutUs.visionBody}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                <p className="text-xs font-semibold text-[#142B46]">{t.aboutUs.valuesTitle}</p>
                <ul className="space-y-2 text-xs sm:text-sm text-slate-600">
                  {t.aboutUs.objectives.map((obj) => (
                    <li key={obj} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#39836B] shrink-0 mt-0.5" />
                      <span>{obj}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 pt-2">
            {t.aboutUs.values.map((val) => (
              <div key={val.title} className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
                <h3 className="font-display text-base font-bold text-[#142B46]">{val.title}</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{val.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY CHOOSE TUTORBRIDGE */}
      <section className="bg-white py-16 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-[#39836B] mb-2">{t.whyChoose.kicker}</p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#142B46] tracking-tight text-balance">
              {t.whyChoose.title}
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2 leading-relaxed">
              {t.whyChoose.lead}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {t.whyChoose.items.map((item, idx) => (
              <div
                key={item.title}
                className="bg-[#F5F7FA] border border-slate-200 rounded-xl p-6 space-y-2.5"
              >
                <p className="font-mono-tabular text-xs font-semibold text-[#39836B]">
                  0{idx + 1}.
                </p>
                <h3 className="font-display text-base font-bold text-[#142B46]">{item.title}</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HYBRID MARKETPLACE: HOW IT WORKS */}
      <section id="how-it-works" className="bg-[#F5F7FA] py-16 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#142B46] tracking-tight text-balance">
              {t.howItWorksTitle}
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2 leading-relaxed">
              {t.howItWorksLead}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white border border-slate-200 rounded-xl p-7 sm:p-8 flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold text-[#39836B] mb-2">{t.methodA.kicker}</p>
                <h3 className="font-display text-xl font-bold text-[#142B46] mb-5">
                  {t.methodA.title}
                </h3>
                <ol className="space-y-3.5 text-sm text-slate-600">
                  {t.methodA.steps.map((step, idx) => (
                    <li key={step}>
                      <strong className="text-[#142B46] font-mono-tabular">
                        0{idx + 1}.
                      </strong>{' '}
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
              <div className="pt-6 mt-6 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => onNavigate('tutors')}
                  className="px-5 py-2.5 bg-[#142B46] text-white text-sm font-semibold rounded-lg hover:bg-[#1e3d63] transition-colors"
                >
                  {t.methodA.cta}
                </button>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-7 sm:p-8 flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold text-[#142B46] mb-2">{t.methodB.kicker}</p>
                <h3 className="font-display text-xl font-bold text-[#142B46] mb-5">
                  {t.methodB.title}
                </h3>
                <ol className="space-y-3.5 text-sm text-slate-600">
                  {t.methodB.steps.map((step, idx) => (
                    <li key={step}>
                      <strong className="text-[#142B46] font-mono-tabular">
                        0{idx + 1}.
                      </strong>{' '}
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
              <div className="pt-6 mt-6 border-t border-slate-200 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate('request-matching')}
                  className="px-5 py-2.5 bg-[#F5BD54] text-[#142B46] text-sm font-bold rounded-lg hover:bg-[#e5ad43] transition-colors"
                >
                  {t.methodB.familyCta}
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('corporate')}
                  className="px-5 py-2.5 bg-white border border-slate-300 text-[#142B46] text-sm font-semibold rounded-lg hover:border-[#142B46]"
                >
                  {t.methodB.corporateCta}
                </button>
              </div>
            </div>
          </div>

          {/* Role Guides */}
          <div className="space-y-5">
            <h3 className="font-display text-xl font-bold text-[#142B46]">
              {t.roleGuides.title}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {t.roleGuides.roles.map((roleItem) => (
                <div
                  key={roleItem.label}
                  className="bg-white border border-slate-200 rounded-xl p-6 space-y-2.5"
                >
                  <h4 className="font-display text-base font-bold text-[#142B46]">
                    {roleItem.label}
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {roleItem.summary}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Verification, Booking & Payment Flow */}
          <div className="space-y-5">
            <h3 className="font-display text-xl font-bold text-[#142B46]">
              {t.roleGuides.pillarsTitle}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {t.roleGuides.pillars.map((pillar) => (
                <div
                  key={pillar.title}
                  className="bg-white border border-slate-200 rounded-xl p-6 space-y-2"
                >
                  <h4 className="font-display text-sm sm:text-base font-bold text-[#39836B]">
                    {pillar.title}
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {pillar.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="bg-white py-16 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#142B46] tracking-tight mb-10 text-balance">
            {t.testimonialsTitle}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {t.testimonials.map((item) => (
              <blockquote
                key={item.name}
                className="bg-[#F5F7FA] border border-slate-200 rounded-xl p-6 flex flex-col justify-between"
              >
                <p className="text-sm text-[#142B46] leading-relaxed">“{item.quote}”</p>
                <footer className="pt-5 mt-5 border-t border-slate-200">
                  <p className="text-sm font-bold text-[#142B46]">{item.name}</p>
                  <p className="text-xs text-slate-600">
                    {item.role} · {item.location}
                  </p>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* BECOME A TUTOR / TRAINER CALLOUT */}
      <section className="bg-[#142B46] text-white py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <div className="max-w-2xl space-y-2.5">
            <p className="text-xs font-semibold text-[#F5BD54] inline-flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 shrink-0" />
              {t.becomeTutorKicker}
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
              {t.becomeTutorBannerTitle}
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              {t.becomeTutorBannerSub}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('become-tutor')}
            className="px-6 py-3.5 bg-[#F5BD54] text-[#142B46] text-sm font-bold rounded-lg hover:bg-[#e5ad43] transition-colors whitespace-nowrap shrink-0"
          >
            {t.becomeTutorBannerCta}
          </button>
        </div>
      </section>

      {/* FAQ + CONTACT */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#142B46] tracking-tight mb-6">
              {t.faqTitle}
            </h2>
            <div className="divide-y divide-slate-200 border-t border-b border-slate-200">
              {t.faqs.map((faq, index) => {
                const isOpen = openFaq === index;
                return (
                  <div key={faq.question} className="py-4">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : index)}
                      className="w-full flex items-center justify-between gap-4 text-left"
                    >
                      <span className="text-sm sm:text-base font-semibold text-[#142B46]">
                        {faq.question}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <p className="mt-2.5 text-sm text-slate-600 leading-relaxed pr-6">
                        {faq.answer}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-[#F5F7FA] border border-slate-200 rounded-xl p-6 sm:p-7">
              <h3 className="font-display text-xl font-bold text-[#142B46] mb-2">
                {t.contact.title}
              </h3>
              <p className="text-sm text-slate-600 mb-5 leading-relaxed">{t.contact.subtitle}</p>
              {contactSent ? (
                <div className="p-4 bg-white border border-slate-200 rounded-lg text-sm text-[#39836B] font-medium leading-relaxed">
                  {t.contact.sentMsg}
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setContactSent(true);
                  }}
                  className="space-y-3"
                >
                  <input
                    type="text"
                    required
                    placeholder={t.contact.namePlaceholder}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#142B46]"
                  />
                  <input
                    type="tel"
                    required
                    placeholder={t.contact.phonePlaceholder}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#142B46]"
                  />
                  <textarea
                    rows={3}
                    required
                    placeholder={t.contact.messagePlaceholder}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#142B46]"
                  />
                  <button
                    type="submit"
                    className="w-full px-4 py-2.5 bg-[#142B46] text-white text-sm font-semibold rounded-lg hover:bg-[#1e3d63] transition-colors"
                  >
                    {t.contact.submitBtn}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
