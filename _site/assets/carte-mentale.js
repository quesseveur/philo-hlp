'use strict';

/*
 * Carte thématique HLP — version à branche unique.
 * Les occurrences sont comptées une seule fois par sujet et par axe.
 */

const AXES_CARTE = [
  { code: 'ETA', nom: 'Éducation, transmission et émancipation', semestre: 1, direction: 'haut' },
  { code: 'EXS', nom: 'Les expressions de la sensibilité', semestre: 1, direction: 'haut' },
  { code: 'MM', nom: 'Les métamorphoses du moi', semestre: 1, direction: 'haut' },
  { code: 'CC', nom: 'Création, continuités et ruptures', semestre: 2, direction: 'bas' },
  { code: 'HV', nom: 'Histoire et violence', semestre: 2, direction: 'bas' },
  { code: 'HL', nom: 'L’humain et ses limites', semestre: 2, direction: 'bas' }
];

const SEUIL_PAR_DEFAUT = 3;
let indexParAxe = new Map();
let rattachementsParMot = new Map();
let seuilActif = SEUIL_PAR_DEFAUT;
let axeActif = null;
let transitionDeNuageEnCours = false;

function normaliserMot(texte) {
  return String(texte || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('fr');
}

function axesDuCode(code) {
  const codeNormalise = String(code || '').toUpperCase();
  return AXES_CARTE.map((axe) => axe.code).filter((codeAxe) => codeNormalise.includes(codeAxe));
}

function construireIndex(donneesBrutes) {
  const sujets = new Map();

  donneesBrutes.forEach((entree) => {
    if (!entree || !entree.sujet_id) return;
    if (!sujets.has(entree.sujet_id)) sujets.set(entree.sujet_id, { axes: new Set(), mots: new Map() });

    const sujet = sujets.get(entree.sujet_id);
    axesDuCode(entree.axe).forEach((axe) => sujet.axes.add(axe));
    (Array.isArray(entree.themes) ? entree.themes : []).forEach((mot) => {
      const cle = normaliserMot(mot);
      if (cle && !sujet.mots.has(cle)) sujet.mots.set(cle, String(mot).trim());
    });
  });

  indexParAxe = new Map(AXES_CARTE.map((axe) => [axe.code, new Map()]));
  sujets.forEach((sujet) => {
    sujet.axes.forEach((axe) => {
      sujet.mots.forEach((libelle, cle) => {
        const indexAxe = indexParAxe.get(axe);
        const precedent = indexAxe.get(cle) || { libelle, occurrences: 0 };
        precedent.occurrences += 1;
        indexAxe.set(cle, precedent);
      });
    });
  });
}

function motsPourAxe(code, seuil) {
  return [...(indexParAxe.get(code) || new Map()).entries()]
    .map(([cle, details]) => ({ cle, ...details }))
    .filter((mot) => mot.occurrences >= seuil)
    .sort((a, b) => b.occurrences - a.occurrences || a.libelle.localeCompare(b.libelle, 'fr'));
}

function construireRattachements(seuil) {
  rattachementsParMot = new Map();
  AXES_CARTE.forEach((axe) => {
    motsPourAxe(axe.code, seuil).forEach((mot) => {
      if (!rattachementsParMot.has(mot.cle)) rattachementsParMot.set(mot.cle, []);
      rattachementsParMot.get(mot.cle).push(axe.code);
    });
  });
}

function creerLienRecherche(mot) {
  const lien = document.createElement('a');
  lien.className = 'carte-mentale__mot';
  lien.href = `${urlRechercheCarte}?q=${encodeURIComponent(mot.libelle)}`;
  lien.dataset.mot = mot.cle;
  lien.title = `Rechercher « ${mot.libelle} » parmi les sujets`;

  const texte = document.createElement('span');
  texte.textContent = mot.libelle;
  const nombre = document.createElement('small');
  nombre.textContent = String(mot.occurrences);
  nombre.setAttribute('aria-label', `${mot.occurrences} sujet${mot.occurrences > 1 ? 's' : ''} indexé${mot.occurrences > 1 ? 's' : ''}`);
  lien.append(texte, nombre);

const autresChapitres = (rattachementsParMot.get(mot.cle) || [])
  .filter((code) => code !== axeActif)
  .map((code) => AXES_CARTE.find((axe) => axe.code === code).nom);

if (autresChapitres.length) {
  lien.classList.add('est-partage');
  lien.title = `Rechercher « ${mot.libelle} » — également rattaché à : ${autresChapitres.join(', ')}`;

  const marqueur = document.createElement('span');
  marqueur.className = 'carte-mentale__marqueur-partage';
  marqueur.setAttribute('aria-hidden', 'true');
  marqueur.textContent = '↔';
  lien.appendChild(marqueur);
}
  return lien;
}

function creerNuage(axe) {
  const nuage = document.createElement('section');
  nuage.className = `carte-mentale__nuage carte-mentale__nuage--${axe.direction}`;
  nuage.id = `nuage-${axe.code}`;
  nuage.dataset.nuageAxe = axe.code;
  nuage.setAttribute('aria-label', `Mots-clés : ${axe.nom}`);

  const fil = document.createElement('span');
  fil.className = 'carte-mentale__fil-plein';
  fil.setAttribute('aria-hidden', 'true');
  const entete = document.createElement('p');
  entete.className = 'carte-mentale__compte-mots';
  const mots = motsPourAxe(axe.code, seuilActif);
  entete.textContent = `${axe.nom} — ${mots.length} mot${mots.length > 1 ? 's' : ''} indexé${mots.length > 1 ? 's' : ''} au moins ${seuilActif} fois`;

  const liste = document.createElement('div');
  liste.className = 'carte-mentale__mots';
  mots.forEach((mot) => liste.appendChild(creerLienRecherche(mot)));
  nuage.append(fil, entete, liste);
  return nuage;
}

function creerChapitre(axe) {
  const bouton = document.createElement('button');
  const actif = axeActif === axe.code;
  bouton.className = `carte-mentale__noeud${actif ? ' est-actif' : ''}`;
  bouton.type = 'button';
  bouton.dataset.axeCard = axe.code;
  bouton.setAttribute('aria-expanded', String(actif));
  bouton.setAttribute('aria-controls', `nuage-${axe.code}`);
  bouton.innerHTML = `<span class="carte-mentale__sigle">${axe.code}</span><span class="carte-mentale__nom">${axe.nom}</span><span class="carte-mentale__action">${actif ? 'Réduire' : 'Déployer'}</span>`;
  bouton.addEventListener('click', () => basculerChapitre(axe.code));
  return bouton;
}

function ordreDesChapitres(semestre) {
  const chapitres = AXES_CARTE.filter((axe) => axe.semestre === semestre);
  const actif = chapitres.find((axe) => axe.code === axeActif);
  if (!actif) return chapitres;
  const autres = chapitres.filter((axe) => axe.code !== axeActif);
  return [autres[0], actif, autres[1]];
}

function creerLigneChapitres(semestre) {
  const ligne = document.createElement('div');
  ligne.className = 'carte-mentale__ligne-chapitres';
  ordreDesChapitres(semestre).forEach((axe) => ligne.appendChild(creerChapitre(axe)));
  return ligne;
}

function creerRepereSemestre(numero, texte) {
  const repere = document.createElement('p');
  repere.className = 'carte-mentale__repere-semestre';
  repere.textContent = `Semestre ${numero} — ${texte}`;
  return repere;
}

function rendreCarte(afficherNuage = true) {
  const semestre1 = document.getElementById('carte-semestre-1');
  const semestre2 = document.getElementById('carte-semestre-2');
  if (!semestre1 || !semestre2) return;

  construireRattachements(seuilActif);
  const axeOuvert = AXES_CARTE.find((axe) => axe.code === axeActif);

  const contenuSemestre1 = [
  creerRepereSemestre(1, 'La Recherche de soi'),
  creerLigneChapitres(1)
];

if (afficherNuage && axeOuvert && axeOuvert.semestre === 1) {
  contenuSemestre1.push(creerNuage(axeOuvert));
}

  const contenuSemestre2 = [creerRepereSemestre(2, 'L’humanité en question'), creerLigneChapitres(2)];
  if (afficherNuage && axeOuvert && axeOuvert.semestre === 2) {
  contenuSemestre2.push(creerNuage(axeOuvert));
}

  semestre1.replaceChildren(...contenuSemestre1);
  semestre2.replaceChildren(...contenuSemestre2);

  const totalMots = AXES_CARTE.reduce((total, axe) => total + motsPourAxe(axe.code, seuilActif).length, 0);
  const motsPartages = [...rattachementsParMot.values()].filter((rattachements) => rattachements.length > 1).length;
  const etat = document.getElementById('etat-carte-mentale');
  if (etat) etat.textContent = `${totalMots} mots-clés affichables au seuil de ${seuilActif} occurrences, dont ${motsPartages} partagés entre au moins deux chapitres.`;
  effacerLiensCroises();
}

function recentrerApresInteraction() {
  window.requestAnimationFrame(() => {
    const chapitreActif = AXES_CARTE.find((axe) => axe.code === axeActif);

    const cible = chapitreActif
      ? document.querySelector(
          `#carte-semestre-${chapitreActif.semestre} .carte-mentale__ligne-chapitres`
        )
      : document.getElementById('carte-mentale');

    if (!cible) return;
    cible.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest'
    });
  });
}

