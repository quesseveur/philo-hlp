'use strict';

/*
 * Statistiques HLP — graphiques, tableaux détaillés et export CSV.
 * Ce fichier remplace intégralement l’ancien assets/statistiques.js.
 */

let instancesGraphiques = {};
let toutesLesDonnees = [];
let zoneSelectionnee = 'Toutes';
let vueSelectionnee = 'graphiques';
let sectionGraphiqueSelectionnee = 'tout';

const AXES_PRINCIPAUX = ['ETA', 'EXS', 'MM', 'CC', 'HV', 'HL'];
const ORDRE_THEMES_GRAPHIQUES = [...AXES_PRINCIPAUX, 'Autres'];
const ZONES_PRIORITAIRES = [
  'Antilles', 'Asie', 'Amérique du Nord', 'Amérique du Sud', 'Centres étrangers',
  'La Réunion', 'Liban', 'Métropole', 'Nouvelle-Calédonie', 'Polynésie'
];

const LIGNES_TABLEAU = [
  { id: 'interp-litt', libelle: 'Int. litt.', indexQuestion: 0, discipline: 'litt' },
  { id: 'interp-phil', libelle: 'Int. phil.', indexQuestion: 0, discipline: 'phil' },
  { id: 'essai-litt', libelle: 'Essai litt.', indexQuestion: 1, discipline: 'litt' },
  { id: 'essai-phil', libelle: 'Essai phil.', indexQuestion: 1, discipline: 'phil' }
];

