export interface Site {
  id: number;
  name: string;
}

export interface Service {
  id: number;
  name: string;
}

export interface Position {
  id: number;
  name: string;
}

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: "admin" | "rh" | "manager" | "employee" | "stagiaire" | "alternant";

  // Identité
  sexe: "" | "homme" | "femme" | "non_binaire";
  date_naissance: string | null;
  telephone: string;
  photo: string | null;

  // Contrat
  matricule: string;
  hire_date: string | null;
  date_sortie: string | null;
  type_contrat: "" | "cdi" | "cdd" | "interim" | "alternance" | "stage";
  statut: "actif" | "inactif" | "sortie";
  coefficient: string;
  niveau: string;
  fonctionnement: string;
  salaire_brut: number | null;
  forfait_jour: boolean;
  tickets_restaurant: boolean;
  cadre: boolean;

  // Organisation
  service: number | null;
  service_name: string;
  position: number | null;
  position_name: string;
  site: number | null;
  site_name: string;
  manager: number | null;
  manager_name: string | null;
  agence_interim: string;
  icon: string;
  preferences: string;
  code_badge: string | null;
  is_manager_evp: boolean;
}

export interface Campaign {
  id: number;
  name: string;
  template: number | null;
  description: string;
  start_date: string;
  due_date: string;
  population_filter: Record<string, unknown>;
  interview_count: number;
  created_at: string;
  updated_at: string;
}

export interface InterviewTemplate {
  id: number;
  name: string;
  type: "annual" | "professional" | "bilan" | "forfait" | "fin_carriere";
  description: string;
  sections: Section[];
  created_at: string;
  updated_at: string;
}

export interface Section {
  id: string;
  title: string;
  questions: Question[];
}

export interface TableColumn {
  id: string;
  label: string;
  type: "textarea" | "rating";
}

export interface Question {
  id: string;
  label: string;
  type: "textarea" | "rating" | "table" | "yesno";
  answer?: string | number | boolean | null | (string | number | null)[][];
  columns?: TableColumn[];
}

export interface Interview {
  id: number;
  employee: number;
  employee_detail: User;
  manager: number;
  manager_detail: User;
  campaign: number | null;
  template: number | null;
  template_name: string;
  employee_manager_id: number | null;
  employee_manager_name: string | null;
  type: "annual" | "professional" | "bilan" | "forfait" | "fin_carriere";
  status: "draft" | "in_progress" | "completed" | "signed" | "cancelled";
  due_date: string;
  content: Record<string, unknown>;
  previous_content: Section[];
  career: CareerStep[];
  history: HistoryStep[];
  training_history: TrainingEntry[];
  salary_history: SalaryEntry[];
  document_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CareerStep {
  date: string;
  type: string;
  type_label: string;
  position: string | null;
  service: string | null;
  site: string | null;
  coefficient: string | null;
}

export interface HistoryStep {
  date: string;
  type: string;
  type_label: string;
  status: string;
  status_label: string;
  manager_name: string;
}

export interface TrainingEntry {
  date: string;
  type: string;
  entries: { label: string; answer: string }[];
}

export interface SalaryEntry {
  date: string;
  type: string;
  salary: string | null;
  coefficient: string | null;
}

export interface Notification {
  id: number;
  message: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

export interface InterviewStats {
  total: number;
  by_status: { status: string; count: number }[];
  by_type: { type: string; count: number }[];
  overdue: number;
  upcoming: number;
}

// --- EVP (Éléments Variables de Paie) ---
// NOTE: les endpoits /api/evp/* consommés par ce module ne sont pas encore
// implémentés côté backend (seuls les modèles Django existent à ce stade).
// Ces types décrivent le contrat provisoire attendu par le frontend — voir
// src/pages/evp/api.ts pour le détail par endpoint.

export const ABSENCE_CODES: { value: string; label: string }[] = [
  { value: "0971", label: "APLD" },
  { value: "0951", label: "Congé payé" },
  { value: "0950", label: "RTT" },
  { value: "2000", label: "Maladie" },
  { value: "2020", label: "Accident du travail" },
  { value: "1000", label: "Maladie professionnelle" },
  { value: "2010", label: "Maternité" },
  { value: "2040", label: "Paternité" },
  { value: "0990", label: "Événement familial" },
  { value: "0991", label: "Enfant malade" },
  { value: "0981", label: "Congé sans solde" },
  { value: "0978", label: "Absence justifiée et payée" },
  { value: "0977", label: "Absence non rémunérée" },
  { value: "0974", label: "Grève" },
  { value: "1040", label: "Accident de trajet" },
  { value: "0979", label: "Absence injustifiée" },
];

export interface JourTravaille {
  id: number;
  employee: number;
  date: string; // YYYY-MM-DD
  organisation: "jour" | "equipe" | "nuit";
  heures_travaillees_calcule: string;
  heures_travaillees_retenu: string;
  heures_travaillees_modifie_manuellement: boolean;
  heures_travaillees_motif_modification: string | null;
  heures_nuit_calcule: string;
  heures_nuit_retenu: string;
  heures_nuit_modifie_manuellement: boolean;
  heures_nuit_motif_modification: string | null;
  heures_sup_payees: string;
  heures_sup_recuperees: string;
}

export interface Absence {
  id: number;
  employee: number;
  code_absence: string;
  date_debut: string;
  date_fin: string;
  demi_journee: boolean;
  statut: "en_attente" | "validee" | "refusee";
}

export interface ClotureStatut {
  employee: number;
  mois: number;
  annee: number;
  statut: "draft" | "cloture";
}
