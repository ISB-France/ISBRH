import os

from django.apps import AppConfig
from django.db.models.signals import post_migrate


def create_admin_user(sender, **kwargs):
    email = os.environ.get("ADMIN_EMAIL")
    password = os.environ.get("ADMIN_PASSWORD")
    if not email or not password:
        return

    from django.contrib.auth import get_user_model
    User = get_user_model()
    if not User.objects.filter(email=email).exists():
        User.objects.create_superuser(
            username=email,
            email=email,
            password=password,
            role="admin",
        )


class UsersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.users"
    label = "users"

    def ready(self):
        post_migrate.connect(create_admin_user, sender=self)

        from django.db.models.signals import pre_save

        from .models import User
        from .signals import reassign_interviews_on_manager_change, track_user_evolution

        pre_save.connect(track_user_evolution, sender=User)
        pre_save.connect(reassign_interviews_on_manager_change, sender=User)
