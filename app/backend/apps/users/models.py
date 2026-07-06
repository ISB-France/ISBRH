from django.contrib.auth.models import AbstractUser
from django.db import models

from .validators import validate_phone


class Site(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Service(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Position(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        RH = "rh", "RH"
        MANAGER = "manager", "Manager"
        EMPLOYEE = "employee", "Employé"
        STAGIAIRE = "stagiaire", "Stagiaire"
        ALTERNANT = "alternant", "Alternant"

    class Sexe(models.TextChoices):
        HOMME = "homme", "Homme"
        FEMME = "femme", "Femme"
        NON_BINAIRE = "non_binaire", "Non-Binaire"

    class TypeContrat(models.TextChoices):
        CDI = "cdi", "CDI"
        CDD = "cdd", "CDD"
        INTERIM = "interim", "Intérim"
        ALTERNANCE = "alternance", "Alternance"
        STAGE = "stage", "Stage"

    class StatutEmploye(models.TextChoices):
        ACTIF = "actif", "Actif"
        INACTIF = "inactif", "Inactif"
        SORTIE = "sortie", "Sortie"

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.EMPLOYEE)

    # Identité
    sexe = models.CharField(max_length=20, choices=Sexe.choices, blank=True)
    date_naissance = models.DateField(null=True, blank=True)
    telephone = models.CharField(max_length=50, blank=True, validators=[validate_phone])
    photo = models.ImageField(upload_to="photos/", null=True, blank=True)
    icon = models.CharField(max_length=10, blank=True, default="")
    preferences = models.TextField(blank=True, default="")

    # Contrat
    matricule = models.CharField(max_length=50, unique=True, blank=True)
    hire_date = models.DateField(null=True, blank=True)
    date_sortie = models.DateField(null=True, blank=True)
    type_contrat = models.CharField(max_length=20, choices=TypeContrat.choices, blank=True)
    statut = models.CharField(max_length=20, choices=StatutEmploye.choices, default=StatutEmploye.ACTIF)
    coefficient = models.CharField(max_length=20, blank=True)
    salaire_brut = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    forfait_jour = models.BooleanField(default=False)
    tickets_restaurant = models.BooleanField(default=False)
    cadre = models.BooleanField(default=False)

    # Organisation
    service = models.ForeignKey(
        Service, null=True, blank=True, on_delete=models.SET_NULL, related_name="employees"
    )
    position = models.ForeignKey(
        Position, null=True, blank=True, on_delete=models.SET_NULL, related_name="employees"
    )
    site = models.ForeignKey(
        Site, null=True, blank=True, on_delete=models.SET_NULL, related_name="employees"
    )
    manager = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="subordinates"
    )
    agence_interim = models.CharField(max_length=100, blank=True)

    # Ancien champ obsolète, conservé temporairement
    onboarding_status = models.CharField(
        max_length=20,
        choices=[
            ("pending", "En attente"),
            ("in_progress", "En cours"),
            ("completed", "Terminé"),
        ],
        default="pending",
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    def save(self, *args, **kwargs):
        if not self.matricule:
            last = User.objects.filter(matricule__regex=r"^\d{8}$").order_by("matricule").last()
            if last:
                next_num = int(last.matricule) + 1
            else:
                next_num = 1
            self.matricule = f"{next_num:08d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return self.get_full_name() or self.email


RH_ROLES = ["admin", "rh"]


class Formation(models.Model):
    employee = models.ForeignKey(User, on_delete=models.CASCADE, related_name="formations")
    matricule = models.CharField(max_length=50, blank=True)
    domaine = models.CharField(max_length=255, blank=True)
    libelle = models.CharField(max_length=255, blank=True)
    date_formation = models.DateField(null=True, blank=True)
    nature = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_formation"]


class Augmentation(models.Model):
    employee = models.ForeignKey(User, on_delete=models.CASCADE, related_name="augmentations")
    matricule = models.CharField(max_length=50, blank=True)
    date_effet = models.DateField(null=True, blank=True)
    montant = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_effet"]


class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    message = models.CharField(max_length=255)
    link = models.CharField(max_length=255, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{'Lu' if self.is_read else 'Non lu'}] {self.message}"
