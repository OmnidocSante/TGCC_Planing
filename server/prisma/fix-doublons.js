const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixDoublons() {
  console.log('🔧 CORRECTION DES DOUBLONS DE VISITES\n');
  
  // 1. Trouver tous les doublons
  const doublons = await prisma.$queryRaw`
    SELECT salarie_id, DATE(date_visite) as date_v, COUNT(*) as count,
           GROUP_CONCAT(id ORDER BY id) as ids
    FROM visites 
    GROUP BY salarie_id, DATE(date_visite)
    HAVING COUNT(*) > 1
  `;
  
  console.log(`Doublons trouvés: ${doublons.length} combinaisons`);
  
  if (doublons.length === 0) {
    console.log('✅ Aucun doublon à corriger');
    return;
  }
  
  // 2. Supprimer les doublons (garder le premier, supprimer les autres)
  let deleted = 0;
  
  for (const d of doublons) {
    const ids = d.ids.split(',').map(id => parseInt(id));
    // Garder le premier ID, supprimer les autres
    const idsToDelete = ids.slice(1);
    
    if (idsToDelete.length > 0) {
      await prisma.visite.deleteMany({
        where: { id: { in: idsToDelete } }
      });
      deleted += idsToDelete.length;
    }
  }
  
  console.log(`✅ ${deleted} visites en doublon supprimées`);
  
  // 3. Vérification
  const remaining = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM (
      SELECT salarie_id, DATE(date_visite) as date_v
      FROM visites 
      GROUP BY salarie_id, DATE(date_visite)
      HAVING COUNT(*) > 1
    ) as doublons
  `;
  
  if (remaining[0].count > 0) {
    console.log(`⚠️ Il reste ${remaining[0].count} doublons`);
  } else {
    console.log('✅ Tous les doublons ont été supprimés');
  }
  
  // 4. Stats finales
  const [totalS, totalV] = await Promise.all([
    prisma.salarie.count(),
    prisma.visite.count()
  ]);
  
  console.log(`\n📈 TOTAL APRÈS CORRECTION: ${totalS} salariés, ${totalV} visites`);
}

fixDoublons()
  .catch(e => console.error('Erreur:', e))
  .finally(() => prisma.$disconnect());
