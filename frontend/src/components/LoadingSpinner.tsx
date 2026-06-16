interface LoadingSpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  fullPage?: boolean;
  label?: string;
}

export default function LoadingSpinner({ className = '', size = 'md', fullPage = false, label }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-6 w-6 border-2',
    md: 'h-10 w-10 border-4',
    lg: 'h-16 w-16 border-4',
  };

  const spinner = (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className={`animate-spin rounded-full border-slate-200 border-t-[#0F6E8C] ${sizeClasses[size]}`} />
      {label && <p className="text-sm font-semibold text-slate-500">{label}</p>}
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center w-full">
        {spinner}
      </div>
    );
  }

  return spinner;
}
