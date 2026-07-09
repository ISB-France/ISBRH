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
