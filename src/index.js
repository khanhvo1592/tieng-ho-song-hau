import { DurableObject } from "cloudflare:workers";

const HALL_LAYOUT_ID = "nha-bd-724-v4";

function buildHallRows() {
  const letter = i => String.fromCharCode(65 + i);
  const push = (rows, prefix, counts, zone, block, lockedAt) => {
    counts.forEach((count, i) => {
      const locked = typeof lockedAt === "function" ? !!lockedAt(letter(i), i) : !!lockedAt;
      rows.push({ label: prefix + letter(i), count, zone, block, locked });
    });
  };
  const rows = [];
  // Trên lầu: 59 + 96 + 61 = 216
  push(rows, "L1", [18, 17, 13, 7, 4], "lau", 1, false);
  push(rows, "L2", [18, 21, 20, 19, 18], "lau", 2, false);
  push(rows, "L3", [18, 18, 15, 7, 3], "lau", 3, false);
  // Tầng trệt: 167 + 174 + 167 = 508 — bàn BGK không phải ghế đặt; khối giữa A–J
  push(rows, "1", [15, 16, 16, 18, 18, 19, 19, 19, 17, 10], "tre", 1, false);
  // Khối 2 hàng A–D khóa sẵn (dành cho khách mời); mở lại bằng ô "Khóa" ở trang quản trị.
  push(rows, "2", [13, 15, 16, 17, 18, 19, 20, 19, 20, 17], "tre", 2, (_, i) => i < 4);
  push(rows, "3", [15, 16, 16, 18, 18, 19, 19, 19, 17, 10], "tre", 3, false);
  return rows;
}

function hallSig(rows) {
  return (rows || []).map(r => [r.label, r.count, r.zone || "tre", Number(r.block) || 1].join(":")).sort().join("|");
}

function seatsFromLockedRows(rows) {
  const out = [];
  for (const row of rows || []) {
    if (!row.locked) continue;
    for (let n = 1; n <= row.count; n++) out.push(row.label + n);
  }
  return out;
}

const DEFAULT_EVENT = {
  eyebrow: "Ngày Văn hóa Việt Nam 2026 · Vé mời miễn phí",
  title: "Tiếng Hò",
  titleEm: "Sông Hậu",
  description: "Công diễn vở cải lương với NSND Quế Trân, NSƯT Lê Tứ và nghệ sĩ Đoàn Nghệ thuật Cải lương Tây Đô — Trung tâm Văn hóa, Nghệ thuật thành phố. Vé mời miễn phí, số ghế có hạn.",
  venue: "Nhà biểu diễn Trung tâm Văn hóa, Nghệ thuật TP (Khu Bãi Cát, phường Cái Khế, Cần Thơ)",
  phone: "0292 3 000 000",
  door: "Trước giờ diễn 45 phút",
  ticketNote: "Miễn phí, tối đa 4 ghế mỗi lượt đăng ký",
  codePrefix: "VE",
  maxSeats: 4,
  aisle: false,
  blocked: [],
  shows: [
    { id: "s1", day: "15/11", label: "Chủ nhật, 15/11/2026 · Truyền hình trực tiếp", time: "19:00" },
    { id: "s2", day: "24/11", label: "Thứ Ba, 24/11/2026 · Ngày Văn hóa Việt Nam", time: "19:00" }
  ],
  rows: buildHallRows(),
  hallLayoutId: HALL_LAYOUT_ID,
  openLau: true,
  showArtists: true,
  showFootLogo: true,
  showCallBtn: true,
  org: "Sở Văn hoá, Thể thao và Du lịch TP. Cần Thơ",
  logo: "",
  poster: "",
  artists: [
    { title: "NSND", name: "Quế Trân", photo: "" },
    { title: "NSƯT", name: "Lê Tứ", photo: "" },
    { title: "Nghệ sĩ", name: "Đoàn Nghệ thuật Cải lương Tây Đô", photo: "" }
  ]
};

const IMAGE_ID = /^[a-f0-9]{24}$/;
const IMAGE_MAX_BYTES = 1500000;
const IMAGE_MAX_COUNT = 80;

function imageRef(value) {
  const id = String(value || "");
  return IMAGE_ID.test(id) ? id : "";
}

// Nhận diện ảnh theo vài byte đầu, không tin content-type do trình duyệt gửi.
function sniffImage(bytes) {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return "";
}

function imagesInEvent(event) {
  const ids = new Set();
  for (const id of [event.logo, event.poster, ...(event.artists || []).map(a => a.photo)]) if (id) ids.add(id);
  return ids;
}

