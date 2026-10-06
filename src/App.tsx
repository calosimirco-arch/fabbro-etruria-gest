import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { isConfigured } from "@/lib/supabase";
import ClientsPage from "@/pages/ClientsPage";
import HomePage from "@/pages/HomePage";
import InterventionsPage from "@/pages/InterventionsPage";
import LoginPage from "@/pages/LoginPage";
import SaraPage from "@/pages/SaraPage";
import SetupPage from "@/pages/SetupPage";

export default function App() {
  const { session, profile, loading } = useAuth();

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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
