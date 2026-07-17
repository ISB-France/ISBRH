from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0011_user_preferences"),
    ]

    operations = [
        migrations.CreateModel(
            name="Formation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("matricule", models.CharField(max_length=50, blank=True)),
                ("domaine", models.CharField(max_length=255, blank=True)),
                ("libelle", models.CharField(max_length=255, blank=True)),
                ("date_formation", models.DateField(null=True, blank=True)),
                ("nature", models.CharField(max_length=50, blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("employee", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="formations", to="users.user")),
            ],
            options={
                "ordering": ["-date_formation"],
            },
        ),
    ]
