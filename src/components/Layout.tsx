import { NavLink, Outlet } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import clsx from "clsx";

const ROLE_LABEL = { titolare: "Titolare", amministrazione: "Amministrazione", tecnico: "Tecnico" } as const;

export function Layout() {
  const { profile } = useAuth();
  const staff = profile?.role !== "tecnico";
  const links = [
    { to: "/", label: "Home", end: true, show: true },
    { to: "/sara", label: "Sara", show: staff },
    { to: "/interventi", label: "Interventi", show: true },
    { to: "/preventivi", label: "Preventivi", show: staff },
    { to: "/fatture", label: "Fatture", show: staff },
    { to: "/magazzino", label: "Magazzino", show: staff },
    { to: "/clienti", label: "Clienti", show: staff },
  ].filter((l) => l.show);

  return (
    <div className="min-h-screen">
      <header className="border-b border-steel-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-2">
          <span className="mr-4 text-lg font-bold text-brand max-md:mr-auto">Sara Gest</span>
          <nav className="order-last -mx-4 flex w-[calc(100%+2rem)] gap-1 overflow-x-auto px-4 md:order-none md:mx-0 md:w-auto md:flex-1 md:overflow-visible md:px-0" aria-label="Menu principale">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end}
                className={({ isActive }) => clsx("shrink-0 whitespace-nowrap px-3 py-2 text-sm font-medium", isActive ? "bg-brand text-white" : "text-slate-700 hover:bg-steel-soft")}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <span className="ml-auto hidden text-xs text-steel sm:inline md:ml-0">{profile?.full_name} · {profile ? ROLE_LABEL[profile.role] : ""}</span>
          <button className="btn btn-outline h-9 px-3" onClick={() => void supabase.auth.signOut()} aria-label="Esci"><LogOut className="h-4 w-4" /></button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-4 p-4"><Outlet /></main>
    </div>
  );
}
