"""Tests d'integration bout-en-bout couvrant les parcours critiques de
l'application (audit point 4) : creation utilisateur -> campagne -> generation
d'entretiens, isolation employee/manager, import CSV avec lignes invalides,
generation PDF, notifications."""

import copy
import datetime
import io

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from apps.interviews.models import Campaign, Interview, InterviewTemplate
from apps.interviews.templates import ANNUAL_TEMPLATE
from apps.users.models import Notification, Site, User


SECTIONS = [
    {
        "id": "s1",
        "title": "Section 1",
        "questions": [
            {"id": "q1", "label": "Question 1", "type": "textarea", "answer": ""},
        ],
    }
]


class EndToEndCampaignGenerationTests(TestCase):
    """Creation utilisateur -> manager -> campagne filtree par site ->
    generation -> l'entretien attendu existe bien."""

    def test_full_flow_creates_interview_for_targeted_employee(self):
        rh = User.objects.create_user(
            username="rh1", email="rh1@example.com", password="pass1234", role="rh"
        )
        site = Site.objects.create(name="Paris")
        manager = User.objects.create_user(
            username="mgr1", email="mgr1@example.com", password="pass1234",
            role="manager", site=site,
        )
        employee = User.objects.create_user(
            username="emp1", email="emp1@example.com", password="pass1234",
            role="employee", site=site, manager=manager,
        )
        other_site_employee = User.objects.create_user(
            username="emp2", email="emp2@example.com", password="pass1234",
            role="employee", site=Site.objects.create(name="Lyon"),
        )

        template = InterviewTemplate.objects.create(
            name="Entretien annuel", type="annual", sections=SECTIONS
        )
        campaign = Campaign.objects.create(
            name="Campagne 2026",
            template=template,
            start_date=datetime.date(2026, 1, 1),
            due_date=datetime.date(2026, 12, 31),
            population_filter={"site": site.id},
        )

        client = APIClient()
        client.force_authenticate(user=rh)
        response = client.post(f"/api/campaigns/{campaign.id}/generate/")
        self.assertEqual(response.status_code, 200, response.data)

        self.assertTrue(
            Interview.objects.filter(campaign=campaign, employee=employee).exists()
        )
        self.assertFalse(
            Interview.objects.filter(campaign=campaign, employee=other_site_employee).exists()
        )


class InterviewOwnershipTests(TestCase):
    def setUp(self):
        self.manager_a = User.objects.create_user(
            username="mgra", email="mgra@example.com", password="pass1234", role="manager"
        )
        self.manager_b = User.objects.create_user(
            username="mgrb", email="mgrb@example.com", password="pass1234", role="manager"
        )
        self.employee_a = User.objects.create_user(
            username="empa", email="empa@example.com", password="pass1234",
            role="employee", manager=self.manager_a,
        )
        self.employee_a2 = User.objects.create_user(
            username="empa2", email="empa2@example.com", password="pass1234",
            role="employee", manager=self.manager_a,
        )
        self.employee_b = User.objects.create_user(
            username="empb", email="empb@example.com", password="pass1234",
            role="employee", manager=self.manager_b,
        )
        self.interview_a = Interview.objects.create(
            employee=self.employee_a, manager=self.manager_a,
            type="annual", due_date=datetime.date(2026, 12, 31),
            content={"sections": SECTIONS},
        )
        self.interview_a2 = Interview.objects.create(
            employee=self.employee_a2, manager=self.manager_a,
            type="annual", due_date=datetime.date(2026, 12, 31),
            content={"sections": SECTIONS},
        )
        self.interview_b = Interview.objects.create(
            employee=self.employee_b, manager=self.manager_b,
            type="annual", due_date=datetime.date(2026, 12, 31),
            content={"sections": SECTIONS},
        )

    def test_employee_cannot_access_colleague_interview(self):
        client = APIClient()
        client.force_authenticate(user=self.employee_a2)
        response = client.get(f"/api/interviews/{self.interview_a.id}/")
        self.assertIn(response.status_code, (403, 404))

    def test_employee_can_access_own_interview(self):
        client = APIClient()
        client.force_authenticate(user=self.employee_a)
        response = client.get(f"/api/interviews/{self.interview_a.id}/")
        self.assertEqual(response.status_code, 200)

    def test_manager_can_access_own_team_interview(self):
        client = APIClient()
        client.force_authenticate(user=self.manager_a)
        response = client.get(f"/api/interviews/{self.interview_a.id}/")
        self.assertEqual(response.status_code, 200)

    def test_manager_cannot_access_other_team_interview(self):
        client = APIClient()
        client.force_authenticate(user=self.manager_a)
        response = client.get(f"/api/interviews/{self.interview_b.id}/")
        self.assertIn(response.status_code, (403, 404))

    def test_manager_list_scoped_to_own_team(self):
        client = APIClient()
        client.force_authenticate(user=self.manager_a)
        response = client.get("/api/interviews/")
        self.assertEqual(response.status_code, 200)
        returned_ids = {iv["id"] for iv in response.data}
        self.assertIn(self.interview_a.id, returned_ids)
        self.assertNotIn(self.interview_b.id, returned_ids)

    def test_manager_cannot_update_other_team_interview(self):
        client = APIClient()
        client.force_authenticate(user=self.manager_a)
        response = client.patch(
            f"/api/interviews/{self.interview_b.id}/", {"status": "completed"}, format="json"
        )
        self.assertIn(response.status_code, (403, 404))
        self.interview_b.refresh_from_db()
        self.assertEqual(self.interview_b.status, "draft")


