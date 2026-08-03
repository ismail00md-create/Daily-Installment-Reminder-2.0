(function () {
  function plugin() {
    return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BulkSms;
  }

  async function ensurePerm() {
    const p = plugin();
    if (!p) throw new Error("Native SMS not available (install new APK build).");
    await p.requestPermission();
  }

  async function sendOne(number, message) {
    const p = plugin();
    await ensurePerm();
    await p.sendOne({ number: String(number || ""), message: String(message || "") });
  }

  async function sendBulk(numbers, message) {
    const p = plugin();
    await ensurePerm();
    const res = await p.sendBulk({ numbers, message: String(message || "") });
    return res;
  }

  // Try to read current message from your app variables (fallback to prompt)
  function getMessageFromApp() {
    // if your app stores template in localStorage
    const keys = ["smsTemplate", "sms", "message", "customSms"];
    for (const k of keys) {
      const v = localStorage.getItem(k);
      if (v && v.trim()) return v;
    }
    return null;
  }

  function getNumbersFromListUI() {
    // picks 10-digit-like numbers shown in the screen
    const text = document.body.innerText || "";
    const matches = text.match(/(?:\+?91[\s-]?)?[6-9]\d{9}/g) || [];
    const nums = Array.from(new Set(matches.map(x => x.replace(/\D/g, "").slice(-10)).filter(x => x.length === 10)));
    return nums;
  }

  async function handleSendAllClick(e) {
    try {
      const numbers = getNumbersFromListUI();
      if (!numbers.length) return alert("No numbers found on screen.");
      const msg = getMessageFromApp() || prompt("Type SMS message to send all");
      if (!msg) return;

      if (!confirm("Send SMS to " + numbers.length + " customers?")) return;
      const res = await sendBulk(numbers, msg);
      alert("Sent to: " + (res && res.sent ? res.sent : numbers.length));
    } catch (err) {
      alert(err && err.message ? err.message : String(err));
    }
  }

  async function handleSingleSendClick(e) {
    try {
      // find nearest phone number in the same card/row
      const card = e.target.closest("div") || document.body;
      const t = card.innerText || "";
      const m = t.match(/(?:\+?91[\s-]?)?[6-9]\d{9}/);
      if (!m) return alert("No phone number found.");
      const number = m[0].replace(/\D/g, "").slice(-10);

      const msg = getMessageFromApp() || prompt("Type SMS message");
      if (!msg) return;

      if (!confirm("Send SMS to " + number + " ?")) return;
      await sendOne(number, msg);
      alert("SMS sent");
    } catch (err) {
      alert(err && err.message ? err.message : String(err));
    }
  }

  document.addEventListener("click", function (e) {
    const el = e.target;

    // SEND ALL button by text
    if (el && el.innerText && el.innerText.includes("Send to All")) {
      e.preventDefault();
      e.stopPropagation();
      handleSendAllClick(e);
      return;
    }

    // single send: plane icon button - heuristics (blue small button)
    const btn = el.closest("button");
    if (btn && btn.innerText.trim() === "" && btn.style && (btn.style.background || "").includes("rgb")) {
      // ignore (too generic)
    }

    // If clicking on an element inside customer row that has plane icon (we use title if present)
    if (btn && (btn.getAttribute("aria-label") || "").toLowerCase().includes("send")) {
      e.preventDefault();
      e.stopPropagation();
      handleSingleSendClick(e);
    }
  }, true);

  console.log("native-sms hook loaded");
})();
