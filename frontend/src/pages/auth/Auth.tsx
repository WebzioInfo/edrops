import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-hot-toast';
import { Eye, EyeOff, CheckCircle2, ShieldCheck, Truck, Zap, Mail, Phone, Lock, User, MapPin } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchWithAuth } from '../../api/client';
import logo from '../../assets/logo22.png';

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

// --- ROLE ROUTING ---
const ROLE_PATHS: Record<string, string> = {
  CUSTOMER: '/customer',
  STAFF: '/staff',
  ADMIN: '/admin',
  DELIVERY_PARTNER: '/delivery-partner',
};

// --- CUSTOM INPUT COMPONENT ---
const ModernInput = ({ field, form, icon: Icon, type = 'text', placeholder, ...props }: any) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;
  const hasError = form.touched[field.name] && form.errors[field.name];

  return (
    <div className="mb-3 md:mb-4">
      <div className="relative flex items-center">
        {/* Left Icon */}
        <div className="absolute left-[14px] md:left-4 text-[#94A3B8]">
          <Icon className="w-[18px] h-[18px] md:w-5 md:h-5" />
        </div>
        
        <input
          {...field}
          {...props}
          type={inputType}
          placeholder={placeholder}
          className={`w-full h-[48px] md:h-[52px] pl-[40px] md:pl-12 pr-${isPassword ? '10 md:pr-12' : '3 md:pr-4'} rounded-[12px] md:rounded-[14px] bg-white border outline-none transition-all duration-200 text-[15px] md:text-[16px] placeholder:text-[#94A3B8] text-[#0F172A] ${
            hasError 
              ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' 
              : 'border-[#E2E8F0] focus:border-[#1E88E5] focus:ring-4 focus:ring-[#1E88E5]/10'
          }`}
        />
        
        {/* Password Toggle */}
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 md:right-4 text-[#94A3B8] hover:text-[#0F172A] transition-colors"
          >
            {showPassword ? <EyeOff className="w-[18px] h-[18px] md:w-5 md:h-5" /> : <Eye className="w-[18px] h-[18px] md:w-5 md:h-5" />}
          </button>
        )}
      </div>
      {/* Error Message */}
      {hasError && (
        <p className="mt-1 md:mt-1.5 text-[12px] md:text-[13px] text-red-500 font-medium pl-1">{form.errors[field.name]}</p>
      )}
    </div>
  );
};

