const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();

async function importSafi() {
  console.log('📥 IMPORT DE SAFI\n');
  
  const filePath = path.join('C:', 'Users', 'lenovo', 'Downloads', 'VM_Renouvellement(Récupération automatique).xlsx');
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets['SAFI'];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  
  console.log('Lignes à traiter:', data.length);
  
  // Structure SAFI: [DATE, MATRICULE, CHANTIER]
  const salariesMap = new Map();
  const visitesMap = new Map();
  
  for (const row of data) {
    if (!row || row.length < 3) continue;
    
    const dateValue = row[0];
    const matriculeRaw = row[1];
    const chantier = row[2]?.toString().trim() || 'SAFI';
    
    if (!matriculeRaw) continue;
    const matricule = matriculeRaw.toString().trim();
    if (!matricule || matricule === 'NaN') continue;
    
    // Parser date Excel
    let dateVisite = null;
    if (typeof dateValue === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      dateVisite = new Date(excelEpoch.getTime() + dateValue * 86400000);
    }
    
    if (!dateVisite || isNaN(dateVisite.getTime())) continue;
    
    // Salarié
    if (!salariesMap.has(matricule)) {
      salariesMap.set(matricule, { matricule, chantier, ville: 'SAFI' });
    }
    
    // Visite
    const dateKey = matricule + '_' + dateVisite.toISOString().split('T')[0];
    if (!visitesMap.has(dateKey)) {
      visitesMap.set(dateKey, { matricule, dateVisite, chantier, ville: 'SAFI' });
    }
  }
  
  console.log('Salariés uniques:', salariesMap.size);
  console.log('Visites uniques:', visitesMap.size);
  
  // Récupérer existants
  const existing = await prisma.salarie.findMany({ select: { id: true, matricule: true }});
  const existingMap = new Map(existing.map(s => [s.matricule, s.id]));
  
  // Créer nouveaux salariés
  const newSalaries = [];
  for (const [mat, s] of salariesMap) {
    if (!existingMap.has(mat)) {
      newSalaries.push(s);
    }
  }
  
  if (newSalaries.length > 0) {
    await prisma.salarie.createMany({ data: newSalaries, skipDuplicates: true });
    console.log('Nouveaux salariés créés:', newSalaries.length);
  }
  
  // Récupérer tous les IDs
  const all = await prisma.salarie.findMany({ select: { id: true, matricule: true }});
  const matToId = new Map(all.map(s => [s.matricule, s.id]));
  
  // Vérifier visites existantes
  const existingVisites = await prisma.visite.findMany({
    where: { ville: 'SAFI' },
    include: { salarie: { select: { matricule: true }}}
  });
  const existingVisiteKeys = new Set(existingVisites.map(v => v.salarie.matricule + '_' + v.dateVisite.toISOString().split('T')[0]));
  
  // Créer visites
  const visitesToCreate = [];
  for (const [key, v] of visitesMap) {
    if (existingVisiteKeys.has(key)) continue;
    const salarieId = matToId.get(v.matricule);
    if (!salarieId) continue;
    
    const dateVisiteProchaine = new Date(v.dateVisite);
    dateVisiteProchaine.setFullYear(dateVisiteProchaine.getFullYear() + 1);
    
    visitesToCreate.push({
      salarieId,
      dateVisite: v.dateVisite,
      dateVisiteProchaine,
      chantier: v.chantier,
      ville: 'SAFI',
      statut: 'EFFECTUEE'
    });
  }
  
  if (visitesToCreate.length > 0) {
    await prisma.visite.createMany({ data: visitesToCreate, skipDuplicates: true });
    console.log('Nouvelles visites créées:', visitesToCreate.length);
  } else {
    console.log('Aucune nouvelle visite à créer (déjà importées)');
  }
  
  // Stats finales
  const [totalS, totalV] = await Promise.all([
    prisma.salarie.count(),
    prisma.visite.count()
  ]);
  console.log('\n📈 TOTAL FINAL: ' + totalS + ' salariés, ' + totalV + ' visites');
  
  // Stats SAFI
  const safiVisites = await prisma.visite.count({ where: { ville: 'SAFI' }});
  console.log('Visites SAFI: ' + safiVisites);
}

importSafi()
  .catch(e => console.error('Erreur:', e))
  .finally(() => prisma.$disconnect());