function memoriserPositionsChapitres() {
  const positions = new Map();
  document.querySelectorAll('[data-axe-card]').forEach((noeud) => {
    const rect = noeud.getBoundingClientRect();
    positions.set(noeud.dataset.axeCard, { left: rect.left, top: rect.top });
  });
  return positions;
}

function animerReordonnancement(positionsAvant) {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  window.requestAnimationFrame(() => {
    document.querySelectorAll('[data-axe-card]').forEach((noeud) => {
      const positionAvant = positionsAvant.get(noeud.dataset.axeCard);
      if (!positionAvant) return;

      const rectApres = noeud.getBoundingClientRect();
      const decalageX = positionAvant.left - rectApres.left;
      const decalageY = positionAvant.top - rectApres.top;

      if (Math.abs(decalageX) < 1 && Math.abs(decalageY) < 1) return;

      noeud.animate(
        [
          {
            transform: `translate(${decalageX}px, ${decalageY}px) scale(0.96)`,
            opacity: 0.78
          },
          {
            transform: 'translate(0, 0) scale(1)',
            opacity: 1
          }
        ],
        {
          duration: 950,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'both'
        }
      );
    });
  });
}

function basculerChapitre(code) {
  if (transitionDeNuageEnCours) return;

  const chapitreFerme = axeActif === code;
  const positionsAvant = memoriserPositionsChapitres();
  const nuagePrecedent = document.querySelector('.carte-mentale__nuage');

  const appliquerChangement = () => {
    axeActif = chapitreFerme ? null : code;
    rendreCarte();
    animerReordonnancement(positionsAvant);
    transitionDeNuageEnCours = false;
    recentrerApresInteraction(chapitreFerme);
  };

  if (nuagePrecedent) {
    transitionDeNuageEnCours = true;
    nuagePrecedent.classList.add('est-en-fermeture');
    window.setTimeout(appliquerChangement, 190);
  } else {
    appliquerChangement();
  }
}

