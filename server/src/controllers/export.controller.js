const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');

const prisma = new PrismaClient();

exports.exportPlanningExcel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { chantier } = req.query;

    const planning = await prisma.planning.findUnique({
      where: { id: parseInt(id) }
    });

    if (!planning) {
      return res.status(404).json({
        success: false,
        message: 'Planning non trouvé'
      });
    }

    const planningData = JSON.parse(planning.data);
    const workbook = XLSX.utils.book_new();

    // Format par chantier
    if (planningData.chantiers) {
      const chantiersToExport = chantier 
        ? planningData.chantiers.filter(c => c.chantier === chantier)
        : planningData.chantiers;

      for (const ch of chantiersToExport) {
        const excelData = ch.salaries.map((s, index) => ({
          'N°': index + 1,
          'Matricule': s.matricule,
          'Nom': s.nom || '',
          'Prénom': s.prenom || '',
          'Fonction': s.fonction || '',
          'Type Fonction': s.typeFonction || '',
          'Dernière Visite': s.derniereVisite 
            ? new Date(s.derniereVisite).toLocaleDateString('fr-FR') 
            : 'Jamais'
        }));

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const sheetName = ch.chantier.substring(0, 31).replace(/[\\\/\?\*\[\]]/g, '');
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      }

      // Feuille résumé
      const summaryData = chantiersToExport.map(ch => ({
        'Chantier': ch.chantier,
        'Ville': ch.ville || '',
        'Date Visite': ch.dateVisite ? new Date(ch.dateVisite).toLocaleDateString('fr-FR') : '',
        'Médecin': ch.medecinNom || 'Non assigné',
        'Nb Salariés': ch.salaries.length
      }));
      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Résumé');

    } else {
      // Ancien format
      const excelData = planningData.map((v, index) => ({
        'N°': index + 1,
        'Matricule': v.matricule,
        'Nom': v.nom || '',
        'Prénom': v.prenom || '',
        'Fonction': v.fonction || '',
        'Type Fonction': v.typeFonction || '',
        'Chantier': v.chantier || '',
        'Ville': v.ville || '',
        'Date Visite': new Date(v.dateVisite).toLocaleDateString('fr-FR'),
        'Médecin': v.medecinNom || 'Non assigné',
        'Dernière Visite': v.derniereVisite 
          ? new Date(v.derniereVisite).toLocaleDateString('fr-FR') 
          : 'Jamais'
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Planning');
    }

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const fileName = chantier 
      ? `planning_${chantier.replace(/\s+/g, '_')}_${Date.now()}.xlsx`
      : `planning_${planning.nom.replace(/\s+/g, '_')}_${Date.now()}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

exports.exportPlanningPdf = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { chantier } = req.query;

    const planning = await prisma.planning.findUnique({
      where: { id: parseInt(id) }
    });

    if (!planning) {
      return res.status(404).json({
        success: false,
        message: 'Planning non trouvé'
      });
    }

    const planningData = JSON.parse(planning.data);

    const doc = new PDFDocument({ 
      size: 'A4', 
      layout: 'portrait',
      margin: 40
    });

    const fileName = chantier 
      ? `planning_${chantier.replace(/\s+/g, '_')}_${Date.now()}.pdf`
      : `planning_${planning.nom.replace(/\s+/g, '_')}_${Date.now()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    doc.pipe(res);

    // Format par chantier
    if (planningData.chantiers) {
      const chantiersToExport = chantier 
        ? planningData.chantiers.filter(c => c.chantier === chantier)
        : planningData.chantiers;

      for (let i = 0; i < chantiersToExport.length; i++) {
        const ch = chantiersToExport[i];
        
        if (i > 0) {
          doc.addPage();
        }

        // En-tête
        doc.fontSize(16).font('Helvetica-Bold')
          .text('PLANNING VISITE MÉDICALE', { align: 'center' });
        
        doc.moveDown(0.5);
        
        // Infos chantier
        doc.fontSize(12).font('Helvetica-Bold')
          .text(ch.chantier, { align: 'center' });
        
        doc.moveDown(0.5);
        
        doc.fontSize(10).font('Helvetica')
          .text(`Ville: ${ch.ville || 'N/A'}`, { align: 'center' })
          .text(`Date de visite: ${ch.dateVisite ? new Date(ch.dateVisite).toLocaleDateString('fr-FR') : 'À définir'}`, { align: 'center' })
          .text(`Médecin: ${ch.medecinNom || 'Non assigné'}`, { align: 'center' })
          .text(`Nombre de salariés: ${ch.salaries.length}`, { align: 'center' });
        
        doc.moveDown();

        // Ligne de séparation
        doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
        doc.moveDown(0.5);

        // Tableau
        const tableTop = doc.y;
        const tableLeft = 40;
        const colWidths = [35, 80, 120, 90, 90];
        const headers = ['N°', 'Matricule', 'Fonction', 'Type', 'Dern. Visite'];

        // En-têtes
        doc.fontSize(9).font('Helvetica-Bold');
        let currentX = tableLeft;
        headers.forEach((header, idx) => {
          doc.text(header, currentX, tableTop, { width: colWidths[idx], align: 'left' });
          currentX += colWidths[idx];
        });

        doc.moveTo(tableLeft, tableTop + 15)
          .lineTo(tableLeft + colWidths.reduce((a, b) => a + b, 0), tableTop + 15)
          .stroke();

        // Données
        doc.font('Helvetica').fontSize(8);
        let y = tableTop + 20;
        const pageHeight = 750;

        ch.salaries.forEach((salarie, index) => {
          if (y > pageHeight) {
            doc.addPage();
            y = 50;
            
            // Réafficher les en-têtes
            doc.fontSize(9).font('Helvetica-Bold');
            currentX = tableLeft;
            headers.forEach((header, idx) => {
              doc.text(header, currentX, y, { width: colWidths[idx], align: 'left' });
              currentX += colWidths[idx];
            });
            doc.moveTo(tableLeft, y + 15)
              .lineTo(tableLeft + colWidths.reduce((a, b) => a + b, 0), y + 15)
              .stroke();
            doc.font('Helvetica').fontSize(8);
            y += 20;
          }

          const rowData = [
            (index + 1).toString(),
            salarie.matricule || '',
            (salarie.fonction || '').substring(0, 25),
            (salarie.typeFonction || '').substring(0, 15),
            salarie.derniereVisite 
              ? new Date(salarie.derniereVisite).toLocaleDateString('fr-FR')
              : 'Jamais'
          ];

          currentX = tableLeft;
          rowData.forEach((data, idx) => {
            doc.text(data, currentX, y, { width: colWidths[idx], align: 'left' });
            currentX += colWidths[idx];
          });

          y += 14;
        });

        // Pied de page
        doc.fontSize(8).text(
          `Généré le ${new Date().toLocaleDateString('fr-FR')} - Page ${i + 1}/${chantiersToExport.length}`,
          40, 780,
          { align: 'center' }
        );
      }
    } else {
      // Ancien format (une seule page avec tous les salariés)
      doc.fontSize(18).text('PLANNING DES VISITES MÉDICALES', { align: 'center' });
      doc.moveDown();
      
      doc.fontSize(12)
        .text(`Planning: ${planning.nom}`)
        .text(`Période: ${new Date(planning.dateDebut).toLocaleDateString('fr-FR')} - ${new Date(planning.dateFin).toLocaleDateString('fr-FR')}`)
        .text(`Total visites: ${planning.totalVisites}`);
      
      doc.moveDown();

      const tableTop = 180;
      const tableLeft = 30;
      const colWidths = [40, 70, 80, 100, 80, 90, 80];
      const headers = ['N°', 'Matricule', 'Fonction', 'Chantier', 'Ville', 'Date Visite', 'Médecin'];

      doc.fontSize(9).font('Helvetica-Bold');
      
      let currentX = tableLeft;
      headers.forEach((header, i) => {
        doc.text(header, currentX, tableTop, { width: colWidths[i], align: 'left' });
        currentX += colWidths[i];
      });

      doc.moveTo(tableLeft, tableTop + 15)
        .lineTo(tableLeft + colWidths.reduce((a, b) => a + b, 0), tableTop + 15)
        .stroke();

      doc.font('Helvetica').fontSize(8);

      let y = tableTop + 20;
      const pageHeight = 750;

      planningData.forEach((visite, index) => {
        if (y > pageHeight) {
          doc.addPage();
          y = 50;
        }

        const rowData = [
          (index + 1).toString(),
          visite.matricule || '',
          (visite.fonction || '').substring(0, 15),
          (visite.chantier || '').substring(0, 18),
          (visite.ville || '').substring(0, 12),
          new Date(visite.dateVisite).toLocaleDateString('fr-FR'),
          (visite.medecinNom || 'Non assigné').substring(0, 15)
        ];

        currentX = tableLeft;
        rowData.forEach((data, i) => {
          doc.text(data, currentX, y, { width: colWidths[i], align: 'left' });
          currentX += colWidths[i];
        });

        y += 15;
      });
    }

    doc.end();
  } catch (error) {
    next(error);
  }
};

// Export PDF pour un chantier spécifique
exports.exportChantierPdf = async (req, res, next) => {
  try {
    const { id, chantierName } = req.params;

    const planning = await prisma.planning.findUnique({
      where: { id: parseInt(id) }
    });

    if (!planning) {
      return res.status(404).json({
        success: false,
        message: 'Planning non trouvé'
      });
    }

    const planningData = JSON.parse(planning.data);
    
    if (!planningData.chantiers) {
      return res.status(400).json({
        success: false,
        message: 'Ce planning n\'est pas au format par chantier'
      });
    }

    const chantierData = planningData.chantiers.find(
      c => c.chantier === decodeURIComponent(chantierName)
    );

    if (!chantierData) {
      return res.status(404).json({
        success: false,
        message: 'Chantier non trouvé dans ce planning'
      });
    }

    const doc = new PDFDocument({ 
      size: 'A4', 
      layout: 'portrait',
      margin: 40
    });

    const safeChantierName = chantierData.chantier.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
    const fileName = `visite_medicale_${safeChantierName}_${Date.now()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    doc.pipe(res);

    // En-tête
    doc.fontSize(18).font('Helvetica-Bold')
      .text('LISTE DE VISITE MÉDICALE', { align: 'center' });
    
    doc.moveDown();
    
    // Infos chantier dans un cadre
    doc.rect(40, doc.y, 515, 80).stroke();
    const boxY = doc.y + 10;
    
    doc.fontSize(14).font('Helvetica-Bold')
      .text(chantierData.chantier, 50, boxY, { align: 'left' });
    
    doc.fontSize(11).font('Helvetica')
      .text(`Ville: ${chantierData.ville || 'N/A'}`, 50, boxY + 20)
      .text(`Date de visite prévue: ${chantierData.dateVisite ? new Date(chantierData.dateVisite).toLocaleDateString('fr-FR') : 'À définir'}`, 50, boxY + 35)
      .text(`Médecin: ${chantierData.medecinNom || 'Non assigné'}`, 50, boxY + 50)
      .text(`Effectif: ${chantierData.salaries.length} salariés`, 300, boxY + 20);
    
    doc.y = boxY + 90;
    doc.moveDown();

    // Tableau
    const tableTop = doc.y;
    const tableLeft = 40;
    const colWidths = [35, 80, 130, 80, 90];
    const headers = ['N°', 'Matricule', 'Fonction', 'Type', 'Dern. Visite'];

    // En-têtes avec fond gris
    doc.rect(tableLeft, tableTop - 5, colWidths.reduce((a, b) => a + b, 0), 20).fill('#f3f4f6');
    
    doc.fillColor('black').fontSize(10).font('Helvetica-Bold');
    let currentX = tableLeft + 5;
    headers.forEach((header, idx) => {
      doc.text(header, currentX, tableTop, { width: colWidths[idx] - 10, align: 'left' });
      currentX += colWidths[idx];
    });

    // Données
    doc.font('Helvetica').fontSize(9);
    let y = tableTop + 20;
    const pageHeight = 750;

    chantierData.salaries.forEach((salarie, index) => {
      if (y > pageHeight) {
        doc.addPage();
        y = 50;
        
        // Réafficher les en-têtes
        doc.rect(tableLeft, y - 5, colWidths.reduce((a, b) => a + b, 0), 20).fill('#f3f4f6');
        doc.fillColor('black').fontSize(10).font('Helvetica-Bold');
        currentX = tableLeft + 5;
        headers.forEach((header, idx) => {
          doc.text(header, currentX, y, { width: colWidths[idx] - 10, align: 'left' });
          currentX += colWidths[idx];
        });
        doc.font('Helvetica').fontSize(9);
        y += 20;
      }

      // Alternance de couleur
      if (index % 2 === 0) {
        doc.rect(tableLeft, y - 3, colWidths.reduce((a, b) => a + b, 0), 16).fill('#f9fafb');
        doc.fillColor('black');
      }

      const rowData = [
        (index + 1).toString(),
        salarie.matricule || '',
        (salarie.fonction || '-').substring(0, 28),
        (salarie.typeFonction || '-').substring(0, 15),
        salarie.derniereVisite 
          ? new Date(salarie.derniereVisite).toLocaleDateString('fr-FR')
          : 'Jamais'
      ];

      currentX = tableLeft + 5;
      rowData.forEach((data, idx) => {
        doc.text(data, currentX, y, { width: colWidths[idx] - 10, align: 'left' });
        currentX += colWidths[idx];
      });

      y += 16;
    });

    // Pied de page
    doc.fontSize(8).fillColor('gray')
      .text(
        `Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`,
        40, 780,
        { align: 'center' }
      );

    doc.end();
  } catch (error) {
    next(error);
  }
};

exports.exportVisitesExcel = async (req, res, next) => {
  try {
    const { dateDebut, dateFin, statut, ville } = req.query;

    const where = {};
    if (statut) where.statut = statut;
    if (ville) where.ville = { contains: ville };
    if (dateDebut || dateFin) {
      where.dateVisite = {};
      if (dateDebut) where.dateVisite.gte = new Date(dateDebut);
      if (dateFin) where.dateVisite.lte = new Date(dateFin);
    }

    const visites = await prisma.visite.findMany({
      where,
      orderBy: { dateVisite: 'asc' },
      include: {
        salarie: true,
        medecin: true
      }
    });

    const excelData = visites.map((v, index) => ({
      'N°': index + 1,
      'Matricule': v.salarie.matricule,
      'Nom': v.salarie.nom || '',
      'Prénom': v.salarie.prenom || '',
      'Fonction': v.salarie.fonction || '',
      'Type Fonction': v.salarie.typeFonction || '',
      'Chantier': v.chantier || '',
      'Ville': v.ville || '',
      'Date Visite': new Date(v.dateVisite).toLocaleDateString('fr-FR'),
      'Prochaine Visite': v.dateVisiteProchaine 
        ? new Date(v.dateVisiteProchaine).toLocaleDateString('fr-FR')
        : '',
      'Médecin': v.medecin ? `${v.medecin.nom} ${v.medecin.prenom || ''}`.trim() : '',
      'Statut': v.statut
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Visites');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const fileName = `visites_${Date.now()}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};
