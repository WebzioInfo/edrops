import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { showToast } from '../utils/toast';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN' | 'DELIVERY_PARTNER' | 'DISTRIBUTOR' | string;
  permissions?: string[];
  isActive?: boolean;
  createdAt?: string;
  deliveryPartner?: {
    id?: string;
    vehicleType?: string;
    vehicleNumber?: string;
    status?: string;
  };
  customer?: {
    jarOwnerships?: Array<{ brandId: string; companyJarsHeld: number; ownedJars: number; brand?: { name: string } }>;
  };
};

export function hasCatalogPermission(user: User | null): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN' || user.role === 'MANAGER' || user.role === 'STAFF') {
    const perms = Array.isArray(user.permissions) ? user.permissions : [];
    if (perms.length === 0) return true;
    return perms.some((p) => {
      const low = String(p).toLowerCase().trim();
      return (
        low === '*' ||
        low === 'all' ||
        low === 'all:manage' ||
        low === 'catalog' ||
        low === 'catalog.*' ||
        low === 'catalog.manage' ||
        low === 'catalog:manage' ||
        low === 'catalog.view' ||
        low === 'catalog:read' ||
        low.startsWith('catalog.') ||
        low.startsWith('catalog:')
      );
    });
  }
  return false;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  authStatus: AuthStatus;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasPermission: (perm: string) => boolean;
  login: (token: string, user: User) => void;
  updateUser: (updatedUser: Partial<User>) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'edrops_token';
const USER_KEY = 'edrops_user';
const SESSION_WELCOME_KEY = 'edrops_session_welcomed';

const getInitialSession = (): { user: User | null; token: string | null; status: AuthStatus } => {
  try {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);

    if (storedToken && storedUser) {
      const parsed = JSON.parse(storedUser);
      if (parsed && typeof parsed === 'object' && parsed.id && parsed.role) {
        if (
          (parsed.role === 'STAFF' || parsed.role === 'MANAGER') &&
          (!parsed.permissions || parsed.permissions.length === 0)
        ) {
          parsed.permissions = [
            'catalog.view',
            'catalog.create',
            'catalog.update',
            'catalog.delete',
            'catalog.manage',
          ];
          try {
            localStorage.setItem(USER_KEY, JSON.stringify(parsed));
          } catch {}
        }
        return { token: storedToken, user: parsed, status: 'authenticated' };
      }
    }
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
  return { token: null, user: null, status: 'unauthenticated' };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [initial] = useState(getInitialSession);
  const [user, setUser] = useState<User | null>(initial.user);
  const [token, setToken] = useState<string | null>(initial.token);
  const [authStatus, setAuthStatus] = useState<AuthStatus>(initial.status);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Restore & verify session on mount; fire session-restore welcome toast once per session
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);

      if (storedToken && storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed && parsed.id && parsed.role) {
          if (
            (parsed.role === 'STAFF' || parsed.role === 'MANAGER') &&
            (!parsed.permissions || parsed.permissions.length === 0)
          ) {
            parsed.permissions = [
              'catalog.view',
              'catalog.create',
              'catalog.update',
              'catalog.delete',
              'catalog.manage',
            ];
            try {
              localStorage.setItem(USER_KEY, JSON.stringify(parsed));
            } catch {}
          }
          setToken(storedToken);
          setUser(parsed);
          setAuthStatus('authenticated');
        } else {
          setAuthStatus('unauthenticated');
        }
      } else {
        setAuthStatus('unauthenticated');
      }
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setAuthStatus('unauthenticated');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    setAuthStatus('authenticated');
    setIsLoading(false);
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    sessionStorage.setItem(SESSION_WELCOME_KEY, 'true');
    showToast.success(`Welcome back, ${newUser.firstName || 'User'}!`, {
      id: 'auth-welcome-toast',
      description: 'You are now signed in.',
    });
  };

  const updateUser = (updatedFields: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null;
      const merged = { ...prev, ...updatedFields };
      localStorage.setItem(USER_KEY, JSON.stringify(merged));
      return merged;
    });
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setAuthStatus('unauthenticated');
    setIsLoading(false);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('edrops_remember');
    localStorage.removeItem('edrops_banner_closed');
    sessionStorage.removeItem(SESSION_WELCOME_KEY);
    sessionStorage.removeItem('dashboard_greeting_dismissed');
    window.location.href = '/login';
  };

  const isAuthenticated = authStatus === 'authenticated' && Boolean(token && user);

  const hasPermission = (perm: string): boolean => {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    const perms = Array.isArray(user.permissions) ? user.permissions : [];
    const target = perm.toLowerCase().trim();
    return perms.some((p) => {
      const u = String(p).toLowerCase().trim();
      return (
        u === '*' ||
        u === 'all' ||
        u === 'all:manage' ||
        u === target ||
        (u.startsWith('catalog') && target.startsWith('catalog'))
      );
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        authStatus,
        isLoading,
        isAuthenticated,
        hasPermission,
        login,
        updateUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

