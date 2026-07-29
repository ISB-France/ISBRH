import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Play, Trash2, Download, FileText, RefreshCw } from "lucide-react";
import ConfirmDialog from "../components/ConfirmDialog";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import AppLayout from "../components/AppLayout";
import LoadingScreen from "../components/LoadingScreen";
import ErrorScreen from "../components/ErrorScreen";
import { Toast, useToast } from "../components/Toast";
import api from "../api";
import type { Campaign, Interview } from "../types";
import { formatDate } from "../lib/utils";

const statusLabel: Record<string, string> = {
  draft: "Brouillon",
  in_progress: "En cours",
  completed: "Terminé",
  signed: "Signé",
  cancelled: "Annulé",
};

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const { toast, show, setToast } = useToast();

  const { data: campaign, isLoading, error } = useQuery<Campaign>({
    queryKey: ["campaign", id],
    queryFn: () => api.get(`/campaigns/${id}/`).then((r) => r.data),
  });

  const { data: interviews } = useQuery<Interview[]>({
    queryKey: ["interviews", "campaign", id],
    queryFn: () => api.get("/interviews/", { params: { campaign: id } }).then((r) => r.data),
  });

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.post(`/campaigns/${id}/generate/`);
      queryClient.invalidateQueries({ queryKey: ["campaign", id] });
      queryClient.invalidateQueries({ queryKey: ["interviews", "campaign", id] });
      show(`${res.data.created} entretien(s) généré(s) sur ${res.data.total}`, "success");
    } catch (err) {
      console.error(err);
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        || "Erreur lors de la génération des entretiens";
      show(message, "error");
    }
    setGenerating(false);
  };

  const handleExportCsv = async () => {
    const res = await api.get("/interviews/export_csv/", {
      params: { campaign_id: id },
      responseType: "blob",
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `entretiens_${campaign?.name || id}.csv`.replace(/\s+/g, "_");
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportContentsXlsx = async () => {
    const res = await api.get(`/campaigns/${id}/export_contents_xlsx/`, {
      responseType: "blob",
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contenus_${campaign?.name || id}.xlsx`.replace(/\s+/g, "_");
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReassignManagers = async () => {
    await api.post(`/campaigns/${id}/reassign_managers/`);
    queryClient.invalidateQueries({ queryKey: ["interviews", "campaign", id] });
  };

  const toggleSelect = (ivId: number) => {
    setSelectedIds((prev) =>
      prev.includes(ivId) ? prev.filter((x) => x !== ivId) : [...prev, ivId],
    );
  };

  const toggleAll = () => {
    if (!interviews) return;
    setSelectedIds(selectedIds.length === interviews.length ? [] : interviews.map((iv) => iv.id));
  };

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorScreen message="Campagne introuvable" />;

  return (
    <AppLayout>
      <Button variant="ghost" className="mb-4 gap-2" onClick={() => navigate("/campaigns")}>
        <ArrowLeft className="h-4 w-4" />
        Retour
      </Button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">{campaign?.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate(campaign?.start_date)} → {formatDate(campaign?.due_date)}
            {campaign?.description && <> · {campaign.description}</>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleGenerate} disabled={generating} className="gap-2">
            <Play className="h-4 w-4" />
            {generating ? "Génération..." : "Générer les entretiens"}
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
            <Trash2 className="mr-1 h-4 w-4" />
            Supprimer
          </Button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <Badge variant="secondary">{campaign?.interview_count ?? 0} entretien{(campaign?.interview_count ?? 0) > 1 ? "s" : ""}</Badge>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Entretiens générés</CardTitle>
          <div className="flex gap-2">
            {selectedIds.length > 0 && (
              <Button variant="destructive" size="sm" onClick={() => setShowBulkDeleteConfirm(true)}>
                <Trash2 className="mr-1 h-4 w-4" />
                Supprimer ({selectedIds.length})
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleReassignManagers}>
              <RefreshCw className="mr-1 h-4 w-4" />
              Rafraîchir
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportContentsXlsx}>
              <FileText className="mr-1 h-4 w-4" />
              Exporter contenus
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="mr-1 h-4 w-4" />
              Exporter CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowDeleteAllConfirm(true)}>
              <Trash2 className="mr-1 h-4 w-4" />
              Tout supprimer
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase text-muted-foreground">
                <th className="px-4 pb-3 pt-4 w-10">
                  <input
                    type="checkbox"
                    checked={interviews !== undefined && interviews.length > 0 && selectedIds.length === interviews.length}
                    onChange={toggleAll}
                    className="h-4 w-4"
                  />
                </th>
                <th className="px-6 pb-3 pt-4">Collaborateur</th>
                <th className="px-6 pb-3 pt-4">Statut</th>
                <th className="px-6 pb-3 pt-4">Date limite</th>
                <th className="px-6 pb-3 pt-4"></th>
              </tr>
            </thead>
            <tbody>
              {interviews?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-muted-foreground">
                    Aucun entretien généré. Cliquez sur "Générer les entretiens".
                  </td>
                </tr>
              )}
              {interviews?.map((iv) => (
                <tr
                  key={iv.id}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
                  onClick={() => navigate(`/interviews/${iv.id}`)}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(iv.id)}
                      onChange={() => toggleSelect(iv.id)}
                      className="h-4 w-4"
                    />
                  </td>
                  <td className="px-6 py-3 text-sm font-medium">
                    {iv.employee_detail?.first_name} {iv.employee_detail?.last_name}
                  </td>
                  <td className="px-6 py-3">
                    <Badge variant={iv.status as "draft" | "in_progress" | "completed" | "signed" | "cancelled"}>
                      {statusLabel[iv.status]}
                    </Badge>
                  </td>
                  <td className="px-6 py-3 text-sm">{formatDate(iv.due_date)}</td>
                  <td className="px-6 py-3">
                    <Button variant="ghost" size="sm">Voir</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Supprimer la campagne"
        message="Êtes-vous sûr de vouloir supprimer cette campagne ? Les entretiens liés seront également supprimés."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        onConfirm={async () => { setShowDeleteConfirm(false); await api.delete(`/campaigns/${id}/`); navigate("/campaigns"); }}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <ConfirmDialog
        open={showDeleteAllConfirm}
        title="Supprimer tous les entretiens"
        message="Êtes-vous sûr de vouloir supprimer tous les entretiens de cette campagne ? Cette action est irréversible."
        confirmLabel="Tout supprimer"
        cancelLabel="Annuler"
        onConfirm={async () => {
          setShowDeleteAllConfirm(false);
          await api.post(`/campaigns/${id}/delete_all_interviews/`);
          setSelectedIds([]);
          queryClient.invalidateQueries({ queryKey: ["campaign", id] });
          queryClient.invalidateQueries({ queryKey: ["interviews", "campaign", id] });
        }}
        onCancel={() => setShowDeleteAllConfirm(false)}
      />

      <ConfirmDialog
        open={showBulkDeleteConfirm}
        title="Supprimer la sélection"
        message={`Êtes-vous sûr de vouloir supprimer ${selectedIds.length} entretien${selectedIds.length > 1 ? "s" : ""} ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        onConfirm={async () => {
          setShowBulkDeleteConfirm(false);
          await api.post("/interviews/bulk_delete/", { ids: selectedIds });
          setSelectedIds([]);
          queryClient.invalidateQueries({ queryKey: ["campaign", id] });
          queryClient.invalidateQueries({ queryKey: ["interviews", "campaign", id] });
        }}
        onCancel={() => setShowBulkDeleteConfirm(false)}
      />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </AppLayout>
  );
}
