const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, statut, dateDebut, dateFin, matricule } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (statut) where.statut = statut;
    if (dateDebut || dateFin) {
      where.dateVisite = {};
      if (dateDebut) where.dateVisite.gte = new Date(dateDebut);
      if (dateFin) where.dateVisite.lte = new Date(dateFin);
    }
    
    // Filtre par matricule
    if (matricule) {
      where.salarie = {
        matricule: { contains: matricule }
      };
    }

    const [visites, total] = await Promise.all([
      prisma.visite.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { dateVisite: 'desc' },
        include: {
          salarie: true,
          medecin: true
        }
      }),
      prisma.visite.count({ where })
    ]);

    res.json({
      success: true,
      data: visites,
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

exports.getBySalarie = async (req, res, next) => {
  try {
    const { salarieId } = req.params;

    const visites = await prisma.visite.findMany({
      where: { salarieId: parseInt(salarieId) },
      orderBy: { dateVisite: 'desc' },
      include: {
        medecin: true
      }
    });

    res.json({
      success: true,
      data: visites
    });
  } catch (error) {
    next(error);
  }
};

exports.getByMedecin = async (req, res, next) => {
  try {
    const { medecinId } = req.params;
    const { dateDebut, dateFin } = req.query;

    const where = { medecinId: parseInt(medecinId) };
    if (dateDebut || dateFin) {
      where.dateVisite = {};
      if (dateDebut) where.dateVisite.gte = new Date(dateDebut);
      if (dateFin) where.dateVisite.lte = new Date(dateFin);
    }

    const visites = await prisma.visite.findMany({
      where,
      orderBy: { dateVisite: 'desc' },
      include: {
        salarie: true
      }
    });

    res.json({
      success: true,
      data: visites
    });
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const visite = await prisma.visite.findUnique({
      where: { id: parseInt(id) },
      include: {
        salarie: true,
        medecin: true
      }
    });

    if (!visite) {
      return res.status(404).json({
        success: false,
        message: 'Visite non trouvée'
      });
    }

    res.json({
      success: true,
      data: visite
    });
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { salarieId, medecinId, dateVisite, chantier, ville, notes } = req.body;

    const dateVisiteProchaine = new Date(dateVisite);
    dateVisiteProchaine.setFullYear(dateVisiteProchaine.getFullYear() + 1);

    const visite = await prisma.visite.create({
      data: {
        salarieId: parseInt(salarieId),
        medecinId: medecinId ? parseInt(medecinId) : null,
        dateVisite: new Date(dateVisite),
        dateVisiteProchaine,
        chantier,
        ville,
        notes,
        statut: 'PLANIFIEE'
      },
      include: {
        salarie: true,
        medecin: true
      }
    });

    res.status(201).json({
      success: true,
      message: 'Visite créée avec succès',
      data: visite
    });
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { medecinId, dateVisite, chantier, ville, statut, notes } = req.body;

    const updateData = {};
    if (medecinId !== undefined) updateData.medecinId = medecinId ? parseInt(medecinId) : null;
    if (dateVisite) {
      updateData.dateVisite = new Date(dateVisite);
      const dateVisiteProchaine = new Date(dateVisite);
      dateVisiteProchaine.setFullYear(dateVisiteProchaine.getFullYear() + 1);
      updateData.dateVisiteProchaine = dateVisiteProchaine;
    }
    if (chantier !== undefined) updateData.chantier = chantier;
    if (ville !== undefined) updateData.ville = ville;
    if (statut !== undefined) updateData.statut = statut;
    if (notes !== undefined) updateData.notes = notes;

    const visite = await prisma.visite.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        salarie: true,
        medecin: true
      }
    });

    res.json({
      success: true,
      message: 'Visite mise à jour',
      data: visite
    });
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.visite.delete({
      where: { id: parseInt(id) }
    });

    res.json({
      success: true,
      message: 'Visite supprimée'
    });
  } catch (error) {
    next(error);
  }
};
