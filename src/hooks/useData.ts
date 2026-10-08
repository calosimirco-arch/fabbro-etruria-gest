import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as api from "@/lib/data";
import { supabase } from "@/lib/supabase";

const onError = (e: Error) => toast.error(e.message);

export const useClients = () => useQuery({ queryKey: ["clients"], queryFn: api.fetchClients });
export const useInterventions = () => useQuery({ queryKey: ["interventions"], queryFn: api.fetchInterventions });
export const useSaraPrices = () => useQuery({ queryKey: ["sara-prices"], queryFn: api.fetchSaraPrices });

/** Le richieste di Sara si aggiornano da sole: il titolare vede subito quella appena arrivata (e un avviso). */
export function useSaraRequests() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel(`sara-requests-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sara_requests" }, (payload) => {
        void queryClient.invalidateQueries({ queryKey: ["sara-requests"] });
        const row = payload.new as { status?: string };
        if (payload.eventType === "INSERT" && row.status === "in_attesa") toast.info("Sara ha una richiesta da confermare");
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [queryClient]);
  return useQuery({ queryKey: ["sara-requests"], queryFn: api.fetchSaraRequests });
}

function useInvalidatingMutation<T>(fn: (v: T) => Promise<unknown>, keys: string[][], message?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => { keys.forEach((k) => void queryClient.invalidateQueries({ queryKey: k })); if (message) toast.success(message); },
    onError,
  });
}

export const useCreateClient = () => useInvalidatingMutation(api.createClient, [["clients"]], "Cliente salvato");
export const useCreateIntervention = () => useInvalidatingMutation(api.createIntervention, [["interventions"]], "Intervento creato");
export const useSetInterventionStatus = () =>
  useInvalidatingMutation((v: { id: string; status: Parameters<typeof api.setInterventionStatus>[1] }) => api.setInterventionStatus(v.id, v.status), [["interventions"]]);
export const useRegisterSaraRequest = () => useInvalidatingMutation(api.registerSaraRequest, [["sara-requests"]]);
export const useConfirmSaraRequest = () =>
  useInvalidatingMutation(api.confirmSaraRequest, [["sara-requests"], ["interventions"], ["clients"], ["quotes"]], "Confermato");
export const useRejectSaraRequest = () => useInvalidatingMutation(api.rejectSaraRequest, [["sara-requests"]], "Richiesta rifiutata");
export const useSaveSaraPrice = () => useInvalidatingMutation(api.saveSaraPrice, [["sara-prices"]]);
export const useDeleteSaraPrice = () => useInvalidatingMutation(api.deleteSaraPrice, [["sara-prices"]]);

export const useQuotes = () => useQuery({ queryKey: ["quotes"], queryFn: api.fetchQuotes });
export const useCreateQuote = () => useInvalidatingMutation(api.createQuote, [["quotes"]], "Preventivo creato");
export const useSetQuoteStatus = () =>
  useInvalidatingMutation((v: { id: string; status: Parameters<typeof api.setQuoteStatus>[1] }) => api.setQuoteStatus(v.id, v.status), [["quotes"]]);
export const useDeleteQuote = () => useInvalidatingMutation(api.deleteQuote, [["quotes"]], "Bozza eliminata");
