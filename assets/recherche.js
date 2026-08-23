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

  // Par défaut, l’export reste lisible. Passer à true pour afficher aussi
  // la référence interne (par ex. « sujet amnord_2022_1_1 ») dans son en-tête.
  var afficherReferenceInterneExport = false;

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
      ajouterBoutonsExportCorrige(item, corrDiv);
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
        ajouterBoutonsExportCorrige(item, corrDivSujet);
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
    var enTete = "Sujets d'Humanités, Littérature et Philosophie -- " +
      (item.lieu || "Lieu inconnu") + ", " + (item.annee || "Année inconnue");
    if (item.jour) enTete += ", Jour " + item.jour;

    if (afficherReferenceInterneExport) {
      var identifiant = item.sujet_id || item.id;
      if (identifiant) enTete += " (sujet " + identifiant + ")";
    }
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
      texteQuestions += "\n\nQuestion d'" + type + disc + " : " + q.intitule;
    });
    
    return texteQuestions;
  }

  // --- CONVERSION HTML STRUCTURÉE (paragraphes, listes et listes imbriquées) ---
  function preparerHtmlSource(item) {
    var html = item.texte_html || item.texte || "";
    html = html.replace(/&#8617;/g, "").replace(/↩/g, "");
    html = html.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    return html;
  }

  function separerNotesDeBasPage(item) {
    var racine = document.createElement("div");
    racine.innerHTML = preparerHtmlSource(item);
    var notes = [];

    // Les appels Jekyll sont habituellement <sup id="fnref:1"><a …>1</a></sup>.
    Array.prototype.forEach.call(racine.querySelectorAll("sup[id^='fnref:'], sup .footnote"), function (appel) {
      var numero = (appel.textContent || "").trim();
      if (numero) appel.replaceWith(document.createTextNode("[" + numero + "]"));
    });

    // Jekyll regroupe les contenus dans .footnotes / role=doc-endnotes ;
    // le sélecteur des li permet aussi les variantes de balisage.
    Array.prototype.forEach.call(racine.querySelectorAll("li[id^='fn:']"), function (note) {
      var identifiant = note.id.slice(3);
      var clone = note.cloneNode(true);
      Array.prototype.forEach.call(clone.querySelectorAll("a[href^='#fnref:'], .reversefootnote"), function (retour) {
        retour.remove();
      });
      notes.push({ numero: identifiant, html: clone.innerHTML });
    });

    Array.prototype.forEach.call(racine.querySelectorAll(".footnotes, [role='doc-endnotes']"), function (conteneur) {
      conteneur.remove();
    });
    // Variante rare : des notes sans conteneur dédié.
    Array.prototype.forEach.call(racine.querySelectorAll("li[id^='fn:']"), function (note) {
      note.remove();
    });

    notes.sort(function (a, b) {
      return String(a.numero).localeCompare(String(b.numero), "fr", { numeric: true });
    });
    return { html: racine.innerHTML, notes: notes };
  }

  function formaterNotes(notes, format) {
    if (!notes.length) return "";
    var titre = format === "md" ? "## Notes" : (format === "tex" ? "\\medskip\n\\noindent \\textbf{Notes}\\par" : "Notes");
    var lignes = notes.map(function (note) {
      var contenu = blocsVersTexte(analyserHtmlPourExport(note.html), format);
      if (format === "tex") return "\\noindent [" + note.numero + "] " + contenu + "\\par";
      return "[" + note.numero + "] " + contenu;
    });
    return "\n\n" + titre + "\n" + lignes.join("\n");
  }

  function analyserHtmlPourExport(html) {
    var racine = document.createElement("div");
    racine.innerHTML = html;
    var blocs = [];

    function ajouterParagraphe(noeud) {
      if ((noeud.textContent || "").trim()) blocs.push({ type: "paragraphe", noeud: noeud });
    }

    function parcourirListe(liste, niveau) {
      var ordonnee = liste.tagName.toLowerCase() === "ol";
      var numero = 0;
      Array.prototype.forEach.call(liste.children, function (enfant) {
        if (enfant.tagName.toLowerCase() !== "li") return;
        numero += 1;
        var contenu = document.createElement("span");
        Array.prototype.forEach.call(enfant.childNodes, function (noeud) {
          var nom = noeud.nodeType === 1 ? noeud.tagName.toLowerCase() : "";
          if (nom !== "ul" && nom !== "ol") contenu.appendChild(noeud.cloneNode(true));
        });
        blocs.push({
          type: "liste",
          noeud: contenu,
          niveau: niveau,
          ordonnee: ordonnee,
          numero: numero
        });
        Array.prototype.forEach.call(enfant.children, function (noeud) {
          var nom = noeud.tagName.toLowerCase();
          if (nom === "ul" || nom === "ol") parcourirListe(noeud, niveau + 1);
        });
      });
    }

    Array.prototype.forEach.call(racine.childNodes, function (noeud) {
      if (noeud.nodeType === 3) {
        if (noeud.nodeValue.trim()) {
          var paragraphe = document.createElement("p");
          paragraphe.textContent = noeud.nodeValue;
          ajouterParagraphe(paragraphe);
        }
        return;
      }
      if (noeud.nodeType !== 1) return;
      var nom = noeud.tagName.toLowerCase();
      if (nom === "ul" || nom === "ol") parcourirListe(noeud, 0);
      else if (nom === "p" || nom === "div" || /^h[1-6]$/.test(nom) || nom === "blockquote") ajouterParagraphe(noeud);
      else ajouterParagraphe(noeud);
    });
    return blocs;
  }

  function echapperLatex(texte) {
    return texte.replace(/([&%_$#{}])/g, "\\$1").replace(/~/g, "\\textasciitilde{}").replace(/\^/g, "\\textasciicircum{}");
  }

  function convertirInline(noeud, format) {
    var sortie = "";
    Array.prototype.forEach.call(noeud.childNodes, function (enfant) {
      if (enfant.nodeType === 3) {
        sortie += format === "tex" ? echapperLatex(enfant.nodeValue) : enfant.nodeValue;
        return;
      }
      if (enfant.nodeType !== 1) return;
      var nom = enfant.tagName.toLowerCase();
      if (nom === "br") {
        sortie += "\n";
        return;
      }
      var contenu = convertirInline(enfant, format);
      if (format === "md" && (nom === "i" || nom === "em")) sortie += "*" + contenu + "*";
      else if (format === "md" && (nom === "strong" || nom === "b")) sortie += "**" + contenu + "**";
      else if (format === "tex" && (nom === "i" || nom === "em")) sortie += "\\textit{" + contenu + "}";
      else if (format === "tex" && (nom === "strong" || nom === "b")) sortie += "\\textbf{" + contenu + "}";
      else sortie += contenu;
    });
    return sortie.replace(/[ \t]+/g, " ").trim();
  }

  function blocsVersTexte(blocs, format) {
    var sortie = [];
    var pileListes = [];
    var precedentEtaitUneListe = false;

    function fermerListes(jusqua) {
      while (pileListes.length > jusqua) {
        sortie.push("\\end{" + pileListes.pop() + "}");
      }
    }

    blocs.forEach(function (bloc) {
      var contenu = convertirInline(bloc.noeud, format);
      if (bloc.type === "paragraphe") {
        if (format === "tex") fermerListes(0);
        if (contenu) sortie.push(contenu);
        precedentEtaitUneListe = false;
        return;
      }

      if (format === "txt") {
        sortie.push(new Array(bloc.niveau + 1).join("  ") + (bloc.ordonnee ? bloc.numero + ". " : "• ") + contenu);
        precedentEtaitUneListe = true;
      } else if (format === "md") {
        sortie.push(new Array(bloc.niveau + 1).join("  ") + (bloc.ordonnee ? bloc.numero + ". " : "- ") + contenu);
        precedentEtaitUneListe = true;
      } else if (format === "tex") {
        var environnement = bloc.ordonnee ? "enumerate" : "itemize";
        precedentEtaitUneListe = true;
        while (pileListes.length > bloc.niveau + 1) fermerListes(bloc.niveau + 1);
        if (pileListes.length === bloc.niveau + 1 && pileListes[bloc.niveau] !== environnement) fermerListes(bloc.niveau);
        while (pileListes.length < bloc.niveau + 1) {
          pileListes.push(environnement);
          sortie.push("\\begin{" + environnement + "}");
        }
        sortie.push("\\item " + contenu);
      }
    });

    if (format === "tex") fermerListes(0);

    if (format === "txt" || format === "md") {
      var resultat = "";
      blocs.forEach(function (bloc, index) {
        var contenu = convertirInline(bloc.noeud, format);
        var ligne = bloc.type === "liste"
          ? new Array(bloc.niveau + 1).join("  ") + (bloc.ordonnee ? bloc.numero + ". " : (format === "md" ? "- " : "• ")) + contenu
          : contenu;
        if (!ligne) return;
        if (resultat) {
          var precedent = blocs[index - 1];
          resultat += precedent && precedent.type === "liste" && bloc.type === "liste" ? "\n" : "\n\n";
        }
        resultat += ligne;
      });
      return resultat.replace(/\n{3,}/g, "\n\n").trim();
    }

    return sortie.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function preparerTexte(item, format) {
    var source = separerNotesDeBasPage(item);
    if (format === "word") return source.html;
    var corps = blocsVersTexte(analyserHtmlPourExport(source.html), format);
    return (corps + formaterNotes(source.notes, format)).trim();
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
  function creerRunsWord(noeud, TextRun, styles) {
    var runs = [];
    styles = styles || { italics: false, bold: false };

    Array.prototype.forEach.call(noeud.childNodes, function (enfant) {
      if (enfant.nodeType === 3) {
        var texte = enfant.nodeValue.replace(/\s+/g, " ");
        if (texte) runs.push(new TextRun({ text: texte, italics: styles.italics, bold: styles.bold }));
        return;
      }
      if (enfant.nodeType !== 1) return;
      var nom = enfant.tagName.toLowerCase();
      if (nom === "br") {
        runs.push(new TextRun({ break: 1 }));
        return;
      }
      creerRunsWord(enfant, TextRun, {
        italics: styles.italics || nom === "i" || nom === "em",
        bold: styles.bold || nom === "strong" || nom === "b"
      }).forEach(function (run) { runs.push(run); });
    });
    return runs;
  }

  function creerParagraphesWordDepuisHtml(html, Paragraph, TextRun) {
    var blocs = analyserHtmlPourExport(html);
    return blocs.map(function (bloc) {
      var options = {
        children: creerRunsWord(bloc.noeud, TextRun),
        spacing: { before: 100, after: 100 }
      };
      if (bloc.type === "liste") {
        var marqueur = bloc.ordonnee ? bloc.numero + ". " : "• ";
        options.children.unshift(new TextRun({ text: marqueur }));
        options.indent = { left: 360 * (bloc.niveau + 1), hanging: 180 };
        options.spacing = { before: 40, after: 40 };
      }
      return new Paragraph(options);
    });
  }

  function creerParagraphesNotesWord(notes, Paragraph, TextRun) {
    if (!notes.length) return [];
    var resultat = [
      new Paragraph({ children: [new TextRun({ text: "Notes", bold: true })], spacing: { before: 240, after: 100 } })
    ];

    notes.forEach(function (note) {
      var blocs = analyserHtmlPourExport(note.html);
      blocs.forEach(function (bloc, index) {
        var options = {
          children: creerRunsWord(bloc.noeud, TextRun),
          spacing: { before: 50, after: 50 }
        };
        if (index === 0) options.children.unshift(new TextRun({ text: "[" + note.numero + "] ", bold: true }));
        if (bloc.type === "liste") {
          options.children.unshift(new TextRun({ text: bloc.ordonnee ? bloc.numero + ". " : "• " }));
          options.indent = { left: 360 * (bloc.niveau + 1), hanging: 180 };
        }
        resultat.push(new Paragraph(options));
      });
    });
    return resultat;
  }

  async function telechargerWord(item) {
    if (typeof docx === "undefined") {
      alert("L'outil de génération Word n'est pas encore chargé, vérifiez votre connexion.");
      return;
    }
    var Document = docx.Document, Packer = docx.Packer, Paragraph = docx.Paragraph, TextRun = docx.TextRun;
    var source = separerNotesDeBasPage(item);
    var contenuDocument = [
      new Paragraph({ children: [new TextRun(genererEnTete(item))] }),
      new Paragraph({
        children: [
          new TextRun(getAuteur(item) + ", "),
          new TextRun({ text: item.titre || "", italics: true })
        ],
        spacing: { after: 240 }
      })
    ].concat(creerParagraphesWordDepuisHtml(source.html, Paragraph, TextRun));

    contenuDocument = contenuDocument.concat(creerParagraphesNotesWord(source.notes, Paragraph, TextRun));
  genererQuestionsBrutes(item)
  .trim()
  .split(/\n\s*\n/)
  .filter(function (question) { return question.trim(); })
  .forEach(function (question) {
    contenuDocument.push(new Paragraph({
      text: question.trim(),
      spacing: { before: 160, after: 160 }
    }));
  });

    var doc = new Document({ sections: [{ children: contenuDocument }] });
    var blob = await Packer.toBlob(doc);
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "Sujet_" + getIdentifiantSujet(item) + ".docx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // --- EXPORT DES ÉLÉMENTS DE CORRECTION ---
  function getIdentifiantSujet(item) {
    return item.sujet_id || item.id || "HLP";
  }

  function genererLibelleQuestion(item) {
    var disciplines = { "litt": "littéraire", "phil": "philosophique" };
    var type = item.type_question === "interpretation" ? "interprétation" : "essai";
    var discipline = disciplines[item.discipline] ? " " + disciplines[item.discipline] : "";
    return "Question d'" + type + discipline + " : " + (item.intitule || "");
  }

  function preparerCorrige(item, format) {
    return preparerTexte({ texte_html: item.corrige_html || "" }, format);
  }

  function getReferencesCulturelles(item) {
    if (!item.references_culturelles || item.references_culturelles === "null") return [];
    return (Array.isArray(item.references_culturelles)
      ? item.references_culturelles
      : [item.references_culturelles])
      .map(function (reference) {
        var div = document.createElement("div");
        div.innerHTML = String(reference);
        return (div.textContent || div.innerText || "").trim();
      })
      .filter(function (reference) { return reference.length > 0; });
  }

  function formaterReferencesCorrige(item, format) {
    var references = getReferencesCulturelles(item);
    if (references.length === 0) return "";

    if (format === "md") {
      return "\n\n## Références culturelles citées\n" + references.map(function (reference) {
        return "- " + reference;
      }).join("\n");
    }

    if (format === "tex") {
      return "\n\n\\medskip\n\\noindent \\textbf{Références culturelles citées}\\par\n" + references.map(function (reference) {
        return "- " + reference.replace(/([&%_$#{}])/g, "\\\\$1");
      }).join("\n");
    }

    return "\n\nRéférences culturelles citées :\n" + references.map(function (reference) {
      return "- " + reference;
    }).join("\n");
  }

  function genererEnteteCorrige(item) {
    return genererEnTete(item) + " — Éléments de correction";
  }

  function copierCorrige(item) {
    var contenu = genererEnteteCorrige(item) + "\n" +
      getAuteur(item) + ", " + (item.titre || "") + "\n\n" +
      genererLibelleQuestion(item) + "\n\n" +
      "ÉLÉMENTS DE CORRECTION\n\n" + preparerCorrige(item, "txt") +
      formaterReferencesCorrige(item, "txt");

    navigator.clipboard.writeText(contenu).then(function () {
      alert("Éléments de correction copiés dans le presse-papier !");
    }).catch(function (err) { console.error("Erreur copie :", err); });
  }

  function telechargerMarkdownCorrige(item) {
    var contenu = "# Éléments de correction\n\n" +
      genererEnteteCorrige(item) + "\n\n" +
      "**" + getAuteur(item) + "**, *" + (item.titre || "") + "*\n\n" +
      "## " + genererLibelleQuestion(item) + "\n\n" +
      preparerCorrige(item, "md") + formaterReferencesCorrige(item, "md");
    declencherTelechargement("Correction_" + getIdentifiantSujet(item) + ".md", contenu, "text/markdown");
  }

  function telechargerTexCorrige(item) {
    var contenu = "% " + genererEnteteCorrige(item) + "\n\n" +
      "\\noindent \\textbf{Éléments de correction}\\\\[0.25cm]\n" +
      "\\noindent " + genererLibelleQuestion(item).replace(/([&%_$#{}])/g, "\\\\$1") + "\\\\[0.5cm]\n" +
      preparerCorrige(item, "tex") + formaterReferencesCorrige(item, "tex");
    declencherTelechargement("Correction_" + getIdentifiantSujet(item) + ".tex", contenu, "text/plain");
  }

  async function telechargerWordCorrige(item) {
    if (typeof docx === "undefined") {
      alert("L'outil de génération Word n'est pas encore chargé, vérifiez votre connexion.");
      return;
    }

    var Document = docx.Document, Packer = docx.Packer, Paragraph = docx.Paragraph, TextRun = docx.TextRun;
    var source = separerNotesDeBasPage({ texte_html: item.corrige_html || "" });
    var contenuDocument = [
      new Paragraph({ children: [new TextRun({ text: "Éléments de correction", bold: true })] }),
      new Paragraph({ text: genererEnTete(item), spacing: { after: 120 } }),
      new Paragraph({ text: genererLibelleQuestion(item), spacing: { after: 240 } })
    ].concat(creerParagraphesWordDepuisHtml(source.html, Paragraph, TextRun));
    contenuDocument = contenuDocument.concat(creerParagraphesNotesWord(source.notes, Paragraph, TextRun));

    var references = getReferencesCulturelles(item);
    if (references.length > 0) {
      contenuDocument.push(new Paragraph({ text: "Références culturelles citées", spacing: { before: 240, after: 80 } }));
      references.forEach(function (reference) {
        contenuDocument.push(new Paragraph({ text: "• " + reference, spacing: { after: 60 } }));
      });
    }

    var documentWord = new Document({ sections: [{ children: contenuDocument }] });
    var blob = await Packer.toBlob(documentWord);
    var url = URL.createObjectURL(blob);
    var lien = document.createElement("a");
    lien.href = url;
    lien.download = "Correction_" + getIdentifiantSujet(item) + ".docx";
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
    URL.revokeObjectURL(url);
  }

  function ajouterBoutonsExportCorrige(item, conteneurCorrectionHTML) {
    var barreOutils = document.createElement("div");
    barreOutils.className = "barre-outils-export barre-outils-corrige";

    var btnCopier = document.createElement("button");
    btnCopier.type = "button";
    btnCopier.textContent = "📋 Copier";
    btnCopier.onclick = function () { copierCorrige(item); };

    var btnWord = document.createElement("button");
    btnWord.type = "button";
    btnWord.textContent = "📄 Word";
    btnWord.onclick = function () { telechargerWordCorrige(item); };

    var btnMarkdown = document.createElement("button");
    btnMarkdown.type = "button";
    btnMarkdown.textContent = "📝 Markdown";
    btnMarkdown.onclick = function () { telechargerMarkdownCorrige(item); };

    var btnTex = document.createElement("button");
    btnTex.type = "button";
    btnTex.textContent = "📐 LaTeX";
    btnTex.onclick = function () { telechargerTexCorrige(item); };

    barreOutils.appendChild(btnCopier);
    barreOutils.appendChild(btnWord);
    barreOutils.appendChild(btnMarkdown);
    barreOutils.appendChild(btnTex);
    conteneurCorrectionHTML.insertBefore(barreOutils, conteneurCorrectionHTML.firstChild);
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