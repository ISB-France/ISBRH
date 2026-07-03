import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Plus, X, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import AppLayout from "../components/AppLayout";
import api from "../api";
import type { Site, Service, Position, User } from "../types";

export default function UserForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  // Identité
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [sexe, setSexe] = useState("");
  const [dateNaissance, setDateNaissance] = useState("");
  const [telephone, setTelephone] = useState("");

  // Contrat
  const [matricule, setMatricule] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [dateSortie, setDateSortie] = useState("");
  const [typeContrat, setTypeContrat] = useState("");
  const [statut, setStatut] = useState("actif");
  const [coefficient, setCoefficient] = useState("");
  const [salaireBrut, setSalaireBrut] = useState("");
  const [forfaitJour, setForfaitJour] = useState(false);
  const [ticketsRestaurant, setTicketsRestaurant] = useState(false);
  const [cadre, setCadre] = useState(false);

  // Organisation
  const [role, setRole] = useState("employee");
  const [service, setService] = useState("");
  const [position, setPosition] = useState("");
  const [site, setSite] = useState("");
  const [manager, setManager] = useState("");
  const [managerSearch, setManagerSearch] = useState("");
  const [showManagerDropdown, setShowManagerDropdown] = useState(false);
  const [agenceInterim, setAgenceInterim] = useState("");

  // Inline creation states
  const [showNewService, setShowNewService] = useState(false);
  const [newServiceName, setNewServiceName] = useState("");
  const [showNewPosition, setShowNewPosition] = useState(false);
  const [newPositionName, setNewPositionName] = useState("");
  const { data: sites } = useQuery<Site[]>({
    queryKey: ["sites"],
    queryFn: () => api.get("/sites/").then((r) => r.data),
  });

  const { data: services } = useQuery<Service[]>({
    queryKey: ["services"],
    queryFn: () => api.get("/services/").then((r) => r.data),
  });

  const { data: positions } = useQuery<Position[]>({
    queryKey: ["positions"],
    queryFn: () => api.get("/positions/").then((r) => r.data),
  });

  const { data: allUsers } = useQuery<User[]>({
    queryKey: ["users-all"],
    queryFn: () => api.get("/users/").then((r) => r.data),
  });

  const filteredManagers = allUsers?.filter((u) => {
    const q = managerSearch.toLowerCase();
    return (
      u.id !== Number(id) &&
      u.statut === "actif" &&
      (`${u.first_name} ${u.last_name}`.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q))
    );
  });

  useEffect(() => {
    if (!id) {
      api.get("/users/next_matricule/").then((r) => {
        setMatricule(r.data.matricule);
      });
      return;
    }
    api.get(`/users/${id}/`).then((r) => {
      const d = r.data;

      setEmail(d.email);
      setFirstName(d.first_name);
      setLastName(d.last_name);
      setSexe(d.sexe ?? "");
      setDateNaissance(d.date_naissance ?? "");
      setTelephone(d.telephone ?? "");

      setMatricule(d.matricule ?? "");
      setHireDate(d.hire_date ?? "");
      setDateSortie(d.date_sortie ?? "");
      setTypeContrat(d.type_contrat ?? "");
      setStatut(d.statut ?? "actif");
      setCoefficient(d.coefficient ?? "");
      setSalaireBrut(d.salaire_brut ?? "");
      setForfaitJour(d.forfait_jour ?? false);
      setTicketsRestaurant(d.tickets_restaurant ?? false);
      setCadre(d.cadre ?? false);

      setRole(d.role);
      setService(d.service ?? "");
      setPosition(d.position ?? "");
      setSite(d.site ?? "");
      setManager(d.manager ?? "");
      setAgenceInterim(d.agence_interim ?? "");
    });
  }, [id]);

  // Inline creation handlers
  const handleCreateService = async () => {
    const name = newServiceName.trim();
    if (!name) return;
    const res = await api.post("/services/", { name });
    setService(String(res.data.id));
    setNewServiceName("");
    setShowNewService(false);
    queryClient.invalidateQueries({ queryKey: ["services"] });
  };

  const handleCreatePosition = async () => {
    const name = newPositionName.trim();
    if (!name) return;
    const res = await api.post("/positions/", { name });
    setPosition(String(res.data.id));
    setNewPositionName("");
    setShowNewPosition(false);
    queryClient.invalidateQueries({ queryKey: ["positions"] });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      email,
      first_name: firstName,
      last_name: lastName,
      sexe: sexe || "",
      date_naissance: dateNaissance || null,
      telephone,
      matricule,
      hire_date: hireDate || null,
      date_sortie: dateSortie || null,
      type_contrat: typeContrat || "",
      statut,
      coefficient,
      salaire_brut: salaireBrut || null,
      forfait_jour: forfaitJour,
      tickets_restaurant: ticketsRestaurant,
      cadre,
      role,
      service: service || null,
      position: position || null,
      site: site || null,
      manager: manager || null,
      agence_interim: agenceInterim,
    };
    if (isEdit) {
      await api.put(`/users/${id}/`, payload);
    } else {
      await api.post("/users/", payload);
    }
    navigate("/users");
  };

  const SelectField = ({
    label, value, onChange, options, placeholder,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
  }) => (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">{placeholder || "Sélectionner..."}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );

  const InlineCreateSelect = ({
    label, value, onChange, items, showNew, setShowNew, newName, setNewName, onCreate, placeholder,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    items?: { id: number; name: string }[];
    showNew: boolean;
    setShowNew: (v: boolean) => void;
    newName: string;
    setNewName: (v: string) => void;
    onCreate: () => void;
    placeholder?: string;
  }) => (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      {showNew ? (
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onCreate(); } }}
            placeholder={`Nouveau ${label.toLowerCase()}`}
            autoFocus
          />
          <Button type="button" size="icon" variant="default" onClick={onCreate} title="Créer">
            <Check className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" onClick={() => { setShowNew(false); setNewName(""); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-10 flex-1 rounded-md border border-border bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{placeholder || "Sélectionner..."}</option>
            {items?.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <Button type="button" size="icon" variant="outline" onClick={() => setShowNew(true)} title={`Ajouter ${label.toLowerCase()}`}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <AppLayout>
      <Button variant="ghost" className="mb-4 gap-2" onClick={() => navigate("/users")}>
        <ArrowLeft className="h-4 w-4" />
        Retour
      </Button>

      <h1 className="mb-6 text-center font-display text-2xl font-bold">
        {isEdit ? "Modifier" : "Nouvel"} utilisateur
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto">
        {/* Identité */}
        <Card>
          <CardHeader>
            <CardTitle>Identité</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Prénom <span className="text-red-500">*</span></label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Nom <span className="text-red-500">*</span></label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Email <span className="text-red-500">*</span></label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SelectField label="Sexe" value={sexe} onChange={setSexe} options={[
                { value: "homme", label: "Homme" },
                { value: "femme", label: "Femme" },
                { value: "non_binaire", label: "Non-Binaire" },
              ]} placeholder="" />
              <div>
                <label className="mb-1.5 block text-sm font-medium">Date de naissance</label>
                <Input type="date" value={dateNaissance} onChange={(e) => setDateNaissance(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Téléphone</label>
              <Input value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="0612345678" />
            </div>
          </CardContent>
        </Card>

        {/* Statut */}
        {isEdit && (
          <Card>
            <CardHeader>
              <CardTitle>Statut</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Compte actif</p>
                  <p className="text-xs text-muted-foreground">
                    {statut === "actif"
                      ? "L'utilisateur est actif et apparaît dans les sélections"
                      : statut === "inactif"
                        ? "L'utilisateur est inactif et n'apparaît plus dans les sélections (N+1, campagnes...)"
                        : "L'utilisateur est sorti de l'entreprise"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={statut === "actif" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatut("actif")}
                  >
                    Actif
                  </Button>
                  <Button
                    type="button"
                    variant={statut === "inactif" ? "default" : "outline"}
                    size="sm"
                    className={statut === "inactif" ? "bg-orange-500 hover:bg-orange-600" : ""}
                    onClick={() => setStatut("inactif")}
                  >
                    Inactif
                  </Button>
                  <Button
                    type="button"
                    variant={statut === "sortie" ? "default" : "outline"}
                    size="sm"
                    className={statut === "sortie" ? "bg-red-500 hover:bg-red-600" : ""}
                    onClick={() => setStatut("sortie")}
                  >
                    Sorti
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contrat */}
        <Card>
          <CardHeader>
            <CardTitle>Contrat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Matricule</label>
                <Input value={matricule} disabled className="bg-muted" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Date d'embauche</label>
                <Input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Date de sortie</label>
                <Input type="date" value={dateSortie} onChange={(e) => setDateSortie(e.target.value)} />
              </div>
              <SelectField label="Type de contrat" value={typeContrat} onChange={setTypeContrat} options={[
                { value: "cdi", label: "CDI" },
                { value: "cdd", label: "CDD" },
                { value: "interim", label: "Intérim" },
                { value: "alternance", label: "Alternance" },
                { value: "stage", label: "Stage" },
              ]} placeholder="" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Coefficient</label>
              <Input value={coefficient} onChange={(e) => setCoefficient(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Salaire brut mensuel</label>
              <Input type="number" step="0.01" value={salaireBrut} onChange={(e) => setSalaireBrut(e.target.value)} placeholder="0.00" />
            </div>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={forfaitJour} onChange={(e) => setForfaitJour(e.target.checked)} className="h-4 w-4" />
                Forfait jour
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={ticketsRestaurant} onChange={(e) => setTicketsRestaurant(e.target.checked)} className="h-4 w-4" />
                Tickets restaurant
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={cadre} onChange={(e) => setCadre(e.target.checked)} className="h-4 w-4" />
                Cadre
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Organisation */}
        <Card>
          <CardHeader>
            <CardTitle>Organisation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SelectField label="Rôle applicatif" value={role} onChange={setRole} options={[
              { value: "admin", label: "Admin" },
              { value: "rh", label: "RH" },
              { value: "manager", label: "Manager" },
              { value: "employee", label: "Employé" },
              { value: "stagiaire", label: "Stagiaire" },
              { value: "alternant", label: "Alternant" },
            ]} />
            <InlineCreateSelect
              label="Service"
              value={service}
              onChange={setService}
              items={services}
              showNew={showNewService}
              setShowNew={setShowNewService}
              newName={newServiceName}
              setNewName={setNewServiceName}
              onCreate={handleCreateService}
            />
            <InlineCreateSelect
              label="Poste"
              value={position}
              onChange={setPosition}
              items={positions}
              showNew={showNewPosition}
              setShowNew={setShowNewPosition}
              newName={newPositionName}
              setNewName={setNewPositionName}
              onCreate={handleCreatePosition}
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium">Site</label>
              <select
                value={site}
                onChange={(e) => setSite(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Sélectionner...</option>
                {sites?.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <label className="mb-1.5 block text-sm font-medium">N+1</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={managerSearch}
                  onChange={(e) => { setManagerSearch(e.target.value); setShowManagerDropdown(true); }}
                  onFocus={() => setShowManagerDropdown(true)}
                  placeholder="Rechercher un manager..."
                  className="pl-9"
                />
              </div>
              {showManagerDropdown && (
                <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-white shadow-lg">
                  {manager ? (
                    <div className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="font-medium">
                        {allUsers?.find((u) => String(u.id) === manager)?.first_name}{" "}
                        {allUsers?.find((u) => String(u.id) === manager)?.last_name}
                      </span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => { setManager(""); setManagerSearch(""); }}>
                        X
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="border-b border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                        {managerSearch ? "Résultats" : "Tous les utilisateurs"}
                      </div>
                      {filteredManagers?.length === 0 && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">Aucun résultat</div>
                      )}
                      {filteredManagers?.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50"
                          onClick={() => { setManager(String(u.id)); setManagerSearch(""); setShowManagerDropdown(false); }}
                        >
                          {u.first_name} {u.last_name}
                          <span className="ml-2 text-xs text-muted-foreground">{u.email}</span>
                        </button>
                      ))}
                    </>
                  )}
                  <div className="border-t border-border p-1">
                    <button
                      type="button"
                      className="w-full rounded px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted/50"
                      onClick={() => setShowManagerDropdown(false)}
                    >
                      Fermer
                    </button>
                  </div>
                </div>
              )}
            </div>
            {typeContrat === "interim" && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">Agence d'intérim</label>
                <Input value={agenceInterim} onChange={(e) => setAgenceInterim(e.target.value)} />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate("/users")}>
            Annuler
          </Button>
          <Button type="submit">{isEdit ? "Enregistrer" : "Créer"}</Button>
        </div>
      </form>
    </AppLayout>
  );
}
