const prisma = require('../lib/prisma');

// Stats générales
exports.getStats = async (req, res, next) => {
  try {
    const { dateDebut, dateFin, ville } = req.query;
    
    const now = new Date();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const whereVisite = {};
    const whereSalarie = { actif: true };
    
    if (dateDebut || dateFin) {
      whereVisite.dateVisite = {};
      if (dateDebut) whereVisite.dateVisite.gte = new Date(dateDebut);
      if (dateFin) whereVisite.dateVisite.lte = new Date(dateFin);
    }
    
    if (ville) {
      whereVisite.ville = { contains: ville };
      whereSalarie.ville = { contains: ville };
    }

    const [
      totalSalaries,
      salariesActifs,
      totalMedecins,
      totalVisites,
      visitesEffectuees,
      visitesPlanifiees,
      planningsValides
    ] = await Promise.all([
      prisma.salarie.count(),
      prisma.salarie.count({ where: { actif: true } }),
      prisma.medecin.count({ where: { actif: true } }),
      prisma.visite.count({ where: whereVisite }),
      prisma.visite.count({ where: { ...whereVisite, statut: 'EFFECTUEE' } }),
      prisma.visite.count({ where: { ...whereVisite, statut: 'PLANIFIEE' } }),
      prisma.planning.count({ where: { status: 'VALIDE' } })
    ]);

    // Salariés à jour (visite dans les 12 derniers mois)
    const salariesAJour = await prisma.salarie.count({
      where: {
        ...whereSalarie,
        visites: {
          some: {
            dateVisite: { gte: twelveMonthsAgo }
          }
        }
      }
    });

    const salariesAPlanifier = salariesActifs - salariesAJour;
    const tauxCouverture = salariesActifs > 0 ? Math.round((salariesAJour / salariesActifs) * 100) : 0;

    // Nombre de chantiers et villes uniques
    const chantiersUniques = await prisma.salarie.groupBy({
      by: ['chantier'],
      where: { actif: true, chantier: { not: null } }
    });

    const villesUniques = await prisma.salarie.groupBy({
      by: ['ville'],
      where: { actif: true, ville: { not: null } }
    });

    // Visites ce mois
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const visitesCeMois = await prisma.visite.count({
      where: {
        dateVisite: { gte: thisMonth, lt: nextMonth }
      }
    });

    // Délai moyen entre visites
    const visitesPourDelai = await prisma.visite.findMany({
      where: { statut: 'EFFECTUEE' },
      select: { dateVisite: true, salarieId: true },
      orderBy: { dateVisite: 'desc' }
    });

    let delaiTotal = 0;
    let delaiCount = 0;
    const visitesBySalarie = {};
    
    visitesPourDelai.forEach(v => {
      if (!visitesBySalarie[v.salarieId]) {
        visitesBySalarie[v.salarieId] = [];
      }
      visitesBySalarie[v.salarieId].push(v.dateVisite);
    });

    Object.values(visitesBySalarie).forEach(dates => {
      if (dates.length > 1) {
        for (let i = 0; i < dates.length - 1; i++) {
          const diff = Math.abs(dates[i] - dates[i + 1]) / (1000 * 60 * 60 * 24);
          delaiTotal += diff;
          delaiCount++;
        }
      }
    });

    const delaiMoyenJours = delaiCount > 0 ? Math.round(delaiTotal / delaiCount) : 365;

    res.json({
      success: true,
      data: {
        totalSalaries,
        salariesActifs,
        totalMedecins,
        totalVisites,
        visitesEffectuees,
        visitesPlanifiees,
        salariesAJour,
        salariesAPlanifier,
        tauxCouverture,
        totalChantiers: chantiersUniques.length,
        totalVilles: villesUniques.length,
        visitesCeMois,
        planningsValides,
        delaiMoyenJours
      }
    });
  } catch (error) {
    next(error);
  }
};

