let toutesLesDonnees = [];
let instancesGraphiques = {}; 

// 1. ORDRE FIXE DES THÈMES (Ajout de 'Autres' à la fin)
const ORDRE_THEMES = ['ETA', 'EXS', 'MM', 'CC', 'HV', 'HL', 'OdS', 'OdH', 'Autres'];

function extraireThemes(sigle) {
    if (!sigle) return [];
    
    // Cas spécifiques Terminale
    if (sigle === 'EXSTA') return ['EXS', 'ETA'];
    if (sigle === 'HVL') return ['HV', 'HL'];
    if (sigle === 'OdS' || sigle === 'OdH') return [sigle];
    
    // Si le sigle se termine par un marqueur de Première (PdP, DFI, etc.)
    if (sigle.match(/(PdP|DFI|DMRC|HA)$/)) {
        return ['Autres'];
    }

    // Extraction classique
    let correspondances = sigle.match(/(ETA|EXS|MM|HV|HL|CC)/g);
    
    // Si on ne trouve vraiment rien de standard, on met dans 'Autres'
    return correspondances || ['Autres'];
}

// Fonction pour trier les données selon l'ordre officiel
function formaterDonneesTriees(donneesBrutes) {
    let labels = [];
    let data = [];
    
    // On boucle uniquement sur notre ordre de référence
    ORDRE_THEMES.forEach(theme => {
        if (donneesBrutes[theme] !== undefined) {
            labels.push(theme);
            data.push(donneesBrutes[theme]);
        }
    });
    
    return { labels, data };
}

// 2. FONCTION DE GÉNÉRATION DES GRAPHIQUES
function dessinerGraphique(id, type, titre, donneesBrutes, couleurBarre = '#9966FF') {
    // 1. Préparation des données
    let { labels, data } = (id.includes('Discipline')) 
        ? { labels: Object.keys(donneesBrutes), data: Object.values(donneesBrutes) } 
        : formaterDonneesTriees(donneesBrutes);

    // 2. Définition des couleurs
    let couleursPie = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#8AC926', '#1982C4', '#F15BB5'];
    let bgCouleur = (type === 'pie') ? (id.includes('Discipline') ? ['#FFCE56', '#36A2EB'] : couleursPie) : couleurBarre;

    // 3. Mise à jour fluide ou création
    if (instancesGraphiques[id]) {
        // Le graphique existe déjà : on met à jour ses données pour déclencher l'animation
        instancesGraphiques[id].data.labels = labels;
        instancesGraphiques[id].data.datasets[0].data = data;
        instancesGraphiques[id].update();
    } else {
        // C'est le premier chargement : on crée le graphique avec une animation de départ
        instancesGraphiques[id] = new Chart(document.getElementById(id), {
            type: type,
            data: {
                labels: labels,
                datasets: [{
                    label: 'Nombre de questions',
                    data: data,
                    backgroundColor: bgCouleur
                }]
            },
            options: {
                plugins: { title: { display: true, text: titre, font: { size: 14 } } },
                scales: type === 'bar' ? { y: { beginAtZero: true, ticks: { stepSize: 1 } } } : {},
                // On peut forcer un style d'animation fluide
                animation: {
                    duration: 800,
                    easing: 'easeOutQuart'
                }
            }
        });
    }
}

// 3. INITIALISATION ET FILTRAGE
fetch(urlDonnees)
    .then(r => r.json())
    .then(data => { toutesLesDonnees = data; filtrerZone('Toutes'); });

