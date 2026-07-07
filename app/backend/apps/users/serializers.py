from rest_framework import serializers
from .models import Notification, Position, Service, Site, User


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

    def create(self, validated_data):
        validated_data["username"] = validated_data["email"]
        return super().create(validated_data)


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
