const prisma = require('../lib/prisma');

exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, ville, chantier, actif } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (ville) where.ville = { contains: ville };
    if (chantier) where.chantier = { contains: chantier };
    if (actif !== undefined) where.actif = actif === 'true';

    const [salaries, total] = await Promise.all([
      prisma.salarie.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { matricule: 'asc' },
        include: {
          visites: {
            take: 1,
            orderBy: { dateVisite: 'desc' }
          }
        }
      }),
      prisma.salarie.count({ where })
    ]);

    const result = salaries.map(s => ({
      ...s,
      derniereVisite: s.visites[0] || null,
      visites: undefined
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

exports.search = async (req, res, next) => {
  try {
    const { q, limit = 20 } = req.query;

    if (!q || q.length < 2) {
      return res.json({ success: true, data: [] });
    }

    const salaries = await prisma.salarie.findMany({
      where: {
        OR: [
          { matricule: { contains: q } },
          { nom: { contains: q } },
          { prenom: { contains: q } }
        ]
      },
      take: parseInt(limit),
      include: {
        visites: {
          take: 1,
          orderBy: { dateVisite: 'desc' }
        }
      }
    });

    const result = salaries.map(s => ({
      ...s,
      derniereVisite: s.visites[0] || null,
      visites: undefined
    }));

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const salarie = await prisma.salarie.findUnique({
      where: { id: parseInt(id) },
      include: {
        visites: {
          orderBy: { dateVisite: 'desc' },
          include: {
            medecin: true
          }
        }
      }
    });

    if (!salarie) {
      return res.status(404).json({
        success: false,
        message: 'Salarié non trouvé'
      });
    }

    res.json({
      success: true,
      data: salarie
    });
  } catch (error) {
    next(error);
  }
};

exports.getByMatricule = async (req, res, next) => {
  try {
    const { matricule } = req.params;

    const salarie = await prisma.salarie.findUnique({
      where: { matricule },
      include: {
        visites: {
          orderBy: { dateVisite: 'desc' },
          include: {
            medecin: true
          }
        }
      }
    });

    if (!salarie) {
      return res.status(404).json({
        success: false,
        message: 'Salarié non trouvé'
      });
    }

    res.json({
      success: true,
      data: salarie
    });
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { matricule, nom, prenom, fonction, typeFonction, chantier, ville } = req.body;

    const existing = await prisma.salarie.findUnique({
      where: { matricule }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Ce matricule existe déjà'
      });
    }

    const salarie = await prisma.salarie.create({
      data: {
        matricule,
        nom,
        prenom,
        fonction,
        typeFonction,
        chantier,
        ville
      }
    });

    res.status(201).json({
      success: true,
      message: 'Salarié créé avec succès',
      data: salarie
    });
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nom, prenom, fonction, typeFonction, chantier, ville, actif } = req.body;

    const salarie = await prisma.salarie.update({
      where: { id: parseInt(id) },
      data: {
        nom,
        prenom,
        fonction,
        typeFonction,
        chantier,
        ville,
        actif
      }
    });

    res.json({
      success: true,
      message: 'Salarié mis à jour',
      data: salarie
    });
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.salarie.delete({
      where: { id: parseInt(id) }
    });

    res.json({
      success: true,
      message: 'Salarié supprimé'
    });
  } catch (error) {
    next(error);
  }
};
