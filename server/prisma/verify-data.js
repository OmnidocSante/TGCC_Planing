const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyData() {
  console.log('🔍 VÉRIFICATION COMPLÈTE DE LA BASE DE DONNÉES\n');
  console.log('='.repeat(60));
  
  // 1. Stats générales
  console.log('\n📊 STATISTIQUES GÉNÉRALES');
  console.log('-'.repeat(40));
  const [totalSalaries, totalVisites, totalMedecins] = await Promise.all([
    prisma.salarie.count(),
    prisma.visite.count(),
    prisma.medecin.count()
  ]);
  console.log(`  Salariés: ${totalSalaries}`);
  console.log(`  Visites: ${totalVisites}`);
  console.log(`  Médecins: ${totalMedecins}`);
  
  // 2. Vérification des doublons de matricule
  console.log('\n🔍 VÉRIFICATION DOUBLONS MATRICULES');
  console.log('-'.repeat(40));
  
  const matriculesCount = await prisma.$queryRaw`
    SELECT matricule, COUNT(*) as count 
    FROM salaries 
    GROUP BY matricule 
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    LIMIT 20
  `;
  
  if (matriculesCount.length > 0) {
    console.log(`  ⚠️ ${matriculesCount.length} matricules en doublon trouvés:`);
    matriculesCount.forEach(m => {
      console.log(`    - Matricule ${m.matricule}: ${m.count} occurrences`);
    });
  } else {
    console.log('  ✅ Aucun doublon de matricule');
  }
  
  // 3. Vérification des visites en doublon (même salarié, même date)
  console.log('\n🔍 VÉRIFICATION DOUBLONS VISITES');
  console.log('-'.repeat(40));
  
  const visitesDoublons = await prisma.$queryRaw`
    SELECT salarie_id, DATE(date_visite) as date_v, COUNT(*) as count 
    FROM visites 
    GROUP BY salarie_id, DATE(date_visite)
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    LIMIT 20
  `;
  
  if (visitesDoublons.length > 0) {
    console.log(`  ⚠️ ${visitesDoublons.length} combinaisons salarié/date en doublon:`);
    for (const v of visitesDoublons.slice(0, 10)) {
      const salarie = await prisma.salarie.findUnique({ where: { id: v.salarie_id }});
      console.log(`    - Matricule ${salarie?.matricule || v.salarie_id}, Date ${v.date_v}: ${v.count} visites`);
    }
    if (visitesDoublons.length > 10) {
      console.log(`    ... et ${visitesDoublons.length - 10} autres`);
    }
  } else {
    console.log('  ✅ Aucune visite en doublon');
  }
  
  // 4. Salariés sans matricule ou avec matricule vide
  console.log('\n🔍 VÉRIFICATION MATRICULES INVALIDES');
  console.log('-'.repeat(40));
  
  const invalidMatricules = await prisma.salarie.count({
    where: {
      OR: [
        { matricule: '' },
        { matricule: 'NaN' },
        { matricule: 'nan' },
        { matricule: null }
      ]
    }
  });
  
  if (invalidMatricules > 0) {
    console.log(`  ⚠️ ${invalidMatricules} salariés avec matricule invalide`);
  } else {
    console.log('  ✅ Tous les matricules sont valides');
  }
  
  // 5. Visites sans date
  console.log('\n🔍 VÉRIFICATION VISITES SANS DATE');
  console.log('-'.repeat(40));
  
  const visitesWithoutDate = await prisma.visite.count({
    where: { dateVisite: null }
  });
  
  if (visitesWithoutDate > 0) {
    console.log(`  ⚠️ ${visitesWithoutDate} visites sans date`);
  } else {
    console.log('  ✅ Toutes les visites ont une date');
  }
  
  // 6. Visites orphelines (salarié supprimé)
  console.log('\n🔍 VÉRIFICATION VISITES ORPHELINES');
  console.log('-'.repeat(40));
  
  const orphanVisites = await prisma.$queryRaw`
    SELECT v.id 
    FROM visites v 
    LEFT JOIN salaries s ON v.salarie_id = s.id 
    WHERE s.id IS NULL
    LIMIT 1
  `;
  
  if (orphanVisites.length > 0) {
    const countOrphan = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM visites v 
      LEFT JOIN salaries s ON v.salarie_id = s.id 
      WHERE s.id IS NULL
    `;
    console.log(`  ⚠️ ${countOrphan[0].count} visites orphelines trouvées`);
  } else {
    console.log('  ✅ Aucune visite orpheline');
  }
  
  // 7. Salariés sans visites
  console.log('\n🔍 SALARIÉS SANS VISITE');
  console.log('-'.repeat(40));
  
  const salariesSansVisite = await prisma.salarie.count({
    where: { visites: { none: {} } }
  });
  console.log(`  ${salariesSansVisite} salariés n'ont aucune visite enregistrée`);
  
  // 8. Répartition par ville
  console.log('\n📊 RÉPARTITION PAR VILLE');
  console.log('-'.repeat(40));
  
  const parVille = await prisma.visite.groupBy({
    by: ['ville'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } }
  });
  
  parVille.forEach(v => {
    console.log(`  ${(v.ville || 'N/A').padEnd(15)} : ${v._count.id} visites`);
  });
  
  // 9. Dates de visites aberrantes
  console.log('\n🔍 VÉRIFICATION DATES ABERRANTES');
  console.log('-'.repeat(40));
  
  const now = new Date();
  const tooOld = new Date('2020-01-01');
  const tooNew = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // +1 an
  
  const [oldDates, futureDates] = await Promise.all([
    prisma.visite.count({ where: { dateVisite: { lt: tooOld } } }),
    prisma.visite.count({ where: { dateVisite: { gt: tooNew } } })
  ]);
  
  if (oldDates > 0) {
    console.log(`  ⚠️ ${oldDates} visites avant 2020`);
  }
  if (futureDates > 0) {
    console.log(`  ⚠️ ${futureDates} visites dans le futur (>1 an)`);
  }
  if (oldDates === 0 && futureDates === 0) {
    console.log('  ✅ Toutes les dates sont dans une plage normale');
  }
  
  // 10. Exemples de données
  console.log('\n📋 EXEMPLES DE DONNÉES');
  console.log('-'.repeat(40));
  
  const exemples = await prisma.salarie.findMany({
    take: 5,
    include: {
      visites: {
        orderBy: { dateVisite: 'desc' },
        take: 3
      }
    }
  });
  
  exemples.forEach(s => {
    console.log(`\n  Matricule: ${s.matricule}`);
    console.log(`  Fonction: ${s.fonction || 'N/A'} | Type: ${s.typeFonction || 'N/A'}`);
    console.log(`  Chantier: ${s.chantier || 'N/A'} | Ville: ${s.ville || 'N/A'}`);
    if (s.visites.length > 0) {
      console.log(`  Visites (${s.visites.length}): ${s.visites.map(v => v.dateVisite.toLocaleDateString('fr-FR')).join(', ')}`);
    } else {
      console.log('  Visites: Aucune');
    }
  });
  
  // 11. Résumé final
  console.log('\n' + '='.repeat(60));
  console.log('📈 RÉSUMÉ DE LA VÉRIFICATION');
  console.log('='.repeat(60));
  
  const issues = [];
  if (matriculesCount.length > 0) issues.push(`${matriculesCount.length} doublons matricules`);
  if (visitesDoublons.length > 0) issues.push(`${visitesDoublons.length} doublons visites`);
  if (invalidMatricules > 0) issues.push(`${invalidMatricules} matricules invalides`);
  if (visitesWithoutDate > 0) issues.push(`${visitesWithoutDate} visites sans date`);
  
  if (issues.length === 0) {
    console.log('\n  ✅ BASE DE DONNÉES SAINE - Aucun problème détecté');
  } else {
    console.log('\n  ⚠️ PROBLÈMES DÉTECTÉS:');
    issues.forEach(i => console.log(`    - ${i}`));
  }
  
  console.log(`\n  Total: ${totalSalaries} salariés, ${totalVisites} visites`);
}

verifyData()
  .catch(e => console.error('Erreur:', e))
  .finally(() => prisma.$disconnect());
