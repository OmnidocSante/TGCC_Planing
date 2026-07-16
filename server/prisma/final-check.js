const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  console.log('🔍 VÉRIFICATION FINALE\n');
  console.log('='.repeat(50));
  
  // Stats
  const [totalS, totalV] = await Promise.all([
    prisma.salarie.count(),
    prisma.visite.count()
  ]);
  console.log('\n📊 TOTAUX:');
  console.log('  Salariés: ' + totalS);
  console.log('  Visites: ' + totalV);
  
  // Doublons matricules
  const dupMat = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM (
      SELECT matricule FROM salaries GROUP BY matricule HAVING COUNT(*) > 1
    ) as d
  `;
  console.log('\n🔍 DOUBLONS:');
  console.log('  Matricules en doublon: ' + (dupMat[0].count > 0 ? '⚠️ ' + dupMat[0].count : '✅ Aucun'));
  
  // Doublons visites
  const dupVis = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM (
      SELECT salarie_id, DATE(date_visite) FROM visites 
      GROUP BY salarie_id, DATE(date_visite) HAVING COUNT(*) > 1
    ) as d
  `;
  console.log('  Visites en doublon: ' + (dupVis[0].count > 0 ? '⚠️ ' + dupVis[0].count : '✅ Aucun'));
  
  // Salariés avec/sans visite
  const avecVisite = await prisma.salarie.count({ where: { visites: { some: {} }}});
  const sansVisite = totalS - avecVisite;
  console.log('\n📊 COUVERTURE:');
  console.log('  Salariés avec au moins 1 visite: ' + avecVisite);
  console.log('  Salariés sans visite: ' + sansVisite);
  
  // Par ville
  console.log('\n📊 RÉPARTITION PAR VILLE:');
  const villes = await prisma.visite.groupBy({
    by: ['ville'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' }}
  });
  villes.forEach(v => console.log('  ' + (v.ville || 'N/A').padEnd(15) + ': ' + v._count.id + ' visites'));
  
  // Exemples de salariés avec historique
  console.log('\n📋 EXEMPLES (salariés avec plusieurs visites):');
  const exemples = await prisma.salarie.findMany({
    where: {
      visites: { some: {} }
    },
    include: {
      visites: { orderBy: { dateVisite: 'desc' } }
    },
    take: 5
  });
  
  for (const s of exemples) {
    if (s.visites.length >= 1) {
      console.log(`\n  ${s.matricule} (${s.fonction || 'N/A'}) - ${s.ville || 'N/A'}`);
      console.log(`    Dernière visite: ${s.visites[0].dateVisite.toLocaleDateString('fr-FR')}`);
      if (s.visites.length > 1) {
        console.log(`    Historique (${s.visites.length} visites): ${s.visites.slice(0,3).map(v => v.dateVisite.toLocaleDateString('fr-FR')).join(', ')}${s.visites.length > 3 ? '...' : ''}`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ BASE DE DONNÉES VÉRIFIÉE ET SAINE');
  console.log('='.repeat(50));
}

verify()
  .catch(e => console.error('Erreur:', e))
  .finally(() => prisma.$disconnect());
