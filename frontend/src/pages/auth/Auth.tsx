import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-hot-toast';
import { Eye, EyeOff, Lock, Mail, Check, AlertCircle, RotateCcw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchWithAuth } from '../../api/client';
import { EdropsLogo } from '../../components/Logo';
import PullToRefresh from '../../components/pwa/PullToRefresh';
import Toast from '../../components/Toast';
import PhoneGate from './PhoneGate';

export type AuthState = 'signin' | 'signup' | 'forgot';

// --- VALIDATION SCHEMAS ---
const loginSchema = Yup.object({
  identifier: Yup.string().required('Phone number or email is required'),
  password: Yup.string().required('Password is required'),
});

const registerSchema = Yup.object({
  fullName: Yup.string().min(2, 'Must be at least 2 characters').required('Full name is required'),
  phone: Yup.string().required('Phone number is required'),
  email: Yup.string().email('Invalid email address').optional(),
  address: Yup.string().optional(),
  password: Yup.string()
    .min(8, 'Minimum 8 characters')
    .matches(/[A-Z]/, 'Needs uppercase')
    .matches(/[a-z]/, 'Needs lowercase')
    .matches(/[0-9]/, 'Needs number')
    .required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords must match')
    .required('Confirm password is required'),
  acceptTerms: Yup.boolean().oneOf([true], 'You must accept the terms').required(),
});

const forgotSchema = Yup.object({
  email: Yup.string().trim().email('Please enter a valid email address').required('Email is required'),
});

const ROLE_PATHS: Record<string, string> = {
  CUSTOMER: '/customer/shop',
  STAFF: '/staff',
  ADMIN: '/admin',
  DELIVERY_PARTNER: '/delivery-partner',
};

// --- GOOGLE BRAND ICON ---
const GoogleIcon = () => (
  <svg className="w-5 h-5 mr-2 shrink-0" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

// --- ARIMO-STYLE MINIMAL INPUT COMPONENT ---
const ArimoInput = ({
  field,
  form,
  icon: Icon,
  type = 'text',
  placeholder,
  label,
  autoComplete,
  ...props
}: any) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;
  const hasError = Boolean(form.touched[field.name] && form.errors[field.name]);

  return (
    <div className="mb-3 text-left">
      {label && (
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-3.5 text-slate-400 pointer-events-none">
            <Icon className="w-4 h-4" />
          </div>
        )}

        <input
          {...field}
          {...props}
          value={field.value ?? ''}
          type={inputType}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className={`w-full h-11 sm:h-12 ${
            Icon ? 'pl-10' : 'pl-3.5'
          } ${isPassword ? 'pr-10' : 'pr-3.5'} rounded-2xl bg-white border outline-none text-sm placeholder:text-slate-400 text-slate-900 transition-all duration-200 ${
            hasError
              ? 'border-rose-300 bg-rose-50/20 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10'
              : 'border-slate-200 focus:border-[#0088CC] focus:ring-4 focus:ring-[#0088CC]/10 hover:border-slate-300'
          }`}
        />

        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 text-slate-400 hover:text-slate-700 transition-colors p-1 cursor-pointer"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>

      {hasError && (
        <p className="mt-1 text-xs text-rose-500 font-medium pl-1 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{form.errors[field.name]}</span>
        </p>
      )}
    </div>
  );
};

// --- PASSWORD STRENGTH BAR ---
const calculateStrength = (pwd: string) => {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= 8) score += 1;
  if (/[A-Z]/.test(pwd)) score += 1;
  if (/[a-z]/.test(pwd)) score += 1;
  if (/[0-9]/.test(pwd)) score += 1;
  return score;
};

