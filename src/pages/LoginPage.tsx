import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
    setBusy(false);
    if (result.error) { toast.error(result.error.message); return; }
    if (mode === "signup" && !result.data.session) toast.success("Controlla la tua email per confermare l'account, poi accedi.");
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-sm items-center p-4">
      <form onSubmit={submit} className="box w-full space-y-3 p-5">
        <h1 className="text-xl font-bold text-brand">Sara Gest</h1>
        <p className="text-sm text-steel">{mode === "login" ? "Accedi al gestionale" : "Il primo account creato diventa il titolare"}</p>
        {mode === "signup" && <input className="field" placeholder="Nome e cognome" value={name} onChange={(e) => setName(e.target.value)} required />}
        <input className="field" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        <input className="field" type="password" placeholder="Password (almeno 6 caratteri)" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={mode === "login" ? "current-password" : "new-password"} />
        <button className="btn w-full" disabled={busy}>{mode === "login" ? "Accedi" : "Crea account"}</button>
        <button type="button" className="w-full text-sm text-brand underline" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "Primo accesso? Crea l'account" : "Ho già un account"}
        </button>
      </form>
    </main>
  );
}