/* Les trois blocs suivent exactement l’organisation du tableau LaTeX de référence. */
const BLOCS_TABLEAUX = [
  {
    id: 'chapitres',
    titre: 'Chapitres de Terminale',
    groupes: [
      {
        titre: 'La Recherche de soi',
        sousGroupes: [
          {
            titre: 'Exclusivement',
            colonnes: [
              { type: 'code', code: 'ETA', libelle: 'ETA' },
              { type: 'code', code: 'EXS', libelle: 'EXS' },
              { type: 'code', code: 'MM', libelle: 'MM' }
            ]
          },
          {
            titre: 'Plusieurs chapitres',
            colonnes: [
              { type: 'code', code: 'ETAMM', libelle: 'ETAMM' },
              { type: 'code', code: 'EXSTA', libelle: 'EXSTA' },
              { type: 'code', code: 'EXSMM', libelle: 'EXSMM' },
              { type: 'code', code: 'ODS', libelle: 'OdS' },
              { type: 'famille', famille: 'rechercheDeSoi', libelle: 'Tot.' }
            ]
          }
        ]
      },
      {
        titre: 'L’humanité en question',
        sousGroupes: [
          {
            titre: 'Exclusivement',
            colonnes: [
              { type: 'code', code: 'CC', libelle: 'CC' },
              { type: 'code', code: 'HV', libelle: 'HV' },
              { type: 'code', code: 'HL', libelle: 'HL' }
            ]
          },
          {
            titre: 'Plusieurs chapitres',
            colonnes: [
              { type: 'code', code: 'HVCC', libelle: 'HVCC' },
              { type: 'code', code: 'HLCC', libelle: 'HLCC' },
              { type: 'code', code: 'HVL', libelle: 'HVL' },
              { type: 'code', code: 'ODH', libelle: 'OdH' },
              { type: 'famille', famille: 'humanite', libelle: 'Tot.' }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'transversaux',
    titre: 'Croisements transversaux',
    groupes: [
      {
        titre: 'Transversaux sur les semestres',
        sousGroupes: [
          {
            titre: 'Croisements Terminale',
            colonnes: [
              { type: 'code', code: 'ETACC', libelle: 'ETACC' },
              { type: 'code', code: 'ETAHV', libelle: 'ETAHV' },
              { type: 'code', code: 'ETAHL', libelle: 'ETAHL' },
              { type: 'code', code: 'EXSCC', libelle: 'EXSCC' },
              { type: 'code', code: 'EXSHV', libelle: 'EXSHV' },
              { type: 'code', code: 'EXSHL', libelle: 'EXSHL' },
              { type: 'code', code: 'MMCC', libelle: 'MMCC' },
              { type: 'code', code: 'MMHV', libelle: 'MMHV' },
              { type: 'code', code: 'MMHL', libelle: 'MMHL' }
            ]
          }
        ]
      },
      {
        titre: 'Transversaux sur les années',
        sousGroupes: [
          {
            titre: 'Terminale × Première',
            colonnes: [
              { type: 'premiere', axe: 'ETA', libelle: 'ETA Prem.' },
              { type: 'premiere', axe: 'EXS', libelle: 'EXS Prem.' },
              { type: 'premiere', axe: 'MM', libelle: 'MM Prem.' },
              { type: 'premiere', axe: 'CC', libelle: 'CC Prem.' },
              { type: 'premiere', axe: 'HV', libelle: 'HV Prem.' },
              { type: 'premiere', axe: 'HL', libelle: 'HL Prem.' }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'axes',
    titre: 'Tous les axes confondus',
    groupes: [
      {
        titre: 'Axes de Terminale',
        sousGroupes: [
          {
            titre: 'Tous les chapitres',
            colonnes: AXES_PRINCIPAUX.map((axe) => ({ type: 'axe', axe, libelle: axe }))
          }
        ]
      }
    ]
  }
];

function normaliserCodeAxe(code) {
  return String(code || '').replace(/\s+/g, '').toUpperCase();
}

function axesPrincipauxDuCode(code) {
  const codeNormalise = normaliserCodeAxe(code);
  return AXES_PRINCIPAUX.filter((axe) => codeNormalise.includes(axe));
}

function estCroisementPremiere(code) {
  return /(?:PDP|DFI|DMRC|HA)$/i.test(normaliserCodeAxe(code));
}

function extraireThemesPourGraphique(code) {
  const axes = axesPrincipauxDuCode(code);
  return axes.length ? axes : ['Autres'];
}

function creerLigneVide() {
  return {
    codes: {},
    axes: Object.fromEntries(AXES_PRINCIPAUX.map((axe) => [axe, 0])),
    premiere: Object.fromEntries(AXES_PRINCIPAUX.map((axe) => [axe, 0])),
    familles: { rechercheDeSoi: 0, humanite: 0 }
  };
}

function ajouterQuestionAuTableau(ligne, codeBrut) {
  const code = normaliserCodeAxe(codeBrut);
  if (!code) return;

  ligne.codes[code] = (ligne.codes[code] || 0) + 1;
  const axes = axesPrincipauxDuCode(code);
  axes.forEach((axe) => { ligne.axes[axe] += 1; });

  if (estCroisementPremiere(code)) {
    axes.forEach((axe) => { ligne.premiere[axe] += 1; });
  }

  /* Un croisement au sein d’une famille compte une seule fois dans son total. */
  if (axes.some((axe) => ['ETA', 'EXS', 'MM'].includes(axe)) || code === 'ODS') {
    ligne.familles.rechercheDeSoi += 1;
  }
  if (axes.some((axe) => ['CC', 'HV', 'HL'].includes(axe)) || code === 'ODH') {
    ligne.familles.humanite += 1;
  }
}

function creerModeleTableau(donnees) {
  const lignes = Object.fromEntries(LIGNES_TABLEAU.map((ligne) => [ligne.id, creerLigneVide()]));

  donnees.forEach((sujet) => {
    if (!Array.isArray(sujet.questions) || sujet.questions.length !== 2) return;

    LIGNES_TABLEAU.forEach((definition) => {
      const question = sujet.questions[definition.indexQuestion];
      if (!question || question.discipline !== definition.discipline) return;
      ajouterQuestionAuTableau(lignes[definition.id], question.theme_programme);
    });
  });

  return lignes;
}

function creerStatsGraphiques(donnees) {
  const stats = {
    interpDisc: { phil: 0, litt: 0 }, essaiDisc: { phil: 0, litt: 0 },
    themesGlobal: {}, interpLitt: {}, interpPhil: {}, essaiLitt: {}, essaiPhil: {},
    globalLitt: {}, globalPhil: {}
  };

  donnees.forEach((sujet) => {
    if (!Array.isArray(sujet.questions) || sujet.questions.length !== 2) return;
    const [questionInterpretation, questionEssai] = sujet.questions;
    if (!questionInterpretation || !questionEssai) return;

    if (stats.interpDisc[questionInterpretation.discipline] !== undefined) stats.interpDisc[questionInterpretation.discipline] += 1;
    if (stats.essaiDisc[questionEssai.discipline] !== undefined) stats.essaiDisc[questionEssai.discipline] += 1;

    const themesInterpretation = extraireThemesPourGraphique(questionInterpretation.theme_programme);
    const themesEssai = extraireThemesPourGraphique(questionEssai.theme_programme);

    new Set([...themesInterpretation, ...themesEssai]).forEach((theme) => {
      stats.themesGlobal[theme] = (stats.themesGlobal[theme] || 0) + 1;
    });

    themesInterpretation.forEach((theme) => {
      if (questionInterpretation.discipline === 'litt') {
        stats.interpLitt[theme] = (stats.interpLitt[theme] || 0) + 1;
        stats.globalLitt[theme] = (stats.globalLitt[theme] || 0) + 1;
      } else if (questionInterpretation.discipline === 'phil') {
        stats.interpPhil[theme] = (stats.interpPhil[theme] || 0) + 1;
        stats.globalPhil[theme] = (stats.globalPhil[theme] || 0) + 1;
      }
    });

    themesEssai.forEach((theme) => {
      if (questionEssai.discipline === 'litt') {
        stats.essaiLitt[theme] = (stats.essaiLitt[theme] || 0) + 1;
        stats.globalLitt[theme] = (stats.globalLitt[theme] || 0) + 1;
      } else if (questionEssai.discipline === 'phil') {
        stats.essaiPhil[theme] = (stats.essaiPhil[theme] || 0) + 1;
        stats.globalPhil[theme] = (stats.globalPhil[theme] || 0) + 1;
      }
    });
  });

  return stats;
}

function formaterDonneesTriees(donneesBrutes) {
  const labels = [];
  const data = [];
  ORDRE_THEMES_GRAPHIQUES.forEach((theme) => {
    if (donneesBrutes[theme] !== undefined) {
      labels.push(theme);
      data.push(donneesBrutes[theme]);
    }
  });
  return { labels, data };
}

function dessinerGraphique(id, type, titre, donneesBrutes, couleurBarre = '#9966FF') {
  const canvas = document.getElementById(id);
  if (!canvas || typeof Chart === 'undefined') return;

  const { labels, data } = id.includes('Discipline')
    ? { labels: Object.keys(donneesBrutes), data: Object.values(donneesBrutes) }
    : formaterDonneesTriees(donneesBrutes);

  /* Palette volontairement identique à celle de votre script d’origine. */
  const couleursPie = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#8AC926', '#1982C4', '#F15BB5'];
  const backgroundColor = type === 'pie'
    ? (id.includes('Discipline') ? ['#FFCE56', '#36A2EB'] : couleursPie)
    : couleurBarre;

  if (instancesGraphiques[id]) {
    instancesGraphiques[id].data.labels = labels;
    instancesGraphiques[id].data.datasets[0].data = data;
    instancesGraphiques[id].update();
    return;
  }

  instancesGraphiques[id] = new Chart(canvas, {
    type,
    data: { labels, datasets: [{ label: 'Nombre de questions', data, backgroundColor }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { title: { display: true, text: titre, font: { size: 14 } } },
      scales: type === 'bar' ? { y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } } } : {},
      animation: { duration: 650, easing: 'easeOutQuart' }
    }
  });
}

function dessinerTousLesGraphiques(stats) {
  dessinerGraphique('canvasInterpDiscipline', 'pie', 'Discipline — Interprétation', stats.interpDisc);
  dessinerGraphique('canvasEssaiDiscipline', 'pie', 'Discipline — Essai', stats.essaiDisc);
  dessinerGraphique('barThemesGlobal', 'bar', 'Répartition globale des thèmes (par sujet)', stats.themesGlobal, '#8250c4');

  dessinerGraphique('pieLittGlobal', 'pie', 'Thèmes globaux — questions littéraires', stats.globalLitt);
  dessinerGraphique('barLittInterp', 'bar', 'Thèmes — interprétation littéraire', stats.interpLitt, '#36A2EB');
  dessinerGraphique('barLittEssai', 'bar', 'Thèmes — essai littéraire', stats.essaiLitt, '#36A2EB');

  dessinerGraphique('piePhilGlobal', 'pie', 'Thèmes globaux — questions philosophiques', stats.globalPhil);
  dessinerGraphique('barPhilInterp', 'bar', 'Thèmes — interprétation philosophique', stats.interpPhil, '#FFCE56');
  dessinerGraphique('barPhilEssai', 'bar', 'Thèmes — essai philosophique', stats.essaiPhil, '#FFCE56');

  dessinerGraphique('pieInterpLitt', 'pie', 'Thèmes — interprétation littéraire', stats.interpLitt);
  dessinerGraphique('pieInterpPhil', 'pie', 'Thèmes — interprétation philosophique', stats.interpPhil);
  dessinerGraphique('pieEssaiLitt', 'pie', 'Thèmes — essai littéraire', stats.essaiLitt);
  dessinerGraphique('pieEssaiPhil', 'pie', 'Thèmes — essai philosophique', stats.essaiPhil);
}

function colonnesDuBloc(bloc) {
  return bloc.groupes.flatMap((groupe) => groupe.sousGroupes.flatMap((sousGroupe) => sousGroupe.colonnes));
}

function valeurColonne(ligne, colonne) {
  if (colonne.type === 'code') return ligne.codes[colonne.code] || 0;
  if (colonne.type === 'axe') return ligne.axes[colonne.axe] || 0;
  if (colonne.type === 'premiere') return ligne.premiere[colonne.axe] || 0;
  if (colonne.type === 'famille') return ligne.familles[colonne.famille] || 0;
  return 0;
}

function lignesVisibles() {
  if (sectionGraphiqueSelectionnee === 'litterature') return LIGNES_TABLEAU.filter((ligne) => ligne.discipline === 'litt');
  if (sectionGraphiqueSelectionnee === 'philosophie') return LIGNES_TABLEAU.filter((ligne) => ligne.discipline === 'phil');
  return LIGNES_TABLEAU;
}

function sommeLignes(lignes, definitions) {
  const total = creerLigneVide();
  definitions.forEach((definition) => {
    const ligne = lignes[definition.id];
    Object.entries(ligne.codes).forEach(([code, valeur]) => { total.codes[code] = (total.codes[code] || 0) + valeur; });
    AXES_PRINCIPAUX.forEach((axe) => {
      total.axes[axe] += ligne.axes[axe];
      total.premiere[axe] += ligne.premiere[axe];
    });
    total.familles.rechercheDeSoi += ligne.familles.rechercheDeSoi;
    total.familles.humanite += ligne.familles.humanite;
  });
  return total;
}

function construireEnteteTableau(bloc) {
  const colonnes = colonnesDuBloc(bloc);
  const premiereLigne = bloc.groupes.map((groupe) => {
    const largeur = groupe.sousGroupes.reduce((total, sousGroupe) => total + sousGroupe.colonnes.length, 0);
    return `<th scope="colgroup" colspan="${largeur}">${groupe.titre}</th>`;
  }).join('');
  const deuxiemeLigne = bloc.groupes.map((groupe) => groupe.sousGroupes.map((sousGroupe) => (
    `<th scope="colgroup" colspan="${sousGroupe.colonnes.length}">${sousGroupe.titre}</th>`
  )).join('')).join('');
  const troisiemeLigne = colonnes.map((colonne) => `<th scope="col" title="${colonne.libelle}">${colonne.libelle}</th>`).join('');

  return `
    <thead>
      <tr class="stat-tableau-titre"><th scope="colgroup" colspan="${colonnes.length + 1}">${bloc.titre}</th></tr>
      <tr class="stat-tableau-groupes"><th scope="col" rowspan="3">Questions</th>${premiereLigne}</tr>
      <tr class="stat-tableau-sous-groupes">${deuxiemeLigne}</tr>
      <tr class="stat-tableau-colonnes">${troisiemeLigne}</tr>
    </thead>`;
}

function ligneTableauHTML(libelle, ligne, colonnes, classe = '') {
  const cellules = colonnes.map((colonne) => `<td>${valeurColonne(ligne, colonne)}</td>`).join('');
  return `<tr class="${classe}"><th scope="row">${libelle}</th>${cellules}</tr>`;
}

function rendreUnTableau(bloc, lignes, definitions) {
  const colonnes = colonnesDuBloc(bloc);
  const corps = definitions.map((definition) => (
    ligneTableauHTML(definition.libelle, lignes[definition.id], colonnes)
  )).join('');
  const total = ligneTableauHTML('Totaux', sommeLignes(lignes, definitions), colonnes, 'stat-tableau-total');

  return `
    <section class="bloc-tableau-statistiques" aria-labelledby="titre-tableau-${bloc.id}">
      <h3 id="titre-tableau-${bloc.id}">${bloc.titre}</h3>
      <div class="statistiques-tableau-wrap" tabindex="0" aria-label="${bloc.titre}. Faites défiler horizontalement si nécessaire.">
        <table class="statistiques-tableau statistiques-tableau-${bloc.id}">
          <caption>Décompte détaillé des questions correspondant au filtre actif : ${bloc.titre}.</caption>
          ${construireEnteteTableau(bloc)}
          <tbody>${corps}${total}</tbody>
        </table>
      </div>
    </section>`;
}

function rendreTableaux(lignes) {
  const conteneur = document.getElementById('conteneur-tableau-statistiques');
  if (!conteneur) return;
  const definitions = lignesVisibles();
  conteneur.innerHTML = BLOCS_TABLEAUX.map((bloc) => rendreUnTableau(bloc, lignes, definitions)).join('');
}

function mettreAJourCompteur(nombre) {
  const compteur = document.getElementById('compteur-sujets');
  if (compteur) compteur.textContent = `${nombre} sujet${nombre > 1 ? 's' : ''} affiché${nombre > 1 ? 's' : ''}`;
}

function donneesFiltreesCourantes() {
  return zoneSelectionnee === 'Toutes' ? toutesLesDonnees : toutesLesDonnees.filter((sujet) => sujet.lieu === zoneSelectionnee);
}

function appliquerFiltreSectionGraphique() {
  const sections = {
    general: document.getElementById('section-general'),
    litterature: document.getElementById('section-litterature'),
    philosophie: document.getElementById('section-philosophie')
  };

  Object.values(sections).forEach((section) => { if (section) section.hidden = true; });
  if (sectionGraphiqueSelectionnee === 'tout') {
    Object.values(sections).forEach((section) => { if (section) section.hidden = false; });
  } else if (sections[sectionGraphiqueSelectionnee]) {
    sections[sectionGraphiqueSelectionnee].hidden = false;
  }
}

function animerGraphiquesVisibles() {
  window.setTimeout(() => {
    Object.values(instancesGraphiques).forEach((graphique) => {
      if (graphique.canvas.offsetParent !== null) {
        graphique.resize();
        graphique.reset();
        graphique.update();
      }
    });
  }, 20);
}

function appliquerVue() {
  const vueGraphiques = document.getElementById('vue-graphiques');
  const vueTableau = document.getElementById('vue-tableau');
  if (vueGraphiques) vueGraphiques.hidden = vueSelectionnee !== 'graphiques';
  if (vueTableau) vueTableau.hidden = vueSelectionnee !== 'tableau';

  document.querySelectorAll('[data-vue]').forEach((bouton) => {
    const actif = bouton.dataset.vue === vueSelectionnee;
    bouton.classList.toggle('est-actif', actif);
    bouton.setAttribute('aria-pressed', String(actif));
  });

  if (vueSelectionnee === 'graphiques') animerGraphiquesVisibles();
}

function rendreMenuZones() {
  const menu = document.getElementById('menu-lateral');
  if (!menu) return;

  const zonesDisponibles = new Set(
  toutesLesDonnees
    .map((sujet) => sujet.lieu)
    .filter((lieu) => lieu && !/^Sujets?\s*0$/i.test(lieu))
);
  const zones = [
    ...ZONES_PRIORITAIRES.filter((zone) => zonesDisponibles.has(zone)),
    ...[...zonesDisponibles].filter((zone) => !ZONES_PRIORITAIRES.includes(zone)).sort((a, b) => a.localeCompare(b, 'fr'))
  ];
  const bouton = (zone, libelle) => `
    <button type="button" class="bouton-zone${zone === zoneSelectionnee ? ' est-actif' : ''}" data-zone="${zone}" aria-pressed="${zone === zoneSelectionnee}">${libelle}</button>`;

  menu.innerHTML = `
    <h2 class="menu-lateral-titre">Zones</h2>
    <div class="menu-lateral-zones">
      ${bouton('Toutes', 'Toutes les zones')}
      ${zones.map((zone) => bouton(zone, zone)).join('')}
    </div>`;
}

function filtrerZone(zone) {
  zoneSelectionnee = zone || 'Toutes';
  const donnees = donneesFiltreesCourantes();
  mettreAJourCompteur(donnees.length);
  dessinerTousLesGraphiques(creerStatsGraphiques(donnees));
  rendreTableaux(creerModeleTableau(donnees));
  rendreMenuZones();
}

function afficherSection(sectionChoisie) {
  sectionGraphiqueSelectionnee = sectionChoisie || 'tout';
  const selecteur = document.getElementById('filtre-section-graphique');
  if (selecteur && selecteur.value !== sectionGraphiqueSelectionnee) selecteur.value = sectionGraphiqueSelectionnee;
  appliquerFiltreSectionGraphique();
  rendreTableaux(creerModeleTableau(donneesFiltreesCourantes()));
  if (vueSelectionnee === 'graphiques') animerGraphiquesVisibles();
}

function changerVue(vue) {
  vueSelectionnee = vue === 'tableau' ? 'tableau' : 'graphiques';
  appliquerVue();
}

function echapperCSV(valeur) {
  return `"${String(valeur).replaceAll('"', '""')}"`;
}

function lignesCSVPourBloc(bloc, lignes, definitions) {
  const colonnes = colonnesDuBloc(bloc);
  const lignesTable = [
    [bloc.titre],
    ['Questions', ...colonnes.map((colonne) => colonne.libelle)],
    ...definitions.map((definition) => [
      definition.libelle,
      ...colonnes.map((colonne) => valeurColonne(lignes[definition.id], colonne))
    ]),
    ['Totaux', ...colonnes.map((colonne) => valeurColonne(sommeLignes(lignes, definitions), colonne))]
  ];
  return lignesTable.map((ligne) => ligne.map(echapperCSV).join(';'));
}

function creerCSVVisible() {
  const donnees = donneesFiltreesCourantes();
  const lignes = creerModeleTableau(donnees);
  const definitions = lignesVisibles();
  const titreSelection = sectionGraphiqueSelectionnee === 'litterature'
    ? 'Questions littéraires'
    : sectionGraphiqueSelectionnee === 'philosophie'
      ? 'Questions philosophiques'
      : 'Toutes les questions';

  return [
    `"Statistiques HLP — zone : ${zoneSelectionnee} — affichage : ${titreSelection}"`,
    ...BLOCS_TABLEAUX.flatMap((bloc, index) => [
      ...(index ? [''] : []),
      ...lignesCSVPourBloc(bloc, lignes, definitions)
    ])
  ].join('\r\n');
}

function copierTexteSecours(texte) {
  const zoneTexte = document.createElement('textarea');
  zoneTexte.value = texte;
  zoneTexte.setAttribute('readonly', '');
  zoneTexte.style.position = 'fixed';
  zoneTexte.style.opacity = '0';
  document.body.appendChild(zoneTexte);
  zoneTexte.select();
  const copie = document.execCommand('copy');
  zoneTexte.remove();
  if (!copie) throw new Error('Copie non prise en charge par ce navigateur.');
}

async function copierCSV() {
  const message = document.getElementById('etat-copie-csv');
  try {
    const csv = creerCSVVisible();
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(csv);
    else copierTexteSecours(csv);
    if (message) message.textContent = 'Les données affichées ont été copiées au format CSV.';
  } catch (erreur) {
    if (message) message.textContent = 'La copie a échoué ; veuillez réessayer dans un navigateur récent.';
    console.error('Erreur lors de la copie CSV :', erreur);
  }
}

function initialiserAide() {
  const dialogue = document.getElementById('aide-abreviations');
  const ouvrir = document.getElementById('ouvrir-aide-abreviations');
  const fermer = document.getElementById('fermer-aide-abreviations');
  if (!dialogue || !ouvrir || !fermer) return;

  const fermerDialogue = () => {
    if (typeof dialogue.close === 'function') dialogue.close();
    else dialogue.removeAttribute('open');
  };
  ouvrir.addEventListener('click', () => {
    if (typeof dialogue.showModal === 'function') dialogue.showModal();
    else dialogue.setAttribute('open', '');
  });
  fermer.addEventListener('click', fermerDialogue);
  dialogue.addEventListener('click', (event) => { if (event.target === dialogue) fermerDialogue(); });
}

function initialiserControles() {
  const selecteurSection = document.getElementById('filtre-section-graphique');
  const menuZones = document.getElementById('menu-lateral');
  const boutonCopie = document.getElementById('copier-csv');

  if (selecteurSection) selecteurSection.addEventListener('change', (event) => afficherSection(event.target.value));
  if (menuZones) menuZones.addEventListener('click', (event) => {
    const bouton = event.target.closest('[data-zone]');
    if (bouton) filtrerZone(bouton.dataset.zone);
  });
  if (boutonCopie) boutonCopie.addEventListener('click', copierCSV);
  document.querySelectorAll('[data-vue]').forEach((bouton) => {
    bouton.addEventListener('click', () => changerVue(bouton.dataset.vue));
  });
  initialiserAide();
}

function initialiserStatistiques() {
  initialiserControles();
  fetch(urlDonnees)
    .then((reponse) => {
      if (!reponse.ok) throw new Error(`Chargement impossible (${reponse.status})`);
      return reponse.json();
    })
    .then((donnees) => {
      toutesLesDonnees = Array.isArray(donnees) ? donnees : [];
      filtrerZone('Toutes');
      afficherSection('tout');
      appliquerVue();
    })
    .catch((erreur) => {
      const compteur = document.getElementById('compteur-sujets');
      if (compteur) compteur.textContent = 'Les statistiques ne peuvent pas être chargées pour le moment.';
      console.error('Erreur de chargement des statistiques :', erreur);
    });
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  /* Compatibilité éventuelle avec d’anciens boutons onclick. */
  window.filtrerZone = filtrerZone;
  window.afficherSection = afficherSection;
  window.changerVue = changerVue;
  window.copierCSV = copierCSV;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialiserStatistiques, { once: true });
  else initialiserStatistiques();
}