const PasswordStrength = ({ password }: { password: string }) => {
  const score = calculateStrength(password);
  if (!password) return null;

  const colors = ['bg-slate-200', 'bg-rose-500', 'bg-amber-500', 'bg-sky-500', 'bg-emerald-500'];

  return (
    <div className="mb-2">
      <div className="grid grid-cols-4 gap-1 h-1">
        {[1, 2, 3, 4].map((step) => (
          <div
            key={step}
            className={`h-full rounded-full transition-colors duration-300 ${
              step <= score ? colors[score] : 'bg-slate-100'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

const easeBezier = [0.32, 0.72, 0, 1] as const;

// --- MAIN AUTH COMPONENT ---
export default function Auth({ initialMode }: { initialMode?: AuthState }) {
  const navigate = useNavigate();
  const location = useLocation();

  const getInitial = (): AuthState => {
    if (initialMode) return initialMode;
    if (location.pathname.includes('register') || location.pathname.includes('signup')) return 'signup';
    if (location.pathname.includes('forgot')) return 'forgot';
    return 'signin';
  };

  const [state, setState] = useState<AuthState>(getInitial);
  const [searchParams] = useSearchParams();
  const { user, authStatus, isLoading, login } = useAuth();
  
  const [authToastMessage, setAuthToastMessage] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [phoneGateState, setPhoneGateState] = useState<{
    tempToken: string;
    googleUser: {
      name: string;
      email: string;
      avatar?: string;
    };
  } | null>(null);

  const redirectParam = searchParams.get('redirect') || (location.state as any)?.redirect || (location.state as any)?.from?.pathname;

  const handleSuccessRedirect = (targetUser: any) => {
    const roleDefault = ROLE_PATHS[targetUser?.role] ?? '/customer/shop';
    let target = roleDefault;
    if (redirectParam) {
      const decoded = decodeURIComponent(redirectParam);
      if (decoded.startsWith('/') && !decoded.startsWith('//') && !decoded.startsWith('/login')) {
        target = decoded;
      }
    }
    navigate(target, { replace: true });
  };

  // Read auth redirect reason once on mount and clear from URL
  useEffect(() => {
    // 1. Never trigger toasts while auth state is still loading / hydrating
    if (isLoading || authStatus === 'loading') {
      return;
    }

    // 2. If user is already authenticated, forward to their authorized portal and never show unauthorized toast
    if (authStatus === 'authenticated' && user) {
      handleSuccessRedirect(user);
      return;
    }

    // 3. Only show "Please log in with an authorized account" or other redirect toasts when authStatus is confirmed 'unauthenticated'
    if (authStatus === 'unauthenticated') {
      const reason = searchParams.get('reason') || (location.state as any)?.reason;
      const isAuthRequired = searchParams.get('auth_required') === 'true' || searchParams.get('redirect') || reason;

      if (reason || isAuthRequired) {
        let msg = 'Please log in to continue';
        if (reason === 'purchase' || reason === 'buy_now') {
          msg = 'Please log in to proceed with your purchase';
        } else if (reason === 'cart') {
          msg = 'Please log in to add items to your cart';
        } else if (reason === 'checkout') {
          msg = 'Please log in to proceed to checkout';
        } else if (reason === 'account') {
          msg = 'Please log in to access your account';
        } else if (reason === 'permission_required') {
          msg = 'Please log in with an authorized account to access that page';
        } else if (reason === 'session_expired') {
          msg = 'Your session has expired. Please log in again';
        }
        setAuthToastMessage(msg);

        // Strip query parameters from URL so it doesn't persist on page refresh
        const cleanPath = window.location.pathname;
        window.history.replaceState({}, '', cleanPath);
      }
    }
  }, [authStatus, isLoading, user]);

  // Forgot password state & countdown
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    let timer: any;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    if (initialMode) {
      setState(initialMode);
    } else if (location.pathname.includes('register') || location.pathname.includes('signup')) {
      setState('signup');
    } else if (location.pathname.includes('forgot')) {
      setState('forgot');
    } else if (location.pathname.includes('login')) {
      setState('signin');
    }
  }, [initialMode, location.pathname]);

  const handleState = (next: AuthState) => {
    setState(next);
    const path = next === 'signin' ? '/login' : next === 'signup' ? '/register' : '/forgot-password';
    window.history.replaceState(null, '', path);
  };

  const handleGoogleCredential = async (credential: string) => {
    try {
      setIsGoogleLoading(true);
      const response = await fetchWithAuth('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ idToken: credential }),
      });

      if (response.status === 'authenticated' && response.access_token && response.user) {
        login(response.access_token, response.user);
        toast.success(`Welcome, ${response.user.firstName}!`);
        handleSuccessRedirect(response.user);
      } else if (response.status === 'phone_required' && response.temp_token) {
        setPhoneGateState({
          tempToken: response.temp_token,
          googleUser: response.user,
        });
      } else {
        throw new Error('Unexpected authentication response from server.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Google sign in failed. Please try again.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const triggerGoogleAuth = () => {
    const clientId =
      import.meta.env.VITE_GOOGLE_CLIENT_ID ||
      '731018746600-tiuks376qo8fg0rb1ihc3m7adsunvmmt.apps.googleusercontent.com';

    if (typeof window === 'undefined' || !(window as any).google?.accounts?.id) {
      toast.error('Google Sign-In is initializing. Please try again.');
      return;
    }

    try {
      (window as any).google.accounts.id.initialize({
        client_id: clientId,
        callback: (res: any) => {
          if (res?.credential) {
            handleGoogleCredential(res.credential);
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      (window as any).google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // If prompt is suppressed by browser policy, click hidden rendered standard button
          const container = document.getElementById('google-btn-hidden');
          if (container) {
            (window as any).google.accounts.id.renderButton(container, {
              type: 'standard',
              theme: 'outline',
              size: 'large',
            });
            const btn = container.querySelector('div[role=button]') as HTMLElement;
            if (btn) btn.click();
          }
        }
      });
    } catch (err) {
      console.error('Google Auth Init error:', err);
    }
  };

  const handleLoginSubmit = async (values: any, { setSubmitting }: any) => {
    try {
      const response = await fetchWithAuth('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: values.identifier, password: values.password }),
      });
      login(response.access_token, response.user);
      if (values.rememberMe) localStorage.setItem('edrops_remember', 'true');
      toast.success(`Welcome back, ${response.user.firstName}!`);
      handleSuccessRedirect(response.user);
    } catch (err: any) {
      const errorMsg = (err?.message || '').toLowerCase();
      if (
        errorMsg.includes('invalid credentials') ||
        errorMsg.includes('wrong password') ||
        errorMsg.includes('user not found') ||
        errorMsg.includes('unauthorized') ||
        errorMsg.includes('401')
      ) {
        toast.error('Incorrect email or password. Please try again.');
      } else if (errorMsg.includes('failed to fetch') || errorMsg.includes('network')) {
        toast.error('Unable to connect to server. Please check your internet connection.');
      } else if (errorMsg.includes('deactivated') || errorMsg.includes('inactive')) {
        toast.error('This account has been deactivated. Please contact support.');
      } else if (err?.message) {
        toast.error(err.message);
      } else {
        toast.error('Login failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (values: any, { setSubmitting, resetForm }: any) => {
    try {
      const parts = values.fullName.trim().split(' ');
      const firstName = parts[0];
      const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '.';

      await fetchWithAuth('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          firstName,
          lastName,
          phone: values.phone,
          email: values.email || undefined,
          password: values.password,
        }),
      });

      toast.success('Account created! Please sign in.');
      resetForm();
      handleState('signin');
    } catch (err: any) {
      toast.error(err.message ?? 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotSubmit = async (values: any, { setSubmitting }: any) => {
    try {
      await fetchWithAuth('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      setForgotEmail(values.email);
      setForgotSuccess(true);
      setCountdown(60);
      toast.success('Reset instructions sent to your email.');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to send reset link.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || isResending) return;
    setIsResending(true);
    try {
      await fetchWithAuth('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail }),
      });
      setCountdown(60);
      toast.success('Reset link resent!');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to resend link.');
    } finally {
      setIsResending(false);
    }
  };

  const handleRefresh = async () => {
    await new Promise((resolve) => setTimeout(resolve, 450));
  };

  return (
    <PullToRefresh onRefresh={handleRefresh} className="h-[100dvh]">
      {/* Hidden container for GIS button fallback */}
      <div id="google-btn-hidden" className="hidden" />

      {/* Floating Auth Notification Toast Overlay */}
      {authToastMessage && (
        <Toast
          message={authToastMessage}
          type="auth"
          duration={3000}
          onClose={() => setAuthToastMessage(null)}
        />
      )}

      {/* Mandatory Phone Gate Modal */}
      {phoneGateState && (
        <PhoneGate
          tempToken={phoneGateState.tempToken}
          googleUser={phoneGateState.googleUser}
          onSuccess={(session) => {
            handleSuccessRedirect(session.user);
          }}
        />
      )}

      <div className="w-screen h-[100dvh] bg-white lg:bg-gradient-to-br lg:from-[#061826] lg:via-[#0B2545] lg:to-[#13315C] flex flex-col items-center justify-start lg:justify-center p-0 lg:p-6 relative select-none overflow-hidden">
        
        {/* Desktop Atmospheric Ambient Glow Orbs */}
        <div className="hidden lg:block absolute -top-32 -left-32 w-[550px] h-[550px] bg-sky-500/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="hidden lg:block absolute -bottom-32 -right-32 w-[550px] h-[550px] bg-indigo-500/15 rounded-full blur-[140px] pointer-events-none" />

        {/* ========================================================================= */}
        {/* AUTH CONTAINER (TRUE 100vw x 100dvh on mobile; Centered card on desktop) */}
        {/* ========================================================================= */}
        <div className="w-full h-full lg:h-[720px] lg:max-h-[92vh] lg:max-w-[460px] flex flex-col bg-white lg:rounded-[32px] lg:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)] overflow-hidden relative">
        
        {/* ========================================================================= */}
        {/* 1. OVERLAPPING COLORED HEADER BANNER (Consistent Logo & Tab Switcher)    */}
        {/* ========================================================================= */}
        <div className="w-full h-[20dvh] min-h-[120px] max-h-[155px] lg:h-32 bg-gradient-to-br from-[#00AEEF] via-[#0088CC] to-[#0B3B5C] relative px-6 pt-5 pb-8 flex items-start justify-between overflow-hidden shrink-0">
          
          {/* Subtle Water Topography Texture */}
          <div className="absolute inset-0 opacity-[0.09] pointer-events-none">
            <svg className="w-full h-full object-cover" viewBox="0 0 800 400" preserveAspectRatio="none">
              <path d="M0,80 C200,160 400,20 600,120 C700,170 750,90 800,110 L800,400 L0,400 Z" fill="white" />
              <path d="M0,180 C150,220 350,140 550,210 C680,260 740,190 800,200 L800,400 L0,400 Z" fill="white" opacity="0.4" />
            </svg>
          </div>

          {/* Top Bar: Logo on Left, Segmented Tab Switcher on Right */}
          <div className="relative z-10 w-full flex items-center justify-between gap-3">
            <button onClick={() => navigate('/')} className="cursor-pointer flex items-center focus:outline-none shrink-0">
              <EdropsLogo variant="white" className="h-6 sm:h-7 w-auto drop-shadow-sm" />
            </button>

            {/* Segmented Sign In / Sign Up Switcher on colored header */}
            <div className="flex items-center p-1 rounded-full bg-white/20 backdrop-blur-md border border-white/25 shadow-inner">
              <button
                type="button"
                onClick={() => handleState('signin')}
                className={`relative px-3.5 py-1 text-xs font-semibold rounded-full transition-colors cursor-pointer select-none ${
                  state === 'signin' ? 'text-slate-900 font-bold' : 'text-white/80 hover:text-white'
                }`}
              >
                {state === 'signin' && (
                  <motion.div
                    layoutId="header-auth-pill"
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                    className="absolute inset-0 bg-white rounded-full shadow-sm"
                  />
                )}
                <span className="relative z-10">Sign In</span>
              </button>

              <button
                type="button"
                onClick={() => handleState('signup')}
                className={`relative px-3.5 py-1 text-xs font-semibold rounded-full transition-colors cursor-pointer select-none ${
                  state === 'signup' ? 'text-slate-900 font-bold' : 'text-white/80 hover:text-white'
                }`}
              >
                {state === 'signup' && (
                  <motion.div
                    layoutId="header-auth-pill"
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                    className="absolute inset-0 bg-white rounded-full shadow-sm"
                  />
                )}
                <span className="relative z-10">Sign Up</span>
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. PULLED-UP WHITE CARD WITH COMPACT TOP-TO-BOTTOM FLOW                  */}
        {/* ========================================================================= */}
        <div className="flex-1 w-full -mt-6 bg-white rounded-t-[28px] sm:rounded-t-[32px] px-6 pt-6 pb-6 flex flex-col shadow-[0_-8px_24px_rgba(0,0,0,0.04)] relative z-20 overflow-hidden">
          
          <AnimatePresence mode="wait" initial={false}>
            
            {/* --- SIGN IN VIEW --- */}
            {state === 'signin' && (
              <motion.div
                key="signin-view"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.28, ease: easeBezier }}
                className="w-full flex-1 flex flex-col justify-center overflow-y-auto no-scrollbar py-2"
              >
                <div className="mb-5 text-center">
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-tight">
                    Welcome to Edrops<br />Login now!
                  </h1>
                </div>

                <Formik
                  initialValues={{ identifier: '', password: '', rememberMe: false }}
                  validationSchema={loginSchema}
                  onSubmit={handleLoginSubmit}
                >
                  {({ isSubmitting }) => (
                    <Form>
                      <Field
                        name="identifier"
                        component={ArimoInput}
                        label="Phone or Email"
                        placeholder="Phone number or email"
                        autoComplete="username"
                      />
                      <Field
                        name="password"
                        component={ArimoInput}
                        icon={Lock}
                        type="password"
                        label="Password"
                        placeholder="Password"
                        autoComplete="current-password"
                      />

                      <div className="flex items-center justify-between mt-1 mb-4">
                        <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-600">
                          <Field
                            type="checkbox"
                            name="rememberMe"
                            className="w-4 h-4 rounded border-slate-300 text-[#0088CC] focus:ring-0 cursor-pointer accent-[#0088CC]"
                          />
                          <span>Remember me</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleState('forgot')}
                          className="text-xs font-semibold text-[#0088CC] hover:underline cursor-pointer"
                        >
                          Forgot password?
                        </button>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full h-12 rounded-2xl bg-[#0088CC] hover:bg-[#0077B3] text-white font-semibold text-base shadow-[0_4px_16px_rgba(0,136,204,0.25)] active:scale-[0.99] transition-all flex items-center justify-center cursor-pointer disabled:opacity-50 mt-1"
                      >
                        {isSubmitting ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          'Continue'
                        )}
                      </button>
                    </Form>
                  )}
                </Formik>

                {/* Plain "or" divider */}
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-3 text-slate-400 font-medium">or</span>
                  </div>
                </div>

                {/* Continue with Google button (Sign In only) */}
                <button
                  type="button"
                  onClick={triggerGoogleAuth}
                  disabled={isGoogleLoading}
                  className="w-full h-11 sm:h-12 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-all flex items-center justify-center shadow-xs cursor-pointer active:scale-[0.99] disabled:opacity-60"
                >
                  {isGoogleLoading ? (
                    <div className="w-4 h-4 border-2 border-[#0088CC] border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <GoogleIcon />
                  )}
                  <span>Continue with Google</span>
                </button>
              </motion.div>
            )}

            {/* --- SIGN UP VIEW --- */}
            {state === 'signup' && (
              <motion.div
                key="signup-view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.28, ease: easeBezier }}
                className="w-full flex-1 flex flex-col overflow-y-auto no-scrollbar py-1"
              >
                <div className="mb-4 text-center">
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-tight">
                    Finish signing up
                  </h1>
                </div>

                <Formik
                  initialValues={{
                    fullName: '',
                    phone: '',
                    email: '',
                    address: '',
                    password: '',
                    confirmPassword: '',
                    acceptTerms: false,
                  }}
                  validationSchema={registerSchema}
                  onSubmit={handleRegisterSubmit}
                >
                  {({ isSubmitting, values }) => (
                    <Form className="flex flex-col">
                      <Field
                        name="fullName"
                        component={ArimoInput}
                        label="Full Name"
                        placeholder="e.g. James Anderson"
                        autoComplete="name"
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2">
                        <Field
                          name="phone"
                          component={ArimoInput}
                          type="tel"
                          label="Phone Number"
                          placeholder="+1 (555) 000-0000"
                          autoComplete="tel"
                        />
                        <Field
                          name="email"
                          component={ArimoInput}
                          icon={Mail}
                          type="email"
                          label="Email Address (Optional)"
                          placeholder="james@example.com"
                          autoComplete="email"
                        />
                      </div>

                      <Field
                        name="address"
                        component={ArimoInput}
                        label="Delivery Address"
                        placeholder="Apartment, Street, Building"
                        autoComplete="street-address"
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2">
                        <div>
                          <Field
                            name="password"
                            component={ArimoInput}
                            icon={Lock}
                            type="password"
                            label="Password"
                            placeholder="8+ characters"
                            autoComplete="new-password"
                          />
                          <PasswordStrength password={values.password} />
                        </div>
                        <div>
                          <Field
                            name="confirmPassword"
                            component={ArimoInput}
                            icon={Lock}
                            type="password"
                            label="Confirm Password"
                            placeholder="Confirm password"
                            autoComplete="new-password"
                          />
                        </div>
                      </div>

                      <label className="flex items-start gap-2 mt-1 mb-3 cursor-pointer select-none text-xs text-slate-500">
                        <Field
                          type="checkbox"
                          name="acceptTerms"
                          className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#0088CC] focus:ring-0 cursor-pointer accent-[#0088CC]"
                        />
                        <span>
                          I read and agreed to{' '}
                          <span className="text-[#0088CC] font-semibold hover:underline">User Agreement</span>{' '}
                          and{' '}
                          <span className="text-[#0088CC] font-semibold hover:underline">Privacy Policy</span>
                        </span>
                      </label>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full h-12 rounded-2xl bg-[#0088CC] hover:bg-[#0077B3] text-white font-semibold text-base shadow-[0_4px_16px_rgba(0,136,204,0.25)] active:scale-[0.99] transition-all flex items-center justify-center cursor-pointer disabled:opacity-50 mt-1 mb-2"
                      >
                        {isSubmitting ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          'Sign Up'
                        )}
                      </button>

                      {/* Small text link for Google on Sign Up (keeps form compact) */}
                      <div className="text-center mt-2 mb-2">
                        <button
                          type="button"
                          onClick={triggerGoogleAuth}
                          className="text-xs text-slate-500 hover:text-[#0088CC] transition-colors cursor-pointer"
                        >
                          Prefer Google? <span className="font-semibold text-[#0088CC] hover:underline">Continue with Google</span>
                        </button>
                      </div>
                    </Form>
                  )}
                </Formik>
              </motion.div>
            )}

            {/* --- FORGOT PASSWORD VIEW --- */}
            {state === 'forgot' && (
              <motion.div
                key="forgot-view"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.28, ease: easeBezier }}
                className="w-full flex-1 flex flex-col overflow-y-auto no-scrollbar"
              >
                <div className="mb-5 text-center">
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-tight">
                    {forgotSuccess ? 'Check your email' : 'Reset password'}
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-2">
                    {forgotSuccess
                      ? `Instructions sent to ${forgotEmail}`
                      : "Enter your registered email address and we'll send you reset instructions."}
                  </p>
                </div>

                {!forgotSuccess ? (
                  <Formik
                    initialValues={{ email: '' }}
                    validationSchema={forgotSchema}
                    onSubmit={handleForgotSubmit}
                  >
                    {({ isSubmitting }) => (
                      <Form>
                        <Field
                          name="email"
                          component={ArimoInput}
                          icon={Mail}
                          label="Email Address"
                          placeholder="name@company.com"
                          autoComplete="email"
                        />

                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full h-12 mt-4 rounded-2xl bg-[#0088CC] hover:bg-[#0077B3] text-white font-semibold text-base shadow-[0_4px_16px_rgba(0,136,204,0.25)] active:scale-[0.99] transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
                        >
                          {isSubmitting ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            'Send Reset Link'
                          )}
                        </button>

                        <div className="mt-5 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setForgotSuccess(false);
                              handleState('signin');
                            }}
                            className="text-sm font-semibold text-[#0088CC] hover:underline cursor-pointer"
                          >
                            Back to Log in
                          </button>
                        </div>
                      </Form>
                    )}
                  </Formik>
                ) : (
                  <div className="text-center py-3 space-y-4">
                    <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
                      <Check className="w-7 h-7 stroke-[2.5]" />
                    </div>
                    <p className="text-sm text-slate-600 px-4">
                      Please check your inbox or spam folder for your one-time password recovery link.
                    </p>
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={countdown > 0 || isResending}
                      className="w-full h-11 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isResending ? (
                        <div className="w-4 h-4 border-2 border-slate-400 border-t-slate-800 rounded-full animate-spin" />
                      ) : (
                        <>
                          <RotateCcw className="w-4 h-4" />
                          <span>{countdown > 0 ? `Resend in ${countdown}s` : 'Resend Email Link'}</span>
                        </>
                      )}
                    </button>

                    <div className="mt-4 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setForgotSuccess(false);
                          handleState('signin');
                        }}
                        className="text-sm font-semibold text-[#0088CC] hover:underline cursor-pointer"
                      >
                        Back to Log in
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>
    </div>
    </PullToRefresh>
  );
}

