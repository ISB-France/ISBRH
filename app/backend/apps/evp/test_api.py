import datetime
from decimal import Decimal

from django.core.cache import cache as default_cache
from django.test import TestCase
from rest_framework.test import APIClient

from apps.evp.models import Absence, ClotureMensuelle, JourTravaille
from apps.users.models import User


class BadgeAuthTests(TestCase):
    def setUp(self):
        default_cache.clear()
        self.client = APIClient()
        self.manager_evp = User.objects.create_user(
            username="mgr1", email="mgr1@example.com", password="pass1234",
            role="manager", code_badge="BADGE001", is_manager_evp=True,
        )

    def test_valid_badge_manager_evp_returns_tokens(self):
        response = self.client.post("/api/evp/badge-auth/", {"code": "BADGE001"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["id"], self.manager_evp.id)

    def test_valid_badge_but_not_manager_evp_returns_generic_404(self):
        User.objects.create_user(
            username="mgr2", email="mgr2@example.com", password="pass1234",
            role="manager", code_badge="BADGE002", is_manager_evp=False,
        )
        response = self.client.post("/api/evp/badge-auth/", {"code": "BADGE002"}, format="json")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data["error"], "Badge non reconnu")

    def test_unknown_badge_returns_identical_generic_404(self):
        response = self.client.post("/api/evp/badge-auth/", {"code": "DOES-NOT-EXIST"}, format="json")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data["error"], "Badge non reconnu")

    def test_valid_badge_but_inactive_user_returns_generic_404(self):
        User.objects.create_user(
            username="mgr3", email="mgr3@example.com", password="pass1234",
            role="manager", code_badge="BADGE003", is_manager_evp=True, is_active=False,
        )
        response = self.client.post("/api/evp/badge-auth/", {"code": "BADGE003"}, format="json")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data["error"], "Badge non reconnu")

    def test_throttle_blocks_after_limit(self):
        responses = [
            self.client.post("/api/evp/badge-auth/", {"code": "whatever"}, format="json")
            for _ in range(11)
        ]
        self.assertEqual(responses[-1].status_code, 429)


