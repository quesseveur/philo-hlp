'use strict';

/*
 * Index thématique détaillé : deux chapitres ouverts au maximum.
 * Les mots-clés communs à deux chapitres ouverts sont distingués.
 * Le repli est différé le temps d'une animation CSS, sans modifier
 * la sémantique native de <details> et <summary>.
 */
(function () {
  const chapitres = [...document.querySelectorAll('[data-index-chapitre]')];
  const ordreOuverture = [];
  const DUREE_REPLI = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 260;

  function retirerDeLOpening(chapitre) {
    const index = ordreOuverture.indexOf(chapitre);
    if (index !== -1) ordreOuverture.splice(index, 1);
  }

  function normaliserMot(texte) {
    return String(texte || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('fr')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function mettreEnValeurMotsCommuns() {
    const chapitresOuverts = chapitres.filter((chapitre) => chapitre.open);
    document.querySelectorAll('.index-tags a').forEach((lien) => {
      lien.classList.remove('index-tag-partage');
      lien.removeAttribute('title');
    });

    if (chapitresOuverts.length !== 2) return;

    const motsPremier = new Set(
      [...chapitresOuverts[0].querySelectorAll('.index-tags a')]
        .map((lien) => normaliserMot(lien.textContent))
    );
    const motsSecond = new Set(
      [...chapitresOuverts[1].querySelectorAll('.index-tags a')]
        .map((lien) => normaliserMot(lien.textContent))
    );
    const motsCommuns = new Set([...motsPremier].filter((mot) => motsSecond.has(mot)));

    chapitresOuverts.forEach((chapitre) => {
      chapitre.querySelectorAll('.index-tags a').forEach((lien) => {
        if (motsCommuns.has(normaliserMot(lien.textContent))) {
          lien.classList.add('index-tag-partage');
          lien.title = `${lien.textContent.trim()} — mot-clé commun aux deux chapitres ouverts ; cliquer pour rechercher`;
        }
      });
    });
  }

  function fermerAvecAnimation(chapitre, apresRepli) {
    if (!chapitre.open || chapitre.dataset.fermetureEnCours === 'true') return;
    chapitre.dataset.fermetureEnCours = 'true';
    chapitre.classList.add('est-en-fermeture');

    window.setTimeout(() => {
      chapitre.open = false;
      chapitre.classList.remove('est-en-fermeture');
      delete chapitre.dataset.fermetureEnCours;
      if (typeof apresRepli === 'function') apresRepli();
    }, DUREE_REPLI);
  }

  chapitres.forEach((chapitre) => {
    chapitre.addEventListener('toggle', () => {
      if (!chapitre.open) {
        retirerDeLOpening(chapitre);
        mettreEnValeurMotsCommuns();
        return;
      }

      retirerDeLOpening(chapitre);
      ordreOuverture.push(chapitre);

      if (ordreOuverture.length > 2) {
        const plusAncien = ordreOuverture.shift();
        fermerAvecAnimation(plusAncien, mettreEnValeurMotsCommuns);
      }

      window.requestAnimationFrame(mettreEnValeurMotsCommuns);
    });

    chapitre.querySelector('summary')?.addEventListener('click', (event) => {
      if (!chapitre.open || chapitre.dataset.fermetureEnCours === 'true') return;
      event.preventDefault();
      fermerAvecAnimation(chapitre);
    });
  });
}());
