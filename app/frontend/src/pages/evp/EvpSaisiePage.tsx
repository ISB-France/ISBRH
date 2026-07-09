import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { eachDayOfInterval, endOfMonth, format, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import api from "../../api";
import AppLayout from "../../components/AppLayout";
import { Button } from "../../components/ui/button";
import { Toast, useToast } from "../../components/Toast";
import { useInactivityLogout } from "../../hooks/useInactivityLogout";
import { ABSENCE_CODES } from "../../types";
import type { Absence, JourTravaille, User } from "../../types";
import {
  corrigerJourTravaille,
  creerAbsence,
  fetchAbsences,
  fetchClotureStatut,
  fetchJoursTravailles,
} from "./api";

// Déconnexion automatique du poste partagé après cette durée d'inactivité.
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

function logoutToBadgeScan(navigate: (path: string) => void) {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  navigate("/evp/badge");
}

export default function EvpSaisiePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast, show, setToast } = useToast();

  useInactivityLogout(INACTIVITY_TIMEOUT_MS, () => logoutToBadgeScan(navigate));

  const { data: currentUser } = useQuery<User>({
    queryKey: ["me"],
    queryFn: () => api.get("/auth/me/").then((r) => r.data),
  });

  const {
    data: employees,
    isLoading: loadingEmployees,
    isError: employeesError,
  } = useQuery<User[]>({
    queryKey: ["employees", "direct-reports", currentUser?.id],
    // Uniquement les N-1 directs du manager connecté (pas la hiérarchie
    // complète) : /api/users/ est déjà scopé par UserViewSet.get_queryset
    // aux subordonnés + soi-même pour un non-RH, et ?manager=<id> filtre
    // ensuite strictement aux rattachements directs à ce manager.
    // (/interviews/employees/ ne convient pas ici : il ne retourne quoi
    // que ce soit que pour les rôles rh/admin, vide sinon.)
    queryFn: () =>
      api.get("/users/", { params: { manager: currentUser!.id } }).then((r) => r.data),
    enabled: !!currentUser?.id,
  });

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [reference, setReference] = useState(() => new Date());
  const mois = reference.getMonth() + 1;
  const annee = reference.getFullYear();

  const days = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(reference), end: endOfMonth(reference) }),
    [reference],
  );

  const jourTravailleQuery = useQuery<JourTravaille[]>({
    queryKey: ["evp-jours-travailles", selectedEmployeeId, mois, annee],
    queryFn: () => fetchJoursTravailles(selectedEmployeeId as number, mois, annee),
    enabled: selectedEmployeeId !== null,
  });

  const absencesQuery = useQuery<Absence[]>({
    queryKey: ["evp-absences", selectedEmployeeId, mois, annee],
    queryFn: () => fetchAbsences(selectedEmployeeId as number, mois, annee),
    enabled: selectedEmployeeId !== null,
  });

  const clotureQuery = useQuery({
    queryKey: ["evp-cloture", selectedEmployeeId, mois, annee],
    queryFn: () => fetchClotureStatut(selectedEmployeeId as number, mois, annee),
    enabled: selectedEmployeeId !== null,
  });

  const moisFerme = clotureQuery.data?.statut === "cloture";

  const jourByDate = useMemo(() => {
    const map = new Map<string, JourTravaille>();
    (jourTravailleQuery.data ?? []).forEach((j) => map.set(j.date, j));
    return map;
  }, [jourTravailleQuery.data]);

  const absencesForDate = (dateKey: string) =>
    (absencesQuery.data ?? []).filter((a) => dateKey >= a.date_debut && dateKey <= a.date_fin);

  const [editing, setEditing] = useState<Record<number, { value: string; motif: string }>>({});
  const [showAbsenceForm, setShowAbsenceForm] = useState(false);
  const [absenceInput, setAbsenceInput] = useState({
    code_absence: ABSENCE_CODES[0].value,
    date_debut: format(reference, "yyyy-MM-dd"),
    date_fin: format(reference, "yyyy-MM-dd"),
    demi_journee: false,
  });

  const handleEditChange = (jourId: number, field: "value" | "motif", value: string) => {
    setEditing((prev) => ({
      ...prev,
      [jourId]: { value: prev[jourId]?.value ?? "", motif: prev[jourId]?.motif ?? "", [field]: value },
    }));
  };

  const saveCorrection = async (jour: JourTravaille) => {
    const edit = editing[jour.id];
    if (!edit) return;
    if (edit.value !== jour.heures_travaillees_retenu && !edit.motif.trim()) {
      show("Un motif est requis quand la valeur diffère du calcul automatique.", "error");
      return;
    }
    try {
      await corrigerJourTravaille(jour.id, {
        heures_travaillees_retenu: edit.value,
        motif: edit.motif,
      });
      show("Correction enregistrée.", "success");
      setEditing((prev) => {
        const next = { ...prev };
        delete next[jour.id];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["evp-jours-travailles"] });
    } catch (err: unknown) {
      let message = "Impossible d'enregistrer la correction.";
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { data?: { error?: string } } };
        message = axiosErr.response?.data?.error || message;
      }
      show(message, "error");
    }
  };

  const submitAbsence = async () => {
    if (!selectedEmployeeId) return;
    try {
      await creerAbsence({ employee: selectedEmployeeId, ...absenceInput });
      show("Absence enregistrée.", "success");
      setShowAbsenceForm(false);
      queryClient.invalidateQueries({ queryKey: ["evp-absences"] });
    } catch (err: unknown) {
      let message = "Impossible d'enregistrer l'absence.";
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { data?: { error?: string } } };
        message = axiosErr.response?.data?.error || message;
      }
      show(message, "error");
    }
  };

  const selectedEmployee = employees?.find((e) => e.id === selectedEmployeeId) ?? null;

  return (
    <AppLayout>
      <div className="space-y-6">
        {currentUser && !currentUser.is_manager_evp && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
            Ce compte n'a pas les droits manager EVP nécessaires pour accéder à la saisie.
          </div>
        )}

        {currentUser && currentUser.is_manager_evp && (
          <>
            <div className="rounded-lg border border-border bg-white p-4">
              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                Collaborateur
              </label>
              {loadingEmployees && <p className="text-sm text-muted-foreground">Chargement…</p>}
              {employeesError && (
                <p className="text-sm text-destructive">
                  Impossible de charger la liste des collaborateurs.
                </p>
              )}
              {employees && (
                <select
                  className="w-full max-w-sm rounded-md border border-border bg-white px-3 py-2 text-sm"
                  value={selectedEmployeeId ?? ""}
                  onChange={(e) => setSelectedEmployeeId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">— Sélectionner —</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedEmployeeId && (
              <div className="rounded-lg border border-border bg-white p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReference(new Date(annee, mois - 2, 1))}
                    >
                      ← Mois précédent
                    </Button>
                    <h2 className="text-lg font-semibold capitalize">
                      {format(reference, "MMMM yyyy", { locale: fr })}
                      {selectedEmployee ? ` — ${selectedEmployee.first_name} ${selectedEmployee.last_name}` : ""}
                    </h2>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReference(new Date(annee, mois, 1))}
                    >
                      Mois suivant →
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    disabled={moisFerme}
                    onClick={() => setShowAbsenceForm((s) => !s)}
                  >
                    + Absence
                  </Button>
                </div>

                {moisFerme && (
                  <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                    Ce mois est clôturé pour ce collaborateur : lecture seule, aucune
                    modification n'est possible.
                  </div>
                )}

                {showAbsenceForm && !moisFerme && (
                  <div className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-border bg-muted/30 p-3">
                    <select
                      className="rounded-md border border-border bg-white px-2 py-1.5 text-sm"
                      value={absenceInput.code_absence}
                      onChange={(e) =>
                        setAbsenceInput((s) => ({ ...s, code_absence: e.target.value }))
                      }
                    >
                      {ABSENCE_CODES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      className="rounded-md border border-border bg-white px-2 py-1.5 text-sm"
                      value={absenceInput.date_debut}
                      onChange={(e) =>
                        setAbsenceInput((s) => ({ ...s, date_debut: e.target.value }))
                      }
                    />
                    <input
                      type="date"
                      className="rounded-md border border-border bg-white px-2 py-1.5 text-sm"
                      value={absenceInput.date_fin}
                      onChange={(e) => setAbsenceInput((s) => ({ ...s, date_fin: e.target.value }))}
                    />
                    <label className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={absenceInput.demi_journee}
                        onChange={(e) =>
                          setAbsenceInput((s) => ({ ...s, demi_journee: e.target.checked }))
                        }
                      />
                      Demi-journée
                    </label>
                    <Button size="sm" onClick={submitAbsence}>
                      Enregistrer
                    </Button>
                  </div>
                )}

                {jourTravailleQuery.isLoading && (
                  <p className="text-sm text-muted-foreground">Chargement du planning…</p>
                )}
                {jourTravailleQuery.isError && (
                  <p className="text-sm text-destructive">
                    Impossible de charger les jours travaillés pour ce mois.
                  </p>
                )}

                {jourTravailleQuery.data && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                          <th className="py-2 pr-3">Date</th>
                          <th className="py-2 pr-3">Heures travaillées</th>
                          <th className="py-2 pr-3">Heures de nuit</th>
                          <th className="py-2 pr-3">Absence</th>
                          <th className="py-2 pr-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {days.map((day) => {
                          const dateKey = format(day, "yyyy-MM-dd");
                          const jour = jourByDate.get(dateKey);
                          const dayAbsences = absencesForDate(dateKey);
                          const edit = jour ? editing[jour.id] : undefined;

                          return (
                            <tr key={dateKey} className="border-b border-border/50">
                              <td className="py-2 pr-3 capitalize">
                                {format(day, "EEE dd/MM", { locale: fr })}
                              </td>
                              <td className="py-2 pr-3">
                                {jour ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      step="0.5"
                                      disabled={moisFerme}
                                      className="w-20 rounded-md border border-border px-2 py-1"
                                      value={edit?.value ?? jour.heures_travaillees_retenu}
                                      onChange={(e) =>
                                        handleEditChange(jour.id, "value", e.target.value)
                                      }
                                    />
                                    {jour.heures_travaillees_modifie_manuellement && (
                                      <span
                                        title={jour.heures_travaillees_motif_modification ?? ""}
                                        className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                                      >
                                        Modifié
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="py-2 pr-3">
                                {jour ? jour.heures_nuit_retenu : <span className="text-muted-foreground">—</span>}
                              </td>
                              <td className="py-2 pr-3">
                                {dayAbsences.map((a) => (
                                  <span
                                    key={a.id}
                                    className="mr-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
                                  >
                                    {ABSENCE_CODES.find((c) => c.value === a.code_absence)?.label ??
                                      a.code_absence}
                                  </span>
                                ))}
                              </td>
                              <td className="py-2 pr-3">
                                {jour && edit && !moisFerme && (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      placeholder="Motif de la correction"
                                      className="w-40 rounded-md border border-border px-2 py-1 text-xs"
                                      value={edit.motif}
                                      onChange={(e) =>
                                        handleEditChange(jour.id, "motif", e.target.value)
                                      }
                                    />
                                    <Button size="sm" onClick={() => saveCorrection(jour)}>
                                      Valider
                                    </Button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </AppLayout>
  );
}
