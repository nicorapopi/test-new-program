export const METRICS = {
  stability: 'เสถียรภาพ', wonder: 'ความพิศวง', empathy: 'ความเข้าใจ',
  ecology: 'ระบบนิเวศ', knowledge: 'ความรู้', freedom: 'เสรีภาพ',
};

export const LAWS = [
  { id: 'memory', name: 'ความทรงจำคือสกุลเงิน', icon: '◈', description: 'ซื้อขนมหนึ่งชิ้น อาจต้องลืมชื่อเพื่อนหนึ่งคน', effects: { knowledge: -3, wonder: 4, empathy: -2 }, motif: 'ความทรงจำ' },
  { id: 'dream', name: 'ความฝันก่อสร้างเมือง', icon: '☾', description: 'สิ่งที่คนทั้งเมืองฝันตรงกันจะกลายเป็นอาคาร', effects: { wonder: 5, stability: -3, freedom: 2 }, motif: 'ความฝัน' },
  { id: 'forest', name: 'ต้นไม้มีสิทธิ์ลงคะแนน', icon: '♧', description: 'ป่าทุกแห่งมีเสียงในสภา แต่ใช้เวลาคิดนานมาก', effects: { ecology: 5, stability: -1, empathy: 2 }, motif: 'ต้นไม้' },
  { id: 'time', name: 'เวลามีน้ำหนัก', icon: '◷', description: 'คนที่รอคอยนานจะหนักขึ้น จนบางคนเดินไม่ได้', effects: { stability: -3, knowledge: 3, wonder: 3 }, motif: 'เวลา' },
  { id: 'silence', name: 'ความเงียบผลิตพลังงาน', icon: '∅', description: 'ยิ่งเมืองเงียบ ไฟยิ่งสว่าง แต่ใครจะมีสิทธิ์พูด', effects: { ecology: 3, freedom: -4, knowledge: 2 }, motif: 'ความเงียบ' },
  { id: 'shadow', name: 'เงามีชีวิตของตัวเอง', icon: '◐', description: 'เงาเลือกงาน ความรัก และอนาคตต่างจากเจ้าของได้', effects: { freedom: 4, stability: -3, empathy: 2 }, motif: 'เงา' },
  { id: 'rain', name: 'ฝนตกจากความเศร้า', icon: '⋮', description: 'นักพยากรณ์อากาศต้องฟังเรื่องในใจของผู้คน', effects: { ecology: 3, empathy: 4, stability: -2 }, motif: 'ฝน' },
  { id: 'truth', name: 'คำโกหกกลายเป็นผีเสื้อ', icon: '⋈', description: 'ทุกคำลวงทิ้งหลักฐานที่บินหนีได้', effects: { knowledge: 4, empathy: -2, wonder: 3 }, motif: 'ผีเสื้อ' },
];

