import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { AppRoute, LanguageCode, UserAccount } from '../types';
import { LOCALES } from '../i18n';
import { BrandMark } from './BrandMark';

interface NavbarProps {
  route: AppRoute;
  onNavigate: (route: AppRoute) => void;
  lang: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  currentUser: UserAccount | null;
  onSignInClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  route,
  onNavigate,
  lang,
  onLanguageChange,
  currentUser,
  onSignInClick,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = LOCALES[lang];

  const handleLink = (target: AppRoute) => {
    setMobileOpen(false);
    onNavigate(target);
  };

  const handleHowItWorks = () => {
    setMobileOpen(false);
    onNavigate('home');
    setTimeout(() => {
      const el = document.getElementById('how-it-works');
      el?.scrollIntoView({ behavior: 'smooth' });
    }, 60);
  };

  const primaryAction = () => {
    setMobileOpen(false);
    if (!currentUser) {
      onSignInClick();
    } else if (currentUser.role === 'organization') {
      onNavigate('organization-dashboard');
    } else if (currentUser.role === 'tutor' || currentUser.role === 'trainer') {
      onNavigate('tutor-dashboard');
    } else {
      onNavigate('parent-dashboard');
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 lg:gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleLink('home')}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#142B46] rounded-md"
        >
          <BrandMark className="w-8 h-8 shrink-0" />
          <span className="font-display text-lg font-bold tracking-tight text-[#142B46] whitespace-nowrap">
            {t.brand.name}
          </span>
        </button>

        {/* Zone 2: 5 Concise Single-Line Navigation Links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-4 lg:gap-6 text-sm font-medium text-slate-600"
        >
          <button
            type="button"
            onClick={() => handleLink('tutors')}
            className={`whitespace-nowrap shrink-0 py-1 transition-colors hover:text-[#142B46] ${
              route === 'tutors' || route === 'tutor-profile'
                ? 'text-[#142B46] font-semibold underline decoration-[#F5BD54] decoration-2 underline-offset-8'
                : ''
            }`}
          >
            {t.nav.findTutor}
          </button>
          <button
            type="button"
            onClick={() => handleLink('request-matching')}
            className={`whitespace-nowrap shrink-0 py-1 transition-colors hover:text-[#142B46] ${
              route === 'request-matching'
                ? 'text-[#142B46] font-semibold underline decoration-[#F5BD54] decoration-2 underline-offset-8'
                : ''
            }`}
          >
            {t.nav.requestMatch}
          </button>
          <button
            type="button"
            onClick={() => handleLink('corporate')}
            className={`whitespace-nowrap shrink-0 py-1 transition-colors hover:text-[#142B46] ${
              route === 'corporate'
                ? 'text-[#142B46] font-semibold underline decoration-[#F5BD54] decoration-2 underline-offset-8'
                : ''
            }`}
          >
            {t.nav.corporate}
          </button>
          <button
            type="button"
            onClick={() => handleLink('become-tutor')}
            className={`whitespace-nowrap shrink-0 py-1 transition-colors hover:text-[#142B46] ${
              route === 'become-tutor'
                ? 'text-[#142B46] font-semibold underline decoration-[#F5BD54] decoration-2 underline-offset-8'
                : ''
            }`}
          >
            {t.nav.becomeTutor}
          </button>
          <button
            type="button"
            onClick={handleHowItWorks}
            className="whitespace-nowrap shrink-0 py-1 transition-colors hover:text-[#142B46]"
          >
            {t.nav.howItWorks}
          </button>
        </nav>

        {/* Zone 3: Language Switcher + Primary Action Button */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          <div
            role="group"
            aria-label="Language switcher"
            className="inline-flex items-center p-0.5 bg-[#F5F7FA] border border-slate-200 rounded-lg shrink-0"
          >
            <button
              type="button"
              onClick={() => onLanguageChange('en')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                lang === 'en'
                  ? 'bg-white text-[#142B46] shadow-sm'
                  : 'text-slate-600 hover:text-[#142B46]'
              }`}
            >
              {t.nav.langEn}
            </button>
            <button
              type="button"
              onClick={() => onLanguageChange('am')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                lang === 'am'
                  ? 'bg-white text-[#142B46] shadow-sm'
                  : 'text-slate-600 hover:text-[#142B46]'
              }`}
            >
              {t.nav.langAm}
            </button>
          </div>

          <button
            type="button"
            onClick={primaryAction}
            className="px-4 py-2 bg-[#142B46] text-white text-sm font-semibold rounded-lg hover:bg-[#1e3d63] transition-colors whitespace-nowrap shrink-0"
          >
            {currentUser ? t.nav.dashboard : t.nav.signIn}
          </button>
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label={t.nav.toggleMenu}
          className="md:hidden p-2 rounded-lg text-[#142B46] hover:bg-slate-100"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Dropdown */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-slate-200 px-4 py-4 space-y-2">
          <div className="flex items-center justify-between px-3 pb-2 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-500">{t.footer.languageLabel}</span>
            <div className="inline-flex items-center p-0.5 bg-[#F5F7FA] border border-slate-200 rounded-lg">
              <button
                type="button"
                onClick={() => onLanguageChange('en')}
                className={`px-3 py-1 text-xs font-semibold rounded-md ${
                  lang === 'en' ? 'bg-white text-[#142B46] shadow-sm' : 'text-slate-600'
                }`}
              >
                {t.nav.langEnglishFull}
              </button>
              <button
                type="button"
                onClick={() => onLanguageChange('am')}
                className={`px-3 py-1 text-xs font-semibold rounded-md ${
                  lang === 'am' ? 'bg-white text-[#142B46] shadow-sm' : 'text-slate-600'
                }`}
              >
                {t.nav.langAmharicFull}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleLink('tutors')}
            className="block w-full text-left px-3 py-2.5 text-sm font-medium text-[#142B46] hover:bg-[#F5F7FA] rounded-lg"
          >
            {t.nav.findTutor}
          </button>
          <button
            type="button"
            onClick={() => handleLink('request-matching')}
            className="block w-full text-left px-3 py-2.5 text-sm font-medium text-[#142B46] hover:bg-[#F5F7FA] rounded-lg"
          >
            {t.nav.requestMatch}
          </button>
          <button
            type="button"
            onClick={() => handleLink('corporate')}
            className="block w-full text-left px-3 py-2.5 text-sm font-medium text-[#142B46] hover:bg-[#F5F7FA] rounded-lg"
          >
            {t.nav.corporate}
          </button>
          <button
            type="button"
            onClick={() => handleLink('become-tutor')}
            className="block w-full text-left px-3 py-2.5 text-sm font-medium text-[#142B46] hover:bg-[#F5F7FA] rounded-lg"
          >
            {t.nav.becomeTutor}
          </button>
          <button
            type="button"
            onClick={handleHowItWorks}
            className="block w-full text-left px-3 py-2.5 text-sm font-medium text-[#142B46] hover:bg-[#F5F7FA] rounded-lg"
          >
            {t.nav.howItWorks}
          </button>
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={primaryAction}
              className="w-full px-4 py-2.5 bg-[#142B46] text-white text-sm font-semibold rounded-lg"
            >
              {currentUser ? t.nav.dashboard : t.nav.signIn}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
