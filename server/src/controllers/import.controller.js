const prisma = require('../lib/prisma');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

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
    'YOUSSOUFIA', 'BENI MELLAL', 'KHEMISSAT', 'ERRACHIDIA', 'HOUCEIMA', 'OUAZZANE'
  ];
  
  const chantierUpper = chantier.toUpperCase();
  for (const ville of villes) {
    if (chantierUpper.includes(ville)) {
      return ville;
    }
  }
  
  return null;
};

exports.importHistorique = async (req, res, next) => {
  let importRecord = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier fourni'
      });
    }

    const filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    
    let totalRecords = 0;
    let errors = [];
    let processedSheets = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { defval: null });
      
      if (data.length === 0) continue;
      
      const firstRow = data[0];
      const columns = Object.keys(firstRow);
      
      let matriculeCol = columns.find(c => 
        c.toLowerCase().includes('matricule') || 
        c.toLowerCase().includes('mat') ||
        c === 'MAT'
      );
      
      if (!matriculeCol && columns.length >= 3) {
        const potentialMatricule = columns[2];
        if (typeof firstRow[potentialMatricule] === 'number') {
          matriculeCol = potentialMatricule;
        }
      }

      if (!matriculeCol) {
        errors.push(`Feuille "${sheetName}": Colonne matricule non trouvée`);
        continue;
      }

      const ville = extractVilleFromChantier(sheetName) || sheetName;
      let sheetRecords = data.length;
      totalRecords += sheetRecords;
      processedSheets.push(`${sheetName}: ${sheetRecords} lignes`);
    }

    importRecord = await prisma.importHistory.create({
      data: {
        fileName: req.file.originalname,
        fileType: 'HISTORIQUE',
        recordsCount: totalRecords,
        status: 'SUCCESS',
        errors: errors.length > 0 ? JSON.stringify(errors.slice(0, 50)) : null
      }
    });

    fs.unlinkSync(filePath);

    res.json({
      success: true,
      message: `Import terminé: ${totalRecords} lignes analysées`,
      data: {
        totalRecords,
        processedSheets,
        errors: errors.slice(0, 10),
        hasMoreErrors: errors.length > 10
      }
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
};

// VERSION OPTIMISÉE - Import client avec batch processing
exports.importClient = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier fourni'
      });
    }

    const filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { defval: null });

    if (data.length === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        message: 'Fichier vide'
      });
    }

    const columns = Object.keys(data[0]);
    const matriculeCol = columns.find(c => c.toLowerCase().includes('matricule'));
    const fonctionCol = columns.find(c => c.toLowerCase() === 'fonction');
    const typeFonctionCol = columns.find(c => c.toLowerCase().includes('type'));
    const chantierCol = columns.find(c => c.toLowerCase().includes('chantier'));

    if (!matriculeCol) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        message: 'Colonne MATRICULE non trouvée dans le fichier'
      });
    }

    // 1. Extraire tous les matricules du fichier
    const matriculesFromFile = new Set();
    const dataMap = new Map();
    
    for (const row of data) {
      const matricule = row[matriculeCol]?.toString().trim();
      if (!matricule || matricule === 'NaN' || matricule === 'nan' || matricule === '') continue;
      
      matriculesFromFile.add(matricule);
      dataMap.set(matricule, {
        fonction: row[fonctionCol]?.toString().trim() || null,
        typeFonction: row[typeFonctionCol]?.toString().trim() || null,
        chantier: row[chantierCol]?.toString().trim() || null
      });
    }

    // 2. Récupérer tous les salariés existants en une seule requête
    const existingSalaries = await prisma.salarie.findMany({
      where: {
        matricule: { in: Array.from(matriculesFromFile) }
      },
      include: {
        visites: {
          orderBy: { dateVisite: 'desc' },
          take: 1
        }
      }
    });

    const existingMap = new Map(existingSalaries.map(s => [s.matricule, s]));

    // 3. Calculer les résultats
    const now = new Date();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const results = {
      total: matriculesFromFile.size,
      aPlanifier: [],
      aJour: [],
      nouveaux: [],
      errors: []
    };

    // 4. Identifier les nouveaux salariés à créer
    const newSalaries = [];
    
    for (const matricule of matriculesFromFile) {
      const rowData = dataMap.get(matricule);
      
      if (!existingMap.has(matricule)) {
        // Nouveau salarié
        newSalaries.push({
          matricule,
          fonction: rowData.fonction,
          typeFonction: rowData.typeFonction,
          chantier: rowData.chantier,
          ville: extractVilleFromChantier(rowData.chantier)
        });
        
        results.nouveaux.push({
          matricule,
          fonction: rowData.fonction,
          typeFonction: rowData.typeFonction,
          chantier: rowData.chantier,
          statut: 'NOUVEAU - À planifier'
        });
      }
    }

    // 5. Créer les nouveaux salariés en batch
    if (newSalaries.length > 0) {
      await prisma.salarie.createMany({
        data: newSalaries,
        skipDuplicates: true
      });
    }

    // 6. Récupérer les salariés nouvellement créés
    const allSalaries = await prisma.salarie.findMany({
      where: {
        matricule: { in: Array.from(matriculesFromFile) }
      },
      include: {
        visites: {
          orderBy: { dateVisite: 'desc' },
          take: 1
        }
      }
    });

    // 7. Classifier chaque salarié
    for (const salarie of allSalaries) {
      const derniereVisite = salarie.visites[0];
      const isNew = newSalaries.some(ns => ns.matricule === salarie.matricule);

      if (isNew) {
        // Déjà ajouté aux nouveaux et à planifier
        results.aPlanifier.push({
          salarieId: salarie.id,
          matricule: salarie.matricule,
          fonction: salarie.fonction,
          typeFonction: salarie.typeFonction,
          chantier: salarie.chantier,
          ville: salarie.ville,
          derniereVisite: null,
          joursDepuisDerniereVisite: null
        });
      } else if (!derniereVisite || derniereVisite.dateVisite < twelveMonthsAgo) {
        // Visite > 12 mois ou jamais
        const joursDepuis = derniereVisite 
          ? Math.floor((now - derniereVisite.dateVisite) / (1000 * 60 * 60 * 24))
          : null;

        results.aPlanifier.push({
          salarieId: salarie.id,
          matricule: salarie.matricule,
          fonction: salarie.fonction,
          typeFonction: salarie.typeFonction,
          chantier: salarie.chantier,
          ville: salarie.ville,
          derniereVisite: derniereVisite?.dateVisite || null,
          joursDepuisDerniereVisite: joursDepuis
        });
      } else {
        // À jour (< 12 mois)
        const joursRestants = Math.floor(
          (derniereVisite.dateVisiteProchaine - now) / (1000 * 60 * 60 * 24)
        );
        
        results.aJour.push({
          matricule: salarie.matricule,
          fonction: salarie.fonction,
          derniereVisite: derniereVisite.dateVisite,
          prochaineVisite: derniereVisite.dateVisiteProchaine,
          joursRestants
        });
      }
    }

    // Trier à planifier par jours écoulés (les plus anciens d'abord)
    results.aPlanifier.sort((a, b) => {
      if (a.joursDepuisDerniereVisite === null) return -1;
      if (b.joursDepuisDerniereVisite === null) return 1;
      return b.joursDepuisDerniereVisite - a.joursDepuisDerniereVisite;
    });

    await prisma.importHistory.create({
      data: {
        fileName: req.file.originalname,
        fileType: 'CLIENT',
        recordsCount: data.length,
        status: results.errors.length > 0 ? 'PARTIAL' : 'SUCCESS',
        errors: results.errors.length > 0 ? JSON.stringify(results.errors) : null
      }
    });

    fs.unlinkSync(filePath);

    res.json({
      success: true,
      message: `Analyse terminée: ${results.aPlanifier.length} salariés à planifier sur ${results.total}`,
      data: {
        summary: {
          total: results.total,
          aPlanifier: results.aPlanifier.length,
          aJour: results.aJour.length,
          nouveaux: results.nouveaux.length
        },
        aPlanifier: results.aPlanifier,
        aJour: results.aJour.slice(0, 100),
        nouveaux: results.nouveaux,
        errors: results.errors.slice(0, 10)
      }
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
};

exports.getImportHistory = async (req, res, next) => {
  try {
    const history = await prisma.importHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    next(error);
  }
};
