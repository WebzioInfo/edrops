import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-hot-toast';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import InputBox from '../InputBox';
import { fetchWithAuth } from '../../../api/client';

interface LoginValues {
  identifier: string;
  password: string;
  rememberMe: boolean;
}

const initialValues: LoginValues = {
  identifier: '',
  password: '',
  rememberMe: false,
};

const validationSchema = Yup.object({
  identifier: Yup.string()
    .required('Phone number or email is required'),
  password: Yup.string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required'),
});

// Role → dashboard path (no hardcoded email checks)
const ROLE_PATHS: Record<string, string> = {
  CUSTOMER: '/customer',
  STAFF: '/staff',
  ADMIN: '/admin',
  DELIVERY_PARTNER: '/delivery-partner',
};

const LoginForm = ({ setIsLogin: _setIsLogin }: { setIsLogin: (v: boolean) => void }) => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname;

  const handleSubmit = async (values: LoginValues, { setSubmitting }: any) => {
    try {
      const response = await fetchWithAuth('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: values.identifier, password: values.password }),
      });

      login(response.access_token, response.user);

      if (values.rememberMe) {
        localStorage.setItem('edrops_remember', 'true');
      }

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
    <Formik
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={handleSubmit}
    >
      {({ isSubmitting, values, setFieldValue }) => (
        <Form className="w-full" noValidate aria-label="Login form">
          <h1 className="text-4xl font-bold pb-6">Sign In</h1>

          <InputBox
            type="text"
            name="identifier"
            placeholder="Phone number or Email"
            icon="bx-user"
            autoComplete="username"
          />

          <InputBox
            type="password"
            name="password"
            placeholder="Password"
            icon="bxs-lock-alt"
            autoComplete="current-password"
          />

          <Link to="/forgot-password" className="forgot-link">
            Forgot password?
          </Link>

          <label
            className="flex items-center gap-2 text-sm font-medium text-left mb-3 cursor-pointer select-none"
            style={{ color: '#245361' }}
          >
            <input
              type="checkbox"
              checked={values.rememberMe}
              onChange={(e) => setFieldValue('rememberMe', e.target.checked)}
              className="accent-[#2D79A8] w-4 h-4 rounded"
              aria-label="Remember me"
            />
            Remember me
          </label>

          <button
            type="submit"
            className="auth-btn"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="auth-spinner" aria-hidden="true" />
                Signing in…
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </Form>
      )}
    </Formik>
  );
};

export default LoginForm;
