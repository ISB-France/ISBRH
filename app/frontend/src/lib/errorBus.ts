// Petit bus d'evenements permettant de notifier une erreur depuis n'importe
// ou (intercepteur axios, QueryClient global) sans dependre d'un hook React.
type Listener = (message: string) => void;

const listeners = new Set<Listener>();

export function notifyError(message: string) {
  listeners.forEach((listener) => listener(message));
}

export function subscribeError(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "response" in error) {
    const response = (error as { response?: { status?: number; data?: unknown } }).response;
    const data = response?.data as { error?: string; detail?: string } | undefined;
    if (data?.error) return data.error;
    if (data?.detail) return data.detail;
    if (response?.status === 403) return "Accès refusé.";
    if (response?.status === 404) return "Ressource introuvable.";
    if (response?.status && response.status >= 500) return "Erreur serveur, veuillez réessayer.";
  }
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: string }).message);
  }
  return "Une erreur inattendue s'est produite.";
}
