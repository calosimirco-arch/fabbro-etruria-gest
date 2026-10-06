import { friendly, supabase } from "@/lib/supabase";
import type { Client, Intervention, InterventionStatus, Priority, SaraKind, SaraMood, SaraPrice, SaraRequest, SaraUrgency } from "@/types";

// Letture dalle tabelle (la RLS decide cosa si vede); le scritture di Sara solo tramite le funzioni sara_*.

export async function fetchClients() {
  const { data, error } = await supabase.from("clients").select("*").order("name").limit(1000);
  if (error) throw friendly(error);
  return data as Client[];
}

export async function createClient(input: { name: string; phone: string; email: string; address: string }) {
  const { error } = await supabase.from("clients").insert({
    name: input.name.trim(), phone: input.phone.trim() || null, email: input.email.trim() || null, address: input.address.trim() || null,
  });
  if (error) throw friendly(error);
}

export async function fetchInterventions() {
  const { data, error } = await supabase.from("interventions").select("*, client:clients(name, phone)").order("created_at", { ascending: false }).limit(500);
  if (error) throw friendly(error);
  return data as unknown as Intervention[];
}

export async function createIntervention(input: { clientId: string; title: string; description: string; priority: Priority; address: string }) {
  // Il numero lo assegna il database (trigger): si passa vuoto perche' la colonna e' obbligatoria.
  const { error } = await supabase.from("interventions").insert({
    number: "", client_id: input.clientId, title: input.title.trim(), description: input.description.trim() || null,
    priority: input.priority, address: input.address.trim() || null,
  });
  if (error) throw friendly(error);
}

export async function setInterventionStatus(id: string, status: InterventionStatus) {
  const { error } = await supabase.from("interventions").update({ status, closed_at: status === "chiuso" ? new Date().toISOString() : null }).eq("id", id);
  if (error) throw friendly(error);
}

export async function fetchSaraRequests() {
  const { data, error } = await supabase.from("sara_requests").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw friendly(error);
  return data as SaraRequest[];
}

export async function fetchSaraPrices() {
  const { data, error } = await supabase.from("sara_prices").select("*").order("label");
  if (error) throw friendly(error);
  return data as SaraPrice[];
}

export interface RegisterInput {
  kind: SaraKind; name: string; phone: string; email: string; address: string; reason: string;
  urgency: SaraUrgency; notes: string; mood: SaraMood; scheduledAt?: Date | null; priceHint?: number | null; proposal: string;
}

export async function registerSaraRequest(i: RegisterInput) {
  const { data, error } = await supabase.rpc("sara_register_request", {
    p_kind: i.kind, p_client_name: i.name, p_client_phone: i.phone, p_client_email: i.email, p_client_address: i.address,
    p_reason: i.reason, p_urgency: i.urgency, p_notes: i.notes, p_mood: i.mood,
    p_scheduled_at: i.scheduledAt ? i.scheduledAt.toISOString() : null, p_price_hint: i.priceHint ?? null, p_proposal: i.proposal,
  });
  if (error) throw friendly(error);
  return data as SaraRequest;
}

export async function confirmSaraRequest(id: string) {
  const { data, error } = await supabase.rpc("sara_confirm_request", { p_id: id });
  if (error) throw friendly(error);
  return data as SaraRequest;
}

export async function rejectSaraRequest(id: string) {
  const { error } = await supabase.rpc("sara_reject_request", { p_id: id, p_reason: null });
  if (error) throw friendly(error);
}

export async function saveSaraPrice(i: { label: string; keywords: string; amount: number }) {
  const { error } = await supabase.rpc("sara_save_price", { p_label: i.label, p_keywords: i.keywords, p_amount: i.amount, p_id: null });
  if (error) throw friendly(error);
}

export async function deleteSaraPrice(id: string) {
  const { error } = await supabase.rpc("sara_delete_price", { p_id: id });
  if (error) throw friendly(error);
}
