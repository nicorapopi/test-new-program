# สถาปัตยกรรมและกลไก

## หน้าที่

เบราว์เซอร์แสดงผลและรับคำสั่ง เซิร์ฟเวอร์ตรวจข้อมูล คำนวณ และบันทึก ตัวจำลองแยกจาก HTTP และฐานข้อมูล จึงใช้ใน CLI หรือการจำลองแบบชุดได้

`engine.js` รับโลกแล้วคืนสำเนาใหม่ ไม่แก้ input การอ่าน–เปลี่ยน–เขียน SQLite เป็น synchronous จึงไม่สลับระหว่าง request ใน process เดียว ไม่รองรับ distributed workers หรือ collaborative editing

แต่ละโลกเป็น JSON document ใน SQLite พร้อม UUID และเวลาแก้ไข การแก้โลกเป็น atomic statement ใช้ WAL เมื่อข้อมูลมากควรแยก events/artifacts/snapshots เป็นตารางและทำ pagination ฝั่งเซิร์ฟเวอร์

## หนึ่งปีทำอะไร

1. เพิ่มปีและปรับ metric ด้วยผลกฎคูณ 0.3
2. ดึง metric กลับหาจุดกึ่งกลาง 50 ด้วยอัตรา 2.5%
3. ใช้ xorshift32 เลือกเหตุการณ์และกฎหัวข้อ
4. ปรับผลเหตุการณ์ ตรวจปฏิสัมพันธ์ memory + dream ทุก 5 ปี
5. ตรวจวิกฤตนิเวศหรือเสถียรภาพต่ำกว่า 20
6. คำนวณประชากรจากเสถียรภาพ นิเวศ และความผันผวน
7. บันทึกผลต่าง metric เหตุการณ์ และ snapshot
8. สุ่มค้นพบวัตถุ 45% (ปีแรกพบเสมอ) คืนพลังทุก 5 ปี

Metric อยู่ในช่วง 0–100 ประชากร 50–1,000,000 ไม่มี game over ไม่มี `Math.random()` ใน engine จำลอง 10 ปีครั้งเดียวเท่ากับทีละปี 10 ครั้ง ถ้ากฎ รุ่นโปรแกรม seed และการแทรกแซงเหมือนกัน ผลทำซ้ำได้ ลำดับกฎเป็นส่วนหนึ่งของ input

## แตกเส้นเวลา

คัดลอก PRNG ประวัติศาสตร์ วัตถุ บันทึก และ metric พร้อม parentId/branchYear จากนั้นเป็นอิสระ ลบต้นทางไม่ลบโลกที่แตกไปแล้ว การแทรกแซงไม่เดินเวลาและเพิ่ม snapshot จึงมีหลาย snapshot ในปีเดียวได้

## API

- `GET /api/catalog` — กฎและนโยบาย
- `GET /api/worlds` — สรุปโลกทั้งหมด
- `POST /api/worlds` — `{name, seed, laws}`
- `GET /api/worlds/:id` — สถานะเต็ม
- `POST /api/worlds/:id/advance` — `{years}`
- `POST /api/worlds/:id/intervene` — `{id}` ของนโยบาย
- `POST /api/worlds/:id/branch` — `{name, laws}`
- `PATCH /api/worlds/:id/artifacts` — `{id, note?, featured?}`
- `GET /api/worlds/:id/export` — ข้อมูลเต็ม
- `DELETE /api/worlds/:id` — ลบโลกเดียว

JSON UTF-8; validation error 400, not found 404, method 405, body เกิน 20 KB 413 การแก้ข้อมูลใช้ JSON และปฏิเสธ Origin ภายนอก หน้าเว็บ escape ข้อความและใช้ CSP ไม่เปิด CORS

## ข้อจำกัด

- ไม่มี authentication, cloud sync หรือ import JSON
- หลาย endpoint ส่งโลกเต็ม; จำกัด 2,000 ปีแต่ไม่จำกัดจำนวนโลก
- 12 แม่แบบเหตุการณ์และปฏิสัมพันธ์พิเศษหนึ่งแบบ เรื่องเล่าซ้ำได้
- รูปวัตถุเป็น SVG ตามกฎ ไม่ได้สร้างใหม่รายชิ้น
- กราฟย่อประมาณ 250 จุด ข้อมูลเต็มอยู่ใน JSON
- ไม่มี replay migration ข้ามรุ่น
