import { cn } from '../../../lib/utils';
import { forwardRef } from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

const ClayCard = forwardRef<HTMLDivElement, CardProps>(({ className, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn('clay-card', className)}
      {...props}
    >
      {children}
    </div>
  );
});

ClayCard.displayName = 'ClayCard';

export default ClayCard;
