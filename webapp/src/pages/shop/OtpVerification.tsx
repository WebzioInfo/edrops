import { useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import ClayCard from '../../components/shop/ui/ClayCard';
import ClayButton from '../../components/shop/ui/ClayButton';
import ClayInput from '../../components/shop/ui/ClayInput';
import useAuthStore from '../../store/useAuthStore';

export default function OtpVerification() {
  const [otp, setOtp] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const phone = location.state?.phone;

  if (!phone) {
    return <Navigate to="/login" replace />;
  }

  const handleVerify = (e) => {
    e.preventDefault();
    if (otp.length === 4) {
      // Mock API call to verify OTP
      const dummyUser = { id: 1, phone, name: 'Guest User' };
      const dummyToken = 'jwt-dummy-token';
      login(dummyUser, dummyToken);
      navigate('/', { replace: true });
    } else {
      alert("Please enter a valid 4-digit OTP");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <ClayCard>
          <form onSubmit={handleVerify} className="flex flex-col gap-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-1">Verify OTP</h2>
              <p className="text-sm text-muted-foreground">
                Code sent to +91 {phone}
              </p>
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium ml-1 text-center">Enter 4-Digit Code (hint: 1234)</label>
              <ClayInput
                type="text"
                placeholder="••••"
                className="text-center text-2xl tracking-[1em] font-bold"
                maxLength={4}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              />
            </div>

            <ClayButton type="submit" className="w-full">
              Verify & Login
            </ClayButton>

            <div className="text-center mt-2">
              <button 
                type="button" 
                onClick={() => navigate(-1)}
                className="text-sm text-muted-foreground hover:text-primary font-medium"
              >
                Change Phone Number
              </button>
            </div>
          </form>
        </ClayCard>
      </div>
    </div>
  );
}
