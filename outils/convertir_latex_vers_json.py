"""
Extraction des blocs \\sujetn{...}{...} et \\sujetcorrigen{...}{...}{...}
depuis une source LaTeX, avec parsing des paires clé=valeur (gestion des
accolades imbriquées, des commentaires, et des valeurs macro comme \\litt).

Usage :
    python3 convertir_latex_vers_json.py \\
        --sujets chemin/vers/sujets1.tex chemin/vers/sujets2.tex \\
        --corriges chemin/vers/corriges1.tex \\
        --sortie-sujets ../_data/sujets.json \\
        --sortie-corriges ../_data/corriges.json

Avant de lancer sur tout le corpus :
  1. Complète le dictionnaire ABBREV_LIEU ci-dessous avec TOUS tes lieux réels
     (le script ne devine jamais une abréviation pour un lieu non listé : il
     retombe sur un repli approximatif et te le signale, plutôt que de générer
     silencieusement un id faux).
  2. Relis quelques `texte` convertis, en particulier pour les genres autres que
     de la prose simple (théâtre, poésie...) : la conversion Markdown gère les
     cas vus dans les exemples fournis, mais un genre ou une commande LaTeX
     inédite peut nécessiter une passe supplémentaire (voir la fonction
     clean_latex_text, bloc `if genre == 'theatre':`).
"""
import re
import json


def find_balanced(text, start):
    """text[start] doit être '{'. Retourne l'indice de l'accolade fermante correspondante."""
    assert text[start] == '{', f"attendu '{{' à l'indice {start}, trouvé {text[start]!r}"
    depth = 0
    for i in range(start, len(text)):
        if text[i] == '{':
            depth += 1
        elif text[i] == '}':
            depth -= 1
            if depth == 0:
                return i
    raise ValueError("accolade non fermée")


def skip_ws_and_comments(text, idx):
    """Avance idx en sautant les espaces/retours à la ligne ET les lignes de commentaire
    entières (ex: %%%Texte%%%%) qui séparent souvent deux arguments de macro."""
    n = len(text)
    while idx < n:
        if text[idx] in ' \t\n':
            idx += 1
        elif text[idx] == '%':
            while idx < n and text[idx] != '\n':
                idx += 1
        else:
            break
    return idx


def extract_macro_blocks(source, macro_name, n_args):
    """Trouve toutes les occurrences de \\macro_name{arg1}{arg2}...{argN}."""
    results = []
    pattern = re.compile(r'\\' + re.escape(macro_name) + r'\s*\{')
    pos = 0
    while True:
        m = pattern.search(source, pos)
        if not m:
            break
        idx = m.end() - 1  # position de la première '{'
        args = []
        for _ in range(n_args):
            idx = skip_ws_and_comments(source, idx)
            if source[idx] != '{':
                raise ValueError(f"argument manquant pour {macro_name} autour de l'indice {idx}")
            close = find_balanced(source, idx)
            args.append(source[idx + 1:close])
            idx = close + 1
        results.append(tuple(args))
        pos = idx
    return results


def strip_comments(block):
    """Supprime tout ce qui suit un '%' non échappé, ligne par ligne."""
    out_lines = []
    for line in block.split('\n'):
        m = re.search(r'(?<!\\)%', line)
        out_lines.append(line[:m.start()] if m else line)
    return '\n'.join(out_lines)


def parse_kv_block(block):
    """Parse un bloc 'cle=valeur, cle2={valeur, avec virgule}, ...' en dict."""
    block = strip_comments(block)
    data = {}
    i, n = 0, len(block)
    while i < n:
        while i < n and block[i] in ' \t\n,':
            i += 1
        if i >= n:
            break
        key_match = re.match(r'[A-Za-zÀ-ÿ_]+', block[i:])
        if not key_match:
            i += 1
            continue
        key = key_match.group(0)
        i += len(key)
        while i < n and block[i] in ' \t\n':
            i += 1
        if i >= n or block[i] != '=':
            continue
        i += 1
        while i < n and block[i] in ' \t\n':
            i += 1
        if i < n and block[i] == '{':
            close = find_balanced(block, i)
            value = block[i + 1:close]
            i = close + 1
        else:
            j = i
            while j < n and block[j] != ',':
                j += 1
            value = block[i:j]
            i = j
        data[key] = value.strip()
    return data


def clean_macro_value(v):
    """'\\litt' -> 'litt' ; '' -> ''"""
    v = v.strip()
    return v[1:] if v.startswith('\\') else v


def extract_theme_tags(text):
    """Extrait tous les \\theme{...} et renvoie (texte_sans_themes, liste_de_tags_affichables)."""
    tags = []
    out = []
    i, n = 0, len(text)
    while i < n:
        m = re.match(r'\\theme\s*\{', text[i:])
        if m:
            start = i + m.end() - 1
            close = find_balanced(text, start)
            raw = text[start + 1:close]
            tags.append(resolve_index_tag(raw))
            i = close + 1
        else:
            out.append(text[i])
            i += 1
    return ''.join(out), tags


