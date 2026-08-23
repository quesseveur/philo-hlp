#!/usr/bin/env python3
"""Génère l'index thématique HTML depuis le bloc thématique de index.tex.

Installation recommandée : placez ce script à la racine de index-sujets-hlp/.

Utilisation minimale depuis cette racine :
    python3 generer_index_thematique.py

La commande lit LaTeX_files/index.tex et crée ajout-index_YYYYMMDD.html
à la racine, à côté de carte-mentale.html.

Mise à jour optionnelle et sécurisée de la page déjà balisée :
    python3 generer_index_thematique.py --apply

Cette seconde commande crée toujours le fragment daté, puis remplace seulement
le contenu compris entre les marqueurs INDEX-THEMATIQUE-DEBUT et
INDEX-THEMATIQUE-FIN. Une copie de sauvegarde horodatée de la page est créée
avant toute écriture.
"""

from __future__ import annotations

import argparse
import html
import re
import shutil
import sys
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from urllib.parse import quote

CODES_CHAPITRES = ("ETA", "EXS", "MM", "CC", "HV", "HL")
NOMS_CHAPITRES = (
    "Éducation, transmission et émancipation",
    "Les expressions de la sensibilité",
    "Les métamorphoses du moi",
    "Création, continuités et ruptures",
    "Histoire et violence",
    "L’humain et ses limites",
)
SEMESTRES = (
    ("Semestre 1 — La Recherche de soi", 0, 3),
    ("Semestre 2 — L’Humanité en question", 3, 6),
)

DEBUT = "<!-- INDEX-THEMATIQUE-DEBUT -->"
FIN = "<!-- INDEX-THEMATIQUE-FIN -->"

# Corrections explicitement justifiées par des coquilles ou commentaires de l'index LaTeX.
CORRECTIONS = {
    "nostlagie": ["nostalgie"],
    "pitié sensibilité": ["pitié", "sensibilité"],
    "rêve (problème du rêve et du sommeil (Descartes))": ["rêve"],
    "vie et mort (âge de la vie)": ["vie et mort", "âge de la vie"],
}


@dataclass
class SousTheme:
    titre: str
    mots: list[str]


@dataclass
class Chapitre:
    code: str
    nom: str
    source_latex: str
    sous_themes: list[SousTheme]


def extraire_accolades(texte: str, debut: int) -> tuple[str, int]:
    """Extrait un groupe équilibré {…}, y compris en présence de sous-groupes."""
    if debut >= len(texte) or texte[debut] != "{":
        raise ValueError("Groupe LaTeX entre accolades attendu.")
    niveau = 0
    contenu: list[str] = []
    for position in range(debut, len(texte)):
        caractere = texte[position]
        if caractere == "{" and (position == 0 or texte[position - 1] != "\\"):
            niveau += 1
            if niveau > 1:
                contenu.append(caractere)
        elif caractere == "}" and (position == 0 or texte[position - 1] != "\\"):
            niveau -= 1
            if niveau == 0:
                return "".join(contenu), position + 1
            contenu.append(caractere)
        else:
            contenu.append(caractere)
    raise ValueError("Accolade fermante manquante dans index.tex.")


def remplacer_commandes_accolades(texte: str, commande: str, transformation) -> str:
    """Remplace récursivement une commande de type \\commande{…}."""
    resultat = ""
    position = 0
    marqueur = f"\\{commande}"
    while True:
        trouve = texte.find(marqueur, position)
        if trouve == -1:
            return resultat + texte[position:]
        resultat += texte[position:trouve]
        debut_groupe = trouve + len(marqueur)
        while debut_groupe < len(texte) and texte[debut_groupe].isspace():
            debut_groupe += 1
        if debut_groupe >= len(texte) or texte[debut_groupe] != "{":
            resultat += marqueur
            position = debut_groupe
            continue
        contenu, fin = extraire_accolades(texte, debut_groupe)
        resultat += transformation(contenu)
        position = fin


def texte_latex_vers_texte(texte: str) -> str:
    """Supprime une mise en forme LaTeX simple tout en gardant le terme lisible."""
    texte = texte.replace("~", " ")
    texte = remplacer_commandes_accolades(texte, "emph", lambda valeur: texte_latex_vers_texte(valeur))
    texte = remplacer_commandes_accolades(texte, "textbf", lambda valeur: texte_latex_vers_texte(valeur))

    def convertir_italique(valeur: str) -> str:
        valeur = texte_latex_vers_texte(valeur).strip()
        if valeur.startswith("et ses sous-entrées"):
            return ""
        if valeur.startswith("et sa sous-entrée"):
            return ", "
        if valeur.startswith("de l'entrée"):
            return ", "
        if valeur.startswith("la sous-entrée"):
            return " "
        return f" {valeur} "

    texte = remplacer_commandes_accolades(texte, "textit", convertir_italique)
    texte = texte.replace("\\", "")
    texte = re.sub(r"\s+", " ", texte)
    return texte.strip(" .,;:")


