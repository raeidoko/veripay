import React from 'react';
import { Shield, Award, Crown, CheckCircle2 } from 'lucide-react';
import { TrustPassportLevel } from '../shared/types.ts';

interface TrustBadgeProps {
  level: TrustPassportLevel;
  score?: number;
  identityVerified?: boolean;
  showScore?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const TrustBadge: React.FC<TrustBadgeProps> = ({
  level,
  score,
  identityVerified = false,
  showScore = true,
  size = 'md',
}) => {
  const getBadgeConfig = () => {
    switch (level) {
      case 'CROWN':
        return {
          icon: Crown,
          name: 'Crown Tier',
          color: 'text-amber-800 bg-amber-50 border-amber-300',
          iconColor: 'text-amber-600',
          accent: 'Crown Seller · Top 1% Sustained Reliability',
        };
      case 'GOLD':
        return {
          icon: Award,
          name: 'Gold Tier',
          color: 'text-yellow-800 bg-yellow-50 border-yellow-300',
          iconColor: 'text-yellow-600',
          accent: 'Gold Tier · Verified Escrow Track Record',
        };
      case 'SILVER':
        return {
          icon: Shield,
          name: 'Silver Tier',
          color: 'text-slate-800 bg-slate-100 border-slate-300',
          iconColor: 'text-slate-600',
          accent: 'Silver Tier · Established Merchant',
        };
      case 'BRONZE':
      default:
        return {
          icon: Shield,
          name: 'Bronze Tier',
          color: 'text-stone-800 bg-stone-100 border-stone-300',
          iconColor: 'text-stone-500',
          accent: 'Bronze Tier · Growing Profile',
        };
    }
  };

  const config = getBadgeConfig();
  const IconComponent = config.icon;

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <div className="inline-flex items-center gap-2 flex-wrap">
      {/* Progressive Trust Level Badge */}
      <span
        title={config.accent}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${config.color}`}
      >
        <IconComponent className={`${iconSizes[size]} ${config.iconColor} shrink-0`} />
        <span>{config.name}</span>
        {showScore && score !== undefined && (
          <span className="tabular-nums opacity-80 border-l border-current/20 pl-1.5 ml-0.5">
            {score}/100
          </span>
        )}
      </span>

      {/* Identity Verification Shown Separately (F5 requirement) */}
      {identityVerified && (
        <span
          title="Identity independently verified via official NIN/CAC/National ID credentials"
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Identity Verified</span>
        </span>
      )}
    </div>
  );
};
