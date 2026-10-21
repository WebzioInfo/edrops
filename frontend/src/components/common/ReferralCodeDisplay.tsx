import { Tag } from 'lucide-react';
import CopyReferralCodeButton from './CopyReferralCodeButton';

export interface ReferralCodeDisplayProps {
  /** The referral code to display and copy */
  code?: string | null;
  /** Optional label (e.g. "Distributor Referral Code" or "Customer Referral Code") */
  label?: string;
  /** Visual variant */
  variant?: 'slate' | 'amber' | 'sky' | 'plain';
  /** Size variant */
  size?: 'xs' | 'sm' | 'base';
  /** Show the Tag icon */
  showIcon?: boolean;
  /** Additional container classes */
  className?: string;
}

export default function ReferralCodeDisplay({
  code,
  label,
  variant = 'slate',
  size = 'xs',
  showIcon = true,
  className = '',
}: ReferralCodeDisplayProps) {
  if (!code) return null;

  const variantStyles = {
    slate: {
      badge: 'bg-slate-100 text-slate-800 border-slate-200',
      tag: 'text-slate-400',
      button: 'hover:bg-slate-200 text-slate-500 hover:text-slate-700',
      label: 'text-slate-500',
    },
    amber: {
      badge: 'bg-amber-50 text-amber-900 border-amber-200/80',
      tag: 'text-amber-600',
      button: 'hover:bg-amber-100 text-amber-700',
      label: 'text-amber-800',
    },
    sky: {
      badge: 'bg-sky-50 text-[#1677C8] border-sky-200',
      tag: 'text-[#1677C8]',
      button: 'hover:bg-sky-100 text-[#1677C8]',
      label: 'text-sky-700',
    },
    plain: {
      badge: 'bg-transparent text-slate-800 border-transparent',
      tag: 'text-slate-400',
      button: 'hover:bg-slate-100 text-slate-500',
      label: 'text-slate-500',
    },
  }[variant];

  const sizeStyles = {
    xs: {
      container: 'text-xs',
      code: 'text-xs px-1.5 py-0.5',
      icon: 'w-3 h-3',
      buttonIcon: 'w-3 h-3',
      button: 'p-0.5',
    },
    sm: {
      container: 'text-xs sm:text-sm',
      code: 'text-xs sm:text-sm px-2 py-0.5',
      icon: 'w-3.5 h-3.5',
      buttonIcon: 'w-3.5 h-3.5',
      button: 'p-1',
    },
    base: {
      container: 'text-sm sm:text-base',
      code: 'text-base font-extrabold px-2.5 py-1',
      icon: 'w-4 h-4',
      buttonIcon: 'w-4 h-4',
      button: 'p-1.5',
    },
  }[size];

  return (
    <div className={`inline-flex items-center gap-1.5 font-medium ${sizeStyles.container} ${className}`}>
      {showIcon && <Tag className={`${sizeStyles.icon} ${variantStyles.tag} shrink-0`} />}
      {label && <span className={`${variantStyles.label} font-medium`}>{label}:</span>}
      <span
        className={`font-mono font-bold rounded-lg border ${variantStyles.badge} ${sizeStyles.code}`}
      >
        {code}
      </span>
      <CopyReferralCodeButton
        code={code}
        iconClassName={sizeStyles.buttonIcon}
        className={`rounded-md ${variantStyles.button} ${sizeStyles.button}`}
      />
    </div>
  );
}
