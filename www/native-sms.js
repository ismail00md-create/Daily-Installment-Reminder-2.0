(function () {
  const RE = /(?:\+?91[\s-]?)?[6-9]\d{9}/g;
  let BulkSmsProxy = null;

  function Cap() { return globalThis.Capacitor || window.Capacitor || null; }

  function plugin() {
    const c = Cap();
    if (!c) return null;
    if (!BulkSmsProxy && typeof c.registerPlugin === "function") {
      try { BulkSmsProxy = c.registerPlugin("BulkSms"); } catch (e) {}
    }
    return BulkSmsProxy || (c.Plugins && (c.Plugins.BulkSms || c.Plugins["BulkSms"])) || null;
  }

  function uniq(a){return Array.from(new Set(a));}
  function normalize(n){ const d=String(n||"").replace(/\D/g,""); return d.length>=10?d.slice(-10):null; }
  function findNums(text){ const m=String(text||"").match(RE)||[]; return uniq(m.map(normalize).filter(Boolean)); }

  async function ensurePerm() {
    const p = plugin();
    if (!p) throw new Error("Native SMS plugin not loaded in this APK");
    await p.requestPermission();
  }

  async function sendOne(number, message) {
    const p = plugin();
    await ensurePerm();
    return await p.sendOne({ number: String(number), message: String(message) });
  }

  function killOldPwaUi() {
    const kill = ["Install as PWA First", "SMS Tip:", "Real direct SMS works ONLY in installed app", "SMS Sent Successfully"];
    document.querySelectorAll("body *").forEach(el => {
      const t = (el.innerText || "").trim();
      if (t && kill.some(x => t.includes(x))) {
        (el.closest("section") || el.closest("div") || el).style.display = "none";
      }
    });
  }

  async function handleSingle(btn) {
    try {
      killOldPwaUi();
      const row = btn.closest("div") || document.body;
      const nums = findNums(row.innerText);
      const number = nums[0];
      if (!number) return alert("No phone number found.");

      const msg = prompt("Type SMS message");
      if (!msg) return;

      if (!confirm("Send SMS to " + number + " ?")) return;
      await sendOne(number, msg);
      alert("Result: SENT (or queued). Check receiver phone.");
    } catch (e) {
      alert(e && e.message ? e.message : String(e));
    }
  }

  async function handleSendAll(btn) {
    try {
      killOldPwaUi();
      const numbers = findNums(document.body.innerText);
      if (!numbers.length) return alert("No numbers found.");
      const msg = prompt("Type SMS message for ALL customers");
      if (!msg) return;
      if (!confirm("Send SMS to " + numbers.length + " customers?")) return;

      let ok = 0, fail = 0;
      for (let i = 0; i < numbers.length; i++) {
        try {
          await sendOne(numbers[i], msg);
          ok++;
        } catch (e) {
          fail++;
        }
      }
      alert("Done. OK=" + ok + " FAIL=" + fail + "\n(Receiver phone confirms delivery)");
    } catch (e) {
      alert(e && e.message ? e.message : String(e));
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    killOldPwaUi();
    setTimeout(killOldPwaUi, 500);
  });

  document.addEventListener("click", function (e) {
    const btn = e.target && e.target.closest ? e.target.closest("button") : null;
    if (!btn) return;

    const txt = (btn.textContent || "").trim();

    if (txt.includes("Send to All")) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      handleSendAll(btn);
      return;
    }

    if (!txt) {
      const near = (btn.parentElement && btn.parentElement.innerText) || "";
      if (findNums(near).length) {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        handleSingle(btn);
      }
    }
  }, true);
})();
