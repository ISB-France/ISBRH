"""Verrou de clôture mensuelle au niveau base de données.

Contexte : la protection contre la modification de JourTravaille/Absence/
PrimeCalculee pour un mois déjà clôturé (ClotureMensuelle.statut='cloture')
n'existait jusqu'ici qu'en Python, dans clean()/save() des modèles
concernés (voir apps/evp/models.py, fonction check_month_not_closed).
Cette protection est contournable par toute écriture qui ne passe pas par
l'ORM Django : script de migration de données, accès direct psql par un
DBA, un futur import CSV en bulk_create/bulk_update, etc. — inacceptable
pour des données qui alimentent l'export paie.

Cette migration ajoute une fonction PL/pgSQL + un trigger BEFORE INSERT OR
UPDATE sur les trois tables concernées, qui refait la même vérification
directement en base, donc impossible à contourner sans désactiver le
trigger explicitement. La validation Python en clean()/save() est
conservée : elle donne un message d'erreur immédiat et une ValidationError
Django propre pour l'usage normal (formulaires/API) ; le trigger est le
filet de sécurité qui couvre tout le reste.
"""

from django.db import migrations

CREATE_FUNCTION_SQL = r"""
CREATE OR REPLACE FUNCTION evp_check_mois_non_cloture() RETURNS TRIGGER AS $$
DECLARE
    v_date date;
    v_mois integer;
    v_annee integer;
    v_closed boolean;
BEGIN
    IF TG_TABLE_NAME = 'evp_absence' THEN
        -- Une absence a une plage de dates : on verifie les deux bornes,
        -- au cas ou elle chevauche un mois cloture et un mois ouvert.
        FOREACH v_date IN ARRAY ARRAY[NEW.date_debut, NEW.date_fin]
        LOOP
            v_mois := EXTRACT(MONTH FROM v_date);
            v_annee := EXTRACT(YEAR FROM v_date);

            SELECT EXISTS(
                SELECT 1 FROM evp_cloturemensuelle
                WHERE employee_id = NEW.employee_id
                  AND mois = v_mois
                  AND annee = v_annee
                  AND statut = 'cloture'
            ) INTO v_closed;

            IF v_closed THEN
                RAISE EXCEPTION 'EVP_MOIS_CLOTURE: Le mois %/% est déjà clôturé pour l''employé % : aucune modification n''est possible.',
                    lpad(v_mois::text, 2, '0'), v_annee, NEW.employee_id;
            END IF;
        END LOOP;
    ELSE
        -- evp_jourtravaille et evp_primecalculee ont un unique champ "date".
        v_mois := EXTRACT(MONTH FROM NEW.date);
        v_annee := EXTRACT(YEAR FROM NEW.date);

        SELECT EXISTS(
            SELECT 1 FROM evp_cloturemensuelle
            WHERE employee_id = NEW.employee_id
              AND mois = v_mois
              AND annee = v_annee
              AND statut = 'cloture'
        ) INTO v_closed;

        IF v_closed THEN
            RAISE EXCEPTION 'EVP_MOIS_CLOTURE: Le mois %/% est déjà clôturé pour l''employé % : aucune modification n''est possible.',
                lpad(v_mois::text, 2, '0'), v_annee, NEW.employee_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

DROP_FUNCTION_SQL = "DROP FUNCTION IF EXISTS evp_check_mois_non_cloture();"

TRIGGER_DEFS = [
    ("evp_jourtravaille_check_cloture", "evp_jourtravaille"),
    ("evp_absence_check_cloture", "evp_absence"),
    ("evp_primecalculee_check_cloture", "evp_primecalculee"),
]

CREATE_TRIGGERS_SQL = "\n".join(
    f"""
    CREATE TRIGGER {trigger_name}
    BEFORE INSERT OR UPDATE ON {table_name}
    FOR EACH ROW EXECUTE FUNCTION evp_check_mois_non_cloture();
    """
    for trigger_name, table_name in TRIGGER_DEFS
)

DROP_TRIGGERS_SQL = "\n".join(
    f"DROP TRIGGER IF EXISTS {trigger_name} ON {table_name};"
    for trigger_name, table_name in TRIGGER_DEFS
)


class Migration(migrations.Migration):

    dependencies = [
        ("evp", "0003_credit_rtt_idempotence_marker"),
    ]

    operations = [
        migrations.RunSQL(
            sql=CREATE_FUNCTION_SQL,
            reverse_sql=DROP_FUNCTION_SQL,
        ),
        migrations.RunSQL(
            sql=CREATE_TRIGGERS_SQL,
            reverse_sql=DROP_TRIGGERS_SQL,
        ),
    ]
