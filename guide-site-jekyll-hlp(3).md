# Guide : mettre en ligne Philo & HLP (portail + banque de sujets, GitHub + Jekyll)

## Vue d'ensemble

Deux dépôts GitHub distincts :

- **`philo-hlp`** — hub HLP + banque de sujets nichée dans `index-sujets-hlp/`, servi à `https://<utilisateur>.github.io/philo-hlp/`
- **`<utilisateur>.github.io`** — portail personnel minimal (page unique, sans Jekyll), servi à la racine

Étapes :

1. Créer les deux dépôts et déposer les fichiers fournis
2. Activer GitHub Pages sur les deux
3. Comprendre le mécanisme déjà en place : `_data/sujets.json` + `_data/corriges.json` → pages Liquid (section 4)
4. Adopter un workflow pour la suite (ajouter des sujets, republier)
5. Lancer `outils/convertir_latex_vers_json.py` sur le reste de ton corpus (section 7)
6. Vérifier les points de vigilance repérés sur les données sources (section 8)
7. Ajouter tes futurs cours au portail et au hub HLP au fur et à mesure (section 9)

## 1. Comptes et dépôts

- Créer un compte sur github.com si ce n'est pas déjà fait.
- **Dépôt 1 : `philo-hlp`** — cliquer **New repository**, nom exact `philo-hlp`. Cocher **Public**.
- **Dépôt 2 : `<utilisateur>.github.io`** — **New repository**, nom exact : ton `<nom-d'utilisateur>.github.io` (remplace `Quesseveur` par ton vrai nom d'utilisateur GitHub partout où il apparaît dans les fichiers fournis, y compris dans `_config.yml` de `philo-hlp` et dans `index.html` du portail). Cocher **Public**.
- Pour les deux : ne cocher ni "Add a README" ni ".gitignore" — les fichiers fournis contiennent déjà tout, ça évite un conflit au premier envoi.

Un dépôt de projet comme `philo-hlp` est toujours servi à `https://<utilisateur>.github.io/philo-hlp/` (un seul niveau après le nom d'utilisateur). Le dépôt `<utilisateur>.github.io` est le seul cas particulier servi directement à la racine. Voir section 9 pour le détail de comment `index-sujets-hlp/` s'imbrique à l'intérieur de `philo-hlp`.

## 2. Déposer les fichiers

Pour chacun des deux dépôts :

**Option rapide (navigateur, pour démarrer)** : sur la page du dépôt, *Add file* → *Upload files*, glisser-déposer tous les fichiers et dossiers fournis, puis *Commit changes*.

**Option recommandée assez vite pour `philo-hlp`** (Git en local) : vu le volume de sujets que tu vas indexer, éditer un gros JSON dans la petite fenêtre du navigateur devient vite inconfortable. Installe Git (git-scm.com), puis :

```bash
git clone https://github.com/<utilisateur>/philo-hlp.git
cd philo-hlp
# copier ici le contenu du zip philo-hlp fourni
git add .
git commit -m "Site initial : hub + banque de sujets"
git push
```

Même trio pour chaque mise à jour ultérieure : modifier les fichiers, `git add .`, `git commit -m "..."`, `git push`. Pour le portail (`<utilisateur>.github.io`), une simple page unique, l'upload par navigateur suffit largement — pas besoin de Git en local pour ça.

## 3. Activer GitHub Pages

Sur **chacun** des deux dépôts :

- **Settings** → section "Code and automation" → **Pages**
- Sous "Build and deployment" → "Source" : choisir **Deploy from a branch**
- Branche : `main` — dossier : `/ (root)`
- **Save**

Compte jusqu'à une dizaine de minutes avant que chaque site soit accessible ; le lien apparaît en haut de cette page une fois prêt.

## 4. Le mécanisme central : `_data/` + Liquid, et la recherche côté client

C'est le point clé pour un site "généré depuis un JSON". Tout fichier placé dans `_data/` est chargé automatiquement par Jekyll et devient accessible dans n'importe quelle page via `site.data.<nom_du_fichier>`.

Le schéma reflète la structure réelle d'un sujet HLP (un texte, deux questions — une de Lettres, une de Philosophie) : `_data/sujets.json` devient `site.data.sujets`, un tableau où chaque sujet a un tableau `questions` imbriqué :

```liquid
{% for s in site.data.sujets %}
  {{ s.titre }} ({{ s.auteur.nom }})
  {% for q in s.questions %}
    - {{ q.discipline }} : {{ q.intitule }}
  {% endfor %}
{% endfor %}
```

`_data/corriges.json` est un fichier **séparé**, relié au sujet par un `id` commun (ex. `met_2024_2`) plutôt qu'imbriqué directement dans le sujet — un corrigé n'existe pas toujours (`a_un_corrige` peut être `false`), et il est en général écrit après coup. Le filtre Liquid `where` fait la jointure :

```liquid
{% assign corrige = site.data.corriges | where: "id", s.id | first %}
{% if corrige %} ... {% endif %}
```

**La recherche** (`index-sujets-hlp/sujets.html`) a remplacé les pages statiques "par discipline"/"par axe" : au lieu de générer une page par catégorie, Jekyll génère un **point d'accès JSON** (`index-sujets-hlp/donnees-recherche.json`, un fichier avec front matter comme n'importe quelle page, mais `layout: null` pour ne pas l'envelopper de HTML) qui aplatit chaque sujet en une ligne par question, texte et corrigé déjà rendus en HTML (`markdownify` appliqué côté build). Une page Jekyll peut ainsi produire du JSON plutôt que du HTML — même mécanisme que pour les flux Atom/RSS (`jekyll-feed` fait exactement ça pour le XML). Une petite page JavaScript (`assets/recherche.js`, aucune dépendance) charge ce fichier au chargement de la page et filtre en direct par mot-clé (recherche insensible aux accents et à la casse), discipline et axe.

Les textes longs (`texte`, les `corriges[].texte`) restent stockés en Markdown dans `_data/` et sont rendus une seule fois au moment du build via `markdownify`, aussi bien pour l'affichage HTML classique que pour le JSON de recherche — pas de rendu Markdown côté navigateur.

Le HTML de base (page de recherche vide, structure) est généré au moment de la publication comme le reste du site ; seul le remplissage des résultats se fait en JavaScript, au chargement de la page.



## 5. Point de vigilance n°1 : `baseurl` et permaliens imbriqués

`baseurl` (dans `_config.yml` de `philo-hlp`) est réglé sur `"/philo-hlp"`, qui correspond au nom du dépôt. C'est ce qui permet à `{{ '/assets/style.css' | relative_url }}` de résoudre vers la bonne URL une fois en ligne.

Le dossier `index-sujets-hlp/` n'est PAS géré par `baseurl` (qui ne gère qu'un seul niveau, celui du dépôt), mais par les **permaliens explicites** de chaque page de la banque de sujets (`permalink: /index-sujets-hlp/sujets/`, etc.) et par les liens internes qui incluent ce préfixe explicitement (`{{ '/index-sujets-hlp/sujets/' | relative_url }}`). Si tu ajoutes une nouvelle page à la banque de sujets, pense à faire pareil : permalien ET liens préfixés par `/index-sujets-hlp/`.

## 6. Contenu fourni

**Dépôt `philo-hlp`** :
- `_config.yml` — `baseurl: "/philo-hlp"`, `sujets_section_title`, `parent_url`/`parent_label`, plugins, exclusions
- `_data/sujets.json` — les sujets (4 exemples réels, convertis depuis tes fichiers LaTeX)
- `_data/corriges.json` — les corrigés existants, reliés aux sujets par `id`
- `_layouts/hub.html` — gabarit de la page d'accueil du hub HLP
- `_layouts/default.html` — gabarit des pages de la banque de sujets, avec fil d'Ariane vers le hub
- `_includes/nom-discipline.html` — convertit un code (`litt`/`phil`) en nom affiché
- `index.html` — accueil du hub (racine du dépôt), liste les ressources HLP
- `index-sujets-hlp/index.html` — accueil de la banque de sujets, avec un sujet en vedette
- `index-sujets-hlp/sujets.html` — page de recherche (barre de recherche + filtres discipline/axe)
- `index-sujets-hlp/donnees-recherche.json` — point d'accès JSON généré par Jekyll pour la recherche (texte/corrigé déjà rendus en HTML)
- `assets/style.css` — mise en forme partagée
- `assets/recherche.js` — logique de recherche/filtre côté navigateur (aucune dépendance)
- `outils/convertir_latex_vers_json.py` — le script de conversion (voir section 7)
- `README.md` — équivalent condensé de ce guide, à consulter depuis le dépôt lui-même

**Dépôt `<utilisateur>.github.io`** :
- `index.html` — portail personnel : page unique, HTML/CSS pur (pas de Jekyll), liste tes cours au fur et à mesure. Le modèle de `<li>` pour un futur cours est en commentaire dans le fichier.
- `README.md` — rappel de la marche à suivre pour ajouter un cours et activer Pages

## 7. Convertir tes données LaTeX en JSON : `outils/convertir_latex_vers_json.py`

À partir des trois extraits réels que tu as fournis, le script a été écrit et testé (extraction + conversion des 4 sujets et du corrigé donnés en exemple, résultats vérifiés à la main). Usage :

```bash
cd outils
python3 convertir_latex_vers_json.py \
  --sujets chemin/vers/tes/fichiers*.tex \
  --corriges chemin/vers/tes/corriges*.tex \
  --sortie-sujets ../_data/sujets.json \
  --sortie-corriges ../_data/corriges.json
```

Ce que fait le script :

- **Extraction robuste des blocs** `\sujetn{...}{...}` et `\sujetcorrigen{...}{...}{...}` par comptage d'accolades (pas une regex naïve), donc résistant aux valeurs contenant des virgules (ex. `ajoutref`) ou, en théorie, des accolades imbriquées.
- **Parsing clé=valeur** tolérant aux espaces variables autour de `=`, aux valeurs entre accolades ou nues, aux valeurs-macros (`\litt`, `\RS`...), et qui ignore les lignes de commentaire (`%...`) — y compris entre deux arguments de macro.
- **Résolution des tags d'index** (`\theme{...}`) : la syntaxe xindy `cle@affichage` et `parent!enfant` est résolue en libellés lisibles (`memoire@mémoire` → `mémoire` ; `morale!conscience morale` → `morale › conscience morale`).
- **Nettoyage du texte** vers du Markdown : `\textit`/`\textbf` → italique/gras, espaces insécables (`~`) → espace insécable Unicode, `\footnote{}` → notes Markdown `[^n]` (numérotées globalement sur tout le corpus pour éviter toute collision d'ancre si plusieurs sujets sont affichés sur une même page), `\begin{itemize}` → liste Markdown.
- **Passe spécifique théâtre** (`genre=theatre`) : `\personnage{}` → nom en gras, `\didascalie{}` → italique entre parenthèses, `\phantom{}`/`\vspace`/`\setlength` → supprimés (purement typographiques, sans équivalent web utile).
- **Génération de l'`id`** de jointure sujet ↔ corrigé (ex. `met_2024_2`), reconstruite selon le même schéma que tes clés `%liencorrige={...}` commentées dans le source (lieu abrégé + année + jour, `rem` ajouté si `type=Remplacement`).
- **Signal des corrigés manquants** : si un sujet a `corrige=oui` mais qu'aucun `\sujetcorrigen` correspondant n'a été trouvé dans les fichiers passés à `--corriges`, le script te le signale en fin d'exécution plutôt que d'échouer silencieusement.

À vérifier / compléter avant de lancer sur tout le corpus (détails en tête du script) :

1. **`ABBREV_LIEU`** : seuls `Métropole` → `met` et `Centres étrangers` → `cea` sont attestés dans les exemples fournis. Complète ce dictionnaire pour chaque lieu réel de ton corpus (Polynésie, Asie, Amérique du Nord...) — le script ne devine jamais une abréviation non listée, il retombe sur un repli approximatif et te le signale plutôt que de générer un id faux en silence.
2. **Relecture des textes convertis pour les genres hors prose simple** (théâtre déjà géré, mais poésie ou autres mises en forme spécifiques pourraient nécessiter une passe supplémentaire dans `clean_latex_text`).

## 8. Points de vigilance repérés dans les exemples fournis

En convertissant tes 3 fichiers, quelques incohérences sont apparues dans les données sources elles-mêmes (pas dans la conversion) — à vérifier de ton côté :

- **`initialeprenom`** pour Victor Hugo est renseigné `H` (initiale du nom, pas du prénom `Victor` → `V`). Simple coquille probable, mais je n'ai pas corrigé silencieusement : la valeur brute est conservée telle quelle dans le JSON.
- **`corrige`** est tantôt `oui`, tantôt `Oui` selon les sujets (casse incohérente). Le script gère les deux en comparant en minuscules, donc sans impact sur `a_un_corrige`, mais une casse unifiée dans le LaTeX source resterait plus propre.
- Dans le texte d'Agoult, `XVIII{ieme} et XIX{e} siècles` contient des accolades nues sans commande associée (probablement une commande de type `\up{}`/`\textsuperscript{}` perdue) : conservé tel quel, à corriger à la source si besoin.
- La commande `\corrreference{}{Molière}{Dom Juan}{Don Juan}` du corrigé n'apparaît nulle part ailleurs dans les extraits fournis : son rendu (« Don Juan (Molière, *Dom Juan*) ») a été déduit du contexte et non d'une définition de macro. À valider — et à me signaler si le rendu réel diffère (couleur, lien, italique différent...).

## 9. Le portail personnel et la structure imbriquée `philo-hlp/index-sujets-hlp`

Comme demandé, la banque de sujets vit maintenant comme un **dossier de pages** (`index-sujets-hlp/`) à l'intérieur du dépôt `philo-hlp`, plutôt que comme un dépôt séparé — ce qui donne l'URL exacte `https://<utilisateur>.github.io/philo-hlp/index-sujets-hlp/`. Concrètement :

- `_config.yml`, `_data/`, `_layouts/`, `_includes/`, `assets/`, `outils/` sont **partagés à la racine** du dépôt `philo-hlp` (un seul `_config.yml`, une seule collecte de données par dépôt Jekyll).
- Les pages propres à la banque de sujets vivent dans `index-sujets-hlp/`, chacune avec un `permalink` explicite (`/index-sujets-hlp/sujets/`, etc.) et des liens internes préfixés de même.
- `index.html` à la racine du dépôt est une page différente : le **hub HLP**, qui utilise un layout distinct (`_layouts/hub.html`) et liste les ressources HLP (pour l'instant, uniquement la banque de sujets — tu pourras ajouter d'autres entrées dans le même `<ul class="liste-ressources">` au fur et à mesure).

Fil d'Ariane à double niveau, déjà en place :
- Sur les pages de la banque de sujets → lien interne vers le hub (`← Philo & HLP`, en haut de chaque page)
- Sur le hub → lien externe vers ton portail personnel, configurable dans `_config.yml` :

```yaml
parent_url: "https://Quesseveur.github.io/"
parent_label: "← Mes cours"
```

**Le portail personnel** (`<utilisateur>.github.io`, dépôt séparé — voir section 1) est une page HTML unique, volontairement minimale (pas de Jekyll : pas besoin pour une simple liste de liens). Il liste tes cours au fur et à mesure ; le lien vers `philo-hlp` y est déjà présent. Pour ajouter un futur cours, dupliquer le `<li>` modèle (en commentaire dans le fichier) avec son URL et une courte description.

Un seul nom à vérifier partout (`_config.yml` de `philo-hlp`, `index.html` du portail, et le nom du dépôt `<utilisateur>.github.io` lui-même) : remplace `Quesseveur` par ton vrai nom d'utilisateur GitHub s'il s'agissait d'un exemple.

## 10. Pour aller plus loin (optionnel, une fois la base en place)

- **Faire grossir la recherche sans ralentir le site** : `donnees-recherche.json` embarque le texte intégral de chaque sujet et corrigé. Avec quelques centaines d'entrées ça reste largement gérable, mais si le corpus devient très volumineux (plusieurs Mo), on pourra séparer un JSON "léger" (métadonnées seulement, pour filtrer) d'un chargement du texte à la demande — pas nécessaire tant que ce n'est pas mesurablement lent.
- **Nom de domaine personnalisé** : un fichier `CNAME` à la racine, plus une configuration DNS chez ton registrar.
- **GitHub Actions** : GitHub recommande désormais ce mode de déploiement plutôt que "Deploy from a branch" pour plus de contrôle (version de Jekyll, plugins). À envisager plus tard si le déploiement simple montre ses limites — pas nécessaire pour démarrer.
