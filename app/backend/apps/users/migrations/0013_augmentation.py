from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0012_formation"),
    ]

    operations = [
        migrations.CreateModel(
            name="Augmentation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("matricule", models.CharField(max_length=50, blank=True)),
                ("date_effet", models.DateField(null=True, blank=True)),
                ("montant", models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("employee", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="augmentations", to="users.user")),
            ],
            options={
                "ordering": ["-date_effet"],
            },
        ),
    ]
