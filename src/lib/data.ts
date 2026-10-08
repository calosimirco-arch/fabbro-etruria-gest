import { friendly, supabase } from "@/lib/supabase";
import type { Client, Intervention, InterventionStatus, Invoice, Material, MovementKind, PaymentMethod, Priority, Quote, QuoteStatus, SaraKind, SaraMood, SaraPrice, SaraRequest, SaraUrgency, StockLevel, StockMovement, Warehouse } from "@/types";

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

// ---- Preventivi ----

export async function fetchQuotes() {
  const { data, error } = await supabase
    .from("quotes")
    .select("*, client:clients(name, phone, email, address), items:quote_items(*)")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw friendly(error);
  return (data as unknown as Quote[]).map((q) => ({ ...q, items: [...(q.items ?? [])].sort((a, b) => a.position - b.position) }));
}

export interface NewQuoteInput {
  clientId: string; title: string; notes: string; validUntil: string;
  items: Array<{ description: string; quantity: number; unit_price: number; vat_rate: number }>;
}

export async function createQuote(input: NewQuoteInput) {
  const { data, error } = await supabase.from("quotes").insert({
    number: "", client_id: input.clientId, title: input.title.trim(), notes: input.notes.trim() || null, valid_until: input.validUntil || null,
  }).select("id").single();
  if (error) throw friendly(error);
  if (input.items.length > 0) {
    const { error: itemsError } = await supabase.from("quote_items").insert(input.items.map((it, position) => ({ quote_id: data.id, position, ...it })));
    if (itemsError) {
      // Niente preventivo a meta': se le voci non si salvano, si toglie anche la bozza appena creata.
      await supabase.from("quotes").delete().eq("id", data.id);
      throw friendly(itemsError);
    }
  }
}

export async function setQuoteStatus(id: string, status: QuoteStatus) {
  const { error } = await supabase.from("quotes").update({ status }).eq("id", id);
  if (error) throw friendly(error);
}

export async function deleteQuote(id: string) {
  const { error } = await supabase.from("quotes").delete().eq("id", id);
  if (error) throw friendly(error);
}

// ---- Fatture (si scrive solo con le funzioni del database: numero, voci e stato sono sempre coerenti) ----

export async function fetchInvoices() {
  const { data, error } = await supabase
    .from("invoices")
    .select("*, client:clients(name, phone, email, address), items:invoice_items(*)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw friendly(error);
  return (data as unknown as Invoice[]).map((i) => ({ ...i, items: [...(i.items ?? [])].sort((a, b) => a.position - b.position) }));
}

export async function createInvoice(input: { clientId: string; title: string; notes: string; dueDate: string; items: Array<{ description: string; quantity: number; unit_price: number; vat_rate: number }> }) {
  const { error } = await supabase.rpc("create_invoice", {
    p_client_id: input.clientId, p_title: input.title.trim(), p_notes: input.notes, p_due_date: input.dueDate || null, p_items: input.items,
    p_quote_id: null, p_intervention_id: null,
  });
  if (error) throw friendly(error);
}

export async function createInvoiceFromQuote(quoteId: string) {
  const { error } = await supabase.rpc("create_invoice_from_quote", { p_quote_id: quoteId, p_due_date: null });
  if (error) throw friendly(error);
}

export async function markInvoicePaid(id: string, method: PaymentMethod) {
  const { error } = await supabase.rpc("mark_invoice_paid", { p_id: id, p_method: method });
  if (error) throw friendly(error);
}

export async function cancelInvoice(id: string, reason: string) {
  const { error } = await supabase.rpc("cancel_invoice", { p_id: id, p_reason: reason });
  if (error) throw friendly(error);
}

// ---- Magazzino (i movimenti si scrivono solo con le funzioni del database: niente giacenze negative) ----

export async function fetchWarehouses() {
  const { data, error } = await supabase.from("warehouses").select("*").order("created_at");
  if (error) throw friendly(error);
  return data as Warehouse[];
}
export async function fetchMaterials() {
  const { data, error } = await supabase.from("materials").select("*").order("name").limit(2000);
  if (error) throw friendly(error);
  return (data as Material[]).map((m) => ({ ...m, price: Number(m.price), min_stock: Number(m.min_stock) }));
}
export async function fetchStockLevels() {
  const { data, error } = await supabase.from("stock_levels").select("*").limit(10000);
  if (error) throw friendly(error);
  return (data as StockLevel[]).map((l) => ({ ...l, quantity: Number(l.quantity) }));
}
export async function fetchMovements() {
  const { data, error } = await supabase
    .from("stock_movements")
    .select("*, material:materials(code, name, unit), warehouse:warehouses(name), intervention:interventions(number)")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw friendly(error);
  return (data as unknown as StockMovement[]).map((m) => ({ ...m, delta: Number(m.delta) }));
}
export async function createWarehouse(name: string) {
  const { error } = await supabase.from("warehouses").insert({ name: name.trim() });
  if (error) throw friendly(error.message.includes("idx_warehouses_name") ? { message: "Esiste già un magazzino con questo nome" } : error);
}
export async function saveMaterial(input: { id?: string; code: string; name: string; unit: string; price: number; minStock: number; active?: boolean }) {
  const row = { code: input.code.trim(), name: input.name.trim(), unit: input.unit.trim() || "pz", price: input.price, min_stock: input.minStock, ...(input.active === undefined ? {} : { active: input.active }) };
  const { error } = input.id ? await supabase.from("materials").update(row).eq("id", input.id) : await supabase.from("materials").insert(row);
  if (error) throw friendly(error.message.includes("idx_materials_code") ? { message: "Esiste già un materiale con questo codice" } : error);
}
export async function stockMove(input: { materialId: string; warehouseId: string; kind: MovementKind; quantity: number; note: string; interventionId?: string | null }) {
  const { error } = await supabase.rpc("stock_move", {
    p_material: input.materialId, p_warehouse: input.warehouseId, p_kind: input.kind, p_quantity: input.quantity, p_note: input.note, p_intervention: input.interventionId || null,
  });
  if (error) throw friendly(error);
}
export async function stockTransfer(input: { materialId: string; fromId: string; toId: string; quantity: number; note: string }) {
  const { error } = await supabase.rpc("stock_transfer", { p_material: input.materialId, p_from: input.fromId, p_to: input.toId, p_quantity: input.quantity, p_note: input.note });
  if (error) throw friendly(error);
}
