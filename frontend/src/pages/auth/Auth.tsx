import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-hot-toast';
import { Eye, EyeOff, Lock, Mail, Check, AlertCircle, RotateCcw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchWithAuth } from '../../api/client';
import { EdropsLogo } from '../../components/Logo';
import SplashScreen from '../../components/pwa/SplashScreen';

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
  CUSTOMER: '/customer',
  STAFF: '/staff',
  ADMIN: '/admin',
  DELIVERY_PARTNER: '/delivery-partner',
};

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
  const { login } = useAuth();
  const from = (location.state as any)?.from?.pathname;

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

  const handleLoginSubmit = async (values: any, { setSubmitting }: any) => {
    try {
      const response = await fetchWithAuth('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: values.identifier, password: values.password }),
      });
      login(response.access_token, response.user);
      if (values.rememberMe) localStorage.setItem('edrops_remember', 'true');
      toast.success(`Welcome back, ${response.user.firstName}!`);

      const rolePath = ROLE_PATHS[response.user.role] ?? '/customer';
      const target = from && from.startsWith(rolePath) ? from : rolePath;
      navigate(target, { replace: true });
    } catch (err: any) {
      toast.error(err.message ?? 'Login failed. Check your credentials.');
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

  return (
    <div className="w-screen h-[100dvh] bg-white lg:bg-gradient-to-br lg:from-[#061826] lg:via-[#0B2545] lg:to-[#13315C] flex flex-col items-center justify-start lg:justify-center p-0 lg:p-6 relative select-none overflow-hidden">
      
      {/* PWA / First Launch Splash Screen */}
      <SplashScreen />

      {/* Desktop Atmospheric Ambient Glow Orbs */}
      <div className="hidden lg:block absolute -top-32 -left-32 w-[550px] h-[550px] bg-sky-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="hidden lg:block absolute -bottom-32 -right-32 w-[550px] h-[550px] bg-indigo-500/15 rounded-full blur-[140px] pointer-events-none" />

      {/* ========================================================================= */}
      {/* AUTH CONTAINER (TRUE 100vw x 100dvh on mobile; Centered card on desktop) */}
      {/* ========================================================================= */}
      <div className="w-full h-full lg:h-[620px] lg:max-w-[450px] flex flex-col bg-white lg:rounded-[32px] lg:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)] overflow-hidden relative">
        
        {/* ========================================================================= */}
        {/* 1. OVERLAPPING COLORED HEADER BANNER (Consistent Logo Across All States) */}
        {/* ========================================================================= */}
        <div className="w-full h-[20dvh] min-h-[120px] max-h-[155px] lg:h-32 bg-gradient-to-br from-[#00AEEF] via-[#0088CC] to-[#0B3B5C] relative px-6 pt-5 pb-8 flex items-start justify-between overflow-hidden shrink-0">
          
          {/* Subtle Water Topography Texture */}
          <div className="absolute inset-0 opacity-[0.09] pointer-events-none">
            <svg className="w-full h-full object-cover" viewBox="0 0 800 400" preserveAspectRatio="none">
              <path d="M0,80 C200,160 400,20 600,120 C700,170 750,90 800,110 L800,400 L0,400 Z" fill="white" />
              <path d="M0,180 C150,220 350,140 550,210 C680,260 740,190 800,200 L800,400 L0,400 Z" fill="white" opacity="0.4" />
            </svg>
          </div>

          {/* Top Bar: Always Logo on Left, Badge on Right */}
          <div className="relative z-10 w-full flex items-center justify-between">
            <button onClick={() => navigate('/')} className="cursor-pointer flex items-center focus:outline-none">
              <EdropsLogo variant="white" className="h-6 sm:h-7 w-auto drop-shadow-sm" />
            </button>

            <div className="px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-md text-white text-[11px] font-semibold tracking-wide">
              Edrops
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
                className="w-full flex-1 flex flex-col overflow-y-auto no-scrollbar"
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

                      <div className="flex items-center justify-between mt-1 mb-5">
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

                      {/* Toggle Link immediately below button */}
                      <div className="mt-5 text-center">
                        <p className="text-sm text-slate-500">
                          Don't have an account?{' '}
                          <button
                            type="button"
                            onClick={() => handleState('signup')}
                            className="font-bold text-[#0088CC] hover:underline transition-colors ml-1 cursor-pointer"
                          >
                            Create an account
                          </button>
                        </p>
                      </div>
                    </Form>
                  )}
                </Formik>
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
                className="w-full flex-1 flex flex-col overflow-y-auto no-scrollbar"
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
                    <Form>
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

                      <label className="flex items-start gap-2 mt-1 mb-4 cursor-pointer select-none text-xs text-slate-500">
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
                        className="w-full h-12 rounded-2xl bg-[#0088CC] hover:bg-[#0077B3] text-white font-semibold text-base shadow-[0_4px_16px_rgba(0,136,204,0.25)] active:scale-[0.99] transition-all flex items-center justify-center cursor-pointer disabled:opacity-50 mt-1"
                      >
                        {isSubmitting ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          'Sign Up'
                        )}
                      </button>

                      {/* Toggle Link immediately below button */}
                      <div className="mt-5 text-center">
                        <p className="text-sm text-slate-500">
                          Already have an account?{' '}
                          <button
                            type="button"
                            onClick={() => handleState('signin')}
                            className="font-bold text-[#0088CC] hover:underline transition-colors ml-1 cursor-pointer"
                          >
                            Log in
                          </button>
                        </p>
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
  );
}
