from django.db import migrations


def clear_invalid_managers(apps, schema_editor):
    User = apps.get_model("users", "User")
    User.objects.filter(manager__role__in=["admin", "rh"]).update(manager=None)


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0024_remove_user_categorie_socio_pro'),
    ]

    operations = [
        migrations.RunPython(clear_invalid_managers, migrations.RunPython.noop),
    ]