function normalizeEvent(raw) {
  const base = structuredClone(DEFAULT_EVENT);
  if (!raw || typeof raw !== "object") return base;
  for (const key of ["eyebrow", "title", "description", "venue", "phone", "door", "ticketNote"]) {
    if (typeof raw[key] === "string" && raw[key].trim()) base[key] = raw[key].trim();
  }
  if (typeof raw.titleEm === "string") base.titleEm = raw.titleEm.trim().slice(0, 40);
  base.title = base.title.slice(0, 60);
  base.description = base.description.slice(0, 800);
  if (raw.maxSeats != null) base.maxSeats = Math.min(20, Math.max(1, Number(raw.maxSeats) || base.maxSeats));
  if (typeof raw.aisle === "boolean") base.aisle = raw.aisle;
  if (typeof raw.openLau === "boolean") base.openLau = raw.openLau;
  if (typeof raw.showArtists === "boolean") base.showArtists = raw.showArtists;
  if (typeof raw.showFootLogo === "boolean") base.showFootLogo = raw.showFootLogo;
  if (typeof raw.showCallBtn === "boolean") base.showCallBtn = raw.showCallBtn;
  if (typeof raw.codePrefix === "string") {
    const prefix = raw.codePrefix.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (prefix) base.codePrefix = prefix;
  }
  if (typeof raw.org === "string" && raw.org.trim()) base.org = raw.org.trim().slice(0, 120);
  if ("logo" in raw) base.logo = imageRef(raw.logo);
  if ("poster" in raw) base.poster = imageRef(raw.poster);
  if (Array.isArray(raw.artists)) {
    // Danh sách rỗng là hợp lệ: trang chủ ẩn khối nghệ sĩ.
    base.artists = raw.artists.slice(0, 12).map(artist => ({
      title: String(artist?.title || "").trim().slice(0, 40),
      name: String(artist?.name || "").trim().slice(0, 80),
      photo: imageRef(artist?.photo)
    })).filter(artist => artist.name);
  }
  if (Array.isArray(raw.shows) && raw.shows.length) {
    const seen = new Set();
    const shows = raw.shows.slice(0, 8).map((show, index) => {
      let id = String(show.id || ("s" + (index + 1))).replace(/[^\w\-]/g, "").slice(0, 24) || ("s" + (index + 1));
      while (seen.has(id)) id += "x";
      seen.add(id);
      return {
        id,
        day: String(show.day || "").trim().slice(0, 16),
        label: String(show.label || "").trim().slice(0, 80),
        time: String(show.time || "").trim().slice(0, 8)
      };
    }).filter(show => show.day && show.label && show.time);
    if (shows.length) base.shows = shows;
  }
  const official = buildHallRows();
  const forceOfficial = !raw || raw.hallLayoutId !== HALL_LAYOUT_ID;
  if (!forceOfficial && Array.isArray(raw.rows) && raw.rows.length) {
    const rows = raw.rows.slice(0, 80).map(row => {
      const block = Number(row.block);
      return {
        label: String(row.label || "").trim().replace(/[\s/\\_"']/g, "").slice(0, 8),
        count: Math.min(40, Math.max(1, Number(row.count) || 1)),
        zone: row.zone === "lau" ? "lau" : "tre",
        block: block === 2 || block === 3 ? block : 1,
        locked: !!row.locked
      };
    }).filter(row => row.label);
    const labels = new Set(rows.map(row => row.label.toUpperCase()));
    if (rows.length && labels.size === rows.length) base.rows = rows;
  } else {
    base.rows = official;
  }
  base.hallLayoutId = HALL_LAYOUT_ID;
  const locked = seatsFromLockedRows(base.rows);
  const manual = [];
  if (Array.isArray(raw.blocked)) {
    for (const item of raw.blocked) {
      const seat = String(item || "").replace(/\s/g, "");
      if (!seat) continue;
      manual.push(seat);
    }
  }
  base.blocked = canonicalSeats(layoutOf(base), manual.concat(locked));
  return base;
}

function layoutOf(event) {
  const seats = new Set();
  for (const row of event.rows) {
    for (let number = 1; number <= row.count; number++) seats.add(row.label + number);
  }
  return seats;
}

function canonicalSeats(layout, raw) {
  if (!Array.isArray(raw)) return [];
  const byUpper = new Map();
  for (const seat of layout) byUpper.set(seat.toUpperCase(), seat);
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    const seat = byUpper.get(String(item || "").replace(/\s/g, "").toUpperCase());
    if (!seat || seen.has(seat)) continue;
    seen.add(seat);
    out.push(seat);
    if (out.length >= 600) break;
  }
  return out;
}

function seatId(show, seat) {
  return show + "_" + seat;
}

function newCode(prefix) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  let tail = "";
  for (const byte of bytes) tail += alphabet[byte % alphabet.length];
  return prefix + "-" + tail;
}

