import { EdropsPageLoader, type EdropsPageLoaderProps } from './common/EdropsPageLoader';

export interface LoadingSpinnerProps extends EdropsPageLoaderProps {
  label?: string;
  light?: boolean;
}

/**
 * Standardized LoadingSpinner component.
 * Uses the single global Edrops Logo Spinner across the entire application.
 */
export default function LoadingSpinner({
  className = '',
  size = 'md',
  fullPage = false,
  light = false,
  minHeight,
  label,
}: LoadingSpinnerProps) {
  // If used as a tiny inline button action spinner (e.g. inside a colored submit button)
  if (size === 'sm' && light) {
    return (
      <div
        className={`w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0 ${className}`}
        aria-busy="true"
      />
    );
  }

  return (
    <EdropsPageLoader
      className={className}
      size={size}
      fullPage={fullPage}
      minHeight={minHeight}
      label={label}
    />
  );
}

export { EdropsPageLoader };
