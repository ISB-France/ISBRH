import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, Camera, Save, X, Palette } from "lucide-react";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import AppLayout from "../components/AppLayout";
import LoadingScreen from "../components/LoadingScreen";
import { useColorTheme } from "../contexts/ColorThemeContext";
import api from "../api";
import type { User } from "../types";

const EMOJIS = [
  "🌲", "🌳", "🪵", "🪚", "🪓", "🔨",
  "👨‍🌾", "👩‍🌾", "👨‍🔧", "👩‍🔧", "👨‍🎨", "👩‍🎨",
  "🏡", "🍂", "🌿", "🍃", "🌰", "🍄",
  "🌸", "🌻", "🍀", "🌱", "🌹", "🪴",
];

export default function Profile() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { theme, themes, setTheme } = useColorTheme();
  const [editing, setEditing] = useState(false);
  const [showIcons, setShowIcons] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [icon, setIcon] = useState("");

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["me"],
    queryFn: () => api.get("/auth/me/").then((r) => r.data),
  });

  if (isLoading) return <LoadingScreen />;
  if (!user) return null;

  const initials = `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase() || user.email[0].toUpperCase();

  const startEditing = () => {
    setIcon(user.icon || "");
    setEditing(true);
    setShowIcons(false);
  };

  const cancelEditing = () => {
    setEditing(false);
    setShowIcons(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch("/auth/me/", { icon });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      setEditing(false);
    } catch {
      alert("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("avatar", file);
    try {
      await api.post("/auth/profile/avatar/", form);
      setIcon("");
      queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch {
      alert("Erreur lors de l'upload");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-lg">
        <Card>
          <CardHeader className="flex flex-col items-center gap-4 pb-4 pt-8">
            <div className="relative">
              <Avatar className="h-24 w-24">
                {user.photo ? (
                  <img src={user.photo} alt="" className="h-full w-full rounded-full object-cover" />
                ) : user.icon ? (
                  <span className="flex h-full w-full items-center justify-center text-4xl">{user.icon}</span>
                ) : (
                  <AvatarFallback className="text-xl font-semibold bg-primary-foreground text-primary">
                    {initials}
                  </AvatarFallback>
                )}
              </Avatar>
              {editing && (
                <>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                  <button
                    className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary-foreground text-primary shadow hover:opacity-80 disabled:opacity-50"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    title="Changer l'avatar"
                  >
                    {uploading ? <span className="text-[10px]">...</span> : <Camera className="h-3.5 w-3.5" />}
                  </button>
                </>
              )}
            </div>
            {editing ? (
              <div className="w-full max-w-xs space-y-2">
                <div>
                  <Button type="button" variant="outline" size="sm" className="w-full gap-1" onClick={() => setShowIcons(!showIcons)}>
                    {icon ? `${icon} Changer d'icône` : "Choisir une icône"}
                  </Button>
                  {showIcons && (
                    <div className="mt-2 grid grid-cols-8 gap-1 rounded-md border border-border p-2">
                      {EMOJIS.map((e) => (
                        <button
                          key={e}
                          type="button"
                          className={`flex h-8 w-8 items-center justify-center rounded text-lg hover:bg-muted ${icon === e ? "ring-2 ring-primary-foreground" : ""}`}
                          onClick={() => { setIcon(e); setShowIcons(false); }}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center">
                <h1 className="text-xl font-bold">{user.first_name} {user.last_name}</h1>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <div className="mt-1 flex items-center justify-center gap-2">
                  <Badge variant="secondary">
                    {{ admin: "Admin", rh: "RH", manager: "Manager", employee: "Collaborateur", stagiaire: "Stagiaire", alternant: "Alternant" }[user.role] || user.role}
                  </Badge>
                  {user.role === "admin" && (
                    <Badge variant="default" className="gap-1">
                      <Shield className="h-3 w-3" /> Admin
                    </Badge>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Connexion : Microsoft Entra ID</p>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {!editing && (
              <table className="w-full text-sm">
                <tbody>
                  <tr><td className="py-2 text-muted-foreground">Matricule</td><td className="py-2 pl-4 font-medium">{user.matricule || "—"}</td></tr>
                  <tr><td className="py-2 text-muted-foreground">Service</td><td className="py-2 pl-4 font-medium">{user.service_name || "—"}</td></tr>
                  <tr><td className="py-2 text-muted-foreground">Site</td><td className="py-2 pl-4 font-medium">{user.site_name || "—"}</td></tr>
                  <tr><td className="py-2 text-muted-foreground">Poste</td><td className="py-2 pl-4 font-medium">{user.position_name || "—"}</td></tr>
                  <tr><td className="py-2 text-muted-foreground">N+1</td><td className="py-2 pl-4 font-medium">{user.manager_name || "—"}</td></tr>
                </tbody>
              </table>
            )}
            <div className="mt-6 flex justify-end gap-2">
              {editing ? (
                <>
                  <Button variant="outline" size="sm" onClick={cancelEditing} className="gap-1">
                    <X className="h-4 w-4" /> Annuler
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1">
                    <Save className="h-4 w-4" /> {saving ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={startEditing} className="gap-1">
                  Modifier
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <h2 className="font-display text-lg font-semibold flex items-center gap-2">
              <Palette className="h-4 w-4" /> Thème
            </h2>
            <p className="text-xs text-muted-foreground">Choisissez la couleur principale du portail.</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-3">
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={async () => {
                    setTheme(t.id);
                    await api.patch("/auth/me/", { preferences: JSON.stringify({ theme: t.id }) });
                    queryClient.invalidateQueries({ queryKey: ["me"] });
                  }}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-2 transition-colors ${
                    theme.id === t.id ? "border-primary bg-secondary" : "border-border bg-transparent hover:bg-muted/50"
                  }`}
                  title={t.label}
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-md text-lg"
                    style={{ backgroundColor: `hsl(${t.hue} 100% 12%)` }}
                  >
                    <span className="opacity-90">{t.icon}</span>
                  </div>
                  <span className={`text-[10px] ${theme.id === t.id ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