class EvpApiOwnershipTests(TestCase):
    def setUp(self):
        self.manager_evp = User.objects.create_user(
            username="mgr1", email="mgr1@example.com", password="pass1234",
            role="manager", is_manager_evp=True,
        )
        self.own_employee = User.objects.create_user(
            username="emp1", email="emp1@example.com", password="pass1234",
            role="employee", manager=self.manager_evp,
        )
        self.other_manager = User.objects.create_user(
            username="mgr2", email="mgr2@example.com", password="pass1234",
            role="manager", is_manager_evp=True,
        )
        self.outsider_employee = User.objects.create_user(
            username="emp2", email="emp2@example.com", password="pass1234",
            role="employee", manager=self.other_manager,
        )
        self.jour_own = JourTravaille.objects.create(
            employee=self.own_employee, date=datetime.date(2026, 1, 5), organisation="jour",
        )
        self.jour_outsider = JourTravaille.objects.create(
            employee=self.outsider_employee, date=datetime.date(2026, 1, 5), organisation="jour",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.manager_evp)

    def test_cannot_list_jours_travailles_of_employee_outside_team(self):
        response = self.client.get(
            "/api/evp/jours-travailles/", {"employee": self.outsider_employee.id}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    def test_cannot_patch_jour_travaille_of_employee_outside_team(self):
        response = self.client.patch(
            f"/api/evp/jours-travailles/{self.jour_outsider.id}/",
            {"heures_travaillees_retenu": "5", "motif_modification": "test"},
            format="json",
        )
        self.assertIn(response.status_code, (403, 404))

    def test_can_list_and_patch_own_team_jour_travaille(self):
        response = self.client.get(
            "/api/evp/jours-travailles/", {"employee": self.own_employee.id}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

        response = self.client.patch(
            f"/api/evp/jours-travailles/{self.jour_own.id}/",
            {"heures_travaillees_retenu": "5", "motif_modification": "Oubli badgeage"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

    def test_non_manager_evp_gets_403_on_all_endpoints(self):
        plain_manager = User.objects.create_user(
            username="mgr3", email="mgr3@example.com", password="pass1234",
            role="manager", is_manager_evp=False,
        )
        client = APIClient()
        client.force_authenticate(user=plain_manager)

        self.assertEqual(client.get("/api/evp/jours-travailles/").status_code, 403)
        self.assertEqual(
            client.patch(f"/api/evp/jours-travailles/{self.jour_own.id}/", {}, format="json").status_code,
            403,
        )
        self.assertEqual(client.get("/api/evp/absences/").status_code, 403)
        self.assertEqual(client.post("/api/evp/absences/", {}, format="json").status_code, 403)
        self.assertEqual(
            client.get(
                "/api/evp/cloture-mensuelle/",
                {"employee": self.own_employee.id, "mois": 1, "annee": 2026},
            ).status_code,
            403,
        )


class JourTravailleCorrectionApiTests(TestCase):
    def setUp(self):
        self.manager_evp = User.objects.create_user(
            username="mgr1", email="mgr1@example.com", password="pass1234",
            role="manager", is_manager_evp=True,
        )
        self.employee = User.objects.create_user(
            username="emp1", email="emp1@example.com", password="pass1234",
            role="employee", manager=self.manager_evp,
        )
        self.jour = JourTravaille.objects.create(
            employee=self.employee, date=datetime.date(2026, 1, 5), organisation="jour",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.manager_evp)

    def test_patch_diverging_value_without_motif_rejected(self):
        response = self.client.patch(
            f"/api/evp/jours-travailles/{self.jour.id}/",
            {"heures_travaillees_retenu": "7"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("motif_modification", response.data)

    def test_patch_diverging_value_with_motif_accepted(self):
        response = self.client.patch(
            f"/api/evp/jours-travailles/{self.jour.id}/",
            {"heures_travaillees_retenu": "7", "motif_modification": "Panne badgeuse"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.jour.refresh_from_db()
        self.assertEqual(self.jour.heures_travaillees_retenu, Decimal("7.00"))
        self.assertTrue(self.jour.heures_travaillees_modifie_manuellement)

    def test_patch_blocked_when_month_closed_and_no_data_changed(self):
        ClotureMensuelle.objects.create(
            employee=self.employee, mois=1, annee=2026, statut=ClotureMensuelle.Statut.CLOTURE
        )
        response = self.client.patch(
            f"/api/evp/jours-travailles/{self.jour.id}/",
            {"heures_travaillees_retenu": "7", "motif_modification": "Panne badgeuse"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

        self.jour.refresh_from_db()
        self.assertEqual(self.jour.heures_travaillees_retenu, Decimal("0.00"))
        self.assertFalse(self.jour.heures_travaillees_modifie_manuellement)


class AbsenceApiTests(TestCase):
    def setUp(self):
        self.manager_evp = User.objects.create_user(
            username="mgr1", email="mgr1@example.com", password="pass1234",
            role="manager", is_manager_evp=True,
        )
        self.employee = User.objects.create_user(
            username="emp1", email="emp1@example.com", password="pass1234",
            role="employee", manager=self.manager_evp,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.manager_evp)

    def test_create_absence_in_closed_month_rejected(self):
        ClotureMensuelle.objects.create(
            employee=self.employee, mois=6, annee=2026, statut=ClotureMensuelle.Statut.CLOTURE
        )
        response = self.client.post(
            "/api/evp/absences/",
            {
                "employee": self.employee.id,
                "code_absence": "0951",
                "date_debut": "2026-06-05",
                "date_fin": "2026-06-10",
                "demi_journee": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Absence.objects.filter(employee=self.employee).exists())

    def test_create_absence_open_month_accepted(self):
        response = self.client.post(
            "/api/evp/absences/",
            {
                "employee": self.employee.id,
                "code_absence": "0951",
                "date_debut": "2026-06-05",
                "date_fin": "2026-06-10",
                "demi_journee": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["statut"], "en_attente")


class ClotureMensuelleStatutApiTests(TestCase):
    def setUp(self):
        self.manager_evp = User.objects.create_user(
            username="mgr1", email="mgr1@example.com", password="pass1234",
            role="manager", is_manager_evp=True,
        )
        self.employee = User.objects.create_user(
            username="emp1", email="emp1@example.com", password="pass1234",
            role="employee", manager=self.manager_evp,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.manager_evp)

    def test_no_cloture_row_returns_draft_not_404(self):
        response = self.client.get(
            "/api/evp/cloture-mensuelle/",
            {"employee": self.employee.id, "mois": 3, "annee": 2026},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["statut"], "draft")
