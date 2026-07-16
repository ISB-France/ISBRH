ANNUAL_TEMPLATE = {
    "sections": [
        {
            "id": "bilan",
            "title": "Bilan de l'année écoulée",
            "questions": [
                {"id": "realisations", "label": "Principales réalisations", "type": "textarea", "answer": ""},
                {"id": "difficultes", "label": "Difficultés rencontrées", "type": "textarea", "answer": ""},
                {"id": "satisfaction", "label": "Niveau de satisfaction général", "type": "rating", "answer": None},
            ],
        },
        {
            "id": "competences",
            "title": "Compétences et savoir-être",
            "questions": [
                {"id": "points_forts", "label": "Points forts", "type": "textarea", "answer": ""},
                {"id": "axes_amelioration", "label": "Axes d'amélioration", "type": "textarea", "answer": ""},
                {"id": "competences_techniques", "label": "Compétences techniques à développer", "type": "textarea", "answer": ""},
            ],
        },
        {
            "id": "objectifs",
            "title": "Nouveaux objectifs pour l'année à venir",
            "questions": [
                {"id": "objectifs_metier", "label": "Objectifs métier", "type": "textarea", "answer": ""},
                {"id": "objectifs_personnels", "label": "Objectifs de développement personnel", "type": "textarea", "answer": ""},
                {"id": "indicateurs", "label": "Indicateurs de réussite", "type": "textarea", "answer": ""},
            ],
        },
        {
            "id": "formation",
            "title": "Formation et évolution",
            "questions": [
                {"id": "souhaits_formation", "label": "Souhaits de formation", "type": "textarea", "answer": ""},
                {"id": "souhaits_mobilite", "label": "Souhaits de mobilité", "type": "textarea", "answer": ""},
                {"id": "evolution_souhaitee", "label": "Perspectives d'évolution souhaitées", "type": "textarea", "answer": ""},
            ],
        },
        {
            "id": "commentaires",
            "title": "Commentaires",
            "questions": [
                {"id": "commentaire_employe", "label": "Commentaire de l'employé", "type": "textarea", "answer": ""},
                {"id": "commentaire_manager", "label": "Commentaire du manager", "type": "textarea", "answer": ""},
            ],
        },
    ],
}

PROFESSIONAL_TEMPLATE = {
    "sections": [
        {
            "id": "parcours",
            "title": "Parcours professionnel",
            "questions": [
                {"id": "poste_actuel", "label": "Poste actuel et missions", "type": "textarea", "answer": ""},
                {"id": "parcours_anterieur", "label": "Parcours depuis le dernier entretien", "type": "textarea", "answer": ""},
                {"id": "competences_acquises", "label": "Compétences acquises", "type": "textarea", "answer": ""},
            ],
        },
        {
            "id": "formation",
            "title": "Actions de formation",
            "questions": [
                {"id": "formations_suivies", "label": "Formations suivies", "type": "textarea", "answer": ""},
                {"id": "formations_souhaitees", "label": "Formations souhaitées", "type": "textarea", "answer": ""},
                {"id": "cpf", "label": "Utilisation du CPF", "type": "textarea", "answer": ""},
            ],
        },
        {
            "id": "projet",
            "title": "Projet professionnel",
            "questions": [
                {"id": "souhaits_evolution", "label": "Souhaits d'évolution", "type": "textarea", "answer": ""},
                {"id": "mobilite", "label": "Mobilité géographique / fonctionnelle", "type": "textarea", "answer": ""},
                {"id": "vae", "label": "Validation des Acquis (VAE)", "type": "textarea", "answer": ""},
            ],
        },
        {
            "id": "bilan",
            "title": "Bilan et perspectives",
            "questions": [
                {"id": "bilan_general", "label": "Bilan général de la période", "type": "textarea", "answer": ""},
                {"id": "perspectives", "label": "Perspectives et objectifs", "type": "textarea", "answer": ""},
                {"id": "conditions", "label": "Conditions de travail", "type": "textarea", "answer": ""},
            ],
        },
        {
            "id": "commentaires",
            "title": "Commentaires",
            "questions": [
                {"id": "commentaire_employe", "label": "Commentaire de l'employé", "type": "textarea", "answer": ""},
                {"id": "commentaire_manager", "label": "Commentaire du manager", "type": "textarea", "answer": ""},
            ],
        },
    ],
}

TEMPLATES = {
    "annual": ANNUAL_TEMPLATE,
    "professional": PROFESSIONAL_TEMPLATE,
}