def resolve_index_tag(raw):
    """Résout la syntaxe xindy d'une entrée d'index vers un libellé affichable.
    'memoire@mémoire' -> 'mémoire' ; 'morale!conscience morale' -> 'morale › conscience morale'"""
    parts = raw.split('!')
    resolved = []
    for p in parts:
        resolved.append(p.split('@')[-1].strip())
    return ' › '.join(resolved)


def extract_chapeau(text):
    """Extrait le \\chapeau{...} s'il existe, renvoie (texte_sans_chapeau, chapeau_ou_None)."""
    m = re.search(r'\\chapeau\s*\{', text)
    if not m:
        return text, None
    start = m.end() - 1
    close = find_balanced(text, start)
    chapeau = text[start + 1:close]
    remainder = text[:m.start()] + text[close + 1:]
    return remainder, clean_latex_text(chapeau, genre=None)


_FOOTNOTE_COUNTER = {'n': 0}


def basic_inline_clean(t):
    """Substitutions inline partagées : italique/gras, espaces insécables, tirets."""
    t = re.sub(r'\\textit\s*\{([^{}]*)\}', r'*\1*', t)
    t = re.sub(r'\\textbf\s*\{([^{}]*)\}', r'**\1**', t)
    t = t.replace('~', '\u00A0')
    t = re.sub(r'---', '—', t)
    return t


def clean_latex_text(text, genre=None):
    """Nettoyage générique LaTeX -> Markdown, plus passes spécifiques par genre."""
    t = text

    # notes de bas de page -> notes kramdown [^n] / [^n]: ... (contenu nettoyé aussi)
    footnotes = []
    while True:
        m = re.search(r'\\footnote\s*\{', t)
        if not m:
            break
        start = m.end() - 1
        close = find_balanced(t, start)
        content = basic_inline_clean(t[start + 1:close].strip())
        _FOOTNOTE_COUNTER['n'] += 1
        idx = _FOOTNOTE_COUNTER['n']
        footnotes.append(f"[^{idx}]: {content}")
        t = t[:m.start()] + f"[^{idx}]" + t[close + 1:]

    t = basic_inline_clean(t)

    # \corrreference{qualif}{auteur}{oeuvre}{perso} -> "perso (auteur, oeuvre)"
    # ⚠️ macro non documentée dans les extraits fournis : rendu déduit du contexte, à valider.
    def repl_corrreference(m):
        qualif, auteur, oeuvre, perso = (g.strip() for g in m.groups())
        label = perso if perso else oeuvre
        return f"{label} ({auteur}, *{oeuvre}*)"

    t = re.sub(
        r'\\corrreference\s*\{([^{}]*)\}\s*\{([^{}]*)\}\s*\{([^{}]*)\}\s*\{([^{}]*)\}',
        repl_corrreference, t,
    )

    # itemize -> liste markdown
    t = re.sub(r'\\begin\{itemize\}', '', t)
    t = re.sub(r'\\end\{itemize\}', '', t)
    t = re.sub(r'\\item\s*', '\n- ', t)

    if genre == 'theatre':
        t = re.sub(r'\\begin\{center\}(.*?)\\end\{center\}', lambda m: '\n' + m.group(1).strip() + '\n', t, flags=re.S)
        t = re.sub(r'\\personnage\s*\{([^{}]*)\}', lambda m: '\n**' + re.sub(r'\\textit\s*\{([^{}]*)\}', r'\1', m.group(1)).strip() + '**\n', t)
        t = re.sub(r'\\didascalie\s*\{([^{}]*)\}', r'*(\1)*', t)
        t = re.sub(r'\\phantom\s*\{[^{}]*\}', '', t)
        t = re.sub(r'\\vspace\*?\s*\{[^{}]*\}', '', t)
        t = re.sub(r'\\setlength\s*\{[^{}]*\}\s*\{[^{}]*\}', '', t)

    # nettoyage des espaces multiples / lignes vides en excès
    t = re.sub(r'[ \t]+\n', '\n', t)
    t = re.sub(r'\n{3,}', '\n\n', t)
    t = t.strip()

    if footnotes:
        t += '\n\n' + '\n'.join(footnotes)

    return t


# ⚠️ Dictionnaire à COMPLÉTER par Mikaël : n'invente pas d'abréviation pour un lieu
# non encore vu, ajoute-le ici explicitement (évite une clé fausse en silence).
ABBREV_LIEU = {
    'Métropole': 'met',
    'Centres étrangers': 'cea',
}


def make_id(lieu, annee, jour, type_session):
    base = ABBREV_LIEU.get(lieu.strip())
    if base is None:
        base = re.sub(r'[^a-z0-9]', '', lieu.lower())  # repli approximatif, à vérifier
    if type_session.strip().lower() == 'remplacement':
        base += 'rem'
    return f"{base}_{annee.strip()}_{jour.strip()}"


