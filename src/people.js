import { LAWS } from './catalog.js';

const names = ['อิงดาว', 'ต้นน้ำ', 'เมฆา', 'นับฝน', 'ทอแสง', 'ลานลม', 'ขวัญข้าว', 'วาดฟ้า', 'ปลายฝัน', 'อุ่นดิน', 'สายหมอก', 'ร้อยดาว'];
const families = ['เรือนจันทร์', 'ริมธาร', 'สวนเงา', 'บ้านลม', 'หอฝัน', 'ลานฝน', 'เนินดาว', 'คลองเงียบ'];
const traits = ['นักสำรวจ', 'ผู้ดูแล', 'นักตั้งคำถาม', 'นักสร้างสรรค์'];
const jobs = { memory: 'ผู้เก็บความทรงจำ', dream: 'สถาปนิกความฝัน', forest: 'ล่ามประจำต้นไม้', time: 'ช่างชั่งเวลา', silence: 'วิศวกรความเงียบ', shadow: 'ผู้ไกล่เกลี่ยเงา', rain: 'นักฟังความเศร้า', truth: 'นักจำแนกผีเสื้อ' };
export const NEEDS = { security: 'ความมั่นคง', belonging: 'ความผูกพัน', purpose: 'ความหมายในชีวิต' };
// Independent, keyed randomness: observing or following a person never consumes the world's RNG.
function roll(world, key) {
  let h = 2166136261;
  for (const c of `${world.seed}|${key}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}
const bounded = n => Math.round(Math.max(0, Math.min(100, n)) * 10) / 10;
function remember(person, year, text, extra = {}) { person.memories.push({ year, text, ...extra }); }
function person(world, family, generation, predecessor = null) {
  const key = `person-${world.peopleStartedAt}-${family}-${generation}`;
  const id = `${key}${predecessor ? `-${world.id || 'simulation'}` : ''}`;
  const age = predecessor ? 18 : 18 + Math.floor(roll(world, `${key}:age`) * 30);
  const law = world.laws[family % world.laws.length];
  return { id, name: `${names[Math.floor(roll(world, `${key}:name`) * names.length)]} ${families[family]}`, family, generation,
    age, bornYear: world.year - age, joinedYear: world.year, deathYear: null, predecessorId: predecessor?.id || null,
    lifespan: 76 + Math.floor(roll(world, `${key}:life`) * 20), trait: traits[family % traits.length], job: jobs[law], vocation: law,
    needs: { security: 55, belonging: 55, purpose: 55 }, followed: predecessor?.followed || false,
    relationships: [], memories: [{ year: world.year, text: predecessor ? `เข้าร่วมทะเบียนเมื่ออายุ 18 ปี เพื่อสืบต่องานของ ${predecessor.name}` : 'เริ่มบันทึกชีวิตจากปีนี้ ประวัติก่อนเข้าทะเบียนยังไม่ทราบ' }],
  };
}
export function ensurePeople(world) {
  if (world.peopleVersion === 1) return world;
  world.peopleVersion = 1; world.peopleStartedAt = world.year;
  world.peopleOrigin = world.id || `seed:${world.seed}`;
  world.people = families.map((_, i) => person(world, i, 1));
  for (let i = 0; i < world.people.length; i++) {
    const a = world.people[i], b = world.people[(i + 1) % world.people.length];
    a.relationships.push({ id: b.id, kind: 'เพื่อนบ้าน', strength: 50 });
    b.relationships.push({ id: a.id, kind: 'เพื่อนบ้าน', strength: 50 });
  }
  return world;
}
export function stepPeople(world, event) {
  const living = world.people.filter(p => p.deathYear === null);
  for (const p of living) {
    p.age++;
    if (p.age >= p.lifespan) {
      p.deathYear = world.year;
      remember(p, world.year, `จากไปเมื่ออายุ ${p.age} ปี โดยทิ้งบันทึกชีวิตไว้ให้คนรุ่นถัดไป`);
      const successor = person(world, p.family, p.generation + 1, p);
      p.relationships.push({ id: successor.id, kind: 'ผู้สืบทอด', strength: 100 });
      successor.relationships.push({ id: p.id, kind: 'ผู้ส่งต่องาน', strength: 100 });
      world.people.push(successor);
      continue;
    }
    const fit = world.laws.includes(p.vocation);
    p.needs.security = bounded(p.needs.security + (world.metrics.stability - 50) * .055 + (fit ? .6 : -1.5));
    p.needs.belonging = bounded(p.needs.belonging + (world.metrics.empathy - 50) * .055 + (world.laws.includes('rain') ? .8 : 0) - (world.laws.includes('memory') ? .7 : 0));
    p.needs.purpose = bounded(p.needs.purpose + (world.metrics.freedom - 50) * .04 + (fit ? .9 : -1.5));
    for (const rel of p.relationships) {
      if (rel.kind === 'เพื่อนบ้าน') rel.strength = bounded(rel.strength + (world.metrics.empathy - 50) * .04);
    }
    if (!fit && world.year % 3 === 0) {
      const old = p.job; p.vocation = world.laws[p.family % world.laws.length]; p.job = jobs[p.vocation];
      remember(p, world.year, `เปลี่ยนจาก ${old} เป็น ${p.job} เพราะกฎที่หล่อเลี้ยงอาชีพเดิมหายไป`, { eventId: event.id });
    }
    if (world.year % 5 === 0) {
      const law = LAWS.find(l => l.id === p.vocation);
      remember(p, world.year, `ในวันที่ “${event.title}” งาน ${p.job} ทำให้ได้เห็นผลของ${law.name} ความมั่นคงในชีวิตอยู่ที่ ${p.needs.security}/100`, { eventId: event.id });
    }
  }
  // One resident makes a consequential choice per year. The weakest need explains the decision.
  const active = world.people.filter(p => p.deathYear === null);
  const actor = active[Math.floor(roll(world, `actor:${world.year}`) * active.length)];
  const need = Object.keys(NEEDS).sort((a, b) => actor.needs[a] - actor.needs[b])[0];
  const choices = {
    security: { text: 'ชวนเพื่อนบ้านตั้งกองทุนช่วยเหลือ', metric: 'stability', gain: 6 },
    belonging: { text: 'เปิดวงรับฟังเรื่องที่ไม่มีใครอยากเล่า', metric: 'empathy', gain: 7 },
    purpose: { text: 'เปิดเวิร์กช็อปสอนอาชีพให้คนรุ่นใหม่', metric: 'knowledge', gain: 6 },
  };
  const choice = choices[need], before = world.metrics[choice.metric];
  world.metrics[choice.metric] = bounded(before + 1);
  const reason = `${NEEDS[need]}เป็นความต้องการที่ยังได้รับการเติมเต็มน้อยที่สุด (${actor.needs[need]}/100)`;
  actor.needs[need] = bounded(actor.needs[need] + choice.gain);
  const partner = active.find(p => p.id !== actor.id && p.family === (actor.family + 1) % 8);
  if (partner) {
    for (const [a, b] of [[actor, partner], [partner, actor]]) {
      let rel = a.relationships.find(r => r.id === b.id);
      if (!rel) { rel = { id: b.id, kind: 'เพื่อนบ้าน', strength: 40 }; a.relationships.push(rel); }
      rel.strength = bounded(rel.strength + 5);
    }
  }
  event.resident = { id: actor.id, name: actor.name, decision: choice.text, reason, metric: choice.metric, effect: world.metrics[choice.metric] - before };
  remember(actor, world.year, `${choice.text}${partner ? ` กับ ${partner.name}` : ''} เพราะ${reason}`, { eventId: event.id, decision: true });
  return actor;
}
