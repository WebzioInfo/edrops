import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { lazy, Suspense } from "react"
import DashboardLayout from "./layouts/DashboardLayout"
import Overview from "./pages/admin/Overview"
import Finance from "./pages/admin/Finance"
import Godown from "./pages/admin/Godown"
import Fleet from "./pages/admin/Fleet"
import Products from "./pages/admin/Products"
import Orders from "./pages/admin/Orders"
import Customers from "./pages/admin/Customers"
import Subscriptions from "./pages/admin/Subscriptions"
import Settings from "./pages/admin/Settings"
import Promos from "./pages/admin/Promos"

import DistributorDashboard from "./pages/distributor/Dashboard"
import Settlements from "./pages/distributor/Settlements"
import RoutesPage from "./pages/distributor/Routes"
import InventoryReq from "./pages/distributor/Inventory"

import ShopLogin from "./pages/shop/Login"
import ShopOtpVerification from "./pages/shop/OtpVerification"
import ShopAppLayout from "./components/shop/layout/AppLayout"
import useAuthStore from "./store/useAuthStore"

const ShopHome = lazy(() => import("./pages/shop/Home"))
const ShopCart = lazy(() => import("./pages/shop/Cart"))
const ShopCheckout = lazy(() => import("./pages/shop/Checkout"))
const ShopOrders = lazy(() => import("./pages/shop/Orders"))
const ShopOrderDetail = lazy(() => import("./pages/shop/OrderDetail"))
const ShopSubscriptions = lazy(() => import("./pages/shop/Subscriptions"))
const ShopCreateSubscription = lazy(() => import("./pages/shop/CreateSubscription"))
const ShopWallet = lazy(() => import("./pages/shop/Wallet"))
const ShopProfile = lazy(() => import("./pages/shop/Profile"))

const DeliveryDashboard = lazy(() => import("./pages/delivery/Dashboard"))

const queryClient = new QueryClient()

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = (useAuthStore as any)()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

const GuestRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = (useAuthStore as any)()
  if (isAuthenticated) return <Navigate to="/" replace />
  return <>{children}</>
}

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
  </div>
)

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Shop Routes */}
          <Route path="/login" element={<GuestRoute><ShopLogin /></GuestRoute>} />
          <Route path="/otp-verification" element={<GuestRoute><ShopOtpVerification /></GuestRoute>} />

          <Route element={<ProtectedRoute><ShopAppLayout /></ProtectedRoute>}>
            <Route path="/" element={<Suspense fallback={<PageLoader />}><ShopHome /></Suspense>} />
            <Route path="/cart" element={<Suspense fallback={<PageLoader />}><ShopCart /></Suspense>} />
            <Route path="/checkout" element={<Suspense fallback={<PageLoader />}><ShopCheckout /></Suspense>} />
            <Route path="/orders" element={<Suspense fallback={<PageLoader />}><ShopOrders /></Suspense>} />
            <Route path="/orders/:id" element={<Suspense fallback={<PageLoader />}><ShopOrderDetail /></Suspense>} />
            <Route path="/subscriptions" element={<Suspense fallback={<PageLoader />}><ShopSubscriptions /></Suspense>} />
            <Route path="/subscriptions/new" element={<Suspense fallback={<PageLoader />}><ShopCreateSubscription /></Suspense>} />
            <Route path="/wallet" element={<Suspense fallback={<PageLoader />}><ShopWallet /></Suspense>} />
            <Route path="/profile" element={<Suspense fallback={<PageLoader />}><ShopProfile /></Suspense>} />
          </Route>

          {/* Delivery Routes */}
          <Route path="/delivery" element={<Suspense fallback={<PageLoader />}><DeliveryDashboard /></Suspense>} />

          {/* Admin Routes */}
          <Route path="/admin" element={<DashboardLayout />}>
            <Route index element={<Overview />} />
            <Route path="finance" element={<Finance />} />
            <Route path="godown" element={<Godown />} />
            <Route path="fleet" element={<Fleet />} />
            <Route path="products" element={<Products />} />
            <Route path="orders" element={<Orders />} />
            <Route path="customers" element={<Customers />} />
            <Route path="subscriptions" element={<Subscriptions />} />
            <Route path="promos" element={<Promos />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Distributor Routes */}
          <Route path="/distributor" element={<DashboardLayout />}>
            <Route index element={<DistributorDashboard />} />
            <Route path="settlements" element={<Settlements />} />
            <Route path="routes" element={<RoutesPage />} />
            <Route path="inventory" element={<InventoryReq />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
