// Demo seed: ~36 services across 10 groups (Zoofy-style breadth), 4 demo
// users, ~14 jobs in every status, chat history on completed jobs, sample
// reviews. Re-runs whenever the storage key is bumped.
(function () {
  const KR = (window.KR = window.KR || {});

  // Service catalog. Mirrors backend/prisma/seed.ts.
  const SERVICE_CATALOG = [
    { group: 'Klussen & renovatie', services: [
      { name: 'Klusjesman',         slug: 'klusjesman',         icon: '🔨', desc: 'Kleine reparaties en allround klussen' },
      { name: 'Aannemer',            slug: 'aannemer',            icon: '🏗️', desc: 'Bouw & verbouwen van A tot Z' },
      { name: 'Renovatie',           slug: 'renovatie',           icon: '🛠️', desc: 'Volledige renovatieprojecten' },
    ]},
    { group: 'Elektra & energie', services: [
      { name: 'Elektricien',         slug: 'elektricien',         icon: '⚡', desc: 'Stopcontacten, groepenkast, verlichting' },
      { name: 'Zonnepanelen',        slug: 'zonnepanelen',        icon: '☀️', desc: 'Installatie en service' },
      { name: 'Laadpaal',            slug: 'laadpaal',            icon: '🔌', desc: 'Plaatsing & aansluiting' },
      { name: 'Domotica',            slug: 'domotica',            icon: '🏠', desc: 'Smart home installateurs' },
    ]},
    { group: 'Loodgieter & sanitair', services: [
      { name: 'Loodgieter',          slug: 'loodgieter',          icon: '🚿', desc: 'Lekkages, kranen, sanitair' },
      { name: 'Ontstopping',         slug: 'ontstopping',         icon: '🌀', desc: 'Riool & afvoer ontstoppen' },
      { name: 'Boilerinstallateur',  slug: 'boilerinstallateur',  icon: '🔥', desc: 'Boiler plaatsen of vervangen' },
    ]},
    { group: 'Verwarming & koeling', services: [
      { name: 'CV-monteur',          slug: 'cv-monteur',          icon: '♨️', desc: 'CV-ketel onderhoud & storingen' },
      { name: 'Airco',               slug: 'airco',               icon: '❄️', desc: 'Airco-installatie & service' },
      { name: 'Warmtepomp',          slug: 'warmtepomp',          icon: '🌡️', desc: 'Warmtepomp specialisten' },
    ]},
    { group: 'Dak & gevel', services: [
      { name: 'Dakdekker',           slug: 'dakdekker',           icon: '🏘️', desc: 'Dakwerk, lekkages, isolatie' },
      { name: 'Schoorsteenveger',    slug: 'schoorsteenveger',    icon: '🧹', desc: 'Schoorsteen vegen & inspectie' },
      { name: 'Dakgootreiniging',    slug: 'dakgootreiniging',    icon: '🪣', desc: 'Goten en hemelwaterafvoer' },
      { name: 'Gevelreiniging',      slug: 'gevelreiniging',      icon: '🧽', desc: 'Gevel reinigen & impregneren' },
    ]},
    { group: 'Vloeren & wanden', services: [
      { name: 'Schilder',            slug: 'schilder',            icon: '🎨', desc: 'Binnen- en buitenschilderwerk' },
      { name: 'Behanger',            slug: 'behanger',            icon: '🖼️', desc: 'Behang verwijderen en plaatsen' },
      { name: 'Stukadoor',           slug: 'stukadoor',           icon: '🧱', desc: 'Pleisterwerk & spachtelputz' },
      { name: 'Tegelzetter',         slug: 'tegelzetter',         icon: '◼️', desc: 'Vloer- en wandtegels' },
      { name: 'Vloerlegger',         slug: 'vloerlegger',         icon: '🟫', desc: 'PVC, laminaat, parket' },
      { name: 'Stoffeerder',         slug: 'stoffeerder',         icon: '🪡', desc: 'Tapijt & meubelstoffering' },
    ]},
    { group: 'Keuken, bad & meubel', services: [
      { name: 'Keukenmonteur',       slug: 'keukenmonteur',       icon: '🍳', desc: 'Keuken plaatsen & aansluiten' },
      { name: 'Badkamerrenovatie',   slug: 'badkamerrenovatie',   icon: '🛁', desc: 'Volledige badkamer-renovatie' },
      { name: 'Meubelmontage',       slug: 'meubelmontage',       icon: '📦', desc: 'IKEA & meubel monteren' },
      { name: 'Witgoed reparatie',   slug: 'witgoed-reparatie',   icon: '🧺', desc: 'Wasmachine, vaatwasser, droger' },
    ]},
    { group: 'Tuin & buiten', services: [
      { name: 'Hovenier',            slug: 'hovenier',            icon: '🌿', desc: 'Tuinaanleg & onderhoud' },
      { name: 'Boomverzorging',      slug: 'boomverzorging',      icon: '🌳', desc: 'Snoeien, kappen, rooien' },
      { name: 'Stratenmaker',        slug: 'stratenmaker',        icon: '🧱', desc: 'Bestrating & paden' },
      { name: 'Schuttingbouw',       slug: 'schuttingbouw',       icon: '🪵', desc: 'Schuttingen plaatsen' },
    ]},
    { group: 'Schoonmaak & beveiliging', services: [
      { name: 'Schoonmaak',          slug: 'schoonmaak',          icon: '🧴', desc: 'Huishoudelijke schoonmaak' },
      { name: 'Glazenwasser',        slug: 'glazenwasser',        icon: '🪟', desc: 'Ramen lappen binnen & buiten' },
      { name: 'Ongediertebestrijding', slug: 'ongediertebestrijding', icon: '🐜', desc: 'Wespen, muizen, kakkerlakken' },
      { name: 'Slotenmaker',         slug: 'slotenmaker',         icon: '🔑', desc: 'Sloten openen & vervangen' },
      { name: 'Alarminstallateur',   slug: 'alarminstallateur',   icon: '🚨', desc: 'Alarm- en camerasystemen' },
    ]},
    { group: 'Verhuizen, IT & glas', services: [
      { name: 'Verhuizer',           slug: 'verhuizer',           icon: '🚚', desc: 'Verhuizingen & transport' },
      { name: 'IT-hulp aan huis',    slug: 'it-hulp',             icon: '💻', desc: 'Computer- en netwerkhulp' },
      { name: 'Antennemonteur',      slug: 'antennemonteur',      icon: '📡', desc: 'Schotel, antenne, tv-ophanging' },
      { name: 'Glaszetter',          slug: 'glaszetter',          icon: '🪞', desc: 'Glas plaatsen & repareren' },
    ]},
  ];

  // Flatten with deterministic mock available-counts so the discovery page
  // can show "≥ X vakmannen beschikbaar" without storing extra state.
  function buildCatalog(newId) {
    const out = [];
    SERVICE_CATALOG.forEach((g) => {
      g.services.forEach((s) => {
        const seed = s.slug.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
        const avail = 6 + (seed % 42); // 6..47
        out.push({
          id: newId('c_'),
          name: s.name,
          slug: s.slug,
          icon: s.icon,
          group: g.group,
          desc: s.desc,
          avail,
        });
      });
    });
    return out;
  }

  // Expose grouped catalog so screens can render the discovery page.
  KR.SERVICE_GROUPS = SERVICE_CATALOG.map((g) => g.group);

  function seedIfEmpty() {
    const Store = KR.MockStore;
    if (!Store) return;
    if (Store.isSeeded()) return;

    const now = new Date();
    const minutesAgo = (m) => new Date(now.getTime() - m * 60_000).toISOString();
    const hoursAgo = (h) => minutesAgo(h * 60);
    const daysAgo = (d) => hoursAgo(d * 24);

    Store.applySeed(({ addCategory, addUser, addJob, addMessage, addReview, newId }) => {
      const cats = buildCatalog(newId);
      cats.forEach(addCategory);
      const byslug = (slug) => cats.find((c) => c.slug === slug);

      // ---------- Users ----------
      const client = {
        id: newId('u_'),
        email: 'klant@klusraak.nl',
        passwordHash: 'Demo1234!',
        name: 'Demo Klant',
        phone: '+31 6 12345678',
        role: 'CLIENT',
        avatarUrl: null,
        createdAt: daysAgo(14),
        updatedAt: daysAgo(14),
      };
      const client2 = {
        id: newId('u_'),
        email: 'sanne@klusraak.nl',
        passwordHash: 'Demo1234!',
        name: 'Sanne de Vries',
        phone: '+31 6 22334455',
        role: 'CLIENT',
        avatarUrl: null,
        createdAt: daysAgo(8),
        updatedAt: daysAgo(8),
      };

      const craftsman = {
        id: newId('u_'),
        email: 'vakman@klusraak.nl',
        passwordHash: 'Demo1234!',
        name: 'Demo Vakman',
        phone: '+31 6 87654321',
        role: 'CRAFTSMAN',
        avatarUrl: null,
        createdAt: daysAgo(60),
        updatedAt: daysAgo(60),
      };
      craftsman.craftsmanProfile = {
        id: newId('cp_'), userId: craftsman.id,
        kvkNumber: '12345678',
        bio: 'Allround vakman uit Amsterdam met 12 jaar ervaring. Snel ter plaatse.',
        hourlyRate: 5500, city: 'Amsterdam', verified: true, categories: [],
        createdAt: daysAgo(60), updatedAt: daysAgo(60),
      };
      const craftsman2 = {
        id: newId('u_'),
        email: 'mehmet@klusraak.nl',
        passwordHash: 'Demo1234!',
        name: 'Mehmet Yilmaz',
        phone: '+31 6 99887766',
        role: 'CRAFTSMAN',
        avatarUrl: null,
        createdAt: daysAgo(45),
        updatedAt: daysAgo(45),
      };
      craftsman2.craftsmanProfile = {
        id: newId('cp_'), userId: craftsman2.id,
        kvkNumber: '87654321',
        bio: 'Tegelzetter en stukadoor. Werkt door heel de Randstad.',
        hourlyRate: 4900, city: 'Rotterdam', verified: true, categories: [],
        createdAt: daysAgo(45), updatedAt: daysAgo(45),
      };

      addUser(client); addUser(client2); addUser(craftsman); addUser(craftsman2);

      // ---------- Jobs ----------
      // Mix of statuses so all UI states are represented.
      const jobs = [
        // OPEN — for craftsman feed + chips filter
        { cat: 'elektricien', title: 'Stopcontact in keuken vervangen', desc: 'Bestaand stopcontact werkt niet meer; graag vervangen door een geaard exemplaar.', city: 'Amsterdam', pc: '1015AB', euro: 85, ago: 90 },
        { cat: 'loodgieter', title: 'Lekkende kraan in badkamer', desc: 'Mengkraan druppelt al een week. Onderdeel mag vervangen worden.', city: 'Utrecht', pc: '3511AA', euro: 60, ago: 45 },
        { cat: 'airco', title: 'Airco onderhoud appartement', desc: 'Jaarlijkse onderhoudsbeurt voor split-unit airco in slaapkamer.', city: 'Den Haag', pc: '2511BB', euro: 120, ago: 30 },
        { cat: 'hovenier', title: 'Tuin opknappen voor de zomer', desc: 'Tuin van 60m² grondig snoeien, onkruid weghalen, gras maaien.', city: 'Haarlem', pc: '2011AB', euro: 150, ago: 240 },
        { cat: 'tegelzetter', title: 'Tegels badkamer vervangen', desc: 'Oude wandtegels eruit, nieuwe tegels aanbrengen. Materiaal aanwezig.', city: 'Eindhoven', pc: '5611AB', euro: 600, ago: 360 },
        { cat: 'dakgootreiniging', title: 'Dakgoten reinigen rijtjeshuis', desc: 'Dakgoten zitten vol met blad en mos. 2 verdiepingen.', city: 'Groningen', pc: '9712AB', euro: 95, ago: 180 },
        { cat: 'meubelmontage', title: 'IKEA Pax kasten monteren', desc: '3x Pax 100cm met schuifdeuren. Doosjes liggen klaar.', city: 'Amsterdam', pc: '1054BC', euro: 110, ago: 22 },
        { cat: 'it-hulp', title: 'Wifi-bereik in huis verbeteren', desc: 'Mesh-systeem of repeaters? Hulp bij plaatsen en configureren.', city: 'Utrecht', pc: '3514CD', euro: 70, ago: 14 },

        // ASSIGNED — accepted by craftsman (Demo Vakman)
        { cat: 'schilder', title: 'Plafond woonkamer schilderen', desc: 'Plafond 4x5m, klein gaatje dichtmaken en in kleur RAL9010.', city: 'Amsterdam', pc: '1018AC', euro: 220, ago: 720, status: 'ASSIGNED', acceptBy: craftsman.id, accAgoMin: 600 },

        // IN_PROGRESS — assigned and started
        { cat: 'klusjesman', title: 'Kasten ophangen en lampen vervangen', desc: '3 kasten, 4 spotjes vervangen. Materiaal aanwezig.', city: 'Amsterdam', pc: '1097ZZ', euro: 95, ago: 1440, status: 'IN_PROGRESS', acceptBy: craftsman.id, accAgoMin: 1380, startAgoMin: 60 },

        // COMPLETED — both reviewable; will get messages + 1 review
        { cat: 'loodgieter', title: 'WC-bril vervangen', desc: 'Standaard WC-bril vervangen, onderdeel zelf in huis.', city: 'Amsterdam', pc: '1051MV', euro: 35, ago: 4320, status: 'COMPLETED', acceptBy: craftsman.id, accAgoMin: 4200, startAgoMin: 4000, doneAgoMin: 3940, clientId: client.id, withChat: true, withReview: true },
        { cat: 'tegelzetter', title: 'Voegen badkamer herstellen', desc: 'Voegen losgekomen, opnieuw inwassen.', city: 'Rotterdam', pc: '3013HK', euro: 180, ago: 7200, status: 'COMPLETED', acceptBy: craftsman2.id, accAgoMin: 7100, startAgoMin: 6900, doneAgoMin: 6800, clientId: client2.id, withChat: true, withReview: true },

        // CANCELLED — client cancelled
        { cat: 'verhuizer', title: 'Bankstel vervoeren naar nieuwe woning', desc: 'Een 3-zits bank en fauteuil verplaatsen Amsterdam → Almere.', city: 'Amsterdam', pc: '1098AB', euro: 220, ago: 2160, status: 'CANCELLED' },
      ];

      const createdJobs = [];
      for (const j of jobs) {
        const cat = byslug(j.cat) || cats[0];
        const cid = j.clientId || client.id;
        const job = {
          id: newId('j_'),
          clientId: cid,
          categoryId: cat.id,
          title: j.title,
          description: j.desc,
          city: j.city,
          postcode: j.pc || null,
          budgetCents: j.euro != null ? Math.round(j.euro * 100) : null,
          scheduledAt: null,
          status: j.status || 'OPEN',
          createdAt: minutesAgo(j.ago),
          updatedAt: minutesAgo(j.ago),
        };
        if (j.acceptBy) {
          job.assignment = {
            id: newId('a_'),
            jobId: job.id,
            craftsmanId: j.acceptBy,
            acceptedAt: minutesAgo(j.accAgoMin),
            startedAt: j.startAgoMin != null ? minutesAgo(j.startAgoMin) : null,
            completedAt: j.doneAgoMin != null ? minutesAgo(j.doneAgoMin) : null,
          };
        }
        addJob(job);
        createdJobs.push({ job, def: j });
      }

      // ---------- Messages on completed jobs ----------
      for (const cj of createdJobs.filter((cj) => cj.def.withChat && cj.job.assignment)) {
        const cid = cj.job.clientId;
        const cm = cj.job.assignment.craftsmanId;
        const base = cj.def.doneAgoMin || cj.def.ago;
        const lines = [
          { from: cid, m: 'Hoi! Hoe laat zou het uitkomen?', delta: 60 },
          { from: cm,  m: 'Goedemorgen! Ik kan rond 14:00 langskomen.', delta: 50 },
          { from: cid, m: 'Top, ik zorg dat de spullen klaarliggen.', delta: 45 },
          { from: cm,  m: 'Klus is gedaan, kun je het even controleren?', delta: 5 },
          { from: cid, m: 'Helemaal goed, dank je!', delta: 1 },
        ];
        for (const ln of lines) {
          addMessage({
            id: newId('msg_'),
            jobId: cj.job.id,
            senderId: ln.from,
            content: ln.m,
            readAt: null,
            createdAt: minutesAgo(base + ln.delta),
          });
        }
      }

      // ---------- Reviews ----------
      for (const cj of createdJobs.filter((cj) => cj.def.withReview && cj.job.assignment)) {
        addReview({
          id: newId('rv_'),
          jobId: cj.job.id,
          fromId: cj.job.clientId,
          toId: cj.job.assignment.craftsmanId,
          rating: 5,
          comment: 'Snelle en nette afhandeling, zeker een aanrader!',
          createdAt: minutesAgo((cj.def.doneAgoMin || cj.def.ago) - 30),
        });
      }
    });
  }

  KR.MockSeed = { seedIfEmpty };
})();
