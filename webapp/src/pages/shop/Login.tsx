import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ClayCard from '../../components/shop/ui/ClayCard';
import ClayButton from '../../components/shop/ui/ClayButton';
import ClayInput from '../../components/shop/ui/ClayInput';
import { Droplet } from 'lucide-react';

export default function Login() {
  const [phone, setPhone] = useState('');
  const navigate = useNavigate();

  const handleSendOtp = (e) => {
    e.preventDefault();
    if (phone.length === 10) {
      // In a real app, call API to send OTP here
      navigate('/otp-verification', { state: { phone } });
    } else {
      alert("Please enter a valid 10-digit phone number");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-4 clay-btn p-0 active:scale-100">
            <Droplet className="text-primary-foreground w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-primary">E-Drops</h1>
          <p className="text-muted-foreground mt-2">Pure Water, Delivered.</p>
        </div>

        <ClayCard>
          <form onSubmit={handleSendOtp} className="flex flex-col gap-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-1">Welcome Back</h2>
              <p className="text-sm text-muted-foreground">Enter your phone number to login or register</p>
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium ml-1">Phone Number</label>
              <div className="flex gap-2 items-center relative">
                <span className="absolute left-4 text-muted-foreground font-medium">+91</span>
                <ClayInput
                  type="tel"
                  placeholder="9876543210"
                  className="pl-12 tracking-wider font-medium"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            </div>

            <ClayButton type="submit" className="w-full">
              Get OTP
            </ClayButton>
          </form>
        </ClayCard>
      </div>
    </div>
  );
}
