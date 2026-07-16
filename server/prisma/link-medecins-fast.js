const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');

const prisma = new PrismaClient();

const EXCEL_FILE = 'C:\\Users\\lenovo\\Downloads\\VM_Renouvellement(Récupération automatique).xlsx';

function normalizeName(name) {
  if (!name || typeof name !== 'string') return null;
  return name.toString().trim().toUpperCase()
    .replace(/^DR\.?\s*/i, '')
    .replace(/^DOCTEUR\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  console.log('=== Liaison rapide des médecins (SQL direct) ===\n');
  console.time('Total');

  // 1. Charger les médecins
  const medecins = await prisma.medecin.findMany();
  console.log(`Médecins: ${medecins.length}`);

  const medecinMap = new Map();
  medecins.forEach(m => {
    medecinMap.set(normalizeName(m.nom), m.id);
    if (m.prenom) {
      medecinMap.set(normalizeName(`${m.nom} ${m.prenom}`), m.id);
    }
  });

  // 2. Lire Excel et construire la map matricule -> médecin
  console.log('\nLecture Excel...');
  console.time('Excel');
  const workbook = XLSX.readFile(EXCEL_FILE);
  
  const matriculeMedecin = new Map(); // matricule -> medecinName
  
  for (const sheetName of workbook.SheetNames) {
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' });
    if (data.length < 2) continue;

    // Colonnes: 0=medecin, 1=date, 2=matricule (format standard)
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row.length < 3) continue;
      
      const matricule = String(row[2] || '').trim();
      const medecinName = String(row[0] || '').trim();
      
      if (matricule.length >= 3 && medecinName.length >= 2) {
        matriculeMedecin.set(matricule, medecinName);
      }
    }
  }
  console.timeEnd('Excel');
  console.log(`Matricules avec médecin: ${matriculeMedecin.size}`);

  // 3. Récupérer tous les salariés avec leurs matricules
  console.log('\nChargement des salariés...');
  console.time('Salaries');
  const salaries = await prisma.salarie.findMany({
    select: { id: true, matricule: true }
  });
  console.timeEnd('Salaries');
  
  const salarieMap = new Map();
  salaries.forEach(s => salarieMap.set(s.matricule, s.id));
  console.log(`Salariés: ${salaries.length}`);

  // 4. Construire les données pour la mise à jour en masse
  console.log('\nPréparation mise à jour...');
  console.time('Prep');
  
  const updates = [];
  
  for (const [matricule, medecinName] of matriculeMedecin) {
    const salarieId = salarieMap.get(matricule);
    if (!salarieId) continue;
    
    const normalizedName = normalizeName(medecinName);
    let medecinId = null;
    
    // Match exact
    if (medecinMap.has(normalizedName)) {
      medecinId = medecinMap.get(normalizedName);
    } else {
      // Match partiel
      for (const [name, id] of medecinMap) {
        if (normalizedName.includes(name) || name.includes(normalizedName)) {
          medecinId = id;
          break;
        }
      }
    }
    
    updates.push({ salarieId, medecinName, medecinId });
  }
  console.timeEnd('Prep');
  console.log(`Updates préparées: ${updates.length}`);

  // 5. Mise à jour SQL directe par lots
  console.log('\nMise à jour en base (SQL)...');
  console.time('Update');
  
  // Construire une grosse requête CASE WHEN
  const batchSize = 2000;
  let totalUpdated = 0;
  
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    
    // Séparer les updates avec et sans medecinId
    const withId = batch.filter(u => u.medecinId);
    const withoutId = batch.filter(u => !u.medecinId);
    
    // Update medecinNom pour tous
    const salarieIds = batch.map(u => u.salarieId);
    
    // Construire CASE pour medecinNom
    let caseNom = 'CASE salarie_id';
    batch.forEach(u => {
      const escapedName = u.medecinName.replace(/'/g, "''");
      caseNom += ` WHEN ${u.salarieId} THEN '${escapedName}'`;
    });
    caseNom += ' ELSE medecin_nom END';
    
    // Construire CASE pour medecinId
    let caseId = 'CASE salarie_id';
    batch.forEach(u => {
      caseId += ` WHEN ${u.salarieId} THEN ${u.medecinId || 'NULL'}`;
    });
    caseId += ' ELSE medecin_id END';
    
    // Exécuter la requête
    const query = `
      UPDATE visites 
      SET medecin_nom = ${caseNom},
          medecin_id = ${caseId}
      WHERE salarie_id IN (${salarieIds.join(',')})
    `;
    
    try {
      const result = await prisma.$executeRawUnsafe(query);
      totalUpdated += result;
    } catch (err) {
      console.error(`Erreur batch ${i}: ${err.message}`);
    }
    
    process.stdout.write(`\rProgress: ${Math.min(i + batchSize, updates.length)}/${updates.length}`);
  }
  
  console.timeEnd('Update');
  console.log(`\nVisites mises à jour: ${totalUpdated}`);

  // 6. Vérification
  console.log('\n=== Vérification ===');
  const withMedecin = await prisma.visite.count({ where: { medecinId: { not: null } } });
  const withNom = await prisma.visite.count({ where: { medecinNom: { not: null } } });
  const total = await prisma.visite.count();
  
  console.log(`Total visites: ${total}`);
  console.log(`Avec medecinId: ${withMedecin} (${Math.round(withMedecin/total*100)}%)`);
  console.log(`Avec medecinNom: ${withNom} (${Math.round(withNom/total*100)}%)`);
  
  console.timeEnd('Total');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