function filtrerZone(zone) {
    let donneesFiltrees = (zone === 'Toutes') ? toutesLesDonnees : toutesLesDonnees.filter(s => s.lieu === zone);
    
    document.getElementById('compteur-sujets').innerText = donneesFiltrees.length + " sujets affichés";

    // 4. STRUCTURE DE COMPTAGE
    let stats = {
        interpDisc: { phil: 0, litt: 0 }, essaiDisc: { phil: 0, litt: 0 },
        themesGlobal: {},
        interpLitt: {}, interpPhil: {}, essaiLitt: {}, essaiPhil: {},
        globalLitt: {}, globalPhil: {}
    };

    donneesFiltrees.forEach(sujet => {
        if (!sujet.questions || sujet.questions.length !== 2) return;
        let qInterp = sujet.questions[0];
        let qEssai = sujet.questions[1];
        
        // Comptage Disciplines
        if (stats.interpDisc[qInterp.discipline] !== undefined) stats.interpDisc[qInterp.discipline]++;
        if (stats.essaiDisc[qEssai.discipline] !== undefined) stats.essaiDisc[qEssai.discipline]++;

        let themesInterp = extraireThemes(qInterp.theme_programme);
        let themesEssai = extraireThemes(qEssai.theme_programme);
        
        // Thèmes globaux (sans doublons sur un même sujet)
        new Set([...themesInterp, ...themesEssai]).forEach(t => stats.themesGlobal[t] = (stats.themesGlobal[t] || 0) + 1);

        // Ventilation Interprétation
        themesInterp.forEach(t => {
            if (qInterp.discipline === 'litt') {
                stats.interpLitt[t] = (stats.interpLitt[t] || 0) + 1;
                stats.globalLitt[t] = (stats.globalLitt[t] || 0) + 1;
            } else {
                stats.interpPhil[t] = (stats.interpPhil[t] || 0) + 1;
                stats.globalPhil[t] = (stats.globalPhil[t] || 0) + 1;
            }
        });

        // Ventilation Essai
        themesEssai.forEach(t => {
            if (qEssai.discipline === 'litt') {
                stats.essaiLitt[t] = (stats.essaiLitt[t] || 0) + 1;
                stats.globalLitt[t] = (stats.globalLitt[t] || 0) + 1;
            } else {
                stats.essaiPhil[t] = (stats.essaiPhil[t] || 0) + 1;
                stats.globalPhil[t] = (stats.globalPhil[t] || 0) + 1;
            }
        });
    });

    // 5. AFFICHAGE DE TOUS LES GRAPHIQUES
    // Section 1
    dessinerGraphique('canvasInterpDiscipline', 'pie', "Discipline - Interprétation", stats.interpDisc);
    dessinerGraphique('canvasEssaiDiscipline', 'pie', "Discipline - Essai", stats.essaiDisc);
    
    // Section 2
    dessinerGraphique('barThemesGlobal', 'bar', "Répartition globale des thèmes (par sujet)", stats.themesGlobal, '#8250c4');
    
    // Section 3
    dessinerGraphique('pieInterpLitt', 'pie', "Thèmes - Interprétation Litt.", stats.interpLitt);
    dessinerGraphique('pieInterpPhil', 'pie', "Thèmes - Interprétation Philo.", stats.interpPhil);
    dessinerGraphique('pieEssaiLitt', 'pie', "Thèmes - Essai Litt.", stats.essaiLitt);
    dessinerGraphique('pieEssaiPhil', 'pie', "Thèmes - Essai Philo.", stats.essaiPhil);
    
    // Section 4 (Littérature - barres en bleu clair)
    dessinerGraphique('pieLittGlobal', 'pie', "Thèmes globaux (Toutes les questions littéraires)", stats.globalLitt);
    dessinerGraphique('barLittInterp', 'bar', "Thèmes Interprétation littéraire", stats.interpLitt, '#36A2EB');
    dessinerGraphique('barLittEssai', 'bar', "Thèmes Essai littéraire", stats.essaiLitt, '#36A2EB');
    
    // Section 5 (Philosophie - barres en jaune/doré)
    dessinerGraphique('piePhilGlobal', 'pie', "Thèmes globaux (Toutes les questions philosophiques)", stats.globalPhil);
    dessinerGraphique('barPhilInterp', 'bar', "Thèmes Interprétation philosophique", stats.interpPhil, '#FFCE56');
    dessinerGraphique('barPhilEssai', 'bar', "Thèmes Essai philosophique", stats.essaiPhil, '#FFCE56');
}

// FONCTION POUR MASQUER/AFFICHER LES SECTIONS AVEC ANIMATION
function afficherSection(sectionChoisie) {
    // 1. On récupère les trois grandes boîtes HTML
    const blocGeneral = document.getElementById('section-general');
    const blocLitt = document.getElementById('section-litterature');
    const blocPhil = document.getElementById('section-philosophie');

    // 2. On masque tout par défaut
    blocGeneral.style.display = 'none';
    blocLitt.style.display = 'none';
    blocPhil.style.display = 'none';

    // 3. On affiche uniquement ce qui correspond au bouton cliqué
    if (sectionChoisie === 'tout') {
        blocGeneral.style.display = 'block';
        blocLitt.style.display = 'block';
        blocPhil.style.display = 'block';
    } else if (sectionChoisie === 'general') {
        blocGeneral.style.display = 'block';
    } else if (sectionChoisie === 'litterature') {
        blocLitt.style.display = 'block';
    } else if (sectionChoisie === 'philosophie') {
        blocPhil.style.display = 'block';
    }

    // 4. On force l'effet de "construction" sur les graphiques visibles
    // Le setTimeout (10ms) laisse un instant au navigateur pour appliquer le style "block"
    setTimeout(() => {
        // On parcourt tous les graphiques que nous avons créés
        Object.values(instancesGraphiques).forEach(graphique => {
            // offsetParent !== null permet de vérifier si le graphique est visible à l'écran.
            // On n'anime que les graphiques visibles pour éviter les erreurs de Chart.js
            if (graphique.canvas.offsetParent !== null) {
                graphique.reset();  // Remet le graphique à 0 de façon invisible
                graphique.update(); // Relance l'animation de construction
            }
        });
    }, 10);
}