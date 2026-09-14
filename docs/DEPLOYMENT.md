# Private beta deployment — รุ่น 1.2

แพ็กเกจนี้สำหรับเซิร์ฟเวอร์เดียวและกลุ่มผู้ทดลองที่ผู้ดูแลเชิญ บัญชีหนึ่งมีหนึ่ง session ที่ใช้งานได้ ลงชื่อเข้าใหม่จะยกเลิก session เก่า ไม่มีการสมัครบัญชีสาธารณะ

## สิ่งที่เตรียมแล้ว

- บัญชีที่ผู้ดูแลสร้าง รหัสผ่าน scrypt และ session แบบสุ่ม เก็บเฉพาะ hash
- Cookie HttpOnly, SameSite=Strict และ Secure เมื่อ PUBLIC_ORIGIN เป็น HTTPS
- โลกแยกเจ้าของทุก endpoint รวม export, branch, delete และการแก้วัตถุ/ผู้คน
- ตรวจ Host และ Origin จาก PUBLIC_ORIGIN ที่ระบุชัด ไม่เชื่อ X-Forwarded-Host/Proto
- จำกัด 20 โลกต่อบัญชีและ 200 โลกทั้งระบบ, API 120 ครั้ง/นาที/บัญชี, จำลอง 12 ครั้ง/นาที/บัญชี
- Login 20 ครั้ง/10 นาทีต่อ socket IP และ hash พร้อมกันสูงสุด 4 งาน หลัง proxy ทุกคนใช้ login budget ร่วมกัน
- Health probe, graceful shutdown, persistent volumes และบริการสำรองรายวัน

## เตรียมเซิร์ฟเวอร์

ต้องมี Docker Engine พร้อม Compose บน Linux, DNS ของโดเมนชี้มาที่เซิร์ฟเวอร์ และพอร์ต 80/443 เปิดให้ Caddy ใช้งาน เริ่มกลุ่มทดลองเล็ก ๆ แล้ววัดทรัพยากรจริงก่อนเพิ่มผู้ใช้ การตั้งค่านี้ไม่ได้ผ่านการทดสอบโหลดบนเครื่องโฮสต์ของคุณ

1. นำโค้ดขึ้นเซิร์ฟเวอร์โดยไม่รวม `.env`, `data`, `backups` หรือไฟล์รหัสผ่าน
2. คัดลอก `.env.example` เป็น `.env` และเปลี่ยน `DOMAIN` เป็นโดเมนจริง เช่น `museum.your-domain.com` ไม่ใส่ scheme/path/port
3. ตรวจและเริ่มระบบ:

```sh
docker compose config
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 app proxy backup
```

เซิร์ฟเวอร์แอปไม่ publish พอร์ต 4317 มีเพียง Caddy ที่รับอินเทอร์เน็ต Caddy ดูแล HTTPS และส่ง Host เดิมให้แอป ห้ามเปิดพอร์ตแอปตรงหรือเพิ่ม replica ของ app ใน configuration นี้

4. สร้างบัญชีผู้ดูแลหรือผู้ทดลอง:

```sh
docker compose exec -it app node scripts/users.js add curator
```

โปรแกรมถามรหัสผ่านสองครั้งโดยไม่แสดงบนจอ ไม่มีรหัสผ่านตั้งต้น ไม่รับรหัสผ่านจาก command line ตั้งชื่อบัญชีด้วย a–z, 0–9, `_`, `-` ยาว 3–32 ตัวอักษร รหัสผ่านยาว 12–128 ตัวอักษร สร้างผู้ใช้คนอื่นด้วยคำสั่งเดียวกันแล้วส่งข้อมูลเข้าระบบให้ผู้ใช้ผ่านช่องทางที่เหมาะสมด้วยตนเอง

5. เปิด `https://โดเมนของคุณ` ลงชื่อเข้าใช้และทดลองสร้างโลก ตรวจ `/healthz` ต้องตอบ `{"status":"ok"}` แล้วทดสอบอีกบัญชีว่าไม่เห็นโลกบัญชีแรก

## รีเซ็ตรหัสผ่าน / เพิกถอน session

```sh
docker compose exec -it app node scripts/users.js password curator
```

การเปลี่ยนรหัสผ่านเพิกถอน session ของบัญชีนั้นทันที Session ปกติหมดอายุใน 12 ชั่วโมง ปุ่มออกจากระบบลบ session ฝั่งเซิร์ฟเวอร์

## สำรองและกู้คืน

บริการ `backup` สร้าง snapshot เมื่อเริ่มและทุก 24 ชั่วโมง เก็บใน volume `museum-backups` ตรวจด้วย `docker compose logs backup` ถ้าล้มเหลวจะออกด้วย error และ retry ได้ 3 ครั้ง ต้องตั้งระบบแจ้งเตือนของโฮสต์ให้ติดตาม container ที่หยุดเอง **ยังไม่มีการลบ backup เก่าอัตโนมัติ** ให้ตรวจพื้นที่และย้ายสำเนาออกนอกเครื่องเป็นประจำ

