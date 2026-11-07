const base = process.env.API_BASE || "http://127.0.0.1:8787";
const staffPassword = process.env.STAFF_PASSWORD || "doi-mat-khau-nay";
const checkinPassword = process.env.CHECKIN_PASSWORD || "checkin-thu";

function fail(message) {
  throw new Error(message);
}

async function call(path, options, jar) {
  const headers = new Headers(options?.headers || {});
  if (jar.length) headers.set("cookie", jar.map(item => item.name + "=" + item.value).join("; "));
  const response = await fetch(base + path, { ...options, headers });
  const set = response.headers.getSetCookie?.() || [];
  for (const cookie of set) {
    const pair = cookie.split(";")[0];
    const index = pair.indexOf("=");
    if (index <= 0) continue;
    const name = pair.slice(0, index);
    const value = pair.slice(index + 1);
    const existing = jar.findIndex(item => item.name === name);
    if (existing >= 0) jar.splice(existing, 1);
    if (!/max-age=0/i.test(cookie)) jar.push({ name, value });
  }
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

function book(jar, uid, seat, extra) {
  return call("/api/registrations", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      regId: uid,
      name: "Lý Thị Mai",
      phone: "0903123456",
      email: "",
      org: "",
      msg: "",
      show: "s1",
      seatIds: [seat],
      source: "guest",
      ...extra
    })
  }, jar);
}

const page = await fetch(base + "/");
const html = await page.text();
if (page.status !== 200 || !html.includes("Tiếng Hò")) fail("page " + page.status);
if (!html.includes("Kiểm tra vé")) fail("page missing lookup");

const guest = [];
const health = await call("/api/health", {}, guest);
if (health.status !== 200 || !health.data.ok) fail("health " + health.status);
const boot = await call("/api/bootstrap", {}, guest);
if (boot.status !== 200 || !String(boot.data.uid || "").startsWith("k")) fail("bootstrap");
if (boot.data.staff || (boot.data.registrations || []).length) fail("guest sees staff data");

const seat = "1A2";
const created = await book(guest, boot.data.uid, seat, { code: "VE-TEST1" });
if (created.status !== 200 || created.data.registration?.seatIds?.join() !== seat) {
  fail("book " + created.status + " " + JSON.stringify(created.data));
}
if (created.data.registration?.code !== "VE-TEST1") fail("code " + created.data.registration?.code);
if (!created.data.mine || created.data.mine.phone !== "0903123456") fail("owner phone");

const other = [];
const otherBoot = await call("/api/bootstrap", {}, other);
const visible = (otherBoot.data.seats || []).find(item => item.seat === seat && item.show === "s1");
if (!visible || visible.registrationId !== "khac" || visible.ownerUid) fail("seat privacy " + JSON.stringify(visible));
if (JSON.stringify(otherBoot.data).includes("0903123456")) fail("phone leaked");

const clash = await book(other, otherBoot.data.uid, seat);
if (clash.status !== 409 || clash.data.error !== "taken:" + seat) fail("clash " + JSON.stringify(clash.data));

const foreign = await call("/api/registrations/" + boot.data.uid, { method: "DELETE" }, other);
if (foreign.status !== 403) fail("foreign delete " + foreign.status);

const denied = await call("/api/event", {
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ title: "Khong duoc" })
}, guest);
if (denied.status !== 403) fail("guest event " + denied.status);

const badStaff = [];
const badLogin = await call("/api/staff/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ password: "sai-mat-khau" })
}, badStaff);
if (badLogin.status !== 403) fail("bad login " + badLogin.status);

const staff = [];
const login = await call("/api/staff/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ password: staffPassword })
}, staff);
if (login.status !== 200 || !login.data.staff) fail("login " + login.status);
const found = (login.data.registrations || []).find(row => row.code === "VE-TEST1");
if (!found || found.phone !== "0903123456") fail("staff list");

