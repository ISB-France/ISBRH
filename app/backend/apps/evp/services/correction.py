"""Point d'entree unique pour toute correction manuelle d'un champ
*_retenu (ou ajustement_manuel sur CompteurRH). Centralise la creation de
CorrectionManuelle pour ne pas dupliquer cette logique dans chaque modele.
"""

from apps.evp.models import CorrectionManuelle


def enregistrer_correction_manuelle(instance, champ, nouvelle_valeur, motif, corrige_par):
    """Corrige `champ` (ex: "heures_travaillees_retenu", "montant_retenu",
    "ajustement_manuel") sur `instance`, marque le champ *_modifie_manuellement
    correspondant a True (sauf pour CompteurRH.ajustement_manuel, qui n'a pas
    de flag dedie : sa presence + la trace CorrectionManuelle suffisent), et
    trace la correction dans une CorrectionManuelle.

    Retourne l'instance sauvegardee.
    """
    ancienne_valeur = getattr(instance, champ)
    setattr(instance, champ, nouvelle_valeur)

    if champ.endswith("_retenu"):
        # JourTravaille a un flag/motif par champ (heures_travaillees_*,
        # heures_nuit_*) ; PrimeCalculee a un flag/motif unique partage
        # entre montant_retenu et quantite_retenu. On essaie le flag
        # prefixe d'abord, et on retombe sur le flag generique sinon.
        prefix = champ[: -len("_retenu")]
        flag_attr = f"{prefix}_modifie_manuellement"
        motif_attr = f"{prefix}_motif_modification"
        if not hasattr(instance, flag_attr):
            flag_attr = "modifie_manuellement"
            motif_attr = "motif_modification"
        setattr(instance, flag_attr, True)
        setattr(instance, motif_attr, motif)

    instance.save()

    CorrectionManuelle.objects.create(
        content_object=instance,
        champ_modifie=champ,
        ancienne_valeur="" if ancienne_valeur is None else str(ancienne_valeur),
        nouvelle_valeur="" if nouvelle_valeur is None else str(nouvelle_valeur),
        motif=motif,
        corrige_par=corrige_par,
    )
    return instance
