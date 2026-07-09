from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class OrganisationType(models.TextChoices):
    JOUR = "jour", "Jour"
    EQUIPE = "equipe", "Équipe"
    NUIT = "nuit", "Nuit"


class PosteTravail(models.Model):
    nom = models.CharField(max_length=200)
    site = models.ForeignKey(
        "users.Site", on_delete=models.PROTECT, related_name="postes_travail"
    )
    description = models.TextField(blank=True)
    actif = models.BooleanField(default=True)

    class Meta:
        ordering = ["nom"]

    def __str__(self):
        return self.nom


class CycleHoraire(models.Model):
    nom = models.CharField(max_length=200)
    poste = models.ForeignKey(
        PosteTravail, on_delete=models.CASCADE, related_name="cycles_horaires"
    )
    # Heures par jour de semaine, ex: {"lundi": 8, "mardi": 8, "mercredi": 8,
    # "jeudi": 8, "vendredi": 4, "samedi": 0, "dimanche": 0}
    structure = models.JSONField(default=dict)
    type_organisation = models.CharField(max_length=10, choices=OrganisationType.choices)

    class Meta:
        ordering = ["nom"]

    def __str__(self):
        return f"{self.nom} ({self.poste})"


class Affectation(models.Model):
    employee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="affectations"
    )
    poste = models.ForeignKey(
        PosteTravail, on_delete=models.PROTECT, related_name="affectations"
    )
    cycle = models.ForeignKey(
        CycleHoraire, on_delete=models.PROTECT, related_name="affectations"
    )
    date_debut = models.DateField()
    date_fin = models.DateField(null=True, blank=True)  # null = affectation en cours

    class Meta:
        ordering = ["-date_debut"]

    def __str__(self):
        return f"{self.employee} - {self.poste} ({self.date_debut} -> {self.date_fin or 'en cours'})"

    def clean(self):
        if self.date_fin and self.date_fin < self.date_debut:
            raise ValidationError("La date de fin ne peut pas être avant la date de début.")

        overlapping = Affectation.objects.filter(employee_id=self.employee_id).exclude(pk=self.pk)
        # Deux affectations se chevauchent si chacune commence avant que
        # l'autre ne finisse (une date_fin nulle = affectation en cours,
        # donc sans borne haute).
        overlapping = overlapping.filter(
            models.Q(date_fin__isnull=True) | models.Q(date_fin__gte=self.date_debut)
        )
        if self.date_fin is not None:
            overlapping = overlapping.filter(date_debut__lte=self.date_fin)

        if overlapping.exists():
            raise ValidationError(
                "Cet employé a déjà une affectation active sur cette période."
            )

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)


class JourTravaille(models.Model):
    employee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="jours_travailles"
    )
    date = models.DateField()
    poste = models.ForeignKey(
        PosteTravail, null=True, blank=True, on_delete=models.SET_NULL, related_name="jours_travailles"
    )
    heures_travaillees = models.DecimalField(max_digits=5, decimal_places=2)
    organisation = models.CharField(max_length=10, choices=OrganisationType.choices)
    heures_nuit = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    heures_sup_payees = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    heures_sup_recuperees = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    class Meta:
        ordering = ["-date"]
        constraints = [
            models.UniqueConstraint(fields=["employee", "date"], name="unique_jour_travaille_par_employee"),
        ]

    def __str__(self):
        return f"{self.employee} - {self.date}"


class Absence(models.Model):
    class CodeAbsence(models.TextChoices):
        APLD = "0971", "APLD"
        CP = "0951", "CP"
        RTT = "0950", "RTT"
        MAL = "2000", "Maladie"
        AT = "2020", "Accident du travail"
        MP = "1000", "Maladie professionnelle"
        MATERNITE = "2010", "Maternité"
        PATERNITE = "2040", "Paternité"
        EVENEMENT_FAMILIAL = "0990", "Événement familial"
        ENFANT_MALADE = "0991", "Enfant malade"
        CONGE_SANS_SOLDE = "0981", "Congé sans solde"
        ABSENCE_JUSTIFIEE_PAYEE = "0978", "Absence justifiée et payée"
        ABSENCE_NON_REMUNEREE = "0977", "Absence non rémunérée"
        GREVE = "0974", "Grève"
        ACCIDENT_TRAJET = "1040", "Accident de trajet"
        ABSENCE_INJUSTIFIEE = "0979", "Absence injustifiée"

    class Statut(models.TextChoices):
        EN_ATTENTE = "en_attente", "En attente"
        VALIDEE = "validee", "Validée"
        REFUSEE = "refusee", "Refusée"

    employee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="absences"
    )
    code_absence = models.CharField(max_length=4, choices=CodeAbsence.choices)
    date_debut = models.DateField()
    date_fin = models.DateField()
    demi_journee = models.BooleanField(default=False)
    valide_par = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="absences_validees",
    )
    statut = models.CharField(max_length=10, choices=Statut.choices, default=Statut.EN_ATTENTE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date_debut"]

    def __str__(self):
        return f"{self.employee} - {self.get_code_absence_display()} ({self.date_debut} -> {self.date_fin})"

    def clean(self):
        if self.date_fin < self.date_debut:
            raise ValidationError("La date de fin ne peut pas être avant la date de début.")

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)


class PrimeCalculee(models.Model):
    class TypePrime(models.TextChoices):
        CL30 = "CL30", "Nombre de paniers jours"
        CL31 = "CL31", "Nombre de paniers nuits"
        CL06 = "CL06", "Prime d'exploitation"
        CL11 = "CL11", "Prime de nuit"
        CL16 = "CL16", "Prime d'astreinte"
        CL01 = "CL01", "Majoration heures de nuit 25%"
        HS01 = "HS01", "Heures supplémentaires 125%"
        HS02 = "HS02", "Heures supplémentaires 150%"

    employee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="primes_calculees"
    )
    date = models.DateField()
    type_prime = models.CharField(max_length=4, choices=TypePrime.choices)
    # Selon le type, la ligne est soit un montant (prime d'exploitation,
    # prime de nuit, prime d'astreinte), soit une quantité (nombre de
    # paniers, heures majorées) — jamais les deux à la fois en pratique,
    # mais rien n'empêche de renseigner les deux si un jour on a besoin
    # du montant ET de la quantité (ex: heures sup avec taux applique).
    montant = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    quantite = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"{self.employee} - {self.get_type_prime_display()} ({self.date})"


class CompteurRH(models.Model):
    employee = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="compteur_rh"
    )
    solde_cp_pris = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    solde_cp_prevu = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    solde_rtt = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    rtt_max_annuel = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    date_derniere_maj = models.DateField(auto_now=True)

    def __str__(self):
        return f"Compteurs de {self.employee}"
