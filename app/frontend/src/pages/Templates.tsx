import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Plus, Copy, Trash2, Upload, FileUp } from "lucide-react";
import { Toast, useToast } from "../components/Toast";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import AppLayout from "../components/AppLayout";
import LoadingScreen from "../components/LoadingScreen";
import ErrorScreen from "../components/ErrorScreen";
import ConfirmDialog from "../components/ConfirmDialog";
import api from "../api";
import type { InterviewTemplate, AnswerList } from "../types";

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
  const [showLists, setShowLists] = useState(false);
  const [editingList, setEditingList] = useState<{ id: number | null; name: string; itemsText: string } | null>(null);
  const [deleteListId, setDeleteListId] = useState<number | null>(null);
  const listsFileRef = useRef<HTMLInputElement>(null);
  const objectifsFileRef = useRef<HTMLInputElement>(null);
  const { toast, show, setToast } = useToast();

  const { data: templates, isLoading, error, refetch } = useQuery<InterviewTemplate[]>({
    queryKey: ["interview-templates"],
    queryFn: () => api.get("/interview-templates/").then((r) => r.data),
    enabled: !showLists,
  });

  const { data: answerLists, isLoading: listsLoading, error: listsError, refetch: refetchLists } = useQuery<AnswerList[]>({
    queryKey: ["answer-lists"],
    queryFn: () => api.get("/answer-lists/").then((r) => r.data),
    enabled: showLists,
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

  const handleSaveList = async () => {
    if (!editingList) return;
    const name = editingList.name.trim();
    if (!name) return;
    const items = editingList.itemsText
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean);
    if (editingList.id !== null) {
      await api.put(`/answer-lists/${editingList.id}/`, { name, items });
    } else {
      await api.post("/answer-lists/", { name, items });
    }
    setEditingList(null);
    queryClient.invalidateQueries({ queryKey: ["answer-lists"] });
  };

  const handleDeleteList = async () => {
    if (deleteListId === null) return;
    await api.delete(`/answer-lists/${deleteListId}/`);
    setDeleteListId(null);
    queryClient.invalidateQueries({ queryKey: ["answer-lists"] });
  };

  const handleImportListsCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    const res = await api.post("/answer-lists/import_csv/", form);
    const msg = `${res.data.created} liste(s) créée(s), ${res.data.updated} mise(s) à jour${res.data.errors?.length ? " — " + res.data.errors.slice(0, 3).join(", ") : ""}`;
    show(msg, res.data.errors?.length ? "error" : "success");
    queryClient.invalidateQueries({ queryKey: ["answer-lists"] });
    e.target.value = "";
  };

  const handleImportObjectifsAEvaluer = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    const res = await api.post("/interviews/import_objectifs_a_evaluer/", form);
    const msg = `${res.data.created} objectif(s) importé(s)${res.data.skipped ? `, ${res.data.skipped} déjà présent(s) ignoré(s)` : ""}${res.data.errors?.length ? " — " + res.data.errors.slice(0, 3).join(", ") + (res.data.errors.length > 3 ? "..." : "") : ""}`;
    show(msg, res.data.errors?.length ? "error" : "success");
    e.target.value = "";
  };

  if (showLists ? listsLoading : isLoading) return <LoadingScreen />;
  if (showLists && listsError) return <ErrorScreen message="Impossible de charger les listes" onRetry={refetchLists} />;
  if (!showLists && error) return <ErrorScreen message="Impossible de charger les modèles" onRetry={refetch} />;

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">{showLists ? "Listes de choix" : "Modèles d'entretien"}</h1>
        <div className="flex gap-2">
          {showLists ? (
            <>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-white px-4 py-2 text-sm font-medium hover:bg-secondary">
                <Upload className="h-4 w-4" />
                Importer des listes de choix
                <input ref={listsFileRef} type="file" accept=".csv" onChange={handleImportListsCsv} hidden />
              </label>
              <Button onClick={() => setEditingList({ id: null, name: "", itemsText: "" })} className="gap-2">
                <Plus className="h-4 w-4" />
                Nouvelle liste
              </Button>
            </>
          ) : (
            <>
              <label
                className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-white px-4 py-2 text-sm font-medium hover:bg-secondary"
                title="Colonnes attendues : Matricule, Définition, Thème, Date de réalisation. Ajoute au tableau 'Objectif à définir' de l'entretien le plus récent du collaborateur."
              >
                <FileUp className="h-4 w-4" />
                Importer objectifs à évaluer
                <input ref={objectifsFileRef} type="file" accept=".csv" onChange={handleImportObjectifsAEvaluer} hidden />
              </label>
              <Button onClick={() => navigate("/templates/new")} className="gap-2">
                <Plus className="h-4 w-4" />
                Nouveau modèle
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        {!showLists && (
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
        )}
        <div className="inline-flex rounded-md border border-border">
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${!showLists ? "bg-primary-foreground text-primary" : "bg-white text-muted-foreground hover:bg-muted/50"}`}
            onClick={() => setShowLists(false)}
          >
            Modèles
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${showLists ? "bg-primary-foreground text-primary" : "bg-white text-muted-foreground hover:bg-muted/50"}`}
            onClick={() => setShowLists(true)}
          >
            Listes
          </button>
        </div>
      </div>

      {editingList && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>{editingList.id !== null ? "Modifier la liste" : "Nouvelle liste"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Nom de la liste</label>
              <Input
                value={editingList.name}
                onChange={(e) => setEditingList({ ...editingList, name: e.target.value })}
                placeholder="Ex: Compétences"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Éléments (un par ligne)</label>
              <textarea
                value={editingList.itemsText}
                onChange={(e) => setEditingList({ ...editingList, itemsText: e.target.value })}
                rows={8}
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                placeholder={"Communication\nLeadership\nRigueur"}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingList(null)}>
                Annuler
              </Button>
              <Button type="button" onClick={handleSaveList}>
                Enregistrer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!showLists && (
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
      )}

      {showLists && (
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase text-muted-foreground">
                <th className="px-6 pb-3 pt-4">Nom</th>
                <th className="px-6 pb-3 pt-4">Éléments</th>
                <th className="px-6 pb-3 pt-4"></th>
              </tr>
            </thead>
            <tbody>
              {answerLists?.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-sm text-muted-foreground">
                    Aucune liste. Créez-en une ou importez un CSV.
                  </td>
                </tr>
              )}
              {answerLists?.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="px-6 py-3 text-sm font-medium">{l.name}</td>
                  <td className="px-6 py-3 text-sm text-muted-foreground max-w-md truncate">
                    {l.items.join(", ") || "-"}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingList({ id: l.id, name: l.name, itemsText: l.items.join("\n") })}
                      >
                        Modifier
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteListId(l.id)} title="Supprimer">
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
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title="Supprimer le modèle"
        message="Êtes-vous sûr de vouloir supprimer ce modèle ? Cette action est irréversible."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />

      <ConfirmDialog
        open={deleteListId !== null}
        title="Supprimer la liste"
        message="Êtes-vous sûr de vouloir supprimer cette liste ? Les questions qui l'utilisent n'auront plus de choix à afficher."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        onConfirm={handleDeleteList}
        onCancel={() => setDeleteListId(null)}
      />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </AppLayout>
  );
}
