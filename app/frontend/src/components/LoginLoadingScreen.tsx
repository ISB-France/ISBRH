import { Loader2 } from "lucide-react";

export default function LoginLoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="text-center">
        <img src="/logo-dark.png" alt="ISB France" className="mx-auto mb-4 h-14 w-auto" />
        <h1 className="font-display text-2xl font-bold text-primary">ISBRH</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestion des entretiens annuels et professionnels
        </p>
        <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Connexion en cours...</span>
        </div>
      </div>
    </div>
  );
}
