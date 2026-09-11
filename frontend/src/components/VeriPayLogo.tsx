/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface VeriPayLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
}

export default function VeriPayLogo({
  className = '',
  size = 'md',
  showSubtitle = true,
}: VeriPayLogoProps) {
  // Determine sizing scales for logo components
  let shieldSize = 'w-10 h-10';
  let titleTextSize = 'text-2xl';
  let subtitleTextSize = 'text-[7.5px]';

  if (size === 'sm') {
    shieldSize = 'w-7 h-7';
    titleTextSize = 'text-lg';
    subtitleTextSize = 'text-[6px]';
  } else if (size === 'lg') {
    shieldSize = 'w-16 h-16';
    titleTextSize = 'text-4xl';
    subtitleTextSize = 'text-[11px]';
  } else if (size === 'xl') {
    shieldSize = 'w-24 h-24';
    titleTextSize = 'text-5xl';
    subtitleTextSize = 'text-[13px]';
  }

  return (
      <div id="veripay-logo" className={`flex items-center gap-3 ${className}`}>
      {/* High-fidelity vector shield & checkmark based on logo image */}
      <div className={`relative ${shieldSize} flex-shrink-0 flex items-center justify-center`}>
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Deep Navy Shield Chevron Shape */}
          <path
            d="M15 15 C13.5 25 21 53 50 85 C79 53 86.5 25 85 15 C75 18 61 28 50 28 C39 28 25 18 15 15 Z"
            fill="#0F172A"
          />
          {/* Coral/Orange Rounded Checkmark */}
          <path
            d="M32 46 L46 60 L70 33"
            stroke="#2563EB"
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Modern, elegant typographic presentation */}
      <div className="flex flex-col justify-center select-none leading-none">
        <h1 className={`${titleTextSize} font-sans font-extrabold tracking-tight flex items-baseline`}>
          <span className="text-[#0F172A]">Veri</span>
          <span className="text-[#2563EB]">Pay</span>
        </h1>
        {showSubtitle && (
          <span
            className={`${subtitleTextSize} text-[#64748B] font-bold tracking-[0.2em] mt-1 font-mono uppercase`}
          >
            Secure Escrow Payments
          </span>
        )}
      </div>
    </div>
  );
}
