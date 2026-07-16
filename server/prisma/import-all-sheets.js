const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();

// Mapping des noms de feuilles vers les villes
const VILLE_MAPPING = {
  'CASA': 'CASA',
  'RABAT': 'RABAT',
  'KENITRA': 'KENITRA',
  'BENGUERIR': 'BENGUERIR',
  'MARRAKECH': 'MARRAKECH',
  'BENI MELLAL': 'BENI MELLAL',
  'SAFI': 'SAFI',
  'YOUSSOUFIA': 'YOUSSOUFIA',
  'JORF': 'JORF',
  'Khemissat': 'KHEMISSAT',
  'FES': 'FES',
  'Agadir': 'AGADIR',
  'HOUCEIMA': 'HOUCEIMA',
  'TANGER': 'TANGER',
  'TETOUANE': 'TETOUANE',
  'NADOR': 'NADOR',
  'LARACHE': 'LARACHE',
  'ERRACHIDIA': 'ERRACHIDIA',
  'FILIALES': 'FILIALES',
  'VisNonComp': 'DIVERS',
  'NON ENR': 'DIVERS'
};

// Parser une date Excel ou string
function parseExcelDate(value) {
  if (!value) return null;
  
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  
  if (typeof value === 'number') {
    // Excel serial date
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    return isNaN(date.getTime()) ? null : date;
  }
  
  if (typeof value === 'string') {
    // Try parsing directly
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed;
    
    // Try French date formats
    const frenchMonths = {
      'janvier': 0, 'février': 1, 'fevrier': 1, 'mars': 2, 'avril': 3, 
      'mai': 4, 'juin': 5, 'juillet': 6, 'août': 7, 'aout': 7,
      'septembre': 8, 'octobre': 9, 'novembre': 10, 'décembre': 11, 'decembre': 11,
      'janv': 0, 'févr': 1, 'fevr': 1, 'avr': 3, 'juil': 6, 
      'sept': 8, 'oct': 9, 'nov': 10, 'déc': 11, 'dec': 11
    };
    
    const match = value.match(/(\d{1,2})[\s\-\.\/](\w+)[\s\-\.\/]?(\d{2,4})?/i);
    if (match) {
      const day = parseInt(match[1]);
      const monthStr = match[2].toLowerCase();
      const year = match[3] ? parseInt(match[3]) : new Date().getFullYear();
      const month = frenchMonths[monthStr];
      if (month !== undefined) {
        const fullYear = year < 100 ? (year > 50 ? 1900 + year : 2000 + year) : year;
        return new Date(fullYear, month, day);
      }
    }
  }
  
  return null;
}

// Déterminer la structure d'une feuille
function detectSheetStructure(data, sheetName) {
  if (data.length === 0) return null;
  
  const firstRow = data[0];
  const columns = Object.keys(firstRow);
  
  // Feuilles avec en-têtes standards (VisNonComp, certaines autres)
  const hasMatriculeHeader = columns.some(c => 
    c.toString().toUpperCase().includes('MATRICULE')
  );
  
  if (hasMatriculeHeader) {
    return {
      type: 'HEADER',
      matriculeCol: columns.find(c => c.toString().toUpperCase().includes('MATRICULE')),
      dateCol: columns.find(c => c.toString().toUpperCase().includes('DATE') && c.toString().toUpperCase().includes('VISITE')),
      chantierCol: columns.find(c => c.toString().toUpperCase().includes('CHANTIER') || c.toString().toUpperCase().includes('FILIALE')),
      fonctionCol: columns.find(c => c.toString().toUpperCase() === 'FONCTION'),
      typeFonctionCol: columns.find(c => c.toString().toUpperCase().includes('TYPE') && c.toString().toUpperCase().includes('FONCTION'))
    };
  }
  
  // Feuilles avec format MEDECIN | DATE | MATRICULE | CHANTIER (pas d'en-têtes)
  // Vérifier si la 3ème colonne ressemble à un matricule (nombre)
  const thirdColValue = firstRow[columns[2]];
  if (typeof thirdColValue === 'number' || (typeof thirdColValue === 'string' && /^\d+$/.test(thirdColValue))) {
    return {
      type: 'NO_HEADER',
      medecinIdx: 0,
      dateIdx: 1,
      matriculeIdx: 2,
      chantierIdx: 3
    };
  }
  
  // Format NON ENR ou autre
  const matCol = columns.find(c => c.toString().toUpperCase() === 'MAT');
  if (matCol) {
    return {
      type: 'HEADER',
      matriculeCol: matCol,
      dateCol: columns.find(c => c.toString().toUpperCase().includes('DATE')),
      chantierCol: null,
      fonctionCol: null,
      typeFonctionCol: null
    };
  }
  
  return null;
}