class CSVImportRobustnessTests(TestCase):
    """L'import collaborateurs doit remonter les erreurs ligne par ligne
    sans planter tout l'import (colonnes manquantes, dates invalides,
    matricule duplique)."""

    def setUp(self):
        self.rh = User.objects.create_user(
            username="rh1", email="rh1@example.com", password="pass1234", role="rh"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.rh)

    def test_import_collaborateurs_with_missing_matricule_and_bad_date_reports_errors(self):
        csv_content = (
            "Matricule,Nom,Prénom,Date de naissance,Date d'entrée,Statut,Niveau,Coefficient,Poste,Fonctionnement\n"
            ",SANSMATRICULE,Jean,15/03/1985,01/09/2020,actif,III,250,Développeur,\n"
            "00000200,DATEINVALIDE,Alice,pas-une-date,01/09/2020,actif,II,200,Comptable,\n"
            "00000201,VALIDE,Bob,10/05/1990,01/01/2021,actif,I,100,Technicien,\n"
        )
        upload = SimpleUploadedFile(
            "collab.csv", csv_content.encode("utf-8-sig"), content_type="text/csv"
        )
        response = self.client.post(
            "/api/users/import_collaborateurs/", {"file": upload}, format="multipart"
        )
        self.assertEqual(response.status_code, 200, response.data)
        # La ligne sans matricule doit etre signalee comme erreur explicite.
        self.assertTrue(any("Matricule manquant" in e for e in response.data["errors"]))
        # La ligne valide doit malgre tout avoir ete creee (import partiel, pas de crash global).
        self.assertTrue(User.objects.filter(matricule="00000201").exists())

    def test_import_collaborateurs_duplicate_matricule_updates_instead_of_duplicating(self):
        csv_content = (
            "Matricule,Nom,Prénom,Date de naissance,Date d'entrée,Statut,Niveau,Coefficient,Poste,Fonctionnement\n"
            "00000300,DUPONT,Jean,15/03/1985,01/09/2020,actif,III,250,Développeur,\n"
            "00000300,DUPONT,Jean,15/03/1985,01/09/2020,actif,IV,300,Développeur senior,\n"
        )
        upload = SimpleUploadedFile(
            "collab.csv", csv_content.encode("utf-8-sig"), content_type="text/csv"
        )
        response = self.client.post(
            "/api/users/import_collaborateurs/", {"file": upload}, format="multipart"
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(User.objects.filter(matricule="00000300").count(), 1)
        user = User.objects.get(matricule="00000300")
        self.assertEqual(user.niveau, "IV")


class InterviewPdfTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user(
            username="mgr1", email="mgr1@example.com", password="pass1234", role="manager"
        )
        self.employee = User.objects.create_user(
            username="emp1", email="emp1@example.com", password="pass1234",
            role="employee", manager=self.manager,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.manager)

    def test_pdf_generation_for_complete_interview(self):
        interview = Interview.objects.create(
            employee=self.employee, manager=self.manager,
            type="annual", status="completed", due_date=datetime.date(2026, 12, 31),
            content={"sections": SECTIONS, "employee_snapshot": {}},
        )
        response = self.client.get(f"/api/interviews/{interview.id}/pdf/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")

    def test_pdf_generation_for_incomplete_interview_does_not_500(self):
        interview = Interview.objects.create(
            employee=self.employee, manager=self.manager,
            type="annual", status="draft", due_date=datetime.date(2026, 12, 31),
            content={},
        )
        response = self.client.get(f"/api/interviews/{interview.id}/pdf/")
        self.assertLess(response.status_code, 500)


class NotificationTests(TestCase):
    def test_creating_interview_notifies_manager(self):
        manager = User.objects.create_user(
            username="mgr1", email="mgr1@example.com", password="pass1234", role="manager"
        )
        employee = User.objects.create_user(
            username="emp1", email="emp1@example.com", password="pass1234",
            role="employee", manager=manager,
        )
        Interview.objects.create(
            employee=employee, manager=manager,
            type="annual", due_date=datetime.date(2026, 12, 31),
        )
        self.assertTrue(Notification.objects.filter(user=manager).exists())

    def test_check_upcoming_creates_reminder_for_due_soon_interview(self):
        manager = User.objects.create_user(
            username="mgr2", email="mgr2@example.com", password="pass1234", role="manager"
        )
        employee = User.objects.create_user(
            username="emp2", email="emp2@example.com", password="pass1234",
            role="employee", manager=manager,
        )
        due_soon = datetime.date.today() + datetime.timedelta(days=3)
        Interview.objects.create(
            employee=employee, manager=manager,
            type="annual", status="draft", due_date=due_soon,
        )
        out = io.StringIO()
        call_command("check_upcoming", stdout=out)
        self.assertTrue(
            Notification.objects.filter(
                user=manager, message__icontains="Échéance dans"
            ).exists()
        )


class GenerateExploitationInterviewsTests(TestCase):
    """Les collaborateurs en exploitation doivent recevoir un entretien
    d'evaluation et un entretien professionnel tous les 2 ans."""

    def test_employee_in_exploitation_without_history_gets_interviews_from_hire_date(self):
        manager = User.objects.create_user(
            username="mgr1", email="mgr1@example.com", password="pass1234", role="manager"
        )
        employee = User.objects.create_user(
            username="emp1", email="emp1@example.com", password="pass1234",
            role="employee", manager=manager, en_exploitation=True,
            hire_date=datetime.date.today() - datetime.timedelta(days=2 * 365),
        )
        out = io.StringIO()
        call_command("generate_exploitation_interviews", stdout=out)
        self.assertEqual(
            Interview.objects.filter(employee=employee, type="annual").count(), 1
        )
        self.assertEqual(
            Interview.objects.filter(employee=employee, type="professional").count(), 1
        )

    def test_employee_not_in_exploitation_gets_no_interview(self):
        manager = User.objects.create_user(
            username="mgr1", email="mgr1@example.com", password="pass1234", role="manager"
        )
        User.objects.create_user(
            username="emp1", email="emp1@example.com", password="pass1234",
            role="employee", manager=manager, en_exploitation=False,
            hire_date=datetime.date.today() - datetime.timedelta(days=2 * 365),
        )
        out = io.StringIO()
        call_command("generate_exploitation_interviews", stdout=out)
        self.assertEqual(Interview.objects.count(), 0)

    def test_employee_with_recent_hire_date_gets_no_interview_yet(self):
        manager = User.objects.create_user(
            username="mgr1", email="mgr1@example.com", password="pass1234", role="manager"
        )
        employee = User.objects.create_user(
            username="emp1", email="emp1@example.com", password="pass1234",
            role="employee", manager=manager, en_exploitation=True,
            hire_date=datetime.date.today() - datetime.timedelta(days=30),
        )
        out = io.StringIO()
        call_command("generate_exploitation_interviews", stdout=out)
        self.assertEqual(Interview.objects.filter(employee=employee).count(), 0)

    def test_command_is_idempotent_when_interview_already_pending(self):
        manager = User.objects.create_user(
            username="mgr1", email="mgr1@example.com", password="pass1234", role="manager"
        )
        employee = User.objects.create_user(
            username="emp1", email="emp1@example.com", password="pass1234",
            role="employee", manager=manager, en_exploitation=True,
            hire_date=datetime.date.today() - datetime.timedelta(days=2 * 365),
        )
        out = io.StringIO()
        call_command("generate_exploitation_interviews", stdout=out)
        call_command("generate_exploitation_interviews", stdout=out)
        self.assertEqual(
            Interview.objects.filter(employee=employee, type="annual").count(), 1
        )


class ImportHistoriqueTests(TestCase):
    """L'import d'historique d'entretiens doit lire le type ligne par ligne
    (colonne Type Entretien), avec repli sur le type par défaut transmis en
    paramètre de requête si la colonne est vide."""

    def setUp(self):
        self.rh = User.objects.create_user(
            username="rh1", email="rh1@example.com", password="pass1234", role="rh"
        )
        self.employee = User.objects.create_user(
            username="emp1", email="emp1@example.com", password="pass1234",
            role="employee", matricule="00000500",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.rh)

    def _upload(self, csv_content, data_extra=None):
        upload = SimpleUploadedFile(
            "historique.csv", csv_content.encode("utf-8-sig"), content_type="text/csv"
        )
        data = {"file": upload}
        if data_extra:
            data.update(data_extra)
        return self.client.post("/api/interviews/import_historique/", data, format="multipart")

    def test_type_column_per_row_is_used(self):
        csv_content = (
            "Matricule,État,Date prévue,Date de réalisation,Type Entretien\n"
            "00000500,Réalisé,01/06/2024,03/06/2024,Entretien professionnel\n"
        )
        response = self._upload(csv_content)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["created"], 1)
        interview = Interview.objects.get(employee=self.employee)
        self.assertEqual(interview.type, "professional")

    def test_type_column_accepts_internal_key(self):
        csv_content = (
            "Matricule,État,Date prévue,Date de réalisation,Type Entretien\n"
            "00000500,Réalisé,01/06/2024,03/06/2024,bilan\n"
        )
        response = self._upload(csv_content)
        self.assertEqual(response.status_code, 200, response.data)
        interview = Interview.objects.get(employee=self.employee)
        self.assertEqual(interview.type, "bilan")

    def test_missing_type_column_falls_back_to_default_type_param(self):
        csv_content = (
            "Matricule,État,Date prévue,Date de réalisation\n"
            "00000500,Réalisé,01/06/2024,03/06/2024\n"
        )
        response = self._upload(csv_content, {"type": "annual"})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["created"], 1)
        interview = Interview.objects.get(employee=self.employee)
        self.assertEqual(interview.type, "annual")

    def test_invalid_type_reports_row_error_without_crashing(self):
        csv_content = (
            "Matricule,État,Date prévue,Date de réalisation,Type Entretien\n"
            "00000500,Réalisé,01/06/2024,03/06/2024,Type inconnu\n"
        )
        response = self._upload(csv_content)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["created"], 0)
        self.assertTrue(any("type d'entretien" in e.lower() for e in response.data["errors"]))

    def test_header_case_and_accent_variations_are_tolerated(self):
        csv_content = (
            "Matricule,Etat,Date prévue,Date de réalisation,Type entretien\n"
            "00000500,Clôturé,10/04/2026,09/04/2026 15:24,Entretien d'évaluation\n"
        )
        response = self._upload(csv_content)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["created"], 1, response.data)
        interview = Interview.objects.get(employee=self.employee)
        self.assertEqual(interview.type, "annual")
        self.assertEqual(interview.status, "signed")
        self.assertEqual(str(interview.date_realisation), "2026-04-09")


