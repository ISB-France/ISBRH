from datetime import date
from decimal import Decimal

from django.core.management.base import BaseCommand

from apps.evp.models import CompteurRH


class Command(BaseCommand):
    help = (
        "Credite mensuellement 1/12 du plafond RTT annuel de chaque "
        "collaborateur (additionne au solde existant). Idempotent : ne "
        "credite pas deux fois le meme mois pour le meme employe. Conçue "
        "pour etre appelee par n'importe quel ordonnanceur externe "
        "(cron, Celery beat...)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--mois", type=int, default=None,
            help="Mois a crediter (1-12). Par defaut : le mois courant.",
        )
        parser.add_argument(
            "--annee", type=int, default=None,
            help="Annee a crediter. Par defaut : l'annee courante.",
        )

    def handle(self, *args, **options):
        today = date.today()
        mois = options["mois"] or today.month
        annee = options["annee"] or today.year

        credited = 0
        skipped = 0

        for compteur in CompteurRH.objects.all():
            # Idempotence via un marqueur dedie (dernier_mois_rtt_credite/
            # dernier_annee_rtt_creditee), et non via date_derniere_maj :
            # ce dernier est en auto_now, donc mis a jour par N'IMPORTE
            # QUELLE sauvegarde du compteur (y compris sa creation), ce qui
            # le rendrait faussement "a jour" pour le mois en cours avant
            # meme le premier credit. Le marqueur dedie ne bouge que quand
            # cette commande credite reellement le compteur.
            if (
                compteur.dernier_mois_rtt_credite == mois
                and compteur.dernier_annee_rtt_creditee == annee
            ):
                skipped += 1
                continue

            credit = (compteur.rtt_max_annuel or Decimal("0")) / Decimal("12")
            compteur.solde_rtt = (compteur.solde_rtt or Decimal("0")) + credit
            compteur.dernier_mois_rtt_credite = mois
            compteur.dernier_annee_rtt_creditee = annee
            compteur.save()
            credited += 1

        self.stdout.write(
            f"{credited} compteur(s) crédité(s), {skipped} déjà à jour pour {mois:02d}/{annee}."
        )
