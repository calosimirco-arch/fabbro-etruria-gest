export type Role = "titolare" | "amministrazione" | "tecnico";
export interface Profile { id: string; full_name: string; role: Role }

export interface Client { id: string; name: string; phone: string | null; email: string | null; address: string | null; created_at: string }

export type Priority = "bassa" | "media" | "alta" | "critica";
export type InterventionStatus = "nuovo" | "assegnato" | "in_corso" | "chiuso";
export interface Intervention {
  id: string; number: string; client_id: string; title: string; description: string | null;
  priority: Priority; status: InterventionStatus; address: string | null; scheduled_at: string | null;
  created_at: string; client?: Pick<Client, "name" | "phone"> | null;
}

export type SaraKind = "intervento" | "urgenza" | "preventivo" | "appuntamento" | "materiali" | "promemoria" | "altro";
export type SaraUrgency = "normale" | "alta" | "urgente";
export type SaraMood = "sereno" | "preoccupato" | "irritato";
export type SaraStatus = "in_attesa" | "confermata" | "rifiutata";

export interface SaraRequest {
  id: string; kind: SaraKind; client_name: string | null; client_phone: string | null; client_email: string | null;
  client_address: string | null; reason: string | null; urgency: SaraUrgency; notes: string | null; mood: SaraMood;
  scheduled_at: string | null; price_hint: number | null; proposal: string | null; status: SaraStatus;
  decided_at: string | null; reject_reason: string | null; intervention_id: string | null; created_at: string;
}
export interface SaraPrice { id: string; label: string; keywords: string[]; amount: number }

export type QuoteStatus = "bozza" | "inviato" | "accettato" | "rifiutato";
export interface QuoteItem { id: string; quote_id: string; position: number; description: string; quantity: number; unit_price: number; vat_rate: number }
export interface Quote {
  id: string; number: string; client_id: string; title: string; notes: string | null; status: QuoteStatus;
  valid_until: string | null; created_at: string;
  client?: Pick<Client, "name" | "phone" | "email" | "address"> | null;
  items?: QuoteItem[];
}
