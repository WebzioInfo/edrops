import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  isLoading = false,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  
  const variants = {
    primary: 'bg-edrops-orange text-white hover:bg-edrops-orange/90 focus:ring-edrops-orange',
    secondary: 'bg-edrops-water text-edrops-ocean hover:bg-edrops-water/80 focus:ring-edrops-water',
    outline: 'border-2 border-edrops-ocean text-edrops-ocean hover:bg-edrops-ocean hover:text-white focus:ring-edrops-ocean',
    danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-base',
    lg: 'px-8 py-3.5 text-lg',
  };

  const classes = `
    ${baseStyles}
    ${variants[variant]}
    ${sizes[size]}
    ${fullWidth ? 'w-full' : ''}
    ${className}
  `;

  return (
    <button
      className={classes}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
      {!isLoading && props.icon && <span className="mr-2">{props.icon}</span>}
      {children}
    </button>
  );
};
