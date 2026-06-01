import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-hot-toast';
import InputBox from '../InputBox';
import { fetchWithAuth } from '../../../api/client';

interface SignUpValues {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  password: string;
  acceptTerms: boolean;
}

const initialValues: SignUpValues = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  password: '',
  acceptTerms: false,
};

const validationSchema = Yup.object({
  firstName: Yup.string()
    .min(2, 'First name must be at least 2 characters')
    .required('First name is required'),
  lastName: Yup.string()
    .min(2, 'Last name must be at least 2 characters')
    .required('Last name is required'),
  phone: Yup.string()
    .required('Phone number is required'),
  email: Yup.string()
    .email('Please enter a valid email address')
    .optional(),
  password: Yup.string()
    .min(8, 'Minimum 8 characters')
    .matches(/[A-Z]/, 'Needs uppercase')
    .matches(/[a-z]/, 'Needs lowercase')
    .matches(/[0-9]/, 'Needs number')
    .matches(/[\^$*.[\]{}()?"!@#%&/\\,><':;|_~`]/, 'Needs special character')
    .required('Password is required'),
  acceptTerms: Yup.boolean()
    .oneOf([true], 'You must accept the terms')
    .required('You must accept the terms'),
});

interface SignUpFormProps {
  setIsLogin: (v: boolean) => void;
  setIsActive: (v: boolean) => void;
}

const SignUpForm = ({ setIsLogin, setIsActive }: SignUpFormProps) => {
  const handleSubmit = async (values: SignUpValues, { setSubmitting, resetForm }: any) => {
    try {
      await fetchWithAuth('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          firstName: values.firstName,
          lastName: values.lastName,
          phone: values.phone,
          email: values.email || undefined,
          password: values.password,
        }),
      });

      toast.success('Account created! Please sign in.');
      resetForm();

      // Animate back to login panel
      setIsActive(false);
      setTimeout(() => {
        setIsLogin(true);
      }, 700);
    } catch (err: any) {
      const msg = err.message ?? 'Registration failed. Please try again.';
      toast.error(msg);
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
      {({ isSubmitting, setFieldValue }) => (
        <Form className="w-full" noValidate aria-label="Registration form">
          <h1 className="md:text-4xl text-2xl font-bold pb-1 md:pb-4">Create Account</h1>

          <div className="grid grid-cols-2 gap-3">
            <InputBox
              type="text"
              name="firstName"
              placeholder="First name"
              icon="bxs-user"
              autoComplete="given-name"
            />
            <InputBox
              type="text"
              name="lastName"
              placeholder="Last name"
              icon="bxs-user"
              autoComplete="family-name"
            />
          </div>

          <InputBox
            type="tel"
            name="phone"
            placeholder="Phone number"
            icon="bx-phone"
            autoComplete="tel"
          />

          <InputBox
            type="email"
            name="email"
            placeholder="Email address (Optional)"
            icon="bxs-envelope"
            autoComplete="email"
          />

          <InputBox
            type="password"
            name="password"
            placeholder="Create password"
            icon="bxs-lock-alt"
            autoComplete="new-password"
          />
          
          <label className="flex items-center gap-2 text-xs font-medium text-left mb-3 cursor-pointer select-none" style={{ color: '#245361' }}>
            <input type="checkbox" name="acceptTerms" onChange={(e) => setFieldValue('acceptTerms', e.target.checked)} className="accent-[#2D79A8] w-4 h-4 rounded" />
            I accept the Terms and Conditions
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
                Creating account…
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </Form>
      )}
    </Formik>
  );
};

export default SignUpForm;
