(function () {
  const RE = /(?:\+?91[\s-]?)?[6-9]\d{9}/g;
  let BulkSmsProxy = null;

  function getCap() { return globalThis.Capacitor || window.Capacitor || null; }

  function plugin() {
    const Cap = getCap();
    if (!Cap) return null;
    if (!BulkSmsProxy && typeof Cap.registerPlugin === "function") {
      try { BulkSmsProxy = Cap.registerPlugin("BulkSms"); } catch (e) {}
    }
    return BulkSmsProxy || (Cap.Plugins && (Cap.Plugins.BulkSms || Cap.Plugins["BulkSms"])) || null;
  }

  function uniq(a){return Array.from(new Set(a));}
  function normalize(n){ const d=String(n||"").replace(/\D/g,""); return d.length>=10?d.slice(-10):null; }
  function findNums(text){ const m=String(text||"").match(RE)||[]; return uniq(m.map(normalize).filter(Boolean)); }

  async function ensurePerm() {
    const p = plugin();
    if (!p) throw new Error("Native SMS plugin not loaded in this APK");
    await p.requestPermission();
  }

  // Hide/remove PWA modal & SMS sent modal (old UI)
  function killPwaModal() {
    const kill = ["Install as PWA First", "SMS Tip:", "Real direct SMS works ONLY in installed app", "SMS Sent Successfully"];
    document.querySelectorAll("body *").forEach(el => {
      const t = (el.innerText || "").trim();
      if (!t) return;
      if (kill.some(x => t.includes(x))) {
        const box = el.closest("section") || el.closest("div") || el;
        box.style.display = "none";
      }
    });
  }

  // Disable old onclick handlers on those buttons so old modal doesn't appear
  function disableOldHandlers() {
    document.querySelectorAll("button").forEach(btn => {
      const txt = (btn.textContent || "").trim();
      if (txt.includes("Send to All")) {
        btn.removeAttribute("onclick");
        btn.onclick = null;
      }
      if (!txt) {
        const near = (btn.parentElement && btn.parentElement.innerText) || "";
        if (findNums(near).length) {
          btn.removeAttribute("onclick");
          btn.onclick = null;
        }
      }
    });
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

  async function handleSendAll(btn) {
    try {
      killPwaModal();
      const numbers = findNums(document.body.innerText);
      if (!numbers.length) return alert("No numbers found.");
      const msg = prompt("Type SMS message for ALL customers");
      if (!msg) return;
      if (!confirm("Send SMS to " + numbers.length + " customers?")) return;
      const res = await sendBulk(numbers, msg);
      killPwaModal();
      alert("Native SMS triggered. Sent count: " + (res && res.sent ? res.sent : numbers.length));
    } catch (e) {
      alert(e && e.message ? e.message : String(e));
    }
  }

  async function handleSingle(btn) {
    try {
      killPwaModal();
      const row = btn.closest("div") || document.body;
      const nums = findNums(row.innerText);
      const number = nums[0];
      if (!number) return alert("No phone number found.");
      const msg = prompt("Type SMS message");
      if (!msg) return;
      if (!confirm("Send SMS to " + number + " ?")) return;
      await sendOne(number, msg);
      killPwaModal();
      alert("Native SMS triggered for: " + number);
    } catch (e) {
      alert(e && e.message ? e.message : String(e));
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    disableOldHandlers();
    killPwaModal();
    // keep killing if old UI appears later
    const obs = new MutationObserver(() => { disableOldHandlers(); killPwaModal(); });
    obs.observe(document.body, { childList: true, subtree: true });
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
