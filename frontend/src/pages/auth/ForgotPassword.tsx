import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { InputBox } from '../../components/InputBox';
import { Button } from '../../components/Button';
import { fetchWithAuth } from '../../api/client';
import { EdropsLogo } from '../../components/Logo';

const ForgotPasswordSchema = Yup.object().shape({
  email: Yup.string().trim().email('Please enter a valid email address').required('Email is required'),
});

export default function ForgotPassword() {
  const [isSuccess, setIsSuccess] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [serverError, setServerError] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    let timer: any;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSubmit = async (values: { email: string }, { setSubmitting }: any) => {
    setServerError('');
    try {
      await fetchWithAuth('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      setSubmittedEmail(values.email);
      setIsSuccess(true);
      setCountdown(60);
    } catch (err: any) {
      setServerError(err.message || 'We could not process your request at this time.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || isResending) return;
    setServerError('');
    setIsResending(true);
    try {
      await fetchWithAuth('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: submittedEmail }),
      });
      setCountdown(60);
    } catch (err: any) {
      setServerError(err.message || 'Failed to resend the reset link.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <main className="grid min-h-screen overflow-hidden bg-gray-50 text-edrops-ocean lg:grid-cols-2">
      {/* Left side: Form */}
      <section className="relative flex items-center justify-center p-6 sm:p-12">
        <div className="absolute top-6 left-6 sm:top-10 sm:left-10 z-10">
          <Link to="/" className="inline-flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-[#00AEEF] focus:ring-offset-4 focus:ring-offset-gray-50 rounded-lg">
            <EdropsLogo variant="blue" className="h-8 w-auto transition-transform group-hover:scale-105" />
          </Link>
        </div>

        <div className="w-full max-w-md mx-auto relative z-20">
          <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-8 sm:p-10 transition-all duration-300">
            {!isSuccess ? (
              <>
                <div className="mb-8 text-center">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Reset your password</h1>
                  <p className="mt-3 text-sm sm:text-base text-gray-500 leading-relaxed">
                    Enter your email address and we'll send you instructions to reset your password.
                  </p>
                </div>

                {serverError && (
                  <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-red-50 text-red-700 text-sm font-medium border border-red-100">
                    <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
                    <span>{serverError}</span>
                  </div>
                )}

                <Formik
                  initialValues={{ email: '' }}
                  validationSchema={ForgotPasswordSchema}
                  onSubmit={handleSubmit}
                >
                  {({ isSubmitting, touched, errors }) => (
                    <Form 
                      className="space-y-6"
                      onChange={() => {
                        if (serverError) setServerError('');
                      }}
                    >
                      <div>
                        <InputBox 
                          name="email" 
                          label="Email Address" 
                          type="email" 
                          placeholder="name@company.com" 
                          icon={<Mail className="w-5 h-5" />}
                          autoComplete="email"
                        />
                      </div>

                      <Button 
                        type="submit" 
                        fullWidth 
                        size="lg" 
                        isLoading={isSubmitting}
                        disabled={isSubmitting || !!(touched.email && errors.email)}
                        className="py-3.5"
                      >
                        Send Reset Link
                      </Button>
                    </Form>
                  )}
                </Formik>
              </>
            ) : (
              <div className="text-center py-4 animate-in fade-in zoom-in duration-300">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-6">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h2>
                <p className="text-gray-500 mb-8 text-sm sm:text-base leading-relaxed">
                  We've sent password reset instructions to <span className="font-semibold text-gray-900">{submittedEmail}</span>.
                </p>
                
                {serverError && (
                  <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-red-50 text-red-700 text-sm font-medium border border-red-100 text-left">
                    <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
                    <span>{serverError}</span>
                  </div>
                )}

                <div className="space-y-4">
                  <Button 
                    type="button" 
                    fullWidth 
                    size="lg" 
                    variant="outline"
                    onClick={handleResend}
                    disabled={countdown > 0 || isResending}
                    isLoading={isResending}
                  >
                    {countdown > 0 ? `Resend available in ${countdown}s` : 'Resend Email'}
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-gray-100 text-center">
              <Link 
                to="/login" 
                className="inline-flex items-center text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-edrops-blue focus:ring-offset-4 focus:ring-offset-white rounded"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Right side: Hero / Info Panel */}
      <section className="hidden lg:flex relative bg-edrops-ocean text-white items-center justify-center p-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0B2545] to-[#13315C]" />
        
        {/* Subtle decorative circles */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-edrops-blue rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#8DA9C4] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />

        <div className="relative z-10 max-w-lg text-center flex flex-col items-center">
          <div className="mb-8 inline-flex items-center justify-center p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/20">
            <ShieldCheck className="w-12 h-12 text-blue-200" />
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight mb-6 leading-tight">
            Secure Account Recovery
          </h2>
          <p className="text-lg font-medium text-blue-100 opacity-90 leading-relaxed">
            Your account security is our highest priority. Getting back into your account is quick, easy, and secure.
          </p>
        </div>
      </section>
    </main>
  );
}
