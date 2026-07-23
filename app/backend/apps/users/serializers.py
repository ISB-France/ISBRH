from rest_framework import serializers
from .models import Evolution, Notification, Position, Service, Site, User


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

    def validate(self, attrs):
        # L'email est optionnel : sur creation (ou si explicitement vide sur
        # une modification), on genere un email temporaire a partir du
        # matricule plutot que de laisser le champ vide (unique=True).
        is_create = self.instance is None
        if not attrs.get("email") and (is_create or "email" in attrs):
            matricule = attrs.get("matricule") or getattr(self.instance, "matricule", "")
            attrs["email"] = f"{matricule}@sansemail.isb.fr"
        return attrs

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
        ]

    def get_photo(self, obj):
        if obj.photo:
            return f"/media/{obj.photo.name}"
        return None

    def get_manager_name(self, obj):
        if obj.manager:
            return obj.manager.get_full_name() or obj.manager.email
        return None