export const EVENTS = [
  { title: 'เปิดตลาดสิ่งที่สูญหาย', text: 'พ่อค้าแลกเปลี่ยน{motif}กับคำสัญญา คนรุ่นใหม่เริ่มคิดว่าการสูญเสียอาจเป็นอาชีพ', effects: { wonder: 3, stability: -2 }, artifact: 'ใบเสร็จของสิ่งที่ซื้อคืนไม่ได้' },
  { title: 'มหาวิทยาลัยตั้งคณะใหม่', text: 'นักวิจัยสร้างศาสตร์ว่าด้วย{motif} เด็กที่เคยถูกมองว่าเพ้อฝันกลายเป็นอาจารย์รุ่นแรก', effects: { knowledge: 4, freedom: 1 }, artifact: 'สมุดบันทึกทฤษฎีที่ยังไม่มีชื่อ' },
  { title: 'คนงานนัดหยุดความเป็นจริง', text: 'สหภาพเรียกร้องสิทธิ์เหนือ{motif}ของตนเอง ถนนทั้งเมืองกลายเป็นห้องสนทนาขนาดใหญ่', effects: { freedom: 4, stability: -4 }, artifact: 'ป้ายประท้วงที่เขียนอีกด้านเอง' },
  { title: 'เทศกาลของคนแปลกหน้า', text: 'ผู้คนเชิญคนที่ไม่รู้จักมาร่วมแบ่งปัน{motif} ความสัมพันธ์ใหม่ค่อย ๆ แทนที่กำแพงเก่า', effects: { empathy: 5, wonder: 2 }, artifact: 'ถ้วยชาที่จำมือผู้ถือได้' },
  { title: 'สภาออกมาตรฐานฉบับแรก', text: 'เจ้าหน้าที่เริ่มนับและจัดหมวดหมู่{motif} สิ่งที่วัดไม่ได้ถูกผลักออกไปนอกทะเบียน', effects: { stability: 5, freedom: -3, wonder: -2 }, artifact: 'ตราประทับสำหรับสิ่งที่ไม่มีอยู่' },
  { title: 'สวนร้างกลับมาหายใจ', text: 'ชาวสวนพบว่า{motif}ทำให้เมล็ดพันธุ์ที่ตายแล้วงอกอีกครั้ง สวนร้างกลายเป็นสถานที่พบปะ', effects: { ecology: 5, empathy: 2 }, artifact: 'เมล็ดพันธุ์จากฤดูที่หายไป' },
  { title: 'เครื่องมือใหม่ทำงานผิดพลาด', text: 'เครื่องจัดเก็บ{motif}ส่งผลออกมาตรงข้ามกับที่ตั้งใจ ช่างเลือกบันทึกข้อผิดพลาดไว้แทนการลบ', effects: { knowledge: 3, stability: -4, wonder: 3 }, artifact: 'เครื่องจักรที่ทำผิดได้อย่างแม่นยำ' },
  { title: 'เปิดหอจดหมายเหตุสาธารณะ', text: 'ประวัติของ{motif}ถูกเปิดให้ทุกคนอ่าน เรื่องเล่าของผู้ชนะเริ่มมีเชิงอรรถจากผู้แพ้', effects: { knowledge: 4, empathy: 3, stability: -1 }, artifact: 'แผนที่ซึ่งมีแต่เชิงอรรถ' },
  { title: 'ผู้คนย้ายไปอยู่ชายขอบ', text: 'ชุมชนใหม่ทดลองอยู่ร่วมกับ{motif}โดยไม่ใช้กฎหมายเดิม เมืองใหญ่เฝ้ามองด้วยความสงสัย', effects: { freedom: 3, ecology: 2, stability: -2 }, artifact: 'กุญแจบ้านที่ไม่มีประตู' },
  { title: 'นักดนตรีค้นพบเสียงใหม่', text: 'บทเพลงจาก{motif}ทำให้คนฟังเห็นชีวิตของคนอื่น โรงละครเริ่มรับค่าตั๋วเป็นเรื่องเล่า', effects: { empathy: 4, wonder: 4 }, artifact: 'แผ่นเสียงสำหรับหูที่สาม' },
  { title: 'ระบบกระจายทรัพยากรล้มเหลว', text: 'การผูกขาด{motif}ทำให้บางย่านมีมากเกินไป ขณะที่อีกฝั่งไม่มีเหลือแม้แต่น้อย', effects: { empathy: -3, stability: -4, ecology: -2 }, artifact: 'มาตรวัดความขาดแคลน' },
  { title: 'เด็กคนหนึ่งตั้งคำถาม', text: 'คำถามง่าย ๆ เกี่ยวกับ{motif}ทำให้ผู้ใหญ่ทั้งเมืองหยุดตอบแบบเดิม โรงเรียนยอมแก้หนังสือเรียน', effects: { knowledge: 3, freedom: 3 }, artifact: 'ยางลบสำหรับความแน่ใจ' },
];

export const INTERVENTIONS = [
  { id: 'archive', name: 'สร้างหอจดหมายเหตุ', description: 'ความรู้ +12 · เสถียรภาพ +4 · ความพิศวง −3', effects: { knowledge: 12, stability: 4, wonder: -3 } },
  { id: 'festival', name: 'จัดเทศกาลรับฟัง', description: 'ความเข้าใจ +12 · เสรีภาพ +4 · เสถียรภาพ −2', effects: { empathy: 12, freedom: 4, stability: -2 } },
  { id: 'rewild', name: 'คืนพื้นที่ให้ธรรมชาติ', description: 'ระบบนิเวศ +14 · ความรู้ −2 · เสถียรภาพ −2', effects: { ecology: 14, knowledge: -2, stability: -2 } },
  { id: 'order', name: 'ออกกฎควบคุมชั่วคราว', description: 'เสถียรภาพ +14 · เสรีภาพ −8 · ความพิศวง −3', effects: { stability: 14, freedom: -8, wonder: -3 } },
];
