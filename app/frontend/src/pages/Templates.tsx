import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Plus, Copy, Trash2, Upload, Download, FileUp } from "lucide-react";
import { useRef } from "react";
import { Toast, useToast } from "../components/Toast";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import AppLayout from "../components/AppLayout";
import LoadingScreen from "../components/LoadingScreen";
import ErrorScreen from "../components/ErrorScreen";
import ConfirmDialog from "../components/ConfirmDialog";
import api from "../api";
import type { InterviewTemplate } from "../types";

const typeLabel: Record<string, string> = {
  annual: "Évaluation",
  professional: "Professionnel",
  bilan: "Bilan",
  forfait: "Forfait jours",
  fin_carriere: "Fin de carrière",
};

export default function Templates() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { toast, show, setToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const historiqueFileRef = useRef<HTMLInputElement>(null);
  const [historiqueTemplateId, setHistoriqueTemplateId] = useState<number | null>(null);

  const { data: templates, isLoading, error, refetch } = useQuery<InterviewTemplate[]>({
    queryKey: ["interview-templates"],
    queryFn: () => api.get("/interview-templates/").then((r) => r.data),
  });

  const filtered = templates?.filter((t) => !typeFilter || t.type === typeFilter);

  const handleDuplicate = async (t: InterviewTemplate) => {
    await api.post("/interview-templates/", {
      name: `${t.name} (Copie)`,
      type: t.type,
      description: t.description,
      sections: t.sections,
    });
    queryClient.invalidateQueries({ queryKey: ["interview-templates"] });
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    await api.delete(`/interview-templates/${deleteId}/`);
    setDeleteId(null);
    queryClient.invalidateQueries({ queryKey: ["interview-templates"] });
  };

  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    const res = await api.post("/interview-templates/import_csv/", form);
    const msg = `${res.data.created} modèle(s) importé(s)${res.data.errors?.length ? " — " + res.data.errors.slice(0, 3).join(", ") + (res.data.errors.length > 3 ? "..." : "") : ""}`;
    show(msg, res.data.errors?.length ? "error" : "success");
    queryClient.invalidateQueries({ queryKey: ["interview-templates"] });
    e.target.value = "";
  };

  const handleDownloadGrid = async (t: InterviewTemplate) => {
    const res = await api.get(`/interview-templates/${t.id}/import_historique_grid/`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `import_historique_${t.name}.xlsx`.replace(/\s+/g, "_");
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportHistorique = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || historiqueTemplateId === null) return;
    const form = new FormData();
    form.append("file", file);
    form.append("template", String(historiqueTemplateId));
    const res = await api.post("/interviews/import_historique/", form);
    const msg = `${res.data.created} entretien(s) importé(s)${res.data.errors?.length ? " — " + res.data.errors.slice(0, 3).join(", ") + (res.data.errors.length > 3 ? "..." : "") : ""}`;
    show(msg, res.data.errors?.length ? "error" : "success");
    e.target.value = "";
    setHistoriqueTemplateId(null);
  };

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorScreen message="Impossible de charger les modèles" onRetry={refetch} />;

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Modèles d'entretien</h1>
        <div className="flex gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-white px-4 py-2 text-sm font-medium hover:bg-secondary">
            <Upload className="h-4 w-4" />
            Importer CSV
            <input ref={fileRef} type="file" accept=".csv" onChange={handleImportCsv} hidden />
          </label>
          <Button onClick={() => navigate("/templates/new")} className="gap-2">
            <Plus className="h-4 w-4" />
            Nouveau modèle
          </Button>
        </div>
      </div>

      <div className="mb-4">
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
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase text-muted-foreground">
                <th className="px-6 pb-3 pt-4">Nom</th>
                <th className="px-6 pb-3 pt-4">Type</th>
                <th className="px-6 pb-3 pt-4">Sections</th>
                <th className="px-6 pb-3 pt-4">Description</th>
                <th className="px-6 pb-3 pt-4"></th>
              </tr>
            </thead>
            <tbody>
              {filtered?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-muted-foreground">
                    Aucun modèle trouvé
                  </td>
                </tr>
              )}
              {filtered?.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0">
                  <td className="px-6 py-3 text-sm font-medium">{t.name}</td>
                  <td className="px-6 py-3">
                    <Badge variant={t.type as "annual" | "professional" | "bilan" | "forfait" | "fin_carriere"}>
                      {typeLabel[t.type]}
                    </Badge>
                  </td>
                  <td className="px-6 py-3 text-sm">{t.sections?.length ?? 0}</td>
                  <td className="px-6 py-3 text-sm text-muted-foreground max-w-xs truncate">
                    {t.description || "-"}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleDownloadGrid(t)} title="Télécharger la grille d'import historique">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setHistoriqueTemplateId(t.id); historiqueFileRef.current?.click(); }}
                        title="Importer des entretiens historiques"
                      >
                        <FileUp className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDuplicate(t)} title="Dupliquer">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/templates/${t.id}/edit`)}>
                        Modifier
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteId(t.id)} title="Supprimer">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>

      <input ref={historiqueFileRef} type="file" accept=".csv" onChange={handleImportHistorique} hidden />

      <ConfirmDialog
        open={deleteId !== null}
        title="Supprimer le modèle"
        message="Êtes-vous sûr de vouloir supprimer ce modèle ? Cette action est irréversible."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </AppLayout>
  );
}
