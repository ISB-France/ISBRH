# Imports CSV

Quatre imports sont disponibles depuis la page **Utilisateurs** (réservé aux rôles RH/Admin).

---

## 1. Import utilisateurs (Kostango)

**Endpoint :** `POST /api/users/import_kostango/`

Import principal depuis l'export Kostango. Crée ou met à jour les utilisateurs par **email**.

### Colonnes du CSV

| Colonne | Description | Exemple |
|---|---|---|
| `personne email` | Email (clé de liaison) | `jean.dupont@isb.fr` |
| `Prénom` | Prénom | `Jean` |
| `Nom` | Nom | `DUPONT` |
| `Matricule` | Matricule unique | `00000001` |
| `Date de naissance` | Date de naissance | `15/03/1985` |
| `Date d'embauche` | Date d'entrée | `01/09/2020` |
| `Date de sortie` | Date de sortie (vide si actif) | `31/12/2024` |
| `Sexe` | `Homme` / `Femme` | `Homme` |
| `Site (nom complet)` | Site (chemin complet, dernier segment utilisé) | `ISB France > Paris` |
| `Poste` | Intitulé du poste | `Développeur` |
| `Type contrat` | `CDI` / `CDD` / `Intérim` / `Alternance` / `Stage` | `CDI` |
| `Statut` | Statut RH (`Cadre`/`FJ`/etc.) | `Cadre` |
| `Coefficient` | Coefficient | `250` |
| `Forfait jour` | `true` / `false` | `true` |
| `Tickets restaurant` | `true` / `false` | `true` |
| `Agence d'intérim` | Agence (intérim uniquement) | `Supplay` |
| `valideur N+1` | Nom complet du N+1 (résolu en 2ème passe) | `Marie MARTIN` |

### Règles
- **Clé :** `personne email`
- Création ou mise à jour (synchronisation) des champs ci-dessus
- `Cadre` et `Forfait jour` déduits du `Statut` Kostango
- Le `valideur N+1` est résolu dans un second temps pour établir la hiérarchie
- Les managers sont promus automatiquement (passage en rôle `manager`)

### Exemple de ligne
```
personne email,Prénom,Nom,Matricule,Date de naissance,Date d'embauche,Date de sortie,Sexe,Site (nom complet),Poste,Type contrat,Statut,Coefficient,Forfait jour,Tickets restaurant,Agence d'intérim,valideur N+1
jean.dupont@isb.fr,Jean,DUPONT,00000001,15/03/1985,01/09/2020,,Homme,ISB France > Paris,Développeur,CDI,Cadre,250,true,true,,Marie MARTIN
```

---

## 2. Import collaborateurs

**Endpoint :** `POST /api/users/import_collaborateurs/`

Fichier de base des collaborateurs (évolution professionnelle). Crée ou met à jour par **matricule**.

### Colonnes du CSV

| Colonne | Description | Exemple |
|---|---|---|
| `Matricule` | Matricule unique (clé de liaison) | `00000001` |
| `Nom` | Nom de famille | `DUPONT` |
| `Prénom` | Prénom | `Jean` |
| `Date de naissance` | Date de naissance | `15/03/1985` |
| `Date d'entrée` | Date d'embauche | `01/09/2020` |
| `Statut` | `actif` / `inactif` / `sortie` | `actif` |
| `Niveau` | Niveau du poste | `III` |
| `Coefficient` | Coefficient | `250` |
| `Poste` | Intitulé du poste | `Développeur` |
| `Fonctionnement` | Mode de fonctionnement | `Forfait jour` |

### Règles
- **Clé :** `Matricule`
- Création ou mise à jour des champs ci-dessus
- Si le matricule n'existe pas : création avec email temporaire (`{matricule}@collaborateur.isb.fr`)
- Si le matricule existe déjà : mise à jour des champs
- Le `Poste` est automatiquement créé dans la base si inexistant

### Exemple de ligne
```
Matricule,Nom,Prénom,Date de naissance,Date d'entrée,Statut,Niveau,Coefficient,Poste,Fonctionnement
00000001,DUPONT,Jean,15/03/1985,01/09/2020,actif,III,250,Développeur,Forfait jour
```

