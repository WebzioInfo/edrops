import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Droplets, Mail, ArrowLeft } from 'lucide-react';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { InputBox } from '../../components/InputBox';
import { Button } from '../../components/Button';
import { fetchWithAuth } from '../../api/client';

const ForgotPasswordSchema = Yup.object().shape({
  email: Yup.string().email('Invalid email').required('Required'),
});

export default function ForgotPassword() {
  const [status, setStatus] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });

  const handleSubmit = async (values: any, { setSubmitting }: any) => {
    setStatus({ type: '', message: '' });
    try {
      const response = await fetchWithAuth('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      setStatus({ type: 'success', message: response.message });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Request failed' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-screen overflow-hidden bg-edrops-light text-edrops-ocean lg:grid-cols-2">
      <section className="relative flex items-center justify-center p-6 sm:p-12">
        <div className="absolute top-6 left-6 sm:top-10 sm:left-10 z-10">
          <Link to="/" className="inline-flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-edrops-blue text-white shadow-lg">
              <Droplets className="h-6 w-6" />
            </span>
            <span className="hidden sm:block text-xl font-bold tracking-tight text-edrops-ocean">
              Edrops
            </span>
          </Link>
        </div>

        <div className="w-full max-w-md relative">
          <div className="bg-white rounded-3xl shadow-2xl p-8 relative overflow-hidden">
            <div className="mb-8 text-center">
              <h1 className="text-3xl font-bold text-edrops-ocean">Reset Password</h1>
              <p className="mt-2 text-sm text-gray-500">
                Enter your email address and we'll send you a link to reset your password.
              </p>
            </div>

            {status.message && (
              <div className={`mb-6 p-4 rounded-xl text-sm font-medium text-center ${
                status.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
              }`}>
                {status.message}
              </div>
            )}

            <Formik
              initialValues={{ email: '' }}
              validationSchema={ForgotPasswordSchema}
              onSubmit={handleSubmit}
            >
              {({ isSubmitting }) => (
                <Form className="space-y-5">
                  <InputBox 
                    name="email" 
                    label="Email Address" 
                    type="email" 
                    placeholder="you@example.com" 
                    icon={<Mail className="w-5 h-5" />} 
                  />

                  <Button 
                    type="submit" 
                    fullWidth 
                    size="lg" 
                    isLoading={isSubmitting}
                  >
                    Send Reset Link
                  </Button>
                </Form>
              )}
            </Formik>

            <div className="mt-8 text-center text-sm">
              <Link to="/login" className="inline-flex items-center font-bold text-gray-500 hover:text-edrops-ocean transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="hidden lg:flex relative bg-edrops-ocean text-white items-center justify-center p-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-edrops-blue to-edrops-ocean opacity-90" />
        <div className="relative z-10 max-w-lg text-center">
          <h2 className="text-5xl font-black tracking-tight mb-6 leading-tight">
            Secure your flow.
          </h2>
          <p className="text-lg font-medium text-edrops-light opacity-80 leading-relaxed">
            Get back to managing your water deliveries securely. We'll help you recover your access in no time.
          </p>
        </div>
      </section>
    </main>
  );
}
