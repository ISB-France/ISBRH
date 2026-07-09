import datetime
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.db import IntegrityError
from django.test import TestCase

from apps.evp.models import (
    Absence,
    ClotureMensuelle,
    CompteurRH,
    CorrectionManuelle,
    JourTravaille,
    MoisClotureError,
    PrimeCalculee,
)
from apps.evp.services.correction import enregistrer_correction_manuelle
from apps.users.models import User


EXPECTED_CODE_ABSENCE_VALUES = {
    "0971", "0951", "0950", "2000", "2020", "1000", "2010", "2040",
    "0990", "0991", "0981", "0978", "0977", "0974", "1040", "0979",
}


class JourTravailleTests(TestCase):
    def setUp(self):
        self.employee = User.objects.create_user(
            username="emp1", email="emp1@example.com", password="pass1234", role="employee"
        )

    def test_unique_together_employee_date(self):
        JourTravaille.objects.create(
            employee=self.employee,
            date=datetime.date(2026, 1, 5),
            organisation="jour",
        )
        with self.assertRaises(IntegrityError):
            JourTravaille.objects.create(
                employee=self.employee,
                date=datetime.date(2026, 1, 5),
                organisation="jour",
            )

    def test_retenu_syncs_automatically_to_calcule_on_first_recalcul(self):
        jour = JourTravaille.objects.create(
            employee=self.employee,
            date=datetime.date(2026, 1, 5),
            organisation="jour",
        )
        jour.recalculer()
        jour.refresh_from_db()
        self.assertEqual(jour.heures_travaillees_retenu, jour.heures_travaillees_calcule)
        self.assertEqual(jour.heures_nuit_retenu, jour.heures_nuit_calcule)
        self.assertFalse(jour.heures_travaillees_modifie_manuellement)

    def test_recalculer_does_not_touch_retenu_once_modified_manually(self):
        jour = JourTravaille.objects.create(
            employee=self.employee,
            date=datetime.date(2026, 1, 5),
            organisation="jour",
        )
        jour.recalculer()

        enregistrer_correction_manuelle(
            jour, "heures_travaillees_retenu", Decimal("3.5"), "Badge en panne", self.employee
        )
        jour.refresh_from_db()
        self.assertTrue(jour.heures_travaillees_modifie_manuellement)
        self.assertEqual(jour.heures_travaillees_retenu, Decimal("3.50"))

        ancien_retenu = jour.heures_travaillees_retenu
        jour.recalculer()
        jour.refresh_from_db()
        # calcule peut changer (recalcule) mais retenu doit rester figé sur
        # la correction manuelle.
        self.assertEqual(jour.heures_travaillees_retenu, ancien_retenu)

    def test_correction_manuelle_is_traced(self):
        jour = JourTravaille.objects.create(
            employee=self.employee,
            date=datetime.date(2026, 1, 5),
            organisation="jour",
        )
        jour.recalculer()

        enregistrer_correction_manuelle(
            jour, "heures_travaillees_retenu", Decimal("6"), "Oubli de saisie", self.employee
        )

        correction = CorrectionManuelle.objects.get(
            object_id=jour.pk, champ_modifie="heures_travaillees_retenu"
        )
        self.assertEqual(correction.ancienne_valeur, "0")
        self.assertEqual(correction.nouvelle_valeur, "6")
        self.assertEqual(correction.motif, "Oubli de saisie")
        self.assertEqual(correction.corrige_par, self.employee)


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
        actual_values = {value for value, _label in Absence.CodeAbsence.choices}
        self.assertEqual(actual_values, EXPECTED_CODE_ABSENCE_VALUES)


class ClotureMensuelleTests(TestCase):
    def setUp(self):
        self.employee = User.objects.create_user(
            username="emp1", email="emp1@example.com", password="pass1234", role="employee"
        )

    def test_unique_together_employee_mois_annee(self):
        ClotureMensuelle.objects.create(employee=self.employee, mois=1, annee=2026)
        with self.assertRaises(IntegrityError):
            ClotureMensuelle.objects.create(employee=self.employee, mois=1, annee=2026)

    def test_jour_travaille_cannot_be_modified_once_month_closed(self):
        jour = JourTravaille.objects.create(
            employee=self.employee,
            date=datetime.date(2026, 1, 5),
            organisation="jour",
        )
        ClotureMensuelle.objects.create(
            employee=self.employee, mois=1, annee=2026, statut=ClotureMensuelle.Statut.CLOTURE
        )

        jour.heures_sup_payees = Decimal("2")
        with self.assertRaises(MoisClotureError):
            jour.save()

    def test_jour_travaille_recalculer_is_blocked_once_month_closed(self):
        jour = JourTravaille.objects.create(
            employee=self.employee,
            date=datetime.date(2026, 1, 5),
            organisation="jour",
        )
        ClotureMensuelle.objects.create(
            employee=self.employee, mois=1, annee=2026, statut=ClotureMensuelle.Statut.CLOTURE
        )
        with self.assertRaises(MoisClotureError):
            jour.recalculer()

    def test_absence_cannot_be_modified_once_month_closed(self):
        ClotureMensuelle.objects.create(
            employee=self.employee, mois=6, annee=2026, statut=ClotureMensuelle.Statut.CLOTURE
        )
        absence = Absence(
            employee=self.employee,
            code_absence=Absence.CodeAbsence.CP,
            date_debut=datetime.date(2026, 6, 5),
            date_fin=datetime.date(2026, 6, 10),
        )
        with self.assertRaises(MoisClotureError):
            absence.save()

    def test_prime_calculee_cannot_be_modified_once_month_closed(self):
        prime = PrimeCalculee.objects.create(
            employee=self.employee,
            date=datetime.date(2026, 1, 5),
            type_prime=PrimeCalculee.TypePrime.CL30,
        )
        ClotureMensuelle.objects.create(
            employee=self.employee, mois=1, annee=2026, statut=ClotureMensuelle.Statut.CLOTURE
        )
        with self.assertRaises(MoisClotureError):
            prime.recalculer(quantite=Decimal("1"))

    def test_draft_month_does_not_block_modifications(self):
        jour = JourTravaille.objects.create(
            employee=self.employee,
            date=datetime.date(2026, 1, 5),
            organisation="jour",
        )
        ClotureMensuelle.objects.create(
            employee=self.employee, mois=1, annee=2026, statut=ClotureMensuelle.Statut.DRAFT
        )
        jour.heures_sup_payees = Decimal("2")
        jour.save()  # ne doit pas lever


