# Philo & HLP

Dépôt unique regroupant :
- une page d'accueil « hub » (`index.html`, racine du dépôt) listant les ressources HLP,
- la banque de sujets indexée, nichée dans `index-sujets-hlp/`, générée depuis `_data/sujets.json`
  (les sujets) et `_data/corriges.json` (les corrigés, liés par `id`).

Servi via GitHub Pages à `https://<utilisateur>.github.io/philo-hlp/` (dépôt de projet, PAS
`<utilisateur>.github.io`). La banque de sujets est donc à
`https://<utilisateur>.github.io/philo-hlp/index-sujets-hlp/`.

## Pourquoi une seule et même structure Jekyll ?

Un dépôt GitHub Pages de projet ne sert qu'un seul niveau d'URL (`.../<nom-du-dépôt>/`). Pour
obtenir une URL à deux niveaux (`philo-hlp/index-sujets-hlp/`), `index-sujets-hlp` doit être un
dossier de PAGES à l'intérieur de CE dépôt (pas un dépôt séparé). `_config.yml`, `_data/`,
`_layouts/`, `_includes/` et `assets/` sont donc partagés à la racine du dépôt ; seules les pages
propres à la banque de sujets vivent dans `index-sujets-hlp/`, avec des permaliens explicites
(`permalink: /index-sujets-hlp/...`).

## Ajouter une ressource HLP au hub

Ajouter un `<li>` dans `index.html` (racine), sur le modèle de celui qui pointe déjà vers
`index-sujets-hlp/`.

## Ajouter des sujets à la banque

**Depuis LaTeX (recommandé)** :

```bash
python3 outils/convertir_latex_vers_json.py \
  --sujets chemin/vers/tes/fichiers*.tex \
  --corriges chemin/vers/tes/corriges*.tex \
  --sortie-sujets _data/sujets.json \
  --sortie-corriges _data/corriges.json
```

**À la main** : ajouter directement un objet au tableau JSON (schéma détaillé dans le guide fourni).

Puis, dans tous les cas : `git add . && git commit -m "Ajout sujets" && git push`.

## Structure du dépôt

- `_config.yml` — configuration partagée (⚠️ `baseurl: "/philo-hlp"`, `sujets_section_title`, `parent_url`)
- `_data/sujets.json`, `_data/corriges.json` — les données de la banque de sujets
- `_layouts/hub.html` — gabarit de la page d'accueil du hub
- `_layouts/default.html` — gabarit des pages de la banque de sujets (`index-sujets-hlp/`)
- `_includes/nom-discipline.html` — convertit un code (`litt`/`phil`) en nom affiché
- `index.html` — page d'accueil du hub (racine du dépôt)
- `index-sujets-hlp/` — pages de la banque de sujets : accueil (`index.html`) et recherche (`sujets.html`)
- `index-sujets-hlp/donnees-recherche.json` — point d'accès JSON généré pour la recherche
- `assets/style.css` — mise en forme partagée
- `assets/recherche.js` — recherche/filtre côté navigateur (sans dépendance)
- `outils/convertir_latex_vers_json.py` — conversion LaTeX → JSON

## Points de vigilance connus (voir le guide complet pour le détail)

- Les codes d'axe (`ETA`, `EXS`, `EXSTA`...) sont repris tels quels depuis le LaTeX : pas de
  légende officielle fournie pour l'instant.
- `ABBREV_LIEU` dans le script de conversion doit être complété au fur et à mesure que de
  nouveaux lieux d'examen apparaissent, pour que les `id` générés restent fiables.
- `parent_url`/`parent_label` pointent vers le portail personnel séparé
  (`<utilisateur>.github.io`) — vérifie que « Quesseveur » est bien ton vrai nom d'utilisateur
  GitHub, ici et dans ce dépôt du portail.

Voir le guide complet fourni à côté de ce dépôt pour la mise en place initiale (comptes GitHub,
activation de Pages sur les deux dépôts, workflow Git).
