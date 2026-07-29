from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.users.models import Notification


@receiver(post_save, sender="interviews.Interview")
def notify_interview_created(sender, instance, created, **kwargs):
    if not instance.manager or instance.manager.role in ("admin", "rh"):
        return
    if created:
        Notification.objects.create(
            user=instance.manager,
            message=f"Nouvel entretien {instance.get_type_display()} pour {instance.employee.get_full_name() or instance.employee.email}",
            link=f"/interviews/{instance.id}",
        )
    elif instance.status == "completed":
        Notification.objects.create(
            user=instance.manager,
            message=f"Entretien {instance.get_type_display()} terminé pour {instance.employee.get_full_name() or instance.employee.email}",
            link=f"/interviews/{instance.id}",
        )
    elif instance.status == "signed":
        Notification.objects.create(
            user=instance.manager,
            message=f"Entretien {instance.get_type_display()} signé pour {instance.employee.get_full_name() or instance.employee.email}",
            link=f"/interviews/{instance.id}",
        )
