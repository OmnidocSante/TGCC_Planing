const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('Omnidoc@2026', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'support@omnidoc.ma' },
    update: {
      password: adminPassword,
      name: 'Support OmnidocSanté',
      role: 'ADMIN'
    },
    create: {
      email: 'support@omnidoc.ma',
      password: adminPassword,
      name: 'Support OmnidocSanté',
      role: 'ADMIN'
    }
  });
  console.log('✅ Admin user created:', admin.email);

  // Create sample doctors
  const medecins = [
    { nom: 'LATIF', prenom: 'Mohamed', villes: ['CASA', 'CASABLANCA'], telephone: '0600000001' },
    { nom: 'LAHCEN', prenom: 'Ahmed', villes: ['RABAT', 'KENITRA'], telephone: '0600000002' },
    { nom: 'BENNANI', prenom: 'Fatima', villes: ['MARRAKECH', 'BENGUERIR'], telephone: '0600000003' },
    { nom: 'ALAOUI', prenom: 'Hassan', villes: ['TANGER', 'TETOUANE'], telephone: '0600000004' },
    { nom: 'IDRISSI', prenom: 'Karim', villes: ['FES', 'KHEMISSAT'], telephone: '0600000005' },
    { nom: 'BERRADA', prenom: 'Sara', villes: ['AGADIR', 'SAFI'], telephone: '0600000006' },
    { nom: 'KETTANI', prenom: 'Youssef', villes: ['JORF', 'YOUSSOUFIA'], telephone: '0600000007' },
    { nom: 'CHRAIBI', prenom: 'Laila', villes: ['NADOR', 'HOUCEIMA'], telephone: '0600000008' }
  ];

  for (const medecin of medecins) {
    await prisma.medecin.upsert({
      where: { id: medecins.indexOf(medecin) + 1 },
      update: {},
      create: {
        nom: medecin.nom,
        prenom: medecin.prenom,
        villes: JSON.stringify(medecin.villes),
        telephone: medecin.telephone
      }
    });
  }
  console.log('✅ Médecins created:', medecins.length);

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