---

## 3. Import formations

**Endpoint :** `POST /api/users/import_formations/`

Import des formations suivies. Chaque ligne est une formation. Le rapprochement se fait par **matricule**.

### Colonnes du CSV

| Colonne | Description | Exemple |
|---|---|---|
| `Matricule` | Matricule du collaborateur | `00000001` |
| `DATE DE FORMATION` | Date de la formation | `15/06/2024` |
| `DOMAINE` | Domaine de la formation | `Informatique` |
| `Libellé formation` | Intitulé de la formation | `Formation Python avancé` |
| `NATURE DE LA FORMATION` | Nature | `Interne` |

### Règles
- **Clé :** `Matricule` (doit correspondre à un utilisateur existant)
- Création uniquement (pas de mise à jour / dédoublonnage)
- Le collaborateur doit exister au moment de l'import

### Exemple de ligne
```
Matricule,DATE DE FORMATION,DOMAINE,Libellé formation,NATURE DE LA FORMATION
00000001,15/06/2024,Informatique,Formation Python avancé,Interne
```

---

## 4. Import augmentations

**Endpoint :** `POST /api/users/import_augmentations/`

Import des augmentations salariales. Chaque ligne est une augmentation. Rapprochement par **matricule**.

### Colonnes du CSV

| Colonne | Description | Exemple |
|---|---|---|
| `Matricule` | Matricule du collaborateur | `00000001` |
| `Date` | Date d'effet de l'augmentation | `01/01/2025` |
| `Montant Augmentation` | Montant en euros | `1500.00` |

### Règles
- **Clé :** `Matricule` (doit correspondre à un utilisateur existant)
- Création uniquement (pas de mise à jour / dédoublonnage)
- Le montant peut utiliser la virgule comme séparateur décimal (`1500,50`)

### Exemple de ligne
```
Matricule,Date,Montant Augmentation
00000001,01/01/2025,1500.00
```

---

## Format général des CSV

- **Encodage :** UTF-8 avec ou sans BOM (accepté)
- **Séparateur :** virgule (`,`)
- **Dates :** `JJ/MM/AAAA` ou `AAAA-MM-JJ`
- **Fichier :** extension `.csv`

## Ordre d'import recommandé

1. **Import collaborateurs** (ou Kostango) — crée la base des salariés avec leurs matricules
2. **Import formations** — les formations sont rattachées aux matricules existants
3. **Import augmentations** — les augmentations sont rattachées aux matricules existants

## Dépannage

- Les erreurs sont retournées ligne par ligne avec le détail
- En cas d'échec partiel, les lignes valides sont tout de même importées
- Le doublon sur `matricule` (collaborateurs) ou `email` (Kostango) déclenche une mise à jour, pas un rejet

## Questions fréquentes

### Si j'importe deux fois le même email avec des rôles différents, ça crée deux utilisateurs ?

Non. L'import utilisateurs (Kostango) utilise l'**email** comme clé. Si vous importez `jean.dupont@isb.fr` avec le rôle `rh`, puis le même email avec le rôle `employee`, le second import **met à jour** l'utilisateur existant (son rôle deviendra `employee`). Il n'y a jamais de doublon sur un même email.

### Et pour l'import collaborateurs (matricule) ?

Même principe : la clé est le **matricule**. Deux imports avec le même matricule = mise à jour du même utilisateur, pas de doublon.

### Puis-je définir le rôle "admin" via un import ou le formulaire ?

Non. Le rôle `admin` a été retiré :
- Du formulaire de création/modification d'utilisateur
- Validé côté API : une tentative de passer `role: "admin"` sera rejetée

Le rôle `admin` ne peut être attribué que :
- Automatiquement à la première migration (via les variables d'environnement `ADMIN_EMAIL` / `ADMIN_PASSWORD`)
- Via l'interface d'administration Django (`/admin/`)

### L'import fonctionne-t-il avec des accents (é, è, ê, etc.) ?

Oui. L'encodage `utf-8-sig` accepte les caractères accentués et le BOM (Byte Order Mark) des exports Excel.
