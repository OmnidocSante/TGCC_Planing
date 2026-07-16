const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();

const parseDate = (value) => {
  if (!value) return null;
  
  if (value instanceof Date) {
    return value;
  }
  
  if (typeof value === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + value * 86400000);
  }
  
  if (typeof value === 'string') {
    const frenchMonths = {
      'janvier': 0, 'février': 1, 'mars': 2, 'avril': 3, 'mai': 4, 'juin': 5,
      'juillet': 6, 'août': 7, 'septembre': 8, 'octobre': 9, 'novembre': 10, 'décembre': 11,
      'janv': 0, 'févr': 1, 'avr': 3, 'juil': 6, 'sept': 8, 'oct': 9, 'nov': 10, 'déc': 11
    };
    
    const frenchDateMatch = value.match(/(\d{1,2})[- ](\w+)/i);
    if (frenchDateMatch) {
      const day = parseInt(frenchDateMatch[1]);
      const monthStr = frenchDateMatch[2].toLowerCase();
      const month = frenchMonths[monthStr];
      if (month !== undefined) {
        const year = new Date().getFullYear();
        return new Date(year, month, day);
      }
    }
    
    const dateParts = value.split(/[\/\-\.]/);
    if (dateParts.length === 3) {
      const [d, m, y] = dateParts.map(p => parseInt(p));
      if (y > 1900) {
        return new Date(y, m - 1, d);
      } else if (d > 1900) {
        return new Date(d, m - 1, y);
      }
    }
    
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  
  return null;
};

const extractVilleFromChantier = (chantier) => {
  if (!chantier) return null;
  
  const villes = [
    'CASA', 'CASABLANCA', 'RABAT', 'KENITRA', 'MARRAKECH', 'FES', 'TANGER',
    'AGADIR', 'TETOUANE', 'NADOR', 'LARACHE', 'SAFI', 'BENGUERIR', 'JORF',
    'YOUSSOUFIA', 'BENI MELLAL', 'KHEMISSAT', 'ERRACHIDIA', 'HOUCEIMA', 'OUAZZANE',
    'UM6P', 'SIEGE'
  ];
  
  const chantierUpper = chantier.toUpperCase();
  for (const ville of villes) {
    if (chantierUpper.includes(ville)) {
      return ville === 'SIEGE' ? 'CASA' : ville;
    }
  }
  
  return null;
};

async function importHistorique() {
  const filePath = path.join('C:', 'Users', 'lenovo', 'Downloads', 'VM_Renouvellement(Récupération automatique).xlsx');
  
  console.log('📂 Lecture du fichier:', filePath);
  
  const workbook = XLSX.readFile(filePath);
  console.log('📋 Feuilles trouvées:', workbook.SheetNames.join(', '));
  
  let totalSalaries = 0;
  let totalVisites = 0;
  let errors = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { defval: null });
    
    if (data.length === 0) continue;
    
    console.log(`\n📄 Traitement feuille: ${sheetName} (${data.length} lignes)`);
    
    const firstRow = data[0];
    const columns = Object.keys(firstRow);
    
    // Detect column structure
    let matriculeCol = columns.find(c => 
      c.toString().toLowerCase().includes('matricule') || 
      c.toString().toLowerCase().includes('mat') ||
      c === 'MAT'
    );
    
    let dateVisiteCol = columns.find(c => 
      c.toString().toLowerCase().includes('date') && c.toString().toLowerCase().includes('visite')
    );
    
    let chantierCol = columns.find(c => 
      c.toString().toLowerCase().includes('chantier') || 
      c.toString().toLowerCase().includes('filiale')
    );
    
    let fonctionCol = columns.find(c => 
      c.toString().toLowerCase() === 'fonction'
    );
    
    let typeFonctionCol = columns.find(c => 
      c.toString().toLowerCase().includes('type') && c.toString().toLowerCase().includes('fonction')
    );

    // Special handling for city sheets (CASA, RABAT, etc.) with different format
    if (!matriculeCol && columns.length >= 4) {
      // Format: MEDECIN | DATE | MATRICULE | CHANTIER
      const potentialMatricule = columns[2];
      const firstValue = firstRow[potentialMatricule];
      if (typeof firstValue === 'number' || (typeof firstValue === 'string' && /^\d+$/.test(firstValue))) {
        matriculeCol = potentialMatricule;
        dateVisiteCol = columns[1];
        chantierCol = columns[3];
      }
    }

    if (!matriculeCol) {
      console.log(`  ⚠️ Colonne matricule non trouvée, ignorée`);
      continue;
    }

    const ville = extractVilleFromChantier(sheetName) || sheetName;
    let sheetSalaries = 0;
    let sheetVisites = 0;

    for (const row of data) {
      try {
        let matricule = row[matriculeCol];
        if (matricule === null || matricule === undefined) continue;
        
        matricule = matricule.toString().trim();
        if (!matricule || matricule === 'NaN' || matricule === 'nan' || matricule === '') continue;

        const dateVisite = parseDate(row[dateVisiteCol] || row[columns[1]]);
        const chantier = (row[chantierCol] || sheetName)?.toString().trim();
        const fonction = row[fonctionCol]?.toString().trim();
        const typeFonction = row[typeFonctionCol]?.toString().trim();
        const villeExtracted = extractVilleFromChantier(chantier) || ville;

        // Create or update salarie
        let salarie = await prisma.salarie.findUnique({
          where: { matricule }
        });

        if (!salarie) {
          salarie = await prisma.salarie.create({
            data: {
              matricule,
              fonction,
              typeFonction,
              chantier,
              ville: villeExtracted
            }
          });
          sheetSalaries++;
        } else {
          await prisma.salarie.update({
            where: { id: salarie.id },
            data: {
              fonction: fonction || salarie.fonction,
              typeFonction: typeFonction || salarie.typeFonction,
              chantier: chantier || salarie.chantier,
              ville: villeExtracted || salarie.ville
            }
          });
        }

        // Create visite if date exists
        if (dateVisite && !isNaN(dateVisite.getTime())) {
          const existingVisite = await prisma.visite.findFirst({
            where: {
              salarieId: salarie.id,
              dateVisite: {
                gte: new Date(dateVisite.getTime() - 86400000),
                lte: new Date(dateVisite.getTime() + 86400000)
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
                chantier,
                ville: villeExtracted,
                statut: 'EFFECTUEE'
              }
            });
            sheetVisites++;
          }
        }
      } catch (rowError) {
        errors.push(`${sheetName}: ${rowError.message}`);
      }
    }

    console.log(`  ✅ ${sheetSalaries} nouveaux salariés, ${sheetVisites} visites`);
    totalSalaries += sheetSalaries;
    totalVisites += sheetVisites;
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 RÉSUMÉ DE L\'IMPORT');
  console.log('='.repeat(50));
  console.log(`✅ Total salariés créés: ${totalSalaries}`);
  console.log(`✅ Total visites importées: ${totalVisites}`);
  
  if (errors.length > 0) {
    console.log(`\n⚠️ ${errors.length} erreurs rencontrées`);
    errors.slice(0, 5).forEach(e => console.log(`   - ${e}`));
  }

  // Show stats
  const [salarieCount, visiteCount] = await Promise.all([
    prisma.salarie.count(),
    prisma.visite.count()
  ]);
  
  console.log('\n📈 ÉTAT DE LA BASE');
  console.log(`   Salariés total: ${salarieCount}`);
  console.log(`   Visites total: ${visiteCount}`);
}

importHistorique()
  .catch((e) => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
