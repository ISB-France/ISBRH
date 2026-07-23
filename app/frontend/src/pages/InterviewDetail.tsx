import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Save, CheckCircle2, Download, PenSquare, Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import AppLayout from "../components/AppLayout";
import LoadingScreen from "../components/LoadingScreen";
import { Toast, useToast } from "../components/Toast";
import ConfirmDialog from "../components/ConfirmDialog";
import { DateInput } from "../components/ui/date-input";
import api from "../api";
import type { Interview, User, Section, ObjectifBilanAnswer } from "../types";
import { formatDate } from "../lib/utils";

const toApiDate = (val: string) => {
  const parts = val.split("/");
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : val;
};

const statusLabel: Record<string, string> = {
  draft: "Brouillon",
  in_progress: "En cours",
  completed: "Terminé",
  signed: "Signé",
  cancelled: "Annulé",
};

export default function InterviewDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [interview, setInterview] = useState<Interview | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [dateRealisation, setDateRealisation] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
  const { toast, show, setToast } = useToast();

  const { data: currentUser } = useQuery<User>({
    queryKey: ["me"],
    queryFn: () => api.get("/auth/me/").then((r) => r.data),
  });

  useEffect(() => {
    if (!id) return;
    api.get(`/interviews/${id}/`).then((r) => {
      setInterview(r.data);
      setSections(r.data.content?.sections || []);
      setDateRealisation(formatDate(r.data.date_realisation));
    });
  }, [id]);

  const updateAnswer = (sIdx: number, qIdx: number, value: string | number | boolean | null | ObjectifBilanAnswer) => {
    setSections((prev) => {
      const next = [...prev];
      const qs = [...next[sIdx].questions];
      qs[qIdx] = { ...qs[qIdx], answer: value };
      next[sIdx] = { ...next[sIdx], questions: qs };
      return next;
    });
  };

  const updateTableCell = (sIdx: number, qIdx: number, rowIdx: number, colIdx: number, value: string | number | null) => {
    setSections((prev) => {
      const next = [...prev];
      const qs = [...next[sIdx].questions];
      const rows: (string | number | null)[][] = Array.isArray(qs[qIdx].answer) ? [...(qs[qIdx].answer as (string | number | null)[][])] : [];
      if (!rows[rowIdx]) rows[rowIdx] = [];
      rows[rowIdx] = [...rows[rowIdx]];
      rows[rowIdx][colIdx] = value;
      qs[qIdx] = { ...qs[qIdx], answer: rows };
      next[sIdx] = { ...next[sIdx], questions: qs };
      return next;
    });
  };

  const addTableRow = (sIdx: number, qIdx: number) => {
    setSections((prev) => {
      const next = [...prev];
      const qs = [...next[sIdx].questions];
      const rows: (string | number | null)[][] = Array.isArray(qs[qIdx].answer) ? [...(qs[qIdx].answer as (string | number | null)[][])] : [];
      rows.push([]);
      qs[qIdx] = { ...qs[qIdx], answer: rows };
      next[sIdx] = { ...next[sIdx], questions: qs };
      return next;
    });
  };

  const removeTableRow = (sIdx: number, qIdx: number, rowIdx: number) => {
    setSections((prev) => {
      const next = [...prev];
      const qs = [...next[sIdx].questions];
      const rows: (string | number | null)[][] = Array.isArray(qs[qIdx].answer) ? [...(qs[qIdx].answer as (string | number | null)[][])] : [];
      rows.splice(rowIdx, 1);
      qs[qIdx] = { ...qs[qIdx], answer: rows };
      next[sIdx] = { ...next[sIdx], questions: qs };
      return next;
    });
  };

  const isTableRowEmpty = (row: (string | number | null)[]) =>
    row.every((cell) => cell === null || cell === undefined || cell === "");

  const hasEmptyTableRows = (secs: Section[]) =>
    secs.some((section) =>
      section.questions.some(
        (q) => q.type === "table" && Array.isArray(q.answer) && (q.answer as (string | number | null)[][]).some(isTableRowEmpty),
      ),
    );

  const removeEmptyTableRows = (secs: Section[]): Section[] =>
    secs.map((section) => ({
      ...section,
      questions: section.questions.map((q) =>
        q.type === "table" && Array.isArray(q.answer)
          ? { ...q, answer: (q.answer as (string | number | null)[][]).filter((row) => !isTableRowEmpty(row)) }
          : q,
      ),
    }));

  const handleSave = async (newStatus?: string, sectionsOverride?: Section[]) => {
    if (!interview) return;
    const sectionsToSave = sectionsOverride || sections;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        content: { ...interview.content, sections: sectionsToSave, lieu: interview.employee_detail?.site_name || "" },
        date_realisation: toApiDate(dateRealisation) || null,
      };
      if (newStatus) {
        payload.status = newStatus;
      } else if (interview.status === "draft") {
        payload.status = "in_progress";
      }
      const res = await api.patch(`/interviews/${id}/`, payload);
      setInterview(res.data);
      setSections(res.data.content?.sections || []);
      if (newStatus === "completed") {
        setSuccessMessage("Entretien finalisé avec succès");
      } else {
        show("Entretien enregistré");
        setTimeout(() => navigate("/interviews"), 800);
      }
    } catch {
      show("Erreur lors de l'enregistrement", "error");
    } finally {
      setSaving(false);
    }
  };

  const downloadPdf = useCallback(async () => {
    const res = await api.get(`/interviews/${id}/pdf/`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    const match = (res.headers["content-disposition"] as string | undefined)?.match(/filename="?([^"]+)"?/);
    a.download = match ? match[1] : `entretien-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }, [id]);

  if (!interview) return <LoadingScreen />;

  const isOwn = interview.employee === currentUser?.id;
  const hasNoManager = currentUser && !currentUser.manager;
  const canEdit = currentUser?.role === "admin" || currentUser?.role === "rh" || interview.manager === currentUser?.id || (isOwn && hasNoManager) || (currentUser?.role === "manager" && !isOwn);
  const isReadOnly = !canEdit || interview.status === "completed" || interview.status === "signed" || interview.status === "cancelled";

  const prevAnswers = new Map<string, string | number | boolean | (string | number | null)[][] | ObjectifBilanAnswer | null>();
  for (const section of interview.previous_content || []) {
    for (const q of section.questions) {
      if (q.answer !== undefined) prevAnswers.set(q.id, q.answer);
    }
  }


  return (
    <AppLayout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">
            {{ annual: "Entretien d'évaluation", professional: "Entretien professionnel", bilan: "Entretien de bilan", forfait: "Entretien forfait jours et charges", fin_carriere: "Entretien de fin de carrière" }[interview.type]}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {interview.employee_detail?.first_name} {interview.employee_detail?.last_name}
            {" · "}
            {interview.manager_detail?.first_name} {interview.manager_detail?.last_name}
            {" · "}
            <Badge variant={interview.status as "draft" | "in_progress" | "completed" | "signed" | "cancelled"}>
              {statusLabel[interview.status]}
            </Badge>
            {interview.template_name && (
              <>{" · "}<span className="text-muted-foreground">{interview.template_name}</span></>
            )}
            {" · "}
            Date limite : {formatDate(interview.due_date)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isReadOnly && (
            <Button variant="outline" size="sm" onClick={() => handleSave()} disabled={saving}>
              <Save className="mr-1 h-4 w-4" />
              {saving ? "Sauvegarde..." : "Enregistrer"}
            </Button>
          )}
          {(interview.status === "draft" || interview.status === "in_progress") && (
            <Button
              size="sm"
              onClick={() => {
                if (hasEmptyTableRows(sections)) {
                  setShowFinalizeConfirm(true);
                } else {
                  handleSave("completed");
                }
              }}
            >
              <CheckCircle2 className="mr-1 h-4 w-4" />
              Finaliser
            </Button>
          )}
          {interview.status === "completed" && (
            <>
              <Button size="sm" onClick={() => handleSave("signed")}>
                <PenSquare className="mr-1 h-4 w-4" />
                Signer
              </Button>
              <Button variant="outline" size="sm" onClick={downloadPdf}>
                <Download className="mr-1 h-4 w-4" />
                Télécharger PDF
              </Button>
            </>
          )}
          {interview.status === "signed" && (
            <Button variant="outline" size="sm" onClick={downloadPdf}>
              <Download className="mr-1 h-4 w-4" />
              Télécharger PDF
            </Button>
          )}
        </div>
      </div>

      {/* Informations générales */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-1 gap-3 border-b border-border pb-4 sm:grid-cols-2">
            <div>
              <span className="text-xs font-semibold uppercase text-muted-foreground">Date de réalisation</span>
              <div className="mt-1 w-40">
                <DateInput value={dateRealisation} onChange={setDateRealisation} disabled={isReadOnly} />
              </div>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase text-muted-foreground">Nature de l'entretien</span>
              <p className="text-sm font-medium">
                {{ annual: "Entretien d'évaluation", professional: "Entretien professionnel", bilan: "Entretien de bilan", forfait: "Entretien forfait jours et charges", fin_carriere: "Entretien de fin de carrière" }[interview.type]}
              </p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase text-muted-foreground">Lieu</span>
              <p className="text-sm font-medium">{interview.manager_detail?.site_name || "—"}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Manager</h4>
              <table className="w-full text-sm">
                <tbody>
                  <tr><td className="py-1 text-muted-foreground">Matricule</td><td className="py-1 pl-4">{interview.manager_detail?.matricule || "-"}</td></tr>
                  <tr><td className="py-1 text-muted-foreground">Nom</td><td className="py-1 pl-4">{interview.manager_detail?.last_name || "-"}</td></tr>
                  <tr><td className="py-1 text-muted-foreground">Prénom</td><td className="py-1 pl-4">{interview.manager_detail?.first_name || "-"}</td></tr>
                </tbody>
              </table>
            </div>
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Collaborateur</h4>
              <table className="w-full text-sm">
                <tbody>
                  <tr><td className="py-1 text-muted-foreground">Matricule</td><td className="py-1 pl-4">{interview.employee_detail?.matricule || "-"}</td></tr>
                  <tr><td className="py-1 text-muted-foreground">Nom</td><td className="py-1 pl-4">{interview.employee_detail?.last_name || "-"}</td></tr>
                  <tr><td className="py-1 text-muted-foreground">Prénom</td><td className="py-1 pl-4">{interview.employee_detail?.first_name || "-"}</td></tr>
                  <tr><td className="py-1 text-muted-foreground">Sexe</td><td className="py-1 pl-4">
                    {({ homme: "Homme", femme: "Femme", non_binaire: "Non-Binaire" } as Record<string, string>)[interview.employee_detail?.sexe ?? ""] || "-"}
                  </td></tr>
<tr><td className="py-1 text-muted-foreground">Date naissance</td><td className="py-1 pl-4">{interview.employee_detail?.date_naissance ? formatDate(interview.employee_detail.date_naissance) : "-"}</td></tr>
                    <tr><td className="py-1 text-muted-foreground">Date embauche</td><td className="py-1 pl-4">{interview.employee_detail?.hire_date ? formatDate(interview.employee_detail.hire_date) : "-"}</td></tr>
                  <tr><td className="py-1 text-muted-foreground">Type contrat</td><td className="py-1 pl-4">
                    {({ cdi: "CDI", cdd: "CDD", interim: "Intérim", alternance: "Alternance", stage: "Stage" } as Record<string, string>)[interview.employee_detail?.type_contrat ?? ""] || "-"}
                  </td></tr>
                  <tr><td className="py-1 text-muted-foreground">Statut</td><td className="py-1 pl-4">
                    {({ actif: "Actif", inactif: "Inactif", sortie: "Sortie" } as Record<string, string>)[interview.employee_detail?.statut ?? ""] || "-"}
                  </td></tr>
                  <tr><td className="py-1 text-muted-foreground">Poste</td><td className="py-1 pl-4">{interview.employee_detail?.position_name || "-"}</td></tr>
                  <tr><td className="py-1 text-muted-foreground">Site</td><td className="py-1 pl-4">{interview.employee_detail?.site_name || "-"}</td></tr>
                  <tr><td className="py-1 text-muted-foreground">Coefficient</td><td className="py-1 pl-4">{interview.employee_detail?.coefficient || "-"}</td></tr>
                  <tr><td className="py-1 text-muted-foreground">Ancienneté</td><td className="py-1 pl-4">{interview.employee_detail?.hire_date ? `${Math.floor((Date.now() - new Date(interview.employee_detail.hire_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} ans` : "-"}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {(interview.type === "professional" || interview.type === "bilan") && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Historique d'évolution professionnel</CardTitle>
          </CardHeader>
          <CardContent>
            {interview.career && interview.career.length > 0 ? (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Date</th>
                      {interview.type === "bilan" && <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Type</th>}
                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Poste</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Service</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Site</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Coefficient</th>
                    </tr>
                  </thead>
                  <tbody>
                    {interview.career.map((step, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-4 py-2">{formatDate(step.date)}</td>
                        {interview.type === "bilan" && <td className="px-4 py-2">{step.type_label}</td>}
                        <td className="px-4 py-2">{step.position || "—"}</td>
                        <td className="px-4 py-2">{step.service || "—"}</td>
                        <td className="px-4 py-2">{step.site || "—"}</td>
                        <td className="px-4 py-2">{step.coefficient || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun historique d'évolution professionnel.</p>
            )}
          </CardContent>
        </Card>
      )}

      {(interview.type === "annual" || interview.type === "bilan") && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Historique des entretiens</CardTitle>
          </CardHeader>
          <CardContent>
            {interview.history && interview.history.length > 0 ? (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Statut</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Manager</th>
                    </tr>
                  </thead>
                  <tbody>
                    {interview.history.map((h, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-4 py-2">{formatDate(h.date)}</td>
                        <td className="px-4 py-2">{h.type_label}</td>
                        <td className="px-4 py-2">{h.status_label}</td>
                        <td className="px-4 py-2">{h.manager_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun entretien précédent.</p>
            )}
          </CardContent>
        </Card>
      )}

      {interview.type === "bilan" && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Historique des formations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {interview.training_history && interview.training_history.length > 0 ? (
              interview.training_history.map((entry, i) => (
                <div key={i}>
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">
                    {formatDate(entry.date)} — {entry.type}
                  </p>
                  <div className="space-y-2">
                    {entry.entries.map((e, j) => (
                      <div key={j}>
                        <p className="text-xs text-muted-foreground">{e.label}</p>
                        <p className="text-sm whitespace-pre-wrap rounded-md border border-border bg-muted/30 px-3 py-2">{e.answer}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Aucune formation suivie.</p>
            )}
          </CardContent>
        </Card>
      )}

      {interview.type === "bilan" && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Historique de progression salariale</CardTitle>
          </CardHeader>
          <CardContent>
            {interview.salary_history && interview.salary_history.length > 0 ? (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Type d'entretien</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Salaire brut</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Coefficient</th>
                    </tr>
                  </thead>
                  <tbody>
                    {interview.salary_history.map((e, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-4 py-2">{formatDate(e.date)}</td>
                        <td className="px-4 py-2">{e.type}</td>
                        <td className="px-4 py-2">{e.salary ? `${e.salary} €` : "—"}</td>
                        <td className="px-4 py-2">{e.coefficient || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune donnée salariale.</p>
            )}
          </CardContent>
        </Card>
      )}

      {sections.map((section, sIdx) => (
        <Card key={section.id} className="mb-4">
          <CardHeader>
            <CardTitle>{section.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {section.questions.map((q, qIdx) => {
              const prev = prevAnswers.get(q.id);
              return (
              <div key={q.id}>
                <label className="mb-1.5 block text-sm font-medium">{q.label}</label>
                {q.type === "textarea" && (
                  <>
                  <Textarea
                    rows={4}
                    value={typeof q.answer === "string" ? q.answer : ""}
                    onChange={(e) => updateAnswer(sIdx, qIdx, e.target.value)}
                    disabled={isReadOnly}
                  />
                  {prev !== undefined && prev !== null && (
                    <p className="mt-1 text-xs text-muted-foreground/60 italic">
                      Réponse précédente : {String(prev)}
                    </p>
                  )}
                  </>
                )}
                {q.type === "rating" && (
                  <>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => !isReadOnly && updateAnswer(sIdx, qIdx, n)}
                        className={`flex h-10 w-10 items-center justify-center rounded-md border text-sm font-semibold transition-colors ${
                          q.answer !== null && n <= (q.answer as number)
                            ? "border-primary-foreground bg-primary-foreground text-primary"
                            : "border-border text-muted-foreground hover:border-border"
                        } ${isReadOnly ? "cursor-default" : "cursor-pointer"}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  {prev !== undefined && prev !== null && (
                    <p className="mt-1 text-xs text-muted-foreground/60 italic">
                      Note précédente : {String(prev)}/5
                    </p>
                  )}
                  </>
                )}
                {q.type === "yesno" && (
                  <>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant={q.answer === true ? "default" : "outline"}
                      onClick={() => !isReadOnly && updateAnswer(sIdx, qIdx, true)}
                      disabled={isReadOnly}
                    >
                      Oui
                    </Button>
                    <Button
                      type="button"
                      variant={q.answer === false ? "default" : "outline"}
                      onClick={() => !isReadOnly && updateAnswer(sIdx, qIdx, false)}
                      disabled={isReadOnly}
                    >
                      Non
                    </Button>
                  </div>
                  {prev !== undefined && prev !== null && (
                    <p className="mt-1 text-xs text-muted-foreground/60 italic">
                      Réponse précédente : {prev === true ? "Oui" : "Non"}
                    </p>
                  )}
                  </>
                )}
                {q.type === "objectif_bilan" && (
                  <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
                    <p className="text-sm italic text-muted-foreground">Objectif fixé : {q.objectif_texte || "—"}</p>
                    <div className="flex gap-2">
                      {([
                        { value: "atteint", label: "Atteint" },
                        { value: "partiel", label: "Partiellement atteint" },
                        { value: "non_atteint", label: "Non atteint" },
                      ] as const).map((opt) => {
                        const current = q.answer as ObjectifBilanAnswer | undefined;
                        return (
                          <Button
                            key={opt.value}
                            type="button"
                            size="sm"
                            variant={current?.statut === opt.value ? "default" : "outline"}
                            disabled={isReadOnly}
                            onClick={() =>
                              !isReadOnly &&
                              updateAnswer(sIdx, qIdx, { statut: opt.value, commentaire: current?.commentaire || "" })
                            }
                          >
                            {opt.label}
                          </Button>
                        );
                      })}
                    </div>
                    <Textarea
                      rows={2}
                      placeholder="Commentaire"
                      value={(q.answer as ObjectifBilanAnswer | undefined)?.commentaire || ""}
                      onChange={(e) => {
                        const current = q.answer as ObjectifBilanAnswer | undefined;
                        updateAnswer(sIdx, qIdx, { statut: current?.statut || "", commentaire: e.target.value });
                      }}
                      disabled={isReadOnly}
                    />
                  </div>
                )}
                {q.type === "table" && q.columns && q.columns.length > 0 && (
                  <>
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground w-8">#</th>
                          {q.columns.map((col) => (
                            <th key={col.id} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                              {col.label}
                            </th>
                          ))}
                          {!isReadOnly && <th className="px-3 py-2 w-8"></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const rows: (string | number | null)[][] = Array.isArray(q.answer) ? (q.answer as (string | number | null)[][]) : [];
                          const prevRows: (string | number | null)[][] = Array.isArray(prev) ? (prev as (string | number | null)[][]) : [];
                          return rows.map((row, rowIdx) => (
                            <tr key={rowIdx} className="border-b border-border last:border-0">
                              <td className="px-3 py-1.5 text-xs text-muted-foreground">{rowIdx + 1}</td>
                              {q.columns!.map((col, colIdx) => {
                                const prevCell = prevRows[rowIdx]?.[colIdx];
                                return (
                                <td key={col.id} className="px-3 py-1.5 align-top">
                                  {col.type === "textarea" ? (
                                    <div>
                                    <Textarea
                                      rows={2}
                                      value={typeof row[colIdx] === "string" ? row[colIdx] : ""}
                                      onChange={(e) => updateTableCell(sIdx, qIdx, rowIdx, colIdx, e.target.value)}
                                      disabled={isReadOnly}
                                      className="min-w-[180px]"
                                    />
                                    {prevCell !== undefined && prevCell !== null && (
                                      <p className="mt-0.5 text-[10px] text-muted-foreground/50 italic leading-tight">
                                        Préc. : {String(prevCell)}
                                      </p>
                                    )}
                                    </div>
                                  ) : (
                                    <div>
                                    <div className="flex gap-1">
                                      {[1, 2, 3, 4, 5].map((n) => (
                                        <button
                                          key={n}
                                          type="button"
                                          onClick={() => !isReadOnly && updateTableCell(sIdx, qIdx, rowIdx, colIdx, n)}
                                          className={`flex h-8 w-8 items-center justify-center rounded-md border text-xs font-semibold transition-colors ${
                                            row[colIdx] !== null && row[colIdx] !== undefined && n <= (row[colIdx] as number)
                                              ? "border-primary-foreground bg-primary-foreground text-primary"
                                              : "border-border text-muted-foreground hover:border-border"
                                          } ${isReadOnly ? "cursor-default" : "cursor-pointer"}`}
                                        >
                                          {n}
                                        </button>
                                      ))}
                                    </div>
                                    {prevCell !== undefined && prevCell !== null && (
                                      <p className="mt-0.5 text-[10px] text-muted-foreground/50 italic leading-tight">
                                        Préc. : {String(prevCell)}/5
                                      </p>
                                    )}
                                    </div>
                                  )}
                                </td>
                                );
                              })}
                              {!isReadOnly && (
                                <td className="px-3 py-1.5">
                                  <Button type="button" size="icon" variant="ghost" onClick={() => removeTableRow(sIdx, qIdx, rowIdx)} className="h-7 w-7">
                                    <X className="h-3 w-3" />
                                  </Button>
                                </td>
                              )}
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                  {!isReadOnly && (
                    <Button type="button" variant="outline" size="sm" onClick={() => addTableRow(sIdx, qIdx)} className="mt-2 gap-1">
                      <Plus className="h-3 w-3" />
                      Ajouter une ligne
                    </Button>
                  )}
                  </>
                )}
              </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {successMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg border border-border bg-white p-6 shadow-lg">
            <h3 className="mb-2 text-lg font-semibold">Succès</h3>
            <p className="mb-6 text-sm text-muted-foreground">{successMessage}</p>
            <div className="flex justify-end">
              <Button onClick={() => { setSuccessMessage(null); navigate("/interviews"); }}>
                OK
              </Button>
            </div>
          </div>
        </div>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <ConfirmDialog
        open={showFinalizeConfirm}
        title="Lignes de tableau incomplètes"
        message="Certaines lignes d'un ou plusieurs tableaux ne sont pas remplies. Les lignes vides seront supprimées si vous finalisez. Voulez-vous quand même finaliser l'entretien ?"
        confirmLabel="Finaliser"
        cancelLabel="Annuler"
        confirmVariant="default"
        onConfirm={() => {
          setShowFinalizeConfirm(false);
          const cleaned = removeEmptyTableRows(sections);
          setSections(cleaned);
          handleSave("completed", cleaned);
        }}
        onCancel={() => setShowFinalizeConfirm(false)}
      />
    </AppLayout>
  );
}