async function importSheet(workbook, sheetName, existingMatricules, existingVisites) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { salaries: [], visites: [], errors: [] };
  
  const ville = VILLE_MAPPING[sheetName] || sheetName.toUpperCase();
  
  // Lire avec et sans en-têtes pour détecter le format
  const dataWithHeaders = XLSX.utils.sheet_to_json(sheet, { defval: null });
  const dataRaw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  
  if (dataWithHeaders.length === 0 && dataRaw.length === 0) {
    return { salaries: [], visites: [], errors: [`${sheetName}: Feuille vide`] };
  }
  
  const structure = detectSheetStructure(dataWithHeaders, sheetName);
  
  if (!structure) {
    return { salaries: [], visites: [], errors: [`${sheetName}: Structure non reconnue`] };
  }
  
  const salariesMap = new Map();
  const visitesMap = new Map();
  const errors = [];
  
  if (structure.type === 'NO_HEADER') {
    // Format sans en-têtes: utiliser dataRaw
    for (let i = 0; i < dataRaw.length; i++) {
      const row = dataRaw[i];
      if (!row || row.length < 4) continue;
      
      const matriculeRaw = row[structure.matriculeIdx];
      if (!matriculeRaw) continue;
      
      const matricule = matriculeRaw.toString().trim();
      if (!matricule || matricule === 'NaN' || matricule === '') continue;
      
      const dateVisite = parseExcelDate(row[structure.dateIdx]);
      const chantier = row[structure.chantierIdx]?.toString().trim() || null;
      
      // Ajouter/Mettre à jour le salarié
      if (!salariesMap.has(matricule)) {
        salariesMap.set(matricule, {
          matricule,
          chantier,
          ville,
          fonction: null,
          typeFonction: null,
          visites: []
        });
      }
      
      // Ajouter la visite si date valide
      if (dateVisite) {
        const dateKey = `${matricule}_${dateVisite.toISOString().split('T')[0]}`;
        if (!visitesMap.has(dateKey)) {
          visitesMap.set(dateKey, {
            matricule,
            dateVisite,
            chantier,
            ville
          });
          salariesMap.get(matricule).visites.push({ dateVisite, chantier });
        }
      }
    }
  } else {
    // Format avec en-têtes
    for (let i = 0; i < dataWithHeaders.length; i++) {
      const row = dataWithHeaders[i];
      
      const matriculeRaw = row[structure.matriculeCol];
      if (!matriculeRaw) continue;
      
      const matricule = matriculeRaw.toString().trim();
      if (!matricule || matricule === 'NaN' || matricule === '' || matricule.toUpperCase() === 'MATRICULE') continue;
      
      const dateVisite = parseExcelDate(row[structure.dateCol]);
      const chantier = structure.chantierCol ? row[structure.chantierCol]?.toString().trim() : null;
      const fonction = structure.fonctionCol ? row[structure.fonctionCol]?.toString().trim() : null;
      const typeFonction = structure.typeFonctionCol ? row[structure.typeFonctionCol]?.toString().trim() : null;
      
      // Ajouter/Mettre à jour le salarié
      if (!salariesMap.has(matricule)) {
        salariesMap.set(matricule, {
          matricule,
          chantier,
          ville,
          fonction,
          typeFonction,
          visites: []
        });
      } else {
        // Mettre à jour avec les infos les plus récentes
        const existing = salariesMap.get(matricule);
        if (fonction && !existing.fonction) existing.fonction = fonction;
        if (typeFonction && !existing.typeFonction) existing.typeFonction = typeFonction;
        if (chantier) existing.chantier = chantier; // Le dernier chantier
      }
      
      // Ajouter la visite si date valide
      if (dateVisite) {
        const dateKey = `${matricule}_${dateVisite.toISOString().split('T')[0]}`;
        if (!visitesMap.has(dateKey)) {
          visitesMap.set(dateKey, {
            matricule,
            dateVisite,
            chantier: chantier || ville,
            ville
          });
          salariesMap.get(matricule).visites.push({ dateVisite, chantier });
        }
      }
    }
  }
  
  // Filtrer les salariés déjà existants pour mise à jour
  const newSalaries = [];
  const updateSalaries = [];
  
  for (const [matricule, data] of salariesMap) {
    if (existingMatricules.has(matricule)) {
      updateSalaries.push(data);
    } else {
      newSalaries.push(data);
    }
  }
  
  // Filtrer les visites qui n'existent pas déjà
  const newVisites = [];
  for (const [key, visite] of visitesMap) {
    if (!existingVisites.has(key)) {
      newVisites.push(visite);
    }
  }
  
  return {
    sheetName,
    ville,
    newSalaries,
    updateSalaries,
    newVisites,
    errors,
    stats: {
      totalRows: structure.type === 'NO_HEADER' ? dataRaw.length : dataWithHeaders.length,
      uniqueSalaries: salariesMap.size,
      uniqueVisites: visitesMap.size
    }
  };
}

