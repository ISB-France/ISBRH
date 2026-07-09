import { useEffect } from "react";
import { Toast, useToast } from "./Toast";
import { subscribeError } from "../lib/errorBus";

/** Affiche un toast pour toute erreur API (403/404/500/reseau) qui n'a pas
 * ete interceptee localement par une page - evite les echecs silencieux. */
export function GlobalErrorToast() {
  const { toast, show, setToast } = useToast();

  useEffect(() => subscribeError((message) => show(message, "error")), [show]);

  if (!toast) return null;
  return <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />;
}
