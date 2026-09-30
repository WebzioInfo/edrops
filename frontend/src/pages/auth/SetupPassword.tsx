import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Lock, ArrowLeft, CheckCircle2, AlertTriangle, Mail } from 'lucide-react';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { InputBox } from '../../components/InputBox';
import { Button } from '../../components/Button';
import { fetchWithAuth } from '../../api/client';
import { EdropsLogo } from '../../components/Logo';

const SetupPasswordSchema = Yup.object().shape({
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords must match')
    .required('Please confirm your password'),
});

const calculateStrength = (password: string) => {
  let strength = 0;
  if (password.length >= 8) strength++;
  if (password.match(/[A-Z]/)) strength++;
  if (password.match(/[a-z]/)) strength++;
  if (password.match(/[0-9]/)) strength++;
  if (password.match(/[^A-Za-z0-9]/)) strength++;
  return strength;
};

const StrengthMeter = ({ password }: { password: string }) => {
  const strength = calculateStrength(password);
  const colors = ['bg-gray-200', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-emerald-500'];
  const labels = ['Too Short', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];

  return (
    <div className="mt-2 space-y-1">
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full transition-all duration-300 ${password.length > 0 ? colors[strength] : colors[0]}`}
          style={{ width: `${(strength / 5) * 100}%` }}
        />
      </div>
      {password.length > 0 && (
        <p className="text-xs font-medium text-right text-gray-500">
          {labels[strength]}
        </p>
      )}
    </div>
  );
};

export default function SetupPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const token = queryParams.get('token');

  const [isValidating, setIsValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [customerEmail, setCustomerEmail] = useState<string | null>(null);
  const [customerFirstName, setCustomerFirstName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Resend state
  const [showResend, setShowResend] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function validateToken() {
      if (!token) {
        if (isMounted) {
          setIsValidating(false);
          setTokenValid(false);
          setErrorMessage('No setup token was provided in the link.');
        }
        return;
      }

      try {
        const res = await fetchWithAuth(`/auth/setup-password/validate?token=${encodeURIComponent(token)}`);
        if (isMounted) {
          if (res?.valid) {
            setTokenValid(true);
            setCustomerEmail(res.email || null);
            setCustomerFirstName(res.firstName || null);
          } else {
            setTokenValid(false);
            setErrorMessage('This password setup link is invalid or has expired.');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setTokenValid(false);
          setErrorMessage(err.message || 'This password setup link is invalid or has expired.');
        }
      } finally {
        if (isMounted) {
          setIsValidating(false);
        }
      }
    }

    validateToken();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleSubmit = async (values: any, { setSubmitting, setStatus }: any) => {
    if (!token) return;
    setStatus(null);

    try {
      await fetchWithAuth('/auth/setup-password', {
        method: 'POST',
        body: JSON.stringify({
          token,
          password: values.password,
          confirmPassword: values.confirmPassword,
        }),
      });

      setIsSuccess(true);
    } catch (err: any) {
      setStatus(err.message || 'Failed to set password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail || !resendEmail.includes('@')) return;

    setIsResending(true);
    setResendMessage(null);

    try {
      await fetchWithAuth('/auth/resend-activation', {
        method: 'POST',
        body: JSON.stringify({ email: resendEmail.trim() }),
      });
      setResendMessage('If an account exists for this email, a new password setup link has been sent.');
    } catch (err: any) {
      setResendMessage('If an account exists for this email, a new password setup link has been sent.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <main className="grid min-h-screen overflow-hidden bg-edrops-light text-edrops-ocean lg:grid-cols-2">
      {/* Left panel: Auth card */}
      <section className="relative flex items-center justify-center p-6 sm:p-12">
        <div className="absolute top-6 left-6 sm:top-10 sm:left-10 z-10">
          <Link to="/" className="inline-flex items-center gap-3">
            <EdropsLogo variant="blue" className="h-8 w-auto" />
          </Link>
        </div>

        <div className="w-full max-w-md relative pt-12 sm:pt-0">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 sm:p-10 relative overflow-hidden">
            {/* 1. Loading State */}
            {isValidating && (
              <div className="py-12 text-center space-y-4">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-edrops-blue" />
                <p className="text-sm font-medium text-gray-500">
                  Verifying your account activation link...
                </p>
              </div>
            )}

            {/* 2. Success State */}
            {!isValidating && isSuccess && (
              <div className="py-6 text-center space-y-6">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="h-10 w-10" />
                </div>

                <div className="space-y-2">
                  <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                    Password Created Successfully
                  </h1>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Your eDrops account is ready. You can now sign in using your email and new password.
                  </p>
                </div>

                <Button
                  onClick={() => navigate('/login')}
                  fullWidth
                  size="lg"
                  className="mt-4 bg-[#00AEEF] hover:bg-[#0096ce] text-white"
                >
                  SIGN IN
                </Button>
              </div>
            )}

            {/* 3. Invalid / Expired Token State */}
            {!isValidating && !tokenValid && !isSuccess && (
              <div className="py-4 text-center space-y-6">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                  <AlertTriangle className="h-10 w-10" />
                </div>

                <div className="space-y-2">
                  <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                    Password Setup Link Unavailable
                  </h1>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {errorMessage || 'This password setup link is invalid or has expired.'}
                  </p>
                </div>

                {!showResend ? (
                  <div className="space-y-3 pt-2">
                    <Button
                      onClick={() => {
                        setShowResend(true);
                        if (customerEmail) setResendEmail(customerEmail);
                      }}
                      fullWidth
                      size="lg"
                      className="bg-[#00AEEF] hover:bg-[#0096ce] text-white font-semibold"
                    >
                      REQUEST NEW LINK
                    </Button>
                    <Link
                      to="/login"
                      className="inline-flex items-center justify-center gap-2 text-sm font-medium text-gray-600 hover:text-edrops-blue transition-colors"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to Login
                    </Link>
                  </div>
                ) : (
                  <form onSubmit={handleResend} className="space-y-4 text-left pt-2">
                    {resendMessage ? (
                      <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-800 leading-relaxed">
                        {resendMessage}
                      </div>
                    ) : (
                      <>
                        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Enter your email
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-3 h-5 w-5 text-gray-400" />
                          <input
                            type="email"
                            required
                            placeholder="customer@example.com"
                            value={resendEmail}
                            onChange={(e) => setResendEmail(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 py-2.5 text-sm text-gray-800 outline-none focus:border-edrops-blue focus:ring-2 focus:ring-edrops-blue/20"
                          />
                        </div>
                        <Button
                          type="submit"
                          fullWidth
                          size="lg"
                          isLoading={isResending}
                          className="bg-[#00AEEF] hover:bg-[#0096ce] text-white"
                        >
                          Send Setup Link
                        </Button>
                      </>
                    )}
                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={() => setShowResend(false)}
                        className="text-xs font-medium text-gray-500 hover:text-gray-800"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* 4. Active Setup Password Form */}
            {!isValidating && tokenValid && !isSuccess && (
              <div>
                <div className="mb-6 text-center space-y-1">
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                    Create Your Password
                  </h1>
                  <p className="text-sm text-gray-500">
                    {customerFirstName ? `Hi ${customerFirstName}, please set` : 'Set'} a password for your eDrops account to continue.
                  </p>
                </div>

                {customerEmail && (
                  <div className="mb-6 p-3.5 rounded-xl bg-sky-50/70 border border-sky-100 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center shadow-xs border border-sky-100 text-edrops-blue shrink-0">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium uppercase tracking-wider text-sky-700">
                        Login Email
                      </div>
                      <div className="text-sm font-semibold text-gray-800 truncate">
                        {customerEmail}
                      </div>
                    </div>
                  </div>
                )}

                <Formik
                  initialValues={{ password: '', confirmPassword: '' }}
                  validationSchema={SetupPasswordSchema}
                  onSubmit={handleSubmit}
                >
                  {({ isSubmitting, values, status }) => (
                    <Form className="space-y-4">
                      {status && (
                        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm font-medium text-red-700 text-center">
                          {status}
                        </div>
                      )}

                      <div>
                        <InputBox
                          label="Create Password"
                          name="password"
                          type="password"
                          placeholder="At least 8 characters"
                          icon={<Lock className="h-5 w-5 text-gray-400" />}
                        />
                        <StrengthMeter password={values.password} />
                      </div>

                      <div>
                        <InputBox
                          label="Confirm Password"
                          name="confirmPassword"
                          type="password"
                          placeholder="Confirm your password"
                          icon={<Lock className="h-5 w-5 text-gray-400" />}
                        />
                      </div>

                      <div className="pt-2">
                        <Button
                          type="submit"
                          fullWidth
                          size="lg"
                          isLoading={isSubmitting}
                          className="bg-[#00AEEF] hover:bg-[#0096ce] text-white font-semibold py-3"
                        >
                          CREATE PASSWORD
                        </Button>
                      </div>
                    </Form>
                  )}
                </Formik>

                <div className="mt-8 text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-edrops-blue transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Login
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Right panel: Brand side panel */}
      <section className="hidden lg:flex relative bg-edrops-ocean text-white items-center justify-center p-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#00AEEF] via-[#0090c7] to-[#00557c] opacity-95" />
        <div className="relative z-10 max-w-lg text-center flex flex-col items-center">
          <EdropsLogo variant="white" className="h-12 w-auto mb-8" />
          <h2 className="text-4xl font-extrabold tracking-tight mb-4 leading-tight">
            Welcome to eDrops.
          </h2>
          <p className="text-base font-normal text-sky-100 opacity-90 leading-relaxed max-w-md">
            Activate your account with a secure password to manage orders, schedule water deliveries, and access your smart wallet seamlessly.
          </p>
        </div>
      </section>
    </main>
  );
}