function regFromRow(row) {
  const seatIds = JSON.parse(row.seat_ids);
  return {
    regId: row.id,
    ownerUid: row.owner_uid,
    code: row.code,
    name: row.name,
    phone: row.phone,
    email: row.email || "",
    org: row.org || "",
    msg: row.msg || "",
    show: row.show_id,
    seatIds,
    seats: seatIds.length,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    checkedInAt: row.checked_in_at || ""
  };
}

function fail(message) {
  const error = new Error(message);
  error.expose = true;
  throw error;
}

function foldName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
}

function foldPhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("84") && digits.length >= 11) digits = "0" + digits.slice(2);
  return digits;
}

function identityFromBody(body) {
  const name = String(body?.name || "").trim().slice(0, 80);
  const phone = String(body?.phone || "").trim().slice(0, 16);
  const nameKey = foldName(name);
  const phoneKey = foldPhone(phone);
  if (nameKey.length < 2 || phoneKey.length < 8 || phoneKey.length > 15) fail("invalid");
  return { name, phone, nameKey, phoneKey };
}

export class Venue extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => this.ensureSchema());
  }

  ensureSchema() {
    const sql = this.ctx.storage.sql;
    sql.exec(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS registrations (
      id TEXT PRIMARY KEY,
      owner_uid TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      org TEXT NOT NULL DEFAULT '',
      msg TEXT NOT NULL DEFAULT '',
      show_id TEXT NOT NULL,
      seat_ids TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);
    sql.exec(`CREATE TABLE IF NOT EXISTS seats (
      id TEXT PRIMARY KEY,
      show_id TEXT NOT NULL,
      seat TEXT NOT NULL,
      registration_id TEXT NOT NULL DEFAULT '',
      owner_uid TEXT NOT NULL DEFAULT '',
      blocked INTEGER NOT NULL DEFAULT 0
    )`);
    sql.exec(`CREATE TABLE IF NOT EXISTS images (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      data BLOB NOT NULL,
      created_at TEXT NOT NULL
    )`);
    const cols = sql.exec("PRAGMA table_info(registrations)").toArray().map(row => row.name);
    if (!cols.includes("checked_in_at")) {
      sql.exec("ALTER TABLE registrations ADD COLUMN checked_in_at TEXT NOT NULL DEFAULT ''");
    }
    const existing = sql.exec("SELECT value FROM meta WHERE key = ?", "event").toArray();
    if (!existing.length) {
      sql.exec("INSERT INTO meta (key, value) VALUES (?, ?)", "event", JSON.stringify(normalizeEvent(null)));
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    const actor = request.headers.get("x-actor") || "";
    const staff = request.headers.get("x-staff") === "1";
    const checker = staff || request.headers.get("x-checkin") === "1";
    try {
      if (request.method === "GET" && url.pathname === "/api/health") {
        return Response.json({ ok: true });
      }
      if (request.method === "GET" && url.pathname === "/api/bootstrap") {
        return Response.json(this.snapshot(actor, staff, checker));
      }
      if (request.method === "PUT" && url.pathname === "/api/registrations") {
        const body = await request.json();
        const registration = this.saveRegistration(actor, staff, body);
        return Response.json({ ...this.snapshot(actor, staff, checker), registration });
      }
      const removal = url.pathname.match(/^\/api\/registrations\/([^/]+)$/);
      if (request.method === "DELETE" && removal) {
        this.deleteRegistration(actor, staff, decodeURIComponent(removal[1]));
        return Response.json(this.snapshot(actor, staff, checker));
      }
      if (request.method === "PUT" && url.pathname === "/api/event") {
        if (!staff) fail("forbidden");
        const event = normalizeEvent(await request.json());
        this.dropMissingImages(event);
        this.saveEvent(event);
        this.pruneImages(event);
        return Response.json(this.snapshot(actor, staff, checker));
      }
      if (request.method === "POST" && url.pathname === "/api/images") {
        if (!staff) fail("forbidden");
        return Response.json(await this.saveImage(new Uint8Array(await request.arrayBuffer())));
      }
      const imagePath = url.pathname.match(/^\/api\/images\/([a-f0-9]{24})$/);
      if (request.method === "GET" && imagePath) {
        const row = this.ctx.storage.sql.exec("SELECT type, data FROM images WHERE id = ?", imagePath[1]).toArray()[0];
        if (!row) return new Response("Không có ảnh", { status: 404 });
        return new Response(row.data, {
          headers: {
            "content-type": row.type,
            // Mã ảnh là băm nội dung, nên ảnh không bao giờ đổi dưới cùng một mã.
            "cache-control": "public, max-age=31536000, immutable",
            "x-content-type-options": "nosniff",
            "content-security-policy": "default-src 'none'"
          }
        });
      }
      if (request.method === "POST" && url.pathname === "/api/lookup") {
        const body = await request.json();
        const identity = identityFromBody(body);
        return Response.json({ registrations: this.findByIdentity(identity) });
      }
      if (request.method === "POST" && url.pathname === "/api/lookup/cancel") {
        const body = await request.json();
        const identity = identityFromBody(body);
        const id = String(body?.regId || "");
        if (!/^[A-Za-z0-9-]{4,48}$/.test(id)) fail("invalid");
        this.deleteByIdentity(identity, id);
        return Response.json({ ...this.snapshot(actor, staff, checker), cancelled: id });
      }
      if (request.method === "POST" && url.pathname === "/api/checkin/lookup") {
        if (!checker) fail("forbidden");
        const body = await request.json();
        return Response.json({ registrations: this.lookupForCheckin(body) });
      }
      if (request.method === "POST" && url.pathname === "/api/checkin") {
        if (!checker) fail("forbidden");
        const body = await request.json();
        const registration = this.markCheckin(body);
        return Response.json({ registration, registrations: this.lookupForCheckin({ code: registration.code }) });
      }
      return Response.json({ error: "invalid" }, { status: 404 });
    } catch (error) {
      const message = error && error.expose ? error.message : "invalid";
      if (!error?.expose) console.log(JSON.stringify({ level: "error", path: url.pathname, message: String(error) }));
      const status = message === "forbidden" || message === "notfound"
        ? (message === "notfound" ? 404 : 403)
        : message === "invalid" ? 400 : 409;
      return Response.json({ error: message }, { status });
    }
  }

  event() {
    const row = this.ctx.storage.sql.exec("SELECT value FROM meta WHERE key = ?", "event").toArray()[0];
    const parsed = row ? JSON.parse(row.value) : null;
    const event = normalizeEvent(parsed);
    const prevLock = (parsed?.rows || []).filter(r => r.locked).map(r => r.label).sort().join(",");
    const nextLock = event.rows.filter(r => r.locked).map(r => r.label).sort().join(",");
    const prevBlocked = Array.isArray(parsed?.blocked) ? parsed.blocked.length : -1;
    const layoutChanged = parsed?.hallLayoutId !== event.hallLayoutId || hallSig(parsed?.rows) !== hallSig(event.rows);
    if (prevLock !== nextLock || prevBlocked !== event.blocked.length || layoutChanged) this.saveEvent(event, false);
    return event;
  }

  snapshot(actor, staff, checker = staff) {
    const event = this.event();
    const seats = this.ctx.storage.sql.exec("SELECT * FROM seats").toArray().map(row => {
      const own = row.registration_id && (staff || row.registration_id === actor);
      return {
        id: row.id,
        show: row.show_id,
        seat: row.seat,
        blocked: row.blocked === 1,
        registrationId: row.blocked ? "" : (own ? row.registration_id : (row.registration_id ? "khac" : "")),
        ownerUid: own ? row.owner_uid : ""
      };
    });
    const mineRow = actor
      ? this.ctx.storage.sql.exec("SELECT * FROM registrations WHERE id = ?", actor).toArray()[0]
      : null;
    const registrations = staff
      ? this.ctx.storage.sql.exec("SELECT * FROM registrations ORDER BY created_at DESC").toArray().map(regFromRow)
      : [];
    return {
      uid: actor,
      staff,
      checkin: !!checker,
      event,
      seats,
      mine: mineRow ? regFromRow(mineRow) : null,
      registrations
    };
  }

  saveEvent(event, strict = true) {
    this.ctx.storage.transactionSync(() => {
      this.syncBlocked(event, strict);
      this.ctx.storage.sql.exec(
        "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        "event",
        JSON.stringify(event)
      );
    });
  }

  async saveImage(bytes) {
    if (!bytes.length || bytes.length > IMAGE_MAX_BYTES) fail("image-size");
    const type = sniffImage(bytes);
    if (!type) fail("image-type");
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    const id = [...digest].map(byte => byte.toString(16).padStart(2, "0")).join("").slice(0, 24);
    const sql = this.ctx.storage.sql;
    if (!sql.exec("SELECT id FROM images WHERE id = ?", id).toArray().length) {
      const count = sql.exec("SELECT COUNT(*) AS n FROM images").toArray()[0].n;
      if (count >= IMAGE_MAX_COUNT) fail("image-full");
      sql.exec("INSERT INTO images (id, type, data, created_at) VALUES (?, ?, ?, ?)", id, type, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), new Date().toISOString());
    }
    return { id, url: "/api/images/" + id };
  }

  dropMissingImages(event) {
    const sql = this.ctx.storage.sql;
    const has = id => !!id && sql.exec("SELECT id FROM images WHERE id = ?", id).toArray().length > 0;
    if (!has(event.logo)) event.logo = "";
    if (!has(event.poster)) event.poster = "";
    for (const artist of event.artists) if (!has(artist.photo)) artist.photo = "";
  }

  // Ảnh tải lên mà không dùng trong cấu hình đã lưu thì xóa sau một ngày.
  pruneImages(event) {
    const keep = imagesInEvent(event);
    const cutoff = new Date(Date.now() - 86400000).toISOString();
    for (const row of this.ctx.storage.sql.exec("SELECT id FROM images WHERE created_at < ?", cutoff).toArray()) {
      if (!keep.has(row.id)) this.ctx.storage.sql.exec("DELETE FROM images WHERE id = ?", row.id);
    }
  }

  // strict = false (tự chuyển dữ liệu): ghế đã có người thì để nguyên cho người đó, không báo lỗi.
  syncBlocked(event, strict = true) {
    const sql = this.ctx.storage.sql;
    const wanted = new Set(event.blocked);
    for (const show of event.shows) {
      const rows = sql.exec("SELECT id, seat, registration_id, blocked FROM seats WHERE show_id = ?", show.id).toArray();
      for (const row of rows) {
        if (row.blocked === 1 && !wanted.has(row.seat)) {
          if (row.registration_id) fail("taken:" + row.seat);
          sql.exec("DELETE FROM seats WHERE id = ?", row.id);
        }
      }
      for (const seat of wanted) {
        const id = seatId(show.id, seat);
        const current = sql.exec("SELECT registration_id, blocked FROM seats WHERE id = ?", id).toArray()[0];
        if (current?.registration_id) {
          if (strict) fail("taken:" + seat);
          continue;
        }
        if (!current) {
          sql.exec(
            "INSERT INTO seats (id, show_id, seat, registration_id, owner_uid, blocked) VALUES (?, ?, ?, '', '', 1)",
            id, show.id, seat
          );
        } else if (current.blocked !== 1) {
          sql.exec("UPDATE seats SET blocked = 1, registration_id = '', owner_uid = '' WHERE id = ?", id);
        }
      }
    }
  }

  saveRegistration(actor, staff, body) {
    return this.ctx.storage.transactionSync(() => {
      const event = this.event();
      const layout = layoutOf(event);
      const id = String(body?.regId || "");
      if (!/^[A-Za-z0-9-]{4,48}$/.test(id)) fail("invalid");
      const hostBooking = id.startsWith("btc-");
      if (!staff && (id !== actor || hostBooking)) fail("forbidden");
      const current = this.ctx.storage.sql.exec("SELECT * FROM registrations WHERE id = ?", id).toArray()[0];
      if (current && !staff && current.owner_uid !== actor) fail("forbidden");
      const show = String(body.show || "");
      if (!event.shows.some(item => item.id === show)) fail("invalid");
      const seatIds = [...new Set(Array.isArray(body.seatIds) ? body.seatIds.map(seat => String(seat)) : [])];
      if (!seatIds.length || seatIds.length > event.maxSeats) fail(seatIds.length ? "full" : "invalid");
      for (const seat of seatIds) {
        if (!layout.has(seat)) fail("invalid");
      }
      if (!event.openLau && !staff) {
        // Lầu đóng: khách không giữ thêm ghế trên lầu; ghế lầu đã có trong đăng ký cũ vẫn giữ được.
        const lau = new Set(event.rows.filter(row => row.zone === "lau").map(row => row.label));
        const held = new Set(current && current.show_id === show ? JSON.parse(current.seat_ids) : []);
        for (const seat of seatIds) {
          const row = event.rows.find(r => seat.startsWith(r.label) && /^\d+$/.test(seat.slice(r.label.length)));
          if (row && lau.has(row.label) && !held.has(seat)) fail("closed:" + seat);
        }
      }
      const name = String(body.name || "").trim().slice(0, 80);
      const phone = String(body.phone || "").trim().slice(0, 16);
      const digits = phone.replace(/\D/g, "");
      if (!name || digits.length < 8 || digits.length > 15) fail("invalid");
      const email = String(body.email || "").trim().slice(0, 120);
      if (email && !/^[^\s@]+@[^\s@]+$/.test(email)) fail("invalid");
      const now = new Date().toISOString();
      const record = {
        id,
        ownerUid: current?.owner_uid || actor,
        code: current?.code || this.uniqueCode(String(body.code || ""), event.codePrefix, id),
        name,
        phone,
        email,
        org: String(body.org || "").trim().slice(0, 100),
        msg: String(body.msg || "").trim().slice(0, 300),
        show,
        seatIds,
        source: hostBooking ? "btc" : (current?.source || "guest"),
        createdAt: current?.created_at || now,
        updatedAt: now
      };
      this.moveSeats(current, record);
      this.ctx.storage.sql.exec(
        `INSERT INTO registrations
          (id, owner_uid, code, name, phone, email, org, msg, show_id, seat_ids, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
          name = excluded.name, phone = excluded.phone, email = excluded.email, org = excluded.org,
          msg = excluded.msg, show_id = excluded.show_id, seat_ids = excluded.seat_ids,
          source = excluded.source, updated_at = excluded.updated_at`,
        record.id, record.ownerUid, record.code, record.name, record.phone, record.email, record.org,
        record.msg, record.show, JSON.stringify(record.seatIds), record.source, record.createdAt, record.updatedAt
      );
      return {
        regId: record.id,
        ownerUid: record.ownerUid,
        code: record.code,
        name: record.name,
        phone: record.phone,
        email: record.email,
        org: record.org,
        msg: record.msg,
        show: record.show,
        seatIds: record.seatIds,
        seats: record.seatIds.length,
        source: record.source,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
      };
    });
  }

  uniqueCode(requested, prefix, id) {
    const sql = this.ctx.storage.sql;
    if (/^[A-Z0-9]{2,6}-[A-Z0-9]{4,8}$/.test(requested)) {
      const clash = sql.exec("SELECT id FROM registrations WHERE code = ? AND id <> ?", requested, id).toArray()[0];
      if (!clash) return requested;
    }
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = newCode(prefix || "VE");
      const clash = sql.exec("SELECT id FROM registrations WHERE code = ?", code).toArray()[0];
      if (!clash) return code;
    }
    fail("invalid");
  }

  moveSeats(current, record) {
    const sql = this.ctx.storage.sql;
    const previous = current ? JSON.parse(current.seat_ids) : [];
    const previousShow = current?.show_id || "";
    const keep = new Set(previousShow === record.show ? record.seatIds : []);
    for (const seat of previous) {
      if (previousShow === record.show && keep.has(seat)) continue;
      const id = seatId(previousShow, seat);
      const row = sql.exec("SELECT blocked FROM seats WHERE id = ? AND registration_id = ?", id, record.id).toArray()[0];
      if (!row) continue;
      if (row.blocked === 1) sql.exec("UPDATE seats SET registration_id = '', owner_uid = '' WHERE id = ?", id);
      else sql.exec("DELETE FROM seats WHERE id = ?", id);
    }
    for (const seat of record.seatIds) {
      if (previousShow === record.show && previous.includes(seat)) continue;
      const id = seatId(record.show, seat);
      const row = sql.exec("SELECT registration_id, blocked FROM seats WHERE id = ?", id).toArray()[0];
      if (row?.blocked === 1 && row.registration_id !== record.id) fail("blocked:" + seat);
      if (row?.registration_id && row.registration_id !== record.id) fail("taken:" + seat);
      if (!row) {
        sql.exec(
          "INSERT INTO seats (id, show_id, seat, registration_id, owner_uid, blocked) VALUES (?, ?, ?, ?, ?, 0)",
          id, record.show, seat, record.id, record.ownerUid
        );
      } else {
        sql.exec("UPDATE seats SET registration_id = ?, owner_uid = ?, blocked = 0 WHERE id = ?", record.id, record.ownerUid, id);
      }
    }
  }

  findByIdentity(identity) {
    return this.ctx.storage.sql.exec("SELECT * FROM registrations ORDER BY created_at DESC").toArray()
      .filter(row => foldName(row.name) === identity.nameKey && foldPhone(row.phone) === identity.phoneKey)
      .map(regFromRow);
  }

  lookupForCheckin(body) {
    const code = String(body?.code || "").trim().toUpperCase();
    if (code) {
      const row = this.ctx.storage.sql.exec(
        "SELECT * FROM registrations WHERE upper(code) = ? LIMIT 1",
        code
      ).toArray()[0];
      return row ? [regFromRow(row)] : [];
    }
    return this.findByIdentity(identityFromBody(body));
  }

  markCheckin(body) {
    const id = String(body?.regId || "").trim();
    if (!/^[A-Za-z0-9-]{4,48}$/.test(id)) fail("invalid");
    let out = null;
    this.ctx.storage.transactionSync(() => {
      const current = this.ctx.storage.sql.exec("SELECT * FROM registrations WHERE id = ?", id).toArray()[0];
      if (!current) fail("notfound");
      const when = current.checked_in_at || new Date().toISOString();
      this.ctx.storage.sql.exec(
        "UPDATE registrations SET checked_in_at = ?, updated_at = ? WHERE id = ?",
        when,
        new Date().toISOString(),
        id
      );
      out = regFromRow(this.ctx.storage.sql.exec("SELECT * FROM registrations WHERE id = ?", id).toArray()[0]);
    });
    return out;
  }

  matchesIdentity(row, identity) {
    return !!row && foldName(row.name) === identity.nameKey && foldPhone(row.phone) === identity.phoneKey;
  }

  deleteRegistration(actor, staff, id) {
    this.ctx.storage.transactionSync(() => {
      const current = this.ctx.storage.sql.exec("SELECT * FROM registrations WHERE id = ?", id).toArray()[0];
      if (!current) return;
      if (!staff && current.owner_uid !== actor && current.id !== actor) fail("forbidden");
      this.releaseRegistrationRow(current);
    });
  }

  deleteByIdentity(identity, id) {
    this.ctx.storage.transactionSync(() => {
      const current = this.ctx.storage.sql.exec("SELECT * FROM registrations WHERE id = ?", id).toArray()[0];
      if (!this.matchesIdentity(current, identity)) fail("notfound");
      this.releaseRegistrationRow(current);
    });
  }

  releaseRegistrationRow(current) {
    const seats = JSON.parse(current.seat_ids);
    for (const seat of seats) {
      const seatKey = seatId(current.show_id, seat);
      const row = this.ctx.storage.sql.exec("SELECT blocked FROM seats WHERE id = ?", seatKey).toArray()[0];
      if (!row) continue;
      if (row.blocked === 1) {
        this.ctx.storage.sql.exec("UPDATE seats SET registration_id = '', owner_uid = '' WHERE id = ?", seatKey);
      } else {
        this.ctx.storage.sql.exec("DELETE FROM seats WHERE id = ?", seatKey);
      }
    }
    this.ctx.storage.sql.exec("DELETE FROM registrations WHERE id = ?", current.id);
  }
}

