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


def reassign_interviews_on_manager_change(sender, instance, **kwargs):
    """Quand le manager (N+1) d'un employe change, resynchronise le champ
    Interview.manager de tous ses entretiens sur le nouveau manager, pour que
    l'ancien manager perde immediatement l'acces (lecture/ecriture) et que le
    nouveau l'obtienne — sans dependre d'une action manuelle."""
    if not instance.pk:
        return

    try:
        old = sender.objects.get(pk=instance.pk)
    except sender.DoesNotExist:
        return

    if old.manager_id == instance.manager_id:
        return

    from apps.interviews.models import Interview

    Interview.objects.filter(employee_id=instance.pk).exclude(
        manager_id=instance.manager_id
    ).update(manager_id=instance.manager_id)
