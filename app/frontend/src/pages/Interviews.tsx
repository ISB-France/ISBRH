import { useState, useRef, useMemo } from "react";
import { useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Plus, Download, Trash2, Upload, FileUp, X, CalendarIcon, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Calendar } from "../components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "../components/ui/popover";
import AppLayout from "../components/AppLayout";
import LoadingScreen from "../components/LoadingScreen";
import ErrorScreen from "../components/ErrorScreen";
import ConfirmDialog from "../components/ConfirmDialog";
import { Toast, useToast } from "../components/Toast";
import api from "../api";
import type { Interview, User } from "../types";
import { formatDate } from "../lib/utils";

const interviewTypeLabel: Record<string, string> = {
  annual: "Évaluation",
  professional: "Professionnel",
  bilan: "Bilan",
  forfait: "Forfait jours",
  fin_carriere: "Fin de carrière",
};

const filenameFromContentDisposition = (contentDisposition: string | undefined, fallback: string) => {
  const match = contentDisposition?.match(/filename="?([^"]+)"?/);
  return match ? match[1] : fallback;
};

const downloadPdf = async (id: number) => {
  const res = await api.get(`/interviews/${id}/pdf/`, { responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filenameFromContentDisposition(res.headers["content-disposition"], `entretien_${id}.pdf`);
  a.click();
  URL.revokeObjectURL(url);
};

const openPrint = async (id: number) => {
  const w = window.open("", "_blank");
  if (!w) return;
  const res = await api.get(`/interviews/${id}/print/`);
  w.document.write(res.data);
  w.document.close();
  w.focus();
};

const toIsoDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const todayRange = (): DateRange => {
  const today = new Date();
  return { from: today, to: today };
};

const statusLabel: Record<string, string> = {
  draft: "Brouillon",
  in_progress: "En cours",
  completed: "Terminé",
  signed: "Signé",
  cancelled: "Annulé",
};

interface InterviewPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: Interview[];
}

export default function Interviews() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [type, setType] = useState("");
  const [scope, setScope] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [dateRange, setDateRange] = useState<DateRange | undefined>(todayRange());
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const uploadTargetRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [historiqueType, setHistoriqueType] = useState("annual");
  const historiqueFileRef = useRef<HTMLInputElement>(null);
  const { toast, show, setToast } = useToast();

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const id = uploadTargetRef.current;
    if (!file || !id) return;
    const form = new FormData();
    form.append("document", file);
    await api.post(`/interviews/${id}/upload_document/`, form);
    queryClient.invalidateQueries({ queryKey: ["interviews"] });
    e.target.value = "";
  };

  const handleImportHistorique = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    form.append("type", historiqueType);
    const res = await api.post("/interviews/import_historique/", form);
    const msg = `${res.data.created} entretien(s) importé(s)${res.data.errors?.length ? " — " + res.data.errors.slice(0, 3).join(", ") + (res.data.errors.length > 3 ? "..." : "") : ""}`;
    show(msg, res.data.errors?.length ? "error" : "success");
    queryClient.invalidateQueries({ queryKey: ["interviews"] });
    e.target.value = "";
  };

  const { data: currentUser } = useQuery<User>({
    queryKey: ["me"],
    queryFn: () => api.get("/auth/me/").then((r) => r.data),
  });

  const statusParam = showHistory ? "completed,signed" : "draft,in_progress";

  const dateFrom = showHistory ? (year ? `${year}-01-01` : undefined) : dateRange?.from ? toIsoDate(dateRange.from) : undefined;
  const dateTo = showHistory ? (year ? `${year}-12-31` : undefined) : dateRange?.to ? toIsoDate(dateRange.to) : undefined;

  const {
    data,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<InterviewPage>({
    queryKey: ["interviews", type, scope, showHistory, dateFrom, dateTo],
    queryFn: ({ pageParam }) =>
      api.get("/interviews/", {
        params: {
          type,
          status: statusParam,
          scope: scope || undefined,
          ordering: showHistory ? "-updated_at" : undefined,
          due_date_after: dateFrom,
          due_date_before: dateTo,
          page: pageParam,
        },
      }).then((r) => r.data),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => (lastPage.next ? allPages.length + 1 : undefined),
  });

  const interviews = useMemo(() => data?.pages.flatMap((p) => p.results) ?? [], [data]);
  const total = data?.pages[0]?.count ?? 0;

  const { data: availableYears } = useQuery<number[]>({
    queryKey: ["interviews-years", type, scope],
    queryFn: () =>
      api.get("/interviews/available_years/", {
        params: { type, status: "completed,signed", scope: scope || undefined },
      }).then((r) => r.data),
    enabled: showHistory,
  });

  const displayed = useMemo(() => {
    if (!sortField) return interviews;
    return [...interviews].sort((a, b) => {
      let cmp = 0;
      if (sortField === "employee") {
        const aName = `${a.employee_detail?.first_name ?? ""} ${a.employee_detail?.last_name ?? ""}`.trim();
        const bName = `${b.employee_detail?.first_name ?? ""} ${b.employee_detail?.last_name ?? ""}`.trim();
        cmp = aName.localeCompare(bName);
      } else if (sortField === "due_date") {
        cmp = a.due_date.localeCompare(b.due_date);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [interviews, sortField, sortDir]);

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorScreen message="Impossible de charger les entretiens" onRetry={refetch} />;

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Entretiens</h1>
        {(currentUser?.role === "admin" || currentUser?.role === "rh") && (
          <div className="flex gap-2">
            <select
              value={historiqueType}
              onChange={(e) => setHistoriqueType(e.target.value)}
              className="h-10 rounded-md border border-border bg-white px-3 text-sm"
            >
              {Object.entries(interviewTypeLabel).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-white px-4 py-2 text-sm font-medium hover:bg-secondary">
              <FileUp className="h-4 w-4" />
              Importer historique
              <input ref={historiqueFileRef} type="file" accept=".csv" onChange={handleImportHistorique} hidden />
            </label>
            <Button onClick={() => navigate("/interviews/new")} className="gap-2">
              <Plus className="h-4 w-4" />
              Nouvel entretien
            </Button>
          </div>
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        {currentUser?.role === "manager" && (
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="h-10 rounded-md border border-border bg-white px-3 text-sm"
          >
            <option value="">N-1 (Équipe directe)</option>
            <option value="own">Mes entretiens</option>
            <option value="team">Toute l'équipe</option>
          </select>
        )}
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="h-10 rounded-md border border-border bg-white px-3 text-sm"
        >
          <option value="">Tous les types</option>
          <option value="annual">Évaluation</option>
          <option value="professional">Professionnel</option>
          <option value="bilan">Bilan</option>
          <option value="forfait">Forfait jours</option>
          <option value="fin_carriere">Fin de carrière</option>
        </select>
        <div className="inline-flex rounded-md border border-border">
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${!showHistory ? "bg-primary-foreground text-primary" : "bg-white text-muted-foreground hover:bg-muted/50"}`}
            onClick={() => { setShowHistory(false); setSelectedIds([]); }}
          >
            En cours
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${showHistory ? "bg-primary-foreground text-primary" : "bg-white text-muted-foreground hover:bg-muted/50"}`}
            onClick={() => { setShowHistory(true); setSelectedIds([]); }}
          >
            Historique
          </button>
        </div>
        {showHistory && (
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="h-10 rounded-md border border-border bg-white px-3 text-sm"
          >
            <option value="">Toutes les années</option>
            {availableYears?.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        )}
        {!showHistory && (
          <div className="flex items-center gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-10 gap-2 text-sm font-normal">
                  <CalendarIcon className="h-4 w-4" />
                  {dateRange?.from
                    ? dateRange.to
                      ? `${formatDate(toIsoDate(dateRange.from))} – ${formatDate(toIsoDate(dateRange.to))}`
                      : formatDate(toIsoDate(dateRange.from))
                    : "Date limite"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  defaultMonth={dateRange?.from}
                  modifiersClassNames={{
                    range_start: "rounded-l-full rounded-r-none",
                    range_end: "rounded-r-full rounded-l-none",
                    range_middle: "rounded-none",
                  }}
                  modifiersStyles={{
                    range_start: { backgroundColor: "#f6b8b8", color: "#7f1d1d" },
                    range_end: { backgroundColor: "#f6b8b8", color: "#7f1d1d" },
                    range_middle: { backgroundColor: "#fff2f2", color: "#7f1d1d" },
                  }}
                />
              </PopoverContent>
            </Popover>
            {(dateRange?.from || dateRange?.to) && (
              <Button variant="ghost" size="sm" onClick={() => setDateRange(undefined)}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
        {selectedIds.length > 0 && (
          <Button variant="destructive" size="sm" onClick={() => setShowBulkDeleteConfirm(true)}>
            <Trash2 className="mr-1 h-4 w-4" />
            Supprimer ({selectedIds.length})
          </Button>
        )}
        <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleDocumentUpload} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase text-muted-foreground">
                <th className="px-4 pb-3 pt-4 w-10">
                  {(currentUser?.role === "admin" || currentUser?.role === "rh") && (
                    <input
                      type="checkbox"
                      checked={interviews.length > 0 && selectedIds.length === interviews.length}
                      onChange={() => {
                        setSelectedIds(selectedIds.length === interviews.length ? [] : interviews.map((iv) => iv.id));
                      }}
                      className="h-4 w-4"
                    />
                  )}
                </th>
                <th className="px-6 pb-3 pt-4 cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("employee")}>
                  <div className="flex items-center gap-1">
                    Collaborateur
                    {sortField === "employee" ? (
                      sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </div>
                </th>
                <th className="px-6 pb-3 pt-4">Type</th>
                <th className="px-6 pb-3 pt-4">Modèle</th>
                <th className="px-6 pb-3 pt-4">Statut</th>
                <th className="px-6 pb-3 pt-4 cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("due_date")}>
                  <div className="flex items-center gap-1">
                    Date limite
                    {sortField === "due_date" ? (
                      sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </div>
                </th>
                <th className="px-6 pb-3 pt-4">Manager</th>
                <th className="px-6 pb-3 pt-4"></th>
              </tr>
            </thead>
            <tbody>
              {interviews.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-sm text-muted-foreground">
                    {showHistory ? "Aucun entretien terminé" : "Aucun entretien en cours"}
                  </td>
                </tr>
              )}
              {displayed.map((iv) => (
                <tr
                  key={iv.id}
                  className="border-b border-border last:border-0 transition-colors"
                >
                  <td className="px-4 py-3">
                    {(currentUser?.role === "admin" || currentUser?.role === "rh") && (
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(iv.id)}
                        onChange={() =>
                          setSelectedIds((prev) =>
                            prev.includes(iv.id) ? prev.filter((x) => x !== iv.id) : [...prev, iv.id],
                          )
                        }
                        className="h-4 w-4"
                      />
                    )}
                  </td>
                  <td className="px-6 py-3 text-sm font-medium">
                    {iv.employee_detail?.first_name} {iv.employee_detail?.last_name}
                  </td>
                  <td className="px-6 py-3">
                    <Badge variant={iv.type as "annual" | "professional" | "bilan" | "forfait" | "fin_carriere"}>
                      {{ annual: "Évaluation", professional: "Professionnel", bilan: "Bilan", forfait: "Forfait jours", fin_carriere: "Fin de carrière" }[iv.type]}
                    </Badge>
                  </td>
                  <td className="px-6 py-3 text-sm text-muted-foreground">{iv.template_name || "-"}</td>
                  <td className="px-6 py-3">
                    <Badge variant={iv.status as "draft" | "in_progress" | "completed" | "signed" | "cancelled"}>
                      {statusLabel[iv.status]}
                    </Badge>
                  </td>
                  <td className="px-6 py-3 text-sm">{formatDate(iv.due_date)}</td>
                  <td className="px-6 py-3">
                    <div className="text-sm text-muted-foreground">
                      {iv.manager_detail?.first_name} {iv.manager_detail?.last_name}
                    </div>
                    {iv.employee_manager_name && (
                      <div className="text-xs text-muted-foreground/60">
                        N+1 : {iv.employee_manager_name}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-1">
                      {showHistory ? (
                        <>
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openPrint(iv.id); }}>
                            Imprimer
                          </Button>
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); downloadPdf(iv.id); }}>
                            <Download className="mr-1 h-4 w-4" />
                            PDF
                          </Button>
                          {(currentUser?.role === "admin" || currentUser?.role === "rh" || currentUser?.role === "manager") && (
                            <>
                              {iv.document_url ? (
                                <>
                                  <a href={iv.document_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="sm">
                                      <Upload className="mr-1 h-4 w-4" />
                                      Document
                                    </Button>
                                  </a>
                                  <Button variant="ghost" size="sm" onClick={async (e) => { e.stopPropagation(); await api.post(`/interviews/${iv.id}/remove_document/`); queryClient.invalidateQueries({ queryKey: ["interviews"] }); }}>
                                    <X className="h-4 w-4 text-muted-foreground hover:text-red-500" />
                                  </Button>
                                </>
                              ) : (
                                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); uploadTargetRef.current = iv.id; fileInputRef.current?.click(); }}>
                                  <Upload className="mr-1 h-4 w-4" />
                                  Importer
                                </Button>
                              )}
                            </>
                          )}
                        </>
                    ) : (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/interviews/${iv.id}`)}>
                          {iv.status === "draft" ? "Commencer" : iv.status === "in_progress" ? "Reprendre" : "Voir"}
                        </Button>
                        {(currentUser?.role === "admin" || currentUser?.role === "rh" || currentUser?.role === "manager") && (
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/interviews/${iv.id}/edit`); }}>
                            Modifier
                          </Button>
                        )}
                      </>
                    )}
                      {(currentUser?.role === "admin" || currentUser?.role === "rh") && (
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDeleteId(iv.id); }}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {interviews.length > 0 && (
            <div className="flex items-center justify-between border-t border-border px-6 py-3">
              <span className="text-xs text-muted-foreground">
                {interviews.length} sur {total} entretien{total > 1 ? "s" : ""}
              </span>
              {hasNextPage && (
                <Button variant="outline" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="gap-2">
                  <ChevronDown className="h-4 w-4" />
                  {isFetchingNextPage ? "Chargement..." : "Charger plus"}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
          queryClient.invalidateQueries({ queryKey: ["interviews"] });
        }}
        onCancel={() => setShowBulkDeleteConfirm(false)}
      />

      <ConfirmDialog
        open={deleteId !== null}
        title="Supprimer l'entretien"
        message="Êtes-vous sûr de vouloir supprimer cet entretien ? Cette action est irréversible."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        onConfirm={async () => { if (deleteId) { await api.delete(`/interviews/${deleteId}/`); queryClient.invalidateQueries({ queryKey: ["interviews"] }); } setDeleteId(null); }}
        onCancel={() => setDeleteId(null)}
      />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </AppLayout>
  );
}
