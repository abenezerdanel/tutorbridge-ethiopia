import React, { useState } from 'react';
import { ArrowRight, Building2, Calendar, CheckCircle2, MapPin, Users } from 'lucide-react';
import {
  AppRoute,
  CORPORATE_DURATIONS,
  CategoryRecord,
  LanguageCode,
  ORGANIZATION_TYPES,
  UserAccount,
} from '../types';
import {
  LOCALES,
  translateCorporateDuration,
  translateOrgType,
} from '../i18n';
import { CORPORATE_HERO_IMAGE_URL } from '../data/seedData';

interface CorporateTrainingPageProps {
  lang: LanguageCode;
  currentUser: UserAccount | null;
  customCategories: CategoryRecord[];
  onRequireSignIn: () => void;
  onNavigate: (route: AppRoute) => void;
}

export const CorporateTrainingPage: React.FC<CorporateTrainingPageProps> = ({
  lang,
  currentUser,
  customCategories,
  onRequireSignIn,
  onNavigate,
}) => {
  const [imgErr, setImgErr] = useState(false);
  const t = LOCALES[lang].corporate;

  const handleStartRequest = () => {
    if (!currentUser) {
      onRequireSignIn();
      return;
    }
    onNavigate('organization-dashboard');
  };

  return (
    <div className="bg-white">
      {/* Corporate Hero */}
      <section className="border-b border-slate-200 py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center space-y-5">
            <p className="text-xs font-semibold text-[#39836B] inline-flex items-center gap-1.5">
              <Building2 className="w-4 h-4 shrink-0" />
              {t.kicker}
            </p>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.85rem] font-extrabold text-[#142B46] leading-[1.15] tracking-tight text-balance">
              {t.title}
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">{t.subtitle}</p>
            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                onClick={handleStartRequest}
                className="px-6 py-3 bg-[#142B46] text-white text-sm font-semibold rounded-lg hover:bg-[#1e3d63] inline-flex items-center gap-2"
              >
                {currentUser ? t.ctaSignedIn : t.ctaSignedOut}
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('become-tutor')}
                className="px-5 py-3 bg-[#F5BD54] text-[#142B46] text-sm font-bold rounded-lg hover:bg-[#e5ad43]"
              >
                {t.ctaApplyTrainer}
              </button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="h-72 sm:h-96 lg:h-full min-h-[300px] rounded-xl overflow-hidden border border-slate-200 bg-[#F5F7FA]">
              {!imgErr ? (
                <img
                  src={CORPORATE_HERO_IMAGE_URL}
                  alt={t.imgAlt}
                  referrerPolicy="no-referrer"
                  onError={() => setImgErr(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[#142B46] flex items-center justify-center p-8 text-white">
                  <Building2 className="w-12 h-12 text-[#F5BD54]" />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Who We Serve + Durations + Delivery */}
      <section className="bg-[#F5F7FA] py-12 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2.5">
            <p className="text-xs font-semibold text-[#39836B] inline-flex items-center gap-1.5">
              <Users className="w-4 h-4 shrink-0" />
              {t.orgsTitle}
            </p>
            <p className="text-sm text-slate-700 leading-relaxed">
              {ORGANIZATION_TYPES.filter((typeItem) => typeItem !== 'Other')
                .map((typeItem) => translateOrgType(lang, typeItem))
                .join(' · ')}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2.5">
            <p className="text-xs font-semibold text-[#39836B] inline-flex items-center gap-1.5">
              <Calendar className="w-4 h-4 shrink-0" />
              {t.durationsTitle}
            </p>
            <p className="text-sm text-slate-700 leading-relaxed">
              {CORPORATE_DURATIONS.map((d) => translateCorporateDuration(lang, d)).join(' · ')}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2.5">
            <p className="text-xs font-semibold text-[#39836B] inline-flex items-center gap-1.5">
              <MapPin className="w-4 h-4 shrink-0" />
              {t.venuesTitle}
            </p>
            <p className="text-sm text-slate-700 leading-relaxed">{t.venuesBody}</p>
          </div>
        </div>
      </section>

      {/* 5 Core Training Categories + Admin Custom Categories */}
      <section className="py-16 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#142B46] tracking-tight">
              {t.categoriesTitle}
            </h2>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">{t.categoriesSubtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {t.categories.map((cat) => (
              <div
                key={cat.code}
                className="bg-[#F5F7FA] border border-slate-200 rounded-xl p-6 space-y-3"
              >
                <p className="font-mono-tabular text-xs font-semibold text-[#39836B]">
                  {t.categoryPrefix} {cat.code}
                </p>
                <h3 className="font-display text-lg font-bold text-[#142B46]">{cat.name}</h3>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  {cat.topics.map((topic) => (
                    <li key={topic} className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#39836B] shrink-0" />
                      <span>{topic}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {customCategories
              .filter((c) => c.isActive)
              .map((cat) => (
                <div
                  key={cat.id}
                  className="bg-[#F5F7FA] border border-slate-200 rounded-xl p-6 space-y-3"
                >
                  <p className="font-mono-tabular text-xs font-semibold text-[#39836B]">
                    {t.specializedProgram}
                  </p>
                  <h3 className="font-display text-lg font-bold text-[#142B46]">{cat.name}</h3>
                  <ul className="space-y-1.5 text-xs text-slate-600">
                    {cat.topics.map((topic) => (
                      <li key={topic} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#39836B] shrink-0" />
                        <span>{topic}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </div>
      </section>

      {/* End-to-End Corporate Workflow */}
      <section className="bg-[#F5F7FA] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#142B46] tracking-tight">
              {t.workflowTitle}
            </h2>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">{t.workflowSubtitle}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {t.workflowSteps.map((step) => (
              <div
                key={step}
                className="bg-white border border-slate-200 rounded-xl p-5 text-xs sm:text-sm text-[#142B46] leading-relaxed"
              >
                {step}
              </div>
            ))}
          </div>
          <div className="mt-10 flex justify-center">
            <button
              type="button"
              onClick={handleStartRequest}
              className="px-6 py-3 bg-[#142B46] text-white text-sm font-semibold rounded-lg hover:bg-[#1e3d63]"
            >
              {t.workflowCta}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
