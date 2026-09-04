import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-hot-toast';
import { Eye, EyeOff, Lock, Mail, ArrowLeft, Check, AlertCircle, RotateCcw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchWithAuth } from '../../api/client';
import { EdropsLogo } from '../../components/Logo';

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

// --- MINIMAL INPUT COMPONENT ---
const MinimalInput = ({
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
    <div className="mb-3.5">
      {label && (
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-3 text-slate-400 pointer-events-none">
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
          className={`w-full h-11 ${
            Icon ? 'pl-9' : 'pl-3.5'
          } ${isPassword ? 'pr-10' : 'pr-3.5'} rounded-xl bg-slate-50/80 border outline-none text-sm placeholder:text-slate-400 text-slate-900 transition-colors duration-200 ${
            hasError
              ? 'border-rose-300 bg-rose-50/20 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
              : 'border-slate-200 focus:bg-white focus:border-[#0088CC] focus:ring-2 focus:ring-[#0088CC]/20'
          }`}
        />

        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 text-slate-400 hover:text-slate-700 transition-colors p-1 cursor-pointer"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>

      {hasError && (
        <p className="mt-1 text-xs text-rose-500 font-medium pl-0.5 flex items-center gap-1">
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

// --- LEFT PANEL COPY MATRIX ---
const LEFT_PANEL_COPY: Record<AuthState, { headline: string; subtext: string; stateClass: string }> = {
  signin: {
    headline: 'Pure Water.\nDelivered Daily.',
    subtext: 'Smart hydration for modern spaces.',
    stateClass: 'auth-state-signin',
  },
  signup: {
    headline: 'Join The\nMovement.',
    subtext: 'Doorstep water delivery on your schedule.',
    stateClass: 'auth-state-signup',
  },
  forgot: {
    headline: 'Account\nRecovery.',
    subtext: "We'll send a secure one-time reset link.",
    stateClass: 'auth-state-forgot',
  },
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

  const currentCopy = LEFT_PANEL_COPY[state];

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row overflow-hidden bg-white">
      
      {/* ========================================================================= */}
      {/* 1. LEFT PANEL / MOBILE HEADER: COMPACT ON MOBILE, FULL SPLIT ON DESKTOP   */}
      {/* ========================================================================= */}
      <div
        className={`w-full lg:w-1/2 h-16 lg:h-screen lg:min-h-[280px] relative auth-gradient-panel ${currentCopy.stateClass} flex items-center lg:flex-col lg:justify-between px-6 lg:p-16 overflow-hidden shrink-0`}
      >
        {/* Soft Moving Radial Gradient Glow Orbs */}
        <div className="absolute -right-20 -top-20 w-[420px] h-[420px] bg-white/10 rounded-full blur-[100px] pointer-events-none animate-glow-1" />
        <div className="absolute -left-20 -bottom-20 w-[420px] h-[420px] bg-sky-300/10 rounded-full blur-[100px] pointer-events-none animate-glow-2" />
        <div className="absolute top-1/2 left-1/3 w-[300px] h-[300px] bg-cyan-400/10 rounded-full blur-[100px] pointer-events-none animate-glow-1" />

        {/* Quiet Logo (Left-aligned & Vertically Centered on Mobile, Top-Left on Desktop) */}
        <div className="relative z-10 flex items-center">
          <button
            onClick={() => navigate('/')}
            className="cursor-pointer transition-opacity hover:opacity-90 focus:outline-none flex items-center"
          >
            <EdropsLogo variant="white" className="h-6 sm:h-7 w-auto" />
          </button>
        </div>

        {/* Directional Headline + Subtext (DESKTOP ONLY — Completely excluded from mobile flow) */}
        <div className="hidden lg:flex relative z-10 my-auto py-8 lg:py-0 max-w-md flex-col">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={state}
              initial={{ opacity: 0, x: state === 'signup' ? 24 : -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: state === 'signup' ? -24 : 24 }}
              transition={{ duration: 0.3, ease: easeBezier }}
            >
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-tight whitespace-pre-line mb-3">
                {currentCopy.headline}
              </h1>
              <p className="text-sm sm:text-base text-sky-100/85 font-medium">
                {currentCopy.subtext}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Empty bottom space to maintain balanced vertical centering on desktop */}
        <div className="relative z-10 hidden lg:block h-7" />
      </div>

      {/* ========================================================================= */}
      {/* 2. RIGHT/FORM PANEL: FULL-BLEED MOBILE SCROLLABLE, CENTERED DESKTOP VIEW  */}
      {/* ========================================================================= */}
      <div className="flex-1 w-full lg:w-1/2 min-h-0 lg:h-screen bg-white flex items-start lg:items-center justify-center px-6 py-6 sm:px-10 sm:py-8 lg:p-16 overflow-y-auto">
        <div className="w-full max-w-[440px] my-auto">
          
          {/* Segmented Control Switcher */}
          {state !== 'forgot' && (
            <div className="relative flex bg-slate-100 rounded-full p-1 w-fit mb-6 sm:mb-8 select-none">
              {(['signin', 'signup'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleState(tab)}
                  className="relative px-5 sm:px-6 py-2 text-xs sm:text-sm font-medium z-10 cursor-pointer focus:outline-none"
                >
                  {state === tab && (
                    <motion.div
                      layoutId="tab-pill"
                      className="absolute inset-0 bg-white rounded-full shadow-sm"
                      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                    />
                  )}
                  <span
                    className={
                      state === tab
                        ? 'text-slate-900 relative z-10 font-semibold transition-colors duration-200'
                        : 'text-slate-400 relative z-10 hover:text-slate-600 transition-colors duration-200'
                    }
                  >
                    {tab === 'signin' ? 'Sign In' : 'Sign Up'}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Smooth Morphing Form Content Area */}
          <motion.div layout transition={{ duration: 0.3, ease: easeBezier }} className="w-full">
            <AnimatePresence mode="wait" initial={false}>
              
              {/* --- SIGN IN MODE --- */}
              {state === 'signin' && (
                <motion.div
                  key="signin"
                  initial={{ opacity: 0, x: -24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 24 }}
                  transition={{ duration: 0.3, ease: easeBezier }}
                  className="w-full"
                >
                  <div className="mb-5 sm:mb-6">
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Welcome back</h2>
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
                          component={MinimalInput}
                          label="Phone or Email"
                          placeholder="Phone number or email"
                          autoComplete="username"
                        />
                        <Field
                          name="password"
                          component={MinimalInput}
                          icon={Lock}
                          type="password"
                          label="Password"
                          placeholder="Password"
                          autoComplete="current-password"
                        />

                        <div className="flex items-center justify-between mt-2 mb-5 sm:mb-6">
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
                          className="w-full h-11 rounded-xl bg-[#0088CC] hover:bg-[#0077B3] text-white font-semibold text-sm transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50"
                        >
                          {isSubmitting ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            'Sign In'
                          )}
                        </button>
                      </Form>
                    )}
                  </Formik>
                </motion.div>
              )}

              {/* --- SIGN UP MODE --- */}
              {state === 'signup' && (
                <motion.div
                  key="signup"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.3, ease: easeBezier }}
                  className="w-full"
                >
                  <div className="mb-4 sm:mb-5">
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Create account</h2>
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
                          component={MinimalInput}
                          label="Full Name"
                          placeholder="Full name"
                          autoComplete="name"
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
                          <Field
                            name="phone"
                            component={MinimalInput}
                            type="tel"
                            label="Phone Number"
                            placeholder="Phone number"
                            autoComplete="tel"
                          />
                          <Field
                            name="email"
                            component={MinimalInput}
                            icon={Mail}
                            type="email"
                            label="Email (Optional)"
                            placeholder="Email address"
                            autoComplete="email"
                          />
                        </div>

                        <Field
                          name="address"
                          component={MinimalInput}
                          label="Delivery Address"
                          placeholder="Street or building address"
                          autoComplete="street-address"
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
                          <div>
                            <Field
                              name="password"
                              component={MinimalInput}
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
                              component={MinimalInput}
                              icon={Lock}
                              type="password"
                              label="Confirm Password"
                              placeholder="Confirm password"
                              autoComplete="new-password"
                            />
                          </div>
                        </div>

                        <label className="flex items-start gap-2 mt-1 mb-4 sm:mb-5 cursor-pointer select-none text-xs text-slate-500">
                          <Field
                            type="checkbox"
                            name="acceptTerms"
                            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#0088CC] focus:ring-0 cursor-pointer accent-[#0088CC]"
                          />
                          <span>
                            I agree to the{' '}
                            <span className="text-[#0088CC] font-semibold hover:underline">Terms</span> &{' '}
                            <span className="text-[#0088CC] font-semibold hover:underline">Privacy</span>
                          </span>
                        </label>

                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full h-11 rounded-xl bg-[#0088CC] hover:bg-[#0077B3] text-white font-semibold text-sm transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50"
                        >
                          {isSubmitting ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            'Create Account'
                          )}
                        </button>
                      </Form>
                    )}
                  </Formik>
                </motion.div>
              )}

              {/* --- FORGOT PASSWORD MODE --- */}
              {state === 'forgot' && (
                <motion.div
                  key="forgot"
                  initial={{ opacity: 0, x: -24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 24 }}
                  transition={{ duration: 0.3, ease: easeBezier }}
                  className="w-full"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setForgotSuccess(false);
                      handleState('signin');
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-4 sm:mb-5 cursor-pointer group"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
                    <span>Back to Sign In</span>
                  </button>

                  <div className="mb-5 sm:mb-6">
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                      {forgotSuccess ? 'Check your email' : 'Reset password'}
                    </h2>
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
                            component={MinimalInput}
                            icon={Mail}
                            label="Email Address"
                            placeholder="name@company.com"
                            autoComplete="email"
                          />

                          <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full h-11 mt-4 rounded-xl bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 text-white font-semibold text-sm transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50"
                          >
                            {isSubmitting ? (
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              'Send Reset Link'
                            )}
                          </button>
                        </Form>
                      )}
                    </Formik>
                  ) : (
                    <div className="text-center py-2 space-y-4">
                      <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Check className="w-6 h-6 stroke-[2.5]" />
                      </div>
                      <p className="text-xs text-slate-600">
                        Instructions sent to <span className="font-semibold text-slate-900">{forgotEmail}</span>
                      </p>
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={countdown > 0 || isResending}
                        className="w-full h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isResending ? (
                          <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-slate-800 rounded-full animate-spin" />
                        ) : (
                          <>
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>{countdown > 0 ? `Resend in ${countdown}s` : 'Resend Email'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

            </AnimatePresence>
          </motion.div>
        </div>
      </div>

    </div>
  );
}
