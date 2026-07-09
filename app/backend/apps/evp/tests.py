import datetime

from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.test import TestCase

from apps.evp.models import Absence, JourTravaille
from apps.users.models import User


EXPECTED_CODE_ABSENCE = {
    "0971": "APLD",
    "0951": "CP",
    "0950": "RTT",
    "2000": "Maladie",
    "2020": "Accident du travail",
    "1000": "Maladie professionnelle",
    "2010": "Maternité",
    "2040": "Paternité",
    "0990": "Événement familial",
    "0991": "Enfant malade",
    "0981": "Congé sans solde",
    "0978": "Absence justifiée et payée",
    "0977": "Absence non rémunérée",
    "0974": "Grève",
    "1040": "Accident de trajet",
    "0979": "Absence injustifiée",
}


class JourTravailleTests(TestCase):
    def setUp(self):
        self.employee = User.objects.create_user(
            username="emp1", email="emp1@example.com", password="pass1234", role="employee"
        )

    def test_creating_jour_travaille(self):
        jour = JourTravaille.objects.create(
            employee=self.employee,
            date=datetime.date(2026, 1, 5),
            heures_travaillees=8,
            organisation="jour",
        )
        self.assertEqual(jour.heures_nuit, 0)
        self.assertEqual(jour.heures_sup_payees, 0)

    def test_unique_together_employee_date(self):
        JourTravaille.objects.create(
            employee=self.employee,
            date=datetime.date(2026, 1, 5),
            heures_travaillees=8,
            organisation="jour",
        )
        with self.assertRaises(IntegrityError):
            JourTravaille.objects.create(
                employee=self.employee,
                date=datetime.date(2026, 1, 5),
                heures_travaillees=4,
                organisation="jour",
            )


class AbsenceTests(TestCase):
    def setUp(self):
        self.employee = User.objects.create_user(
            username="emp1", email="emp1@example.com", password="pass1234", role="employee"
        )

    def test_date_fin_before_date_debut_rejected(self):
        absence = Absence(
            employee=self.employee,
            code_absence=Absence.CodeAbsence.CP,
            date_debut=datetime.date(2026, 6, 10),
            date_fin=datetime.date(2026, 6, 5),
        )
        with self.assertRaises(ValidationError):
            absence.save()

    def test_valid_date_range_accepted(self):
        absence = Absence.objects.create(
            employee=self.employee,
            code_absence=Absence.CodeAbsence.CP,
            date_debut=datetime.date(2026, 6, 5),
            date_fin=datetime.date(2026, 6, 10),
        )
        self.assertEqual(absence.statut, "en_attente")

    def test_code_absence_choices_match_kostango_reference_exactly(self):
        actual = dict(Absence.CodeAbsence.choices)
        self.assertEqual(actual, EXPECTED_CODE_ABSENCE)
