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

  var champRecherche = document.getElementById("recherche");
  var filtreDiscipline = document.getElementById("filtre-discipline");
  var filtreAxe = document.getElementById("filtre-axe");
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

  function correspond(item, texte, discipline, axe) {
    if (discipline && item.discipline !== discipline) return false;
    if (axe && item.axe !== axe) return false;
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
    var axe = filtreAxe ? filtreAxe.value : "";

    var filtres = donnees.filter(function (item) {
      return correspond(item, texte, discipline, axe);
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

  function peuplerAxes() {
    if (!filtreAxe) return;
    var axes = [];
    donnees.forEach(function (item) {
      if (item.axe && axes.indexOf(item.axe) === -1) axes.push(item.axe);
    });
    axes.sort();
    axes.forEach(function (axe) {
      var option = document.createElement("option");
      option.value = axe;
      option.textContent = axe;
      filtreAxe.appendChild(option);
    });
  }

  var source = champRecherche.getAttribute("data-source");

  fetch(source)
    .then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then(function (json) {
      donnees = json;
      peuplerAxes();
      rafraichir();
    })
    .catch(function (err) {
      resultats.innerHTML = "<p class=\"note\">Impossible de charger les données de recherche (" + err + ").</p>";
    });

  champRecherche.addEventListener("input", rafraichir);
  if (filtreDiscipline) filtreDiscipline.addEventListener("change", rafraichir);
  if (filtreAxe) filtreAxe.addEventListener("change", rafraichir);
})();
