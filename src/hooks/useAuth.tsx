import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types";

interface AuthState { session: Session | null; profile: Profile | null; loading: boolean }
const Ctx = createContext<AuthState>({ session: null, profile: null, loading: true });

// Unico punto che legge la sessione: tutti gli altri leggono questo stato.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (!data.session) setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) { setProfile(null); return; }
    let cancelled = false;
    supabase.from("profiles").select("id, full_name, role").eq("id", userId).maybeSingle().then(({ data }) => {
      if (cancelled) return;
      setProfile((data as Profile | null) ?? null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [userId]);

  return <Ctx.Provider value={{ session, profile, loading }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