// --- LOGIN COMPONENT ---
const LoginView = ({ setView }: { setView: (v: 'login' | 'register') => void }) => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname;

  const handleSubmit = async (values: any, { setSubmitting }: any) => {
    try {
      const response = await fetchWithAuth('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: values.identifier, password: values.password }),
      });
      login(response.access_token, response.user);
      if (values.rememberMe) localStorage.setItem('edrops_remember', 'true');
      toast.success(`Welcome back, ${response.user.firstName}!`);
      
      const rolePath = ROLE_PATHS[response.user.role] ?? '/customer';
      const targetPath = from && from.startsWith(rolePath) ? from : rolePath;
      navigate(targetPath, { replace: true });
    } catch (err: any) {
      toast.error(err.message ?? 'Login failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="w-full flex flex-col h-full"
    >
      <div className="mb-6 md:mb-8">
        <h2 className="text-[24px] md:text-[32px] font-bold text-[#0F172A] tracking-tight mb-1 md:mb-2">Welcome Back</h2>
        <p className="text-[14px] md:text-[16px] leading-[20px] md:leading-normal text-[#64748B]">Enter your details to access your account.</p>
      </div>

      <Formik initialValues={{ identifier: '', password: '', rememberMe: false }} validationSchema={loginSchema} onSubmit={handleSubmit}>
        {({ isSubmitting }) => (
          <Form className="flex-1 flex flex-col">
            <Field name="identifier" component={ModernInput} icon={User} placeholder="Phone number or Email" />
            <Field name="password" component={ModernInput} icon={Lock} type="password" placeholder="Password" />

            <div className="flex items-center justify-between mt-1 md:mt-2 mb-6 md:mb-8">
              <label className="flex items-center gap-2 cursor-pointer group">
                <Field type="checkbox" name="rememberMe" className="w-[14px] h-[14px] md:w-4 md:h-4 rounded border-[#E2E8F0] text-[#1E88E5] focus:ring-[#1E88E5] transition-colors cursor-pointer" />
                <span className="text-[13px] md:text-[14px] font-medium text-[#64748B] group-hover:text-[#0F172A] transition-colors select-none">Remember Me</span>
              </label>
              <Link to="/forgot-password" className="text-[13px] md:text-[14px] font-bold text-[#1E88E5] hover:text-[#1976D2] transition-colors">
                Forgot Password?
              </Link>
            </div>

            <div className="mt-auto pt-2 md:pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-[48px] md:h-[52px] rounded-[12px] md:rounded-[14px] bg-gradient-to-r from-[#1E88E5] to-[#1976D2] text-white font-semibold md:font-bold text-[15px] md:text-[16px] shadow-[0_4px_14px_rgba(30,136,229,0.25)] hover:shadow-[0_6px_20px_rgba(30,136,229,0.3)] hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
              >
                {isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Sign In'}
              </button>
              
              <div className="mt-4 md:mt-6 text-center">
                <p className="text-[13px] md:text-[14px] text-[#64748B]">
                  Don't have an account?{' '}
                  <button type="button" onClick={() => setView('register')} className="font-bold text-[#1E88E5] hover:text-[#1976D2] transition-colors ml-1">
                    Create Account
                  </button>
                </p>
              </div>
            </div>
          </Form>
        )}
      </Formik>
    </motion.div>
  );
};

// --- REGISTER COMPONENT ---
const RegisterView = ({ setView }: { setView: (v: 'login' | 'register') => void }) => {
  const handleSubmit = async (values: any, { setSubmitting, resetForm }: any) => {
    try {
      const parts = values.fullName.trim().split(' ');
      const firstName = parts[0];
      const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '.'; // Backend requires lastName usually

      await fetchWithAuth('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          firstName,
          lastName,
          phone: values.phone,
          email: values.email || undefined,
          password: values.password,
          // Address is omitted here since the backend DTO does not yet map it, but it's captured in UI.
        }),
      });

      toast.success('Account created! Please sign in.');
      resetForm();
      setView('login');
    } catch (err: any) {
      toast.error(err.message ?? 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="w-full flex flex-col h-full"
    >
      <div className="mb-4 md:mb-6">
        <h2 className="text-[24px] md:text-[32px] font-bold text-[#0F172A] tracking-tight mb-1 md:mb-2">Create Account</h2>
        <p className="text-[14px] md:text-[16px] leading-[20px] md:leading-normal text-[#64748B]">Join Edrops for seamless water delivery.</p>
      </div>

      <Formik 
        initialValues={{ fullName: '', phone: '', email: '', address: '', password: '', confirmPassword: '', acceptTerms: false }} 
        validationSchema={registerSchema} 
        onSubmit={handleSubmit}
      >
        {({ isSubmitting }) => (
          <Form className="flex-1 flex flex-col h-full overflow-y-auto no-scrollbar pb-0 md:pb-4 pr-1">
            <Field name="fullName" component={ModernInput} icon={User} placeholder="Full Name" />
            <Field name="phone" component={ModernInput} icon={Phone} type="tel" placeholder="Phone Number" />
            <Field name="email" component={ModernInput} icon={Mail} type="email" placeholder="Email Address (Optional)" />
            <Field name="address" component={ModernInput} icon={MapPin} placeholder="Delivery Address" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 md:gap-3">
              <Field name="password" component={ModernInput} icon={Lock} type="password" placeholder="Create Password" />
              <Field name="confirmPassword" component={ModernInput} icon={Lock} type="password" placeholder="Confirm Password" />
            </div>

            <label className="flex items-center gap-2 mt-1 md:mt-2 mb-4 md:mb-6 cursor-pointer group">
              <Field type="checkbox" name="acceptTerms" className="w-[14px] h-[14px] md:w-4 md:h-4 rounded border-[#E2E8F0] text-[#1E88E5] focus:ring-[#1E88E5] transition-colors cursor-pointer" />
              <span className="text-[12px] md:text-[14px] font-medium text-[#64748B] group-hover:text-[#0F172A] transition-colors select-none leading-snug md:leading-normal">
                I agree to the <a href="#" className="text-[#1E88E5] hover:underline">Terms of Service</a> & <a href="#" className="text-[#1E88E5] hover:underline">Privacy Policy</a>
              </span>
            </label>

            <div className="mt-auto">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-[48px] md:h-[52px] rounded-[12px] md:rounded-[14px] bg-gradient-to-r from-[#1E88E5] to-[#1976D2] text-white font-semibold md:font-bold text-[15px] md:text-[16px] shadow-[0_4px_14px_rgba(30,136,229,0.25)] hover:shadow-[0_6px_20px_rgba(30,136,229,0.3)] hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
              >
                {isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Create Account'}
              </button>
              
              <div className="mt-4 md:mt-5 text-center">
                <p className="text-[13px] md:text-[14px] text-[#64748B]">
                  Already have an account?{' '}
                  <button type="button" onClick={() => setView('login')} className="font-bold text-[#1E88E5] hover:text-[#1976D2] transition-colors ml-1">
                    Sign In
                  </button>
                </p>
              </div>
            </div>
          </Form>
        )}
      </Formik>
    </motion.div>
  );
};


// --- MAIN LAYOUT COMPONENT ---
export default function Auth() {
  const [view, setView] = useState<'login' | 'register'>('login');
  const navigate = useNavigate();

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center relative overflow-hidden px-4 py-4 md:p-8">
      
      {/* SaaS Background Artifacts */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#1E88E5]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      
      {/* Mobile Branding Header (Hidden on Desktop) */}
      <div className="lg:hidden w-full max-w-[420px] mb-4 md:mb-8 text-center relative z-10 flex flex-col items-center">
        <button onClick={() => navigate('/')} className="inline-flex items-center justify-center w-12 h-12 md:w-14 md:h-14 bg-white rounded-[16px] shadow-sm mb-2 md:mb-4">
          <img src={logo} alt="Edrops" className="w-7 h-7 md:w-8 md:h-8 object-contain" />
        </button>
        <h1 className="text-[28px] font-bold text-[#0F172A] tracking-tight mb-1 md:mb-2">Edrops</h1>
        <p className="text-[14px] text-[#64748B] leading-[20px]">Pure Water. Delivered Daily.</p>
      </div>

      {/* Main Card Container */}
      <div className="relative w-full max-w-[420px] lg:max-w-[1100px] bg-white rounded-[20px] md:rounded-[24px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-[#E2E8F0]/50 overflow-hidden flex flex-col lg:flex-row z-10 md:min-h-[600px] lg:h-[700px]">
        
        {/* LEFT PANEL - BRAND EXPERIENCE (Desktop Only) */}
        <div className="hidden lg:flex w-1/2 relative bg-gradient-to-br from-[#1E88E5] to-[#1565C0] p-12 flex-col justify-between overflow-hidden">
          {/* Glass Overlay Elements */}
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none" />
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-[#42A5F5]/20 rounded-full blur-3xl pointer-events-none" />

          {/* Top Logo */}
          <button onClick={() => navigate('/')} className="relative z-10 flex items-center gap-3 cursor-pointer group w-max">
            <div className="w-12 h-12 bg-white rounded-[14px] shadow-lg flex items-center justify-center group-hover:scale-105 transition-transform">
              <img src={logo} alt="Edrops Logo" className="w-7 h-7 object-contain" />
            </div>
            <span className="font-bold text-2xl tracking-tight text-white font-['Outfit']">Edrops</span>
          </button>

          {/* Middle Copy */}
          <div className="relative z-10 max-w-sm mt-12">
            <h1 className="text-[40px] font-bold text-white leading-[1.1] tracking-tight mb-6">
              Pure Water.<br />
              <span className="text-blue-100">Delivered Daily.</span>
            </h1>
            <p className="text-[16px] text-blue-100/90 leading-relaxed font-medium">
              Experience the smartest way to manage your hydration. Join thousands of homes and offices relying on Edrops for seamless water delivery.
            </p>
          </div>

          {/* Bottom Benefits Matrix */}
          <div className="relative z-10 grid grid-cols-2 gap-4 mt-16">
            <div className="bg-white/10 backdrop-blur-md rounded-[16px] p-4 border border-white/10 text-white">
              <CheckCircle2 className="w-6 h-6 text-blue-200 mb-3" />
              <h3 className="font-bold text-[14px] mb-1">Scheduled Delivery</h3>
              <p className="text-[13px] text-blue-100/80">Set it and forget it</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-[16px] p-4 border border-white/10 text-white">
              <ShieldCheck className="w-6 h-6 text-blue-200 mb-3" />
              <h3 className="font-bold text-[14px] mb-1">Secure Payments</h3>
              <p className="text-[13px] text-blue-100/80">Encrypted transactions</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-[16px] p-4 border border-white/10 text-white">
              <Truck className="w-6 h-6 text-blue-200 mb-3" />
              <h3 className="font-bold text-[14px] mb-1">Smart Tracking</h3>
              <p className="text-[13px] text-blue-100/80">Real-time driver updates</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-[16px] p-4 border border-white/10 text-white">
              <Zap className="w-6 h-6 text-blue-200 mb-3" />
              <h3 className="font-bold text-[14px] mb-1">Fast Refills</h3>
              <p className="text-[13px] text-blue-100/80">Empty jar exchange</p>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL - AUTHENTICATION FORM */}
        <div className="w-full lg:w-1/2 p-5 sm:p-8 lg:p-14 relative bg-white">
          <AnimatePresence mode="wait">
            {view === 'login' ? (
              <LoginView key="login" setView={setView} />
            ) : (
              <RegisterView key="register" setView={setView} />
            )}
          </AnimatePresence>
        </div>
        
      </div>
    </div>
  );
}
