/**
 * ===================================================================
 * Quotex TE (Short: TE) — Licensed Client with Thunder X Switch System
 * ===================================================================
 * User-Facing Branding: Quotex TE (Short: TE)
 * Logo: https://i.postimg.cc/QM1CqkvN/Chat-GPT-Image-Aug-27-2026-08-36-34-PM-20260828-120448.jpg
 * 
 * Features:
 * - ThunderXSwitchAdapter: ON/OFF state bridge via window.THUNDER_X_SWITCH_STATE & "THUNDER_X_SWITCH" event
 * - Preserves all license validation, device IDs, usage tracking, and server endpoints
 * - Preserves complete WebSocket quote tracking, Round Control, and fake price logic
 * - Separation of switchEnabled vs fakeControllerRunning
 */
(function () {
  // Prevent duplicate initialization
  if (window.__QUOTEX_TE_INITIALIZED__) {
    console.warn("Quotex TE is already running.");
    return;
  }
  window.__QUOTEX_TE_INITIALIZED__ = true;

  // Safe Default Configuration & Branding
  const THUNDER_X_DEFAULT_ENABLED = true;
  const BRAND_NAME = "Quotex TE";
  const BRAND_SHORT = "TE";
  const LOGO_URL = "https://i.postimg.cc/QM1CqkvN/Chat-GPT-Image-Aug-27-2026-08-36-34-PM-20260828-120448.jpg";

  // ===================================================================
  // THUNDER X SWITCH ADAPTER
  // Connect the real switch source here when available.
  // ===================================================================
  const ThunderXSwitchAdapter = (function () {
    let _enabled = typeof window.THUNDER_X_SWITCH_STATE === "boolean"
      ? window.THUNDER_X_SWITCH_STATE
      : THUNDER_X_DEFAULT_ENABLED;

    const _listeners = new Set();

    function setEnabled(val, source) {
      const next = Boolean(val);
      if (_enabled === next) return;
      _enabled = next;
      window.THUNDER_X_SWITCH_STATE = _enabled;

      console.log(`[ThunderXSwitchAdapter] State changed to: ${_enabled ? "ON" : "OFF"} (source: ${source || "internal"})`);

      // Notify internal subscribers
      _listeners.forEach((fn) => {
        try { fn(_enabled); } catch (e) { console.error(e); }
      });

      // Dispatch custom event for external listeners if triggered internally
      if (source !== "event") {
        try {
          window.dispatchEvent(
            new CustomEvent("THUNDER_X_SWITCH", {
              detail: { enabled: _enabled }
            })
          );
        } catch (_) {}
      }
    }

    function isEnabled() {
      return _enabled;
    }

    function subscribe(fn) {
      _listeners.add(fn);
      return () => _listeners.delete(fn);
    }

    // External Event Listener for THUNDER_X_SWITCH
    window.addEventListener("THUNDER_X_SWITCH", function (e) {
      if (e && e.detail && typeof e.detail.enabled === "boolean") {
        setEnabled(e.detail.enabled, "event");
      }
    });

    return {
      setEnabled,
      isEnabled,
      subscribe,
    };
  })();

  window.ThunderXSwitchAdapter = ThunderXSwitchAdapter;

  // ===================================================================
  // PRESERVED THUNDER X LICENSE & AUTH SYSTEM
  // ===================================================================
  const TX_API_BASE = (function () {
    try { return new URL(document.currentScript.src).origin; } catch { return window.__THUNDERX_API__ || ""; }
  })();
  const LIC_KEY_STORAGE = "thunderx_license_key";
  const DEVICE_STORAGE = "thunderx_device_id";

  function store(k, v) { try { localStorage.setItem(k, v); } catch { try { sessionStorage.setItem(k, v); } catch {} } }
  function read(k) { try { return localStorage.getItem(k) || sessionStorage.getItem(k) || ""; } catch { return ""; } }
  function getDeviceId() {
    let id = read(DEVICE_STORAGE);
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2));
      store(DEVICE_STORAGE, id);
    }
    return id;
  }

  const LICENSE_MESSAGES = {
    INVALID: "This license key doesn't exist.",
    EXPIRED: "This license has expired.",
    REVOKED: "This license has been revoked.",
    DEVICE_LIMIT: "This license is already in use on the maximum number of devices.",
    NETWORK_ERROR: "Couldn't reach the license server. Check your connection and try again.",
  };

  const USE_LIMIT_MSG = "Your Quotex TE usage limit has been reached. Please contact the administrator.";
  const USE_DENY_MESSAGES = {
    USE_LIMIT_REACHED: USE_LIMIT_MSG,
    INVALID: "This license key doesn't exist.",
    EXPIRED: "This license has expired.",
    REVOKED: "This license has been disabled.",
    DEVICE_LIMIT: "This license is already in use on the maximum number of devices.",
  };

  // Asks the server for permission to start one session. The server counts uses; the client never decides.
  async function requestUse(sessionId) {
    try {
      const res = await fetch(TX_API_BASE + "/api/public/license/use", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ license_key: read(LIC_KEY_STORAGE), device_id: getDeviceId(), session_id: sessionId }),
      });
      const data = await res.json();
      return data && typeof data.allowed === "boolean" ? data : { allowed: false, reason: "NETWORK_ERROR" };
    } catch {
      return { allowed: false, reason: "NETWORK_ERROR" };
    }
  }

  function showToast(msg) {
    const t = document.createElement("div");
    t.className = "qxte-toast-msg";
    t.textContent = msg;
    t.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;max-width:calc(100vw - 32px);padding:12px 16px;border-radius:10px;background:#1a0b0b;color:#ffb3b3;border:1px solid rgba(255,107,107,0.5);font:600 13px system-ui,sans-serif;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,0.6);";
    document.body.appendChild(t);
    setTimeout(() => { if (t && t.parentNode) t.remove(); }, 5000);
  }

  async function validateLicense(key) {
    try {
      const res = await fetch(TX_API_BASE + "/api/public/license/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ license_key: key, device_id: getDeviceId() }),
      });
      const data = await res.json();
      return data && data.state ? data : { state: "NETWORK_ERROR" };
    } catch {
      return { state: "NETWORK_ERROR" };
    }
  }

  function showLicenseGate(onSuccess) {
    if (window.__THUNDERX_LICENSE_VALIDATED__) {
      onSuccess();
      return;
    }

    const existingOverlay = document.getElementById("qxte-login-overlay");
    if (existingOverlay) existingOverlay.remove();
    const existingStyle = document.getElementById("qxte-login-style");
    if (existingStyle) existingStyle.remove();

    const loginStyle = document.createElement("style");
    loginStyle.id = "qxte-login-style";
    loginStyle.textContent = `
      #qxte-login-overlay { position: fixed; inset: 0; z-index: 2147483647; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.72); font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
      #qxte-login-box { width: min(340px, calc(100vw - 32px)); padding: 22px 20px 18px; border-radius: 14px; background: linear-gradient(160deg, #0d1f14 0%, #0a0f0c 100%); border: 1px solid rgba(0,255,102,0.4); box-shadow: 0 0 50px rgba(0,255,102,0.2); }
      #qxte-login-box h3 { margin: 0 0 6px; text-align: center; color: #00ff66; font-size: 18px; letter-spacing: 0.08em; }
      #qxte-login-box p { margin: 0 0 14px; text-align: center; font-size: 12px; color: #9fd4ad; }
      #qxte-login-box .qxte-disclose { font-size: 11px; color: #c9b27a; line-height: 1.4; text-align: left; background: rgba(255,200,80,0.06); border: 1px solid rgba(255,200,80,0.25); border-radius: 8px; padding: 8px 10px; }
      #qxte-login-input { box-sizing: border-box; width: 100%; padding: 11px 12px; border-radius: 8px; border: 1px solid rgba(0,255,102,0.35); background: rgba(0,0,0,0.4); color: #fff; font-size: 15px; outline: none; letter-spacing: 0.05em; }
      #qxte-login-input:focus { border-color: #00ff66; box-shadow: 0 0 0 2px rgba(0,255,102,0.2); }
      #qxte-login-btn { width: 100%; margin-top: 12px; padding: 12px; border: none; border-radius: 8px; background: #00ff66; color: #052210; font-weight: 700; font-size: 14px; cursor: pointer; }
      #qxte-login-btn[disabled] { opacity: 0.6; cursor: wait; }
      #qxte-login-err { min-height: 18px; margin-top: 8px; text-align: center; font-size: 12px; color: #ff6b6b; font-weight: 600; }
    `;
    document.head.appendChild(loginStyle);

    const overlay = document.createElement("div");
    overlay.id = "qxte-login-overlay";
    overlay.innerHTML = `
      <div id="qxte-login-box">
        <h3>${BRAND_NAME}</h3>
        <p>Enter your license key to continue</p>
        <p class="qxte-disclose">${BRAND_NAME} is an auto-trading assistant. It does not analyze the market or predict results. You can lose money.</p>
        <input id="qxte-login-input" type="text" autocomplete="off" spellcheck="false" placeholder="TX-XXXX-XXXX-XXXX" />
        <button type="button" id="qxte-login-btn">Activate</button>
        <p id="qxte-login-err"></p>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector("#qxte-login-input");
    const errEl = overlay.querySelector("#qxte-login-err");
    const btn = overlay.querySelector("#qxte-login-btn");
    input.value = read(LIC_KEY_STORAGE);

    let busy = false;
    async function tryActivate() {
      if (busy) return;
      const key = input.value.trim().toUpperCase();
      if (!key) { errEl.textContent = LICENSE_MESSAGES.INVALID; return; }
      busy = true; btn.disabled = true; btn.textContent = "Checking…"; errEl.textContent = "";
      const result = await validateLicense(key);
      busy = false; btn.disabled = false; btn.textContent = "Activate";
      if (result.state === "VALID") {
        store(LIC_KEY_STORAGE, key);
        window.__THUNDERX_LICENSE_VALIDATED__ = true;
        overlay.remove();
        loginStyle.remove();
        console.log(`${BRAND_NAME}: license valid` + (result.expires_at ? " until " + result.expires_at : ""));
        onSuccess();
        return;
      }
      errEl.textContent = LICENSE_MESSAGES[result.state] || LICENSE_MESSAGES.NETWORK_ERROR;
      input.focus();
    }

    btn.addEventListener("click", tryActivate);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); tryActivate(); } });
    setTimeout(() => input.focus(), 50);
    if (input.value) tryActivate();
  }

  // ===================================================================
  // QUOTEX TE CORE (ROUND CONTROL + WEBSOCKET TRACKING + SWITCH LOGIC)
  // ===================================================================
  function startQuotexTE() {
    /* round engine */
    const TAG = "QX_CANDLE_ROUND";
    const STORE_KEY = "qxte_round_ui";
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const state = {
      asset: null,
      assetSource: null,
      period: 60,
      periodSource: null,
      serverOffset: 0,
      lastTick: null,
      candle: null,
      history: [],
      ticks: 0,
      events: {},
      sockets: [],
    };
    let lastDataAt = 0;

    // --- Fake candle controller ---
    const fake = {
      active: false,
      target: null,
      seconds: 5,
      startPrice: null,
      startAt: 0,
      holdOffset: null,
    };

    const startFake = (target, seconds) => {
      // Respect Thunder X Switch: Do not start fake controller if switch is OFF
      if (!ThunderXSwitchAdapter.isEnabled()) {
        showToast("Thunder X Switch is OFF. Enable the switch first.");
        return;
      }
      fake.active = true;
      fake.target = Number(target);
      fake.seconds = Math.max(0.2, Number(seconds) || 5);
      fake.startPrice = state.lastTick ? state.lastTick.price : null;
      fake.startAt = Date.now() / 1000;
      fake.holdOffset = null;
    };

    const stopFake = () => {
      fake.active = false;
      fake.startPrice = null;
      fake.holdOffset = null;
    };

    const fakePrice = (realPrice) => {
      // If Thunder X Switch is OFF, bypass fake pricing completely
      if (!ThunderXSwitchAdapter.isEnabled()) return realPrice;
      if (!fake.active || !isFinite(fake.target)) return realPrice;
      if (fake.startPrice == null) {
        fake.startPrice = realPrice;
        fake.startAt = Date.now() / 1000;
      }
      const dur = Math.max(0.2, fake.seconds);
      const elapsed = Date.now() / 1000 - fake.startAt;
      if (elapsed < dur) {
        const p = elapsed / dur; // linear interpolation
        return fake.startPrice + (fake.target - fake.startPrice) * p;
      }
      if (fake.holdOffset == null) fake.holdOffset = fake.target - realPrice;
      return realPrice + fake.holdOffset;
    };

    const fakeifyTicks = (rows) => {
      if (!ThunderXSwitchAdapter.isEnabled()) return false;
      let changed = false;
      for (const row of rows) {
        if (
          Array.isArray(row) &&
          typeof row[0] === "string" &&
          typeof row[1] === "number" &&
          typeof row[2] === "number" &&
          (!state.asset || row[0] === state.asset)
        ) {
          row[2] = fakePrice(row[2]);
          changed = true;
        }
      }
      return changed;
    };

    const fakeifyPayload = (arr) => {
      if (!ThunderXSwitchAdapter.isEnabled()) return false;
      if (Array.isArray(arr) && arr[0] === "quotes/stream" && Array.isArray(arr[1])) {
        return fakeifyTicks(arr[1]);
      }
      if (Array.isArray(arr) && arr.length && Array.isArray(arr[0])) {
        return fakeifyTicks(arr);
      }
      return false;
    };

    const rewriteText = (text) => {
      if (!ThunderXSwitchAdapter.isEnabled()) return null;
      const idx = text.indexOf("[");
      if (idx < 0) return null;
      const prefix = text.slice(0, idx);
      let arr;
      try {
        arr = JSON.parse(text.slice(idx));
      } catch (_) {
        return null;
      }
      return fakeifyPayload(arr) ? prefix + JSON.stringify(arr) : null;
    };

    const rewriteBinary = (bytes) => {
      if (!ThunderXSwitchAdapter.isEnabled()) return null;
      const off = bytes.length && bytes[0] < 10 ? 1 : 0;
      let text;
      try {
        text = decoder.decode(bytes.subarray(off));
      } catch (_) {
        return null;
      }
      const idx = text.indexOf("[");
      if (idx < 0) return null;
      const jsonPrefix = text.slice(0, idx);
      let arr;
      try {
        arr = JSON.parse(text.slice(idx));
      } catch (_) {
        return null;
      }
      if (!fakeifyPayload(arr)) return null;
      const body = encoder.encode(jsonPrefix + JSON.stringify(arr));
      const out = new Uint8Array(off + body.length);
      if (off) out[0] = bytes[0];
      out.set(body, off);
      return out;
    };

    // --- Data tracking ---
    const countEvent = (name) => {
      state.events[name] = (state.events[name] || 0) + 1;
    };

    const setAsset = (asset, source) => {
      if (!asset || typeof asset !== "string") return;
      if (state.asset !== asset) {
        state.asset = asset;
        state.candle = null;
        state.history = [];
      }
      state.assetSource = source;
    };

    const setPeriod = (period, source) => {
      const p = Number(period);
      if (!p || p < 1 || p > 86400) return;
      if (state.periodSource === "user" && source !== "user") return;
      if (state.period !== p) {
        state.period = p;
        state.candle = null;
        state.history = [];
      }
      state.periodSource = source;
    };

    const onTick = (asset, time, price) => {
      if (typeof asset !== "string" || !isFinite(time) || !isFinite(price)) return;
      if (!state.asset) setAsset(asset, "first-tick");
      if (asset !== state.asset) return;

      state.ticks++;
      state.serverOffset = time - Date.now() / 1000;
      state.lastTick = { time, price };
      lastDataAt = Date.now();

      const start = Math.floor(time / state.period) * state.period;
      const c = state.candle;
      if (!c || c.start !== start) {
        if (c && start > c.start) {
          state.history.push({ start: c.start, open: c.open, close: c.close, high: c.high, low: c.low });
          if (state.history.length > 50) state.history.shift();
        }
        state.candle = { start, open: price, high: price, low: price, close: price, fromHistory: false };
      } else {
        c.close = price;
        if (price > c.high) c.high = price;
        if (price < c.low) c.low = price;
      }
    };

    const onHistory = (obj) => {
      if (!obj || typeof obj !== "object") return;
      if (obj.asset && !state.asset) setAsset(obj.asset, "history");
      if (obj.asset && obj.asset !== state.asset) return;
      if (obj.period) {
        setPeriod(obj.period, "history");
        if (Number(obj.period) !== state.period) return;
      }
      const candles = Array.isArray(obj.candles) ? obj.candles : null;
      if (!candles || !candles.length) return;

      const parsed = candles
        .filter((k) => Array.isArray(k) && k.length >= 5)
        .map((k) => ({ start: Number(k[0]), open: Number(k[1]), close: Number(k[2]), high: Number(k[3]), low: Number(k[4]) }))
        .filter((k) => isFinite(k.start) && isFinite(k.open))
        .sort((a, b) => a.start - b.start);
      if (!parsed.length) return;

      const last = parsed[parsed.length - 1];
      const nowServer = Date.now() / 1000 + state.serverOffset;
      const currentStart = Math.floor(nowServer / state.period) * state.period;

      const closed = parsed.filter((k) => k.start < currentStart);
      state.history = closed.slice(-50);
      if (last.start === currentStart) {
        state.candle = { ...last, fromHistory: true };
      }
      lastDataAt = Date.now();
    };

    const handlePayload = (data) => {
      if (Array.isArray(data)) {
        let handled = false;
        for (const row of data) {
          if (Array.isArray(row) && row.length >= 3 && typeof row[0] === "string" && typeof row[1] === "number" && typeof row[2] === "number") {
            onTick(row[0], row[1], row[2]);
            handled = true;
          }
        }
        if (handled) countEvent("quotes/stream");
        return;
      }
      if (data && typeof data === "object") {
        if (Array.isArray(data.candles)) {
          countEvent("history(candles)");
          onHistory(data);
        }
      }
    };

    const parseSocketIoText = (text) => {
      const m = /^\d+(?:-)?(?:\/[^,]*,)?(\d*)(\[.*)$/s.exec(text);
      if (!m) return null;
      try {
        const arr = JSON.parse(m[2]);
        if (Array.isArray(arr) && typeof arr[0] === "string") return { event: arr[0], data: arr[1] };
      } catch (_) {}
      return null;
    };

    const handleIncomingText = (text) => {
      if (text.length > 2 && (text[0] === "[" || text[0] === "{")) {
        try {
          handlePayload(JSON.parse(text));
        } catch (_) {}
        return;
      }
      const msg = parseSocketIoText(text);
      if (!msg) return;
      countEvent(msg.event);
      const d = msg.data;
      if (d && d._placeholder) return;
      if (msg.event === "quotes/stream") handlePayload(d);
      else if (/history/i.test(msg.event) || (d && Array.isArray(d.candles))) onHistory(d);
      else if (msg.event === "instruments/update" && d && d.asset) {
        setAsset(d.asset, "server");
        if (d.period) setPeriod(d.period, "server");
      }
    };

    const handleIncomingBinary = (buf) => {
      let bytes = new Uint8Array(buf);
      if (bytes.length && bytes[0] < 10) bytes = bytes.subarray(1);
      const text = decoder.decode(bytes);
      try {
        handlePayload(JSON.parse(text));
      } catch (_) {
        handleIncomingText(text);
      }
    };

    const handleOutgoing = (data) => {
      if (typeof data !== "string") return;
      const msg = parseSocketIoText(data);
      if (!msg) return;
      const d = msg.data;
      countEvent("→ " + msg.event);
      switch (msg.event) {
        case "instruments/update":
        case "chart_notification/get":
        case "history/load/line":
        case "instruments/follow":
          if (d && typeof d === "object") {
            if (d.asset) setAsset(d.asset, "client:" + msg.event);
            if (d.period) setPeriod(d.period, "client:" + msg.event);
          }
          break;
        case "depth/follow":
          if (typeof d === "string") setAsset(d, "client:depth/follow");
          break;
      }
    };

    const trackState = (raw) => {
      try {
        if (typeof raw === "string") handleIncomingText(raw);
        else if (raw instanceof ArrayBuffer) handleIncomingBinary(raw);
        else if (raw instanceof Blob) raw.arrayBuffer().then(handleIncomingBinary).catch(() => {});
      } catch (_) {}
    };

    // --- Hook MessageEvent.data & WebSocket ---
    const PROC = Symbol("qxProcessed");
    const FAKED = Symbol("qxFaked");
    const nativeDataDesc = Object.getOwnPropertyDescriptor(MessageEvent.prototype, "data");
    const nativeGetData = nativeDataDesc ? nativeDataDesc.get : null;

    if (nativeDataDesc) {
      Object.defineProperty(MessageEvent.prototype, "data", {
        configurable: true,
        enumerable: nativeDataDesc.enumerable,
        get() {
          const raw = nativeGetData ? nativeGetData.call(this) : this.data;
          const tgt = this.currentTarget || this.target;
          if (!(tgt instanceof WebSocket)) return raw;

          if (!this[PROC]) {
            this[PROC] = true;
            try {
              if (typeof raw === "string") state.sockets.indexOf(tgt.url) < 0 && noteSocket(tgt.url);
              else noteSocket(tgt.url);
            } catch (_) {}
            trackState(raw);
          }

          // If switch is disabled or fake controller not active, return raw unmodified data
          if (!ThunderXSwitchAdapter.isEnabled() || !fake.active) return raw;
          if (this[FAKED] !== undefined) return this[FAKED];

          let out = raw;
          try {
            if (typeof raw === "string") {
              const n = rewriteText(raw);
              if (n != null) out = n;
            } else if (raw instanceof ArrayBuffer) {
              const n = rewriteBinary(new Uint8Array(raw));
              if (n) out = n.buffer;
            }
          } catch (_) {}
          this[FAKED] = out;
          return out;
        },
      });
    }

    const noteSocket = (url) => {
      try {
        const u = String(url).split("?")[0];
        if (state.sockets.indexOf(u) < 0) {
          state.sockets.push(u);
          if (state.sockets.length > 5) state.sockets.shift();
        }
      } catch (_) {}
    };

    const nativeSend = WebSocket.prototype.send;
    WebSocket.prototype.send = function (data) {
      try {
        handleOutgoing(data);
      } catch (_) {}
      return nativeSend.apply(this, arguments);
    };

    const NativeWS = window.WebSocket;
    const HookedWS = new Proxy(NativeWS, {
      construct(target, args) {
        const ws = new target(...args);
        try {
          noteSocket(args[0]);
        } catch (_) {}
        return ws;
      },
    });
    window.WebSocket = HookedWS;

    var APP = BRAND_NAME;
    var UI_ROUND_KEY = "qxte_round_ui";
    var uiRound = { fakeTarget: "", fakeSeconds: 5 };
    var fakeRunning = false;

    var host = document.createElement("div");
    host.id = "qxte-bookmark";
    var root = host.attachShadow({ mode: "open" });
    root.innerHTML =
      "<style>" +
      ":host{all:initial}" +
      "*{box-sizing:border-box}" +
      ".fab{position:fixed;z-index:2147483647;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:grab;touch-action:none;user-select:none;-webkit-tap-highlight-color:transparent;pointer-events:auto}" +
      ".fab.away .frame,.fab.away .plate{opacity:0;visibility:hidden;pointer-events:none}" +
      ".fab.away{pointer-events:auto}" +
      ".fab.pop .frame{animation:pop .5s cubic-bezier(.2,1.6,.4,1) both}" +
      ".fab.pop .plate{animation:rowIn .45s .12s cubic-bezier(.2,.8,.2,1) both}" +
      ".fab.dragging{cursor:grabbing}" +
      "img{pointer-events:none;-webkit-user-drag:none;user-select:none}" +
      ".frame{position:relative;width:64px;height:64px}" +
      ".tile{position:absolute;inset:0;border-radius:16px;overflow:hidden;background:#050c22;border:1.5px solid rgba(56,189,248,.95);box-shadow:0 10px 26px rgba(0,0,0,.55),0 0 18px rgba(30,144,255,.55);animation:pulse 2.4s ease-in-out infinite}" +
      ".tile img{width:100%;height:100%;object-fit:cover;transform:scale(1.05);display:block}" +
      ".scan{position:absolute;left:0;right:0;top:-40%;height:40%;background:linear-gradient(transparent,rgba(125,211,252,.38),transparent);animation:scan 2.8s linear infinite;pointer-events:none}" +
      ".k{position:absolute;width:12px;height:12px;border:2px solid #38bdf8;filter:drop-shadow(0 0 4px rgba(56,189,248,.9));pointer-events:none}" +
      ".k1{left:-6px;top:-6px;border-right:0;border-bottom:0;border-top-left-radius:5px}" +
      ".k2{right:-6px;top:-6px;border-left:0;border-bottom:0;border-top-right-radius:5px}" +
      ".k3{left:-6px;bottom:-6px;border-right:0;border-top:0;border-bottom-left-radius:5px}" +
      ".k4{right:-6px;bottom:-6px;border-left:0;border-top:0;border-bottom-right-radius:5px}" +
      ".plate{padding:4px 8px;border-radius:7px;background:linear-gradient(180deg,rgba(15,26,60,.92),rgba(5,10,26,.92));border:1px solid rgba(56,189,248,.35);box-shadow:0 0 10px rgba(30,144,255,.25)}" +
      ".name{position:relative;display:block;text-transform:uppercase;font:800 11px/1 Segoe UI,system-ui,sans-serif;letter-spacing:.12em;color:#e6f4ff;text-shadow:0 0 8px rgba(56,189,248,.85)}" +
      ".fab.live .tile{border-color:#34d399}" +
      ".fab.running .tile{animation-duration:.9s;border-color:#34d399}" +
      ".fab.switch-off .tile{border-color:#ef4444;box-shadow:0 0 14px rgba(239,68,68,0.4)}" +
      ".fab.switch-off .scan{display:none}" +
      ".tile .dot{position:absolute;right:5px;top:5px;width:8px;height:8px;border-radius:50%;background:#34d399;box-shadow:0 0 8px #34d399;display:none;pointer-events:none}" +
      ".fab.running .tile .dot{display:block;animation:blink 1s steps(2) infinite}" +
      ".panel{position:fixed;z-index:2147483646;width:min(340px,calc(100vw - 24px));padding:16px 14px 14px;border-radius:18px;color:#e6eefc;font:13px/1.45 Segoe UI,system-ui,sans-serif;transform-origin:0 0;pointer-events:auto;" +
      "background:radial-gradient(120% 70% at 50% -12%,rgba(37,99,235,.38),transparent 62%),linear-gradient(165deg,rgba(12,21,50,.97),rgba(4,8,22,.98));" +
      "border:1px solid rgba(96,165,250,.38);box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 22px 50px rgba(0,0,0,.6),0 0 30px rgba(30,144,255,.32);overflow:hidden;user-select:none;-webkit-user-select:none}" +
      ".panel[hidden]{display:none}" +
      ".sweep{position:absolute;left:0;right:0;top:0;height:2px;opacity:0;pointer-events:none;background:linear-gradient(90deg,transparent,#7dd3fc,#fff,#7dd3fc,transparent);box-shadow:0 0 14px 3px rgba(56,189,248,.8)}" +
      ".panel.morphing .sweep{animation:sweep .62s linear both}" +
      ".panel.morphing .row{opacity:0}" +
      ".panel.boot .row{animation:rowIn .42s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--d)*60ms)}" +
      ".row{position:relative}" +
      ".grid{position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(96,165,250,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(96,165,250,.07) 1px,transparent 1px);background-size:16px 16px;-webkit-mask-image:linear-gradient(#000,transparent 85%);mask-image:linear-gradient(#000,transparent 85%)}" +
      ".pk{position:absolute;width:14px;height:14px;border:2px solid rgba(56,189,248,.85);pointer-events:none}" +
      ".pk1{left:8px;top:8px;border-right:0;border-bottom:0}" +
      ".pk2{right:8px;top:8px;border-left:0;border-bottom:0}" +
      ".pk3{left:8px;bottom:8px;border-right:0;border-top:0}" +
      ".pk4{right:8px;bottom:8px;border-left:0;border-top:0}" +
      ".head{position:relative;display:flex;align-items:center;gap:10px;margin-bottom:10px;cursor:grab;touch-action:none}" +
      ".head.dragging{cursor:grabbing}" +
      ".mini{width:42px;height:42px;border-radius:12px;overflow:hidden;border:1.5px solid rgba(56,189,248,.9);flex:none;cursor:pointer}" +
      ".mini img{width:100%;height:100%;object-fit:cover;transform:scale(1.05)}" +
      ".ttl{font:800 16px/1 Segoe UI,system-ui,sans-serif;letter-spacing:.12em;color:#e6f4ff;text-shadow:0 0 8px rgba(56,189,248,.85)}" +
      ".sub{margin-top:5px;font-size:10px;font-weight:700;letter-spacing:.18em;color:rgba(125,211,252,.7)}" +
      ".chip{margin-left:auto;padding:4px 8px;border-radius:999px;font-size:9px;font-weight:800;letter-spacing:.14em;color:#94a3b8;border:1px solid rgba(148,163,184,.35)}" +
      ".chip.live{color:#052e1c;border-color:transparent;background:linear-gradient(135deg,#34d399,#22d3ee)}" +
      ".chip.off{color:#ffe4e6;border-color:rgba(244,63,94,.5);background:rgba(244,63,94,.2)}" +
      "p{position:relative;margin:0}" +
      "label{position:relative;display:block;margin:10px 0 6px;color:#8ea0bf;font-size:11px;font-weight:700;letter-spacing:.08em}" +
      "input{position:relative;width:100%;color:#e6eefc;font:16px Segoe UI,system-ui,sans-serif;letter-spacing:.14em;text-align:center;padding:11px 12px;border-radius:10px;background:rgba(2,6,23,.65);border:1px solid rgba(96,165,250,.24);outline:none}" +
      "input:focus{border-color:#38bdf8;box-shadow:0 0 0 3px rgba(56,189,248,.18)}" +
      ".card{display:flex;flex-direction:column;gap:6px;padding:9px 11px;border-radius:12px;margin-top:4px;background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.015));border:1px solid rgba(148,163,184,.16)}" +
      ".cap{font-size:8.5px;font-weight:700;letter-spacing:.2em;color:#64748b}" +
      ".line{display:flex;align-items:center;justify-content:space-between;gap:8px}" +
      ".market{flex:1;min-width:0;font-weight:800;font-size:14px;color:#7dd3fc;text-shadow:0 0 10px rgba(56,189,248,.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left}" +
      ".run-chip{display:inline-flex;align-items:center;gap:5px;padding:3px 7px;border-radius:999px;font-size:8px;font-weight:800;letter-spacing:.12em;color:#94a3b8;border:1px solid rgba(148,163,184,.35)}" +
      ".run-chip.live{color:#052e1c;border-color:transparent;background:linear-gradient(135deg,#34d399,#22d3ee)}" +
      ".run-dot{width:6px;height:6px;border-radius:50%;background:currentColor}" +
      "input.round-in{text-align:left;font-size:13px;letter-spacing:normal;font-variant-numeric:tabular-nums;padding:8px 10px}" +
      ".btn-row{display:flex;gap:8px;margin-top:14px}" +
      ".btn-row button{flex:1;margin-top:0;font:800 12.5px Segoe UI,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;padding:11px 0;border-radius:12px}" +
      ".btn-row .start{color:#fff;border:1px solid rgba(255,255,255,.18);background:linear-gradient(135deg,#2563eb,#06b6d4);box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 8px 20px rgba(37,99,235,.45)}" +
      ".btn-row .stop{color:#fca5a5;background:rgba(239,68,68,.1);border:1px solid rgba(248,113,113,.45)}" +
      ".btn-row button:disabled{opacity:.32;cursor:not-allowed}" +
      /* Thunder X Switch Control UI */
      ".switch-box{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;margin-top:12px;border-radius:12px;background:rgba(0,0,0,0.4);border:1px solid rgba(56,189,248,0.3)}" +
      ".switch-label-wrap{display:flex;flex-direction:column;gap:2px}" +
      ".switch-title{font-size:11px;font-weight:800;letter-spacing:.08em;color:#7dd3fc;text-transform:uppercase}" +
      ".switch-desc{font-size:9px;color:#94a3b8}" +
      ".switch-btn-toggle{display:flex;align-items:center;background:rgba(15,23,42,0.8);border:1px solid rgba(56,189,248,0.4);border-radius:20px;padding:2px;cursor:pointer}" +
      ".switch-pill{padding:4px 10px;font-size:10px;font-weight:800;border-radius:16px;letter-spacing:.05em;transition:all .2s ease}" +
      ".switch-pill.active-on{background:#00ff66;color:#052210;box-shadow:0 0 10px rgba(0,255,102,0.6)}" +
      ".switch-pill.active-off{background:#ef4444;color:#fff;box-shadow:0 0 10px rgba(239,68,68,0.6)}" +
      ".switch-pill.inactive{color:#64748b;background:transparent}" +
      "@keyframes blink{50%{opacity:.25}}" +
      "@keyframes pulse{50%{box-shadow:0 0 24px 4px rgba(56,189,248,.85)}}" +
      "@keyframes scan{to{top:110%}}" +
      "@keyframes sweep{0%{top:0;opacity:1}90%{opacity:1}100%{top:100%;opacity:0}}" +
      "@keyframes pop{0%{transform:scale(.2) rotate(-8deg);opacity:0;filter:brightness(2.2)}60%{transform:scale(1.12) rotate(2deg);opacity:1}100%{transform:none;filter:none}}" +
      "@keyframes rowIn{0%{opacity:0;transform:translateY(7px);filter:blur(3px)}45%{opacity:1;transform:translateX(-3px);filter:none}65%{transform:translateX(2px)}100%{opacity:1;transform:none}}" +
      "@media (max-width:480px){" +
      ".panel{width:min(248px,calc(100vw - 20px));padding:10px 10px 10px;border-radius:14px;font-size:11px;line-height:1.35}" +
      ".head{gap:8px;margin-bottom:6px}" +
      ".mini{width:34px;height:34px;border-radius:10px}" +
      ".ttl{font-size:13px}" +
      ".sub{margin-top:3px;font-size:8px;letter-spacing:.14em}" +
      ".chip{padding:3px 6px;font-size:8px}" +
      "label{margin:6px 0 4px;font-size:10px}" +
      "input.round-in{padding:7px 8px;font-size:12px}" +
      ".card{padding:7px 9px;gap:4px;margin-top:0}" +
      ".market{font-size:12px}" +
      ".cap{font-size:7.5px}" +
      ".btn-row{margin-top:10px;gap:6px}" +
      ".btn-row button{padding:8px 0;font-size:11px}" +
      ".switch-box{padding:8px 10px;margin-top:8px}" +
      ".switch-pill{padding:3px 8px;font-size:9px}" +
      "}" +
      "</style>" +
      '<div class="fab" title="' + APP + '">' +
      '<div class="frame"><div class="tile"><img alt="" draggable="false"><i class="scan"></i><i class="dot"></i></div><i class="k k1"></i><i class="k k2"></i><i class="k k3"></i><i class="k k4"></i></div>' +
      '<div class="plate"><span class="name">' + BRAND_SHORT + "</span></div></div>" +
      '<div class="panel" hidden>' +
      '<div class="grid"></div><i class="sweep"></i><i class="pk pk1"></i><i class="pk pk2"></i><i class="pk pk3"></i><i class="pk pk4"></i>' +
      '<div class="head row" style="--d:0"><div class="mini" title="Minimize"><img alt="" draggable="false"></div><div><div class="ttl">' + APP + '</div><div class="sub">ROUND CONTROL</div></div><span class="chip">IDLE</span></div>' +
      '<div class="body"></div></div>';

    var $ = function (sel) { return root.querySelector(sel); };
    var fab = $(".fab");
    var tile = $(".tile");
    var panel = $(".panel");
    var body = $(".body");
    var chip = $(".chip");
    var head = $(".head");
    var mini = $(".mini");
    var panelBusy = false;
    var panelBusySince = 0;
    var ROBO = "cubic-bezier(.8, 0, .2, 1)";
    var imgs = root.querySelectorAll("img");
    
    // Apply provided logo URL with resilient error fallback
    for (var i = 0; i < imgs.length; i++) {
      imgs[i].src = LOGO_URL;
      imgs[i].onerror = function () {
        this.src = "https://i.postimg.cc/yxNphdfJ/file-000000008d1481fbb8752033356f882f.png";
      };
    }

    function setLive(on) {
      if (!ThunderXSwitchAdapter.isEnabled()) {
        fab.classList.remove("live");
        chip.classList.remove("live");
        chip.classList.add("off");
        chip.textContent = "OFF";
        return;
      }
      chip.classList.remove("off");
      fab.classList.toggle("live", on);
      chip.classList.toggle("live", on);
      chip.textContent = on ? "LIVE" : "IDLE";
    }

    function clear(node) {
      while (node.firstChild) node.removeChild(node.firstChild);
    }

    function el(tag, cls, text) {
      var node = document.createElement(tag);
      if (cls) node.className = cls;
      if (text != null) node.textContent = text;
      return node;
    }

    function markPanelRows() {
      var kids = body.children;
      for (var i = 0; i < kids.length; i++) {
        kids[i].classList.add("row");
        kids[i].style.setProperty("--d", String(i + 1));
      }
    }

    function liftWidget() {
      var parent = document.body || document.documentElement;
      if (!parent) return;
      if (host.hasAttribute("inert")) host.removeAttribute("inert");
      try { host.inert = false; } catch (e) {}
      host.style.zIndex = "2147483647";
      if (!host.isConnected) parent.appendChild(host);
      else if (parent.lastElementChild !== host) parent.appendChild(host);
    }

    function ensureMounted() { liftWidget(); }

    function clearDragState() {
      drag = null;
      panelDrag = null;
      fab.classList.remove("dragging");
      head.classList.remove("dragging");
    }

    function recoverPanelShell() {
      panelBusy = false;
      panelBusySince = 0;
      clearDragState();
      panel.getAnimations().forEach(function (anim) { try { anim.cancel(); } catch (e) {} });
      resetPanelMotion();
      panel.classList.remove("morphing");
      if (panel.hidden) fab.classList.remove("away");
      else { fab.classList.add("away"); panel.classList.add("boot"); }
    }

    function morphFrames() {
      var t = tile.getBoundingClientRect();
      var p = panel.getBoundingClientRect();
      if (!t.width || !t.height || !p.width || !p.height) return null;
      var sx = t.width / p.width;
      var sy = t.height / p.height;
      var dx = t.left - p.left;
      var dy = t.top - p.top;
      return [
        { offset: 0, transform: "translate(" + dx + "px," + dy + "px) scale(" + sx + "," + sy + ")", borderRadius: "16px", filter: "brightness(2.2) saturate(1.5)", easing: ROBO },
        { offset: 0.45, transform: "translate(0px," + dy + "px) scale(1," + sy + ")", borderRadius: "14px", filter: "brightness(1.5)", easing: "linear" },
        { offset: 0.55, transform: "translate(0px," + dy + "px) scale(1," + sy + ")", borderRadius: "14px", filter: "brightness(1.5)", easing: ROBO },
        { offset: 0.85, transform: "translate(0px,0px) scale(1,1.03)", borderRadius: "18px", filter: "brightness(1.1)", easing: "ease-out" },
        { offset: 1, transform: "translate(0px,0px) scale(1,1)", borderRadius: "18px", filter: "brightness(1)" },
      ];
    }

    function resetPanelMotion() {
      panel.style.transform = "";
      panel.style.borderRadius = "";
      panel.style.filter = "";
    }

    function fmtAsset(a) {
      var otc = /_otc$/i.test(a);
      var name = a.replace(/_otc$/i, "");
      if (/^[A-Z]{6}$/.test(name)) name = name.slice(0, 3) + "/" + name.slice(3);
      return otc ? name + " (OTC)" : name;
    }

    function loadRoundUi() {
      try {
        var raw = localStorage.getItem(UI_ROUND_KEY);
        if (raw) uiRound = Object.assign(uiRound, JSON.parse(raw));
      } catch (e) {}
    }

    function saveRoundUi() {
      try { localStorage.setItem(UI_ROUND_KEY, JSON.stringify(uiRound)); } catch (e) {}
    }

    function updateRoundBtns(toolEls) {
      if (!toolEls) return;
      const isSwOn = ThunderXSwitchAdapter.isEnabled();
      toolEls.start.disabled = !isSwOn || fakeRunning;
      toolEls.stop.disabled = !isSwOn || !fakeRunning;
      
      fab.classList.toggle("running", fakeRunning && isSwOn);
      fab.classList.toggle("switch-off", !isSwOn);

      if (toolEls.runChip) toolEls.runChip.classList.toggle("live", fakeRunning && isSwOn);
      if (toolEls.runChipText) {
        if (!isSwOn) toolEls.runChipText.textContent = "DISABLED";
        else toolEls.runChipText.textContent = fakeRunning ? "LIVE" : "IDLE";
      }

      // Update Switch UI elements
      if (toolEls.swPillOn && toolEls.swPillOff) {
        toolEls.swPillOn.className = isSwOn ? "switch-pill active-on" : "switch-pill inactive";
        toolEls.swPillOff.className = !isSwOn ? "switch-pill active-off" : "switch-pill inactive";
      }
    }

    function renderActive() {
      clear(body);
      setLive(ThunderXSwitchAdapter.isEnabled());
      var sub = $(".sub");
      if (sub) sub.textContent = "ROUND CONTROL · CORE";

      var card = el("div", "card");
      var line1 = el("div", "line");
      line1.appendChild(el("span", "cap", "MARKET"));
      var runChip = el("span", "run-chip");
      runChip.appendChild(el("i", "run-dot"));
      var runChipText = el("b", "run-chip-t", fakeRunning ? "LIVE" : "IDLE");
      runChip.appendChild(runChipText);
      line1.appendChild(runChip);
      card.appendChild(line1);
      var line2 = el("div", "line");
      var market = el("div", "market", state.asset ? fmtAsset(state.asset) : "Waiting for data…");
      line2.appendChild(market);
      card.appendChild(line2);
      body.appendChild(card);

      body.appendChild(el("label", "", "Round নম্বর"));
      var fTarget = el("input", "round-in f-target");
      fTarget.type = "number";
      fTarget.step = "any";
      fTarget.placeholder = "যেমন 1.2345";
      fTarget.value = uiRound.fakeTarget == null ? "" : String(uiRound.fakeTarget);
      body.appendChild(fTarget);

      body.appendChild(el("label", "", "সময় (সেকেন্ড)"));
      var fSec = el("input", "round-in f-sec");
      fSec.type = "number";
      fSec.step = "1";
      fSec.min = "1";
      fSec.placeholder = "5";
      fSec.value = uiRound.fakeSeconds == null ? "" : String(uiRound.fakeSeconds);
      body.appendChild(fSec);

      var btns = el("div", "btn-row");
      var startBtn = el("button", "start", "Start");
      startBtn.type = "button";
      var stopBtn = el("button", "stop", "Stop");
      stopBtn.type = "button";
      btns.appendChild(startBtn);
      btns.appendChild(stopBtn);
      body.appendChild(btns);

      // MANUAL THUNDER X SWITCH CONTROL
      var swBox = el("div", "switch-box");
      var swLabelWrap = el("div", "switch-label-wrap");
      swLabelWrap.appendChild(el("span", "switch-title", "Thunder X Switch"));
      swLabelWrap.appendChild(el("span", "switch-desc", "Controls Quotex TE controller state"));
      swBox.appendChild(swLabelWrap);

      var swToggle = el("div", "switch-btn-toggle");
      var swPillOn = el("span", "switch-pill active-on", "ON");
      var swPillOff = el("span", "switch-pill inactive", "OFF");
      swToggle.appendChild(swPillOn);
      swToggle.appendChild(swPillOff);
      swBox.appendChild(swToggle);
      body.appendChild(swBox);

      var toolEls = {
        market: market,
        fTarget: fTarget,
        fSec: fSec,
        start: startBtn,
        stop: stopBtn,
        runChip: runChip,
        runChipText: runChipText,
        swPillOn: swPillOn,
        swPillOff: swPillOff,
      };
      body._qxToolEls = toolEls;

      fTarget.addEventListener("input", function () {
        uiRound.fakeTarget = fTarget.value;
        saveRoundUi();
        if (fakeRunning && ThunderXSwitchAdapter.isEnabled()) startFake(uiRound.fakeTarget, uiRound.fakeSeconds);
      });
      fSec.addEventListener("input", function () {
        uiRound.fakeSeconds = fSec.value;
        saveRoundUi();
        if (fakeRunning && ThunderXSwitchAdapter.isEnabled()) fake.seconds = Math.max(0.2, Number(uiRound.fakeSeconds) || 5);
      });
      startBtn.addEventListener("click", function () {
        if (!ThunderXSwitchAdapter.isEnabled()) {
          showToast("Thunder X Switch is OFF.");
          return;
        }
        if (fakeRunning) return;
        var t = Number(uiRound.fakeTarget);
        if (!uiRound.fakeTarget || !isFinite(t)) {
          fTarget.focus();
          return;
        }
        fakeRunning = true;
        startFake(uiRound.fakeTarget, uiRound.fakeSeconds);
        updateRoundBtns(toolEls);
      });
      stopBtn.addEventListener("click", function () {
        if (!fakeRunning) return;
        fakeRunning = false;
        stopFake();
        updateRoundBtns(toolEls);
      });

      // Manual switch toggle click
      swToggle.addEventListener("click", function () {
        const nextState = !ThunderXSwitchAdapter.isEnabled();
        ThunderXSwitchAdapter.setEnabled(nextState, "ui");
      });

      updateRoundBtns(toolEls);
      markPanelRows();
    }

    // Subscribe UI to Switch Adapter events
    ThunderXSwitchAdapter.subscribe(function (enabled) {
      if (!enabled) {
        // Safe Switch OFF behavior: Stop fake controller safely
        fakeRunning = false;
        stopFake();
        console.log("Quotex TE: Controller disabled via Thunder X Switch");
      } else {
        console.log("Quotex TE: Controller enabled via Thunder X Switch");
      }
      var toolEls = body._qxToolEls;
      if (toolEls) updateRoundBtns(toolEls);
      setLive(enabled);
    });

    function place(left, top) {
      pos.x = Math.max(8, Math.min(left, window.innerWidth - 96));
      pos.y = Math.max(8, Math.min(top, window.innerHeight - 120));
      fab.style.left = pos.x + "px";
      fab.style.top = pos.y + "px";
      if (panel.hidden) return;
      var rect = fab.getBoundingClientRect();
      var width = panel.offsetWidth || 320;
      var height = panel.offsetHeight || 280;
      var gap = 12;
      var panelLeft = rect.left;
      var panelTop = rect.bottom + gap;
      if (panelTop + height > window.innerHeight - 8) panelTop = rect.top - height - gap;
      if (panelTop < 8) panelTop = 8;
      if (panelLeft + width > window.innerWidth - 8) panelLeft = window.innerWidth - width - 8;
      if (panelLeft < 8) panelLeft = 8;
      var coversIcon = panelLeft < rect.right && panelLeft + width > rect.left && panelTop < rect.bottom && panelTop + height > rect.top;
      if (coversIcon) {
        var shiftLeft = rect.left - width - gap;
        panelLeft = shiftLeft >= 8 ? shiftLeft : rect.right + gap;
      }
      panel.style.left = panelLeft + "px";
      panel.style.top = panelTop + "px";
    }

    var pos = { x: window.innerWidth - 96, y: 120 };
    try {
      var savedPos = JSON.parse(localStorage.getItem("qxte_pos") || "null");
      if (savedPos && typeof savedPos.x === "number") pos = savedPos;
    } catch (e) {}

    function runPanelAnim(frames, duration, fill, done) {
      panelBusy = true;
      panelBusySince = Date.now();
      var finished = false;
      function finish() {
        if (finished) return;
        finished = true;
        panelBusy = false;
        panelBusySince = 0;
        done();
      }
      var fallbackTimer = window.setTimeout(function () {
        if (panelBusy) finish();
      }, duration + 400);
      if (!frames || !panel.animate) {
        clearTimeout(fallbackTimer);
        finish();
        return;
      }
      var anim;
      try {
        anim = panel.animate(frames, { duration: duration, fill: fill || "none" });
      } catch (e) {
        clearTimeout(fallbackTimer);
        finish();
        return;
      }
      if (!anim || !anim.finished) {
        clearTimeout(fallbackTimer);
        finish();
        return;
      }
      anim.finished.then(
        function () { clearTimeout(fallbackTimer); finish(); },
        function () { clearTimeout(fallbackTimer); finish(); }
      );
    }

    function openPanel(animate) {
      ensureMounted();
      if (panelBusy) recoverPanelShell();
      renderActive();
      panel.hidden = false;
      place(pos.x, pos.y);
      resetPanelMotion();
      fab.classList.add("away");
      if (animate === false) {
        panel.classList.add("boot");
        return;
      }
      var frames = morphFrames();
      panel.classList.remove("boot");
      panel.classList.add("morphing");
      runPanelAnim(frames, 620, "none", function () {
        panel.classList.remove("morphing");
        panel.classList.add("boot");
        resetPanelMotion();
      });
    }

    function closePanel() {
      ensureMounted();
      if (panelBusy) recoverPanelShell();
      if (panel.hidden) return;
      var raw = morphFrames();
      var frames = null;
      var i;
      if (raw) {
        frames = [];
        for (i = raw.length - 1; i >= 0; i--) {
          frames.push({
            offset: 1 - raw[i].offset,
            transform: raw[i].transform,
            borderRadius: raw[i].borderRadius,
            filter: raw[i].filter,
            easing: raw[i].easing,
          });
        }
      }
      panel.classList.remove("boot");
      panel.classList.add("morphing");
      runPanelAnim(frames, 480, "forwards", function () {
        panel.getAnimations().forEach(function (anim) {
          try { anim.cancel(); } catch (e) {}
        });
        panel.classList.remove("morphing");
        resetPanelMotion();
        panel.hidden = true;
        fab.classList.remove("away");
        fab.classList.remove("pop");
        void fab.offsetWidth;
        fab.classList.add("pop");
      });
    }

    var drag = null;
    var panelDrag = null;

    const onHeadPointerDown = function (event) {
      ensureMounted();
      if (event.button || panel.hidden) return;
      if (panelBusy) recoverPanelShell();
      event.preventDefault();
      panelDrag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        ox: pos.x,
        oy: pos.y,
        moved: false,
        target: event.target,
      };
      head.classList.add("dragging");
    };

    const onFabPointerDown = function (event) {
      liftWidget();
      if (event.button) return;
      if (panelBusy) recoverPanelShell();
      event.preventDefault();
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, ox: pos.x, oy: pos.y, moved: false };
      fab.classList.add("dragging");
    };

    const onWinPointerMove = function (event) {
      if (panelDrag && event.pointerId === panelDrag.id) {
        var pdx = event.clientX - panelDrag.x;
        var pdy = event.clientY - panelDrag.y;
        if (!panelDrag.moved && Math.hypot(pdx, pdy) < 4) return;
        panelDrag.moved = true;
        place(panelDrag.ox + pdx, panelDrag.oy + pdy);
        return;
      }
      if (!drag || event.pointerId !== drag.id) return;
      var dx = event.clientX - drag.x;
      var dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag.moved = true;
      place(drag.ox + dx, drag.oy + dy);
    };

    const onWinPointerUp = function (event) {
      if (panelDrag && event.pointerId === panelDrag.id) {
        var pmoved = panelDrag.moved;
        var pt = panelDrag.target;
        panelDrag = null;
        head.classList.remove("dragging");
        if (pmoved) {
          try { localStorage.setItem("qxte_pos", JSON.stringify(pos)); } catch (e) {}
          return;
        }
        if (mini.contains(pt)) closePanel();
        return;
      }
      if (!drag || event.pointerId !== drag.id) return;
      var moved = drag.moved;
      drag = null;
      fab.classList.remove("dragging");
      if (moved) {
        try { localStorage.setItem("qxte_pos", JSON.stringify(pos)); } catch (e) {}
        return;
      }
      if (!panel.hidden) {
        closePanel();
        return;
      }
      openPanel(true);
    };

    const onWinPointerCancel = function (event) {
      if (panelDrag && event.pointerId === panelDrag.id) {
        clearDragState();
        return;
      }
      if (!drag || event.pointerId !== drag.id) return;
      clearDragState();
    };

    const onWinVisibilityChange = function () {
      if (document.visibilityState === "visible") {
        clearDragState();
        liftWidget();
      }
    };

    const onWinBlur = function () { clearDragState(); };

    head.addEventListener("pointerdown", onHeadPointerDown);
    fab.addEventListener("pointerdown", onFabPointerDown);
    window.addEventListener("pointermove", onWinPointerMove, true);
    window.addEventListener("pointerup", onWinPointerUp, true);
    window.addEventListener("pointercancel", onWinPointerCancel, true);
    window.addEventListener("visibilitychange", onWinVisibilityChange);
    window.addEventListener("blur", onWinBlur);

    host.style.cssText = "position:relative;z-index:2147483647";
    setLive(ThunderXSwitchAdapter.isEnabled());
    liftWidget();
    place(pos.x, pos.y);

    var liftObs = null;
    try {
      liftObs = new MutationObserver(function () { liftWidget(); });
      liftObs.observe(host, { attributes: true, attributeFilter: ["inert", "aria-hidden"] });
    } catch (e) {}

    loadRoundUi();

    var liftInterval = setInterval(liftWidget, 300);
    var updateInterval = setInterval(function () {
      var toolEls = body._qxToolEls;
      if (!toolEls || !toolEls.market) return;
      toolEls.market.textContent = state.asset ? fmtAsset(state.asset) : "Waiting for data…";
    }, 500);

    console.log(`${BRAND_NAME} initialized successfully. Switch State:`, ThunderXSwitchAdapter.isEnabled() ? "ON" : "OFF");
  }

  // Check license authentication and start Quotex TE
  showLicenseGate(startQuotexTE);
})();
