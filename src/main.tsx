import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import App from "@/App";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/hooks/useAuth";
import "@/index.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1 } } });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <HashRouter>
          <App />
          <Toaster richColors position="top-right" />
        </HashRouter>
      </AuthProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