def convert_sujet(meta_raw, texte_raw):
    meta = parse_kv_block(meta_raw)
    texte, chapeau = extract_chapeau(texte_raw)
    texte, tags = extract_theme_tags(texte)
    genre = clean_macro_value(meta.get('genre', ''))
    texte = clean_latex_text(texte, genre=genre)

    sujet_id = make_id(meta['lieu'], meta['annee'], meta['jour'], meta.get('type', ''))

    return {
        "id": sujet_id,
        "auteur": {
            "nom": meta.get('nomauteur', ''),
            "prenom": meta.get('prenomauteur', ''),
            "initiale": meta.get('initialeprenom', ''),
            "particule": meta.get('particule', ''),
        },
        "titre": meta.get('titre', ''),
        "genre": genre,
        "datepub": meta.get('datepub', ''),
        "reference_complementaire": clean_latex_text(meta.get('ajoutref', ''), genre=None) if meta.get('ajoutref', '') else "",
        "lieu": meta.get('lieu', ''),
        "annee": meta.get('annee', ''),
        "jour": int(meta['jour']) if meta.get('jour', '').strip().isdigit() else meta.get('jour', ''),
        "type_session": meta.get('type', ''),
        "semestre": clean_macro_value(meta.get('semestre', '')),
        "theme_programme": meta.get('themeprogrammequn', ''),
        "a_un_corrige": clean_macro_value(meta.get('corrige', '')).strip().lower() == 'oui',
        "chapeau": chapeau or "",
        "questions": [
            {"discipline": clean_macro_value(meta.get('typequn', '')),
             "intitule": clean_latex_text(meta.get('qun', ''), genre=None)},
            {"discipline": clean_macro_value(meta.get('typeqdeux', '')),
             "intitule": clean_latex_text(meta.get('qdeux', ''), genre=None)},
        ],
        "texte": texte,
        "themes_index": tags,
    }


def convert_corrige(meta_raw, corr_un_raw, corr_deux_raw):
    meta = parse_kv_block(meta_raw)
    sujet_id = meta.get('liencorr') or make_id(meta['lieu'], meta['annee'], meta['jour'], meta.get('type', ''))
    return {
        "id": sujet_id,
        "corriges": [
            {"discipline": clean_macro_value(meta.get('typecorrun', '')),
             "texte": clean_latex_text(corr_un_raw, genre=None)},
            {"discipline": clean_macro_value(meta.get('typecorrdeux', '')),
             "texte": clean_latex_text(corr_deux_raw, genre=None)},
        ],
    }


def main():
    import argparse
    p = argparse.ArgumentParser(
        description="Convertit des fichiers .tex (\\sujetn / \\sujetcorrigen) vers "
                    "_data/sujets.json et _data/corriges.json pour le site Jekyll."
    )
    p.add_argument('--sujets', nargs='+', required=True,
                    help="un ou plusieurs fichiers .tex contenant des blocs \\sujetn{...}{...}")
    p.add_argument('--corriges', nargs='*', default=[],
                    help="un ou plusieurs fichiers .tex contenant des blocs \\sujetcorrigen{...}{...}{...}")
    p.add_argument('--sortie-sujets', default='sujets.json')
    p.add_argument('--sortie-corriges', default='corriges.json')
    args = p.parse_args()

    sujets = []
    for path in args.sujets:
        with open(path, encoding='utf-8') as f:
            source = f.read()
        for meta, texte in extract_macro_blocks(source, 'sujetn', 2):
            sujets.append(convert_sujet(meta, texte))

    corriges = []
    for path in args.corriges:
        with open(path, encoding='utf-8') as f:
            source = f.read()
        for meta, c1, c2 in extract_macro_blocks(source, 'sujetcorrigen', 3):
            corriges.append(convert_corrige(meta, c1, c2))

    with open(args.sortie_sujets, 'w', encoding='utf-8') as f:
        json.dump(sujets, f, ensure_ascii=False, indent=2)
    with open(args.sortie_corriges, 'w', encoding='utf-8') as f:
        json.dump(corriges, f, ensure_ascii=False, indent=2)

    print(f"{len(sujets)} sujets -> {args.sortie_sujets}")
    print(f"{len(corriges)} corrigés -> {args.sortie_corriges}")

    # sujets qui annoncent un corrigé (corrige=oui) mais pour lesquel aucun \\sujetcorrigen
    # n'a été trouvé dans les fichiers passés à --corriges : signal utile plutôt que silence.
    ids_corriges = {c['id'] for c in corriges}
    manquants = [s['id'] for s in sujets if s['a_un_corrige'] and s['id'] not in ids_corriges]
    if manquants:
        print(f"\n⚠️  corrige=oui mais \\sujetcorrigen introuvable pour : {manquants}")


if __name__ == '__main__':
    main()
