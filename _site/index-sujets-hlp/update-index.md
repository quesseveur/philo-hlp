# Générer et mettre à jour l’index thématique depuis `index.tex`

## Réponse courte

L’index détaillé peut être automatisé, mais il ne doit **pas** être reconstruit directement depuis la seule liste des sujets : votre fichier `index.tex` apporte une vraie valeur éditoriale, puisqu’il choisit les sous-thématiques et répartit les mots-clés dans des ensembles intelligibles.

Le script fourni utilise donc `index.tex` comme **source de référence**. Lorsqu’un sujet est ajouté, vous conservez votre travail éditorial dans le LaTeX, puis vous régénérez le fragment HTML. Le résultat reste cohérent avec la carte et l’index détaillé.

| Solution | Fonctionnement | Avantage | Limite | Recommandation |
| --- | --- | --- | --- | --- |
| **Fragment à relire** | Le script crée `ajout-index_YYYYMMDD.html` ; vous copiez son contenu dans la page. | Le plus sûr ; vous gardez un contrôle total. | Une copie manuelle est nécessaire. | Très bon choix au début. |
| **Mise à jour balisée** | Le même script remplace lui-même le seul bloc balisé de `carte-mentale.html`, après sauvegarde. | Un lancement suffit ; aucune sélection manuelle. | La page doit contenir les deux marqueurs exacts. | **Choix recommandé** après le premier essai manuel. |
| **Génération à chaque publication** | Une automatisation de publication lance le script au moment de publier le site. | Aucun geste local après modification de `index.tex`. | Mise en place plus technique ; les changements doivent être vérifiés avant publication. | À envisager seulement lorsque votre flux de travail est stabilisé. |

## Emplacement du script et arborescence attendue

Placez `generer_index_thematique.py` **à la racine du dépôt**, au même niveau que `carte-mentale.html`. Votre arborescence sera donc :

```text
index-sujets-hlp/
├── carte-mentale.html
├── generer_index_thematique.py
└── LaTeX_files/
    └── index.tex
```

Avec cette organisation, vous n’avez pas à saisir les chemins : le script lit automatiquement `LaTeX_files/index.tex`, écrit le fragment à la racine de `index-sujets-hlp/` et, si vous choisissez l’option de mise à jour, cible automatiquement `carte-mentale.html`.

## Fichier fourni

Le script `generer_index_thematique.py` lit les six sous-sections du bloc « Se repérer dans l’index thématique » de `index.tex`. Il génère :

```text
ajout-index_YYYYMMDD.html
```

La date est automatiquement celle du jour, au format demandé `YYYYMMDD`.

Le fragment produit contient :

- les deux semestres ;
- les six chapitres ;
- les sous-thématiques du LaTeX ;
- les liens de recherche encodés correctement ;
- les marqueurs HTML nécessaires à la mise à jour automatique sécurisée.

## Première utilisation : générer un fragment à relire

Ouvrez un terminal à la racine de `index-sujets-hlp/`, là où se trouvent `carte-mentale.html` et le script, puis exécutez :

```bash
python3 generer_index_thematique.py
```

Sous Windows, si `python3` n’est pas reconnu, utilisez :

```bash
python generer_index_thematique.py
```

Le script crée un fichier tel que :

```text
ajout-index_20260821.html
```

Ouvrez ce fichier et copiez **tout son contenu**, depuis :

```html
<!-- INDEX-THEMATIQUE-DEBUT -->
```

jusqu’à :

```html
<!-- INDEX-THEMATIQUE-FIN -->
```

Remplacez par ce contenu le bloc de l’index détaillé dans `carte-mentale.html`. Conservez absolument ces deux commentaires : ils sont les garde-fous de la mise à jour automatisée.

## Mises à jour ultérieures en une commande

Après avoir ajouté les deux marqueurs au moins une fois dans `carte-mentale.html`, utilisez :

```bash
python3 generer_index_thematique.py --apply
```

Le script effectue alors quatre opérations :

1. il crée toujours le nouveau fragment daté `ajout-index_YYYYMMDD.html` ;
2. il vérifie que `carte-mentale.html` contient **exactement un** bloc balisé ;
3. il crée une sauvegarde horodatée, de la forme `carte-mentale.sauvegarde-YYYYMMDD-HHMMSS.html` ;
4. il remplace seulement le contenu entre les deux marqueurs, sans toucher au reste de la page, aux scripts ou à la carte mentale.

> Si les marqueurs sont absents, dupliqués ou modifiés, le script s’arrête sans modifier la page. C’est volontaire : ce comportement évite tout écrasement accidentel.

## Contrôles à effectuer après génération

Le script affiche le nombre de chapitres, de sous-thèmes et de mots-clés extraits. Avec le fichier `index.tex` fourni, le test a produit :

| Élément | Résultat |
| --- | --- |
| Chapitres | 6 |
| Sous-thèmes | 33 |
| Entrées de mots-clés | 310 |
| Fichier généré | `ajout-index_20260821.html` |

Ouvrez ensuite localement ou sur GitHub Pages la carte thématique et vérifiez qu’un clic sur un mot-clé préremplit toujours la recherche. Le correctif de `recherche.js` pour le paramètre `q` doit rester présent.

## Limites assumées

Le script reconnaît les principales commandes de mise en forme LaTeX du fichier actuel, ainsi que les sous-entrées explicitement annotées. Si vous modifiez fortement la syntaxe de `index.tex` — par exemple en remplaçant les listes `itemize` ou les titres `\textbf{…}` par une nouvelle structure — relancez d’abord le mode fragment à relire, plutôt que `--apply`.
