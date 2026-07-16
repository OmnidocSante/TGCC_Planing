const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const filePath = path.join('C:', 'Users', 'lenovo', 'Downloads', 'VM_Renouvellement(Récupération automatique).xlsx');
  
  console.log('🔧 IMPORT RAPIDE CASA\n');
  
  // 1. Supprimer toutes les données CASA existantes
  console.log('🗑️ Suppression des données CASA existantes...');
  await prisma.visite.deleteMany({
    where: { 
      OR: [
        { ville: 'CASA' },
        { ville: 'CASABLANCA' },
        { ville: { contains: 'SIEGE' } }
      ]
    }
  });
  
  // Supprimer salariés CASA sans visites
  const orphans = await prisma.salarie.findMany({
    where: { visites: { none: {} } },
    select: { id: true }
  });
  if (orphans.length > 0) {
    await prisma.salarie.deleteMany({
      where: { id: { in: orphans.map(o => o.id) } }
    });
  }
  console.log('✅ Données CASA supprimées\n');
  
  // 2. Lire le fichier Excel
  console.log('📂 Lecture du fichier Excel...');
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets['CASA'];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  console.log(`  ${data.length} lignes trouvées\n`);
  
  // 3. Parser et organiser les données
  console.log('📊 Parsing des données...');
  
  const salariesMap = new Map(); // matricule -> { chantier, visites: [{date, chantier}] }
  
  for (const row of data) {
    if (!row || row.length < 4) continue;
    
    const dateValue = row[1];
    const matriculeRaw = row[2];
    const chantier = row[3]?.toString().trim() || null;
    
    if (!matriculeRaw) continue;
    const matricule = matriculeRaw.toString().trim();
    if (!matricule || matricule === 'NaN') continue;
    
    // Parser la date Excel
    let dateVisite = null;
    if (typeof dateValue === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      dateVisite = new Date(excelEpoch.getTime() + dateValue * 86400000);
    } else if (dateValue instanceof Date) {
      dateVisite = dateValue;
    }
    
    if (!dateVisite || isNaN(dateVisite.getTime())) continue;
    
    // Grouper par salarié
    if (!salariesMap.has(matricule)) {
      salariesMap.set(matricule, {
        chantier,
        visites: []
      });
    }
    
    const salarie = salariesMap.get(matricule);
    // Le dernier chantier connu est le plus récent
    salarie.visites.push({ date: dateVisite, chantier });
  }
  
  console.log(`  ${salariesMap.size} salariés uniques trouvés\n`);
  
  // 4. Récupérer les salariés existants
  console.log('🔍 Vérification des salariés existants...');
  const existingMatricules = await prisma.salarie.findMany({
    select: { id: true, matricule: true }
  });
  const existingMap = new Map(existingMatricules.map(s => [s.matricule, s.id]));
  console.log(`  ${existingMap.size} salariés déjà en base\n`);
  
  // 5. Créer les nouveaux salariés
  const newSalaries = [];
  for (const [matricule, data] of salariesMap) {
    if (!existingMap.has(matricule)) {
      // Trouver le chantier le plus récent
      const lastVisite = data.visites.sort((a, b) => b.date - a.date)[0];
      newSalaries.push({
        matricule,
        chantier: lastVisite?.chantier || data.chantier,
        ville: 'CASA'
      });
    }
  }
  
  if (newSalaries.length > 0) {
    console.log(`📥 Création de ${newSalaries.length} nouveaux salariés...`);
    
    // Insérer par lots de 500
    const batchSize = 500;
    for (let i = 0; i < newSalaries.length; i += batchSize) {
      const batch = newSalaries.slice(i, i + batchSize);
      await prisma.salarie.createMany({
        data: batch,
        skipDuplicates: true
      });
      console.log(`  ${Math.min(i + batchSize, newSalaries.length)}/${newSalaries.length} salariés créés`);
    }
    console.log('✅ Salariés créés\n');
  }
  
  // 6. Récupérer tous les IDs de salariés
  console.log('🔍 Récupération des IDs salariés...');
  const allSalaries = await prisma.salarie.findMany({
    select: { id: true, matricule: true }
  });
  const matriculeToId = new Map(allSalaries.map(s => [s.matricule, s.id]));
  console.log(`  ${matriculeToId.size} salariés en base\n`);
  
  // 7. Préparer les visites
  console.log('📅 Préparation des visites...');
  const visitesToCreate = [];
  
  for (const [matricule, data] of salariesMap) {
    const salarieId = matriculeToId.get(matricule);
    if (!salarieId) continue;
    
    // Dédupliquer par date (garder une seule visite par jour)
    const visitesParJour = new Map();
    for (const visite of data.visites) {
      const dateKey = visite.date.toISOString().split('T')[0];
      if (!visitesParJour.has(dateKey)) {
        visitesParJour.set(dateKey, visite);
      }
    }
    
    for (const visite of visitesParJour.values()) {
      const dateVisiteProchaine = new Date(visite.date);
      dateVisiteProchaine.setFullYear(dateVisiteProchaine.getFullYear() + 1);
      
      visitesToCreate.push({
        salarieId,
        dateVisite: visite.date,
        dateVisiteProchaine,
        chantier: visite.chantier,
        ville: 'CASA',
        statut: 'EFFECTUEE'
      });
    }
  }
  
  console.log(`  ${visitesToCreate.length} visites à créer\n`);
  
  // 8. Insérer les visites par lots
  console.log('📥 Insertion des visites...');
  const batchSize = 500;
  for (let i = 0; i < visitesToCreate.length; i += batchSize) {
    const batch = visitesToCreate.slice(i, i + batchSize);
    await prisma.visite.createMany({
      data: batch,
      skipDuplicates: true
    });
    console.log(`  ${Math.min(i + batchSize, visitesToCreate.length)}/${visitesToCreate.length} visites insérées`);
  }
  console.log('✅ Visites créées\n');
  
  // 9. Statistiques finales
  console.log('📈 RÉSULTAT FINAL');
  console.log('='.repeat(50));
  const [totalS, totalV] = await Promise.all([
    prisma.salarie.count(),
    prisma.visite.count()
  ]);
  console.log(`Total salariés: ${totalS}`);
  console.log(`Total visites: ${totalV}`);
  
  // Exemples avec dates
  console.log('\n🔍 EXEMPLES DE SALARIÉS CASA:');
  const examples = await prisma.salarie.findMany({
    where: { ville: 'CASA' },
    take: 10,
    include: {
      visites: {
        orderBy: { dateVisite: 'desc' }
      }
    }
  });
  
  for (const s of examples) {
    console.log(`\n  Matricule: ${s.matricule}`);
    console.log(`  Chantier: ${s.chantier}`);
    console.log(`  Nombre de visites: ${s.visites.length}`);
    if (s.visites.length > 0) {
      console.log(`  Dernière visite: ${s.visites[0].dateVisite.toLocaleDateString('fr-FR')}`);
      if (s.visites.length > 1) {
        console.log(`  Historique: ${s.visites.map(v => v.dateVisite.toLocaleDateString('fr-FR')).join(', ')}`);
      }
    }
  }
}

main()
  .catch(e => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
