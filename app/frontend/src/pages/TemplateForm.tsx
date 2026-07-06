import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, X, ChevronUp, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import AppLayout from "../components/AppLayout";
import api from "../api";
import type { Section, Question, TableColumn } from "../types";

let sectionCounter = 0;
let questionCounter = 0;

function newSection(): Section {
  sectionCounter += 1;
  return { id: `s_${Date.now()}_${sectionCounter}`, title: "", questions: [] };
}

let columnCounter = 0;

function newColumn(): TableColumn {
  columnCounter += 1;
  return { id: `c_${Date.now()}_${columnCounter}`, label: "", type: "textarea" };
}

function newQuestion(): Question {
  questionCounter += 1;
  return { id: `q_${Date.now()}_${questionCounter}`, label: "", type: "textarea", answer: "" };
}

export default function TemplateForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [name, setName] = useState("");
  const [type, setType] = useState("annual");
  const [description, setDescription] = useState("");
  const [sections, setSections] = useState<Section[]>([newSection()]);

  useEffect(() => {
    if (!id) return;
    api.get(`/interview-templates/${id}/`).then((r) => {
      setName(r.data.name);
      setType(r.data.type);
      setDescription(r.data.description);
      setSections(r.data.sections?.length ? r.data.sections : [newSection()]);
    });
  }, [id]);

  const addSection = () => setSections([...sections, newSection()]);

  const removeSection = (sIdx: number) => {
    if (sections.length <= 1) return;
    setSections(sections.filter((_, i) => i !== sIdx));
  };

  const updateSectionTitle = (sIdx: number, title: string) => {
    const next = [...sections];
    next[sIdx] = { ...next[sIdx], title };
    setSections(next);
  };

  const addQuestion = (sIdx: number) => {
    const next = [...sections];
    next[sIdx] = { ...next[sIdx], questions: [...next[sIdx].questions, newQuestion()] };
    setSections(next);
  };

  const removeQuestion = (sIdx: number, qIdx: number) => {
    const next = [...sections];
    next[sIdx] = { ...next[sIdx], questions: next[sIdx].questions.filter((_, i) => i !== qIdx) };
    setSections(next);
  };

  const moveSection = (sIdx: number, direction: -1 | 1) => {
    const newIdx = sIdx + direction;
    if (newIdx < 0 || newIdx >= sections.length) return;
    const next = [...sections];
    [next[sIdx], next[newIdx]] = [next[newIdx], next[sIdx]];
    setSections(next);
  };

  const moveQuestion = (sIdx: number, qIdx: number, direction: -1 | 1) => {
    const newIdx = qIdx + direction;
    const qs = sections[sIdx].questions;
    if (newIdx < 0 || newIdx >= qs.length) return;
    const next = [...sections];
    const qsCopy = [...qs];
    [qsCopy[qIdx], qsCopy[newIdx]] = [qsCopy[newIdx], qsCopy[qIdx]];
    next[sIdx] = { ...next[sIdx], questions: qsCopy };
    setSections(next);
  };

  const updateQuestion = (sIdx: number, qIdx: number, field: "label" | "type", value: string) => {
    const next = [...sections];
    const qs = [...next[sIdx].questions];
    const updated = { ...qs[qIdx], [field]: value };
    if (field === "type" && value === "table" && !updated.columns) {
      updated.columns = [newColumn()];
    }
    qs[qIdx] = updated;
    next[sIdx] = { ...next[sIdx], questions: qs };
    setSections(next);
  };

  const addColumn = (sIdx: number, qIdx: number) => {
    const next = [...sections];
    const qs = [...next[sIdx].questions];
    qs[qIdx] = { ...qs[qIdx], columns: [...(qs[qIdx].columns || []), newColumn()] };
    next[sIdx] = { ...next[sIdx], questions: qs };
    setSections(next);
  };

  const removeColumn = (sIdx: number, qIdx: number, cIdx: number) => {
    const next = [...sections];
    const qs = [...next[sIdx].questions];
    const cols = qs[qIdx].columns?.filter((_, i) => i !== cIdx) || [];
    qs[qIdx] = { ...qs[qIdx], columns: cols.length ? cols : undefined };
    next[sIdx] = { ...next[sIdx], questions: qs };
    setSections(next);
  };

  const updateColumn = (sIdx: number, qIdx: number, cIdx: number, field: "label" | "type", value: string) => {
    const next = [...sections];
    const qs = [...next[sIdx].questions];
    const cols = [...(qs[qIdx].columns || [])];
    cols[cIdx] = { ...cols[cIdx], [field]: value };
    qs[qIdx] = { ...qs[qIdx], columns: cols };
    next[sIdx] = { ...next[sIdx], questions: qs };
    setSections(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSections = sections
      .filter((s) => s.title.trim())
      .map((s) => ({
        ...s,
        title: s.title.trim(),
        questions: s.questions.filter((q) => q.label.trim()).map((q) => ({
          ...q,
          label: q.label.trim(),
          type: q.type,
          answer: q.type === "table" ? [] : q.type === "yesno" ? null : "",
          columns: q.type === "table" ? (q.columns || []).filter((c) => c.label.trim()).map((c) => ({ ...c, label: c.label.trim() })) : undefined,
        })),
      }));

    const payload = { name, type, description, sections: cleanSections };
    if (isEdit) {
      await api.put(`/interview-templates/${id}/`, payload);
    } else {
      await api.post("/interview-templates/", payload);
    }
    navigate("/templates");
  };

  return (
    <AppLayout>
      <Button variant="ghost" className="mb-4 gap-2" onClick={() => navigate("/templates")}>
        <ArrowLeft className="h-4 w-4" />
        Retour
      </Button>

      <h1 className="mb-6 text-center font-display text-2xl font-bold">
        {isEdit ? "Modifier" : "Nouveau"} modèle
      </h1>

      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Informations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Nom</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ex: EAP 2026" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              >
                <option value="annual">Entretien d'évaluation</option>
                <option value="professional">Entretien professionnel</option>
                <option value="bilan">Entretien de bilan</option>
                <option value="forfait">Entretien forfait jours et charges</option>
                <option value="fin_carriere">Entretien de fin de carrière</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                placeholder="Description du modèle..."
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Sections et questions</h2>
          <Button type="button" variant="outline" size="sm" onClick={addSection} className="gap-1">
            <Plus className="h-4 w-4" />
            Ajouter une section
          </Button>
        </div>

        {sections.map((section, sIdx) => (
          <Card key={section.id}>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
              <div className="flex flex-1 items-center gap-2">
                <div className="flex flex-col">
                  <button type="button" onClick={() => moveSection(sIdx, -1)} disabled={sIdx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button type="button" onClick={() => moveSection(sIdx, 1)} disabled={sIdx === sections.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>
                <Input
                  value={section.title}
                  onChange={(e) => updateSectionTitle(sIdx, e.target.value)}
                  placeholder="Titre de la section"
                  className="font-medium"
                />
              </div>
              <div className="flex gap-1">
                <Button type="button" size="icon" variant="ghost" onClick={() => addQuestion(sIdx)} title="Ajouter une question">
                  <Plus className="h-4 w-4" />
                </Button>
                {sections.length > 1 && (
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeSection(sIdx)} title="Supprimer la section">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {section.questions.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucune question. Cliquez sur + pour ajouter une question.</p>
              )}
              {section.questions.map((q, qIdx) => (
                <div key={q.id} className="flex flex-col gap-2">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 space-y-1">
                      <Input
                        value={q.label}
                        onChange={(e) => updateQuestion(sIdx, qIdx, "label", e.target.value)}
                        placeholder="Texte de la question"
                      />
                      <select
                        value={q.type}
                        onChange={(e) => updateQuestion(sIdx, qIdx, "type", e.target.value)}
                        className="h-8 rounded-md border border-border bg-white px-2 text-xs"
                      >
                        <option value="textarea">Texte long</option>
                        <option value="rating">Note (1-5)</option>
                        <option value="yesno">Oui / Non</option>
                        <option value="table">Tableau</option>
                      </select>
                    </div>
                    <div className="mt-1 flex flex-col">
                      <button type="button" onClick={() => moveQuestion(sIdx, qIdx, -1)} disabled={qIdx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <button type="button" onClick={() => moveQuestion(sIdx, qIdx, 1)} disabled={qIdx === section.questions.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </div>
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeQuestion(sIdx, qIdx)} className="mt-1">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {q.type === "table" && (
                    <div className="ml-4 space-y-2 rounded-md border border-border bg-muted/30 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground">Colonnes</span>
                        <Button type="button" size="sm" variant="outline" onClick={() => addColumn(sIdx, qIdx)} className="h-7 gap-1 text-xs">
                          <Plus className="h-3 w-3" />
                          Ajouter une colonne
                        </Button>
                      </div>
                      {(!q.columns || q.columns.length === 0) && (
                        <p className="text-xs text-muted-foreground">Aucune colonne. Ajoutez-en une.</p>
                      )}
                      {q.columns?.map((col, cIdx) => (
                        <div key={col.id} className="flex items-start gap-2">
                          <div className="flex-1 space-y-1">
                            <Input
                              value={col.label}
                              onChange={(e) => updateColumn(sIdx, qIdx, cIdx, "label", e.target.value)}
                              placeholder="Titre de la colonne"
                              className="text-xs"
                            />
                            <select
                              value={col.type}
                              onChange={(e) => updateColumn(sIdx, qIdx, cIdx, "type", e.target.value)}
                              className="h-7 rounded-md border border-border bg-white px-2 text-xs"
                            >
                              <option value="textarea">Texte long</option>
                              <option value="rating">Note (1-5)</option>
                            </select>
                          </div>
                          <Button type="button" size="icon" variant="ghost" onClick={() => removeColumn(sIdx, qIdx, cIdx)} className="mt-1 h-7 w-7">
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        <div className="flex justify-end gap-2 pb-8">
          <Button type="button" variant="outline" onClick={() => navigate("/templates")}>
            Annuler
          </Button>
          <Button type="submit">{isEdit ? "Enregistrer" : "Créer"}</Button>
        </div>
      </form>
    </AppLayout>
  );
}
