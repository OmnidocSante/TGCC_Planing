const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getAll = async (req, res, next) => {
  try {
    const plannings = await prisma.planning.findMany({
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: plannings.map(p => ({
        ...p,
        data: undefined
      }))
    });
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const planning = await prisma.planning.findUnique({
      where: { id: parseInt(id) }
    });

    if (!planning) {
      return res.status(404).json({
        success: false,
        message: 'Planning non trouvé'
      });
    }

    res.json({
      success: true,
      data: {
        ...planning,
        data: JSON.parse(planning.data)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Nouvelle génération par chantier
exports.generateByChantier = async (req, res, next) => {
  try {
    const { nom, dateDebut, dateFin, chantiers } = req.body;

    if (!nom || !chantiers || chantiers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nom et chantiers requis'
      });
    }

    // Récupérer les médecins
    const medecinIds = [...new Set(chantiers.map(c => c.medecinId).filter(Boolean))];
    const medecins = await prisma.medecin.findMany({
      where: { id: { in: medecinIds } }
    });
    const medecinMap = new Map(medecins.map(m => [m.id, m]));

    // Préparer les données du planning
    const planningData = {
      chantiers: []
    };

    let totalVisites = 0;

    for (const chantierData of chantiers) {
      const { chantier, ville, medecinId, dateVisite, salarieIds, objectif, totalDisponible } = chantierData;

      // Récupérer les salariés
      const salaries = await prisma.salarie.findMany({
        where: { id: { in: salarieIds } },
        include: {
          visites: {
            orderBy: { dateVisite: 'desc' },
            take: 1
          }
        }
      });

      const medecin = medecinId ? medecinMap.get(medecinId) : null;

      const chantierPlan = {
        chantier,
        ville,
        dateVisite,
        medecinId,
        medecinNom: medecin ? `Dr. ${medecin.nom} ${medecin.prenom || ''}`.trim() : null,
        objectif: objectif || salaries.length,
        totalDisponible: totalDisponible || salaries.length,
        tauxObjectif: totalDisponible ? Math.round((salaries.length / totalDisponible) * 100) : 100,
        salaries: salaries.map(s => ({
          salarieId: s.id,
          matricule: s.matricule,
          nom: s.nom,
          prenom: s.prenom,
          fonction: s.fonction,
          typeFonction: s.typeFonction,
          derniereVisite: s.visites[0]?.dateVisite || null
        }))
      };

      planningData.chantiers.push(chantierPlan);
      totalVisites += salaries.length;
    }

    // Créer le planning
    const planning = await prisma.planning.create({
      data: {
        nom,
        dateDebut: new Date(dateDebut),
        dateFin: new Date(dateFin),
        totalVisites,
        status: 'BROUILLON',
        data: JSON.stringify(planningData)
      }
    });

    res.status(201).json({
      success: true,
      message: `Planning créé avec ${totalVisites} visites sur ${chantiers.length} chantiers`,
      data: {
        id: planning.id,
        nom: planning.nom,
        totalVisites
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.generate = async (req, res, next) => {
  try {
    const { 
      nom, 
      dateDebut, 
      dateFin, 
      salarieIds,
      ville,
      chantier,
      assignMedecins = true
    } = req.body;

    if (!nom || !dateDebut || !dateFin) {
      return res.status(400).json({
        success: false,
        message: 'Nom, date de début et date de fin requis'
      });
    }

    const startDate = new Date(dateDebut);
    const endDate = new Date(dateFin);
    const now = new Date();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    let salariesToPlan = [];

    if (salarieIds && salarieIds.length > 0) {
      salariesToPlan = await prisma.salarie.findMany({
        where: {
          id: { in: salarieIds.map(id => parseInt(id)) },
          actif: true
        },
        include: {
          visites: {
            orderBy: { dateVisite: 'desc' },
            take: 1
          }
        }
      });
    } else {
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

      salariesToPlan = allSalaries.filter(s => {
        const derniereVisite = s.visites[0];
        return !derniereVisite || derniereVisite.dateVisite < twelveMonthsAgo;
      });
    }

    if (salariesToPlan.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucun salarié à planifier'
      });
    }

    const medecins = await prisma.medecin.findMany({
      where: { actif: true }
    });

    const medecinsByVille = {};
    medecins.forEach(m => {
      const villes = JSON.parse(m.villes || '[]');
      villes.forEach(v => {
        if (!medecinsByVille[v.toUpperCase()]) {
          medecinsByVille[v.toUpperCase()] = [];
        }
        medecinsByVille[v.toUpperCase()].push(m);
      });
    });

    const daysBetween = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const workingDays = [];
    
    for (let i = 0; i < daysBetween; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays.push(new Date(date));
      }
    }

    if (workingDays.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucun jour ouvrable dans la période sélectionnée'
      });
    }

    const visitesParJour = Math.ceil(salariesToPlan.length / workingDays.length);
    const maxVisitesParJour = 30;
    const visitesEffectivesParJour = Math.min(visitesParJour, maxVisitesParJour);

    const plannedVisites = [];
    let dayIndex = 0;
    let visitesAujourdhui = 0;

    for (const salarie of salariesToPlan) {
      if (visitesAujourdhui >= visitesEffectivesParJour) {
        dayIndex++;
        visitesAujourdhui = 0;
      }

      if (dayIndex >= workingDays.length) {
        break;
      }

      const dateVisite = workingDays[dayIndex];
      let medecin = null;

      if (assignMedecins && salarie.ville) {
        const villeKey = salarie.ville.toUpperCase();
        const medecinsPossibles = medecinsByVille[villeKey] || medecins;
        if (medecinsPossibles.length > 0) {
          medecin = medecinsPossibles[Math.floor(Math.random() * medecinsPossibles.length)];
        }
      }

      plannedVisites.push({
        salarieId: salarie.id,
        matricule: salarie.matricule,
        nom: salarie.nom,
        prenom: salarie.prenom,
        fonction: salarie.fonction,
        typeFonction: salarie.typeFonction,
        chantier: salarie.chantier,
        ville: salarie.ville,
        dateVisite: dateVisite.toISOString(),
        medecinId: medecin?.id || null,
        medecinNom: medecin ? `${medecin.nom} ${medecin.prenom || ''}`.trim() : null,
        derniereVisite: salarie.visites[0]?.dateVisite || null
      });

      visitesAujourdhui++;
    }

    const planning = await prisma.planning.create({
      data: {
        nom,
        dateDebut: startDate,
        dateFin: endDate,
        totalVisites: plannedVisites.length,
        status: 'BROUILLON',
        data: JSON.stringify(plannedVisites)
      }
    });

    res.status(201).json({
      success: true,
      message: `Planning créé avec ${plannedVisites.length} visites`,
      data: {
        id: planning.id,
        nom: planning.nom,
        dateDebut: planning.dateDebut,
        dateFin: planning.dateFin,
        totalVisites: planning.totalVisites,
        status: planning.status,
        visites: plannedVisites
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nom, visites, data } = req.body;

    const updateData = {};
    if (nom) updateData.nom = nom;
    if (visites) {
      updateData.data = JSON.stringify(visites);
      updateData.totalVisites = visites.length;
    }
    if (data) {
      updateData.data = JSON.stringify(data);
    }

    const planning = await prisma.planning.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    res.json({
      success: true,
      message: 'Planning mis à jour',
      data: {
        ...planning,
        data: JSON.parse(planning.data)
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Récupérer le planning pour vérifier s'il est validé
    const planning = await prisma.planning.findUnique({
      where: { id: parseInt(id) }
    });

    if (!planning) {
      return res.status(404).json({
        success: false,
        message: 'Planning non trouvé'
      });
    }

    // Si le planning est validé, supprimer les visites associées
    if (planning.status === 'VALIDE') {
      const planningData = JSON.parse(planning.data);
      
      if (planningData.chantiers) {
        // Format par chantier
        const salarieIds = planningData.chantiers.flatMap(ch => 
          ch.salaries.map(s => s.salarieId)
        );
        
        // Supprimer les visites PLANIFIEES créées par ce planning
        await prisma.visite.deleteMany({
          where: {
            salarieId: { in: salarieIds },
            statut: 'PLANIFIEE',
            dateVisite: {
              gte: planning.dateDebut,
              lte: planning.dateFin
            }
          }
        });
      }
    }

    await prisma.planning.delete({
      where: { id: parseInt(id) }
    });

    res.json({
      success: true,
      message: 'Planning supprimé'
    });
  } catch (error) {
    next(error);
  }
};

exports.validate = async (req, res, next) => {
  try {
    const { id } = req.params;

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
    let visitesCreees = 0;

    // Gérer le format par chantier
    if (planningData.chantiers) {
      for (const chantier of planningData.chantiers) {
        for (const salarie of chantier.salaries) {
          const dateVisite = new Date(chantier.dateVisite);
          const dateVisiteProchaine = new Date(dateVisite);
          dateVisiteProchaine.setFullYear(dateVisiteProchaine.getFullYear() + 1);

          await prisma.visite.create({
            data: {
              salarieId: salarie.salarieId,
              medecinId: chantier.medecinId,
              dateVisite,
              dateVisiteProchaine,
              chantier: chantier.chantier,
              ville: chantier.ville,
              statut: 'PLANIFIEE'
            }
          });
          visitesCreees++;
        }
      }
    } else {
      // Ancien format (liste plate)
      for (const visite of planningData) {
        const dateVisite = new Date(visite.dateVisite);
        const dateVisiteProchaine = new Date(dateVisite);
        dateVisiteProchaine.setFullYear(dateVisiteProchaine.getFullYear() + 1);

        await prisma.visite.create({
          data: {
            salarieId: visite.salarieId,
            medecinId: visite.medecinId,
            dateVisite,
            dateVisiteProchaine,
            chantier: visite.chantier,
            ville: visite.ville,
            statut: 'PLANIFIEE'
          }
        });
        visitesCreees++;
      }
    }

    await prisma.planning.update({
      where: { id: parseInt(id) },
      data: { status: 'VALIDE' }
    });

    res.json({
      success: true,
      message: `Planning validé: ${visitesCreees} visites créées`,
      data: { visitesCreees }
    });
  } catch (error) {
    next(error);
  }
};
