from rest_framework import serializers
from .models import RH_ROLES, Evolution, Notification, Position, Service, Site, User


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "message", "link", "is_read", "created_at"]
        read_only_fields = ["created_at"]


class SiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Site
        fields = ["id", "name"]


class ServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = ["id", "name"]


class PositionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Position
        fields = ["id", "name"]


class UserSerializer(serializers.ModelSerializer):
    site_name = serializers.CharField(source="site.name", read_only=True, default="")
    service_name = serializers.CharField(source="service.name", read_only=True, default="")
    position_name = serializers.CharField(source="position.name", read_only=True, default="")
    manager_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name",
            "role",
            "sexe", "date_naissance", "telephone", "photo",
            "matricule", "hire_date", "date_sortie",
            "type_contrat", "statut", "coefficient", "niveau", "fonctionnement",
            "salaire_brut", "forfait_jour", "tickets_restaurant", "cadre",
            "service", "service_name",
            "position", "position_name",
            "site", "site_name",
            "manager", "manager_name", "agence_interim",
            "icon",
            "preferences",
            "code_badge", "is_manager_evp",
        ]

    def get_manager_name(self, obj):
        if obj.manager:
            return obj.manager.get_full_name() or obj.manager.email
        return None

    def validate_role(self, value):
        # Ne bloque que l'ESCALADE vers admin, pas la resoumission
        # inchangee d'un compte deja admin — sinon toute modification
        # (meme sans toucher au role) d'un utilisateur role="admin" via ce
        # formulaire echoue, puisque le payload PUT resoumet toujours le
        # role courant.
        if value == "admin" and getattr(self.instance, "role", None) != "admin":
            raise serializers.ValidationError("Le rôle admin ne peut pas être attribué via ce formulaire")
        return value

    def _validate_rh_only_field(self, value, field_name):
        request = self.context.get("request")
        if request is None:
            return value
        current_value = getattr(self.instance, field_name, None)
        if request.user.role not in RH_ROLES and value != current_value:
            raise serializers.ValidationError(
                "Seul un compte RH/Admin peut modifier ce champ."
            )
        return value

    def validate_code_badge(self, value):
        return self._validate_rh_only_field(value, "code_badge")

    def validate_is_manager_evp(self, value):
        return self._validate_rh_only_field(value, "is_manager_evp")

    def create(self, validated_data):
        validated_data["username"] = validated_data["email"]
        return super().create(validated_data)


class EvolutionSerializer(serializers.ModelSerializer):
    auteur_name = serializers.SerializerMethodField()

    class Meta:
        model = Evolution
        fields = [
            "id", "type_evolution", "ancienne_valeur", "nouvelle_valeur",
            "date_effet", "auteur", "auteur_name", "created_at",
        ]

    def get_auteur_name(self, obj):
        if obj.auteur:
            return obj.auteur.get_full_name() or obj.auteur.email
        return None


class UserMeSerializer(serializers.ModelSerializer):
    manager_name = serializers.SerializerMethodField()
    site_name = serializers.CharField(source="site.name", read_only=True, default="")
    service_name = serializers.CharField(source="service.name", read_only=True, default="")
    position_name = serializers.CharField(source="position.name", read_only=True, default="")
    photo = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name",
            "role",
            "sexe", "date_naissance", "telephone", "photo",
            "matricule", "hire_date", "date_sortie",
            "type_contrat", "statut", "coefficient", "niveau", "fonctionnement",
            "salaire_brut", "forfait_jour", "tickets_restaurant", "cadre",
            "service", "service_name",
            "position", "position_name",
            "site", "site_name",
            "manager", "manager_name", "agence_interim",
            "icon",
            "preferences",
            "is_manager_evp",
        ]
        # is_manager_evp doit etre visible (le frontend en a besoin pour
        # afficher/masquer l'entree de nav EVP) mais jamais modifiable via
        # /api/auth/me/ — seul UserSerializer (RH/admin) peut l'ecrire.
        read_only_fields = ["is_manager_evp"]

    def get_photo(self, obj):
        if obj.photo:
            return f"/media/{obj.photo.name}"
        return None

    def get_manager_name(self, obj):
        if obj.manager:
            return obj.manager.get_full_name() or obj.manager.email
        return None
