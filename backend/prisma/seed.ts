import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Service catalog mirrors frontend/public/js/demo/mock-data.js. ~36 services
// in 10 groups so the discovery page is populated out of the box.
const CATEGORIES: { name: string; slug: string; icon: string; group: string }[] = [
  // Klussen & renovatie
  { name: 'Klusjesman',           slug: 'klusjesman',           icon: '🔨', group: 'Klussen & renovatie' },
  { name: 'Aannemer',             slug: 'aannemer',             icon: '🏗️', group: 'Klussen & renovatie' },
  { name: 'Renovatie',            slug: 'renovatie',            icon: '🛠️', group: 'Klussen & renovatie' },
  // Elektra & energie
  { name: 'Elektricien',          slug: 'elektricien',          icon: '⚡', group: 'Elektra & energie' },
  { name: 'Zonnepanelen',         slug: 'zonnepanelen',         icon: '☀️', group: 'Elektra & energie' },
  { name: 'Laadpaal',             slug: 'laadpaal',             icon: '🔌', group: 'Elektra & energie' },
  { name: 'Domotica',             slug: 'domotica',             icon: '🏠', group: 'Elektra & energie' },
  // Loodgieter & sanitair
  { name: 'Loodgieter',           slug: 'loodgieter',           icon: '🚿', group: 'Loodgieter & sanitair' },
  { name: 'Ontstopping',          slug: 'ontstopping',          icon: '🌀', group: 'Loodgieter & sanitair' },
  { name: 'Boilerinstallateur',   slug: 'boilerinstallateur',   icon: '🔥', group: 'Loodgieter & sanitair' },
  // Verwarming & koeling
  { name: 'CV-monteur',           slug: 'cv-monteur',           icon: '♨️', group: 'Verwarming & koeling' },
  { name: 'Airco',                slug: 'airco',                icon: '❄️', group: 'Verwarming & koeling' },
  { name: 'Warmtepomp',           slug: 'warmtepomp',           icon: '🌡️', group: 'Verwarming & koeling' },
  // Dak & gevel
  { name: 'Dakdekker',            slug: 'dakdekker',            icon: '🏘️', group: 'Dak & gevel' },
  { name: 'Schoorsteenveger',     slug: 'schoorsteenveger',     icon: '🧹', group: 'Dak & gevel' },
  { name: 'Dakgootreiniging',     slug: 'dakgootreiniging',     icon: '🪣', group: 'Dak & gevel' },
  { name: 'Gevelreiniging',       slug: 'gevelreiniging',       icon: '🧽', group: 'Dak & gevel' },
  // Vloeren & wanden
  { name: 'Schilder',             slug: 'schilder',             icon: '🎨', group: 'Vloeren & wanden' },
  { name: 'Behanger',             slug: 'behanger',             icon: '🖼️', group: 'Vloeren & wanden' },
  { name: 'Stukadoor',            slug: 'stukadoor',            icon: '🧱', group: 'Vloeren & wanden' },
  { name: 'Tegelzetter',          slug: 'tegelzetter',          icon: '◼️', group: 'Vloeren & wanden' },
  { name: 'Vloerlegger',          slug: 'vloerlegger',          icon: '🟫', group: 'Vloeren & wanden' },
  { name: 'Stoffeerder',          slug: 'stoffeerder',          icon: '🪡', group: 'Vloeren & wanden' },
  // Keuken, bad & meubel
  { name: 'Keukenmonteur',        slug: 'keukenmonteur',        icon: '🍳', group: 'Keuken, bad & meubel' },
  { name: 'Badkamerrenovatie',    slug: 'badkamerrenovatie',    icon: '🛁', group: 'Keuken, bad & meubel' },
  { name: 'Meubelmontage',        slug: 'meubelmontage',        icon: '📦', group: 'Keuken, bad & meubel' },
  { name: 'Witgoed reparatie',    slug: 'witgoed-reparatie',    icon: '🧺', group: 'Keuken, bad & meubel' },
  // Tuin & buiten
  { name: 'Hovenier',             slug: 'hovenier',             icon: '🌿', group: 'Tuin & buiten' },
  { name: 'Boomverzorging',       slug: 'boomverzorging',       icon: '🌳', group: 'Tuin & buiten' },
  { name: 'Stratenmaker',         slug: 'stratenmaker',         icon: '🧱', group: 'Tuin & buiten' },
  { name: 'Schuttingbouw',        slug: 'schuttingbouw',        icon: '🪵', group: 'Tuin & buiten' },
  // Schoonmaak & beveiliging
  { name: 'Schoonmaak',           slug: 'schoonmaak',           icon: '🧴', group: 'Schoonmaak & beveiliging' },
  { name: 'Glazenwasser',         slug: 'glazenwasser',         icon: '🪟', group: 'Schoonmaak & beveiliging' },
  { name: 'Ongediertebestrijding',slug: 'ongediertebestrijding',icon: '🐜', group: 'Schoonmaak & beveiliging' },
  { name: 'Slotenmaker',          slug: 'slotenmaker',          icon: '🔑', group: 'Schoonmaak & beveiliging' },
  { name: 'Alarminstallateur',    slug: 'alarminstallateur',    icon: '🚨', group: 'Schoonmaak & beveiliging' },
  // Verhuizen, IT & glas
  { name: 'Verhuizer',            slug: 'verhuizer',            icon: '🚚', group: 'Verhuizen, IT & glas' },
  { name: 'IT-hulp aan huis',     slug: 'it-hulp',              icon: '💻', group: 'Verhuizen, IT & glas' },
  { name: 'Antennemonteur',       slug: 'antennemonteur',       icon: '📡', group: 'Verhuizen, IT & glas' },
  { name: 'Glaszetter',           slug: 'glaszetter',           icon: '🪞', group: 'Verhuizen, IT & glas' },
];