function cookieMap(request) {
  const cookies = {};
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const index = part.indexOf("=");
    if (index > 0) cookies[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return cookies;
}

function safeEqual(left, right) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let index = 0; index < length; index++) diff |= (a[index] || 0) ^ (b[index] || 0);
  return diff === 0;
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function secureRequest(request) {
  if (new URL(request.url).protocol === "https:") return true;
  if (request.headers.get("x-forwarded-proto") === "https") return true;
  const visitor = request.headers.get("cf-visitor");
  return !!visitor && visitor.includes('"https"');
}

function cookie(name, value, secure, maxAge) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function newUid() {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return "k" + [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function withCookies(response, cookies) {
  if (!cookies.length) return response;
  const headers = new Headers(response.headers);
  for (const item of cookies) headers.append("set-cookie", item);
  return new Response(response.body, { status: response.status, headers });
}

// role: "admin" (ban tổ chức, toàn quyền) | "checkin" (chỉ tra cứu và xác nhận vào cửa) | "" (khách).
async function callVenue(request, env, actor, role, path) {
  const url = new URL(path || new URL(request.url).pathname, request.url);
  const headers = new Headers();
  headers.set("x-actor", actor);
  headers.set("x-staff", role === "admin" ? "1" : "0");
  headers.set("x-checkin", role === "admin" || role === "checkin" ? "1" : "0");
  const init = { method: request.method, headers };
  if (!path && (request.method === "PUT" || request.method === "POST")) init.body = await request.text();
  return env.VENUE.getByName("mac-dinh").fetch(new Request(url, init));
}

// Cookie ve_staff là HMAC của vai trò + mật khẩu hiện tại: đổi mật khẩu nào thì phiên của vai trò đó hết hạn.
async function roleToken(env, role) {
  if (role === "admin") return hmac(env.STAFF_SECRET, "staff:" + env.STAFF_PASSWORD);
  if (role === "checkin" && env.CHECKIN_PASSWORD) return hmac(env.STAFF_SECRET, "checkin:" + env.CHECKIN_PASSWORD);
  return "";
}
async function roleFromCookie(env, value) {
  if (!env.STAFF_PASSWORD || !env.STAFF_SECRET || !value) return "";
  if (safeEqual(value, await roleToken(env, "admin"))) return "admin";
  if (env.CHECKIN_PASSWORD && safeEqual(value, await roleToken(env, "checkin"))) return "checkin";
  return "";
}
async function isStaff(request, env) {
  return (await roleFromCookie(env, cookieMap(request).ve_staff)) === "admin";
}

// Ảnh đi đường riêng: thân là byte ảnh, không qua giới hạn 20 KB của JSON.
async function handleImages(request, env, url) {
  const venue = env.VENUE.getByName("mac-dinh");
  if (request.method === "GET") {
    return venue.fetch(new Request(url, { method: "GET" }));
  }
  if (request.method === "POST" && url.pathname === "/api/images") {
    if (!(await isStaff(request, env))) return Response.json({ error: "forbidden" }, { status: 403 });
    const declared = Number(request.headers.get("content-length") || 0);
    if (declared > IMAGE_MAX_BYTES) return Response.json({ error: "image-size" }, { status: 413 });
    const body = await request.arrayBuffer();
    if (body.byteLength > IMAGE_MAX_BYTES) return Response.json({ error: "image-size" }, { status: 413 });
    const headers = new Headers({ "x-staff": "1", "x-actor": "" });
    return venue.fetch(new Request(url, { method: "POST", headers, body }));
  }
  return Response.json({ error: "invalid" }, { status: 404 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (request.method === "GET" && url.pathname === "/api/version") {
      return Response.json({ name: "ve-moi", features: ["lookup", "hall-vip-ad", "aisles", "images"] });
    }
    const secure = secureRequest(request);
    if (url.pathname.startsWith("/api/images")) return handleImages(request, env, url);
    if (request.method === "PUT" || request.method === "POST") {
      const text = await request.text();
      if (text.length > 20000) return Response.json({ error: "invalid" }, { status: 400 });
      request = new Request(request, { body: text });
    }
    const cookies = cookieMap(request);
    let uid = cookies.ve && /^k[0-9a-f]{18}$/.test(cookies.ve) ? cookies.ve : "";
    const fresh = !uid;
    if (!uid) uid = newUid();
    const session = fresh ? [cookie("ve", uid, secure, 31536000)] : [];
    const role = await roleFromCookie(env, cookies.ve_staff);
    if (url.pathname === "/api/staff/login" && request.method === "POST") {
      if (!env.STAFF_PASSWORD || !env.STAFF_SECRET) return Response.json({ error: "forbidden" }, { status: 403 });
      let password = "";
      try { password = String((await request.json()).password || ""); }
      catch { password = ""; }
      // Mật khẩu ban tổ chức = toàn quyền; mật khẩu check-in (CHECKIN_PASSWORD, tùy chọn) = chỉ check-in.
      let next = "";
      if (safeEqual(await hmac(env.STAFF_SECRET, "staff:" + password), await roleToken(env, "admin"))) next = "admin";
      else if (env.CHECKIN_PASSWORD && safeEqual(await hmac(env.STAFF_SECRET, "checkin:" + password), await roleToken(env, "checkin"))) next = "checkin";
      if (!next) return withCookies(Response.json({ error: "forbidden" }, { status: 403 }), session);
      const snapshot = await callVenue(new Request(new URL("/api/bootstrap", request.url)), env, uid, next, "/api/bootstrap");
      return withCookies(snapshot, session.concat(cookie("ve_staff", await roleToken(env, next), secure, 60 * 60 * 12)));
    }
    if (url.pathname === "/api/staff/logout" && request.method === "POST") {
      const snapshot = await callVenue(new Request(new URL("/api/bootstrap", request.url)), env, uid, "", "/api/bootstrap");
      return withCookies(snapshot, session.concat(cookie("ve_staff", "", secure, 0)));
    }
    return withCookies(await callVenue(request, env, uid, role), session);
  }
};