def extraire_elements_itemize(contenu: str) -> list[tuple[str, str]]:
    """Extrait les couples titre / mots-clés des items d'un environnement itemize."""
    elements: list[tuple[str, str]] = []
    morceaux = re.split(r"(?m)^\s*\\item\s+", contenu)
    for morceau in morceaux[1:]:
        debut = morceau.find("\\textbf")
        if debut == -1:
            continue
        debut_accolade = morceau.find("{", debut)
        titre_brut, fin_titre = extraire_accolades(morceau, debut_accolade)
        mots_bruts = morceau[fin_titre:].strip()
        mots_bruts = re.sub(r"^~?\s*:\s*", "", mots_bruts)
        elements.append((texte_latex_vers_texte(titre_brut), mots_bruts))
    return elements


def nettoyer_mot(mot_brut: str) -> list[str]:
    """Convertit une entrée LaTeX en un ou plusieurs mots-clés de recherche."""
    # Certaines précisions LaTeX décrivent une sous-entrée. Elles doivent devenir
    # deux étiquettes de recherche et non une longue chaîne affichée telle quelle.
    source = mot_brut.casefold().strip()
    if "famille" in source and "et éducation" in source:
        return ["famille", "éducation"]
    if "société" in source and "et éducation" in source:
        return ["société", "éducation"]
    if "introspection" in source and "se trouver" in source:
        return ["introspection", "se trouver"]
    if source.startswith("temps") and "passage du temps" in source:
        return ["temps", "passage du temps"]
    if source.startswith("morale") and "conscience morale" in source:
        return ["morale", "conscience morale"]
    if source.startswith("art") and "style artistique" in source:
        return ["art", "style artistique"]
    if "religion" in source and "entrée" in source and "art" in source:
        return ["religion"]
    if source.startswith("droit") and "droit international" in source:
        return ["droit international"]
    if source.startswith("relations inter-étatiques"):
        return ["relations inter-étatiques"]
    if source.startswith("vie") and "âge de la vie" in source:
        return ["vie", "âge de la vie"]

    mot = texte_latex_vers_texte(mot_brut)
    mot = re.sub(r"\s+,\s+", ", ", mot).strip(" .")
    cle_correction = mot.casefold()
    if cle_correction in CORRECTIONS:
        return CORRECTIONS[cle_correction]

    # Les explications entre parenthèses du fichier source ne sont pas toujours
    # des entrées de recherche : la seule exception à conserver est la précision
    # déjà contenue dans « nature (… ) » ou « guerre (… ) ».
    if mot.startswith("rêve ("):
        mot = "rêve"
    if mot.startswith("vie et mort ("):
        mot = "vie et mort"
    if mot.startswith("rôle ("):
        mot = "rôle"
    if mot.startswith("société ("):
        mot = "société"

    mot = re.sub(r"\s+", " ", mot).strip(" .;:")
    return [mot] if mot else []


def convertir_mots(mots_bruts: str) -> list[str]:
    """Découpe la liste d’un item et retire les doublons sans modifier l’ordre."""
    mots: list[str] = []
    deja_vus: set[str] = set()
    for fragment in mots_bruts.split(","):
        for mot in nettoyer_mot(fragment):
            cle = mot.casefold()
            if cle and cle not in deja_vus:
                mots.append(mot)
                deja_vus.add(cle)
    return mots


def extraire_chapitres(texte: str) -> list[Chapitre]:
    """Lit les six sous-sections situées dans « Se repérer dans l'index thématique »."""
    debut = texte.find(r"\section*{Se repérer dans l'index thématique}")
    if debut == -1:
        raise ValueError("Section « Se repérer dans l'index thématique » introuvable.")
    fin = texte.find(r"\vfill", debut)
    bloc = texte[debut: fin if fin != -1 else len(texte)]

    positions = [match.start() for match in re.finditer(r"\\subsection\{", bloc)]
    chapitres: list[Chapitre] = []
    for numero, position in enumerate(positions):
        if numero >= len(CODES_CHAPITRES):
            break
        debut_titre = bloc.find("{", position)
        titre_source, fin_titre = extraire_accolades(bloc, debut_titre)
        titre_source = texte_latex_vers_texte(titre_source)
        debut_liste = bloc.find(r"\begin{itemize}", fin_titre)
        fin_liste = bloc.find(r"\end{itemize}", debut_liste)
        if debut_liste == -1 or fin_liste == -1:
            raise ValueError(f"Liste de mots-clés introuvable pour « {titre_source} ».")

        contenu_liste = bloc[debut_liste:fin_liste]
        sous_themes = [
            SousTheme(titre=titre, mots=convertir_mots(mots_bruts))
            for titre, mots_bruts in extraire_elements_itemize(contenu_liste)
        ]
        chapitres.append(
            Chapitre(
                code=CODES_CHAPITRES[numero],
                nom=NOMS_CHAPITRES[numero],
                source_latex=titre_source,
                sous_themes=sous_themes,
            )
        )

    if len(chapitres) != 6:
        raise ValueError(f"Six chapitres attendus, {len(chapitres)} extraits.")
    return chapitres


