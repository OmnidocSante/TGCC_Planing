const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();

async function extractMedecins() {
  console.log('👨‍⚕️ EXTRACTION DES MÉDECINS DEPUIS LES DONNÉES\n');
  console.log('='.repeat(60));
  
  const filePath = path.join('C:', 'Users', 'lenovo', 'Downloads', 'VM_Renouvellement(Récupération automatique).xlsx');
  const workbook = XLSX.readFile(filePath);
  
  // Map pour stocker les médecins et leurs villes
  const medecinsMap = new Map();
  
  // Feuilles avec format [MEDECIN, DATE, MATRICULE, CHANTIER]
  const sheetsWithMedecin = [
    'CASA', 'RABAT', 'KENITRA', 'BENGUERIR', 'MARRAKECH', 'BENI MELLAL',
    'YOUSSOUFIA', 'JORF', 'Khemissat', 'FES', 'Agadir', 'HOUCEIMA',
    'TANGER', 'TETOUANE', 'NADOR', 'LARACHE', 'ERRACHIDIA', 'FILIALES'
  ];
  
  // Mapping ville normalisée
  const villeNormalize = {
    'CASA': 'CASABLANCA',
    'Khemissat': 'KHEMISSAT',
    'Agadir': 'AGADIR',
    'FILIALES': 'CASABLANCA'
  };
  
  console.log('\n📂 Extraction depuis les feuilles...\n');
  
  for (const sheetName of sheetsWithMedecin) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    const ville = villeNormalize[sheetName] || sheetName.toUpperCase();
    
    let count = 0;
    for (const row of data) {
      if (!row || row.length < 4) continue;
      
      const medecinRaw = row[0];
      if (!medecinRaw || typeof medecinRaw !== 'string') continue;
      
      // Nettoyer le nom du médecin
      let medecinNom = medecinRaw.toString().trim().toUpperCase();
      
      // Ignorer les valeurs invalides
      if (!medecinNom || 
          medecinNom === 'NAN' || 
          medecinNom === 'NULL' ||
          medecinNom === 'MÉDECIN' ||
          medecinNom === 'MEDECIN' ||
          medecinNom.length < 2 ||
          /^\d+$/.test(medecinNom)) {
        continue;
      }
      
      // Ajouter ou mettre à jour le médecin
      if (!medecinsMap.has(medecinNom)) {
        medecinsMap.set(medecinNom, {
          nom: medecinNom,
          villes: new Set([ville]),
          count: 1
        });
      } else {
        medecinsMap.get(medecinNom).villes.add(ville);
        medecinsMap.get(medecinNom).count++;
      }
      count++;
    }
    
    console.log(`  ${sheetName}: ${count} entrées traitées`);
  }
  
  // Aussi vérifier la feuille NON ENR qui a un format différent
  const nonEnrSheet = workbook.Sheets['NON ENR'];
  if (nonEnrSheet) {
    const data = XLSX.utils.sheet_to_json(nonEnrSheet, { defval: null });
    for (const row of data) {
      const docteur = row['Docteur'] || row['Unnamed: 0'];
      if (docteur && typeof docteur === 'string') {
        const medecinNom = docteur.trim().toUpperCase();
        if (medecinNom && medecinNom !== 'DOCTEUR' && medecinNom.length > 2) {
          if (!medecinsMap.has(medecinNom)) {
            medecinsMap.set(medecinNom, {
              nom: medecinNom,
              villes: new Set(['DIVERS']),
              count: 1
            });
          } else {
            medecinsMap.get(medecinNom).count++;
          }
        }
      }
    }
  }
  
  // Convertir en array et trier par nombre de visites
  const medecins = Array.from(medecinsMap.values())
    .map(m => ({
      nom: m.nom,
      villes: Array.from(m.villes),
      count: m.count
    }))
    .sort((a, b) => b.count - a.count);
  
  console.log('\n📋 MÉDECINS TROUVÉS:');
  console.log('-'.repeat(60));
  console.log(`Total: ${medecins.length} médecins uniques\n`);
  
  medecins.forEach((m, i) => {
    console.log(`  ${(i+1).toString().padStart(2)}. Dr. ${m.nom.padEnd(15)} - ${m.count.toString().padStart(5)} visites - Villes: ${m.villes.join(', ')}`);
  });
  
  // Nettoyer la table médecins existante (sauf si on veut garder les anciens)
  console.log('\n🗑️ Suppression des médecins existants...');
  await prisma.medecin.deleteMany({});
  
  // Insérer les nouveaux médecins
  console.log('📥 Insertion des médecins...\n');
  
  for (const m of medecins) {
    await prisma.medecin.create({
      data: {
        nom: m.nom,
        prenom: null,
        villes: JSON.stringify(m.villes),
        telephone: null,
        email: null,
        actif: true
      }
    });
  }
  
  console.log(`✅ ${medecins.length} médecins créés dans la base`);
  
  // Vérification finale
  const totalMedecins = await prisma.medecin.count();
  console.log('\n📊 RÉSULTAT FINAL:');
  console.log(`  Total médecins en base: ${totalMedecins}`);
  
  // Afficher la liste finale
  const medecinsList = await prisma.medecin.findMany({
    orderBy: { nom: 'asc' }
  });
  
  console.log('\n📋 LISTE DES MÉDECINS EN BASE:');
  console.log('-'.repeat(60));
  medecinsList.forEach((m, i) => {
    const villes = JSON.parse(m.villes || '[]');
    console.log(`  ${(i+1).toString().padStart(2)}. Dr. ${m.nom.padEnd(15)} - Villes: ${villes.join(', ')}`);
  });
}

extractMedecins()
  .catch(e => console.error('Erreur:', e))
  .finally(() => prisma.$disconnect());