async function main() {
  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, icon: c.icon, group: c.group },
      create: c,
    });
  }

  const passwordHash = await bcrypt.hash('Demo1234!', 10);

  const client = await prisma.user.upsert({
    where: { email: 'klant@klusraak.nl' },
    update: {},
    create: {
      email: 'klant@klusraak.nl',
      passwordHash,
      name: 'Demo Klant',
      role: Role.CLIENT,
      phone: '+31 6 12345678',
    },
  });

  const craftsman = await prisma.user.upsert({
    where: { email: 'vakman@klusraak.nl' },
    update: {},
    create: {
      email: 'vakman@klusraak.nl',
      passwordHash,
      name: 'Demo Vakman',
      role: Role.CRAFTSMAN,
      phone: '+31 6 87654321',
      craftsmanProfile: {
        create: {
          kvkNumber: '12345678',
          bio: 'Allround vakman met 12 jaar ervaring in renovaties.',
          hourlyRate: 4500,
          city: 'Amsterdam',
          verified: true,
        },
      },
    },
    include: { craftsmanProfile: true },
  });

  const elektricien = await prisma.category.findUnique({ where: { slug: 'elektricien' } });
  const loodgieter  = await prisma.category.findUnique({ where: { slug: 'loodgieter' } });
  const klusjesman  = await prisma.category.findUnique({ where: { slug: 'klusjesman' } });

  if (craftsman.craftsmanProfile && elektricien && loodgieter && klusjesman) {
    await prisma.categoryOnCraftsman.createMany({
      data: [
        { craftsmanId: craftsman.craftsmanProfile.id, categoryId: elektricien.id },
        { craftsmanId: craftsman.craftsmanProfile.id, categoryId: loodgieter.id },
        { craftsmanId: craftsman.craftsmanProfile.id, categoryId: klusjesman.id },
      ],
      skipDuplicates: true,
    });
  }

  if (elektricien) {
    await prisma.job.upsert({
      where: { id: 'seed-job-1' },
      update: {},
      create: {
        id: 'seed-job-1',
        clientId: client.id,
        categoryId: elektricien.id,
        title: 'Stopcontact vervangen in keuken',
        description: 'Bestaand stopcontact werkt niet meer. Graag vandaag of morgen.',
        city: 'Amsterdam',
        postcode: '1011AB',
        budgetCents: 7500,
      },
    });
  }

  console.log('Seed complete. Categories:', CATEGORIES.length);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
