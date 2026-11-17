import React from 'react';
import { X, ShieldCheck } from 'lucide-react';
import { LanguageCode } from '../types';
import { LOCALES } from '../i18n';

interface PolicyModalProps {
  policy: 'terms' | 'privacy' | 'safeguarding' | null;
  lang: LanguageCode;
  onClose: () => void;
}

export const PolicyModal: React.FC<PolicyModalProps> = ({ policy, lang, onClose }) => {
  if (!policy) return null;

  const t = LOCALES[lang];
  const content = t.policyModal[policy];

  return (
    <div className="fixed inset-0 z-50 bg-[#142B46]/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full max-h-[85vh] overflow-y-auto p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#39836B] shrink-0" />
            <h2 className="font-display text-xl font-bold text-[#142B46]">
              {content.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.policyModal.closeAria}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#142B46]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-5 space-y-5">
          {content.sections.map((sec) => (
            <div key={sec.heading}>
              <h3 className="text-sm font-semibold text-[#142B46] mb-1.5">{sec.heading}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{sec.body}</p>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-[#142B46] text-white text-sm font-semibold rounded-lg hover:bg-[#1e3d63] transition-colors"
          >
            {t.common.close}
          </button>
        </div>
      </div>
    </div>
  );
};
