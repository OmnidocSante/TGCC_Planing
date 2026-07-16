const prisma = require('../lib/prisma');

// Récupérer tous les honoraires avec filtres
exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, medecinId, statut, dateDebut, dateFin } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (medecinId) where.medecinId = parseInt(medecinId);
    if (statut) where.statut = statut;
    if (dateDebut || dateFin) {
      where.dateVisite = {};
      if (dateDebut) where.dateVisite.gte = new Date(dateDebut);
      if (dateFin) where.dateVisite.lte = new Date(dateFin);
    }

    const [honoraires, total] = await Promise.all([
      prisma.honoraire.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { dateVisite: 'desc' },
        include: {
          medecin: {
            select: { id: true, nom: true, prenom: true }
          }
        }
      }),
      prisma.honoraire.count({ where })
    ]);

    // Calculer les totaux
    const totaux = await prisma.honoraire.aggregate({
      where,
      _sum: { montantTotal: true, nbExamens: true },
      _count: true
    });

    res.json({
      success: true,
      data: honoraires,
      totaux: {
        montantTotal: totaux._sum.montantTotal || 0,
        nbExamens: totaux._sum.nbExamens || 0,
        nbHonoraires: totaux._count
      },
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

// Récupérer les stats par médecin
exports.getStatsByMedecin = async (req, res, next) => {
  try {
    const { dateDebut, dateFin } = req.query;

    const where = {};
    if (dateDebut || dateFin) {
      where.dateVisite = {};
      if (dateDebut) where.dateVisite.gte = new Date(dateDebut);
      if (dateFin) where.dateVisite.lte = new Date(dateFin);
    }

    const stats = await prisma.honoraire.groupBy({
      by: ['medecinId', 'statut'],
      where,
      _sum: { montantTotal: true, nbExamens: true },
      _count: true
    });

    // Récupérer les infos des médecins
    const medecinIds = [...new Set(stats.map(s => s.medecinId))];
    const medecins = await prisma.medecin.findMany({
      where: { id: { in: medecinIds } },
      select: { id: true, nom: true, prenom: true, typeTarif: true, tarifVisite: true, tarifExamen: true }
    });

    const medecinMap = new Map(medecins.map(m => [m.id, m]));

    // Regrouper par médecin
    const result = {};
    stats.forEach(s => {
      if (!result[s.medecinId]) {
        const medecin = medecinMap.get(s.medecinId);
        result[s.medecinId] = {
          medecin,
          parStatut: {},
          totalMontant: 0,
          totalExamens: 0,
          totalVisites: 0
        };
      }
      result[s.medecinId].parStatut[s.statut] = {
        montant: s._sum.montantTotal,
        examens: s._sum.nbExamens,
        count: s._count
      };
      result[s.medecinId].totalMontant += s._sum.montantTotal || 0;
      result[s.medecinId].totalExamens += s._sum.nbExamens || 0;
      result[s.medecinId].totalVisites += s._count;
    });

    res.json({
      success: true,
      data: Object.values(result)
    });
  } catch (error) {
    next(error);
  }
};

// Créer un honoraire
exports.create = async (req, res, next) => {
  try {
    const { medecinId, planningId, chantier, ville, dateVisite, nbExamens, notes } = req.body;

    // Récupérer le médecin pour appliquer son tarif
    const medecin = await prisma.medecin.findUnique({
      where: { id: parseInt(medecinId) }
    });

    if (!medecin) {
      return res.status(404).json({
        success: false,
        message: 'Médecin non trouvé'
      });
    }

    // Calculer le montant selon le type de tarif
    let montantTotal = 0;
    let tarifApplique = 0;

    if (medecin.typeTarif === 'PAR_VISITE') {
      tarifApplique = medecin.tarifVisite || 0;
      montantTotal = tarifApplique;
    } else if (medecin.typeTarif === 'PAR_EXAMEN') {
      tarifApplique = medecin.tarifExamen || 0;
      montantTotal = tarifApplique * (nbExamens || 0);
    } else if (medecin.typeTarif === 'MIXTE') {
      const forfait = medecin.tarifVisite || 0;
      const variable = (medecin.tarifExamen || 0) * (nbExamens || 0);
      tarifApplique = medecin.tarifExamen || 0;
      montantTotal = forfait + variable;
    }

    const honoraire = await prisma.honoraire.create({
      data: {
        medecinId: parseInt(medecinId),
        planningId: planningId ? parseInt(planningId) : null,
        chantier,
        ville,
        dateVisite: new Date(dateVisite),
        nbExamens: nbExamens || 0,
        tarifApplique,
        montantTotal,
        typeTarif: medecin.typeTarif,
        notes
      },
      include: {
        medecin: { select: { nom: true, prenom: true } }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Honoraire créé',
      data: honoraire
    });
  } catch (error) {
    next(error);
  }
};

// Générer les honoraires depuis un planning validé
exports.generateFromPlanning = async (req, res, next) => {
  try {
    const { planningId } = req.params;

    const planning = await prisma.planning.findUnique({
      where: { id: parseInt(planningId) }
    });

    if (!planning) {
      return res.status(404).json({
        success: false,
        message: 'Planning non trouvé'
      });
    }

    if (planning.status !== 'VALIDE') {
      return res.status(400).json({
        success: false,
        message: 'Le planning doit être validé pour générer les honoraires'
      });
    }

    const planningData = JSON.parse(planning.data);
    const honorairesCreated = [];

    if (planningData.chantiers) {
      for (const ch of planningData.chantiers) {
        if (!ch.medecinId) continue;

        const medecin = await prisma.medecin.findUnique({
          where: { id: ch.medecinId }
        });

        if (!medecin) continue;

        // Calculer le montant
        const nbExamens = ch.salaries.length;
        let montantTotal = 0;
        let tarifApplique = 0;

        if (medecin.typeTarif === 'PAR_VISITE') {
          tarifApplique = medecin.tarifVisite || 0;
          montantTotal = tarifApplique;
        } else if (medecin.typeTarif === 'PAR_EXAMEN') {
          tarifApplique = medecin.tarifExamen || 0;
          montantTotal = tarifApplique * nbExamens;
        } else if (medecin.typeTarif === 'MIXTE') {
          tarifApplique = medecin.tarifExamen || 0;
          montantTotal = (medecin.tarifVisite || 0) + (tarifApplique * nbExamens);
        }

        // Vérifier si l'honoraire existe déjà
        const existing = await prisma.honoraire.findFirst({
          where: {
            medecinId: ch.medecinId,
            planningId: planning.id,
            chantier: ch.chantier
          }
        });

        if (!existing) {
          const honoraire = await prisma.honoraire.create({
            data: {
              medecinId: ch.medecinId,
              planningId: planning.id,
              chantier: ch.chantier,
              ville: ch.ville,
              dateVisite: new Date(ch.dateVisite),
              nbExamens,
              tarifApplique,
              montantTotal,
              typeTarif: medecin.typeTarif
            }
          });
          honorairesCreated.push(honoraire);
        }
      }
    }

    res.json({
      success: true,
      message: `${honorairesCreated.length} honoraires générés`,
      data: honorairesCreated
    });
  } catch (error) {
    next(error);
  }
};

// Mettre à jour le statut d'un honoraire
exports.updateStatut = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { statut, datePaiement, reference, notes } = req.body;

    const updateData = { statut };
    if (datePaiement) updateData.datePaiement = new Date(datePaiement);
    if (reference !== undefined) updateData.reference = reference;
    if (notes !== undefined) updateData.notes = notes;

    const honoraire = await prisma.honoraire.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        medecin: { select: { nom: true, prenom: true } }
      }
    });

    res.json({
      success: true,
      message: 'Honoraire mis à jour',
      data: honoraire
    });
  } catch (error) {
    next(error);
  }
};

// Mettre à jour plusieurs honoraires (paiement en masse)
exports.bulkUpdateStatut = async (req, res, next) => {
  try {
    const { ids, statut, datePaiement, reference } = req.body;

    const updateData = { statut };
    if (datePaiement) updateData.datePaiement = new Date(datePaiement);
    if (reference) updateData.reference = reference;

    const result = await prisma.honoraire.updateMany({
      where: { id: { in: ids.map(id => parseInt(id)) } },
      data: updateData
    });

    res.json({
      success: true,
      message: `${result.count} honoraires mis à jour`,
      data: { count: result.count }
    });
  } catch (error) {
    next(error);
  }
};

// Supprimer un honoraire
exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.honoraire.delete({
      where: { id: parseInt(id) }
    });

    res.json({
      success: true,
      message: 'Honoraire supprimé'
    });
  } catch (error) {
    next(error);
  }
};
