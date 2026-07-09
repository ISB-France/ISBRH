from decimal import Decimal

from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import models


class MoisClotureError(ValidationError):
    """Levee quand on tente de modifier une donnee dont le mois est deja
    cloture pour l'employe concerne."""


class OrganisationType(models.TextChoices):
    JOUR = "jour", "Jour"
    EQUIPE = "equipe", "Équipe"
    NUIT = "nuit", "Nuit"


def is_month_closed(employee_id, date):
    """True si le mois (mois/annee) de `date` est cloture pour cet employe."""
    return ClotureMensuelle.objects.filter(
        employee_id=employee_id,
        mois=date.month,
        annee=date.year,
        statut=ClotureMensuelle.Statut.CLOTURE,
    ).exists()


def check_month_not_closed(employee_id, *dates):
    for date in dates:
        if date and is_month_closed(employee_id, date):
            raise MoisClotureError(
                f"Le mois {date.month:02d}/{date.year} est déjà clôturé pour cet "
                "employé : aucune modification n'est possible."
            )


def sync_calcule_retenu(instance, field_prefix, nouvelle_valeur):
    """Met a jour <prefix>_calcule et, si <prefix>_modifie_manuellement est
    False, synchronise automatiquement <prefix>_retenu sur la meme valeur
    (principe "automatique par defaut, correction humaine en exception").
    Si un humain a deja corrige *_retenu (modifie_manuellement=True), on ne
    touche plus jamais a *_retenu ici."""
    setattr(instance, f"{field_prefix}_calcule", nouvelle_valeur)
    if not getattr(instance, f"{field_prefix}_modifie_manuellement"):
        setattr(instance, f"{field_prefix}_retenu", nouvelle_valeur)


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
    # PROTECT : un cycle historique doit rester lisible sur les affectations
    # passees meme si le poste est desactive depuis (actif=False plutot que
    # supprime).
    poste = models.ForeignKey(
        PosteTravail, on_delete=models.PROTECT, related_name="cycles_horaires"
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
    # PROTECT (voir note sur CycleHoraire.poste) : une affectation historique
    # doit rester lisible meme si le poste/cycle est desactive depuis.
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

        # Choix : validation en clean()/save(), pas de contrainte
        # d'exclusion PostgreSQL (ExclusionConstraint + extension
        # btree_gist). Raisons : (1) aucun autre modele du projet n'utilise
        # de contrainte d'exclusion, on reste coherent avec le pattern deja
        # en place (User.save(), InterviewTemplate.save()) ; (2) date_fin
        # nullable (affectation en cours) complique l'expression SQL, qui
        # necessiterait un COALESCE vers une borne infinie ; (3) toutes les
        # ecritures prevues passent par l'ORM (pas d'import CSV direct sur
        # ce modele) donc le gain de robustesse d'une contrainte DB est
        # marginal ici par rapport au cout d'infrastructure.
        overlapping = Affectation.objects.filter(employee_id=self.employee_id).exclude(pk=self.pk)
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


class JourFerie(models.Model):
    date = models.DateField(unique=True)
    nom = models.CharField(max_length=200)
    # null = ferie national (valable pour tous les sites)
    site = models.ForeignKey(
        "users.Site", null=True, blank=True, on_delete=models.CASCADE, related_name="jours_feries"
    )

    class Meta:
        ordering = ["date"]

    def __str__(self):
        return f"{self.nom} ({self.date})"


class JourTravaille(models.Model):
    employee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="jours_travailles"
    )
    date = models.DateField()
    poste = models.ForeignKey(
        PosteTravail, null=True, blank=True, on_delete=models.SET_NULL, related_name="jours_travailles"
    )
    organisation = models.CharField(max_length=10, choices=OrganisationType.choices)

    heures_travaillees_calcule = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    heures_travaillees_retenu = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    heures_travaillees_modifie_manuellement = models.BooleanField(default=False)
    heures_travaillees_motif_modification = models.CharField(max_length=255, null=True, blank=True)

    heures_nuit_calcule = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    heures_nuit_retenu = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    heures_nuit_modifie_manuellement = models.BooleanField(default=False)
    heures_nuit_motif_modification = models.CharField(max_length=255, null=True, blank=True)

    # Decisions manager pures (payer ou recuperer les heures sup) : pas de
    # regle automatique a deduire, donc pas de pattern calcule/retenu ici.
    heures_sup_payees = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    heures_sup_recuperees = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    class Meta:
        ordering = ["-date"]
        constraints = [
            models.UniqueConstraint(fields=["employee", "date"], name="unique_jour_travaille_par_employee"),
        ]

    def __str__(self):
        return f"{self.employee} - {self.date}"

    def clean(self):
        check_month_not_closed(self.employee_id, self.date)

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def _calculer_heures_theoriques(self):
        """Regle metier simplifiee (a affiner a l'etape API/calcul) :
        - 0 si le jour est ferie pour le site du poste affecte (ou ferie
          national) ;
        - sinon les heures du jour de semaine dans le cycle horaire de
          l'affectation en cours a cette date, si elle existe ;
        - sinon 0 (aucune affectation connue ce jour-la).
        Retourne (heures_travaillees, heures_nuit)."""
        site_id = self.poste.site_id if self.poste else None
        ferie = JourFerie.objects.filter(date=self.date).filter(
            models.Q(site_id__isnull=True) | models.Q(site_id=site_id)
        )
        if ferie.exists():
            return Decimal("0"), Decimal("0")

        affectation = (
            Affectation.objects.filter(employee_id=self.employee_id, date_debut__lte=self.date)
            .filter(models.Q(date_fin__isnull=True) | models.Q(date_fin__gte=self.date))
            .select_related("cycle")
            .first()
        )
        if not affectation:
            return Decimal("0"), Decimal("0")

        jours_semaine = [
            "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche",
        ]
        jour_nom = jours_semaine[self.date.weekday()]
        heures = Decimal(str(affectation.cycle.structure.get(jour_nom, 0)))
        heures_nuit = heures if affectation.cycle.type_organisation == OrganisationType.NUIT else Decimal("0")
        return heures, heures_nuit

    def recalculer(self):
        """Reapplique la regle de calcul metier sur les champs *_calcule
        uniquement, et synchronise *_retenu si non modifie manuellement.
        Leve MoisClotureError si le mois est deja cloture."""
        check_month_not_closed(self.employee_id, self.date)
        heures, heures_nuit = self._calculer_heures_theoriques()
        sync_calcule_retenu(self, "heures_travaillees", heures)
        sync_calcule_retenu(self, "heures_nuit", heures_nuit)
        self.save()