// Vai trò chỉ check-in: tra cứu và xác nhận vào cửa được, không xem danh sách, không sửa sự kiện, không đặt hộ.
const door = [];
const doorLogin = await call("/api/staff/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ password: checkinPassword })
}, door);
if (doorLogin.status !== 200 || doorLogin.data.staff !== false || doorLogin.data.checkin !== true) fail("checkin login " + doorLogin.status + " " + JSON.stringify({ staff: doorLogin.data.staff, checkin: doorLogin.data.checkin }));
if ((doorLogin.data.registrations || []).length) fail("checkin role sees registrations");
const doorBoot = await call("/api/bootstrap", {}, door);
if (doorBoot.data.staff !== false || doorBoot.data.checkin !== true || (doorBoot.data.registrations || []).length) fail("checkin bootstrap");
if ((doorBoot.data.seats || []).some(s => s.registrationId && s.registrationId !== "khac")) fail("checkin role sees seat owners");
const doorEvent = await call("/api/event", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Khong duoc" }) }, door);
if (doorEvent.status !== 403) fail("checkin role edits event " + doorEvent.status);
const doorImage = await call("/api/images", { method: "POST", headers: { "content-type": "image/png" }, body: new Uint8Array([137, 80, 78, 71]) }, door);
if (doorImage.status !== 403) fail("checkin role uploads image " + doorImage.status);
const doorHost = await call("/api/registrations", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ regId: "btc-VE-DOOR1", name: "Không được", phone: "0900000009", show: "s1", seatIds: ["1C3"], code: "VE-DOOR1", source: "btc" }) }, door);
if (doorHost.status !== 403) fail("checkin role host-books " + doorHost.status);
const doorFind = await call("/api/checkin/lookup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: "VE-TEST1" }) }, door);
if (doorFind.status !== 200 || !(doorFind.data.registrations || []).some(r => r.code === "VE-TEST1")) fail("checkin role lookup " + doorFind.status);
const guestFind = await call("/api/checkin/lookup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: "VE-TEST1" }) }, []);
if (guestFind.status !== 403) fail("guest checkin lookup " + guestFind.status);
await call("/api/staff/logout", { method: "POST", body: "{}" }, door);
const doorOut = await call("/api/checkin/lookup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: "VE-TEST1" }) }, door);
if (doorOut.status !== 403) fail("checkin after logout " + doorOut.status);

const blocked = await call("/api/event", {
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ ...login.data.event, blocked: ["1A1"] })
}, staff);
if (blocked.status !== 200 || !(blocked.data.event?.blocked || []).includes("1A1")) fail("block " + JSON.stringify(blocked.data));
const closed = await book(other, otherBoot.data.uid, "1A1");
if (closed.status !== 409 || closed.data.error !== "blocked:1A1") fail("blocked " + JSON.stringify(closed.data));

const hostId = "btc-VE-HOST1";
const host = await call("/api/registrations", {
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    regId: hostId,
    name: "Khách được đặt hộ",
    phone: "0987654321",
    show: "s1",
    seatIds: ["1B2"],
    code: "VE-HOST1",
    source: "btc"
  })
}, staff);
if (host.status !== 200 || host.data.registration?.source !== "btc") fail("host " + host.status + " " + JSON.stringify(host.data));
const guestHost = await call("/api/registrations", {
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    regId: "btc-VE-NOPE1",
    name: "Khách lạ",
    phone: "0900000001",
    show: "s1",
    seatIds: ["1B3"],
    code: "VE-NOPE1",
    source: "btc"
  })
}, other);
if (guestHost.status !== 403) fail("guest host " + guestHost.status);

const races = await Promise.all([0, 1].map(async (index) => {
  const jar = [];
  const start = await call("/api/bootstrap", {}, jar);
  const result = await book(jar, start.data.uid, "1C4", { name: "Người " + index, phone: "090100000" + index });
  return { jar, uid: start.data.uid, result };
}));
const winners = races.filter(item => item.result.status === 200);
const losers = races.filter(item => item.result.status === 409 && item.result.data.error === "taken:1C4");
if (winners.length !== 1 || losers.length !== 1) fail("race " + JSON.stringify(races.map(item => item.result)));

