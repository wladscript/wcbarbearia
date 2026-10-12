import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import { BottomNav } from "@/components/BottomNav";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import Booking from "@/pages/Booking";
import Loyalty from "@/pages/Loyalty";
import Admin from "@/pages/Admin";

function FullLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
    </div>
  );
}

function Protected({ role }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user === null) return <FullLoader />;
  if (user === false) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/app"} replace />;
  }
  return <Outlet key={location.pathname} />;
}

function ClientLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Outlet />
      <BottomNav />
    </div>
  );
}

function PublicOnly() {
  const { user } = useAuth();
  if (user === null) return <FullLoader />;
  if (user) return <Navigate to={user.role === "admin" ? "/admin" : "/app"} replace />;
  return <Outlet />;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<PublicOnly />}>
              <Route path="/login" element={<Login />} />
            </Route>

            <Route element={<Protected role="cliente" />}>
              <Route element={<ClientLayout />}>
                <Route path="/app" element={<Home />} />
                <Route path="/app/agendar" element={<Booking />} />
                <Route path="/app/fidelidade" element={<Loyalty />} />
              </Route>
            </Route>

            <Route element={<Protected role="admin" />}>
              <Route path="/admin" element={<Admin />} />
            </Route>

            <Route path="/" element={<Navigate to="/app" replace />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" richColors theme="dark" />
      </AuthProvider>
    </div>
  );
}

export default App;
