# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('interviews', '0013_interview_date_realisation'),
    ]

    operations = [
        migrations.CreateModel(
            name='AnswerList',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, unique=True)),
                ('items', models.JSONField(blank=True, default=list)),
            ],
            options={
                'ordering': ['name'],
            },
        ),
    ]