def lien_recherche(mot: str) -> str:
    return f'<a href="{{{{ recherche_url }}}}?q={quote(mot, safe="")}">{html.escape(mot)}</a>'


def rendu_chapitre(chapitre: Chapitre) -> str:
    lignes = [
        '      <details class="index-chapitre" data-index-chapitre>',
        f'        <summary><span>{chapitre.code}</span> {html.escape(chapitre.nom)}</summary>',
        '        <div class="index-contenu">',
    ]
    for sous_theme in chapitre.sous_themes:
        liens = "".join(lien_recherche(mot) for mot in sous_theme.mots)
        lignes.extend(
            [
                '          <section>',
                f'            <h3>{html.escape(sous_theme.titre)}</h3>',
                f'            <p class="index-tags">{liens}</p>',
                '          </section>',
            ]
        )
    lignes.extend(['        </div>', '      </details>'])
    return "\n".join(lignes)


def rendu_fragment(chapitres: list[Chapitre]) -> str:
    lignes = [
        DEBUT,
        "{% assign recherche_url = '/index-sujets-hlp/sujets/' | relative_url %}",
        '<section id="index-thematique-detaille" class="index-thematique" aria-labelledby="titre-index-thematique">',
        '  <h2 id="titre-index-thematique">Consulter l’index thématique détaillé</h2>',
        '  <p class="note">Cette liste complète la carte mentale. Ouvrez les chapitres qui vous intéressent, puis cliquez sur un mot-clé pour lancer une recherche directe dans les sujets. Les mots-clés qui sont <span class="index-tag-partage">mis en valeur</span> (entourés et rouge orangé) sont présents dans les deux chapitres sélectionnés.</p>',
    ]

    for libelle, debut, fin in SEMESTRES:
        lignes.extend([
            '',
            '  <details class="index-semestre">',
            f'    <summary>{html.escape(libelle)}</summary>',
            '    <div class="index-grille">',
        ])
        lignes.extend(rendu_chapitre(chapitre) for chapitre in chapitres[debut:fin])
        lignes.extend(['    </div>', '  </details>'])

    lignes.extend(['</section>', FIN, ''])
    return "\n".join(lignes)


def nettoyer_anciens_fragments(dossier: Path, conserver: int) -> list[Path]:
    """Supprime seulement les anciens fragments ajout-index_YYYYMMDD.html."""
    motif = re.compile(r"ajout-index_\d{8}\.html$")
    fragments = sorted(
        (fichier for fichier in dossier.iterdir() if fichier.is_file() and motif.fullmatch(fichier.name)),
        key=lambda fichier: (fichier.name, fichier.stat().st_mtime),
        reverse=True,
    )
    supprimes: list[Path] = []
    for fichier in fragments[conserver:]:
        fichier.unlink()
        supprimes.append(fichier)
    return supprimes


def nettoyer_anciennes_sauvegardes(page: Path, conserver: int = 1) -> list[Path]:
    """Supprime les anciennes sauvegardes horodatées de la seule page ciblée."""
    motif = re.compile(
        re.escape(f"{page.stem}.sauvegarde-") + r"\d{8}-\d{6}" + re.escape(page.suffix) + r"$"
    )
    sauvegardes = sorted(
        (fichier for fichier in page.parent.iterdir() if fichier.is_file() and motif.fullmatch(fichier.name)),
        key=lambda fichier: (fichier.name, fichier.stat().st_mtime),
        reverse=True,
    )
    supprimes: list[Path] = []
    for fichier in sauvegardes[conserver:]:
        fichier.unlink()
        supprimes.append(fichier)
    return supprimes


