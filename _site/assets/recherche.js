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

  // On liste les axes connus pour la logique "Autres"
  var axesConnus = [];
  for (var i = 0; i < checkboxesAxes.length; i++) {
    if (checkboxesAxes[i].value !== "Autres") axesConnus.push(checkboxesAxes[i].value);
  }

  function haystack(item) {
    return normaliser([
      item.auteur, item.titre, item.intitule, item.lieu, item.axe,
      (item.themes || []).join(" ")
    ].join(" "));
  }

  function correspond(item, texte, discipline, type_question, lieu, anneesCochees, axesCoches) {
    // 1. Filtre du mode (si on est sur la page corrigés, on masque ce qui n'a pas de corrigé)
    if (mode === "corriges" && (!item.corrige_html || item.corrige_html === "null")) return false;

    // 2. Filtres standards
    if (discipline && item.discipline !== discipline) return false;
    if (type_question && item.type_question !== type_question) return false;
    if (lieu && item.lieu !== lieu) return false;
    
    // 3. Filtre Années (Multiples)
    if (anneesCochees && anneesCochees.length > 0) {
      if (anneesCochees.indexOf(String(item.annee)) === -1) return false;
    }

    // 4. Filtre Axes (Croisés et limités à 2 + Logique "Autres")
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

    // 5. Filtre Texte
    if (texte && haystack(item).indexOf(texte) === -1) return false;
    
    return true;
  }

  function rendreResultat(item) {
    var li = document.createElement("li");

    // --- Génération du badge (Ex: INTERPRÉTATION LITTÉRAIRE) ---
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

    // --- Méta-données ---
    var meta = document.createElement("p");
    meta.className = "meta";
    meta.innerHTML = item.auteur + ", <em>" + item.titre + "</em> — " + item.lieu + ", " + item.annee + " · axe " + item.axe;
    li.appendChild(meta);

    // --- Détails (Sujet ou Corrigé selon le mode) ---
    var details = document.createElement("details");
    var summary = document.createElement("summary");
    summary.textContent = mode === "corriges" ? "Voir le corrigé" : "Voir le texte";
    details.appendChild(summary);

    if (item.chapeau) {
      var chapeauEl = document.createElement("p");
      chapeauEl.className = "chapeau";
      chapeauEl.textContent = item.chapeau;
      details.appendChild(chapeauEl);
    }

    if (mode === "corriges") {
      var corrDiv = document.createElement("div");
      corrDiv.className = "corrige-texte";
      corrDiv.innerHTML = item.corrige_html;
      details.appendChild(corrDiv);
    } else {
      var texteDiv = document.createElement("div");
      texteDiv.className = "texte-extrait";
      texteDiv.innerHTML = item.texte_html;
      details.appendChild(texteDiv);
      
      // Afficher le corrigé à la suite si disponible en mode "sujet"
      if (item.corrige_html && item.corrige_html !== "null") {
        var h4 = document.createElement("h4");
        h4.textContent = "Proposition de corrigé";
        details.appendChild(h4);
        var corrDivSujet = document.createElement("div");
        corrDivSujet.className = "corrige-texte";
        corrDivSujet.innerHTML = item.corrige_html;
        details.appendChild(corrDivSujet);
      }
    }

    if (item.themes && item.themes.length > 0) {
      var tagsP = document.createElement("p");
      tagsP.className = "tags";
      item.themes.forEach(function (t) {
        var span = document.createElement("span");
        span.className = "tag";
        span.textContent = t;
        tagsP.appendChild(span);
      });
      details.appendChild(tagsP);
    }

    li.appendChild(details);
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

  // Limite de 2 cases maximum pour les thèmes
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