class PrimeCalculeeTests(TestCase):
    def setUp(self):
        self.employee = User.objects.create_user(
            username="emp1", email="emp1@example.com", password="pass1234", role="employee"
        )

    def test_recalculer_syncs_retenu_when_not_manually_modified(self):
        prime = PrimeCalculee.objects.create(
            employee=self.employee,
            date=datetime.date(2026, 1, 5),
            type_prime=PrimeCalculee.TypePrime.CL11,
        )
        prime.recalculer(montant=Decimal("16"))
        prime.refresh_from_db()
        self.assertEqual(prime.montant_retenu, Decimal("16.00"))
        self.assertEqual(prime.montant_calcule, Decimal("16.00"))

    def test_manual_correction_survives_recalcul(self):
        prime = PrimeCalculee.objects.create(
            employee=self.employee,
            date=datetime.date(2026, 1, 5),
            type_prime=PrimeCalculee.TypePrime.CL11,
        )
        prime.recalculer(montant=Decimal("16"))

        enregistrer_correction_manuelle(
            prime, "montant_retenu", Decimal("20"), "Astreinte supplémentaire", self.employee
        )
        prime.refresh_from_db()
        self.assertTrue(prime.modifie_manuellement)

        prime.recalculer(montant=Decimal("16"))
        prime.refresh_from_db()
        self.assertEqual(prime.montant_retenu, Decimal("20.00"))
        self.assertEqual(prime.montant_calcule, Decimal("16.00"))


class CompteurRHTests(TestCase):
    def setUp(self):
        self.employee = User.objects.create_user(
            username="emp1", email="emp1@example.com", password="pass1234", role="employee"
        )

    def test_ajustement_manuel_is_independent_and_traced(self):
        compteur = CompteurRH.objects.create(
            employee=self.employee, solde_rtt=Decimal("2"), rtt_max_annuel=Decimal("12")
        )
        enregistrer_correction_manuelle(
            compteur, "ajustement_manuel", Decimal("1.5"), "Régularisation erreur RH", self.employee
        )
        compteur.refresh_from_db()
        self.assertEqual(compteur.ajustement_manuel, Decimal("1.50"))
        # L'ajustement manuel n'a pas touche le solde_rtt lui-meme.
        self.assertEqual(compteur.solde_rtt, Decimal("2.00"))

        correction = CorrectionManuelle.objects.get(
            object_id=compteur.pk, champ_modifie="ajustement_manuel"
        )
        self.assertEqual(correction.nouvelle_valeur, "1.5")


class CreditRttMensuelCommandTests(TestCase):
    def setUp(self):
        self.employee = User.objects.create_user(
            username="emp1", email="emp1@example.com", password="pass1234", role="employee"
        )
        self.compteur = CompteurRH.objects.create(
            employee=self.employee, solde_rtt=Decimal("3"), rtt_max_annuel=Decimal("12")
        )

    def test_credit_adds_to_existing_balance(self):
        call_command("credit_rtt_mensuel", "--mois=1", "--annee=2026")
        self.compteur.refresh_from_db()
        self.assertEqual(self.compteur.solde_rtt, Decimal("4.00"))  # 3 + 12/12

    def test_credit_is_idempotent_for_the_same_month(self):
        call_command("credit_rtt_mensuel", "--mois=1", "--annee=2026")
        self.compteur.refresh_from_db()
        solde_apres_premier_credit = self.compteur.solde_rtt

        # Relance par erreur pour le meme mois : ne doit pas crediter deux fois.
        call_command("credit_rtt_mensuel", "--mois=1", "--annee=2026")
        self.compteur.refresh_from_db()
        self.assertEqual(self.compteur.solde_rtt, solde_apres_premier_credit)

    def test_credit_backfill_for_a_past_month_still_works_and_is_idempotent(self):
        # Contrairement a un mecanisme base sur date_derniere_maj (auto_now),
        # le marqueur dedie permet un rattrapage explicite d'un mois passe
        # sans etre trompe par la date reelle d'execution.
        call_command("credit_rtt_mensuel", "--mois=3", "--annee=2025")
        self.compteur.refresh_from_db()
        self.assertEqual(self.compteur.solde_rtt, Decimal("4.00"))

        call_command("credit_rtt_mensuel", "--mois=3", "--annee=2025")
        self.compteur.refresh_from_db()
        self.assertEqual(self.compteur.solde_rtt, Decimal("4.00"))
