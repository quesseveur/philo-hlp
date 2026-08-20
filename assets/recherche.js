(function () {
  "use strict";

  function normaliser(s) {
    return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  // --- Éléments du DOM ---
  var champRecherche = document.getElementById("recherche");
  var filtreDiscipline = document.getElementById("filtre-discipline");
  var filtreType = document.getElementById("filtre-type");
  var filtreLieu = document.getElementById("filtre-lieu");
  var checkboxesAnnees = document.querySelectorAll('input[name="filtre-annee"]');
  var checkboxesAxes = document.querySelectorAll('input[name="filtre-axe"]');
  var resultats = document.getElementById("resultats");
  var compteur = document.getElementById("compteur");

  if (!champRecherche || !resultats) return;

  var mode = champRecherche.getAttribute("data-mode") || "sujets";
var donnees = [];

/* Lit le mot transmis par la carte : /sujets/?q=mémoire */
var motCleURL = new URLSearchParams(window.location.search).get("q");
if (motCleURL) {
  champRecherche.value = motCleURL;
}

  var axesConnus = [];
  for (var i = 0; i < checkboxesAxes.length; i++) {
    if (checkboxesAxes[i].value !== "Autres") axesConnus.push(checkboxesAxes[i].value);
  }

  function haystack(item) {
    var refsCulturellesStr = "";
    if (mode === "corriges" && item.references_culturelles && item.references_culturelles !== "null") {
      refsCulturellesStr = Array.isArray(item.references_culturelles) 
        ? item.references_culturelles.join(" ") 
        : String(item.references_culturelles);
    }

    var texteBrut = [
      item.auteur, item.titre, item.intitule, item.lieu, item.axe, item.annee,
      (item.themes || []).join(" "),
      refsCulturellesStr
    ].join(" ");

    var texteSansHtml = texteBrut.replace(/<[^>]*>?/gm, '');
    return normaliser(texteSansHtml);
  }

  function correspond(item, texte, discipline, type_question, lieu, anneesCochees, axesCoches) {
    if (mode === "corriges" && (!item.corrige_html || item.corrige_html === "null")) return false;
    if (discipline && item.discipline !== discipline) return false;
    if (type_question && item.type_question !== type_question) return false;
    if (lieu && item.lieu !== lieu) return false;
    
    if (anneesCochees && anneesCochees.length > 0) {
      if (anneesCochees.indexOf(String(item.annee)) === -1) return false;
    }

    if (axesCoches && axesCoches.length > 0) {
      var correspondAxe = false;
      for (var j = 0; j < axesCoches.length; j++) {
        var axeCoche = axesCoches[j];
        if (axeCoche === "Autres") {
          if (!item.axe || axesConnus.indexOf(item.axe) === -1) {
            correspondAxe = true;
            break;
          }
        } else {
          if (item.axe && item.axe.indexOf(axeCoche) !== -1) {
            correspondAxe = true;
            break;
          }
        }
      }
      if (!correspondAxe) return false;
    }

    if (texte) {
      var termesRecherche = texte.split(/[,\s]+/).filter(function(t) { return t.length > 0; });
      var contenuSujet = haystack(item);
      var tousLesTermesSontPresents = termesRecherche.every(function(term) {
        return contenuSujet.indexOf(term) !== -1;
      });
      if (!tousLesTermesSontPresents) return false;
    }
    
    return true;
  }

  function lierAccordeon(detailsA, detailsB) {
    detailsA.addEventListener("toggle", function () {
      if (detailsA.open) detailsB.open = false;
    });
    detailsB.addEventListener("toggle", function () {
      if (detailsB.open) detailsA.open = false;
    });
  }

  function rendreResultat(item) {
    var li = document.createElement("li");

    var p = document.createElement("p");
    p.className = "intitule";
    var badge = document.createElement("span");
    badge.className = "badge-discipline";
    
    var nomDisc = item.discipline === "litt" ? "littéraire" : (item.discipline === "phil" ? "philosophique" : "");
    var nomTyp = item.type_question === "interpretation" ? "Interprétation" : (item.type_question === "essai" ? "Essai" : "");
    
    if (nomTyp && nomDisc) {
      badge.textContent = (nomTyp + " " + nomDisc).toUpperCase();
    } else {
      badge.textContent = (item.discipline === "litt" ? "LETTRES" : (item.discipline === "phil" ? "PHILOSOPHIE" : "HLP"));
    }
    
    p.appendChild(badge);
    p.appendChild(document.createTextNode(" " + item.intitule));
    li.appendChild(p);

    var meta = document.createElement("p");
    meta.className = "meta";
    meta.innerHTML = item.auteur + ", <em>" + item.titre + "</em> — " + item.lieu + ", " + item.annee + " · axe " + item.axe;
    if (item.a_un_corrige) {
      meta.innerHTML += " · <strong>Éléments d'évaluation disponibles</strong>";
    }
    li.appendChild(meta);

    if (mode === "corriges") {
      
      // Affichage visuel des références AVANT l'accordéon, avec limite à 5 et bouton "... autres"
      if (item.references_culturelles && item.references_culturelles !== "null") {
        var refsList = Array.isArray(item.references_culturelles) ? item.references_culturelles : [item.references_culturelles];
        
        if (refsList.length > 0) {
          var refsP = document.createElement("p");
          refsP.className = "tags"; 
          refsP.style.marginTop = "10px"; 
          refsP.style.marginBottom = "15px"; 
          
          var limite = 5; // La limite est rétablie ici

          refsList.forEach(function(ref, index) {
            var span = document.createElement("span");
            span.className = "tag";
            span.style.backgroundColor = "#f0f4f8"; 
            span.style.color = "#2c3e50";
            span.style.border = "1px solid #cbd5e1";
            span.style.cursor = "pointer"; 
            span.title = "Cliquer pour rechercher cette référence"; 
            span.innerHTML = "📖 " + ref; 

            // Application de la limite visuelle
            if (index >= limite) {
              span.style.display = "none";
              span.classList.add("ref-cachee"); 
            }

            span.addEventListener("click", function(e) {
              e.preventDefault();
              var tempDiv = document.createElement("div");
              tempDiv.innerHTML = ref;
              var textRecherche = tempDiv.textContent || tempDiv.innerText || "";
              
              var champ = document.getElementById("recherche");
              champ.value = textRecherche.trim();
              rafraichir();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            });

            refsP.appendChild(span);
          });

          // Création du bouton si on dépasse la limite
          if (refsList.length > limite) {
            var btnPlus = document.createElement("span");
            btnPlus.className = "tag";
            btnPlus.style.backgroundColor = "#e2e8f0";
            btnPlus.style.color = "#475569";
            btnPlus.style.border = "1px dashed #94a3b8";
            btnPlus.style.cursor = "pointer";
            btnPlus.textContent = "+ " + (refsList.length - limite) + " autres...";

            btnPlus.addEventListener("click", function(e) {
              e.preventDefault();
              var elementsCaches = refsP.querySelectorAll(".ref-cachee");
              elementsCaches.forEach(function(el) {
                el.style.display = "inline-block"; 
              });
              btnPlus.style.display = "none"; 
            });

            refsP.appendChild(btnPlus);
          }

          // On ajoute les références culturelles directement dans la balise `li`
          li.appendChild(refsP); 
        }
      }

      var detailsTexte = document.createElement("details");
      var summaryTexte = document.createElement("summary");
      summaryTexte.textContent = "Voir le texte";
      detailsTexte.appendChild(summaryTexte);
      
      var texteDiv = document.createElement("div");
      texteDiv.className = "texte-extrait";
      texteDiv.innerHTML = item.texte_html;
      ajouterBoutonsExport(item, texteDiv);
      detailsTexte.appendChild(texteDiv);
      li.appendChild(detailsTexte);

      var detailsCorrige = document.createElement("details");
      var summaryCorrige = document.createElement("summary");
      summaryCorrige.textContent = "Voir les éléments de correction";
      detailsCorrige.appendChild(summaryCorrige);
      
      var corrDiv = document.createElement("div");
      corrDiv.className = "corrige-texte";
      corrDiv.innerHTML = item.corrige_html;
      detailsCorrige.appendChild(corrDiv);
      li.appendChild(detailsCorrige);

      lierAccordeon(detailsTexte, detailsCorrige);

    } else {
      var details = document.createElement("details");
      var summary = document.createElement("summary");
      summary.textContent = "Voir le texte";
      details.appendChild(summary);
      
      var texteDiv = document.createElement("div");
      texteDiv.className = "texte-extrait";
      texteDiv.innerHTML = item.texte_html;
      ajouterBoutonsExport(item, texteDiv);
      details.appendChild(texteDiv);
      li.appendChild(details);

      if (item.corrige_html && item.corrige_html !== "null") {
        var detailsCorrigeSujet = document.createElement("details");
        var summaryCorrigeSujet = document.createElement("summary");
        summaryCorrigeSujet.textContent = "Voir les éléments de correction";
        detailsCorrigeSujet.appendChild(summaryCorrigeSujet);

        var corrDivSujet = document.createElement("div");
        corrDivSujet.className = "corrige-texte";
        corrDivSujet.innerHTML = item.corrige_html;
        detailsCorrigeSujet.appendChild(corrDivSujet);

        li.appendChild(detailsCorrigeSujet);
        lierAccordeon(details, detailsCorrigeSujet);
      }
    }

    // --- NOUVEAUTÉ : Affichage des thèmes du programme (Cliquables) ---
    if (item.themes && item.themes.length > 0) {
      var tagsP = document.createElement("p");
      tagsP.className = "tags";
      item.themes.forEach(function (t) {
        var span = document.createElement("span");
        span.className = "tag";
        span.textContent = t;
        
        // Rendre visuellement cliquable
        span.style.cursor = "pointer";
        span.title = "Cliquer pour rechercher ce thème";

        // Action au clic : lancer la recherche
        span.addEventListener("click", function(e) {
          e.preventDefault();
          var champ = document.getElementById("recherche");
          // On insère le thème cliqué dans la barre de recherche
          champ.value = t; 
          rafraichir();
          // On remonte la page pour voir les résultats
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        tagsP.appendChild(span);
      });
      li.appendChild(tagsP);
    }

    return li;
  }

  function rafraichir() {
    var texte = normaliser(champRecherche.value.trim());
    var discipline = filtreDiscipline ? filtreDiscipline.value : "";
    var type_question = filtreType ? filtreType.value : "";
    var lieu = filtreLieu ? filtreLieu.value : "";
    
    var anneesCochees = [];
    for (var a = 0; a < checkboxesAnnees.length; a++) {
      if (checkboxesAnnees[a].checked) anneesCochees.push(checkboxesAnnees[a].value);
    }

    var axesCoches = [];
    for (var i = 0; i < checkboxesAxes.length; i++) {
      if (checkboxesAxes[i].checked) axesCoches.push(checkboxesAxes[i].value);
    }

    var filtres = donnees.filter(function (item) {
      return correspond(item, texte, discipline, type_question, lieu, anneesCochees, axesCoches);
    });

    resultats.innerHTML = "";
    if (filtres.length === 0) {
      var vide = document.createElement("p");
      vide.className = "note";
      vide.textContent = "Aucun résultat pour cette recherche.";
      resultats.appendChild(vide);
    } else {
      filtres.forEach(function (item) {
        resultats.appendChild(rendreResultat(item));
      });
    }
    if (compteur) {
      compteur.textContent = filtres.length + " résultat" + (filtres.length > 1 ? "s" : "");
    }
  }

  function peuplerLieux() {
    var lieux = [];
    donnees.forEach(function (item) {
      if (item.lieu && lieux.indexOf(item.lieu) === -1) lieux.push(item.lieu);
    });
    lieux.sort();
    if (filtreLieu) {
      filtreLieu.innerHTML = '<option value="">Tous les centres</option>';
      lieux.forEach(function (lieu) {
        var option = document.createElement("option");
        option.value = lieu;
        option.textContent = lieu;
        filtreLieu.appendChild(option);
      });
    }
  }

  var source = champRecherche.getAttribute("data-source");

  fetch(source)
    .then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then(function (json) {
      donnees = json;
      peuplerLieux();
      rafraichir();
    })
    .catch(function (err) {
      resultats.innerHTML = "<p class=\"note\">Impossible de charger les données (" + err + ").</p>";
    });

  champRecherche.addEventListener("input", rafraichir);
  if (filtreDiscipline) filtreDiscipline.addEventListener("change", rafraichir);
  if (filtreType) filtreType.addEventListener("change", rafraichir);
  if (filtreLieu) filtreLieu.addEventListener("change", rafraichir);

  for (var k = 0; k < checkboxesAnnees.length; k++) {
    checkboxesAnnees[k].addEventListener("change", rafraichir);
  }

  for (var x = 0; x < checkboxesAxes.length; x++) {
    checkboxesAxes[x].addEventListener("change", function () {
      var checkedCount = document.querySelectorAll('input[name="filtre-axe"]:checked').length;
      if (checkedCount > 2) {
        this.checked = false; 
      } else {
        rafraichir(); 
      }
    });
  }

  // ==========================================
  // FONCTIONS D'EXPORT (Word, LaTeX, MD, Copie)
  // ==========================================

  // ==========================================
  // FONCTIONS D'EXPORT (Word, LaTeX, MD, Copie)
  // ==========================================

  function getAuteur(item) {
    if (typeof item.auteur === 'object') {
      return (item.auteur.prenom + " " + item.auteur.nom).trim();
    }
    return item.auteur || "Auteur inconnu";
  }

  function genererEnTete(item) {
    var enTete = "Sujets d'Humanités, Littérature et Philosophie -- " + (item.lieu || "Lieu inconnu") + ", " + (item.annee || "Année inconnue");
    if (item.jour) enTete += ", Jour " + item.jour;
    if (item.id) enTete += " (sujet " + item.id + ")";
    return enTete;
  }

  function genererQuestionsBrutes(itemCourant) {
    var disciplines = { "litt": "littéraire", "phil": "philosophique" };
    var texteQuestions = "";
    var questionsDuSujet = [];
    
    if (typeof donnees !== 'undefined') {
      questionsDuSujet = donnees.filter(function(d) {
        return (itemCourant.id && d.id === itemCourant.id) || 
               (itemCourant.texte_html && d.texte_html === itemCourant.texte_html);
      });
    }

    if (questionsDuSujet.length === 0) questionsDuSujet = [itemCourant];

    var questionsUniques = [];
    var intitulesVus = {};
    questionsDuSujet.forEach(function(q) {
      if (q.intitule && !intitulesVus[q.intitule]) {
        intitulesVus[q.intitule] = true;
        questionsUniques.push(q);
      }
    });

    questionsUniques.sort(function(a, b) {
      var typeA = (a.type_question === "essai") ? 1 : -1;
      var typeB = (b.type_question === "essai") ? 1 : -1;
      return typeA - typeB;
    });

    questionsUniques.forEach(function(q) {
      var type = q.type_question === "interpretation" ? "interprétation" : "essai";
      var disc = disciplines[q.discipline] ? " " + disciplines[q.discipline] : "";
      texteQuestions += "\nQuestion d'" + type + disc + " : " + q.intitule + "\n";
    });
    
    return texteQuestions;
  }

  // --- LE NETTOYEUR UNIVERSEL ---
  function preparerTexte(item, format) {
    var texte = item.texte_html || item.texte || "";

    // 1. Gérer le symbole de retour des notes de Jekyll
    texte = texte.replace(/&#8617;/g, '\n').replace(/↩/g, '\n');

    // 2. Formater les appels de notes de bas de page HTML (ex: transforme en [1])
    texte = texte.replace(/<sup[^>]*><a[^>]*>([^<]+)<\/a><\/sup>/gi, '[$1]');
    
    // 3. Formater les définitions de notes (ex: transforme <li id="fn:1"> en [1]: )
    texte = texte.replace(/<li id="fn:([^"]+)"[^>]*>/gi, '\n\n[$1]: ');

    // 4. Nettoyer les retours à la ligne tout en protégeant les listes et les notes
    texte = texte.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    // On fusionne si la ligne suivante ne commence pas par un crochet [ (note) ou < (balise)
    texte = texte.replace(/([^\n])\n(?=[^\n\[<])/g, "$1 ");
    
    // 5. Remplacer les italiques selon le format voulu
    if (format === 'md') {
        texte = texte.replace(/<i>/gi, '*').replace(/<\/i>/gi, '*');
        texte = texte.replace(/<em>/gi, '*').replace(/<\/em>/gi, '*');
    } else if (format === 'tex') {
        texte = texte.replace(/<i>/gi, '\\textit{').replace(/<\/i>/gi, '}');
        texte = texte.replace(/<em>/gi, '\\textit{').replace(/<\/em>/gi, '}');
        texte = texte.replace(/&/g, '\\&'); // Echappement basique LaTeX
    } else if (format === 'txt') {
        texte = texte.replace(/<\/?(?:i|em)>/gi, '');
    }

    // 6. Retrait de toutes les balises HTML restantes pour tout ce qui n'est pas Word
    if (format !== 'word') {
        texte = texte.replace(/<[^>]*>?/gm, '');
        // On reconvertit les entités HTML classiques pour que ce soit lisible
        texte = texte.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
    }

    // 7. Retrait des espaces multiples
    texte = texte.replace(/[ \t]{2,}/g, " ");

    return texte.trim();
  }

  // --- EXPORT PRESSE-PAPIER ---
  function copierSujet(item) {
    var texteNettoye = preparerTexte(item, 'txt');
    var texteComplet = genererEnTete(item) + "\n" +
                       getAuteur(item) + ", " + (item.titre || "") + "\n\n" +
                       texteNettoye + "\n" +
                       genererQuestionsBrutes(item);
    
    navigator.clipboard.writeText(texteComplet).then(function() {
      alert("Sujet copié dans le presse-papier !");
    }).catch(function(err) { console.error("Erreur copie :", err); });
  }

  // --- EXPORT MARKDOWN ---
  function telechargerMarkdown(item) {
    var texteMd = preparerTexte(item, 'md');
    var mdComplet = genererEnTete(item) + "\n\n" +
                    "**" + getAuteur(item) + "**, *" + (item.titre || "") + "*\n\n" +
                    texteMd + "\n\n" +
                    genererQuestionsBrutes(item);
    
    declencherTelechargement("Sujet_" + (item.id || "HLP") + ".md", mdComplet, 'text/markdown');
  }

  // --- EXPORT LATEX ---
  function telechargerTex(item) {
    var texteTex = preparerTexte(item, 'tex');
    var texComplet = "% " + genererEnTete(item) + "\n\n" +
                     "\\noindent \\textbf{" + getAuteur(item) + "}, \\textit{" + (item.titre || "") + "}\\\\[0.5cm]\n" +
                     texteTex + "\\\\[0.5cm]\n\n" +
                     genererQuestionsBrutes(item);
                     
    declencherTelechargement("Sujet_" + (item.id || "HLP") + ".tex", texComplet, 'text/plain');
  }

  // --- EXPORT WORD (.DOCX) ---
  async function telechargerWord(item) {
    if (typeof docx === 'undefined') {
      alert("L'outil de génération Word n'est pas encore chargé, vérifiez votre connexion.");
      return;
    }
    var Document = docx.Document, Packer = docx.Packer, Paragraph = docx.Paragraph, TextRun = docx.TextRun;

    // On prépare le texte en conservant les balises <i> pour docx
    var texteHtmlPropre = preparerTexte(item, 'word');

    function parserHtmlVersRuns(html) {
      var runs = [];
      var parties = html.split(/(<\/?(?:i|em)>)/i);
      var enItalique = false;

      parties.forEach(function(partie) {
        var p = partie.toLowerCase();
        if (p === '<i>' || p === '<em>') {
          enItalique = true;
        } else if (p === '</i>' || p === '</em>') {
          enItalique = false;
        } else if (partie.length > 0) {
          // On nettoie les autres balises HTML restantes
          var texteNettoye = partie.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
          if (texteNettoye) {
            runs.push(new TextRun({ text: texteNettoye, italics: enItalique }));
          }
        }
      });
      return runs;
    }

    var paragraphesTexte = texteHtmlPropre.split(/\n\s*\n/);
    var enfantsParagraphesTexte = [];
    paragraphesTexte.forEach(function(para) {
      var paraSansSauts = para.replace(/\n/g, ' '); 
      enfantsParagraphesTexte.push(new Paragraph({
        children: parserHtmlVersRuns(paraSansSauts),
        spacing: { before: 120, after: 120 }
      }));
    });

    // Construction du document sans syntaxe ES6 pour éviter les plantages
    var contenuDocument = [
      new Paragraph({ children: [new TextRun(genererEnTete(item))] }),
      new Paragraph({
        children: [
          new TextRun(getAuteur(item) + ", "),
          new TextRun({ text: item.titre || "", italics: true })
        ],
        spacing: { after: 240 }
      })
    ];

    // Concaténation classique
    contenuDocument = contenuDocument.concat(enfantsParagraphesTexte);

    contenuDocument.push(new Paragraph({ 
      text: genererQuestionsBrutes(item),
      spacing: { before: 240 }
    }));

    var doc = new Document({ sections: [{ children: contenuDocument }] });

    var blob = await Packer.toBlob(doc);
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "Sujet_" + (item.id || "HLP") + ".docx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function declencherTelechargement(nomFichier, contenu, typeMime) {
    var blob = new Blob([contenu], { type: typeMime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nomFichier;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function ajouterBoutonsExport(item, conteneurTexteHTML) {
    var barreOutils = document.createElement('div');
    barreOutils.className = 'barre-outils-export';

    var btnCopier = document.createElement('button');
    btnCopier.innerHTML = '📋 Copier';
    btnCopier.onclick = function() { copierSujet(item); };

    var btnWord = document.createElement('button');
    btnWord.innerHTML = '📄 Word';
    btnWord.onclick = function() { telechargerWord(item); };

    var btnMarkdown = document.createElement('button');
    btnMarkdown.innerHTML = '📝 Markdown';
    btnMarkdown.onclick = function() { telechargerMarkdown(item); };

    var btnTex = document.createElement('button');
    btnTex.innerHTML = '📐 LaTeX';
    btnTex.onclick = function() { telechargerTex(item); };

    barreOutils.appendChild(btnCopier);
    barreOutils.appendChild(btnWord);
    barreOutils.appendChild(btnMarkdown);
    barreOutils.appendChild(btnTex);

    conteneurTexteHTML.insertBefore(barreOutils, conteneurTexteHTML.firstChild);
  }
})();