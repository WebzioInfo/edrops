import { Outlet } from 'react-router-dom';
import Header from './Header';
import BottomNav from './BottomNav';

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Main content wrapper with padding for fixed header and bottom nav */}
      <main className="pt-20 pb-20 sm:pb-8 px-4 max-w-screen-sm mx-auto">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}
