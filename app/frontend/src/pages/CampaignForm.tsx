import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import AppLayout from "../components/AppLayout";
import api from "../api";
import type { InterviewTemplate, Service, Site, User } from "../types";

export default function CampaignForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [template, setTemplate] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [filterSite, setFilterSite] = useState("");
  const [filterService, setFilterService] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);

  const { data: allTemplates } = useQuery<InterviewTemplate[]>({
    queryKey: ["interview-templates"],
    queryFn: () => api.get("/interview-templates/").then((r) => r.data),
  });

  const templates = type ? allTemplates?.filter((t) => t.type === type) : allTemplates;

  const { data: sites } = useQuery<Site[]>({
    queryKey: ["sites"],
    queryFn: () => api.get("/sites/").then((r) => r.data),
  });

  const { data: services } = useQuery<Service[]>({
    queryKey: ["services"],
    queryFn: () => api.get("/services/").then((r) => r.data),
  });

  const { data: allUsers } = useQuery<User[]>({
    queryKey: ["users-all"],
    queryFn: () => api.get("/users/").then((r) => r.data),
  });

  const toggleEmployee = (uid: number) => {
    setSelectedEmployees((prev) =>
      prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid],
    );
  };

  useEffect(() => {
    if (!id) return;
    api.get(`/campaigns/${id}/`).then((r) => {
      const d = r.data;
      setName(d.name);
      setTemplate(d.template ?? "");
      setDescription(d.description);
      setStartDate(d.start_date);
      setDueDate(d.due_date);
      const pf = d.population_filter || {};
      setFilterSite(pf.site ?? "");
      setFilterService(pf.service ?? "");
      setSelectedEmployees(pf.employees ?? []);
      if (d.template && allTemplates) {
        const tmpl = allTemplates.find((t) => t.id === d.template);
        if (tmpl) setType(tmpl.type);
      }
    });
  }, [id, allTemplates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const population_filter: Record<string, unknown> = {};
    if (selectedEmployees.length > 0) {
      population_filter.employees = selectedEmployees;
    } else {
      if (filterSite) population_filter.site = Number(filterSite);
      if (filterService) population_filter.service = Number(filterService);
    }

    const payload = {
      name,
      template: Number(template) || null,
      description,
      start_date: startDate,
      due_date: dueDate,
      population_filter,
    };

    if (isEdit) {
      await api.put(`/campaigns/${id}/`, payload);
    } else {
      await api.post("/campaigns/", payload);
    }
    navigate("/campaigns");
  };

  return (
    <AppLayout>
      <Button variant="ghost" className="mb-4 gap-2" onClick={() => navigate("/campaigns")}>
        <ArrowLeft className="h-4 w-4" />
        Retour
      </Button>

      <h1 className="mb-6 text-center font-display text-2xl font-bold">
        {isEdit ? "Modifier" : "Nouvelle"} campagne
      </h1>

      <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
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
              <label className="mb-1.5 block text-sm font-medium">Type d'entretien</label>
              <select
                value={type}
                onChange={(e) => { setType(e.target.value); setTemplate(""); }}
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              >
                <option value="">Sélectionner...</option>
                <option value="annual">Évaluation</option>
                <option value="professional">Professionnel</option>
                <option value="bilan">Bilan</option>
                <option value="forfait">Forfait jours</option>
                <option value="fin_carriere">Fin de carrière</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Modèle</label>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              >
                <option value="">{type ? "Sélectionner un modèle..." : "Sélectionnez d'abord un type"}</option>
                {templates?.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Date de début</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Date limite</label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Population cible</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Filtrer par site</label>
                <select
                  value={filterSite}
                  onChange={(e) => { setFilterSite(e.target.value); setSelectedEmployees([]); }}
                  className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                >
                  <option value="">Tous les sites</option>
                  {sites?.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Filtrer par service</label>
                <select
                  value={filterService}
                  onChange={(e) => { setFilterService(e.target.value); setSelectedEmployees([]); }}
                  className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                >
                  <option value="">Tous les services</option>
                  {services?.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Ou sélectionner des employés spécifiques
                {selectedEmployees.length > 0 && (
                  <span className="ml-2 text-xs text-muted-foreground">({selectedEmployees.length} sélectionné{selectedEmployees.length > 1 ? "s" : ""})</span>
                )}
              </label>
              <div className="max-h-48 overflow-y-auto rounded-md border border-border">
                {allUsers?.filter((u) => u.statut === "actif").map((u) => (
                  <label key={u.id} className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50">
                    <input
                      type="checkbox"
                      checked={selectedEmployees.includes(u.id)}
                      onChange={() => { toggleEmployee(u.id); setFilterSite(""); setFilterService(""); }}
                      className="h-4 w-4"
                    />
                    {u.first_name} {u.last_name}
                    <span className="text-xs text-muted-foreground">({u.email})</span>
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2 pb-8">
          <Button type="button" variant="outline" onClick={() => navigate("/campaigns")}>
            Annuler
          </Button>
          <Button type="submit">{isEdit ? "Enregistrer" : "Créer"}</Button>
        </div>
      </form>
    </AppLayout>
  );
}