def remplacer_bloc_page(page: Path, fragment: str) -> Path:
    contenu = page.read_text(encoding="utf-8")
    motif = re.compile(re.escape(DEBUT) + r".*?" + re.escape(FIN), re.DOTALL)
    occurrences = list(motif.finditer(contenu))
    if len(occurrences) != 1:
        raise ValueError(
            "La page doit contenir exactement un bloc balisé par "
            f"{DEBUT} et {FIN} (occurrences trouvées : {len(occurrences)})."
        )

    horodatage = datetime.now().strftime("%Y%m%d-%H%M%S")
    sauvegarde = page.with_name(f"{page.stem}.sauvegarde-{horodatage}{page.suffix}")
    shutil.copy2(page, sauvegarde)
    page.write_text(motif.sub(fragment.rstrip(), contenu), encoding="utf-8")
    return sauvegarde


def analyser_arguments() -> argparse.Namespace:
    racine_depot = Path(__file__).resolve().parent
    analyseur = argparse.ArgumentParser(description="Génère l’index thématique HTML depuis index.tex.")
    analyseur.add_argument(
        "index_tex", nargs="?", type=Path,
        default=racine_depot / "LaTeX_files" / "index.tex",
        help="Chemin vers index.tex (défaut : LaTeX_files/index.tex à côté du script)",
    )
    analyseur.add_argument(
        "--output-dir", type=Path, default=racine_depot,
        help="Dossier de sortie du fragment daté (défaut : dossier du script)",
    )
    analyseur.add_argument(
        "--page", type=Path, default=racine_depot / "carte-mentale.html",
        help="Page carte-mentale.html à mettre à jour (défaut : à côté du script)",
    )
    analyseur.add_argument("--apply", action="store_true", help="Autorise le remplacement du seul bloc HTML balisé")
    analyseur.add_argument(
        "--keep-fragments", type=int, default=2,
        help="Nombre de fragments datés à conserver (défaut : 2 ; minimum : 2)",
    )
    analyseur.add_argument(
        "--deep-clean", action="store_true",
        help="Supprime les anciens fragments et sauvegardes, en conservant une seule version de chaque",
    )
    return analyseur.parse_args()


def main() -> int:
    arguments = analyser_arguments()
    if arguments.keep_fragments < 2:
        print("Erreur : --keep-fragments doit être au moins égal à 2.", file=sys.stderr)
        return 2
    if arguments.deep_clean and arguments.apply:
        print("Erreur : --deep-clean ne peut pas être combiné avec --apply.", file=sys.stderr)
        return 2

    try:
        if arguments.deep_clean:
            fragments_supprimes = nettoyer_anciens_fragments(arguments.output_dir, 1)
            sauvegardes_supprimees = nettoyer_anciennes_sauvegardes(arguments.page, 1)
            print("Nettoyage approfondi terminé.")
            print("Fragments supprimés : " + (", ".join(fichier.name for fichier in fragments_supprimes) or "aucun"))
            print("Sauvegardes supprimées : " + (", ".join(fichier.name for fichier in sauvegardes_supprimees) or "aucune"))
            print("Conservation : un fragment daté et une sauvegarde de carte-mentale.html au maximum.")
            return 0

        if arguments.page is not None and not arguments.apply:
            print("Information : la page ne sera pas modifiée sans l’option --apply.")

        chapitres = extraire_chapitres(arguments.index_tex.read_text(encoding="utf-8"))
        fragment = rendu_fragment(chapitres)
        arguments.output_dir.mkdir(parents=True, exist_ok=True)
        sortie = arguments.output_dir / f"ajout-index_{date.today():%Y%m%d}.html"
        sortie.write_text(fragment, encoding="utf-8")
        supprimes = nettoyer_anciens_fragments(arguments.output_dir, arguments.keep_fragments)

        nombre_sous_themes = sum(len(chapitre.sous_themes) for chapitre in chapitres)
        nombre_mots = sum(len(sous_theme.mots) for chapitre in chapitres for sous_theme in chapitre.sous_themes)
        print(f"Fragment créé : {sortie}")
        print(f"{len(chapitres)} chapitres, {nombre_sous_themes} sous-thèmes, {nombre_mots} entrées de mots-clés.")
        if supprimes:
            print("Fragments supprimés : " + ", ".join(fichier.name for fichier in supprimes))
        else:
            print(f"Fragments conservés : au plus {arguments.keep_fragments} version(s) datée(s).")

        if arguments.apply:
            sauvegarde = remplacer_bloc_page(arguments.page, fragment)
            print(f"Page mise à jour : {arguments.page}")
            print(f"Sauvegarde créée : {sauvegarde}")
        return 0
    except (OSError, ValueError) as erreur:
        print(f"Erreur : {erreur}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
