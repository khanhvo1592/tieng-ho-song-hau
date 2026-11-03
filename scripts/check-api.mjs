const base = process.env.API_BASE || "http://127.0.0.1:8787";
const staffPassword = process.env.STAFF_PASSWORD || "doi-mat-khau-nay";

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

const guest = [];
const health = await call("/api/health", {}, guest);
if (health.status !== 200 || !health.data.ok) fail("health " + health.status);
const boot = await call("/api/bootstrap", {}, guest);
if (boot.status !== 200 || !String(boot.data.uid || "").startsWith("k")) fail("bootstrap");
if (boot.data.staff || (boot.data.registrations || []).length) fail("guest sees staff data");

const seat = "A2";
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

const blocked = await call("/api/event", {
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ ...login.data.event, blocked: ["A1"] })
}, staff);
if (blocked.status !== 200 || !(blocked.data.event?.blocked || []).includes("A1")) fail("block " + JSON.stringify(blocked.data));
const closed = await book(other, otherBoot.data.uid, "A1");
if (closed.status !== 409 || closed.data.error !== "blocked:A1") fail("blocked " + JSON.stringify(closed.data));

const hostId = "btc-VE-HOST1";
const host = await call("/api/registrations", {
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    regId: hostId,
    name: "Khách được đặt hộ",
    phone: "0987654321",
    show: "s1",
    seatIds: ["B2"],
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
    seatIds: ["B3"],
    code: "VE-NOPE1",
    source: "btc"
  })
}, other);
if (guestHost.status !== 403) fail("guest host " + guestHost.status);

const races = await Promise.all([0, 1].map(async (index) => {
  const jar = [];
  const start = await call("/api/bootstrap", {}, jar);
  const result = await book(jar, start.data.uid, "C4", { name: "Người " + index, phone: "090100000" + index });
  return { jar, uid: start.data.uid, result };
}));
const winners = races.filter(item => item.result.status === 200);
const losers = races.filter(item => item.result.status === 409 && item.result.data.error === "taken:C4");
if (winners.length !== 1 || losers.length !== 1) fail("race " + JSON.stringify(races.map(item => item.result)));

const opened = await call("/api/event", {
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ ...blocked.data.event, blocked: [] })
}, staff);
if (opened.status !== 200 || (opened.data.event?.blocked || []).length) fail("unblock");

for (const item of races) {
  await call("/api/registrations/" + item.uid, { method: "DELETE" }, item.jar);
}
await call("/api/registrations/" + hostId, { method: "DELETE" }, staff);
const removed = await call("/api/registrations/" + boot.data.uid, { method: "DELETE" }, guest);
if (removed.status !== 200 || removed.data.mine) fail("delete");
const after = await call("/api/bootstrap", {}, other);
if ((after.data.seats || []).some(item => item.registrationId)) fail("seats left");

console.log("api-ok");
