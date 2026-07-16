const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();

async function analyzeCasaSheet() {
  const filePath = path.join('C:', 'Users', 'lenovo', 'Downloads', 'VM_Renouvellement(Récupération automatique).xlsx');
  
  console.log('📂 Lecture du fichier...');
  const workbook = XLSX.readFile(filePath);
  
  const sheet = workbook.Sheets['CASA'];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  
  console.log('\n📋 ANALYSE DE LA FEUILLE CASA');
  console.log('='.repeat(50));
  console.log('Nombre de lignes:', data.length);
  console.log('\nPremières lignes (structure):');
  
  for (let i = 0; i < Math.min(5, data.length); i++) {
    console.log(`Ligne ${i}:`, data[i]);
  }
  
  console.log('\nTypes des colonnes (ligne 0):');
  if (data[0]) {
    data[0].forEach((val, idx) => {
      console.log(`  Col ${idx}: ${typeof val} = ${val}`);
    });
  }
}

async function deleteCasaData() {
  console.log('\n🗑️ SUPPRESSION DES DONNÉES CASA');
  console.log('='.repeat(50));
  
  // Supprimer les visites CASA
  const deletedVisites = await prisma.visite.deleteMany({
    where: { ville: 'CASA' }
  });
  console.log('Visites CASA supprimées:', deletedVisites.count);
  
  // Supprimer aussi les visites CASABLANCA et SIEGE
  const deletedVisites2 = await prisma.visite.deleteMany({
    where: { 
      OR: [
        { ville: 'CASABLANCA' },
        { ville: 'SIEGE' },
        { ville: { contains: 'CASA' } }
      ]
    }
  });
  console.log('Visites CASABLANCA/SIEGE supprimées:', deletedVisites2.count);
  
  // Supprimer les salariés sans visites
  const salariesSansVisites = await prisma.salarie.findMany({
    where: {
      visites: { none: {} }
    },
    select: { id: true }
  });
  
  if (salariesSansVisites.length > 0) {
    const deletedSalaries = await prisma.salarie.deleteMany({
      where: {
        id: { in: salariesSansVisites.map(s => s.id) }
      }
    });
    console.log('Salariés sans visites supprimés:', deletedSalaries.count);
  }
  
  // Stats restantes
  const [salarieCount, visiteCount] = await Promise.all([
    prisma.salarie.count(),
    prisma.visite.count()
  ]);
  console.log('\n📈 ÉTAT APRÈS SUPPRESSION:');
  console.log('  Salariés restants:', salarieCount);
  console.log('  Visites restantes:', visiteCount);
}

async function importCasaFixed() {
  const filePath = path.join('C:', 'Users', 'lenovo', 'Downloads', 'VM_Renouvellement(Récupération automatique).xlsx');
  
  console.log('\n📥 IMPORT CORRIGÉ DE CASA');
  console.log('='.repeat(50));
  
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets['CASA'];
  
  // Lire sans en-têtes (header: 1 = array of arrays)
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  
  console.log('Lignes à traiter:', data.length);
  
  // Format CASA: [MEDECIN, DATE, MATRICULE, CHANTIER, ...]
  // La première ligne EST une donnée, pas un en-tête
  
  let created = 0;
  let updated = 0;
  let visites = 0;
  let errors = [];
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 4) continue;
    
    try {
      const medecin = row[0];
      const dateValue = row[1];
      const matriculeRaw = row[2];
      const chantier = row[3];
      
      // Valider le matricule
      if (!matriculeRaw || matriculeRaw === null) continue;
      const matricule = matriculeRaw.toString().trim();
      if (!matricule || matricule === '' || matricule === 'NaN') continue;
      
      // Parser la date
      let dateVisite = null;
      if (dateValue) {
        if (dateValue instanceof Date) {
          dateVisite = dateValue;
        } else if (typeof dateValue === 'number') {
          // Excel date serial number
          const excelEpoch = new Date(1899, 11, 30);
          dateVisite = new Date(excelEpoch.getTime() + dateValue * 86400000);
        } else if (typeof dateValue === 'string') {
          dateVisite = new Date(dateValue);
        }
      }
      
      if (!dateVisite || isNaN(dateVisite.getTime())) continue;
      
      // Créer ou mettre à jour le salarié
      let salarie = await prisma.salarie.findUnique({
        where: { matricule }
      });
      
      if (!salarie) {
        salarie = await prisma.salarie.create({
          data: {
            matricule,
            chantier: chantier?.toString() || null,
            ville: 'CASA'
          }
        });
        created++;
      } else {
        // Ne pas écraser le chantier si déjà défini (le salarié peut changer de chantier)
        updated++;
      }
      
      // Vérifier si cette visite existe déjà (même jour)
      const startOfDay = new Date(dateVisite);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(dateVisite);
      endOfDay.setHours(23, 59, 59, 999);
      
      const existingVisite = await prisma.visite.findFirst({
        where: {
          salarieId: salarie.id,
          dateVisite: {
            gte: startOfDay,
            lte: endOfDay
          }
        }
      });
      
      if (!existingVisite) {
        const dateVisiteProchaine = new Date(dateVisite);
        dateVisiteProchaine.setFullYear(dateVisiteProchaine.getFullYear() + 1);
        
        await prisma.visite.create({
          data: {
            salarieId: salarie.id,
            dateVisite,
            dateVisiteProchaine,
            chantier: chantier?.toString() || null,
            ville: 'CASA',
            statut: 'EFFECTUEE'
          }
        });
        visites++;
      }
      
      // Progress every 500 rows
      if ((i + 1) % 500 === 0) {
        console.log(`  Progression: ${i + 1}/${data.length} lignes...`);
      }
      
    } catch (err) {
      errors.push(`Ligne ${i}: ${err.message}`);
    }
  }
  
  console.log('\n✅ IMPORT CASA TERMINÉ');
  console.log('  Nouveaux salariés:', created);
  console.log('  Salariés mis à jour:', updated);
  console.log('  Visites créées:', visites);
  
  if (errors.length > 0) {
    console.log(`  Erreurs: ${errors.length}`);
  }
  
  // Vérification
  const [totalSalaries, totalVisites] = await Promise.all([
    prisma.salarie.count(),
    prisma.visite.count()
  ]);
  
  console.log('\n📈 ÉTAT FINAL:');
  console.log('  Total salariés:', totalSalaries);
  console.log('  Total visites:', totalVisites);
  
  // Vérifier quelques exemples avec leurs dates
  const examples = await prisma.salarie.findMany({
    where: { ville: 'CASA' },
    take: 5,
    include: {
      visites: {
        orderBy: { dateVisite: 'desc' },
        take: 1
      }
    }
  });
  
  console.log('\n🔍 EXEMPLES DE SALARIÉS CASA:');
  examples.forEach(s => {
    const derniere = s.visites[0];
    console.log(`  ${s.matricule} - Chantier: ${s.chantier} - Dernière visite: ${derniere ? derniere.dateVisite.toLocaleDateString('fr-FR') : 'Aucune'}`);
  });
}

async function main() {
  console.log('🔧 CORRECTION DE L\'IMPORT CASA\n');
  
  // 1. Analyser la structure
  await analyzeCasaSheet();
  
  // 2. Supprimer les données CASA
  await deleteCasaData();
  
  // 3. Réimporter avec la correction
  await importCasaFixed();
}

main()
  .catch(e => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
