import React from 'react';
import { EdropsLogo } from '../Logo';

export interface EdropsPageLoaderProps {
  className?: string;
  minHeight?: string;
  size?: 'sm' | 'md' | 'lg';
  fullPage?: boolean;
  label?: string;
}

/**
 * Unified Global Edrops Loading Spinner
 *
 * Single project-wide loading indicator featuring the spinning Edrops logo
 * inside a glassmorphic circular badge with drop shadow.
 */
export const EdropsPageLoader: React.FC<EdropsPageLoaderProps> = ({
  className = '',
  minHeight,
  size = 'md',
  fullPage = false,
  label,
}) => {
  const sizeClasses = {
    sm: { pill: 'w-10 h-10', icon: 20, iconClass: 'h-5 w-5' },
    md: { pill: 'w-14 h-14', icon: 28, iconClass: 'h-7 w-7' },
    lg: { pill: 'w-16 h-16', icon: 32, iconClass: 'h-8 w-8' },
  }[size] || { pill: 'w-14 h-14', icon: 28, iconClass: 'h-7 w-7' };

  const spinner = (
    <div
      className={`${sizeClasses.pill} rounded-full bg-white/95 backdrop-blur-md shadow-[0_12px_36px_rgba(0,136,204,0.28)] border border-sky-100 flex items-center justify-center pointer-events-none select-none`}
    >
      <div className="flex items-center justify-center animate-spin">
        <EdropsLogo variant="icon" size={sizeClasses.icon} className={`${sizeClasses.iconClass} pointer-events-none`} />
      </div>
    </div>
  );

  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      {spinner}
      {label && (
        <p className="text-xs font-medium text-slate-500 tracking-wide animate-pulse">
          {label}
        </p>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div
        className={`flex items-center justify-center w-full min-h-[70vh] ${className}`}
        aria-busy="true"
        aria-label={label || 'Loading...'}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center w-full ${minHeight || 'min-h-[45vh] py-16'} ${className}`}
      aria-busy="true"
      aria-label={label || 'Loading...'}
    >
      {content}
    </div>
  );
};

export default EdropsPageLoader;
