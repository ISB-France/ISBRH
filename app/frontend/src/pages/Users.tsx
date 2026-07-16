import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Search, Upload, Download, Eye, EyeOff, ShieldPlus, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import AppLayout from "../components/AppLayout";
import LoadingScreen from "../components/LoadingScreen";
import ErrorScreen from "../components/ErrorScreen";
import ConfirmDialog from "../components/ConfirmDialog";
import { Toast, useToast } from "../components/Toast";
import api from "../api";
import type { User, Site } from "../types";

const roleLabel: Record<string, string> = {
  admin: "Admin",
  rh: "RH",
  manager: "Manager",
  employee: "Employé",
  stagiaire: "Stagiaire",
  alternant: "Alternant",
};

export default function Users() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [promoteTarget, setPromoteTarget] = useState<User | null>(null);
  const [managerId, setManagerId] = useState<string>("");
  const [siteId, setSiteId] = useState<string>("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importType, setImportType] = useState<"users" | "formations" | "augmentations" | "collaborateurs" | "evolutions">("users");
  const { toast, show, setToast } = useToast();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(searchInput), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  const { data: currentUser } = useQuery<User>({
    queryKey: ["me"],
    queryFn: () => api.get("/auth/me/").then((r) => r.data),
  });

  const { data: users, isFetching, isLoading, error, refetch } = useQuery<User[]>({
    queryKey: ["users", managerId, siteId, search, showInactive],
    queryFn: () =>
      api
        .get("/users/", {
          params: {
            manager: managerId || undefined,
            site: siteId || undefined,
            search: search || undefined,
            show_all_statuts: showInactive || undefined,
          },
        })
        .then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  const displayed = useMemo(() => {
    if (!users || !sortField) return users;
    return [...users].sort((a, b) => {
      let cmp = 0;
      if (sortField === "user") {
        const aName = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim();
        const bName = `${b.first_name ?? ""} ${b.last_name ?? ""}`.trim();
        cmp = aName.localeCompare(bName);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [users, sortField, sortDir]);

  const { data: allUsers } = useQuery<User[]>({
    queryKey: ["users-all"],
    queryFn: () => api.get("/users/").then((r) => r.data),
  });

  const getAllDescendants = (userId: number, all: User[], visited?: Set<number>): User[] => {
    const seen = visited ?? new Set<number>();
    if (seen.has(userId)) return [];
    seen.add(userId);
    const direct = all.filter((e) => e.manager === userId && !seen.has(e.id));
    return [...direct, ...direct.flatMap((d) => getAllDescendants(d.id, all, seen))];
  };

  const currentManager = allUsers?.find((u) => String(u.id) === managerId);

  const { data: sites } = useQuery<Site[]>({
    queryKey: ["sites"],
    queryFn: () => api.get("/sites/").then((r) => r.data),
  });

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const form = new FormData();
    form.append("file", file);

    const endpoints: Record<string, string> = {
      users: "/users/import_kostango/",
      formations: "/users/import_formations/",
      augmentations: "/users/import_augmentations/",
      collaborateurs: "/users/import_collaborateurs/",
      evolutions: "/users/import_evolutions/",
    };

    const labels: Record<string, string> = {
      users: "utilisateurs",
      formations: "formations",
      augmentations: "augmentations",
      collaborateurs: "collaborateurs",
      evolutions: "évolutions",
    };

    try {
      const resp = await api.post(endpoints[importType], form);
      const msg = `${resp.data.created} ${labels[importType]} importé(s)${resp.data.errors?.length ? " — " + resp.data.errors.slice(0, 3).join(", ") + (resp.data.errors.length > 3 ? "..." : "") : ""}`;
      show(msg, resp.data.errors?.length ? "error" : "success");
      if (importType === "users" || importType === "collaborateurs") refetch();
    } catch (err) {
      console.error(err);
    }
    setImporting(false);
    e.target.value = "";
  };

  const handlePromoteToAdmin = async () => {
    if (!promoteTarget) return;
    try {
      await api.post(`/users/${promoteTarget.id}/promote_to_admin/`);
      show(`${promoteTarget.first_name} ${promoteTarget.last_name} est maintenant admin`, "success");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (err) {
      console.error(err);
      show("Impossible de promouvoir cet utilisateur", "error");
    }
    setPromoteTarget(null);
  };

  const handleExportHistory = async (u: User) => {
    const res = await api.get(`/users/${u.id}/export_history_xlsx/`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historique_${u.last_name}_${u.first_name}_6ans.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading && !users) return <LoadingScreen />;
  if (error) return <ErrorScreen message="Impossible de charger les utilisateurs" onRetry={refetch} />;

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Utilisateurs</h1>
        {(currentUser?.role === "rh" || currentUser?.role === "admin") && (
          <div className="flex gap-2">
            <select
              value={importType}
              onChange={(e) => setImportType(e.target.value as "users" | "formations" | "augmentations" | "collaborateurs" | "evolutions")}
              className="h-10 rounded-md border border-border bg-white px-3 text-sm"
            >
              <option value="users">Import utilisateurs</option>
              <option value="collaborateurs">Import évolution professionnelle</option>
              <option value="formations">Import formations</option>
              <option value="augmentations">Import augmentations</option>
              <option value="evolutions">Import évolutions (historique)</option>
            </select>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-white px-4 py-2 text-sm font-medium hover:bg-secondary">
              <Upload className="h-4 w-4" />
              {importing ? "Import..." : "Importer"}
              <input type="file" accept=".csv" onChange={handleImport} hidden />
            </label>
            <Button onClick={() => navigate("/users/new")} className="gap-2">
              <Plus className="h-4 w-4" />
              Nouvel utilisateur
            </Button>
          </div>
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, prénom, email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          className="h-10 rounded-md border border-border bg-white px-3 text-sm"
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
        >
          <option value="">Tous les sites</option>
          {sites?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {(currentUser?.role === "rh" || currentUser?.role === "admin") && (
          <Button
            variant={showInactive ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => setShowInactive(!showInactive)}
          >
            {showInactive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showInactive ? "Masquer inactifs" : "Afficher inactifs"}
          </Button>
        )}
      </div>

      {managerId && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => setManagerId("")}>
            <ArrowLeft className="h-4 w-4" />
            Tous
          </Button>
          {currentManager?.manager_name && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1"
              onClick={() => setManagerId(String(currentManager.manager!))}
            >
              <ArrowLeft className="h-4 w-4" />
              {currentManager.manager_name}
            </Button>
          )}
          <span className="text-muted-foreground">
            N-1 de {currentManager ? (currentManager.first_name || currentManager.last_name ? `${currentManager.first_name} ${currentManager.last_name}` : currentManager.email) : ""}
          </span>
        </div>
      )}

      <Card>
        <CardContent className="p-0 relative">
          {isFetching && (
            <div className="absolute right-4 top-4 z-10">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase text-muted-foreground">
                <th className="px-6 pb-3 pt-4 cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("user")}>
                  <div className="flex items-center gap-1">
                    Utilisateur
                    {sortField === "user" ? (
                      sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </div>
                </th>
                <th className="px-6 pb-3 pt-4">Rôle</th>
                <th className="px-6 pb-3 pt-4">Site</th>
                <th className="px-6 pb-3 pt-4">Service</th>
                <th className="px-6 pb-3 pt-4">Poste</th>
                <th className="px-6 pb-3 pt-4">Manager</th>
                <th className="px-6 pb-3 pt-4">N-1</th>
                {(currentUser?.role === "rh" || currentUser?.role === "admin") && <th className="px-6 pb-3 pt-4"></th>}
              </tr>
            </thead>
            <tbody>
              {users?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-muted-foreground">
                    Aucun utilisateur trouvé
                  </td>
                </tr>
              )}
              {displayed?.map((u) => {
                const subordinates = allUsers ? getAllDescendants(u.id, allUsers) : [];
                const hasSubordinates = subordinates.length > 0;
                const maxAvatars = 3;
                const visible = subordinates.slice(0, maxAvatars);
                const extra = subordinates.length - maxAvatars;
                return (
                  <tr
                    key={u.id}
                    className={`border-b border-border last:border-0 ${hasSubordinates ? "cursor-pointer hover:bg-muted/50" : ""} ${u.statut !== "actif" ? "opacity-50" : ""}`}
                    onClick={() => hasSubordinates && setManagerId(String(u.id))}
                  >
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary-foreground text-primary text-xs font-semibold">
                            {(u.first_name?.[0] ?? "") + (u.last_name?.[0] ?? "") || u.email[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">
                            {u.first_name} {u.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-1.5">
                        <Badge variant={u.role === "rh" || u.role === "admin" ? "default" : u.role === "manager" ? "secondary" : "outline"}>
                          {roleLabel[u.role]}
                        </Badge>
                        {u.statut === "inactif" && (
                          <Badge variant="outline" className="border-orange-300 text-orange-600">Inactif</Badge>
                        )}
                        {u.statut === "sortie" && (
                          <Badge variant="outline" className="border-red-300 text-red-600">Sorti</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-sm">{u.site_name || "-"}</td>
                    <td className="px-6 py-3 text-sm">{u.service_name || "-"}</td>
                    <td className="px-6 py-3 text-sm">{u.position_name || "-"}</td>
                    <td className="px-6 py-3 text-sm text-muted-foreground">{u.manager_name || "-"}</td>
                    <td className="px-6 py-3">
                      {hasSubordinates ? (
                        <div className="flex items-center">
                          <div className="flex [&>*+*]:-ml-2.5">
                            {visible.map((sub) => (
                              <Avatar key={sub.id} className="h-7 w-7 border-2 border-white">
                                <AvatarFallback className="bg-isb-yellow/70 text-isb-brown text-[10px] font-semibold">
                                  {(sub.first_name?.[0] ?? "") + (sub.last_name?.[0] ?? "") || sub.email[0].toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            {extra > 0 && (
                              <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-muted text-[10px] font-medium text-muted-foreground">
                                +{extra}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : "-"}
                    </td>
                    {(currentUser?.role === "rh" || currentUser?.role === "admin") && (
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/users/${u.id}/edit`); }}>
                            Modifier
                          </Button>
                          <Button variant="ghost" size="sm" title="Exporter l'historique (6 ans)" onClick={(e) => { e.stopPropagation(); handleExportHistory(u); }}>
                            <Download className="h-4 w-4" />
                          </Button>
                          {currentUser?.role === "admin" && u.role !== "admin" && (
                            <Button variant="ghost" size="sm" title="Promouvoir admin" onClick={(e) => { e.stopPropagation(); setPromoteTarget(u); }}>
                              <ShieldPlus className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <ConfirmDialog
        open={promoteTarget !== null}
        title="Promouvoir administrateur"
        message={promoteTarget ? `Donner les droits administrateur à ${promoteTarget.first_name} ${promoteTarget.last_name} ? Cette personne aura un accès complet à l'outil.` : ""}
        confirmLabel="Promouvoir"
        cancelLabel="Annuler"
        onConfirm={handlePromoteToAdmin}
        onCancel={() => setPromoteTarget(null)}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </AppLayout>
  );
}
