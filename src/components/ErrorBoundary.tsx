import { Component, type ErrorInfo, type ReactNode } from "react";

/** Rete di sicurezza: invece di una pagina bianca mostra l'errore, cosi' si capisce cosa non va. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error(error, info.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="mx-auto max-w-xl p-6">
        <div className="box space-y-2 p-5 text-sm">
          <h1 className="text-lg font-semibold">Qualcosa non ha funzionato</h1>
          <p className="break-words font-mono text-xs text-red-700">{this.state.error.message}</p>
          <button className="btn" onClick={() => window.location.reload()}>Ricarica</button>
        </div>
      </main>
    );
  }
}
