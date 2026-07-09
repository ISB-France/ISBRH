import api from "../../api";
import type { Absence, ClotureStatut, JourTravaille } from "../../types";

/**
 * Contrat d'API provisoire pour le module EVP.
 *
 * STATUT : SEUL /api/evp/badge-auth/ a été explicitement validé avec
 * l'équipe avant d'écrire ce fichier (contrat confirmé : POST { code } ->
 * { access, refresh, user } | 401/404 { error }). Le périmètre équipe
 * réutilise /api/interviews/employees/, déjà existant, tel que confirmé.
 *
 * Tous les AUTRES endpoints ci-dessous (jours-travailles, absences,
 * cloture) NE SONT PAS ENCORE IMPLÉMENTÉS côté backend — seuls les modèles
 * Django existent (apps/evp/models.py). Ce fichier centralise le contrat
 * provisoire attendu pour que l'implémentation réelle n'ait qu'un seul
 * endroit à corriger si la forme définitive diffère. Ne pas considérer ces
 * routes comme fonctionnelles avant que l'API evp soit construite.
 */

export interface BadgeAuthResponse {
  access: string;
  refresh: string;
  user: { id: number; first_name: string; last_name: string; role: string };
}

export async function badgeAuth(code: string): Promise<BadgeAuthResponse> {
  const res = await api.post("/evp/badge-auth/", { code });
  return res.data;
}

// --- Endpoints ci-dessous : contrat provisoire, backend à construire ---

export async function fetchJoursTravailles(
  employeeId: number,
  mois: number,
  annee: number,
): Promise<JourTravaille[]> {
  const res = await api.get("/evp/jours-travailles/", {
    params: { employee: employeeId, mois, annee },
  });
  return res.data;
}

export async function fetchAbsences(
  employeeId: number,
  mois: number,
  annee: number,
): Promise<Absence[]> {
  const res = await api.get("/evp/absences/", {
    params: { employee: employeeId, mois, annee },
  });
  return res.data;
}

export async function fetchClotureStatut(
  employeeId: number,
  mois: number,
  annee: number,
): Promise<ClotureStatut> {
  const res = await api.get("/evp/cloture-mensuelle/", {
    params: { employee: employeeId, mois, annee },
  });
  return res.data;
}

export interface JourTravailleCorrection {
  heures_travaillees_retenu?: string;
  heures_nuit_retenu?: string;
  motif: string;
}

export async function corrigerJourTravaille(
  jourId: number,
  correction: JourTravailleCorrection,
): Promise<JourTravaille> {
  // Le backend attend "motif_modification" (nom exact du champ modèle) —
  // "motif" ici est juste plus court à manier côté composant.
  const { motif, ...rest } = correction;
  const res = await api.patch(`/evp/jours-travailles/${jourId}/`, {
    ...rest,
    motif_modification: motif,
  });
  return res.data;
}

export interface AbsenceInput {
  employee: number;
  code_absence: string;
  date_debut: string;
  date_fin: string;
  demi_journee: boolean;
}

export async function creerAbsence(input: AbsenceInput): Promise<Absence> {
  const res = await api.post("/evp/absences/", input);
  return res.data;
}
