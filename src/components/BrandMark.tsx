import React from 'react';

interface BrandMarkProps {
  className?: string;
}

export const BrandMark: React.FC<BrandMarkProps> = ({ className = 'w-8 h-8' }) => {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="36" height="36" rx="8" fill="#142B46" />
      {/* Open book base */}
      <path
        d="M8.5 23.5C11.5 21.8 14.8 21.8 18 23.5C21.2 21.8 24.5 21.8 27.5 23.5V14.5C24.5 12.8 21.2 12.8 18 14.5C14.8 12.8 11.5 12.8 8.5 14.5V23.5Z"
        stroke="#FFFFFF"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M18 14.5V23.5" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
      {/* Connecting Warm Gold Bridge Arch */}
      <path
        d="M7 11.5C10.5 7.5 25.5 7.5 29 11.5"
        stroke="#F5BD54"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="18" cy="8.5" r="1.5" fill="#F5BD54" />
    </svg>
  );
};
