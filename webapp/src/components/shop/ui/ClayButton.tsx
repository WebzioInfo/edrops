import { cn } from '../../../lib/utils';
import { forwardRef } from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
}

const ClayButton = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant = 'primary', ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={cn(
        'clay-btn',
        variant === 'secondary' && 'bg-secondary text-secondary-foreground',
        variant === 'ghost' && 'bg-transparent hover:bg-slate-100',
        className
      )}
      {...props}
    />
  );
});

ClayButton.displayName = 'ClayButton';

export default ClayButton;
