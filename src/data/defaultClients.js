const PALETTE = [
  '#FDE8E8', '#FEF3C7', '#D1FAE5', '#DBEAFE', '#EDE9FE',
  '#FCE7F3', '#ECFDF5', '#FFF7ED', '#F0FDF4',
];

const CLIENT_NAMES = [
  'Teemplot', 'Wimly', 'SNT', 'Bigbelly', "Kim's Secret",
  'Zero to 16', 'FFDM', 'Bioclean', 'IPC',
];

function uuid() {
  return crypto.randomUUID();
}

function randomDate(monthsBack) {
  const d = new Date();
  d.setMonth(d.getMonth() - Math.floor(Math.random() * monthsBack));
  d.setDate(Math.floor(Math.random() * 28) + 1);
  return d.toISOString();
}

const SAMPLE_TASKS = {
  Teemplot: [
    { title: 'Design landing page mockup', done: true, paid: true, amount: 75000 },
    { title: 'Build responsive navbar', done: true, paid: true, amount: 40000 },
    { title: 'Set up analytics dashboard', done: false, paid: false, amount: 60000 },
    { title: 'Create brand style guide', done: true, paid: false, amount: 50000 },
  ],
  Wimly: [
    { title: 'Logo redesign concepts', done: true, paid: true, amount: 80000 },
    { title: 'Social media templates', done: true, paid: true, amount: 35000 },
    { title: 'Email newsletter design', done: false, paid: false, amount: 25000 },
  ],
  SNT: [
    { title: 'Product photography editing', done: true, paid: true, amount: 45000 },
    { title: 'E-commerce store setup', done: true, paid: false, amount: 120000 },
    { title: 'SEO optimization', done: false, paid: false, amount: 55000 },
  ],
  Bigbelly: [
    { title: 'Mobile app wireframes', done: true, paid: true, amount: 90000 },
    { title: 'User flow diagrams', done: true, paid: true, amount: 30000 },
    { title: 'Prototype testing report', done: true, paid: false, amount: 40000 },
    { title: 'Final UI kit delivery', done: false, paid: false, amount: 65000 },
  ],
  "Kim's Secret": [
    { title: 'Instagram content calendar', done: true, paid: true, amount: 20000 },
    { title: 'Brand photoshoot direction', done: true, paid: true, amount: 100000 },
    { title: 'Packaging design v2', done: false, paid: false, amount: 70000 },
  ],
  'Zero to 16': [
    { title: 'Course platform customization', done: true, paid: true, amount: 150000 },
    { title: 'Student dashboard UI', done: false, paid: false, amount: 80000 },
  ],
  FFDM: [
    { title: 'Event poster design', done: true, paid: true, amount: 15000 },
    { title: 'Flyer layout for launch', done: true, paid: true, amount: 15000 },
    { title: 'Social media ad creatives', done: true, paid: false, amount: 35000 },
  ],
  Bioclean: [
    { title: 'Website redesign proposal', done: true, paid: true, amount: 50000 },
    { title: 'Product label design', done: true, paid: true, amount: 40000 },
    { title: 'Corporate presentation deck', done: false, paid: false, amount: 60000 },
  ],
  IPC: [
    { title: 'Annual report layout', done: true, paid: true, amount: 85000 },
    { title: 'Internal newsletter template', done: false, paid: false, amount: 25000 },
  ],
};

export function getNextColor(clients) {
  const usedColors = new Set(clients.map((c) => c.color));
  return PALETTE.find((c) => !usedColors.has(c)) || PALETTE[clients.length % PALETTE.length];
}

export function createDefaultClients() {
  return CLIENT_NAMES.map((name, i) => ({
    id: uuid(),
    name,
    color: PALETTE[i],
    retainer: 0,
    retainerPaid: {},
    tasks: (SAMPLE_TASKS[name] || []).map((t) => ({
      id: uuid(),
      title: t.title,
      done: t.done,
      paid: t.paid,
      amount: t.amount,
      createdAt: randomDate(3),
    })),
  }));
}

export { PALETTE };
