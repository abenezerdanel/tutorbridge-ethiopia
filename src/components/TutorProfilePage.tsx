import React from 'react';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  GraduationCap,
  Languages,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { LanguageCode, Review, TutorProfile } from '../types';
import { LOCALES, localizeTutorDisplay } from '../i18n';

interface TutorProfilePageProps {
  lang: LanguageCode;
  tutor: TutorProfile;
  reviews: Review[];
  onBack: () => void;
  onBookClick: (tutor: TutorProfile) => void;
  onMessageTutor?: (tutor: TutorProfile) => void;
}

export const TutorProfilePage: React.FC<TutorProfilePageProps> = ({
  lang,
  tutor,
  reviews,
  onBack,
  onBookClick,
  onMessageTutor,
}) => {
  const dict = LOCALES[lang];
  const t = dict.tutorProfile;
  const localized = localizeTutorDisplay(lang, tutor);

  const tutorReviews = reviews.filter((r) => r.tutorId === tutor.id);
  const displayRating =
    tutorReviews.length > 0
      ? (
          tutorReviews.reduce((acc, r) => acc + r.rating, 0) / tutorReviews.length
        ).toFixed(1)
      : tutor.ratingAvg > 0
      ? tutor.ratingAvg.toFixed(1)
      : dict.common.newLabel;

  const displayCount = tutorReviews.length > 0 ? tutorReviews.length : tutor.reviewCount;
  const firstName = tutor.fullName.split(' ')[0];

  return (
    <div className="bg-[#F5F7FA] min-h-screen py-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#142B46] hover:text-[#39836B]"
        >
          <ArrowLeft className="w-4 h-4" />
          {t.backToDirectory}
        </button>

        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Profile Info */}
          <div className="lg:col-span-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-6 border-b border-slate-200">
              <div className="w-24 h-24 rounded-xl overflow-hidden bg-[#F5F7FA] border border-slate-200 shrink-0">
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

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {tutor.isVerified && (
                    <span className="inline-flex items-center gap-1 font-semibold text-[#39836B]">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      {t.verifiedBadge}
                    </span>
                  )}
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono-tabular font-semibold text-[#142B46]">
                    <Star className="w-4 h-4 fill-[#F5BD54] text-[#F5BD54]" />
                    {displayRating} ({displayCount} {t.reviewsSuffix})
                  </span>
                </div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#142B46]">
                  {tutor.fullName}
                </h1>
                <p className="text-sm sm:text-base text-slate-600">{localized.headline}</p>
              </div>
            </div>

            <div>
              <h2 className="font-display text-lg font-bold text-[#142B46] mb-2">
                {t.introHeading}
              </h2>
              <p className="text-sm text-slate-700 leading-relaxed">{localized.bio}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
              <div className="p-4 bg-[#F5F7FA] border border-slate-200 rounded-xl space-y-1.5">
                <p className="text-xs font-semibold text-[#142B46] inline-flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-[#39836B] shrink-0" />
                  {t.qualificationsHeading}
                </p>
                <p className="text-sm text-slate-700">{localized.qualifications}</p>
                <p className="text-xs text-slate-500">
                  {tutor.experienceYears} {t.yearsExpSuffix}
                </p>
              </div>

              <div className="p-4 bg-[#F5F7FA] border border-slate-200 rounded-xl space-y-1.5">
                <p className="text-xs font-semibold text-[#142B46] inline-flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#39836B] shrink-0" />
                  {t.locationsHeading}
                </p>
                <p className="text-sm text-slate-700">
                  {localized.city}: {localized.subCities.join(', ')}
                </p>
                <p className="text-xs text-slate-500">{t.inPersonNote}</p>
              </div>

              <div className="p-4 bg-[#F5F7FA] border border-slate-200 rounded-xl space-y-1.5">
                <p className="text-xs font-semibold text-[#142B46] inline-flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#39836B] shrink-0" />
                  {t.availabilityHeading}
                </p>
                <p className="text-sm text-slate-700">{localized.availabilityDays.join(' · ')}</p>
              </div>

              <div className="p-4 bg-[#F5F7FA] border border-slate-200 rounded-xl space-y-1.5">
                <p className="text-xs font-semibold text-[#142B46] inline-flex items-center gap-1.5">
                  <Languages className="w-4 h-4 text-[#39836B] shrink-0" />
                  {t.languagesHeading}
                </p>
                <p className="text-sm text-slate-700">{localized.languages.join(' · ')}</p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <h3 className="text-sm font-bold text-[#142B46]">{t.subjectsLevelsHeading}</h3>
              <p className="text-sm text-slate-600">
                <strong className="text-[#142B46]">{t.divisionLabel}</strong> {localized.division}
              </p>
              <p className="text-sm text-slate-600">
                <strong className="text-[#142B46]">{t.subjectsLabel}</strong>{' '}
                {localized.subjects.join(' · ')}
              </p>
              <p className="text-sm text-slate-600">
                <strong className="text-[#142B46]">{t.levelsLabel}</strong>{' '}
                {localized.grades.join(' · ')}
              </p>
            </div>

            {/* Parent Reviews */}
            <div className="pt-6 border-t border-slate-200 space-y-4">
              <h2 className="font-display text-lg font-bold text-[#142B46]">
                {t.reviewsHeading}
              </h2>
              {tutorReviews.length === 0 ? (
                <p className="text-sm text-slate-500">{t.noReviewsText}</p>
              ) : (
                <div className="space-y-3">
                  {tutorReviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="p-4 bg-[#F5F7FA] border border-slate-200 rounded-xl space-y-1"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#142B46]">{rev.authorName}</span>
                        <span className="inline-flex items-center gap-1 font-mono-tabular font-semibold text-[#142B46]">
                          <Star className="w-3.5 h-3.5 fill-[#F5BD54] text-[#F5BD54]" />
                          {rev.rating.toFixed(1)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700">{rev.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sticky Booking Card */}
          <div className="lg:col-span-4">
            <div className="border border-slate-200 rounded-xl p-6 bg-[#F5F7FA] space-y-5 sticky top-24">
              <div>
                <p className="text-xs font-medium text-slate-500">{t.rateLabel}</p>
                <p className="font-mono-tabular text-3xl font-extrabold text-[#142B46] mt-1">
                  {tutor.hourlyRateEtb.toLocaleString()}{' '}
                  <span className="text-sm font-normal text-slate-600">
                    {dict.common.perHourEtb}
                  </span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => onBookClick(tutor)}
                className="w-full py-3 bg-[#142B46] text-white text-sm font-semibold rounded-lg hover:bg-[#1e3d63] transition-colors"
              >
                {t.requestBookingPrefix} {firstName}
              </button>

              {onMessageTutor && (
                <button
                  type="button"
                  onClick={() => onMessageTutor(tutor)}
                  className="w-full py-2.5 border border-[#142B46] text-[#142B46] bg-white text-xs font-semibold rounded-lg hover:bg-slate-100 transition-colors inline-flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4 text-[#39836B] shrink-0" />
                  {t.messagePrefix} {firstName} {t.messageSuffix}
                </button>
              )}

              <div className="pt-4 border-t border-slate-200 space-y-2.5 text-xs text-slate-600">
                <p className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#39836B] shrink-0 mt-0.5" />
                  <span>{t.privacyNote}</span>
                </p>
                <p>
                  {t.paymentNotePrefix} {firstName} {t.paymentNoteSuffix}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
