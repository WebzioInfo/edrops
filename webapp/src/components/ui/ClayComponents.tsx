import React, { forwardRef } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const ClayContainer = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("bg-background min-h-screen text-foreground", className)}
        {...props}
      />
    );
  }
);
ClayContainer.displayName = "ClayContainer";

export const ClayCard = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("clay-card", className)}
        {...props}
      />
    );
  }
);
ClayCard.displayName = "ClayCard";

export interface ClayButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
}

export const ClayButton = forwardRef<HTMLButtonElement, ClayButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => {
    const variantStyles = {
      primary: "clay-btn",
      secondary: "bg-card text-foreground shadow-[4px_4px_8px_#d1d9e6,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#0a0b10,-4px_-4px_8px_#1e202d] active:shadow-[inset_4px_4px_8px_rgba(0,0,0,0.1),inset_-4px_-4px_8px_rgba(255,255,255,0.7)] dark:active:shadow-[inset_4px_4px_8px_rgba(0,0,0,0.3),inset_-4px_-4px_8px_rgba(255,255,255,0.1)] rounded-full px-6 py-2 transition-all active:scale-95",
      ghost: "hover:bg-card text-foreground rounded-full px-6 py-2 transition-all",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-medium outline-none",
          variantStyles[variant],
          className
        )}
        {...props}
      />
    );
  }
);
ClayButton.displayName = "ClayButton";

export const ClayInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn("clay-input w-full", className)}
        {...props}
      />
    );
  }
);
ClayInput.displayName = "ClayInput";

export const ClayStatCard = forwardRef<
  HTMLDivElement, 
  React.HTMLAttributes<HTMLDivElement> & { 
    title: string; 
    value: string | number; 
    icon?: React.ReactNode; 
    trend?: string;
  }
>(({ className, title, value, icon, trend, ...props }, ref) => {
  return (
    <ClayCard ref={ref} className={cn("flex flex-col gap-2", className)} {...props}>
      <div className="flex justify-between items-center text-muted-foreground">
        <h3 className="text-sm font-semibold">{title}</h3>
        {icon && <div className="text-primary">{icon}</div>}
      </div>
      <div className="text-3xl font-bold text-foreground mt-2">{value}</div>
      {trend && <p className="text-xs text-primary/80 mt-1">{trend}</p>}
    </ClayCard>
  );
});
ClayStatCard.displayName = "ClayStatCard";