const opened = await call("/api/event", {
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ ...blocked.data.event, blocked: [] })
}, staff);
if (opened.status !== 200 || (opened.data.event?.blocked || []).includes("1A1")) fail("unblock");

// Khối 2 hàng A–D khóa sẵn: khách không đặt được.
const lockedRows = (opened.data.event?.rows || []).filter(row => row.locked).map(row => row.label).join();
if (lockedRows !== "2A,2B,2C,2D") fail("locked rows " + lockedRows);
const vip = await book(other, otherBoot.data.uid, "2A1");
if (vip.status !== 409 || vip.data.error !== "blocked:2A1") fail("2A locked " + JSON.stringify(vip.data));

// Ban tổ chức xóa được vé của khách.
const winner = winners[0];
const staffDel = await call("/api/registrations/" + winner.uid, { method: "DELETE" }, staff);
if (staffDel.status !== 200 || (staffDel.data.registrations || []).some(row => row.regId === winner.uid)) fail("staff delete " + staffDel.status);
for (const item of races) {
  await call("/api/registrations/" + item.uid, { method: "DELETE" }, item.jar);
}
await call("/api/registrations/" + hostId, { method: "DELETE" }, staff);
const removed = await call("/api/registrations/" + boot.data.uid, { method: "DELETE" }, guest);
if (removed.status !== 200 || removed.data.mine) fail("delete");
const after = await call("/api/bootstrap", {}, other);
const tracked = new Set(["1A2", "1A1", "1B2", "1B3", "1C4"]);
const leftover = (after.data.seats || []).filter(item => tracked.has(item.seat) && item.registrationId);
if (leftover.length) fail("seats left " + JSON.stringify(leftover));

const lookupJar = [];
const lookupBoot = await call("/api/bootstrap", {}, lookupJar);
const lookupName = "Pham Tra Cuu Check";
const lookupPhone = "0903555666";
const lookupBook = await call("/api/registrations", {
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    regId: lookupBoot.data.uid,
    name: lookupName,
    phone: lookupPhone,
    email: "",
    org: "",
    msg: "",
    show: "s1",
    seatIds: ["1D5"],
    code: "VE-LOOK1",
    source: "guest"
  })
}, lookupJar);
if (lookupBook.status !== 200) fail("lookup book " + lookupBook.status + " " + JSON.stringify(lookupBook.data));
const stranger = [];
const miss = await call("/api/lookup", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: lookupName, phone: "0903000000" })
}, stranger);
if (miss.status !== 200 || (miss.data.registrations || []).length) {
  fail("lookup miss " + miss.status + " " + JSON.stringify(miss.data));
}
const hit = await call("/api/lookup", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: "pham tra cuu check", phone: "+84903555666" })
}, stranger);
if (hit.status !== 200 || hit.data.registrations?.[0]?.code !== "VE-LOOK1") fail("lookup hit " + JSON.stringify(hit.data));
const badCancel = await call("/api/lookup/cancel", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: lookupName, phone: "0903000000", regId: lookupBoot.data.uid })
}, stranger);
if (badCancel.status !== 404) fail("lookup bad cancel " + badCancel.status + " " + JSON.stringify(badCancel.data));
const goodCancel = await call("/api/lookup/cancel", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: lookupName, phone: lookupPhone, regId: lookupBoot.data.uid })
}, stranger);
if (goodCancel.status !== 200 || goodCancel.data.cancelled !== lookupBoot.data.uid) fail("lookup cancel " + JSON.stringify(goodCancel.data));
const gone = await call("/api/lookup", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: lookupName, phone: lookupPhone })
}, stranger);
if ((gone.data.registrations || []).length) fail("lookup still there");

