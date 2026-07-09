from collections import defaultdict

from django.core.management.base import BaseCommand

from apps.users.models import User

TEMP_EMAIL_SUFFIX = "@collaborateur.isb.fr"


class Command(BaseCommand):
    help = (
        "Detecte les utilisateurs potentiellement dupliques (meme nom+prenom+date "
        "de naissance mais matricule/email differents), notamment issus d'un import "
        "collaborateurs (matricule) et d'un import Kostango (email) sur la meme personne."
    )

    def handle(self, *args, **options):
        groups = defaultdict(list)
        for user in User.objects.exclude(date_naissance=None).exclude(
            first_name="", last_name=""
        ):
            key = (
                user.first_name.strip().lower(),
                user.last_name.strip().lower(),
                user.date_naissance,
            )
            groups[key].append(user)

        duplicate_groups = []
        for key, users in groups.items():
            if len(users) < 2:
                continue
            matricules = {u.matricule for u in users}
            emails = {u.email.lower() for u in users}
            if len(matricules) > 1 and len(emails) > 1:
                duplicate_groups.append((key, users))

        if not duplicate_groups:
            self.stdout.write("Aucun doublon potentiel detecte.")
            return

        for (first_name, last_name, date_naissance), users in duplicate_groups:
            self.stdout.write(
                f"Doublon potentiel : {first_name} {last_name} "
                f"(né(e) le {date_naissance}) :"
            )
            for u in users:
                temp_flag = " [email temporaire]" if u.email.lower().endswith(
                    TEMP_EMAIL_SUFFIX
                ) else ""
                self.stdout.write(
                    f"  - id={u.id} matricule={u.matricule} email={u.email}{temp_flag}"
                )

        self.stdout.write(
            f"\n{len(duplicate_groups)} groupe(s) de doublons potentiels detecte(s)."
        )
