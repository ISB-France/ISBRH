import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Download, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import ConfirmDialog from "../components/ConfirmDialog";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import AppLayout from "../components/AppLayout";
import LoadingScreen from "../components/LoadingScreen";
import ErrorScreen from "../components/ErrorScreen";
import api from "../api";
import type { Campaign, InterviewTemplate, User } from "../types";
import { formatDate } from "../lib/utils";

const typeLabel: Record<string, string> = {
  annual: "Évaluation",
  professional: "Professionnel",
  bilan: "Bilan",
  forfait: "Forfait jours",
  fin_carriere: "Fin de carrière",
};

export default function Campaigns() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
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

  const { data: currentUser } = useQuery<User>({
    queryKey: ["me"],
    queryFn: () => api.get("/auth/me/").then((r) => r.data),
  });

  const { data: campaigns, isLoading, error, refetch } = useQuery<Campaign[]>({
    queryKey: ["campaigns"],
    queryFn: () => api.get("/campaigns/").then((r) => r.data),
  });

  const { data: templates } = useQuery<InterviewTemplate[]>({
    queryKey: ["interview-templates"],
    queryFn: () => api.get("/interview-templates/").then((r) => r.data),
  });

  const templateTypeMap = new Map((templates || []).map((t) => [t.id, t.type]));

  const today = new Date().toISOString().slice(0, 10);
  const filtered = campaigns?.filter((c) => {
    if (showHistory ? c.due_date >= today : c.due_date < today) return false;
    if (typeFilter && templateTypeMap.get(c.template ?? -1) !== typeFilter) return false;
    return true;
  });

  const displayed = useMemo(() => {
    if (!filtered || !sortField) return filtered;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (sortField === "period") {
        cmp = a.start_date.localeCompare(b.start_date);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir]);

  const handleExportXlsx = async () => {
    const ids = selectedIds.length > 0 ? selectedIds : filtered?.map((c) => c.id) || [];
    if (ids.length === 0) return;
    const res = await api.get("/campaigns/export_xlsx/", {
      params: { campaign_ids: ids },
      responseType: "blob",
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "export_entretiens.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorScreen message="Impossible de charger les campagnes" onRetry={refetch} />;

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Campagnes</h1>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <Button variant="outline" onClick={handleExportXlsx} className="gap-2">
              <Download className="h-4 w-4" />
              Exporter synthèse ({selectedIds.length})
            </Button>
          )}
          {(currentUser?.role === "admin" || currentUser?.role === "rh") && (
            <Button onClick={() => navigate("/campaigns/new")} className="gap-2">
              <Plus className="h-4 w-4" />
              Nouvelle campagne
            </Button>
          )}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-10 rounded-md border border-border bg-white px-3 text-sm"
        >
          <option value="">Tous les types</option>
          {Object.entries(typeLabel).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <div className="inline-flex rounded-md border border-border">
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${!showHistory ? "bg-primary-foreground text-primary" : "bg-white text-muted-foreground hover:bg-muted/50"}`}
            onClick={() => setShowHistory(false)}
          >
            En cours
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${showHistory ? "bg-primary-foreground text-primary" : "bg-white text-muted-foreground hover:bg-muted/50"}`}
            onClick={() => setShowHistory(true)}
          >
            Historique
          </button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase text-muted-foreground">
                <th className="px-4 pb-3 pt-4 w-10">
                  <input
                    type="checkbox"
                    checked={filtered !== undefined && filtered.length > 0 && selectedIds.length === filtered.length}
                    onChange={() => {
                      if (!filtered) return;
                      setSelectedIds(selectedIds.length === filtered.length ? [] : filtered.map((c) => c.id));
                    }}
                    className="h-4 w-4"
                  />
                </th>
                <th className="px-6 pb-3 pt-4 cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("name")}>
                  <div className="flex items-center gap-1">
                    Nom
                    {sortField === "name" ? (
                      sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </div>
                </th>
                <th className="px-6 pb-3 pt-4">Type</th>
                <th className="px-6 pb-3 pt-4 cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("period")}>
                  <div className="flex items-center gap-1">
                    Période
                    {sortField === "period" ? (
                      sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </div>
                </th>
                <th className="px-6 pb-3 pt-4">Entretiens</th>
                <th className="px-6 pb-3 pt-4"></th>
              </tr>
            </thead>
            <tbody>
              {filtered?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-muted-foreground">
                    {showHistory ? "Aucune campagne passée" : "Aucune campagne en cours"}
                  </td>
                </tr>
              )}
              {displayed?.map((c) => {
                const tType = templateTypeMap.get(c.template ?? -1);
                return (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(c.id)}
                      onChange={() =>
                        setSelectedIds((prev) =>
                          prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id],
                        )
                      }
                      className="h-4 w-4"
                    />
                  </td>
                  <td className="px-6 py-3">
                    <button className="text-sm font-medium hover:underline" onClick={() => navigate(`/campaigns/${c.id}`)}>
                      {c.name}
                    </button>
                  </td>
                  <td className="px-6 py-3">
                    {tType ? (
                      <Badge variant={tType as "annual" | "professional" | "bilan" | "forfait" | "fin_carriere"}>
                        {typeLabel[tType]}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-sm text-muted-foreground">
                    {formatDate(c.start_date)} → {formatDate(c.due_date)}
                  </td>
                  <td className="px-6 py-3">
                    <Badge variant="secondary">{c.interview_count}</Badge>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-1">
                      {(currentUser?.role === "admin" || currentUser?.role === "rh") && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/campaigns/${c.id}/edit`)}>
                            Modifier
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteId(c.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteId !== null}
        title="Supprimer la campagne"
        message="Êtes-vous sûr de vouloir supprimer cette campagne ? Les entretiens liés seront également supprimés."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        onConfirm={async () => { if (deleteId) { await api.delete(`/campaigns/${deleteId}/`); queryClient.invalidateQueries({ queryKey: ["campaigns"] }); } setDeleteId(null); }}
        onCancel={() => setDeleteId(null)}
      />
    </AppLayout>
  );
}
