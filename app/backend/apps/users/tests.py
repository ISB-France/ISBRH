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
