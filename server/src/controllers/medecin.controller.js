const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getAll = async (req, res, next) => {
  try {
    const { actif } = req.query;
    
    const where = {};
    if (actif !== undefined) {
      where.actif = actif === 'true';
    }

    const medecins = await prisma.medecin.findMany({
      where,
      orderBy: { nom: 'asc' },
      include: {
        _count: {
          select: { visites: true }
        }
      }
    });

    const result = medecins.map(m => ({
      ...m,
      villes: JSON.parse(m.villes || '[]'),
      visitesCount: m._count.visites
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

    const medecin = await prisma.medecin.findUnique({
      where: { id: parseInt(id) },
      include: {
        visites: {
          take: 10,
          orderBy: { dateVisite: 'desc' },
          include: {
            salarie: true
          }
        }
      }
    });

    if (!medecin) {
      return res.status(404).json({
        success: false,
        message: 'Médecin non trouvé'
      });
    }

    res.json({
      success: true,
      data: {
        ...medecin,
        villes: JSON.parse(medecin.villes || '[]')
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { nom, prenom, villes, telephone, email, typeTarif, tarifVisite, tarifExamen } = req.body;

    const medecin = await prisma.medecin.create({
      data: {
        nom,
        prenom,
        villes: JSON.stringify(villes || []),
        telephone,
        email,
        typeTarif: typeTarif || 'PAR_VISITE',
        tarifVisite: tarifVisite ? parseFloat(tarifVisite) : null,
        tarifExamen: tarifExamen ? parseFloat(tarifExamen) : null
      }
    });

    res.status(201).json({
      success: true,
      message: 'Médecin créé avec succès',
      data: {
        ...medecin,
        villes: JSON.parse(medecin.villes)
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nom, prenom, villes, telephone, email, actif, typeTarif, tarifVisite, tarifExamen } = req.body;

    const updateData = {};
    if (nom !== undefined) updateData.nom = nom;
    if (prenom !== undefined) updateData.prenom = prenom;
    if (villes !== undefined) updateData.villes = JSON.stringify(villes);
    if (telephone !== undefined) updateData.telephone = telephone;
    if (email !== undefined) updateData.email = email;
    if (actif !== undefined) updateData.actif = actif;
    if (typeTarif !== undefined) updateData.typeTarif = typeTarif;
    if (tarifVisite !== undefined) updateData.tarifVisite = tarifVisite ? parseFloat(tarifVisite) : null;
    if (tarifExamen !== undefined) updateData.tarifExamen = tarifExamen ? parseFloat(tarifExamen) : null;

    const medecin = await prisma.medecin.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    res.json({
      success: true,
      message: 'Médecin mis à jour',
      data: {
        ...medecin,
        villes: JSON.parse(medecin.villes || '[]')
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.medecin.delete({
      where: { id: parseInt(id) }
    });

    res.json({
      success: true,
      message: 'Médecin supprimé'
    });
  } catch (error) {
    next(error);
  }
};

exports.getByVille = async (req, res, next) => {
  try {
    const { ville } = req.params;

    const medecins = await prisma.medecin.findMany({
      where: {
        actif: true,
        villes: {
          contains: ville
        }
      },
      orderBy: { nom: 'asc' }
    });

    const result = medecins.map(m => ({
      ...m,
      villes: JSON.parse(m.villes || '[]')
    }));

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};