// Visites par mois
exports.getVisitesParMois = async (req, res, next) => {
  try {
    const { dateDebut, dateFin, ville } = req.query;
    
    const where = {};
    if (dateDebut || dateFin) {
      where.dateVisite = {};
      if (dateDebut) where.dateVisite.gte = new Date(dateDebut);
      if (dateFin) where.dateVisite.lte = new Date(dateFin);
    }
    if (ville) where.ville = { contains: ville };

    const visites = await prisma.visite.findMany({
      where,
      select: { dateVisite: true, statut: true }
    });

    const moisNoms = [
      'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
      'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'
    ];

    const parMois = {};
    
    visites.forEach(v => {
      const date = new Date(v.dateVisite);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!parMois[key]) {
        parMois[key] = {
          mois: `${moisNoms[date.getMonth()]} ${date.getFullYear()}`,
          effectuees: 0,
          planifiees: 0,
          total: 0
        };
      }
      
      parMois[key].total++;
      if (v.statut === 'EFFECTUEE') parMois[key].effectuees++;
      else if (v.statut === 'PLANIFIEE') parMois[key].planifiees++;
    });

    const result = Object.entries(parMois)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, data]) => data);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// Visites par ville
exports.getVisitesParVille = async (req, res, next) => {
  try {
    const { dateDebut, dateFin } = req.query;
    
    const where = { ville: { not: null } };
    if (dateDebut || dateFin) {
      where.dateVisite = {};
      if (dateDebut) where.dateVisite.gte = new Date(dateDebut);
      if (dateFin) where.dateVisite.lte = new Date(dateFin);
    }

    const visites = await prisma.visite.groupBy({
      by: ['ville'],
      where,
      _count: { id: true }
    });

    const result = visites
      .filter(v => v.ville)
      .map(v => ({ ville: v.ville, count: v._count.id }))
      .sort((a, b) => b.count - a.count);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// Stats salariés
exports.getSalariesStats = async (req, res, next) => {
  try {
    const { ville } = req.query;
    
    const where = { actif: true };
    if (ville) where.ville = { contains: ville };

    // Par ville
    const parVille = await prisma.salarie.groupBy({
      by: ['ville'],
      where: { ...where, ville: { not: null } },
      _count: { id: true }
    });

    const villesResult = parVille
      .filter(v => v.ville)
      .map(v => ({ ville: v.ville, count: v._count.id }))
      .sort((a, b) => b.count - a.count);

    // Liste des villes uniques
    const villes = villesResult.map(v => v.ville);

    res.json({
      success: true,
      parVille: villesResult,
      villes
    });
  } catch (error) {
    next(error);
  }
};

// Performance des médecins
exports.getMedecinsPerformance = async (req, res, next) => {
  try {
    const { dateDebut, dateFin } = req.query;

    const medecins = await prisma.medecin.findMany({
      where: { actif: true },
      include: {
        _count: {
          select: { visites: true }
        },
        honoraires: {
          where: dateDebut || dateFin ? {
            dateVisite: {
              ...(dateDebut && { gte: new Date(dateDebut) }),
              ...(dateFin && { lte: new Date(dateFin) })
            }
          } : undefined
        }
      }
    });

    const result = medecins.map(m => {
      const totalHonoraires = m.honoraires.reduce((sum, h) => sum + (h.montantTotal || 0), 0);
      const nbExamens = m.honoraires.reduce((sum, h) => sum + (h.nbExamens || 0), 0);
      
      return {
        id: m.id,
        nom: m.nom,
        prenom: m.prenom,
        villes: JSON.parse(m.villes || '[]'),
        nbVisites: m._count.visites,
        nbExamens,
        totalHonoraires,
        typeTarif: m.typeTarif,
        tarifVisite: m.tarifVisite,
        tarifExamen: m.tarifExamen
      };
    }).sort((a, b) => b.totalHonoraires - a.totalHonoraires);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// Stats honoraires
exports.getHonorairesStats = async (req, res, next) => {
  try {
    const { dateDebut, dateFin, ville } = req.query;

    const where = {};
    if (dateDebut || dateFin) {
      where.dateVisite = {};
      if (dateDebut) where.dateVisite.gte = new Date(dateDebut);
      if (dateFin) where.dateVisite.lte = new Date(dateFin);
    }
    if (ville) where.ville = { contains: ville };

    const totaux = await prisma.honoraire.aggregate({
      where,
      _sum: { montantTotal: true, nbExamens: true },
      _count: true
    });

    const parStatut = await prisma.honoraire.groupBy({
      by: ['statut'],
      where,
      _sum: { montantTotal: true },
      _count: true
    });

    const parStatutResult = parStatut.map(s => ({
      statut: s.statut,
      montant: s._sum.montantTotal || 0,
      count: s._count
    }));

    res.json({
      success: true,
      data: {
        montantTotal: totaux._sum.montantTotal || 0,
        nbExamens: totaux._sum.nbExamens || 0,
        nbHonoraires: totaux._count,
        parStatut: parStatutResult
      }
    });
  } catch (error) {
    next(error);
  }
};

// Rentabilité par médecin (CA = 230 DH par visite effectuée)
const TARIF_VISITE_CA = 230; // DH par visite (chiffre d'affaires)

exports.getRentabiliteParMedecin = async (req, res, next) => {
  try {
    const { dateDebut, dateFin } = req.query;

    const whereVisite = { statut: 'EFFECTUEE', medecinId: { not: null } };
    
    if (dateDebut || dateFin) {
      whereVisite.dateVisite = {};
      if (dateDebut) {
        whereVisite.dateVisite.gte = new Date(dateDebut);
      }
      if (dateFin) {
        whereVisite.dateVisite.lte = new Date(dateFin);
      }
    }

    // Récupérer les médecins actifs avec leurs tarifs
    const medecins = await prisma.medecin.findMany({
      where: { actif: true }
    });

    // Compter les visites par médecin
    const visitesParMedecin = await prisma.visite.groupBy({
      by: ['medecinId'],
      where: whereVisite,
      _count: { id: true }
    });

    // Compter les visites groupées par chantier par médecin (pour tarif PAR_VISITE)
    const visitesParChantierMedecin = await prisma.visite.groupBy({
      by: ['medecinId', 'chantier'],
      where: whereVisite,
      _count: { id: true }
    });

    // Créer les maps pour un accès rapide
    const visitesMap = new Map(visitesParMedecin.map(v => [v.medecinId, v._count.id]));
    
    // Map pour compter le nombre de chantiers distincts par médecin
    const chantiersParMedecin = new Map();
    visitesParChantierMedecin.forEach(v => {
      if (!chantiersParMedecin.has(v.medecinId)) {
        chantiersParMedecin.set(v.medecinId, 0);
      }
      chantiersParMedecin.set(v.medecinId, chantiersParMedecin.get(v.medecinId) + 1);
    });

    // Calculer la rentabilité pour chaque médecin
    const rentabilite = medecins.map(m => {
      const nbVisites = visitesMap.get(m.id) || 0;
      const nbChantiers = chantiersParMedecin.get(m.id) || 0;
      const chiffreAffaire = nbVisites * TARIF_VISITE_CA;
      
      // Calculer les honoraires selon le type de tarif du médecin
      let honoraires = 0;
      if (m.typeTarif === 'PAR_VISITE' && m.tarifVisite) {
        // Payé par visite au chantier (nombre de chantiers visités)
        honoraires = nbChantiers * m.tarifVisite;
      } else if (m.typeTarif === 'PAR_EXAMEN' && m.tarifExamen) {
        // Payé par collaborateur examiné (nombre de visites)
        honoraires = nbVisites * m.tarifExamen;
      }
      
      const marge = chiffreAffaire - honoraires;
      const tauxMarge = chiffreAffaire > 0 ? ((marge / chiffreAffaire) * 100).toFixed(1) : 0;

      return {
        id: m.id,
        nom: m.nom,
        prenom: m.prenom,
        typeTarif: m.typeTarif || 'Non défini',
        tarifMedecin: m.typeTarif === 'PAR_VISITE' ? m.tarifVisite : m.tarifExamen,
        nbVisites,
        nbChantiers,
        chiffreAffaire,
        honoraires,
        marge,
        tauxMarge: parseFloat(tauxMarge)
      };
    }).filter(m => m.nbVisites > 0).sort((a, b) => b.marge - a.marge);

    // Totaux
    const totalVisites = rentabilite.reduce((sum, m) => sum + m.nbVisites, 0);
    const totalCA = rentabilite.reduce((sum, m) => sum + m.chiffreAffaire, 0);
    const totalHonoraires = rentabilite.reduce((sum, m) => sum + m.honoraires, 0);
    const totalMarge = totalCA - totalHonoraires;
    const tauxMargeGlobal = totalCA > 0 ? ((totalMarge / totalCA) * 100).toFixed(1) : 0;

    res.json({
      success: true,
      data: {
        tarifVisite: TARIF_VISITE_CA,
        totaux: {
          nbVisites: totalVisites,
          chiffreAffaire: totalCA,
          honoraires: totalHonoraires,
          marge: totalMarge,
          tauxMarge: parseFloat(tauxMargeGlobal)
        },
        parMedecin: rentabilite
      }
    });
  } catch (error) {
    next(error);
  }
};
