import { cn } from '../../../lib/utils';
import { forwardRef } from 'react';

const ClayInput = forwardRef(({ className, type = 'text', ...props }, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      className={cn('clay-input', className)}
      {...props}
    />
  );
});

ClayInput.displayName = 'ClayInput';

export default ClayInput;