สำรองด้วยตนเองระหว่างแอปทำงาน:

```sh
docker compose exec app node scripts/backup.js backup /app/data/museum.sqlite /app/backups/manual-001.sqlite
docker compose cp app:/app/backups/manual-001.sqlite ./manual-001.sqlite
```

ชื่อปลายทางต้องยังไม่มีอยู่ เครื่องมือใช้ SQLite online backup API รองรับ WAL และตรวจ integrity ไฟล์มีข้อมูลโลกและ password hashes จึงต้องจำกัดสิทธิ์ไฟล์ สำเนาใน volume เดียวกับเซิร์ฟเวอร์ไม่ป้องกันการสูญเสียทั้งเครื่อง

ทดสอบกู้คืนไป **ไฟล์ใหม่** ก่อน ไม่ทับฐานข้อมูลที่ใช้งานอยู่:

```sh
docker compose stop app backup
docker compose run --rm --no-deps app node scripts/backup.js restore /app/backups/manual-001.sqlite /app/data/restored-001.sqlite
```

ตั้ง `DATABASE_PATH: /app/data/restored-001.sqlite` ใน environment ของ **ทั้ง app และ backup** ภายใน `compose.yaml` แล้ว `docker compose up -d` ตรวจ login จำนวนโลกและรายละเอียดอีกครั้ง ไฟล์กู้คืนลบ session ทั้งหมด จึงต้องเข้าสู่ระบบใหม่ ฐานข้อมูลเดิมยังอยู่สำหรับย้อนกลับ

อย่าใช้ `docker compose down -v` หากต้องการเก็บข้อมูล เพราะจะลบ volumes

## ย้ายโลกเดิมจากเครื่องส่วนตัว

1. สำรอง local DB ด้วย `node scripts/backup.js backup data/museum.sqlite backups/local-001.sqlite`
2. คัดลอกไฟล์สำรองไปเซิร์ฟเวอร์และนำเข้าฐานข้อมูล **ก่อนเริ่มรับผู้ทดลอง** ด้วยขั้นตอน restore ไปไฟล์ใหม่ด้านบน
3. สร้างบัญชีปลายทาง แล้วสั่ง:

```sh
docker compose exec -it app node scripts/users.js claim-local curator
```

คำสั่งถามให้พิมพ์ชื่อบัญชีเพื่อยืนยัน แล้วโอนเฉพาะโลกที่ยังเป็นเจ้าของ `local` ไปให้บัญชีนั้น โลกเดิมไม่มีทางมองเห็นจากบัญชีอื่นจนกว่าจะโอน ไม่รวม/เขียนทับฐานข้อมูลที่มีผู้ทดลองอยู่แล้ว

## อัปเดตและย้อนกลับ

สำรองก่อนทุกครั้ง เก็บ revision/image เดิมไว้ จากนั้นอัปเดตโค้ดและ `docker compose up -d --build` ตรวจ health และ login การเพิ่ม owner_id/users/sessions เป็น migration ที่รักษา JSON โลกเดิม แต่ไม่ควรรันโค้ดรุ่นก่อนระบบ ownership กับฐานข้อมูลรุ่นนี้ หากต้องย้อนรุ่นให้ใช้ทั้งโค้ดและ snapshot ก่อนอัปเดตเป็นคู่

## รันโหมดล็อกอินเพื่อทดสอบบนเครื่อง

ใช้ฐานข้อมูลทดสอบแยกจากข้อมูลจริง ใน PowerShell:

```powershell
$env:DATABASE_PATH = 'data/beta-test.sqlite'
node scripts/users.js add tester
$env:AUTH_REQUIRED = 'true'
$env:PUBLIC_ORIGIN = 'http://127.0.0.1:4318'
$env:HOST = '127.0.0.1'
$env:PORT = '4318'
npm start
```

HTTP นี้สำหรับการทดสอบในเครื่องเท่านั้น Production บังคับ PUBLIC_ORIGIN แบบ HTTPS โดยไม่ยอมปิด auth Node ไม่โหลด `.env` โดยอัตโนมัติ ส่วน Compose ใช้ `.env` แทนค่า DOMAIN

## ข้อจำกัดที่ยังต้องวัดบนโฮสต์จริง

SQLite และตัวจำลองยังทำงานใน process เดียว rate limits เก็บใน memory และ reset เมื่อ restart จึงไม่ใช่ระบบหลายเซิร์ฟเวอร์ Health probe ตรวจว่าอ่าน DB ได้ ไม่ตรวจพื้นที่ดิสก์หรือความสดของ backup ต้องตั้ง host monitoring และทดสอบ DNS/TLS, restart, backup offsite และโหลดกลุ่มผู้ทดลองบนเครื่องจริงก่อนเปิดรับคนทั่วไป

เอกสารอ้างอิง: [SQLite backup API ของ Node 24](https://nodejs.org/download/release/v24.0.1/docs/api/sqlite.html), [Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)
