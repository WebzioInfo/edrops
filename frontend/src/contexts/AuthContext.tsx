import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'react-hot-toast';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN' | 'DELIVERY_PARTNER' | string;
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

interface AuthContextType {
  user: User | null;
  token: string | null;
  authStatus: AuthStatus;
  isLoading: boolean;
  isAuthenticated: boolean;
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
          setToken(storedToken);
          setUser(parsed);
          setAuthStatus('authenticated');

          // Ensure "Welcome back, {name}!" fires only once per actual login / session-restore
          const alreadyWelcomed = sessionStorage.getItem(SESSION_WELCOME_KEY);
          if (!alreadyWelcomed) {
            sessionStorage.setItem(SESSION_WELCOME_KEY, 'true');
            toast.success(`Welcome back, ${parsed.firstName}!`, { id: 'auth-welcome-toast' });
          }
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
    toast.success(`Welcome back, ${newUser.firstName}!`, { id: 'auth-welcome-toast' });
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
    window.location.href = '/login';
  };

  const isAuthenticated = authStatus === 'authenticated' && Boolean(token && user);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        authStatus,
        isLoading,
        isAuthenticated,
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

