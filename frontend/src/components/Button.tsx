import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loading?: boolean;
  loadingText?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'success' | 'white';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  isLoading = false,
  loading = false,
  loadingText,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  disabled,
  icon,
  type = 'button',
  ...props
}) => {
  const isCurrentlyLoading = Boolean(isLoading || loading);

  const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none active:scale-[0.99] cursor-pointer';
  
  const variants = {
    primary: 'bg-[#0088CC] text-white hover:bg-[#0077B3] focus:ring-[#0088CC]',
    secondary: 'bg-sky-50 text-sky-800 hover:bg-sky-100 focus:ring-sky-400',
    outline: 'border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 focus:ring-slate-300',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-500',
    ghost: 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:ring-slate-200',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500',
    white: 'bg-white text-slate-800 hover:bg-slate-50 border border-slate-200 shadow-xs focus:ring-slate-200',
  };

  const sizes = {
    xs: 'px-2.5 py-1 text-xs rounded-lg gap-1.5',
    sm: 'px-3 py-1.5 text-xs font-semibold rounded-xl gap-1.5',
    md: 'px-4 py-2.5 text-sm font-semibold rounded-xl gap-2',
    lg: 'px-6 py-3 text-base font-semibold rounded-2xl gap-2.5',
  };

  const spinnerSizes = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const classes = `
    ${baseStyles}
    ${variants[variant] || variants.primary}
    ${sizes[size] || sizes.md}
    ${fullWidth ? 'w-full' : ''}
    ${className}
  `.trim();

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || isCurrentlyLoading}
      {...props}
    >
      {isCurrentlyLoading && (
        <Loader2 className={`${spinnerSizes[size] || spinnerSizes.md} animate-spin shrink-0`} />
      )}
      {!isCurrentlyLoading && icon && (
        <span className="shrink-0 flex items-center">{icon}</span>
      )}
      <span>{isCurrentlyLoading && loadingText ? loadingText : children}</span>
    </button>
  );
};

export default Button;