LEGACY_OBJECTIFS_SECTION = {
    "id": "objectifs",
    "title": "Nouveaux objectifs pour l'année à venir",
    "questions": [
        {"id": "objectifs_metier", "label": "Objectifs métier", "type": "textarea", "answer": ""},
    ],
}


class BackfillObjectifTablesTests(TestCase):
    """La commande backfill_objectif_tables doit ajouter retroactivement
    les tableaux 'Objectif à évaluer' / 'Objectif à définir' aux entretiens
    annuels déjà créés (quel que soit leur statut, y compris brouillon),
    tant qu'ils ont une section 'objectifs'."""

    def setUp(self):
        self.manager = User.objects.create_user(
            username="mgr1", email="mgr1@example.com", password="pass1234", role="manager"
        )
        self.employee = User.objects.create_user(
            username="emp1", email="emp1@example.com", password="pass1234",
            role="employee", manager=self.manager,
        )
        self.template = InterviewTemplate.objects.create(
            name="Annuel", type="annual", sections=copy.deepcopy(ANNUAL_TEMPLATE["sections"]),
        )

    def _legacy_content(self):
        return {"sections": [copy.deepcopy(LEGACY_OBJECTIFS_SECTION)]}

    def test_backfill_adds_tables_to_draft_interview(self):
        interview = Interview.objects.create(
            employee=self.employee, manager=self.manager, type="annual",
            status="draft", due_date=datetime.date(2026, 12, 31),
            template=self.template, content=self._legacy_content(),
        )
        out = io.StringIO()
        call_command("backfill_objectif_tables", stdout=out)

        interview.refresh_from_db()
        section = next(s for s in interview.content["sections"] if s["id"] == "objectifs")
        question_ids = {q["id"] for q in section["questions"]}
        self.assertIn("objectif_a_evaluer", question_ids)
        self.assertIn("objectif_a_definir", question_ids)

    def test_backfill_adds_tables_to_completed_and_signed_interviews_too(self):
        for status in ("completed", "signed", "in_progress"):
            Interview.objects.create(
                employee=self.employee, manager=self.manager, type="annual",
                status=status, due_date=datetime.date(2026, 1, 1),
                template=self.template, content=self._legacy_content(),
            )
        call_command("backfill_objectif_tables", stdout=io.StringIO())
        for interview in Interview.objects.filter(employee=self.employee):
            section = next(s for s in interview.content["sections"] if s["id"] == "objectifs")
            question_ids = {q["id"] for q in section["questions"]}
            self.assertIn("objectif_a_evaluer", question_ids)
            self.assertIn("objectif_a_definir", question_ids)

    def test_backfill_creates_objectifs_section_when_missing(self):
        interview = Interview.objects.create(
            employee=self.employee, manager=self.manager, type="annual",
            status="draft", due_date=datetime.date(2026, 12, 31),
            template=self.template, content={"sections": [{"id": "autre", "title": "Autre", "questions": []}]},
        )
        call_command("backfill_objectif_tables", stdout=io.StringIO())
        interview.refresh_from_db()
        section_ids = [s["id"] for s in interview.content["sections"]]
        self.assertIn("objectifs", section_ids)
        self.assertIn("autre", section_ids)
        section = next(s for s in interview.content["sections"] if s["id"] == "objectifs")
        question_ids = {q["id"] for q in section["questions"]}
        self.assertIn("objectif_a_evaluer", question_ids)
        self.assertIn("objectif_a_definir", question_ids)

    def test_backfill_is_idempotent(self):
        Interview.objects.create(
            employee=self.employee, manager=self.manager, type="annual",
            status="draft", due_date=datetime.date(2026, 12, 31),
            template=self.template, content=self._legacy_content(),
        )
        call_command("backfill_objectif_tables", stdout=io.StringIO())
        out = io.StringIO()
        call_command("backfill_objectif_tables", stdout=out)
        self.assertIn("0 entretien", out.getvalue())

    def test_backfill_prefills_objectif_a_evaluer_from_previous_completed_definir(self):
        previous = Interview.objects.create(
            employee=self.employee, manager=self.manager, type="annual",
            status="completed", due_date=datetime.date(2025, 12, 31),
            template=self.template, content=self._legacy_content(),
        )
        prev_content = previous.content
        prev_content["sections"][0]["questions"].append({
            "id": "objectif_a_definir", "label": "Objectif à définir", "type": "table",
            "columns": [], "answer": [["Qualité", "Réduire les défauts"]],
        })
        previous.content = prev_content
        previous.save()

        current = Interview.objects.create(
            employee=self.employee, manager=self.manager, type="annual",
            status="draft", due_date=datetime.date(2026, 12, 31),
            template=self.template, content=self._legacy_content(),
        )
        call_command("backfill_objectif_tables", stdout=io.StringIO())

        current.refresh_from_db()
        section = next(s for s in current.content["sections"] if s["id"] == "objectifs")
        evaluer = next(q for q in section["questions"] if q["id"] == "objectif_a_evaluer")
        self.assertEqual(evaluer["answer"], [["Qualité", "Réduire les défauts"]])
