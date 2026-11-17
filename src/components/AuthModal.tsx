import React, { useState } from 'react';
import { X, ShieldCheck } from 'lucide-react';
import { LanguageCode } from '../types';
import { LOCALES } from '../i18n';
import { BrandMark } from './BrandMark';

export type SignupRoleChoice = 'parent' | 'tutor' | 'trainer' | 'organization';

interface AuthModalProps {
  open: boolean;
  lang: LanguageCode;
  onClose: () => void;
  onGoogleSignIn: (chosenRole: SignupRoleChoice) => Promise<void>;
  errorMsg: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  open,
  lang,
  onClose,
  onGoogleSignIn,
  errorMsg,
}) => {
  const [role, setRole] = useState<SignupRoleChoice>('parent');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const t = LOCALES[lang].authModal;

  const handleContinue = async () => {
    setLoading(true);
    try {
      await onGoogleSignIn(role);
    } finally {
      setLoading(false);
    }
  };

  const roles: { id: SignupRoleChoice; title: string; desc: string }[] = [
    {
      id: 'parent',
      title: t.roles.parent.title,
      desc: t.roles.parent.desc,
    },
    {
      id: 'tutor',
      title: t.roles.tutor.title,
      desc: t.roles.tutor.desc,
    },
    {
      id: 'trainer',
      title: t.roles.trainer.title,
      desc: t.roles.trainer.desc,
    },
    {
      id: 'organization',
      title: t.roles.organization.title,
      desc: t.roles.organization.desc,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#142B46]/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 sm:p-7 space-y-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <BrandMark className="w-8 h-8" />
            <div>
              <h2 className="font-display text-lg font-bold text-[#142B46]">{t.title}</h2>
              <p className="text-xs text-slate-500">{t.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.closeAria}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#142B46]">{t.selectAccountType}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {roles.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRole(r.id)}
                className={`p-3.5 text-left rounded-xl border transition-colors ${
                  role === r.id
                    ? 'border-[#142B46] bg-[#F5F7FA]'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <p className="text-xs font-bold text-[#142B46]">{r.title}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{r.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {errorMsg && <p className="text-xs text-red-600 font-medium">{errorMsg}</p>}

        <button
          type="button"
          onClick={handleContinue}
          disabled={loading}
          className="w-full py-3 bg-[#142B46] text-white text-sm font-semibold rounded-lg hover:bg-[#1e3d63] disabled:opacity-60 transition-colors"
        >
          {loading ? t.connecting : t.continueGoogle}
        </button>

        <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#39836B] shrink-0" />
          <span>{t.privacyNote}</span>
        </p>
      </div>
    </div>
  );
};
