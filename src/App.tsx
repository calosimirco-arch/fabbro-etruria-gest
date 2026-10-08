import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { isConfigured } from "@/lib/supabase";
import ClientsPage from "@/pages/ClientsPage";
import HomePage from "@/pages/HomePage";
import InventoryPage from "@/pages/InventoryPage";
import InvoicesPage from "@/pages/InvoicesPage";
import InterventionsPage from "@/pages/InterventionsPage";
import LoginPage from "@/pages/LoginPage";
import QuotesPage from "@/pages/QuotesPage";
import SaraPage from "@/pages/SaraPage";
import SetupPage from "@/pages/SetupPage";

export default function App() {
  const { session, profile, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Se il collegamento «apri Sara in ascolto» arriva prima dell'accesso, si ricorda e si apre appena si e' dentro.
  useEffect(() => {
    try {
      if (!session && location.pathname === "/sara" && location.search.includes("attiva=1")) window.sessionStorage.setItem("sara-pending", "1");
      if (session && profile && window.sessionStorage.getItem("sara-pending")) {
        window.sessionStorage.removeItem("sara-pending");
        navigate("/sara?attiva=1", { replace: true });
      }
    } catch {
      // senza memoria della scheda il collegamento apre comunque la pagina di Sara
    }
  }, [session, profile, location, navigate]);

  if (!isConfigured) return <SetupPage />;
  if (loading) return <p className="p-6 text-sm text-steel">Caricamento...</p>;
  if (!session) return <LoginPage />;
  if (!profile) {
    return <p className="p-6 text-sm">Profilo non trovato: esegui <code>supabase/schema.sql</code> sul progetto e riprova.</p>;
  }

  const staff = profile.role !== "tecnico";
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/interventi" element={<InterventionsPage />} />
        {staff && <Route path="/clienti" element={<ClientsPage />} />}
        {staff && <Route path="/sara" element={<SaraPage />} />}
        {staff && <Route path="/preventivi" element={<QuotesPage />} />}
        {staff && <Route path="/fatture" element={<InvoicesPage />} />}
        {staff && <Route path="/magazzino" element={<InventoryPage />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
