const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();

// Fichier Excel historique
const EXCEL_FILE = 'C:\\Users\\lenovo\\Downloads\\VM_Renouvellement(Récupération automatique).xlsx';

// Fonction pour normaliser les noms de médecins
function normalizeMedecinName(name) {
  if (!name || typeof name !== 'string') return null;
  
  let cleaned = name.toString().trim().toUpperCase();
  
  // Retirer les préfixes courants
  cleaned = cleaned.replace(/^DR\.?\s*/i, '');
  cleaned = cleaned.replace(/^DOCTEUR\s*/i, '');
  
  // Nettoyer les espaces multiples
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned || null;
}

async function main() {
  console.log('=== Liaison des médecins aux visites ===\n');
  
  // 1. Charger les médecins existants
  const medecins = await prisma.medecin.findMany();
  console.log(`Médecins en base: ${medecins.length}`);
  
  // Créer un map de noms normalisés vers IDs
  const medecinMap = new Map();
  medecins.forEach(m => {
    const normalizedName = normalizeMedecinName(m.nom);
    if (normalizedName) {
      medecinMap.set(normalizedName, m.id);
      // Ajouter aussi des variantes
      if (m.prenom) {
        medecinMap.set(normalizeMedecinName(`${m.nom} ${m.prenom}`), m.id);
        medecinMap.set(normalizeMedecinName(`${m.prenom} ${m.nom}`), m.id);
      }
    }
  });
  
  console.log(`Noms de médecins indexés: ${medecinMap.size}`);
  
  // 2. Lire le fichier Excel
  console.log(`\nLecture du fichier: ${EXCEL_FILE}`);
  const workbook = XLSX.readFile(EXCEL_FILE);
  
  // 3. Parcourir chaque feuille et extraire les données
  const visitesData = new Map(); // matricule -> { medecin, date }
  
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    
    if (data.length < 2) continue;
    
    // Détecter les colonnes
    const headers = data[0].map(h => String(h).toLowerCase().trim());
    
    let matriculeCol = -1;
    let medecinCol = -1;
    let dateCol = -1;
    
    headers.forEach((h, i) => {
      if (h.includes('matricule') || h.includes('mat')) matriculeCol = i;
      if (h.includes('medecin') || h.includes('médecin') || h.includes('docteur')) medecinCol = i;
      if (h.includes('date') && (h.includes('visite') || h.includes('dernière') || h.includes('derniere'))) dateCol = i;
    });
    
    // Si pas trouvé, essayer la première ligne comme données
    if (matriculeCol === -1 || medecinCol === -1) {
      // Format CASA : première ligne = données, pas d'en-têtes standard
      // Colonnes typiques: 0=medecin, 1=date, 2=matricule, 3=chantier
      if (data[0].length >= 4) {
        matriculeCol = 2;
        medecinCol = 0;
        dateCol = 1;
      }
    }
    
    if (matriculeCol === -1) continue;
    
    console.log(`\nFeuille: ${sheetName}`);
    console.log(`  Colonnes - Matricule: ${matriculeCol}, Médecin: ${medecinCol}, Date: ${dateCol}`);
    
    let count = 0;
    const startRow = (headers[0] && headers[0].includes('matricule')) ? 1 : 0;
    
    for (let i = startRow; i < data.length; i++) {
      const row = data[i];
      const matricule = String(row[matriculeCol] || '').trim();
      const medecinName = medecinCol >= 0 ? String(row[medecinCol] || '').trim() : null;
      
      if (!matricule || matricule.length < 3) continue;
      if (!medecinName || medecinName.length < 2) continue;
      
      // Stocker le nom du médecin pour ce matricule
      if (!visitesData.has(matricule)) {
        visitesData.set(matricule, []);
      }
      visitesData.get(matricule).push({
        medecinName: medecinName,
        medecinNormalized: normalizeMedecinName(medecinName)
      });
      count++;
    }
    
    console.log(`  Lignes avec médecin: ${count}`);
  }
  
  console.log(`\nTotal matricules avec médecin: ${visitesData.size}`);
  
  // 4. Mettre à jour les visites
  console.log('\nMise à jour des visites...');
  
  let updated = 0;
  let matched = 0;
  let errors = [];
  
  // Récupérer toutes les visites avec leurs salariés
  const visites = await prisma.visite.findMany({
    include: { salarie: { select: { matricule: true } } }
  });
  
  console.log(`Visites à traiter: ${visites.length}`);
  
  // Traiter par lots
  const batchSize = 500;
  
  for (let i = 0; i < visites.length; i += batchSize) {
    const batch = visites.slice(i, i + batchSize);
    
    const updates = [];
    
    for (const visite of batch) {
      const matricule = visite.salarie?.matricule;
      if (!matricule) continue;
      
      const medecinData = visitesData.get(matricule);
      if (!medecinData || medecinData.length === 0) continue;
      
      // Prendre le premier médecin trouvé pour ce matricule
      const { medecinName, medecinNormalized } = medecinData[0];
      
      // Chercher l'ID du médecin
      let medecinId = null;
      
      // Essayer de matcher exactement
      if (medecinNormalized && medecinMap.has(medecinNormalized)) {
        medecinId = medecinMap.get(medecinNormalized);
        matched++;
      } else {
        // Essayer un match partiel
        for (const [name, id] of medecinMap.entries()) {
          if (medecinNormalized && (
            name.includes(medecinNormalized) || 
            medecinNormalized.includes(name)
          )) {
            medecinId = id;
            matched++;
            break;
          }
        }
      }
      
      updates.push({
        id: visite.id,
        medecinNom: medecinName,
        medecinId: medecinId
      });
    }
    
    // Exécuter les mises à jour en transaction
    if (updates.length > 0) {
      await prisma.$transaction(
        updates.map(u => prisma.visite.update({
          where: { id: u.id },
          data: {
            medecinNom: u.medecinNom,
            medecinId: u.medecinId
          }
        }))
      );
      updated += updates.length;
    }
    
    process.stdout.write(`\rProgress: ${Math.min(i + batchSize, visites.length)}/${visites.length}`);
  }
  
  console.log('\n');
  console.log(`=== Résultats ===`);
  console.log(`Visites mises à jour: ${updated}`);
  console.log(`Médecins liés (medecinId trouvé): ${matched}`);
  
  // Vérification finale
  const statsAfter = await prisma.visite.groupBy({
    by: ['medecinId'],
    _count: true
  });
  
  console.log('\nStats après mise à jour:');
  const withMedecin = statsAfter.filter(s => s.medecinId !== null).reduce((acc, s) => acc + s._count, 0);
  const withoutMedecin = statsAfter.filter(s => s.medecinId === null).reduce((acc, s) => acc + s._count, 0);
  console.log(`Avec medecinId: ${withMedecin}`);
  console.log(`Sans medecinId: ${withoutMedecin}`);
  
  // Vérifier combien ont medecinNom
  const withNom = await prisma.visite.count({ where: { medecinNom: { not: null } } });
  console.log(`Avec medecinNom: ${withNom}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
