import en from './locales/en.json';
import am from './locales/am.json';
import { LanguageCode, TutorProfile } from './types';

export type LocaleDictionary = typeof en;

export const LOCALES: Record<LanguageCode, LocaleDictionary> = {
  en,
  am,
};

// Backward-compatible flat interface map
export const COPY: Record<
  LanguageCode,
  {
    navFindTutor: string;
    navRequestMatch: string;
    navCorporate: string;
    navBecomeTutor: string;
    navHowItWorks: string;
    navSignIn: string;
    navDashboard: string;
    heroKicker: string;
    heroHeadline: string;
    heroSubhead: string;
    heroPrimaryCta: string;
    heroSecondaryCta: string;
    searchPlaceholder: string;
    searchSubCityAll: string;
    searchDivisionAll: string;
    searchSubmit: string;
    divisionsTitle: string;
    divisionsLead: string;
    howItWorksTitle: string;
    howItWorksLead: string;
    featuredTutorsTitle: string;
    featuredTutorsLead: string;
    viewAllTutors: string;
    whyTitle: string;
    testimonialsTitle: string;
    faqTitle: string;
    becomeTutorBannerTitle: string;
    becomeTutorBannerSub: string;
    becomeTutorBannerCta: string;
    verifiedLabel: string;
    perHourEtb: string;
  }
> = {
  en: {
    navFindTutor: en.nav.findTutor,
    navRequestMatch: en.nav.requestMatch,
    navCorporate: en.nav.corporate,
    navBecomeTutor: en.nav.becomeTutor,
    navHowItWorks: en.nav.howItWorks,
    navSignIn: en.nav.signIn,
    navDashboard: en.nav.dashboard,
    heroKicker: en.home.heroKicker,
    heroHeadline: en.home.heroHeadline,
    heroSubhead: en.home.heroSubhead,
    heroPrimaryCta: en.home.heroPrimaryCta,
    heroSecondaryCta: en.home.heroSecondaryCta,
    searchPlaceholder: en.home.searchPlaceholder,
    searchSubCityAll: en.home.searchSubCityAll,
    searchDivisionAll: en.home.searchDivisionAll,
    searchSubmit: en.home.searchSubmit,
    divisionsTitle: en.home.divisionsTitle,
    divisionsLead: en.home.divisionsLead,
    howItWorksTitle: en.home.howItWorksTitle,
    howItWorksLead: en.home.howItWorksLead,
    featuredTutorsTitle: en.home.featuredTutorsTitle,
    featuredTutorsLead: en.home.featuredTutorsLead,
    viewAllTutors: en.home.viewAllTutors,
    whyTitle: en.home.whyChoose.title,
    testimonialsTitle: en.home.testimonialsTitle,
    faqTitle: en.home.faqTitle,
    becomeTutorBannerTitle: en.home.becomeTutorBannerTitle,
    becomeTutorBannerSub: en.home.becomeTutorBannerSub,
    becomeTutorBannerCta: en.home.becomeTutorBannerCta,
    verifiedLabel: en.common.verifiedEducator,
    perHourEtb: en.common.perHourEtb,
  },
  am: {
    navFindTutor: am.nav.findTutor,
    navRequestMatch: am.nav.requestMatch,
    navCorporate: am.nav.corporate,
    navBecomeTutor: am.nav.becomeTutor,
    navHowItWorks: am.nav.howItWorks,
    navSignIn: am.nav.signIn,
    navDashboard: am.nav.dashboard,
    heroKicker: am.home.heroKicker,
    heroHeadline: am.home.heroHeadline,
    heroSubhead: am.home.heroSubhead,
    heroPrimaryCta: am.home.heroPrimaryCta,
    heroSecondaryCta: am.home.heroSecondaryCta,
    searchPlaceholder: am.home.searchPlaceholder,
    searchSubCityAll: am.home.searchSubCityAll,
    searchDivisionAll: am.home.searchDivisionAll,
    searchSubmit: am.home.searchSubmit,
    divisionsTitle: am.home.divisionsTitle,
    divisionsLead: am.home.divisionsLead,
    howItWorksTitle: am.home.howItWorksTitle,
    howItWorksLead: am.home.howItWorksLead,
    featuredTutorsTitle: am.home.featuredTutorsTitle,
    featuredTutorsLead: am.home.featuredTutorsLead,
    viewAllTutors: am.home.viewAllTutors,
    whyTitle: am.home.whyChoose.title,
    testimonialsTitle: am.home.testimonialsTitle,
    faqTitle: am.home.faqTitle,
    becomeTutorBannerTitle: am.home.becomeTutorBannerTitle,
    becomeTutorBannerSub: am.home.becomeTutorBannerSub,
    becomeTutorBannerCta: am.home.becomeTutorBannerCta,
    verifiedLabel: am.common.verifiedEducator,
    perHourEtb: am.common.perHourEtb,
  },
};

function lookupMap(map: Record<string, string>, key: string): string {
  return map[key] || key;
}

export function translateDivision(lang: LanguageCode, value: string): string {
  return lookupMap(LOCALES[lang].common.divisions, value);
}

export function translateSubCity(lang: LanguageCode, value: string): string {
  return lookupMap(LOCALES[lang].common.subCities, value);
}

export function translateGrade(lang: LanguageCode, value: string): string {
  return lookupMap(LOCALES[lang].common.grades, value);
}

export function translateDay(lang: LanguageCode, value: string): string {
  return lookupMap(LOCALES[lang].common.days, value);
}

export function translateLanguageName(lang: LanguageCode, value: string): string {
  return lookupMap(LOCALES[lang].common.languages, value);
}

export function translateSubject(lang: LanguageCode, value: string): string {
  return lookupMap(LOCALES[lang].common.subjects, value);
}

export function translateOrgType(lang: LanguageCode, value: string): string {
  return lookupMap(LOCALES[lang].common.orgTypes, value);
}

export function translateCorporateDuration(lang: LanguageCode, value: string): string {
  return lookupMap(LOCALES[lang].common.corporateDurations, value);
}

export function translateCity(lang: LanguageCode, value: string): string {
  if (value === 'Addis Ababa') {
    return LOCALES[lang].common.addisAbaba;
  }
  return value;
}

export function localizeTutorDisplay(lang: LanguageCode, tutor: TutorProfile): {
  headline: string;
  bio: string;
  qualifications: string;
  division: string;
  subjects: string[];
  grades: string[];
  subCities: string[];
  availabilityDays: string[];
  languages: string[];
  city: string;
} {
  const seedOverrides = LOCALES[lang].common.seedTutors as Record<
    string,
    { headline: string; bio: string; qualifications: string } | undefined
  >;
  const seedCopy = seedOverrides[tutor.id];

  return {
    headline: seedCopy?.headline || tutor.headline,
    bio: seedCopy?.bio || tutor.bio,
    qualifications: seedCopy?.qualifications || tutor.qualifications,
    division: translateDivision(lang, tutor.division),
    subjects: tutor.subjects.map((s) => translateSubject(lang, s)),
    grades: tutor.grades.map((g) => translateGrade(lang, g)),
    subCities: tutor.subCities.map((sc) => translateSubCity(lang, sc)),
    availabilityDays: tutor.availabilityDays.map((d) => translateDay(lang, d)),
    languages: tutor.languages.map((l) => translateLanguageName(lang, l)),
    city: translateCity(lang, tutor.city),
  };
}