class Absence(models.Model):
    class CodeAbsence(models.TextChoices):
        APLD = "0971", "APLD"
        CP = "0951", "Congé payé"
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
        check_month_not_closed(self.employee_id, self.date_debut, self.date_fin)

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

    montant_calcule = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    montant_retenu = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    quantite_calcule = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    quantite_retenu = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    modifie_manuellement = models.BooleanField(default=False)
    motif_modification = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"{self.employee} - {self.get_type_prime_display()} ({self.date})"

    def clean(self):
        check_month_not_closed(self.employee_id, self.date)

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def recalculer(self, montant=None, quantite=None):
        """Applique une nouvelle valeur calculee (fournie par l'appelant :
        le moteur de regles metier par type_prime arrive a l'etape API) et
        synchronise montant_retenu/quantite_retenu si modifie_manuellement
        est False. Leve MoisClotureError si le mois est deja cloture."""
        check_month_not_closed(self.employee_id, self.date)
        self.montant_calcule = montant
        self.quantite_calcule = quantite
        if not self.modifie_manuellement:
            self.montant_retenu = montant
            self.quantite_retenu = quantite
        self.save()


class ClotureMensuelle(models.Model):
    class Statut(models.TextChoices):
        DRAFT = "draft", "Brouillon"
        CLOTURE = "cloture", "Clôturé"

    employee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="clotures_mensuelles"
    )
    mois = models.IntegerField()
    annee = models.IntegerField()
    statut = models.CharField(max_length=10, choices=Statut.choices, default=Statut.DRAFT)
    date_cloture = models.DateTimeField(null=True, blank=True)
    cloture_par = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="clotures_effectuees",
    )

    class Meta:
        ordering = ["-annee", "-mois"]
        constraints = [
            models.UniqueConstraint(fields=["employee", "mois", "annee"], name="unique_cloture_par_employee_mois"),
        ]

    def __str__(self):
        return f"{self.employee} - {self.mois:02d}/{self.annee} ({self.statut})"


class CompteurRH(models.Model):
    employee = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="compteur_rh"
    )
    solde_cp_pris = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    solde_cp_prevu = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    solde_rtt = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    rtt_max_annuel = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    # Correction RH ponctuelle, independante et tracable separement du
    # credit mensuel automatique (cf. credit_rtt_mensuel) : additionnee au
    # solde par la commande, jamais ecrasee.
    ajustement_manuel = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    date_derniere_maj = models.DateField(auto_now=True)

    # Marqueur dedie pour l'idempotence de credit_rtt_mensuel — voir la note
    # dans ce fichier (docstring de credit_rtt_mensuel) sur pourquoi
    # date_derniere_maj (auto_now, mis a jour par N'IMPORTE QUELLE sauvegarde,
    # y compris la creation du compteur) ne peut pas servir a cet usage.
    dernier_mois_rtt_credite = models.IntegerField(null=True, blank=True)
    dernier_annee_rtt_creditee = models.IntegerField(null=True, blank=True)

    def __str__(self):
        return f"Compteurs de {self.employee}"


class CorrectionManuelle(models.Model):
    """Traçabilité générique de toute correction manuelle d'un champ
    *_retenu (ou ajustement_manuel) sur JourTravaille, Absence,
    PrimeCalculee ou CompteurRH — centralisée ici plutôt que dupliquée sur
    chaque modèle."""

    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey("content_type", "object_id")

    champ_modifie = models.CharField(max_length=100)
    ancienne_valeur = models.CharField(max_length=255, blank=True)
    nouvelle_valeur = models.CharField(max_length=255, blank=True)
    motif = models.TextField()
    corrige_par = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="corrections_manuelles"
    )
    corrige_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-corrige_le"]

    def __str__(self):
        return f"{self.content_object} - {self.champ_modifie} : {self.ancienne_valeur} -> {self.nouvelle_valeur}"
