import copy

from django.core.management.base import BaseCommand

from apps.interviews.models import Interview
from apps.interviews.templates import OBJECTIF_TABLE_COLUMNS

OBJECTIFS_SECTION_ID = "objectifs"
OBJECTIF_A_EVALUER_ID = "objectif_a_evaluer"
OBJECTIF_A_DEFINIR_ID = "objectif_a_definir"
DEFAULT_TABLE_ROWS = 5


def table_has_content(rows):
    if not rows:
        return False
    return any(cell not in (None, "") for row in rows for cell in row)


def blank_table_question(question_id, label):
    return {
        "id": question_id,
        "label": label,
        "type": "table",
        "columns": OBJECTIF_TABLE_COLUMNS,
        "answer": [[None] * len(OBJECTIF_TABLE_COLUMNS) for _ in range(DEFAULT_TABLE_ROWS)],
    }


class Command(BaseCommand):
    help = (
        "Ajoute retroactivement les tableaux 'Objectif à évaluer' et "
        "'Objectif à définir' aux entretiens d'évaluation (annual) déjà "
        "créés (tous statuts), qui ne les ont pas encore. 'Objectif à "
        "évaluer' est pré-rempli avec le tableau 'Objectif à définir' de "
        "l'entretien annuel completed/signed précédent du collaborateur, "
        "s'il existe."
    )

    def handle(self, *args, **options):
        updated = 0
        skipped_no_section = []

        interviews = Interview.objects.filter(type="annual").select_related("employee").order_by("due_date")
        for interview in interviews:
            content = interview.content or {}
            sections = content.get("sections", [])
            section = next((s for s in sections if s.get("id") == OBJECTIFS_SECTION_ID), None)
            if section is None:
                skipped_no_section.append(interview.id)
                continue

            questions = section.setdefault("questions", [])
            existing_ids = {q.get("id") for q in questions}
            new_questions = []
            if OBJECTIF_A_EVALUER_ID not in existing_ids:
                new_questions.append(blank_table_question(OBJECTIF_A_EVALUER_ID, "Objectif à évaluer"))
            if OBJECTIF_A_DEFINIR_ID not in existing_ids:
                new_questions.append(blank_table_question(OBJECTIF_A_DEFINIR_ID, "Objectif à définir"))

            if not new_questions:
                continue

            section["questions"] = new_questions + questions

            evaluer_question = next(
                (q for q in new_questions if q["id"] == OBJECTIF_A_EVALUER_ID), None
            )
            if evaluer_question is not None:
                previous = (
                    Interview.objects.filter(
                        employee=interview.employee,
                        type="annual",
                        status__in=("completed", "signed"),
                        due_date__lt=interview.due_date,
                    )
                    .order_by("-due_date")
                    .first()
                )
                if previous:
                    for prev_section in (previous.content or {}).get("sections", []):
                        for prev_question in prev_section.get("questions", []):
                            if prev_question.get("id") == OBJECTIF_A_DEFINIR_ID and table_has_content(
                                prev_question.get("answer")
                            ):
                                evaluer_question["answer"] = copy.deepcopy(prev_question["answer"])
                                break

            interview.content = content
            interview.save(update_fields=["content"])
            updated += 1

        self.stdout.write(f"{updated} entretien(s) mis à jour")
        if skipped_no_section:
            self.stdout.write(
                f"{len(skipped_no_section)} entretien(s) ignoré(s) (pas de section 'objectifs') : "
                f"{skipped_no_section}"
            )
