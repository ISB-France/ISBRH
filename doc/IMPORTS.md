# Imports CSV

Cinq imports sont disponibles depuis la page **Utilisateurs** (réservé aux rôles RH/Admin), plus un import de modèles d'entretien depuis la page **Modèles** (réservé aux rôles RH/Admin/Manager).

ℹ️ La création manuelle d'un utilisateur via le formulaire (page **Utilisateurs**) suit la même règle que l'import Kostango : **Prénom, Nom et Matricule sont obligatoires, l'email est optionnel**. S'il est laissé vide, un email temporaire `{matricule}@sansemail.isb.fr` est généré automatiquement.

---

## 1. Import utilisateurs (Kostango)

**Endpoint :** `POST /api/users/import_kostango/`

Import principal depuis l'export Kostango. Crée ou met à jour les utilisateurs par **matricule**.

### Colonnes du CSV

| Colonne | Description | Exemple | Obligatoire |
|---|---|---|---|
| `Prénom` | Prénom | `Jean` | **oui** |
| `Nom` | Nom | `DUPONT` | **oui** |
| `Matricule` | Matricule unique (clé de liaison) | `00000001` | **oui** |
| `personne email` | Email ; si absent, un email temporaire est généré (`{matricule}@kostango.isb.fr`) | `jean.dupont@isb.fr` | non |
| `Date de naissance` | Date de naissance | `15/03/1985` | non |
| `Date d'embauche` | Date d'entrée | `01/09/2020` | non |
| `Date de sortie` | Date de sortie (vide si actif) | `31/12/2024` | non |
| `Sexe` | `Homme` / `Femme` | `Homme` | non |
| `Site (nom complet)` | Site (chemin complet, dernier segment utilisé) | `ISB France > Paris` | non |
| `Poste` | Intitulé du poste | `Développeur` | non |
| `Type contrat` | `CDI` / `CDD` / `Intérim` / `Alternance` / `Stage` | `CDI` | non |
| `Statut` | Statut RH (`Cadre`/`FJ`/etc.) | `Cadre` | non |
| `Coefficient` | Coefficient | `250` | non |
| `Forfait jour` | `true` / `false` | `true` | non |
| `Tickets restaurant` | `true` / `false` | `true` | non |
| `Exploitation` | `Oui` / `Non` — active les entretiens d'évaluation et professionnel tous les 2 ans | `Oui` | non |
| `valideur N+1` | Nom complet du N+1 (résolu en 2ème passe) | `Marie MARTIN` | non |

### Règles
- **Clé :** `Matricule`
- **Obligatoires :** `Prénom`, `Nom`, `Matricule` — une ligne sans l'un de ces trois champs est rejetée avec une erreur explicite
- `personne email` est optionnel : si absent, un email temporaire `{matricule}@kostango.isb.fr` est généré automatiquement
- Création ou mise à jour (synchronisation) des champs ci-dessus
- `Cadre` et `Forfait jour` déduits du `Statut` Kostango
- Le `valideur N+1` est résolu dans un second temps pour établir la hiérarchie (recherche par nom complet)
- Les managers sont promus automatiquement (passage en rôle `manager`)

### Exemple de ligne
```
Prénom,Nom,Matricule,personne email,Date de naissance,Date d'embauche,Date de sortie,Sexe,Site (nom complet),Poste,Type contrat,Statut,Coefficient,Forfait jour,Tickets restaurant,Exploitation,valideur N+1
Jean,DUPONT,00000001,jean.dupont@isb.fr,15/03/1985,01/09/2020,,Homme,ISB France > Paris,Développeur,CDI,Cadre,250,true,true,Non,Marie MARTIN
```

---

## 2. Import évolution professionnelle

**Endpoint :** `POST /api/users/import_collaborateurs/`

Fichier de base des collaborateurs (évolution professionnelle). Crée ou met à jour par **matricule**.

⚠️ À ne pas confondre avec l'**import évolutions** (section 5 ci-dessous, `import_evolutions`) : celui-ci met à jour l'état courant du collaborateur (statut, niveau, coefficient, poste actuel...), alors que l'import évolutions crée un **historique** d'évolutions passées (une ligne = un changement daté).

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

## 5. Import évolutions

**Endpoint :** `POST /api/users/import_evolutions/`

Import de masse d'évolutions historiques (poste, service, site, statut, niveau, coefficient, salaire) pour alimenter la timeline de carrière d'un collaborateur. Chaque ligne est une évolution. Rapprochement par **matricule**.

### Colonnes du CSV

| Colonne | Description | Exemple |
|---|---|---|
| `Matricule` | Matricule du collaborateur (doit déjà exister) | `00000001` |
| `Type` | `poste` / `service` / `site` / `statut` / `niveau` / `coefficient` / `salaire` | `poste` |
| `Ancienne valeur` | Valeur avant l'évolution | `Développeur` |
| `Nouvelle valeur` | Valeur après l'évolution | `Développeur senior` |
| `Date d'effet` | Date de prise d'effet | `01/09/2024` |

### Règles
- **Clé :** `Matricule` (doit correspondre à un utilisateur existant)
- Création uniquement (pas de mise à jour / dédoublonnage)
- `Type` est validé contre la liste ci-dessus (insensible à la casse) ; une valeur invalide rejette la ligne
- `Date d'effet` accepte `JJ/MM/AAAA`, `AAAA-MM-JJ` ou `JJ/MM/AA` ; vide si absente ou non reconnue

