import datetime
import io
import os
import subprocess
import sys

from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.db import IntegrityError, connection
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from rest_framework_simplejwt.tokens import RefreshToken

from apps.users.models import Augmentation, Evolution, Formation, Position, User


class ProdSettingsSafetyTests(SimpleTestCase):
    """DEBUG=False ne doit jamais demarrer avec une SECRET_KEY ou un
    ALLOWED_HOSTS non explicitement configures (fallback dev dangereux)."""

    def _boot_with_env(self, overrides, unset=()):
        env = os.environ.copy()
        for key in unset:
            env.pop(key, None)
        env.update(overrides)
        env["DJANGO_SETTINGS_MODULE"] = "config.settings"
        return subprocess.run(
            [sys.executable, "-c", "import django; django.setup()"],
            cwd="/app",
            env=env,
            capture_output=True,
            text=True,
        )

    def test_boot_fails_in_prod_without_explicit_secret_key(self):
        result = self._boot_with_env(
            {"DEBUG": "False", "ALLOWED_HOSTS": "isboard.example.com"},
            unset=("DJANGO_SECRET_KEY",),
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("ImproperlyConfigured", result.stderr)
        self.assertIn("DJANGO_SECRET_KEY", result.stderr)

    def test_boot_fails_in_prod_with_wildcard_allowed_hosts(self):
        result = self._boot_with_env(
            {"DEBUG": "False", "DJANGO_SECRET_KEY": "a-real-secret-key"},
            unset=("ALLOWED_HOSTS",),
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("ImproperlyConfigured", result.stderr)
        self.assertIn("ALLOWED_HOSTS", result.stderr)

    def test_boot_succeeds_in_prod_with_explicit_config(self):
        result = self._boot_with_env(
            {
                "DEBUG": "False",
                "DJANGO_SECRET_KEY": "a-real-secret-key",
                "ALLOWED_HOSTS": "isboard.example.com",
            }
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_boot_succeeds_in_dev_with_defaults(self):
        result = self._boot_with_env(
            {"DEBUG": "True"}, unset=("DJANGO_SECRET_KEY", "ALLOWED_HOSTS")
        )
        self.assertEqual(result.returncode, 0, result.stderr)


class LogoutBlacklistsRefreshTokenTests(TestCase):
    """Le logout doit reellement invalider le refresh token (app
    token_blacklist installee), pas seulement renvoyer 204 sans effet."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="emp1", email="emp1@example.com", password="pass1234", role="employee"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_logout_blacklists_refresh_token(self):
        refresh = RefreshToken.for_user(self.user)
        response = self.client.post(
            "/api/auth/logout/", {"refresh": str(refresh)}, format="json"
        )
        self.assertEqual(response.status_code, 204)

        refresh_client = APIClient()
        refresh_response = refresh_client.post(
            "/api/token/refresh/", {"refresh": str(refresh)}, format="json"
        )
        self.assertEqual(refresh_response.status_code, 401)

    def test_logout_with_already_invalid_token_still_returns_204(self):
        response = self.client.post(
            "/api/auth/logout/", {"refresh": "not-a-valid-token"}, format="json"
        )
        self.assertEqual(response.status_code, 204)


class DevLoginViewTests(TestCase):
    """DevLoginView doit rester utilisable en dev (DEBUG=True) mais etre
    totalement inaccessible en production (DEBUG=False), et limiter le
    nombre de tentatives pour reduire la surface de brute-force."""

    def setUp(self):
        from django.core.cache import cache as default_cache

        default_cache.clear()
        self.user = User.objects.create_user(
            username="emp1", email="emp1@example.com", password="pass1234", role="employee"
        )
        self.client = APIClient()

    def test_dev_login_works_when_debug_true(self):
        with override_settings(DEBUG=True):
            response = self.client.post(
                "/api/auth/dev-login/",
                {"email": "emp1@example.com", "password": "pass1234"},
                format="json",
            )
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)

    def test_dev_login_disabled_when_debug_false(self):
        with override_settings(DEBUG=False):
            response = self.client.post(
                "/api/auth/dev-login/",
                {"email": "emp1@example.com", "password": "pass1234"},
                format="json",
            )
        self.assertEqual(response.status_code, 404)

    def test_dev_login_is_rate_limited(self):
        # DRF fige SimpleRateThrottle.THROTTLE_RATES a l'import du module, donc
        # on utilise le taux reellement configure en settings (5/min) plutot
        # que d'essayer de le surcharger dynamiquement via override_settings.
        with override_settings(DEBUG=True):
            payload = {"email": "emp1@example.com", "password": "wrong-password"}
            responses = [
                self.client.post("/api/auth/dev-login/", payload, format="json")
                for _ in range(6)
            ]
        self.assertEqual(responses[-1].status_code, 429)


class AdminRoleProtectionTests(TestCase):
    """Le role "admin" ne doit jamais pouvoir etre attribue via l'API, le
    formulaire, ou une modification directe en base qui contournerait le
    serializer."""

    def setUp(self):
        self.rh_user = User.objects.create_user(
            username="rh1", email="rh1@example.com", password="pass1234", role="rh"
        )
        self.target = User.objects.create_user(
            username="emp1", email="emp1@example.com", password="pass1234", role="employee"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.rh_user)

    def test_post_users_with_admin_role_rejected(self):
        payload = {
            "email": "newadmin@example.com",
            "first_name": "New",
            "last_name": "Admin",
            "role": "admin",
        }
        response = self.client.post("/api/users/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email="newadmin@example.com").exists())

    def test_patch_users_with_admin_role_rejected(self):
        response = self.client.patch(
            f"/api/users/{self.target.id}/", {"role": "admin"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.target.refresh_from_db()
        self.assertEqual(self.target.role, "employee")

    def test_model_save_blocked_without_superuser(self):
        self.target.role = "admin"
        with self.assertRaises(ValidationError):
            self.target.save()

    def test_direct_db_update_blocked_by_constraint(self):
        with self.assertRaises(IntegrityError):
            with connection.cursor() as cursor:
                cursor.execute(
                    "UPDATE users_user SET role = %s WHERE id = %s",
                    ["admin", self.target.id],
                )

    def test_superuser_can_have_admin_role(self):
        superuser = User.objects.create_superuser(
            username="root@example.com",
            email="root@example.com",
            password="pass1234",
            role="admin",
        )
        self.assertEqual(superuser.role, "admin")
        self.assertTrue(superuser.is_superuser)


def _csv_upload(name, content):
    return SimpleUploadedFile(name, content.encode("utf-8-sig"), content_type="text/csv")


class ImportDeduplicationTests(TestCase):
    """L'import collaborateurs sur un matricule deja cree par l'import Kostango
    doit mettre a jour le compte existant, pas en creer un second."""

    def setUp(self):
        self.rh_user = User.objects.create_user(
            username="rh1", email="rh1@example.com", password="pass1234", role="rh"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.rh_user)

    def test_import_collaborateurs_after_kostango_same_matricule_updates_not_duplicates(self):
        kostango_csv = (
            "personne email,Prénom,Nom,Matricule,Date de naissance\n"
            "jean.dupont@isb.fr,Jean,DUPONT,00000123,15/03/1985\n"
        )
        response = self.client.post(
            "/api/users/import_kostango/",
            {"file": _csv_upload("kostango.csv", kostango_csv)},
            format="multipart",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["created"], 1)
        self.assertEqual(User.objects.filter(matricule="00000123").count(), 1)

        collaborateurs_csv = (
            "Matricule,Nom,Prénom,Date de naissance,Date d'entrée,Statut,Niveau,Coefficient,Poste,Fonctionnement\n"
            "00000123,DUPONT,Jean,15/03/1985,01/09/2020,actif,III,250,Développeur,Forfait jour\n"
        )
        response = self.client.post(
            "/api/users/import_collaborateurs/",
            {"file": _csv_upload("collaborateurs.csv", collaborateurs_csv)},
            format="multipart",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["created"], 0)
        self.assertEqual(response.data["updated"], 1)

        self.assertEqual(User.objects.filter(matricule="00000123").count(), 1)
        jean = User.objects.get(matricule="00000123")
        self.assertEqual(jean.email, "jean.dupont@isb.fr")
        self.assertEqual(jean.niveau, "III")

    def test_import_collaborateurs_unknown_matricule_creates_temp_email_user(self):
        collaborateurs_csv = (
            "Matricule,Nom,Prénom,Date de naissance,Date d'entrée,Statut,Niveau,Coefficient,Poste,Fonctionnement\n"
            "00000999,MARTIN,Alice,10/05/1990,01/01/2021,actif,II,200,Comptable,\n"
        )
        response = self.client.post(
            "/api/users/import_collaborateurs/",
            {"file": _csv_upload("collaborateurs.csv", collaborateurs_csv)},
            format="multipart",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["created"], 1)
        alice = User.objects.get(matricule="00000999")
        self.assertEqual(alice.email, "00000999@collaborateur.isb.fr")


class DetectDuplicateUsersCommandTests(TestCase):
    def test_detects_simulated_duplicate(self):
        User.objects.create_user(
            username="jean.dupont@isb.fr",
            email="jean.dupont@isb.fr",
            password="pass1234",
            first_name="Jean",
            last_name="DUPONT",
            date_naissance=datetime.date(1985, 3, 15),
            matricule="00000123",
        )
        User.objects.create_user(
            username="collab_00000456",
            email="00000456@collaborateur.isb.fr",
            password="pass1234",
            first_name="Jean",
            last_name="DUPONT",
            date_naissance=datetime.date(1985, 3, 15),
            matricule="00000456",
        )

        out = io.StringIO()
        call_command("detect_duplicate_users", stdout=out)
        output = out.getvalue()

        self.assertIn("Doublon potentiel", output)
        self.assertIn("00000123", output)
        self.assertIn("00000456", output)
        self.assertIn("[email temporaire]", output)

    def test_no_duplicates_reports_clean(self):
        User.objects.create_user(
            username="solo@isb.fr",
            email="solo@isb.fr",
            password="pass1234",
            first_name="Solo",
            last_name="UNIQUE",
            date_naissance=datetime.date(1990, 1, 1),
        )
        out = io.StringIO()
        call_command("detect_duplicate_users", stdout=out)
        self.assertIn("Aucun doublon potentiel", out.getvalue())


class UserEvolutionTrackingTests(TestCase):
    def setUp(self):
        self.dev = Position.objects.create(name="Développeur")
        self.lead = Position.objects.create(name="Lead développeur")
        self.employee = User.objects.create_user(
            username="emp1",
            email="emp1@example.com",
            password="pass1234",
            role="employee",
            position=self.dev,
            statut="actif",
            niveau="II",
        )

    def test_position_change_creates_evolution_with_old_and_new_value(self):
        self.employee.position = self.lead
        self.employee.save()

        evolutions = Evolution.objects.filter(employee=self.employee, type_evolution="poste")
        self.assertEqual(evolutions.count(), 1)
        evolution = evolutions.first()
        self.assertEqual(evolution.ancienne_valeur, "Développeur")
        self.assertEqual(evolution.nouvelle_valeur, "Lead développeur")

    def test_multiple_field_changes_in_one_save_creates_multiple_evolutions(self):
        self.employee.position = self.lead
        self.employee.statut = "inactif"
        self.employee.niveau = "III"
        self.employee.save()

        types = set(
            Evolution.objects.filter(employee=self.employee).values_list(
                "type_evolution", flat=True
            )
        )
        self.assertEqual(types, {"poste", "statut", "niveau"})

    def test_no_change_creates_no_evolution(self):
        self.employee.first_name = "Meme"
        self.employee.save()

        self.assertEqual(Evolution.objects.filter(employee=self.employee).count(), 0)

    def test_evolutions_endpoint_returns_history_sorted_by_date(self):
        rh_user = User.objects.create_user(
            username="rh1", email="rh1@example.com", password="pass1234", role="rh"
        )
        client = APIClient()
        client.force_authenticate(user=rh_user)

        self.employee.position = self.lead
        self.employee.save()
        self.employee.statut = "inactif"
        self.employee.save()

        response = client.get(
            f"/api/users/{self.employee.id}/evolutions/", {"show_all_statuts": "1"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)
        returned_types = {item["type_evolution"] for item in response.data}
        self.assertEqual(returned_types, {"poste", "statut"})
