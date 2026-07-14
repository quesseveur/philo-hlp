(function () {
  "use strict";

  function normaliser(s) {
    return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function nomDiscipline(code) {
    if (code === "litt") return "Lettres";
    if (code === "phil") return "Philosophie";
    return code;
  }

  // --- Récupération des éléments du DOM ---
  var champRecherche = document.getElementById("recherche");
  var filtreDiscipline = document.getElementById("filtre-discipline");
  var filtreLieu = document.getElementById("filtre-lieu"); // Nouveau filtre
  var filtreAnnee = document.getElementById("filtre-annee"); // Nouveau filtre
  var checkboxesAxes = document.querySelectorAll('input[name="filtre-axe"]'); // Nouvelles cases à cocher
  var resultats = document.getElementById("resultats");
  var compteur = document.getElementById("compteur");

  if (!champRecherche || !resultats) return;

  var donnees = [];

  function haystack(item) {
    return normaliser([
      item.auteur, item.titre, item.intitule, item.lieu, item.axe,
      (item.themes || []).join(" ")
    ].join(" "));
  }

  // --- Mise à jour de la logique de correspondance ---
  function correspond(item, texte, discipline, lieu, annee, axesCoches) {
    if (discipline && item.discipline !== discipline) return false;
    if (lieu && item.lieu !== lieu) return false;
    
    // Sécurité : conversion en chaîne de caractères au cas où l'année soit un entier dans le JSON
    if (annee && String(item.annee) !== String(annee)) return false; 
    
    // Logique pour les axes multiples (ex: si "EXS" est coché, "EXSMM" passe)
    if (axesCoches && axesCoches.length > 0) {
      var correspondAxe = false;
      for (var i = 0; i < axesCoches.length; i++) {
        if (item.axe && item.axe.indexOf(axesCoches[i]) !== -1) {
          correspondAxe = true;
          break; // Dès qu'un des axes cochés correspond, on valide pour ce filtre
        }
      }
      if (!correspondAxe) return false;
    }

    if (texte && haystack(item).indexOf(texte) === -1) return false;
    
    return true;
  }

  function rendreResultat(item) {
    var li = document.createElement("li");

    var p = document.createElement("p");
    p.className = "intitule";
    var badge = document.createElement("span");
    badge.className = "badge-discipline";
    badge.textContent = nomDiscipline(item.discipline);
    p.appendChild(badge);
    p.appendChild(document.createTextNode(" " + item.intitule));
    li.appendChild(p);

    var meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = item.auteur + ", " + item.titre + " — " + item.lieu + ", " + item.annee + " · axe " + item.axe;
    li.appendChild(meta);

    var details = document.createElement("details");
    var summary = document.createElement("summary");
    summary.textContent = "Voir le texte" + (item.corrige_html ? " et le corrigé" : "");
    details.appendChild(summary);

    if (item.chapeau) {
      var chapeauEl = document.createElement("p");
      chapeauEl.className = "chapeau";
      chapeauEl.textContent = item.chapeau;
      details.appendChild(chapeauEl);
    }

    var texteDiv = document.createElement("div");
    texteDiv.className = "texte-extrait";
    texteDiv.innerHTML = item.texte_html;
    details.appendChild(texteDiv);

    if (item.corrige_html) {
      var h4 = document.createElement("h4");
      h4.textContent = "Corrigé — " + nomDiscipline(item.discipline);
      details.appendChild(h4);
      var corrDiv = document.createElement("div");
      corrDiv.className = "corrige-texte";
      corrDiv.innerHTML = item.corrige_html;
      details.appendChild(corrDiv);
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
    var lieu = filtreLieu ? filtreLieu.value : "";
    var annee = filtreAnnee ? filtreAnnee.value : "";
    
    // Récupérer la valeur des cases à cocher
    var axesCoches = [];
    for (var i = 0; i < checkboxesAxes.length; i++) {
      if (checkboxesAxes[i].checked) {
        axesCoches.push(checkboxesAxes[i].value);
      }
    }

    var filtres = donnees.filter(function (item) {
      return correspond(item, texte, discipline, lieu, annee, axesCoches);
    });

    resultats.innerHTML = "";
    if (filtres.length === 0) {
      var vide = document.createElement("p");
      vide.className = "note";
      vide.textContent = "Aucun résultat.";
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

  // --- Remplissage dynamique des menus déroulants ---
  function peuplerFiltres() {
    var lieux = [];
    var annees = [];

    donnees.forEach(function (item) {
      if (item.lieu && lieux.indexOf(item.lieu) === -1) lieux.push(item.lieu);
      if (item.annee && annees.indexOf(item.annee) === -1) annees.push(item.annee);
    });

    lieux.sort(); // Tri alphabétique pour les lieux
    annees.sort(function(a, b) { return b - a; }); // Tri décroissant pour les années (plus récentes en haut)

    if (filtreLieu) {
      lieux.forEach(function (lieu) {
        var option = document.createElement("option");
        option.value = lieu;
        option.textContent = lieu;
        filtreLieu.appendChild(option);
      });
    }

    if (filtreAnnee) {
      annees.forEach(function (annee) {
        var option = document.createElement("option");
        option.value = annee;
        option.textContent = annee;
        filtreAnnee.appendChild(option);
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
      peuplerFiltres(); // On peuple les nouveaux selects
      rafraichir();
    })
    .catch(function (err) {
      resultats.innerHTML = "<p class=\"note\">Impossible de charger les données de recherche (" + err + ").</p>";
    });

  // --- Ajout des écouteurs d'événements ---
  champRecherche.addEventListener("input", rafraichir);
  if (filtreDiscipline) filtreDiscipline.addEventListener("change", rafraichir);
  if (filtreLieu) filtreLieu.addEventListener("change", rafraichir);
  if (filtreAnnee) filtreAnnee.addEventListener("change", rafraichir);

  // Gestion spécifique de la limite de 2 cases maximum pour les axes
  for (var i = 0; i < checkboxesAxes.length; i++) {
    checkboxesAxes[i].addEventListener("change", function () {
      var checkedCount = 0;
      for (var j = 0; j < checkboxesAxes.length; j++) {
        if (checkboxesAxes[j].checked) {
          checkedCount++;
        }
      }
      
      if (checkedCount > 2) {
        this.checked = false; // On annule l'action si on dépasse 2
      } else {
        rafraichir(); // On ne met à jour l'affichage que si la limite est respectée
      }
    });
  }
})();