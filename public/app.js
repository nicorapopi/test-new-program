import { peoplePage, personDialog } from './people-ui.js';
const $ = (selector, base = document) => base.querySelector(selector);
const $$ = (selector, base = document) => [...base.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const num = value => new Intl.NumberFormat('th-TH').format(value);
const state = { catalog: null, worlds: [], world: null, view: 'observatory', busy: false, search: '', filter: 'all', page: 0, compareId: null, compareWorld: null, branch: false };
const colors = ['#658b7b', '#c19661', '#ad7767', '#749755', '#6c899b', '#9183a1'];
let toastTimer;
function toast(message) { const el = $('#toast'); el.textContent = message; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 4500); }
async function api(path, method = 'GET', body) {
  const response = await fetch(`/api${path}`, { method, ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'เชื่อมต่อไม่สำเร็จ');
  return data;
}
async function perform(fn) {
  if (state.busy) return;
  state.busy = true;
  $$('button').forEach(b => { b.dataset.wasDisabled = b.disabled ? '1' : '0'; b.disabled = true; });
  try { await fn(); } catch (error) { toast(error.message); }
  finally { state.busy = false; $$('button[data-was-disabled]').forEach(b => { b.disabled = b.dataset.wasDisabled === '1'; delete b.dataset.wasDisabled; }); }
}
async function refresh(id = state.world?.id) {
  state.worlds = await api('/worlds');
  state.world = id && state.worlds.some(w => w.id === id) ? await api(`/worlds/${id}`) : state.worlds.length ? await api(`/worlds/${state.worlds[0].id}`) : null;
  if (state.world) { try { localStorage.setItem('unlived-selected', state.world.id); } catch {} }
  if (state.view === 'compare') await loadComparison();
  render();
}
function renderSidebar() {
  $('#world-list').innerHTML = state.worlds.length ? state.worlds.map(w => `<button class="world-item ${w.id === state.world?.id ? 'selected' : ''}" data-world="${w.id}" ${w.id === state.world?.id ? 'aria-current="true"' : ''}>${esc(w.name)}<small>ปี ${num(w.year)} · วัตถุ ${num(w.artifactCount)} ชิ้น</small></button>`).join('') : '<p class="muted">ยังไม่มีเส้นเวลา</p>';
  $$('.nav').forEach(b => { b.classList.toggle('active', b.dataset.view === state.view); b.setAttribute('aria-current', b.dataset.view === state.view ? 'page' : 'false'); });
}
function heading(kicker, title, subtitle, actions = '') {
  return `<div class="page-heading"><div><span class="eyebrow">${kicker}</span><h1>${esc(title)}</h1><p class="muted">${subtitle}</p></div>${actions ? `<div class="heading-actions">${actions}</div>` : ''}</div>`;
}
function metricRows(world) { return Object.entries(state.catalog.metrics).map(([key, label]) => `<div class="metric"><div class="metric-label"><span>${label}</span><strong>${num(world.metrics[key])}<small> / 100</small></strong></div><div class="meter"><i style="width:${world.metrics[key]}%"></i></div></div>`).join(''); }
function lawTags(world) { return `<div class="law-strip">${world.laws.map(id => { const law = state.catalog.laws.find(l => l.id === id); return `<span class="law-tag" title="${esc(law.description)}"><span>${law.icon}</span>${law.name}</span>`; }).join('')}</div>`; }
function cosmos(world) {
  const wonder = world.metrics.wonder, ecology = world.metrics.ecology;
  return `<svg class="cosmos" viewBox="0 0 600 365" aria-hidden="true"><defs><radialGradient id="glow"><stop stop-color="#9eaf83" stop-opacity=".2"/><stop offset="1" stop-color="#223d34" stop-opacity="0"/></radialGradient><linearGradient id="planet" x2="1" y2="1"><stop stop-color="#c9c5a0"/><stop offset=".5" stop-color="#83997c"/><stop offset="1" stop-color="#304e41"/></linearGradient><pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M 30 0 L 0 0 0 30" fill="none" stroke="#a5b59b" stroke-opacity=".06"/></pattern></defs><rect width="600" height="365" fill="url(#grid)"/><circle cx="315" cy="175" r="170" fill="url(#glow)"/><g transform="translate(315 168)"><ellipse rx="195" ry="60" fill="none" stroke="#91a282" stroke-opacity=".3" transform="rotate(-28)"/><ellipse rx="155" ry="112" fill="none" stroke="#b8b896" stroke-opacity=".2" transform="rotate(25)"/><circle r="${56 + ecology * .25}" fill="url(#planet)"/><path d="M-58 -22 Q-20 -70 20 -20 T65 8 M-65 10 Q-15 -25 5 26 T50 45 M-38 45 Q-8 0 47 -44" fill="none" stroke="#d8d3ad" stroke-opacity=".3" stroke-width="1.5"/><ellipse rx="${110 + wonder * .6}" ry="28" fill="none" stroke="#d3bd8c" stroke-opacity=".7" transform="rotate(-28)"/><circle cx="-145" cy="76" r="6" fill="#c6ac77"/><circle cx="124" cy="-97" r="3" fill="#c6ac77"/><path d="M-195 -65h10m-5 -5v10M172 73h10m-5 -5v10" stroke="#c6c4a1"/><circle r="105" fill="none" stroke="#bcb791" stroke-dasharray="1 13" stroke-opacity=".5"/></g></svg>`;
}
function eventRows(events) { return events.map(e => `<article class="event-row ${e.kind}"><time>YEAR ${String(e.year).padStart(3, '0')}${e.kind === 'intervention' ? ' / แทรกแซง' : ''}</time><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p>${e.crisis ? `<p class="error">${esc(e.crisis)}</p>` : ''}${e.resident ? `<div class="resident-decision"><button class="text-button" data-person="${esc(e.resident.id)}">${esc(e.resident.name)} ↗</button><p>${esc(e.resident.decision)} เพราะ${esc(e.resident.reason)}</p><small>ผลต่อเมือง: ${state.catalog.metrics[e.resident.metric]} +${num(e.resident.effect)}</small></div>` : ''}<div class="effects">${Object.entries(e.effects).filter(([, v]) => Math.abs(v) >= .5).map(([k, v]) => `<span class="${v < 0 ? 'negative' : ''}">${state.catalog.metrics[k]} ${v > 0 ? '+' : ''}${num(v)}</span>`).join('')}</div></article>`).join(''); }
function observatory() {
  const w = state.world;
  return heading('OBSERVATORY / หอสังเกตการณ์', w.name, `เส้นเวลาที่ ${String(state.worlds.findIndex(x => x.id === w.id) + 1).padStart(2, '0')} · เมล็ดกำเนิด: ${esc(w.seed || '(ว่าง)')}`, '<button class="secondary" data-action="branch">⑂ แตกเส้นเวลา</button>') +
    lawTags(w) + `<div class="observatory-grid"><section class="world-stage">${cosmos(w)}<div class="stage-top"><span>ความเป็นไปได้ที่ยังดำเนินอยู่</span><span class="stage-caption">${w.metrics.stability < 20 ? 'ผันผวน' : w.metrics.ecology < 20 ? 'นิเวศวิกฤต' : 'กำลังเติบโต'}</span></div><div class="stage-bottom"><div class="year-number"><small>ปีของโลก</small>${String(w.year).padStart(3, '0')}</div><div class="population">${num(w.population)}<small>ผู้คนที่อาศัยอยู่ในความเป็นไปได้นี้</small></div></div></section><section class="metrics-panel"><div class="section-title"><h3>สภาวะของโลก</h3><span>6 ด้าน / 100</span></div>${metricRows(w)}</section></div>
    <div class="simulation-bar"><small>${w.year === 0 ? 'ทุกประวัติศาสตร์เริ่มต้นจากการปล่อยให้เวลาเดิน' : `ค้นพบวัตถุแล้ว ${num(w.artifacts.length)} ชิ้น · บันทึก ${num(w.history.length)} เหตุการณ์`}</small><div class="simulation-buttons"><button class="secondary" data-advance="1">เดินเวลา 1 ปี</button><button class="primary" data-advance="10">จำลอง 10 ปี →</button></div></div>
    <div class="lower-grid"><section><div class="section-title"><h3>เสียงสะท้อนล่าสุด</h3><button class="text-button" data-go="timeline">ดูทั้งหมด ↗</button></div>${w.history.length ? eventRows(w.history.slice(-3).reverse()) : '<p class="muted">เมืองยังไม่มีเรื่องเล่า ลองจำลองปีแรกเพื่อเริ่มประวัติศาสตร์</p>'}</section><section><div class="section-title"><h3>แทรกแซงอนาคต</h3><span>พลัง ${w.credits} / 8</span></div>${state.catalog.interventions.map(i => `<button class="intervention" data-intervene="${i.id}" ${w.credits === 0 ? 'disabled' : ''}><strong>${i.name} ↗</strong><small>${i.description}</small></button>`).join('')}<small class="muted">ใช้ครั้งละ 1 หน่วย · ฟื้นทุก 5 ปี</small></section></div><div class="world-tools"><button class="secondary" data-action="export">↓ ส่งออกโลก JSON</button><button class="text-button" data-action="delete">ลบเส้นเวลานี้</button></div>`;
}
function chart(w) {
  if (!w.snapshots.length) return '<p class="muted">กราฟจะปรากฏหลังจำลองปีแรก</p>';
  const points = [{ year: 0, metrics: Object.fromEntries(Object.keys(state.catalog.metrics).map(k => [k, 50])) }, ...w.snapshots];
  // Keep chart rendering bounded while retaining the final point.
  const stride = Math.max(1, Math.ceil(points.length / 250));
  const sampled = points.filter((_, i) => i % stride === 0 || i === points.length - 1);
  return `<svg class="chart" viewBox="0 0 700 210" role="img" aria-label="กราฟค่าทั้งหกของโลกตามปี ค่าปัจจุบันแสดงในหอสังเกตการณ์" preserveAspectRatio="none">${[0, 25, 50, 75, 100].map(v => `<line x1="30" y1="${180 - v * 1.6}" x2="680" y2="${180 - v * 1.6}" stroke="#dedfd2" stroke-dasharray="3 5"/><text x="0" y="${184 - v * 1.6}">${v}</text>`).join('')}${Object.keys(state.catalog.metrics).map((key, i) => `<polyline points="${sampled.map(p => `${30 + p.year / Math.max(w.year, 1) * 650},${180 - p.metrics[key] * 1.6}`).join(' ')}" fill="none" stroke="${colors[i]}" stroke-width="2" vector-effect="non-scaling-stroke"/>`).join('')}<text x="30" y="205">ปี 0</text><text x="640" y="205">ปี ${w.year}</text></svg><div class="legend">${Object.values(state.catalog.metrics).map((label, i) => `<span><i style="background:${colors[i]}"></i>${label}</span>`).join('')}</div>`;
}
function timeline() {
  const w = state.world;
  const entries = w.history.filter(e => (!state.eventId || e.id === state.eventId) && (state.filter === 'all' || e.kind === state.filter) && `${e.title} ${e.text}`.includes(state.search)).reverse();
  const pages = Math.ceil(entries.length / 20); state.page = Math.max(0, Math.min(state.page, pages - 1));
  return heading('CHRONICLE / บันทึกเส้นเวลา', 'ประวัติศาสตร์ของสิ่งที่เป็นไปไม่ได้', `${esc(w.name)} · ${num(w.history.length)} เหตุการณ์`) + `<section class="chart-panel"><h3>ร่องรอยการเปลี่ยนแปลง</h3>${chart(w)}</section><div class="toolbar"><input id="search" aria-label="ค้นหาเหตุการณ์" placeholder="ค้นหาในประวัติศาสตร์…" value="${esc(state.search)}"><select id="filter" aria-label="ประเภทเหตุการณ์"><option value="all">ทุกเหตุการณ์</option><option value="event">เหตุการณ์ทั่วไป</option><option value="crisis">วิกฤต</option><option value="intervention">การแทรกแซง</option></select></div>${entries.length ? eventRows(entries.slice(state.page * 20, (state.page + 1) * 20)) : '<div class="empty">ยังไม่มีเหตุการณ์ที่ตรงกับการค้นหา</div>'}${pages > 1 ? `<div class="pagination"><button class="secondary" data-page="-1" ${state.page === 0 ? 'disabled' : ''}>← ก่อนหน้า</button><span>${state.page + 1} / ${pages}</span><button class="secondary" data-page="1" ${state.page >= pages - 1 ? 'disabled' : ''}>ถัดไป →</button></div>` : ''}`;
}
function artifactArt(item) {
  const idx = state.catalog.laws.findIndex(l => l.id === item.law), color = colors[idx % colors.length];
  const shapes = [
    '<path d="M38 42 80 20l42 22v70l-42 24-42-24Z"/><path d="m38 42 42 24 42-24M80 66v70M52 70l14 8m-14 8 14 8"/>',
    '<circle cx="80" cy="73" r="43"/><path d="M80 30c-55 39-22 80 25 80M51 122h58m-49 9h40"/>',
    '<path d="M80 133V60M80 95C30 95 25 45 30 30c45 0 53 27 50 65Zm0-14c45 0 50-35 49-57-40 0-50 27-49 57Z"/>',
    '<path d="M45 24h70M45 136h70M53 24c0 35 8 40 27 56-19 16-27 21-27 56m54-112c0 35-8 40-27 56 19 16 27 21 27 56Z"/><path d="m62 122 18-26 18 26Z"/>',
    '<circle cx="80" cy="80" r="48"/><circle cx="80" cy="80" r="32"/><circle cx="80" cy="80" r="11"/><path d="m41 119 78-78"/>',
    '<path d="M80 25c-53 0-53 110 0 110s53-110 0-110Zm0 0v110M50 80h60"/>',
    '<path d="M80 23c-10 26-40 47-40 73a40 40 0 0 0 80 0c0-26-30-47-40-73Z"/><path d="M53 99c0 18 12 24 22 24"/>',
    '<path d="M80 80C10-10 10 100 68 90 0 130 65 160 80 80Zm0 0c70-90 70 20 12 10 68 40 3 70-12-10ZM80 60v60"/>',
  ];
  return `<svg viewBox="0 0 160 160" aria-hidden="true"><g fill="${color}22" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${shapes[idx]}</g><circle cx="131" cy="25" r="2" fill="${color}"/><path d="M23 120h8m-4-4v8" stroke="${color}"/></svg>`;
}
function museum() {
  const w = state.world;
  const items = w.artifacts.filter(a => (state.filter === 'all' || a.featured) && `${a.name} ${a.note}`.includes(state.search)).reverse();
  const pages = Math.ceil(items.length / 24); state.page = Math.max(0, Math.min(state.page, pages - 1));
  return heading('COLLECTION / ห้องจัดแสดง', 'วัตถุจากอนาคตที่ไม่มาถึง', `${esc(w.name)} · ค้นพบ ${num(w.artifacts.length)} ชิ้น · จัดแสดง ${w.artifacts.filter(a => a.featured).length} ชิ้น`) + `<div class="toolbar"><input id="search" aria-label="ค้นหาวัตถุ" placeholder="ค้นหาวัตถุหรือบันทึก…" value="${esc(state.search)}"><select id="filter" aria-label="ตัวกรองวัตถุ"><option value="all">วัตถุทั้งหมด</option><option value="featured">เฉพาะที่จัดแสดง</option></select></div>${items.length ? `<div class="artifact-grid">${items.slice(state.page * 24, (state.page + 1) * 24).map(a => `<button class="artifact-card" data-artifact="${a.id}"><div class="artifact-art">${artifactArt(a)}</div><div class="artifact-info"><span class="artifact-id">OBJ / ${String(a.year).padStart(4, '0')}${a.featured ? ' · ★' : ''}</span><h3>${esc(a.name)}</h3><div class="artifact-footer"><small>ค้นพบปี ${a.year}</small><span class="badge">${a.rarity}</span></div></div></button>`).join('')}</div>` : '<div class="empty"><span class="empty-icon">◇</span><h2>พื้นที่สำหรับสิ่งที่ยังไม่ถูกค้นพบ</h2><p>จำลองเวลาเพื่อค้นพบวัตถุ หรือเปลี่ยนตัวกรองเพื่อดูคอลเลกชันทั้งหมด</p></div>'}${pages > 1 ? `<div class="pagination"><button class="secondary" data-page="-1" ${!state.page ? 'disabled' : ''}>← ก่อนหน้า</button><span>${state.page + 1} / ${pages}</span><button class="secondary" data-page="1" ${state.page >= pages - 1 ? 'disabled' : ''}>ถัดไป →</button></div>` : ''}`;
}
async function loadComparison() {
  const options = state.worlds.filter(w => w.id !== state.world?.id);
  if (!options.some(w => w.id === state.compareId)) state.compareId = options[0]?.id || null;
  state.compareWorld = state.compareId ? await api(`/worlds/${state.compareId}`) : null;
}
function compare() {
  const a = state.world, b = state.compareWorld;
  const top = heading('PARALLEL WORLDS / โลกคู่ขนาน', 'ถ้าวันนั้นเราเลือกอีกอย่าง', 'เปรียบเทียบสภาวะปัจจุบันของสองเส้นเวลา');
  if (!b) return top + '<div class="empty"><span class="empty-icon">⑂</span><h2>โลกหนึ่งใบยังเปรียบเทียบไม่ได้</h2><p>แตกเส้นเวลาจากโลกปัจจุบัน แล้วเปลี่ยนกฎเพื่อทดลองความเป็นไปได้อีกแบบ</p><button class="primary" data-action="branch">แตกเส้นเวลา →</button></div>';
  return top + `<div class="branch-note">${b.parentId === a.id ? `“${esc(b.name)}” แตกแขนงจากโลกนี้ในปี ${b.branchYear}` : a.parentId === b.id ? `โลกปัจจุบันแตกแขนงจาก “${esc(b.name)}” ในปี ${a.branchYear}` : 'สองโลกนี้มีประวัติศาสตร์ของตัวเอง'}${a.year !== b.year ? ' · ขณะนี้อยู่คนละปี ควรจำลองให้ถึงปีเดียวกันก่อนเปรียบเทียบผลของกฎ' : ''}</div><div class="comparison">${[a, b].map((w, i) => `<section class="compare-card"><span class="eyebrow">${i ? 'ALTERNATE' : 'CURRENT'} TIMELINE</span>${i ? `<select id="compare-select" aria-label="เลือกโลกที่จะเปรียบเทียบ">${state.worlds.filter(x => x.id !== a.id).map(x => `<option value="${x.id}" ${x.id === b.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>` : `<h2>${esc(w.name)}</h2>`}<div class="world-summary"><span>ปี ${w.year}</span><span>ประชากร ${num(w.population)}</span><span>${w.artifacts.length} วัตถุ</span></div>${lawTags(w)}${Object.entries(state.catalog.metrics).map(([k, label]) => `<div class="compare-stat"><span>${label}</span><span>${num(w.metrics[k])}${i ? `<small> (${w.metrics[k] - a.metrics[k] >= 0 ? '+' : ''}${num(Math.round((w.metrics[k] - a.metrics[k]) * 10) / 10)})</small>` : ''}</span></div>`).join('')}</section>`).join('')}</div>`;
}
function render() {
  renderSidebar();
  $('#breadcrumb').textContent = `คลังความเป็นไปได้ / ${{ observatory: 'หอสังเกตการณ์', timeline: 'บันทึกเส้นเวลา', people: 'ผู้คนในโลก', museum: 'ห้องจัดแสดง', compare: 'เทียบโลกคู่ขนาน' }[state.view]}`;
  $('#content').innerHTML = !state.world ? `<div class="empty welcome"><span class="eyebrow">THE MUSEUM OF UNLIVED FUTURES</span><span class="empty-icon">◈</span><h1>พิพิธภัณฑ์อนาคต<br>ที่ไม่เคยเกิดขึ้น</h1><p>ถ้าความทรงจำใช้แทนเงินได้ และความฝันสร้างเมืองได้<br>ผู้คนจะใช้ชีวิตอย่างไร?<br>ตั้งกฎ ปล่อยเวลาเดิน แล้วเก็บหลักฐานของโลกที่คุณสร้าง</p><button class="primary" data-action="new">สร้างความเป็นไปได้แรก →</button></div>` : ({ observatory, timeline, museum, compare, people: () => peoplePage(state) })[state.view]();
  if ($('#filter')) $('#filter').value = state.filter;
}
async function navigate(view) { state.view = view; state.search = ''; state.filter = 'all'; state.page = 0; state.eventId = null; if (view === 'compare') await loadComparison(); render(); window.scrollTo({ top: 0, behavior: 'instant' }); }
function openWorldForm(isBranch = false) {
  state.branch = isBranch;
  const form = $('#world-form'); form.reset();
  $('#form-title').textContent = isBranch ? 'แตกเส้นเวลา' : 'กำเนิดโลกใหม่';
  $('#form-kicker').textContent = isBranch ? `BRANCH FROM YEAR ${state.world.year}` : 'NEW POSSIBILITY';
  $('#seed-field').hidden = isBranch;
  form.elements.name.value = isBranch ? `${state.world.name.slice(0, 65)} · อีกทาง` : '';
  $('#form-error').textContent = '';
  $('#law-options').innerHTML = state.catalog.laws.map(l => `<label class="law-option"><input type="checkbox" name="law" value="${l.id}" ${isBranch && state.world.laws.includes(l.id) ? 'checked' : ''}><span>${l.icon} ${l.name}<small>${l.description}</small></span></label>`).join('');
  updateLawCount(); $('#world-dialog').showModal();
}
function updateLawCount() { $('#law-count').textContent = `${$$('[name="law"]:checked').length} / 3`; }
function openPerson(id, other = null) {
  const dialog = $('#person-dialog');
  if (!state.world.people?.some(p => p.id === id)) return;
  dialog.innerHTML = personDialog(state, id, other);
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
}
function openArtifact(id) {
  const a = state.world.artifacts.find(x => x.id === id), dialog = $('#artifact-dialog');
  dialog.innerHTML = `<div class="dialog-heading"><div><span class="eyebrow">OBJECT ${String(a.year).padStart(4, '0')} / ${a.rarity}</span><h2>${esc(a.name)}</h2></div><button class="icon-button" data-close aria-label="ปิด">×</button></div><div class="artifact-detail-art artifact-art">${artifactArt(a)}</div><p>${esc(a.description)}</p><form id="artifact-form" data-id="${a.id}"><label class="field">บันทึกของผู้ดูแล<textarea name="note" maxlength="2000" placeholder="วัตถุชิ้นนี้ทำให้คุณคิดถึงอะไร…">${esc(a.note)}</textarea></label><label class="law-option"><input type="checkbox" name="featured" ${a.featured ? 'checked' : ''}><span>เลือกเข้าห้องจัดแสดง</span></label><p class="error" id="artifact-error" role="alert"></p><button class="primary full" type="submit">บันทึกวัตถุ →</button></form>`;
  if (a.keeperId) {
    const keeper = state.world.people?.find(p => p.id === a.keeperId);
    if (keeper) $('#artifact-form', dialog).insertAdjacentHTML('beforebegin', `<div class="branch-note">ผู้ส่งมอบวัตถุเข้าคลัง<button class="text-button" data-person="${esc(keeper.id)}">${esc(keeper.name)} ↗ อ่านชีวิต</button></div>`);
  }
  dialog.showModal();
}
document.addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button || state.busy) return;
  if (button.hasAttribute('data-close')) { button.closest('dialog').close(); return; }
  if (button.id === 'help-button') { $('#help-dialog').showModal(); return; }
  if (button.id === 'new-world' || button.id === 'new-world-small' || button.dataset.action === 'new') { openWorldForm(); return; }
  if (button.dataset.action === 'branch') { openWorldForm(true); return; }
  if (button.dataset.artifact) { openArtifact(button.dataset.artifact); return; }
  if (button.dataset.person) { button.closest('dialog')?.close(); openPerson(button.dataset.person); return; }
  perform(async () => {
    if (button.dataset.follow) {
      const p = state.world.people.find(p => p.id === button.dataset.follow);
      state.world = await api(`/worlds/${state.world.id}/people`, 'PATCH', { id: p.id, followed: !p.followed });
      render(); openPerson(p.id); toast('บันทึกสถานะติดตามแล้ว');
    }
    if (button.dataset.event) {
      button.closest('dialog')?.close();
      await navigate('timeline');
      state.eventId = button.dataset.event;
      render();
      $('.toolbar').insertAdjacentHTML('beforebegin', '<div class="branch-note">กำลังดูเหตุการณ์ที่เชื่อมกับบันทึกชีวิต<button class="text-button" data-go="timeline">กลับไปดูทุกเหตุการณ์ ↗</button></div>');
    }
    if (button.dataset.view || button.dataset.go) await navigate(button.dataset.view || button.dataset.go);
    if (button.dataset.world) { state.page = 0; state.eventId = null; await refresh(button.dataset.world); }
    if (button.dataset.advance) { const updated = await api(`/worlds/${state.world.id}/advance`, 'POST', { years: Number(button.dataset.advance) }); await refresh(updated.id); toast(`เดินทางถึงปี ${updated.year} แล้ว`); }
    if (button.dataset.intervene) { await api(`/worlds/${state.world.id}/intervene`, 'POST', { id: button.dataset.intervene }); await refresh(); toast('การตัดสินใจของคุณถูกบันทึกแล้ว'); }
    if (button.dataset.page) { state.page += Number(button.dataset.page); render(); $('#content').scrollIntoView({ behavior: 'instant' }); }
    if (button.dataset.action === 'export') {
      const data = await api(`/worlds/${state.world.id}/export`);
      const url = URL.createObjectURL(new Blob([JSON.stringify({ format: 'unlived-museum', version: 1, world: data }, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = `unlived-${data.id}-year-${data.year}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('ส่งออกข้อมูลโลกแล้ว');
    }
    if (button.dataset.action === 'delete' && confirm(`ลบ “${state.world.name}” พร้อมประวัติศาสตร์และวัตถุทั้งหมด? การลบย้อนกลับไม่ได้ โลกที่แตกแขนงไปแล้วจะยังอยู่`)) { await api(`/worlds/${state.world.id}`, 'DELETE'); await refresh(); toast('ลบเส้นเวลาแล้ว'); }
  });
});
document.addEventListener('change', event => {
  if (event.target.name === 'law') {
    if ($$('[name="law"]:checked').length > 3) { event.target.checked = false; toast('เลือกกฎได้สูงสุด 3 ข้อ'); }
    updateLawCount();
  }
  if (event.target.id === 'filter') { state.filter = event.target.value; state.page = 0; state.eventId = null; render(); }
  if (event.target.id === 'compare-select') perform(async () => { state.compareId = event.target.value; await loadComparison(); render(); });
  if (event.target.id === 'person-compare') {
    const id = event.target.dataset.personId, worldId = event.target.value;
    perform(async () => openPerson(id, worldId ? await api(`/worlds/${worldId}`) : null));
  }
});
document.addEventListener('input', event => {
  if (event.target.id === 'search') { const position = event.target.selectionStart; state.search = event.target.value; state.page = 0; state.eventId = null; render(); $('#search').focus(); $('#search').setSelectionRange(position, position); }
});
$('#world-form').addEventListener('submit', event => {
  event.preventDefault();
  perform(async () => {
    const form = event.target;
    const data = { name: form.elements.name.value, seed: form.elements.seed.value, laws: $$('[name="law"]:checked', form).map(x => x.value) };
    try {
      const world = await api(state.branch ? `/worlds/${state.world.id}/branch` : '/worlds', 'POST', data);
      $('#world-dialog').close(); state.view = 'observatory'; await refresh(world.id); toast(state.branch ? 'เส้นทางใหม่เริ่มจากจุดเดียวกันแล้ว' : 'โลกใบใหม่ถือกำเนิดแล้ว');
    } catch (error) { $('#form-error').textContent = error.message; }
  });
});
document.addEventListener('submit', event => {
  if (event.target.id !== 'artifact-form') return;
  event.preventDefault();
  perform(async () => {
    const form = event.target;
    try {
      await api(`/worlds/${state.world.id}/artifacts`, 'PATCH', { id: form.dataset.id, note: form.elements.note.value, featured: form.elements.featured.checked });
      $('#artifact-dialog').close(); await refresh(); toast('บันทึกคำอธิบายและสถานะจัดแสดงแล้ว');
    } catch (error) { $('#artifact-error').textContent = error.message; }
  });
});
try {
  state.catalog = await api('/catalog');
  let selected; try { selected = localStorage.getItem('unlived-selected'); } catch {}
  await refresh(selected);
} catch (error) { $('#content').innerHTML = `<div class="empty"><h2>เปิดพิพิธภัณฑ์ไม่สำเร็จ</h2><p>${esc(error.message)}</p><p>ตรวจสอบว่าโปรแกรมยังทำงานอยู่ แล้วรีเฟรชหน้านี้</p></div>`; }
