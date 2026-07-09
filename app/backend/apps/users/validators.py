import re

from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _


def validate_phone(value):
    if not value:
        return
    cleaned = re.sub(r"[\s\-\+\.\(\)]", "", value)
    if not re.match(r"^0\d{9}$", cleaned):
        raise ValidationError(
            _("Le numéro de téléphone doit être au format français (ex: 0612345678)"),
        )


MAX_CSV_UPLOAD_SIZE = 5 * 1024 * 1024  # 5 Mo

ALLOWED_CSV_CONTENT_TYPES = {
    "text/csv",
    "application/csv",
    "application/vnd.ms-excel",
    "text/plain",
}


def validate_csv_upload(file):
    """Retourne un message d'erreur (str) si le fichier uploade n'est pas un
    CSV exploitable, ou None s'il est accepte. Ne parse pas le contenu :
    verifie seulement l'extension, le type MIME declare et la taille, pour
    eviter de charger un fichier enorme ou non-CSV en memoire."""
    if not file.name.lower().endswith(".csv"):
        return "Le fichier doit avoir l'extension .csv"
    if file.content_type not in ALLOWED_CSV_CONTENT_TYPES:
        return f"Type de fichier non autorisé : {file.content_type}"
    if file.size > MAX_CSV_UPLOAD_SIZE:
        taille_mo = file.size / (1024 * 1024)
        return f"Fichier trop volumineux ({taille_mo:.1f} Mo, maximum 5 Mo)"
    return None