// Công tắc ghế trên lầu: đóng thì khách không giữ được, mở thì giữ được.
const putEvent = body => call("/api/event", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, staff);
const lauJar = [];
const lauBoot = await call("/api/bootstrap", {}, lauJar);
const lauClosed = await putEvent({ ...opened.data.event, openLau: false });
if (lauClosed.status !== 200 || lauClosed.data.event?.openLau !== false) fail("close lau");
const lauDenied = await book(lauJar, lauBoot.data.uid, "L1A1");
if (lauDenied.status !== 409 || lauDenied.data.error !== "closed:L1A1") fail("lau closed " + JSON.stringify(lauDenied.data));
const lauGround = await book(lauJar, lauBoot.data.uid, "1E6");
if (lauGround.status !== 200) fail("ground while lau closed " + JSON.stringify(lauGround.data));
const lauOpened = await putEvent({ ...opened.data.event, openLau: true });
if (lauOpened.status !== 200 || lauOpened.data.event?.openLau !== true) fail("open lau");
const lauBooked = await book(lauJar, lauBoot.data.uid, "L1A1");
if (lauBooked.status !== 200 || lauBooked.data.registration?.seatIds?.join() !== "L1A1") fail("lau open " + JSON.stringify(lauBooked.data));
await call("/api/registrations/" + lauBoot.data.uid, { method: "DELETE" }, lauJar);

// Công tắc ẩn/hiện khối nghệ sĩ và logo chân trang.
const hidden = await putEvent({ ...lauOpened.data.event, showArtists: false, showFootLogo: false, showCallBtn: false });
if (hidden.status !== 200 || hidden.data.event?.showArtists !== false || hidden.data.event?.showFootLogo !== false) fail("hide home blocks");
const shown = await putEvent({ ...hidden.data.event, showArtists: true, showFootLogo: true });
if (shown.status !== 200 || shown.data.event?.showArtists !== true || shown.data.event?.showFootLogo !== true) fail("show home blocks");

// Ảnh và cấu hình trang chủ (nghệ sĩ, logo, đơn vị tổ chức).
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
const guestUpload = await call("/api/images", { method: "POST", headers: { "content-type": "image/png" }, body: png }, guest);
if (guestUpload.status !== 403) fail("guest image upload " + guestUpload.status);
const notImage = await call("/api/images", { method: "POST", headers: { "content-type": "image/png" }, body: "<svg/>" }, staff);
if (notImage.status === 200) fail("non-image accepted");
const upload = await call("/api/images", { method: "POST", headers: { "content-type": "image/png" }, body: png }, staff);
if (upload.status !== 200 || !/^[a-f0-9]{24}$/.test(upload.data.id || "")) fail("image upload " + JSON.stringify(upload.data));
const served = await fetch(base + "/api/images/" + upload.data.id);
if (served.status !== 200 || served.headers.get("content-type") !== "image/png") fail("image serve " + served.status);
if (Buffer.compare(Buffer.from(await served.arrayBuffer()), png) !== 0) fail("image bytes");
const original = opened.data.event;
const media = await call("/api/event", {
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    ...original,
    org: "Đơn vị kiểm tra",
    logo: upload.data.id,
    poster: "0123456789abcdef01234567",
    artists: [{ title: "NSND", name: "Nghệ sĩ Kiểm Tra", photo: upload.data.id }, { title: "", name: "  " }]
  })
}, staff);
const saved = media.data.event || {};
if (media.status !== 200 || saved.org !== "Đơn vị kiểm tra" || saved.logo !== upload.data.id) fail("media save " + JSON.stringify(saved));
if (saved.poster !== "") fail("unknown image id kept");
if (saved.artists?.length !== 1 || saved.artists[0].photo !== upload.data.id) fail("artists " + JSON.stringify(saved.artists));
const restored = await call("/api/event", {
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(original)
}, staff);
if (restored.status !== 200 || restored.data.event?.org !== original.org) fail("media restore");

console.log("api-ok");
