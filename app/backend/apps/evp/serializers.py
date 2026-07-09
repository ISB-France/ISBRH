from rest_framework import serializers

from .models import Absence, JourTravaille


class JourTravailleSerializer(serializers.ModelSerializer):
    class Meta:
        model = JourTravaille
        fields = [
            "id", "employee", "date", "poste", "organisation",
            "heures_travaillees_calcule", "heures_travaillees_retenu",
            "heures_travaillees_modifie_manuellement", "heures_travaillees_motif_modification",
            "heures_nuit_calcule", "heures_nuit_retenu",
            "heures_nuit_modifie_manuellement", "heures_nuit_motif_modification",
            "heures_sup_payees", "heures_sup_recuperees",
        ]


class JourTravailleCorrectionSerializer(serializers.Serializer):
    """Serializer de la correction manuelle (PATCH) d'un JourTravaille.
    Le motif n'est obligatoire que si la valeur soumise diverge reellement
    du calcul automatique en cours (*_calcule) — sinon un manager qui
    resoumet simplement la valeur deja calculee n'a rien a justifier."""

    heures_travaillees_retenu = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False
    )
    heures_nuit_retenu = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False
    )
    motif_modification = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        instance = self.instance
        motif = attrs.get("motif_modification", "").strip()

        diverges = False
        if "heures_travaillees_retenu" in attrs and attrs["heures_travaillees_retenu"] != instance.heures_travaillees_calcule:
            diverges = True
        if "heures_nuit_retenu" in attrs and attrs["heures_nuit_retenu"] != instance.heures_nuit_calcule:
            diverges = True

        if diverges and not motif:
            raise serializers.ValidationError({
                "motif_modification": "Un motif est requis lorsque la valeur diffère du calcul automatique."
            })

        return attrs


class AbsenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Absence
        fields = [
            "id", "employee", "code_absence", "date_debut", "date_fin",
            "demi_journee", "valide_par", "statut", "created_at", "updated_at",
        ]
        read_only_fields = ["statut", "valide_par", "created_at", "updated_at"]