async function main() {
  const filePath = path.join('C:', 'Users', 'lenovo', 'Downloads', 'VM_Renouvellement(Récupération automatique).xlsx');
  
  console.log('🚀 IMPORT COMPLET DE TOUTES LES FEUILLES\n');
  console.log('='.repeat(60));
  
  // 1. Charger le fichier Excel
  console.log('\n📂 Chargement du fichier Excel...');
  const workbook = XLSX.readFile(filePath);
  console.log(`  Feuilles trouvées: ${workbook.SheetNames.join(', ')}`);
  
  // 2. Récupérer les données existantes
  console.log('\n🔍 Récupération des données existantes...');
  const existingSalaries = await prisma.salarie.findMany({
    select: { id: true, matricule: true }
  });
  const existingMatricules = new Map(existingSalaries.map(s => [s.matricule, s.id]));
  console.log(`  ${existingMatricules.size} salariés déjà en base`);
  
  const existingVisitesData = await prisma.visite.findMany({
    include: { salarie: { select: { matricule: true } } }
  });
  const existingVisites = new Set(
    existingVisitesData.map(v => `${v.salarie.matricule}_${v.dateVisite.toISOString().split('T')[0]}`)
  );
  console.log(`  ${existingVisites.size} visites déjà en base`);
  
  // 3. Feuilles à importer (exclure CASA déjà importée)
  const sheetsToImport = workbook.SheetNames.filter(name => name !== 'CASA');
  
  console.log(`\n📋 Feuilles à importer: ${sheetsToImport.length}`);
  
  // 4. Analyser toutes les feuilles
  console.log('\n📊 Analyse des feuilles...');
  const allResults = [];
  
  for (const sheetName of sheetsToImport) {
    const result = await importSheet(workbook, sheetName, existingMatricules, existingVisites);
    allResults.push(result);
    
    if (result.stats) {
      console.log(`  ${sheetName}: ${result.stats.uniqueSalaries} salariés, ${result.stats.uniqueVisites} visites`);
    } else if (result.errors.length > 0) {
      console.log(`  ${sheetName}: ⚠️ ${result.errors[0]}`);
    }
  }
  
  // 5. Consolider les données uniques
  console.log('\n🔄 Consolidation des données...');
  
  const globalSalariesMap = new Map();
  const globalVisitesMap = new Map();
  
  for (const result of allResults) {
    if (!result.newSalaries) continue;
    
    // Salariés
    for (const s of result.newSalaries) {
      if (!globalSalariesMap.has(s.matricule)) {
        globalSalariesMap.set(s.matricule, s);
      } else {
        // Fusionner les infos
        const existing = globalSalariesMap.get(s.matricule);
        if (s.fonction && !existing.fonction) existing.fonction = s.fonction;
        if (s.typeFonction && !existing.typeFonction) existing.typeFonction = s.typeFonction;
        if (s.chantier) existing.chantier = s.chantier;
      }
    }
    
    // Visites
    for (const v of result.newVisites) {
      const key = `${v.matricule}_${v.dateVisite.toISOString().split('T')[0]}`;
      if (!globalVisitesMap.has(key) && !existingVisites.has(key)) {
        globalVisitesMap.set(key, v);
      }
    }
  }
  
  console.log(`  Nouveaux salariés à créer: ${globalSalariesMap.size}`);
  console.log(`  Nouvelles visites à créer: ${globalVisitesMap.size}`);
  
  // 6. Créer les nouveaux salariés
  if (globalSalariesMap.size > 0) {
    console.log('\n📥 Création des nouveaux salariés...');
    const salariesToCreate = Array.from(globalSalariesMap.values()).map(s => ({
      matricule: s.matricule,
      fonction: s.fonction,
      typeFonction: s.typeFonction,
      chantier: s.chantier,
      ville: s.ville
    }));
    
    const batchSize = 500;
    for (let i = 0; i < salariesToCreate.length; i += batchSize) {
      const batch = salariesToCreate.slice(i, i + batchSize);
      await prisma.salarie.createMany({
        data: batch,
        skipDuplicates: true
      });
      console.log(`  ${Math.min(i + batchSize, salariesToCreate.length)}/${salariesToCreate.length} créés`);
    }
  }
  
  // 7. Récupérer tous les IDs de salariés
  console.log('\n🔍 Récupération des IDs...');
  const allSalaries = await prisma.salarie.findMany({
    select: { id: true, matricule: true }
  });
  const matriculeToId = new Map(allSalaries.map(s => [s.matricule, s.id]));
  console.log(`  ${matriculeToId.size} salariés en base`);
  
  // 8. Créer les visites
  if (globalVisitesMap.size > 0) {
    console.log('\n📥 Création des visites...');
    const visitesToCreate = [];
    
    for (const [key, v] of globalVisitesMap) {
      const salarieId = matriculeToId.get(v.matricule);
      if (!salarieId) continue;
      
      const dateVisiteProchaine = new Date(v.dateVisite);
      dateVisiteProchaine.setFullYear(dateVisiteProchaine.getFullYear() + 1);
      
      visitesToCreate.push({
        salarieId,
        dateVisite: v.dateVisite,
        dateVisiteProchaine,
        chantier: v.chantier,
        ville: v.ville,
        statut: 'EFFECTUEE'
      });
    }
    
    const batchSize = 500;
    for (let i = 0; i < visitesToCreate.length; i += batchSize) {
      const batch = visitesToCreate.slice(i, i + batchSize);
      await prisma.visite.createMany({
        data: batch,
        skipDuplicates: true
      });
      console.log(`  ${Math.min(i + batchSize, visitesToCreate.length)}/${visitesToCreate.length} créées`);
    }
  }
  
  // 9. Mettre à jour les salariés existants avec nouvelles infos
  console.log('\n🔄 Mise à jour des salariés existants...');
  let updated = 0;
  for (const result of allResults) {
    if (!result.updateSalaries) continue;
    
    for (const s of result.updateSalaries) {
      const salarieId = existingMatricules.get(s.matricule);
      if (!salarieId) continue;
      
      // Ne mettre à jour que si on a de nouvelles infos
      if (s.fonction || s.typeFonction || s.chantier) {
        await prisma.salarie.update({
          where: { id: salarieId },
          data: {
            fonction: s.fonction || undefined,
            typeFonction: s.typeFonction || undefined,
            chantier: s.chantier || undefined,
            ville: s.ville || undefined
          }
        });
        updated++;
      }
    }
  }
  console.log(`  ${updated} salariés mis à jour`);
  
  // 10. Statistiques finales
  console.log('\n' + '='.repeat(60));
  console.log('📈 RÉSULTAT FINAL');
  console.log('='.repeat(60));
  
  const [totalSalaries, totalVisites] = await Promise.all([
    prisma.salarie.count(),
    prisma.visite.count()
  ]);
  
  console.log(`\n  Total salariés en base: ${totalSalaries}`);
  console.log(`  Total visites en base: ${totalVisites}`);
  
  // Stats par ville
  console.log('\n📊 Répartition par ville:');
  const visitesByVille = await prisma.visite.groupBy({
    by: ['ville'],
    _count: { id: true }
  });
  
  visitesByVille
    .sort((a, b) => b._count.id - a._count.id)
    .forEach(v => {
      console.log(`  ${v.ville || 'N/A'}: ${v._count.id} visites`);
    });
  
  // Vérification des doublons
  console.log('\n🔍 Vérification des doublons...');
  const duplicateCheck = await prisma.$queryRaw`
    SELECT matricule, COUNT(*) as count 
    FROM salaries 
    GROUP BY matricule 
    HAVING COUNT(*) > 1
  `;
  
  if (duplicateCheck.length > 0) {
    console.log(`  ⚠️ ${duplicateCheck.length} matricules en doublon trouvés`);
  } else {
    console.log(`  ✅ Aucun doublon de matricule`);
  }
  
  // Exemples de salariés avec historique
  console.log('\n🔍 EXEMPLES DE SALARIÉS AVEC HISTORIQUE:');
  const examples = await prisma.salarie.findMany({
    where: {
      visites: { some: {} }
    },
    take: 5,
    include: {
      visites: {
        orderBy: { dateVisite: 'desc' }
      }
    }
  });
  
  for (const s of examples) {
    console.log(`\n  Matricule: ${s.matricule}`);
    console.log(`  Fonction: ${s.fonction || 'N/A'} | Type: ${s.typeFonction || 'N/A'}`);
    console.log(`  Ville: ${s.ville} | Chantier: ${s.chantier || 'N/A'}`);
    console.log(`  Visites (${s.visites.length}): ${s.visites.map(v => v.dateVisite.toLocaleDateString('fr-FR')).join(', ')}`);
  }
  
  console.log('\n✅ IMPORT TERMINÉ AVEC SUCCÈS!');
}

main()
  .catch(e => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
