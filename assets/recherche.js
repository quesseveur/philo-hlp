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

  var mode = champRecherche.getAttribute("data-mode") || "sujets"; // "sujets" ou "corriges"
  var donnees = [];

  // On dresse la liste des axes prévus pour la logique "Autres"
  var axesConnus = [];
  for (var i = 0; i < checkboxesAxes.length; i++) {
    if (checkboxesAxes[i].value !== "Autres") axesConnus.push(checkboxesAxes[i].value);
  }

  // --- CORRECTION : Indexation des références culturelles pour la recherche ---
  function haystack(item) {
  var refsCulturellesStr = "";
  // Les références culturelles ne sont indexées pour la recherche que sur la page des corrigés
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

    // NOUVEAU : On supprime toutes les balises HTML (ex: <i>, <b>) pour que la recherche 
    // trouve une correspondance parfaite même si la barre de recherche contient du texte brut.
    var texteSansHtml = texteBrut.replace(/<[^>]*>?/gm, '');

    return normaliser(texteSansHtml);
  }

  function correspond(item, texte, discipline, type_question, lieu, anneesCochees, axesCoches) {
    // 1. Filtre du mode
    if (mode === "corriges" && (!item.corrige_html || item.corrige_html === "null")) return false;

    // 2. Filtres standards
    if (discipline && item.discipline !== discipline) return false;
    if (type_question && item.type_question !== type_question) return false;
    if (lieu && item.lieu !== lieu) return false;
    
    // 3. Filtre Années
    if (anneesCochees && anneesCochees.length > 0) {
      if (anneesCochees.indexOf(String(item.annee)) === -1) return false;
    }

    // 4. Filtre Axes
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

    // 5. NOUVELLE LOGIQUE : Recherche multi-mots-clés
    // 5. NOUVELLE LOGIQUE : Recherche multi-mots-clés
    if (texte) {
      // On découpe la recherche par virgules et/ou espaces, et on nettoie les termes vides
      var termesRecherche = texte.split(/[,\s]+/).filter(function(t) { return t.length > 0; });
      var contenuSujet = haystack(item);
      // On vérifie que TOUS les mots tapés sont présents quelque part dans le sujet
      var tousLesTermesSontPresents = termesRecherche.every(function(term) {
      return contenuSujet.indexOf(term) !== -1;
      });
      if (!tousLesTermesSontPresents) return false;
    }
    
    return true;
  }

  // Lie deux éléments <details> en accordéon : ouvrir l'un referme l'autre.
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

    // --- Génération du badge et de l'intitulé ---
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

    // --- Méta-données (Axes) ---
    var meta = document.createElement("p");
    meta.className = "meta";
    meta.innerHTML = item.auteur + ", <em>" + item.titre + "</em> — " + item.lieu + ", " + item.annee + " · axe " + item.axe;
    if (item.a_un_corrige) {
      meta.innerHTML += " · <strong>Éléments d'évaluations disponibles</strong>";
    }
    li.appendChild(meta);

    // --- MODE CORRIGÉS : Deux blocs séparés ---
    if (mode === "corriges") {
      // 1. Voir le texte
      var detailsTexte = document.createElement("details");
      var summaryTexte = document.createElement("summary");
      summaryTexte.textContent = "Voir le texte";
      detailsTexte.appendChild(summaryTexte);
      
      var texteDiv = document.createElement("div");
      texteDiv.className = "texte-extrait";
      texteDiv.innerHTML = item.texte_html;
      detailsTexte.appendChild(texteDiv);
      li.appendChild(detailsTexte);

      // 2. Voir les éléments de correction
      var detailsCorrige = document.createElement("details");
      var summaryCorrige = document.createElement("summary");
      summaryCorrige.textContent = "Voir les éléments de correction";
      detailsCorrige.appendChild(summaryCorrige);
      
      var corrDiv = document.createElement("div");
      corrDiv.className = "corrige-texte";
      corrDiv.innerHTML = item.corrige_html;
      detailsCorrige.appendChild(corrDiv);

      // Gestion des références culturelles AVEC compteur (+X autres)
      if (item.references_culturelles && item.references_culturelles !== "null") {
        var refsList = Array.isArray(item.references_culturelles) ? item.references_culturelles : [item.references_culturelles];
        if (refsList.length > 0) {
          var refsP = document.createElement("p");
          refsP.className = "tags";
          refsP.style.marginTop = "15px";
          
          var limite = 5;
          refsList.forEach(function(ref, index) {
            var span = document.createElement("span");
            span.className = "tag";
            span.style.backgroundColor = "#f0f4f8";
            span.style.color = "#2c3e50";
            span.style.border = "1px solid #cbd5e1";
            span.style.cursor = "pointer";
            span.innerHTML = "📖 " + ref;
            if (index >= limite) { span.style.display = "none"; span.classList.add("ref-cachee"); }
            
            span.addEventListener("click", function() {
               var champ = document.getElementById("recherche");
               champ.value = ref.replace(/<[^>]*>/g, ''); // Texte pur
               rafraichir();
            });
            refsP.appendChild(span);
          });

          if (refsList.length > limite) {
            var btnPlus = document.createElement("span");
            btnPlus.className = "tag";
            btnPlus.style.cursor = "pointer";
            btnPlus.style.backgroundColor = "#e2e8f0";
            btnPlus.textContent = "+ " + (refsList.length - limite) + " autres...";
            btnPlus.addEventListener("click", function() {
              refsP.querySelectorAll(".ref-cachee").forEach(function(el) { el.style.display = "inline-block"; });
              btnPlus.style.display = "none";
            });
            refsP.appendChild(btnPlus);
          }
          detailsCorrige.appendChild(refsP);
        }
      }
      li.appendChild(detailsCorrige);

      // Accordéon : un seul bloc ouvert à la fois
      lierAccordeon(detailsTexte, detailsCorrige);

    } else {
      // MODE SUJETS (Comportement inchangé)
      var details = document.createElement("details");
      var summary = document.createElement("summary");
      summary.textContent = "Voir le texte";
      details.appendChild(summary);
      
      var texteDiv = document.createElement("div");
      texteDiv.className = "texte-extrait";
      texteDiv.innerHTML = item.texte_html;
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

        // Accordéon : un seul bloc ouvert à la fois
        lierAccordeon(details, detailsCorrigeSujet);
      }
    }

    // Affichage des thèmes du programme (commun aux deux modes)
    if (item.themes && item.themes.length > 0) {
      var tagsP = document.createElement("p");
      tagsP.className = "tags";
      item.themes.forEach(function (t) {
        var span = document.createElement("span");
        span.className = "tag";
        span.textContent = t;
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

  // --- Écouteurs d'événements ---
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
})();