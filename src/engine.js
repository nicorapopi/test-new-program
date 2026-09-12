import { LAWS, EVENTS, INTERVENTIONS, METRICS } from './catalog.js';
import { ensurePeople, stepPeople } from './people.js';

export const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
export function hash(text) {
  let h = 2166136261;
  for (const c of String(text)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0 || 1;
}
function random(world) {
  let x = world.rng;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  world.rng = x >>> 0;
  return world.rng / 4294967296;
}
function apply(world, effects) {
  const actual = {};
  for (const [key, value] of Object.entries(effects)) {
    const before = world.metrics[key];
    world.metrics[key] = clamp(before + value);
    actual[key] = world.metrics[key] - before;
  }
  return actual;
}
export function createWorld({ name, seed, laws }) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) throw new Error('ชื่อโลกต้องมีความยาว 1–80 ตัวอักษร');
  if (!Array.isArray(laws) || laws.length < 1 || laws.length > 3 || new Set(laws).size !== laws.length || laws.some(id => !LAWS.some(l => l.id === id))) throw new Error('เลือกกฎที่ไม่ซ้ำกัน 1–3 ข้อ');
  if (typeof seed !== 'string' || seed.length > 100) throw new Error('เมล็ดกำเนิดต้องเป็นข้อความไม่เกิน 100 ตัวอักษร');
  return ensurePeople({
    name: name.trim(), seed, laws: [...laws], year: 0, rng: hash(seed),
    metrics: Object.fromEntries(Object.keys(METRICS).map(k => [k, 50])),
    population: 1200, history: [], artifacts: [], snapshots: [], credits: 3,
    parentId: null, branchYear: null,
  });
}
export function advance(input, years = 1) {
  if (!Number.isInteger(years) || years < 1 || years > 50) throw new Error('จำลองได้ครั้งละ 1–50 ปี');
  if (input.year + years > 2000) throw new Error('แต่ละเส้นเวลาจำลองได้สูงสุด 2,000 ปี');
  const world = ensurePeople(structuredClone(input));
  for (let step = 0; step < years; step++) {
    world.year++;
    const before = { ...world.metrics };
    // Laws drift gently; feedback prevents every world converging immediately to an extreme.
    for (const id of world.laws) {
      const law = LAWS.find(l => l.id === id);
      apply(world, Object.fromEntries(Object.entries(law.effects).map(([k, v]) => [k, v * .3])));
    }
    for (const key of Object.keys(world.metrics)) world.metrics[key] += (50 - world.metrics[key]) * .025;
    const event = EVENTS[Math.floor(random(world) * EVENTS.length)];
    const lawId = world.laws[Math.floor(random(world) * world.laws.length)];
    const law = LAWS.find(l => l.id === lawId);
    apply(world, event.effects);
    const interaction = world.laws.includes('dream') && world.laws.includes('memory') && world.year % 5 === 0;
    if (interaction) apply(world, { wonder: 5, knowledge: -3 });
    let crisis = '';
    if (world.metrics.ecology < 20) { apply(world, { stability: -3 }); crisis = 'ระบบนิเวศวิกฤต การอพยพเริ่มต้นขึ้น'; }
    else if (world.metrics.stability < 20) { apply(world, { empathy: -2, freedom: 2 }); crisis = 'สถาบันเดิมสั่นคลอน ชุมชนเริ่มปกครองตนเอง'; }
    const growth = (world.metrics.stability + world.metrics.ecology - 85) / 2500 + (random(world) - .5) * .018;
    world.population = clamp(Math.round(world.population * (1 + growth)), 50, 1000000);
    for (const key of Object.keys(world.metrics)) world.metrics[key] = Math.round(clamp(world.metrics[key]) * 10) / 10;
    const entry = {
      id: `event-${world.year}`, year: world.year, kind: crisis ? 'crisis' : 'event',
      title: interaction ? 'เมืองฝันถึงสิ่งที่ถูกใช้จ่ายไปแล้ว' : event.title,
      text: interaction ? 'ความทรงจำที่ถูกแลกเป็นเงินกลับมาเป็นอาคารในความฝัน เจ้าของเดิมเดินผ่านบ้านที่จำไม่ได้ว่าเคยอยู่' : event.text.replaceAll('{motif}', law.motif),
      crisis, law: law.id,
      effects: Object.fromEntries(Object.keys(before).map(k => [k, Math.round((world.metrics[k] - before[k]) * 10) / 10])),
    };
    const actor = stepPeople(world, entry);
    entry.effects = Object.fromEntries(Object.keys(before).map(k => [k, Math.round((world.metrics[k] - before[k]) * 10) / 10]));
    world.history.push(entry);
    if (random(world) > .55 || world.year === 1) {
      const rarity = world.metrics.wonder > 75 ? 'มหัศจรรย์' : world.metrics.wonder > 55 ? 'หายาก' : 'สามัญ';
      world.artifacts.push({
        id: `artifact-${world.year}`, year: world.year,
        name: interaction ? 'บ้านของความทรงจำที่ถูกขาย' : event.artifact,
        description: `พบในปีที่ ${world.year} หลังเหตุการณ์ “${entry.title}” วัตถุชิ้นนี้เป็นหลักฐานของโลกที่${law.name} และของผู้คนที่เรียนรู้จะอยู่กับมัน`,
        law: law.id, rarity, featured: false, note: '', keeperId: actor.id,
      });
    }
    world.snapshots.push({ year: world.year, metrics: { ...world.metrics }, population: world.population });
    if (world.year % 5 === 0) world.credits = Math.min(8, world.credits + 1);
  }
  return world;
}
export function intervene(input, id) {
  const action = INTERVENTIONS.find(i => i.id === id);
  if (!action) throw new Error('ไม่พบการแทรกแซงนี้');
  if (input.credits <= 0) throw new Error('พลังแทรกแซงหมด จำลองอีกจนถึงปีที่หารด้วย 5 ลงตัวเพื่อฟื้นพลัง');
  const world = ensurePeople(structuredClone(input));
  const effects = apply(world, action.effects);
  world.credits--;
  world.history.push({ id: `action-${world.year}-${world.history.length}`, year: world.year, kind: 'intervention', title: action.name, text: 'ผู้ดูแลเส้นเวลาแทรกแซงทิศทางของเมือง', effects });
  world.snapshots.push({ year: world.year, metrics: { ...world.metrics }, population: world.population });
  return world;
}
export function branch(input, { name, laws }, parentId) {
  createWorld({ name, seed: input.seed, laws }); // Same validation as a new world.
  const world = ensurePeople(structuredClone(input));
  world.name = name.trim(); world.laws = [...laws]; world.parentId = parentId; world.branchYear = input.year;
  return world;
}