### Exemple de ligne
```
Matricule,Type,Ancienne valeur,Nouvelle valeur,Date d'effet
00000001,poste,Développeur,Développeur senior,01/09/2024
```

---

## 6. Import modèles d'entretien

**Endpoint :** `POST /api/interview-templates/import_csv/`

Crée des modèles d'entretien (`InterviewTemplate`) à partir d'un CSV décrivant
leurs sections et questions. Réservé aux rôles RH/Admin/Manager. Chaque ligne
décrit une question ; les lignes partageant `name`+`type`+`description`
forment un même modèle, et celles partageant en plus `section_id` forment une
même section.

### Colonnes du CSV

| Colonne | Description | Exemple |
|---|---|---|
| `name` | Nom du modèle (clé de regroupement) | `Entretien annuel` |
| `type` | Type d'entretien (`annual`/`professional`/`bilan`/`forfait`/`fin_carriere`) | `annual` |
| `description` | Description du modèle | `Modèle standard` |
| `section_id` | Identifiant de section (défaut `s1`) | `s1` |
| `section_title` | Titre de la section | `Bilan de l'année` |
| `question_id` | Identifiant de la question | `q1` |
| `question_label` | Libellé de la question | `Principales réalisations` |
| `question_type` | `textarea` / `rating` / `yesno` / `table` (défaut `textarea` si absent ou invalide) | `textarea` |

### Règles
- **Clé de regroupement :** `name` + `type` + `description`
- Une ligne sans `section_title` ni `question_label` est ignorée
- Une ligne sans `question_id`/`question_label` renseignés ne crée que la section (pas de question)
- Toujours en création : aucune mise à jour d'un modèle existant du même nom

### Exemple de ligne
```
name,type,description,section_id,section_title,question_id,question_label,question_type
Entretien annuel,annual,Modèle standard,s1,Bilan de l'année,q1,Principales réalisations,textarea
```

---

## Format général des CSV

- **Encodage :** UTF-8 avec ou sans BOM (accepté)
- **Séparateur :** virgule (`,`)
- **Dates :** `JJ/MM/AAAA` ou `AAAA-MM-JJ`
- **Fichier :** extension `.csv`

## Ordre d'import recommandé

1. **Import Kostango** — crée la base des salariés avec leur **email réel** et leur matricule
2. **Import évolution professionnelle** — vient ensuite compléter/mettre à jour les mêmes personnes par **matricule**
3. **Import formations** — les formations sont rattachées aux matricules existants
4. **Import augmentations** — les augmentations sont rattachées aux matricules existants
5. **Import évolutions** — les évolutions sont rattachées aux matricules existants

⚠️ **Toujours importer Kostango avant l'évolution professionnelle.** Si un
collaborateur est importé via `import_collaborateurs` avant d'avoir été créé
par `import_kostango`, et que son matricule n'est reconnu par aucun utilisateur
existant, un compte est créé avec un **email temporaire**
(`{matricule}@collaborateur.isb.fr`). Si ce même collaborateur est ensuite
importé via Kostango (matching par email réel), Kostango ne retrouvera pas le
compte temporaire (clé différente) et créera un **second** compte pour la même
personne : c'est un doublon. Faire l'import Kostango en premier évite ce cas,
puisque l'import évolution professionnelle retrouvera alors le compte existant
par matricule et le mettra à jour au lieu d'en créer un nouveau.

Chaque création d'utilisateur avec un email temporaire lors de l'import
évolution professionnelle est signalée par un `WARNING` dans les logs
applicatifs (`apps.users.views`) : `Aucun utilisateur trouvé pour le matricule
X, création avec email temporaire`. Surveillez ces logs après un import en
masse.

## Détecter les doublons après import

Après tout import en masse (Kostango et/ou évolution professionnelle), exécuter :

```
python manage.py detect_duplicate_users
```

Cette commande liste les utilisateurs potentiellement dupliqués : même
prénom + nom + date de naissance, mais matricule et email différents (typiquement
un compte créé par Kostango avec un email réel, et un second créé par l'import
évolution professionnelle avec un email temporaire `@collaborateur.isb.fr`). Elle
n'effectue aucune fusion automatique — la résolution (fusion manuelle ou
suppression du compte temporaire) reste à la charge de l'équipe RH.

## Dépannage

- Les erreurs sont retournées ligne par ligne avec le détail
- En cas d'échec partiel, les lignes valides sont tout de même importées
- Le doublon sur `matricule` (évolution professionnelle) ou `email` (Kostango) déclenche une mise à jour, pas un rejet
- Le doublon **entre** les deux imports (personne créée deux fois, une fois par
  chacun) n'est pas détecté automatiquement à l'import : voir
  `detect_duplicate_users` ci-dessus

## Questions fréquentes

### Si j'importe deux fois le même email avec des rôles différents, ça crée deux utilisateurs ?

Non. L'import utilisateurs (Kostango) utilise l'**email** comme clé. Si vous importez `jean.dupont@isb.fr` avec le rôle `rh`, puis le même email avec le rôle `employee`, le second import **met à jour** l'utilisateur existant (son rôle deviendra `employee`). Il n'y a jamais de doublon sur un même email.

### Et pour l'import évolution professionnelle (matricule) ?

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
