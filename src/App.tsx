import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LangProvider } from "@/store/LangContext";
import { lazy, Suspense } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Skeleton } from "@/components/ui/skeleton";
import ErrorBoundary from "@/components/ErrorBoundary";
import WhatsAppButton from "@/components/WhatsAppButton";

// Lazy-loaded pages
const Landing = lazy(() => import("@/pages/Landing"));
const Login = lazy(() => import("@/pages/Login"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const ClientDashboard = lazy(() => import("@/pages/ClientDashboard"));
const ResellerDashboard = lazy(() => import("@/pages/ResellerDashboard"));
const ServiceDetail = lazy(() => import("@/pages/ServiceDetail"));
const ResellerServiceDetail = lazy(() => import("@/pages/ResellerServiceDetail"));

const NotFound = lazy(() => import("@/pages/NotFound"));
const LazyTerms = lazy(() => import("@/pages/LegalPages").then(m => ({ default: m.TermsPage })));
const LazyPrivacy = lazy(() => import("@/pages/LegalPages").then(m => ({ default: m.PrivacyPage })));
const LazyRefund = lazy(() => import("@/pages/LegalPages").then(m => ({ default: m.RefundPage })));

const PageLoader = () => (
  <div className="flex-1 flex items-center justify-center min-h-[60vh]">
    <div className="w-full max-w-md space-y-4 px-6">
      <Skeleton className="h-8 w-3/4 mx-auto" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  </div>
);

const AppLayout = () => {
  const location = useLocation();
  const isLoginPage = location.pathname === "/" || location.pathname === "/login";

  return (
    <div className="flex flex-col min-h-screen">
      {!isLoginPage && <Navbar />}
      <main className="flex-1">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/client" element={<ClientDashboard />} />
            <Route path="/reseller" element={<ResellerDashboard />} />
            <Route path="/reseller/service/:id" element={<ResellerServiceDetail />} />
            <Route path="/service/:id" element={<ServiceDetail />} />
            <Route path="/terms" element={<LazyTerms />} />
            <Route path="/privacy" element={<LazyPrivacy />} />
            <Route path="/refund" element={<LazyRefund />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      {!isLoginPage && <Footer />}
      {!isLoginPage && <WhatsAppButton />}
    </div>
  );
};

const App = () => (
  <ErrorBoundary>
    <LangProvider>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <AppLayout />
        </BrowserRouter>
      </TooltipProvider>
    </LangProvider>
  </ErrorBoundary>
);

export default App;
