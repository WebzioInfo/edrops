import { useState } from 'react';
import 'boxicons/css/boxicons.min.css';
import LoginForm from './features/LoginForm';
import SignUpForm from './features/SignUpForm';
import './SignUp_LogIn_Form.css';
import { useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import logo from '../../assets/logo22.png';

const LoginSignup = () => {
  const [isActive, setIsActive] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();

  const goToRegister = () => {
    setIsActive(true);
    setTimeout(() => setIsLogin(false), 700);
  };

  const goToLogin = () => {
    setIsActive(false);
    setTimeout(() => setIsLogin(true), 700);
  };

  return (
    <div className="auth-page">
      <Toaster position="top-center" toastOptions={{ duration: 4000 }} />

      {/* Logo */}
      <button
        type="button"
        onClick={() => navigate('/')}
        className="z-30 absolute top-5 left-6 sm:left-10 flex items-center gap-3 bg-transparent border-none cursor-pointer hover:opacity-80 transition-opacity"
        aria-label="Go to homepage"
      >
        <img src={logo} alt="Edrops Logo" className="w-10 h-10 object-contain drop-shadow-md" />
        <span className="font-bold text-2xl tracking-tight" style={{ color: '#245361', fontFamily: 'Outfit, sans-serif' }}>
          Edrops
        </span>
      </button>

      {/* Main Card */}
      <div className="w-screen h-screen flex justify-center items-center px-4">
        <div
          className={`containerF relative w-full sm:w-[85%] md:w-[75%] lg:w-[65%] xl:w-[55%] h-[92vh] sm:h-[85vh] md:h-[80vh]${isActive ? ' active' : ''}`}
          role="main"
        >
          {/* Login Form Box */}
          <div className="form-box login">
            {isLogin && <LoginForm setIsLogin={setIsLogin} />}
          </div>

          {/* Register Form Box */}
          <div className="form-box register">
            {!isLogin && (
              <SignUpForm setIsLogin={setIsLogin} setIsActive={setIsActive} />
            )}
          </div>

          {/* Toggle Overlay */}
          <div className="toggle-box" aria-hidden="true">
            {/* Left panel — "Don't have an account?" */}
            <div className="toggle-panel toggle-left">
              <h1>Welcome Back!</h1>
              <p>Don't have an account?</p>
              <button
                type="button"
                className="toggle-btn"
                onClick={goToRegister}
                tabIndex={isActive ? -1 : 0}
              >
                Register
              </button>
            </div>

            {/* Right panel — "Already have an account?" */}
            <div className="toggle-panel toggle-right">
              <h1>Hello, Welcome!</h1>
              <p>Already have an account?</p>
              <button
                type="button"
                className="toggle-btn"
                onClick={goToLogin}
                tabIndex={isActive ? 0 : -1}
              >
                Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginSignup;
