from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import Notification, Position, Service, User


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ["name"]
    search_fields = ["name"]


@admin.register(Position)
class PositionAdmin(admin.ModelAdmin):
    list_display = ["name"]
    search_fields = ["name"]


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["user", "message", "is_read", "created_at"]
    list_filter = ["is_read", "created_at"]
    search_fields = ["user__email", "message"]


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ["email", "first_name", "last_name", "role", "matricule", "service", "position", "statut", "is_manager_evp"]
    list_filter = ["role", "service", "position", "statut", "type_contrat", "site", "is_manager_evp"]
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Identité", {"fields": ("first_name", "last_name", "sexe", "date_naissance", "telephone", "photo")}),
        ("Contrat", {"fields": ("matricule", "hire_date", "date_sortie", "type_contrat", "statut", "niveau", "coefficient", "fonctionnement", "salaire_brut", "forfait_jour", "tickets_restaurant", "cadre")}),
        ("Organisation", {"fields": ("role", "service", "position", "site", "manager", "agence_interim")}),
        ("EVP", {"fields": ("code_badge", "is_manager_evp")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "password1", "password2"),
        }),
    )
    search_fields = ["email", "first_name", "last_name", "matricule"]
    ordering = ["email"]
