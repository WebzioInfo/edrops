import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Droplets, ShieldCheck, Mail, Lock, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { useAuth } from '../../contexts/AuthContext';
import { InputBox } from '../../components/InputBox';
import { Button } from '../../components/Button';
import { fetchWithAuth } from '../../api/client';

const LoginSchema = Yup.object().shape({
  email: Yup.string().email('Invalid email').required('Required'),
  password: Yup.string().min(6, 'Too Short!').required('Required'),
});

const RegisterSchema = Yup.object().shape({
  firstName: Yup.string().min(2, 'Too Short!').required('Required'),
  lastName: Yup.string().min(2, 'Too Short!').required('Required'),
  email: Yup.string().email('Invalid email').required('Required'),
  password: Yup.string().min(6, 'Too Short!').required('Required'),
});

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  
  const [isLogin, setIsLogin] = useState(true);
  const [globalError, setGlobalError] = useState('');

  const from = location.state?.from?.pathname;

  const handleAuth = async (values: any, { setSubmitting }: any) => {
    setGlobalError('');
    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const response = await fetchWithAuth(endpoint, {
        method: 'POST',
        body: JSON.stringify(values),
      });

      login(response.access_token, response.user);
      
      const rolePath = response.user.role.toLowerCase();
      navigate(from || `/${rolePath}`, { replace: true });
    } catch (err: any) {
      setGlobalError(err.message || 'Authentication failed');
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
            <span className="hidden sm:block">
              <span className="block text-xl font-bold tracking-tight text-edrops-ocean">Edrops</span>
            </span>
          </Link>
        </div>

        <div className="w-full max-w-md relative">
          <div className="bg-white rounded-3xl shadow-2xl p-8 relative overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={isLogin ? 'login' : 'register'}
                initial={{ x: isLogin ? -50 : 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: isLogin ? 50 : -50, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="mb-8 text-center">
                  <h1 className="text-3xl font-bold text-edrops-ocean">
                    {isLogin ? 'Welcome Back' : 'Create Account'}
                  </h1>
                  <p className="mt-2 text-sm text-gray-500">
                    {isLogin 
                      ? 'Sign in to access your Edrops dashboard'
                      : 'Join Edrops for seamless water delivery'}
                  </p>
                </div>

                {globalError && (
                  <div className="mb-6 p-4 rounded-xl bg-red-50 text-sm text-red-600 font-medium text-center">
                    {globalError}
                  </div>
                )}

                <Formik
                  initialValues={isLogin 
                    ? { email: '', password: '' }
                    : { firstName: '', lastName: '', email: '', password: '' }
                  }
                  validationSchema={isLogin ? LoginSchema : RegisterSchema}
                  onSubmit={handleAuth}
                >
                  {({ isSubmitting }) => (
                    <Form className="space-y-5">
                      {!isLogin && (
                        <div className="grid grid-cols-2 gap-4">
                          <InputBox 
                            name="firstName" 
                            label="First Name" 
                            placeholder="John" 
                            icon={<UserIcon className="w-5 h-5" />} 
                          />
                          <InputBox 
                            name="lastName" 
                            label="Last Name" 
                            placeholder="Doe" 
                            icon={<UserIcon className="w-5 h-5" />} 
                          />
                        </div>
                      )}
                      
                      <InputBox 
                        name="email" 
                        label="Email Address" 
                        type="email" 
                        placeholder="you@example.com" 
                        icon={<Mail className="w-5 h-5" />} 
                      />
                      
                      <div className="space-y-2">
                        <InputBox 
                          name="password" 
                          label="Password" 
                          type="password" 
                          placeholder="••••••••" 
                          icon={<Lock className="w-5 h-5" />} 
                        />
                        {isLogin && (
                          <div className="text-right">
                            <Link to="/forgot-password" className="text-sm font-semibold text-edrops-blue hover:underline">
                              Forgot password?
                            </Link>
                          </div>
                        )}
                      </div>

                      <Button 
                        type="submit" 
                        fullWidth 
                        size="lg" 
                        isLoading={isSubmitting}
                        className="mt-4"
                      >
                        {isLogin ? 'Sign In' : 'Sign Up'}
                      </Button>
                    </Form>
                  )}
                </Formik>

                <div className="mt-8 text-center text-sm">
                  <p className="text-gray-500">
                    {isLogin ? "Don't have an account?" : "Already have an account?"}
                    <button 
                      type="button" 
                      onClick={() => setIsLogin(!isLogin)}
                      className="ml-2 font-bold text-edrops-orange hover:underline focus:outline-none"
                    >
                      {isLogin ? 'Sign up' : 'Sign in'}
                    </button>
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>

      <section className="hidden lg:flex relative bg-edrops-ocean text-white items-center justify-center p-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-edrops-blue to-edrops-ocean opacity-90" />
        <div className="relative z-10 max-w-lg text-center">
          <ShieldCheck className="h-16 w-16 mx-auto mb-8 text-edrops-aqua" />
          <h2 className="text-5xl font-black tracking-tight mb-6 leading-tight">
            Pure hydration,<br/>seamless delivery.
          </h2>
          <p className="text-lg font-medium text-edrops-light opacity-80 leading-relaxed">
            Manage your prepaid balances, track deliveries in real-time, and stay hydrated without the hassle.
          </p>
        </div>
      </section>
    </main>
  );
}
