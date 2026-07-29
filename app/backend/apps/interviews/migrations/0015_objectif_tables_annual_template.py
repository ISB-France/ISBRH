from django.db import migrations

OBJECTIF_TABLE_COLUMNS = [
    {"id": "theme", "label": "Thème", "type": "textarea"},
    {"id": "objectif", "label": "Objectif", "type": "textarea"},
    {"id": "date_realisation", "label": "Date de réalisation", "type": "textarea"},
    {"id": "niveau_realisation", "label": "Niveau de réalisation", "type": "textarea"},
    {"id": "note_collaborateur", "label": "Note collaborateur", "type": "rating"},
    {"id": "remarque_collaborateur", "label": "Remarque collaborateur", "type": "textarea"},
    {"id": "note_manager", "label": "Note manager", "type": "rating"},
    {"id": "remarque_manager", "label": "Remarque manager", "type": "textarea"},
]


def add_objectif_tables(apps, schema_editor):
    InterviewTemplate = apps.get_model("interviews", "InterviewTemplate")
    for template in InterviewTemplate.objects.filter(type="annual"):
        sections = list(template.sections or [])
        changed = False
        for section in sections:
            if section.get("id") != "objectifs":
                continue
            questions = section.get("questions", [])
            existing_ids = {q.get("id") for q in questions}
            new_questions = []
            if "objectif_a_evaluer" not in existing_ids:
                new_questions.append({
                    "id": "objectif_a_evaluer",
                    "label": "Objectif à évaluer",
                    "type": "table",
                    "columns": OBJECTIF_TABLE_COLUMNS,
                    "answer": [],
                })
            if "objectif_a_definir" not in existing_ids:
                new_questions.append({
                    "id": "objectif_a_definir",
                    "label": "Objectif à définir",
                    "type": "table",
                    "columns": OBJECTIF_TABLE_COLUMNS,
                    "answer": [],
                })
            if new_questions:
                section["questions"] = new_questions + questions
                changed = True
        if changed:
            template.sections = sections
            template.save(update_fields=["sections"])


def remove_objectif_tables(apps, schema_editor):
    InterviewTemplate = apps.get_model("interviews", "InterviewTemplate")
    for template in InterviewTemplate.objects.filter(type="annual"):
        sections = list(template.sections or [])
        changed = False
        for section in sections:
            if section.get("id") != "objectifs":
                continue
            questions = section.get("questions", [])
            filtered = [q for q in questions if q.get("id") not in ("objectif_a_evaluer", "objectif_a_definir")]
            if len(filtered) != len(questions):
                section["questions"] = filtered
                changed = True
        if changed:
            template.sections = sections
            template.save(update_fields=["sections"])


class Migration(migrations.Migration):

    dependencies = [
        ("interviews", "0014_answerlist"),
    ]

    operations = [
        migrations.RunPython(add_objectif_tables, remove_objectif_tables),
    ]