function effacerLiensCroises() {
  const svg = document.getElementById('liaisons-carte-mentale');
  if (svg) svg.replaceChildren();
}

function dessinerLiensCroises(mot, source) {
  const carte = document.getElementById('carte-mentale');
  const svg = document.getElementById('liaisons-carte-mentale');
  const rattachements = rattachementsParMot.get(mot) || [];
  if (!carte || !svg || rattachements.length < 2) return;

  const axeSource = source.closest('[data-nuage-axe]')?.dataset.nuageAxe;
  const rectCarte = carte.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${Math.round(rectCarte.width)} ${Math.round(rectCarte.height)}`);
  svg.setAttribute('width', String(Math.round(rectCarte.width)));
  svg.setAttribute('height', String(Math.round(rectCarte.height)));
  svg.replaceChildren();

  const rectSource = source.getBoundingClientRect();
  const x1 = rectSource.left + rectSource.width / 2 - rectCarte.left;
  const y1 = rectSource.top + rectSource.height / 2 - rectCarte.top;

  rattachements.filter((axe) => axe !== axeSource).forEach((axe) => {
    const cible = carte.querySelector(`[data-axe-card="${axe}"]`);
    if (!cible) return;
    const rectCible = cible.getBoundingClientRect();
    const ligne = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    ligne.setAttribute('x1', x1.toFixed(1));
    ligne.setAttribute('y1', y1.toFixed(1));
    ligne.setAttribute('x2', (rectCible.left + rectCible.width / 2 - rectCarte.left).toFixed(1));
    ligne.setAttribute('y2', (rectCible.top + rectCible.height / 2 - rectCarte.top).toFixed(1));
    ligne.setAttribute('class', 'carte-mentale__liaison-croisee');
    svg.appendChild(ligne);
  });
}

function initialiserCarte() {
  const selecteurSeuil = document.getElementById('seuil-carte-mentale');
  if (selecteurSeuil) {
    selecteurSeuil.value = String(SEUIL_PAR_DEFAUT);
    selecteurSeuil.addEventListener('change', (event) => {
      seuilActif = Number(event.target.value);
      axeActif = null;
      rendreCarte();
      recentrerApresInteraction(true);
    });
  }

  fetch(urlDonneesCarte)
    .then((reponse) => {
      if (!reponse.ok) throw new Error(`Chargement impossible (${reponse.status})`);
      return reponse.json();
    })
    .then((donnees) => {
      construireIndex(Array.isArray(donnees) ? donnees : []);
      rendreCarte();
    })
    .catch((erreur) => {
      const etat = document.getElementById('etat-carte-mentale');
      if (etat) etat.textContent = 'La carte thématique ne peut pas être chargée pour le moment.';
      console.error('Erreur de chargement de la carte thématique :', erreur);
    });

  window.addEventListener('resize', effacerLiensCroises);
  window.addEventListener('scroll', effacerLiensCroises, { passive: true });
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialiserCarte, { once: true });
  else initialiserCarte();
}
