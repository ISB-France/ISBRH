from django.conf import settings
from django.db import models


class Campaign(models.Model):
    name = models.CharField(max_length=200)
    template = models.ForeignKey(
        "InterviewTemplate", null=True, blank=True, on_delete=models.SET_NULL, related_name="campaigns"
    )
    description = models.TextField(blank=True)
    start_date = models.DateField()
    due_date = models.DateField()
    population_filter = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


TYPE_CHOICES = [
    ("annual", "Entretien d'évaluation"),
    ("professional", "Entretien professionnel"),
    ("bilan", "Entretien de bilan"),
    ("forfait", "Entretien forfait jours et charges"),
    ("fin_carriere", "Entretien de fin de carrière"),
]


class InterviewTemplate(models.Model):
    name = models.CharField(max_length=200)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    description = models.TextField(blank=True)
    sections = models.JSONField(default=list)
    version = models.IntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if self.pk:
            old_sections = (
                InterviewTemplate.objects.filter(pk=self.pk)
                .values_list("sections", flat=True)
                .first()
            )
            if old_sections is not None and old_sections != self.sections:
                self.version += 1
        super().save(*args, **kwargs)


class Interview(models.Model):
    class Type(models.TextChoices):
        ANNUAL = "annual", "Entretien d'évaluation"
        PROFESSIONAL = "professional", "Entretien professionnel"
        BILAN = "bilan", "Entretien de bilan"
        FORFAIT = "forfait", "Entretien forfait jours et charges"
        FIN_CARRIERE = "fin_carriere", "Entretien de fin de carrière"

    class Status(models.TextChoices):
        DRAFT = "draft", "Brouillon"
        IN_PROGRESS = "in_progress", "En cours"
        COMPLETED = "completed", "Terminé"
        SIGNED = "signed", "Signé"
        CANCELLED = "cancelled", "Annulé"

    employee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="interviews",
    )
    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="managed_interviews",
    )
    campaign = models.ForeignKey(
        Campaign, null=True, blank=True, on_delete=models.SET_NULL, related_name="interviews"
    )
    template = models.ForeignKey(
        InterviewTemplate, null=True, blank=True, on_delete=models.SET_NULL, related_name="interviews"
    )
    type = models.CharField(max_length=20, choices=Type.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    due_date = models.DateField()
    content = models.JSONField(default=dict, blank=True)
    template_snapshot = models.JSONField(null=True, blank=True)
    document = models.FileField(upload_to="interview_docs/", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-due_date"]

    def __str__(self):
        return f"{self.get_type_display()} - {self.employee}"

    def get_effective_template_sections(self):
        """Retourne la structure du template au moment de la creation de
        l'entretien (template_snapshot), avec repli sur le template vivant
        pour les entretiens crees avant l'introduction du snapshot."""
        if self.template_snapshot is not None:
            return self.template_snapshot
        if self.template:
            return self.template.sections
        return []
