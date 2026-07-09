import { useEffect, useRef } from "react";

/** Réinitialise le minuteur d'inactivité sur toute interaction utilisateur et
 * appelle `onTimeout` si aucune interaction n'a eu lieu depuis `timeoutMs`.
 * Pensé pour un poste partagé (kiosque) : ne fait rien de plus que déclencher
 * le callback (typiquement : vider les tokens et rediriger vers le scan de
 * badge) — n'importe quelle logique de déconnexion peut être branchée. */
export function useInactivityLogout(timeoutMs: number, onTimeout: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onTimeoutRef.current(), timeoutMs);
    };

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((event) => window.addEventListener(event, resetTimer));
    resetTimer();

    return () => {
      events.forEach((event) => window.removeEventListener(event, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timeoutMs]);
}
