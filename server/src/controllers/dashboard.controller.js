const prisma = require('../lib/prisma');

exports.getStats = async (req, res, next) => {
  try {
    const now = new Date();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const [
      totalSalaries,
      totalMedecins,
      totalVisites,
      visitesEffectuees,
      visitesPlanifiees
    ] = await Promise.all([
      prisma.salarie.count({ where: { actif: true } }),
      prisma.medecin.count({ where: { actif: true } }),
      prisma.visite.count(),
      prisma.visite.count({ where: { statut: 'EFFECTUEE' } }),
      prisma.visite.count({ where: { statut: 'PLANIFIEE' } })
    ]);

    const salariesAvecVisiteRecente = await prisma.salarie.count({
      where: {
        actif: true,
        visites: {
          some: {
            dateVisite: { gte: twelveMonthsAgo }
          }
        }
      }
    });

    const salariesAPlanifier = totalSalaries - salariesAvecVisiteRecente;

    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const visitesCeMois = await prisma.visite.count({
      where: {
        dateVisite: {
          gte: thisMonth,
          lt: nextMonth
        }
      }
    });

    res.json({
      success: true,
      data: {
        totalSalaries,
        totalMedecins,
        totalVisites,
        visitesEffectuees,
        visitesPlanifiees,
        salariesAPlanifier,
        salariesAJour: salariesAvecVisiteRecente,
        visitesCeMois,
        tauxCouverture: totalSalaries > 0 
          ? Math.round((salariesAvecVisiteRecente / totalSalaries) * 100) 
          : 0
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getVisitesParMois = async (req, res, next) => {
  try {
    const { annee = new Date().getFullYear() } = req.query;
    
    const startDate = new Date(parseInt(annee), 0, 1);
    const endDate = new Date(parseInt(annee), 11, 31);

    const visites = await prisma.visite.findMany({
      where: {
        dateVisite: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        dateVisite: true,
        statut: true
      }
    });

    const parMois = {};
    for (let i = 0; i < 12; i++) {
      parMois[i] = { effectuees: 0, planifiees: 0, total: 0 };
    }

    visites.forEach(v => {
      const mois = v.dateVisite.getMonth();
      parMois[mois].total++;
      if (v.statut === 'EFFECTUEE') {
        parMois[mois].effectuees++;
      } else if (v.statut === 'PLANIFIEE') {
        parMois[mois].planifiees++;
      }
    });

    const moisNoms = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];

    const result = Object.entries(parMois).map(([mois, data]) => ({
      mois: moisNoms[parseInt(mois)],
      ...data
    }));

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.getVisitesParVille = async (req, res, next) => {
  try {
    const visites = await prisma.visite.groupBy({
      by: ['ville'],
      _count: { id: true },
      where: {
        ville: { not: null }
      }
    });

    const result = visites
      .filter(v => v.ville)
      .map(v => ({
        ville: v.ville,
        count: v._count.id
      }))
      .sort((a, b) => b.count - a.count);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.getSalariesAPlanifier = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, ville, chantier } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const now = new Date();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const where = { actif: true };
    if (ville) where.ville = { contains: ville };
    if (chantier) where.chantier = { contains: chantier };

    const allSalaries = await prisma.salarie.findMany({
      where,
      include: {
        visites: {
          orderBy: { dateVisite: 'desc' },
          take: 1
        }
      }
    });

    const salariesAPlanifier = allSalaries.filter(s => {
      const derniereVisite = s.visites[0];
      return !derniereVisite || derniereVisite.dateVisite < twelveMonthsAgo;
    });

    const total = salariesAPlanifier.length;
    const paginated = salariesAPlanifier.slice(skip, skip + parseInt(limit));

    const result = paginated.map(s => ({
      id: s.id,
      matricule: s.matricule,
      nom: s.nom,
      prenom: s.prenom,
      fonction: s.fonction,
      typeFonction: s.typeFonction,
      chantier: s.chantier,
      ville: s.ville,
      derniereVisite: s.visites[0]?.dateVisite || null,
      joursDepuisDerniereVisite: s.visites[0]
        ? Math.floor((now - s.visites[0].dateVisite) / (1000 * 60 * 60 * 24))
        : null
    }));

    res.json({
      success: true,
      data: result,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
};
