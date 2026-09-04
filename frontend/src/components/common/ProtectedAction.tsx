import React from 'react';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import type { RequireAuthOptions } from '../../hooks/useRequireAuth';

export interface ProtectedActionProps extends RequireAuthOptions {
  children: (trigger: (e?: React.SyntheticEvent) => void, isAuthenticated: boolean) => React.ReactNode;
  onAction: () => void;
}

export const ProtectedAction: React.FC<ProtectedActionProps> = ({
  children,
  onAction,
  redirect,
  reason = 'purchase',
}) => {
  const { requireAuth, isAuthenticated } = useRequireAuth();

  const handleTrigger = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    requireAuth(onAction, { redirect, reason });
  };

  return <>{children(handleTrigger, isAuthenticated)}</>;
};

export default ProtectedAction;
