(function () {
  const RE = /(?:\+?91[\s-]?)?[6-9]\d{9}/g;
  let BulkSmsProxy = null;

  function getCap() {
    return globalThis.Capacitor || window.Capacitor || null;
  }

  function plugin() {
    const Cap = getCap();
    if (!Cap) return null;

    // Best: create proxy via registerPlugin
    if (!BulkSmsProxy && typeof Cap.registerPlugin === "function") {
      try {
        BulkSmsProxy = Cap.registerPlugin("BulkSms");
      } catch (e) {}
    }
    if (BulkSmsProxy) return BulkSmsProxy;

    // Fallback: try direct plugins bag
    const P = Cap.Plugins || {};
    return P.BulkSms || P["BulkSms"] || P.bulksms || null;
  }

  function uniq(arr) { return Array.from(new Set(arr)); }
  function normalize(num) {
    const d = String(num || "").replace(/\D/g, "");
    if (d.length >= 10) return d.slice(-10);
    return null;
  }
  function findNums(text) {
    const m = String(text || "").match(RE) || [];
    return uniq(m.map(normalize).filter(Boolean));
  }

  function getMessageFromApp() {
    const globals = ["customSms", "smsTemplate", "messageTemplate", "defaultSms", "smsText"];
    for (const g of globals) {
      if (globalThis[g] && String(globalThis[g]).trim()) return String(globalThis[g]).trim();
    }
    const keys = ["customSms", "smsTemplate", "message", "sms"];
    for (const k of keys) {
      const v = localStorage.getItem(k);
      if (v && v.trim()) return v.trim();
    }
    return null;
  }

  async function ensurePerm() {
    const p = plugin();
    const Cap = getCap();
    const keys = Cap && Cap.Plugins ? Object.keys(Cap.Plugins) : [];
    if (!p) throw new Error("Native SMS not available. Capacitor.Plugins=" + keys.join(","));
    await p.requestPermission();
  }

  async function sendOne(number, message) {
    const p = plugin();
    await ensurePerm();
    await p.sendOne({ number: String(number), message: String(message) });
  }

  async function sendBulk(numbers, message) {
    const p = plugin();
    await ensurePerm();
    return await p.sendBulk({ numbers, message: String(message) });
  }

  function hidePwaHints() {
    const killTexts = ["Install as PWA First", "SMS Tip:", "Real direct SMS works ONLY in installed app"];
    const all = Array.from(document.querySelectorAll("body *"));
    for (const el of all) {
      const t = (el.innerText || "").trim();
      if (!t) continue;
      if (killTexts.some(x => t.includes(x))) {
        (el.closest("section") || el.closest("div") || el).style.display = "none";
      }
    }
  }

  async function handleSendAll(btn) {
    try {
      hidePwaHints();
      const numbers = findNums(document.body.innerText);
      if (!numbers.length) return alert("No numbers found.");
      const msg = getMessageFromApp() || prompt("Type SMS message for ALL customers");
      if (!msg) return;

      if (!confirm("Send SMS to " + numbers.length + " customers?")) return;
      const res = await sendBulk(numbers, msg);
      alert("SMS sent to: " + (res && res.sent ? res.sent : numbers.length));
    } catch (e) {
      alert(e && e.message ? e.message : String(e));
    }
  }

  async function handleSingle(btn) {
    try {
      hidePwaHints();
      const row = btn.closest("div") || document.body;
      const nums = findNums(row.innerText);
      const number = nums.length ? nums[0] : null;
      if (!number) return alert("No phone number found for this customer.");

      const msg = getMessageFromApp() || prompt("Type SMS message");
      if (!msg) return;

      if (!confirm("Send SMS to " + number + " ?")) return;
      await sendOne(number, msg);
      alert("SMS sent to: " + number);
    } catch (e) {
      alert(e && e.message ? e.message : String(e));
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    hidePwaHints();
    setTimeout(hidePwaHints, 500);
  });

  document.addEventListener("click", function (e) {
    const el = e.target;
    const btn = el && el.closest ? el.closest("button") : null;
    if (!btn) return;

    const txt = (btn.textContent || "").trim();

    if (txt.includes("Send to All")) {
      e.preventDefault(); e.stopPropagation();
      handleSendAll(btn);
      return;
    }

    // single send button usually has no text; if a phone number exists in same row, treat as single send
    if (!txt) {
      const near = (btn.parentElement && btn.parentElement.innerText) || "";
      const nums = findNums(near);
      if (nums.length >= 1) {
        e.preventDefault(); e.stopPropagation();
        handleSingle(btn);
        return;
      }
    }
  }, true);

  console.log("native-sms.js loaded");
})();
