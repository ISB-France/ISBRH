import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { badgeAuth } from "./api";

// Délai sans frappe après lequel on considère la saisie du badge terminée,
// pour les lecteurs qui n'envoient pas d'Entrée fiable.
const SCAN_IDLE_TIMEOUT_MS = 400;
// Délai avant de reforcer le focus sur le champ si l'utilisateur clique
// ailleurs (poste partagé : le scan doit toujours arriver dans le champ).
const REFOCUS_DELAY_MS = 300;

export default function BadgeScanPage() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const focusInput = () => inputRef.current?.focus();

  useEffect(() => {
    focusInput();
  }, []);

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  const resetAndRefocus = () => {
    setCode("");
    setTimeout(focusInput, REFOCUS_DELAY_MS);
  };

  const submitCode = async (rawCode: string) => {
    const trimmed = rawCode.trim();
    if (!trimmed || status === "checking") return;

    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    setStatus("checking");
    setErrorMessage("");

    try {
      const { access, refresh } = await badgeAuth(trimmed);
      localStorage.setItem("access_token", access);
      localStorage.setItem("refresh_token", refresh);
      // Rechargement complet (comme le login classique) pour que App.tsx
      // réévalue la présence du token depuis zéro.
      window.location.href = "/evp/saisie";
    } catch (err: unknown) {
      let message = "Badge non reconnu";
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { data?: { error?: string } } };
        message = axiosErr.response?.data?.error || message;
      }
      setStatus("error");
      setErrorMessage(message);
      resetAndRefocus();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCode(value);
    setStatus("idle");

    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => submitCode(value), SCAN_IDLE_TIMEOUT_MS);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitCode(code);
    }
  };

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-[#FDFAF5] p-6 text-center"
      onClick={focusInput}
    >
      <img src="/logo-dark.png" alt="ISB France" className="mb-10 h-16 w-auto" />

      <h1 className="font-display text-4xl font-bold text-primary">
        Scannez votre badge
      </h1>
      <p className="mt-3 max-w-md text-lg text-muted-foreground">
        Présentez votre badge devant le lecteur pour accéder à la saisie EVP.
      </p>

      <div className="mt-12 w-full max-w-md">
        <input
          ref={inputRef}
          type="text"
          inputMode="none"
          autoComplete="off"
          value={code}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(focusInput, REFOCUS_DELAY_MS)}
          disabled={status === "checking"}
          aria-label="Champ de scan du badge"
          className="w-full rounded-xl border-4 border-primary/30 bg-white px-6 py-8 text-center text-3xl tracking-widest text-primary shadow-lg focus:border-primary focus:outline-none disabled:opacity-60"
        />

        {status === "checking" && (
          <p className="mt-4 text-lg text-muted-foreground">Vérification…</p>
        )}
        {status === "error" && (
          <p className="mt-4 text-lg font-semibold text-destructive">{errorMessage}</p>
        )}
      </div>

      <Link
        to="/login"
        className="mt-16 text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        Connexion classique
      </Link>
    </div>
  );
}
