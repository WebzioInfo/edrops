import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Droplets, Lock, ArrowLeft } from 'lucide-react';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { InputBox } from '../../components/InputBox';
import { Button } from '../../components/Button';
import { fetchWithAuth } from '../../api/client';

const ResetPasswordSchema = Yup.object().shape({
  password: Yup.string()
    .min(8, 'Must be at least 8 characters')
    .matches(/[A-Z]/, 'Must contain at least one uppercase letter')
    .matches(/[a-z]/, 'Must contain at least one lowercase letter')
    .matches(/[0-9]/, 'Must contain at least one number')
    .matches(/[^A-Za-z0-9]/, 'Must contain at least one special character')
    .required('Required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords must match')
    .required('Required'),
});

const calculateStrength = (password: string) => {
  let strength = 0;
  if (password.length >= 8) strength++;
  if (password.match(/[A-Z]/)) strength++;
  if (password.match(/[a-z]/)) strength++;
  if (password.match(/[0-9]/)) strength++;
  if (password.match(/[^A-Za-z0-9]/)) strength++;
  return strength; // 0 to 5
};

const StrengthMeter = ({ password }: { password: string }) => {
  const strength = calculateStrength(password);
  const colors = ['bg-gray-200', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];
  const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
  
  return (
    <div className="mt-2 space-y-1">
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
        <div 
          className={`h-full transition-all duration-300 ${password.length > 0 ? colors[strength] : colors[0]}`}
          style={{ width: `${(strength / 5) * 100}%` }}
        />
      </div>
      {password.length > 0 && (
        <p className={`text-xs font-medium text-right ${password.length > 0 ? 'text-gray-600' : 'text-transparent'}`}>
          {labels[strength]}
        </p>
      )}
    </div>
  );
};

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const token = queryParams.get('token');

  const [status, setStatus] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });

  useEffect(() => {
    if (!token) {
      setStatus({ type: 'error', message: 'Invalid or missing reset token.' });
    }
  }, [token]);

  const handleSubmit = async (values: any, { setSubmitting }: any) => {
    if (!token) return;
    setStatus({ type: '', message: '' });
    
    try {
      await fetchWithAuth('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password: values.password }),
      });
      setStatus({ type: 'success', message: 'Password has been reset successfully. You can now login.' });
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Failed to reset password' });
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
              <h1 className="text-3xl font-bold text-edrops-ocean">New Password</h1>
              <p className="mt-2 text-sm text-gray-500">
                Please enter your new password below.
              </p>
            </div>

            {status.message && (
              <div className={`mb-6 p-4 rounded-xl text-sm font-medium text-center ${
                status.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
              }`}>
                {status.message}
              </div>
            )}

            {!token && (
               <div className="mt-8 text-center text-sm">
                 <Link to="/forgot-password" className="inline-flex items-center font-bold text-edrops-blue hover:underline">
                   Request a new link
                 </Link>
               </div>
            )}

            {token && status.type !== 'success' && (
              <Formik
                initialValues={{ password: '', confirmPassword: '' }}
                validationSchema={ResetPasswordSchema}
                onSubmit={handleSubmit}
              >
                {({ isSubmitting, values }) => (
                  <Form className="space-y-5">
                    <div>
                      <InputBox 
                        name="password" 
                        label="New Password" 
                        type="password" 
                        placeholder="••••••••" 
                        icon={<Lock className="w-5 h-5" />} 
                      />
                      <StrengthMeter password={values.password} />
                    </div>
                    
                    <InputBox 
                      name="confirmPassword" 
                      label="Confirm Password" 
                      type="password" 
                      placeholder="••••••••" 
                      icon={<Lock className="w-5 h-5" />} 
                    />

                    <Button 
                      type="submit" 
                      fullWidth 
                      size="lg" 
                      isLoading={isSubmitting}
                    >
                      Reset Password
                    </Button>
                  </Form>
                )}
              </Formik>
            )}

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
            Fresh start.
          </h2>
          <p className="text-lg font-medium text-edrops-light opacity-80 leading-relaxed">
            Your security is our priority. Set a strong password to keep your Edrops account safe.
          </p>
        </div>
      </section>
    </main>
  );
}
