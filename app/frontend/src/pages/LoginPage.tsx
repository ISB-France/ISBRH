import { useState } from "react";
import { LogIn } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Separator } from "../components/ui/separator";
import LoginLoadingScreen from "../components/LoginLoadingScreen";
import api from "../api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleMicrosoftLogin = () => {
    window.location.href = "/api/auth/authenticate/";
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/login/", { email, password });
      localStorage.setItem("access_token", res.data.access);
      localStorage.setItem("refresh_token", res.data.refresh);
      window.location.href = "/";
    } catch (err: unknown) {
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { data?: { error?: string } } };
        setError(axiosErr.response?.data?.error || "Identifiants invalides");
      } else {
        setError("Erreur de connexion");
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoginLoadingScreen />;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FDFAF5] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src="/logo-dark.png" alt="ISB France" className="mx-auto mb-4 h-14 w-auto" />
          <h1 className="font-display text-2xl font-bold text-primary">ISBRH</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestion des entretiens annuels et professionnels
          </p>
        </div>

        <Button className="w-full gap-2" size="lg" onClick={handleMicrosoftLogin}>
          <LogIn className="h-4 w-4" />
          Se connecter avec Microsoft
        </Button>

        <div className="my-6 flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">ou</span>
          <Separator className="flex-1" />
        </div>

        <form onSubmit={handleLogin} className="space-y-3">
          <p className="text-xs text-muted-foreground">Connexion Mail</p>
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full" variant="outline">
            {loading ? "Connexion..." : "Connexion"}
          </Button>
        </form>
      </div>
    </div>
  );
}
