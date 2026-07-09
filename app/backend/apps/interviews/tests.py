import datetime
import io

from django.test import TestCase
from openpyxl import load_workbook
from rest_framework.test import APIClient

from apps.interviews.models import Campaign, Interview, InterviewTemplate
from apps.users.models import Site, User


SECTIONS_V1 = [
    {"id": "s1", "title": "Section 1", "questions": [{"id": "q1", "label": "Question 1", "type": "textarea", "answer": ""}]}
]
SECTIONS_V2 = [
    {"id": "s1", "title": "Section 1 modifiée", "questions": [{"id": "q1", "label": "Question 1 modifiée", "type": "textarea", "answer": ""}]}
]


class TemplateSnapshotTests(TestCase):
    def setUp(self):
        self.rh_user = User.objects.create_user(
            username="rh1", email="rh1@example.com", password="pass1234", role="rh"
        )
        self.employee = User.objects.create_user(
            username="emp1", email="emp1@example.com", password="pass1234", role="employee"
        )
        self.template = InterviewTemplate.objects.create(
            name="Template annuel", type="annual", sections=SECTIONS_V1
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.rh_user)

    def test_creating_interview_captures_template_snapshot(self):
        response = self.client.post(
            "/api/interviews/",
            {
                "employee": self.employee.id,
                "template": self.template.id,
                "type": "annual",
                "due_date": "2026-12-31",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        interview = Interview.objects.get(pk=response.data["id"])
        self.assertEqual(interview.template_snapshot, SECTIONS_V1)

    def test_modifying_template_after_creation_does_not_change_existing_snapshot(self):
        interview = Interview.objects.create(
            employee=self.employee,
            manager=self.rh_user,
            template=self.template,
            template_snapshot=list(self.template.sections),
            type="annual",
            due_date=datetime.date(2026, 12, 31),
        )

        self.template.sections = SECTIONS_V2
        self.template.save()

        interview.refresh_from_db()
        self.assertEqual(interview.template_snapshot, SECTIONS_V1)
        self.assertEqual(self.template.sections, SECTIONS_V2)

    def test_template_version_increments_on_sections_change(self):
        self.assertEqual(self.template.version, 1)

        self.template.sections = SECTIONS_V2
        self.template.save()
        self.template.refresh_from_db()
        self.assertEqual(self.template.version, 2)

        # Saving again without changing sections must not bump the version.
        self.template.name = "Template annuel (renommé)"
        self.template.save()
        self.template.refresh_from_db()
        self.assertEqual(self.template.version, 2)

    def test_template_version_increments_via_api_patch(self):
        response = self.client.patch(
            f"/api/interview-templates/{self.template.id}/",
            {"sections": SECTIONS_V2},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.template.refresh_from_db()
        self.assertEqual(self.template.version, 2)

    def test_effective_template_sections_falls_back_when_snapshot_missing(self):
        interview = Interview.objects.create(
            employee=self.employee,
            manager=self.rh_user,
            template=self.template,
            type="annual",
            due_date=datetime.date(2026, 12, 31),
        )
        self.assertIsNone(interview.template_snapshot)
        self.assertEqual(interview.get_effective_template_sections(), self.template.sections)

    def test_campaign_generate_captures_template_snapshot(self):
        campaign = Campaign.objects.create(
            name="Campagne annuelle",
            template=self.template,
            start_date=datetime.date(2026, 1, 1),
            due_date=datetime.date(2026, 12, 31),
            population_filter={"employees": [self.employee.id]},
        )
        response = self.client.post(f"/api/campaigns/{campaign.id}/generate/")
        self.assertEqual(response.status_code, 200, response.data)

        interview = Interview.objects.get(campaign=campaign, employee=self.employee)
        self.assertEqual(interview.template_snapshot, SECTIONS_V1)


class CampaignPopulationFilterValidationTests(TestCase):
    def setUp(self):
        self.rh_user = User.objects.create_user(
            username="rh1", email="rh1@example.com", password="pass1234", role="rh"
        )
        self.employee = User.objects.create_user(
            username="emp1", email="emp1@example.com", password="pass1234", role="employee"
        )
        self.site = Site.objects.create(name="Paris")
        self.template = InterviewTemplate.objects.create(
            name="Template annuel", type="annual", sections=SECTIONS_V1
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.rh_user)

    def _campaign_payload(self, population_filter):
        return {
            "name": "Campagne test",
            "template": self.template.id,
            "start_date": "2026-01-01",
            "due_date": "2026-12-31",
            "population_filter": population_filter,
        }

    def test_create_campaign_with_unknown_site_id_rejected(self):
        response = self.client.post(
            "/api/campaigns/", self._campaign_payload({"site": 999999}), format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("population_filter", response.data)

    def test_create_campaign_with_unknown_employee_id_rejected(self):
        response = self.client.post(
            "/api/campaigns/", self._campaign_payload({"employees": [999999]}), format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("population_filter", response.data)

    def test_create_campaign_with_valid_filter_accepted(self):
        response = self.client.post(
            "/api/campaigns/",
            self._campaign_payload({"site": self.site.id, "employees": [self.employee.id]}),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)

    def test_update_campaign_with_unknown_site_id_rejected(self):
        campaign = Campaign.objects.create(
            name="Campagne",
            template=self.template,
            start_date=datetime.date(2026, 1, 1),
            due_date=datetime.date(2026, 12, 31),
            population_filter={},
        )
        response = self.client.patch(
            f"/api/campaigns/{campaign.id}/",
            {"population_filter": {"service": 999999}},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("population_filter", response.data)

    def test_generate_with_no_matching_employees_returns_explicit_error(self):
        other_site = Site.objects.create(name="Lyon")
        campaign = Campaign.objects.create(
            name="Campagne vide",
            template=self.template,
            start_date=datetime.date(2026, 1, 1),
            due_date=datetime.date(2026, 12, 31),
            population_filter={"site": other_site.id},
        )
        response = self.client.post(f"/api/campaigns/{campaign.id}/generate/")
        self.assertEqual(response.status_code, 400)
        self.assertIn("Aucun collaborateur", response.data.get("error", ""))
        self.assertEqual(Interview.objects.filter(campaign=campaign).count(), 0)


class InterviewManagerDeletionTests(TestCase):
    """Supprimer le manager d'un entretien ne doit plus supprimer
    l'entretien en cascade : le manager doit passer a null."""

    def test_deleting_manager_sets_interview_manager_to_null_instead_of_deleting_it(self):
        manager = User.objects.create_user(
            username="mgr1", email="mgr1@example.com", password="pass1234", role="manager"
        )
        employee = User.objects.create_user(
            username="emp1", email="emp1@example.com", password="pass1234",
            role="employee", manager=manager,
        )
        interview = Interview.objects.create(
            employee=employee, manager=manager,
            type="annual", due_date=datetime.date(2026, 12, 31),
        )

        manager.delete()

        interview.refresh_from_db()
        self.assertIsNone(interview.manager_id)
        self.assertTrue(Interview.objects.filter(pk=interview.pk).exists())


class InterviewEmployeeDeletionTests(TestCase):
    """Un employe ayant un historique d'entretiens ne doit pas pouvoir etre
    supprime silencieusement (PROTECT) : la suppression doit echouer
    explicitement plutot que de detruire l'historique en cascade."""

    def test_deleting_employee_with_interview_history_is_blocked(self):
        from django.db.models import ProtectedError

        manager = User.objects.create_user(
            username="mgr1", email="mgr1@example.com", password="pass1234", role="manager"
        )
        employee = User.objects.create_user(
            username="emp1", email="emp1@example.com", password="pass1234",
            role="employee", manager=manager,
        )
        interview = Interview.objects.create(
            employee=employee, manager=manager,
            type="annual", due_date=datetime.date(2026, 12, 31),
        )

        with self.assertRaises(ProtectedError):
            employee.delete()

        self.assertTrue(Interview.objects.filter(pk=interview.pk).exists())
        self.assertTrue(User.objects.filter(pk=employee.pk).exists())


class ExcelExportFormulaInjectionTests(TestCase):
    """Une reponse d'entretien commencant par un caractere declencheur de
    formule (=, +, -, @) ne doit pas etre ecrite telle quelle dans l'export
    Excel : elle doit etre neutralisee (prefixee par une apostrophe)."""

    def test_malicious_answer_is_sanitized_in_contents_export(self):
        rh_user = User.objects.create_user(
            username="rh1", email="rh1@example.com", password="pass1234", role="rh"
        )
        manager = User.objects.create_user(
            username="mgr1", email="mgr1@example.com", password="pass1234", role="manager"
        )
        employee = User.objects.create_user(
            username="emp1", email="emp1@example.com", password="pass1234",
            role="employee", manager=manager,
        )
        campaign = Campaign.objects.create(
            name="Campagne export",
            start_date=datetime.date(2026, 1, 1),
            due_date=datetime.date(2026, 12, 31),
        )
        Interview.objects.create(
            employee=employee, manager=manager, campaign=campaign,
            type="annual", due_date=datetime.date(2026, 12, 31),
            content={
                "sections": [
                    {
                        "id": "s1",
                        "title": "Section 1",
                        "questions": [
                            {
                                "id": "q1",
                                "label": "Commentaire",
                                "type": "textarea",
                                "answer": "=cmd|'/c calc'!A0",
                            }
                        ],
                    }
                ]
            },
        )

        client = APIClient()
        client.force_authenticate(user=rh_user)
        response = client.get(f"/api/campaigns/{campaign.id}/export_contents_xlsx/")
        self.assertEqual(response.status_code, 200)

        wb = load_workbook(io.BytesIO(response.content))
        ws = wb.active
        answer_col = None
        for cell in ws[1]:
            if cell.value == "Commentaire":
                answer_col = cell.column
        self.assertIsNotNone(answer_col)

        cell_value = ws.cell(row=2, column=answer_col).value
        self.assertTrue(cell_value.startswith("'="))
        self.assertIn("cmd", cell_value)


class InterviewTemplateSectionsValidationTests(TestCase):
    """InterviewTemplate.sections doit respecter une structure minimale
    (id/title/questions, question id/label/type) plutot que d'accepter
    n'importe quel JSON."""

    def setUp(self):
        self.rh_user = User.objects.create_user(
            username="rh1", email="rh1@example.com", password="pass1234", role="rh"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.rh_user)

    def _payload(self, sections):
        return {"name": "Template test", "type": "annual", "sections": sections}

    def test_valid_sections_accepted(self):
        response = self.client.post("/api/interview-templates/", self._payload(SECTIONS_V1), format="json")
        self.assertEqual(response.status_code, 201, response.data)

    def test_section_missing_id_rejected(self):
        sections = [{"title": "Section sans id", "questions": []}]
        response = self.client.post("/api/interview-templates/", self._payload(sections), format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("sections", response.data)

    def test_section_with_non_list_questions_rejected(self):
        sections = [{"id": "s1", "title": "Section", "questions": "pas une liste"}]
        response = self.client.post("/api/interview-templates/", self._payload(sections), format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("sections", response.data)

    def test_question_missing_label_rejected(self):
        sections = [{"id": "s1", "title": "Section", "questions": [{"id": "q1"}]}]
        response = self.client.post("/api/interview-templates/", self._payload(sections), format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("sections", response.data)

    def test_question_with_invalid_type_rejected(self):
        sections = [
            {
                "id": "s1", "title": "Section",
                "questions": [{"id": "q1", "label": "Q1", "type": "not-a-real-type"}],
            }
        ]
        response = self.client.post("/api/interview-templates/", self._payload(sections), format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("sections", response.data)
