# Generated manually

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0023_alter_user_email_nullable'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='user',
            name='categorie_socio_pro',
        ),
    ]
