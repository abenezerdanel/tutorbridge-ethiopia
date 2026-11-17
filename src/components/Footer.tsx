import React from 'react';
import { AppRoute, LanguageCode } from '../types';
import { LOCALES } from '../i18n';
import { BrandMark } from './BrandMark';

interface FooterProps {
  lang: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  onNavigate: (route: AppRoute) => void;
  onOpenPolicy: (policy: 'terms' | 'privacy' | 'safeguarding') => void;
}

export const Footer: React.FC<FooterProps> = ({
  lang,
  onLanguageChange,
  onNavigate,
  onOpenPolicy,
}) => {
  const t = LOCALES[lang];

  const scrollToHomeSection = (sectionId: string) => {
    onNavigate('home');
    setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
    }, 80);
  };

  return (
    <footer className="bg-[#142B46] text-white border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-white/10">
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <BrandMark className="w-8 h-8" />
              <span className="font-display text-lg font-bold tracking-tight">
                {t.brand.name}
              </span>
            </div>
            <p className="text-sm text-slate-300 max-w-md leading-relaxed">
              {t.footer.description}
            </p>
            <div className="flex items-center gap-3 pt-1">
              <span className="text-xs text-slate-400">{t.footer.languageLabel}</span>
              <div className="inline-flex bg-white/10 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => onLanguageChange('en')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    lang === 'en' ? 'bg-white text-[#142B46]' : 'text-slate-200 hover:text-white'
                  }`}
                >
                  {t.nav.langEnglishFull}
                </button>
                <button
                  type="button"
                  onClick={() => onLanguageChange('am')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    lang === 'am' ? 'bg-white text-[#142B46]' : 'text-slate-200 hover:text-white'
                  }`}
                >
                  {t.nav.langAmharicFull}
                </button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[#F5BD54] mb-4">
              {t.footer.platformHeading}
            </h3>
            <ul className="space-y-2.5 text-sm text-slate-300">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('tutors')}
                  className="hover:text-white transition-colors text-left"
                >
                  {t.footer.links.findTutor}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('request-matching')}
                  className="hover:text-white transition-colors text-left"
                >
                  {t.footer.links.requestMatch}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('corporate')}
                  className="hover:text-white transition-colors text-left"
                >
                  {t.footer.links.corporate}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('become-tutor')}
                  className="hover:text-white transition-colors text-left"
                >
                  {t.footer.links.becomeTutor}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToHomeSection('about-us')}
                  className="hover:text-white transition-colors text-left"
                >
                  {t.footer.links.aboutUs}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToHomeSection('subjects-skills')}
                  className="hover:text-white transition-colors text-left"
                >
                  {t.footer.links.subjects}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToHomeSection('how-it-works')}
                  className="hover:text-white transition-colors text-left"
                >
                  {t.footer.links.howItWorks}
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[#F5BD54] mb-4">
              {t.footer.trustHeading}
            </h3>
            <ul className="space-y-2.5 text-sm text-slate-300">
              <li>{t.footer.location}</li>
              <li>info@tutorbridge.et</li>
              <li>+251 911 000 000</li>
              <li className="pt-2 flex flex-col items-start gap-1.5">
                <button
                  type="button"
                  onClick={() => onOpenPolicy('safeguarding')}
                  className="text-xs text-slate-300 underline underline-offset-4 hover:text-white text-left"
                >
                  {t.footer.safeguarding}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenPolicy('terms')}
                  className="text-xs text-slate-300 underline underline-offset-4 hover:text-white text-left"
                >
                  {t.footer.terms}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenPolicy('privacy')}
                  className="text-xs text-slate-300 underline underline-offset-4 hover:text-white text-left"
                >
                  {t.footer.privacy}
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-400">
          <p>
            © {new Date().getFullYear()} {t.footer.copyright}
          </p>
          <p>{t.footer.paymentSummary}</p>
        </div>
      </div>
    </footer>
  );
};
