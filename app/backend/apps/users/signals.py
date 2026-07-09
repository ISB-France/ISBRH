from django.utils import timezone

TRACKED_FIELDS = [
    ("position", "poste"),
    ("service", "service"),
    ("site", "site"),
    ("statut", "statut"),
    ("niveau", "niveau"),
    ("coefficient", "coefficient"),
]

FK_FIELDS = {"position", "service", "site"}


def _display_value(user, field):
    if field in FK_FIELDS:
        related = getattr(user, field)
        return related.name if related else ""
    return getattr(user, field) or ""


def track_user_evolution(sender, instance, **kwargs):
    """Compare l'etat en base au nouvel etat entrant et cree une Evolution
    pour chaque champ suivi (poste, service, site, statut, niveau,
    coefficient) qui change."""
    if not instance.pk:
        return

    try:
        old = sender.objects.get(pk=instance.pk)
    except sender.DoesNotExist:
        return

    from .models import Evolution

    today = timezone.now().date()
    for field, type_evolution in TRACKED_FIELDS:
        if field in FK_FIELDS:
            old_value = getattr(old, f"{field}_id")
            new_value = getattr(instance, f"{field}_id")
        else:
            old_value = getattr(old, field)
            new_value = getattr(instance, field)

        if old_value == new_value:
            continue

        Evolution.objects.create(
            employee=instance,
            type_evolution=type_evolution,
            ancienne_valeur=_display_value(old, field),
            nouvelle_valeur=_display_value(instance, field),
            date_effet=today,
        )
