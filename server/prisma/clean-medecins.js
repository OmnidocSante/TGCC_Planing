const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();

async function cleanMedecins() {
  console.log('👨‍⚕️ NETTOYAGE ET CRÉATION DES MÉDECINS\n');
  console.log('='.repeat(60));
  
  const filePath = path.join('C:', 'Users', 'lenovo', 'Downloads', 'VM_Renouvellement(Récupération automatique).xlsx');
  const workbook = XLSX.readFile(filePath);
  
  // Map pour stocker les médecins et leurs villes
  const medecinsMap = new Map();
  
  // Mapping pour normaliser les noms (variantes d'orthographe)
  const nameNormalization = {
    'ZOUEHIR': 'ZOUHEIR',
    'ZOUEHEIR': 'ZOUHEIR',
    'ZOUHAIR OUSAID': 'ZOUHEIR',
    'HARAG': 'HARRAG',
    'DIOUIRI': 'DIOURI',
    'BENANI': 'BENNANI',
    'MMOUBTASSIM': 'MOUBTASSIM',
    'MOUBTASSIM29-10': 'MOUBTASSIM',
    'MOUBTASSIM HASNA': 'MOUBTASSIM',
    'DR LATIF': 'LATIF',
    'JALAL KHAIRI': 'JALAL',
    'SAID LATIFDRISSI': 'LATIF',
    'ADIL BAHTAT': 'BEHTAT'
  };
  
  // Noms à ignorer (pas des vrais médecins)
  const invalidNames = [
    'DOCTEUR', 'LISTE', 'CIN', 'PREFA', 'VISITE', 'MÉDICALE',
    '1-', '2-', '3-', '4-', '5-', '6-', '7-', '8-', '9-', '10-', '11-', '12-'
  ];
  
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
  
  console.log('📂 Extraction depuis les feuilles...\n');
  
  for (const sheetName of sheetsWithMedecin) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    const ville = villeNormalize[sheetName] || sheetName.toUpperCase();
    
    for (const row of data) {
      if (!row || row.length < 4) continue;
      
      const medecinRaw = row[0];
      if (!medecinRaw || typeof medecinRaw !== 'string') continue;
      
      // Nettoyer le nom du médecin
      let medecinNom = medecinRaw.toString().trim().toUpperCase();
      
      // Vérifier si c'est un nom invalide
      let isInvalid = false;
      for (const invalid of invalidNames) {
        if (medecinNom.includes(invalid)) {
          isInvalid = true;
          break;
        }
      }
      if (isInvalid) continue;
      
      // Ignorer les noms trop courts ou vides
      if (!medecinNom || medecinNom.length < 3) continue;
      
      // Ignorer les noms qui sont des nombres
      if (/^\d+$/.test(medecinNom)) continue;
      
      // Ignorer les noms qui contiennent "NAN" seul
      if (medecinNom === 'NAN' || medecinNom === 'NULL') continue;
      
      // Normaliser le nom si nécessaire
      if (nameNormalization[medecinNom]) {
        medecinNom = nameNormalization[medecinNom];
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
    }
  }
  
  // Convertir en array et trier par nombre de visites
  const medecins = Array.from(medecinsMap.values())
    .map(m => ({
      nom: m.nom,
      villes: Array.from(m.villes),
      count: m.count
    }))
    .filter(m => m.count >= 5) // Garder seulement les médecins avec au moins 5 visites
    .sort((a, b) => b.count - a.count);
  
  console.log('📋 MÉDECINS VALIDES TROUVÉS:');
  console.log('-'.repeat(60));
  console.log(`Total: ${medecins.length} médecins\n`);
  
  medecins.forEach((m, i) => {
    console.log(`  ${(i+1).toString().padStart(2)}. Dr. ${m.nom.padEnd(20)} - ${m.count.toString().padStart(5)} visites - Villes: ${m.villes.join(', ')}`);
  });
  
  // Supprimer les médecins existants
  console.log('\n🗑️ Suppression des médecins existants...');
  await prisma.medecin.deleteMany({});
  
  // Insérer les nouveaux médecins nettoyés
  console.log('📥 Insertion des médecins nettoyés...\n');
  
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
  
  // Afficher la liste finale
  console.log('\n' + '='.repeat(60));
  console.log('📋 LISTE FINALE DES MÉDECINS:');
  console.log('='.repeat(60));
  
  const medecinsList = await prisma.medecin.findMany({
    orderBy: { nom: 'asc' }
  });
  
  console.log('\n| # | Nom | Villes assignées |');
  console.log('|---|-----|------------------|');
  medecinsList.forEach((m, i) => {
    const villes = JSON.parse(m.villes || '[]');
    console.log(`| ${i+1} | Dr. ${m.nom} | ${villes.join(', ')} |`);
  });
}

cleanMedecins()
  .catch(e => console.error('Erreur:', e))
  .finally(() => prisma.$disconnect());
