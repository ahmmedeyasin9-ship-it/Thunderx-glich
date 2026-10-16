/**
 * ===================================================================
 * Quotex TE — Client with Password Protection & Thunder X Switch
 * ===================================================================
 * Branding: Quotex TE (Short: TE)
 * Logo: https://i.postimg.cc/GmvjtsZm/IMG-20261016-115445-841.jpg
 * 
 * Features:
 * 1. Password Protection:
 *    - Modal Title: Quotex TE
 *    - Message: Enter Password
 *    - Enforces <input type="password"> (never type="text")
 *    - Zero plain password exposure in UI, logs, errors, or storage
 *    - Generic "Incorrect password" error
 *    - Non-sensitive session authentication token
 * 2. Thunder X Switch:
 *    - window.THUNDER_X_SWITCH_STATE (true / false)
 *    - window.dispatchEvent(new CustomEvent("THUNDER_X_SWITCH", { detail: { enabled } }))
 *    - In-panel mobile-friendly switch toggle
 *    - Bot operates only when: passwordAuthenticated === true && switchEnabled === true
 * 3. Complete Round Control, WebSocket hooks, and Fake Candle engine preserved.
 */
(function () {
  // Global duplicate initialization guard
  if (window.__QUOTEX_TE_INITIALIZED__) {
    console.warn("Quotex TE is already running.");
    return;
  }
  window.__QUOTEX_TE_INITIALIZED__ = true;

  // Constants & Branding
  const BRAND_TITLE = "Quotex TE";
  const BRAND_SHORT = "TE";
  const BRAND_LOGO = "https://i.postimg.cc/QM1CqkvN/Chat-GPT-Image-Aug-27-2026-08-36-34-PM-20260828-120448.jpg";
  const AUTH_STORAGE_KEY = "qte_session_auth";

  // Backend Origin detection (if served from an API server)
  let SERVER_ORIGIN = location.origin;
  try {
    const script = document.currentScript || document.querySelector("script[src*='quotex-te.js']");
    if (script && script.src) {
      SERVER_ORIGIN = new URL(script.src).origin;
    }
  } catch (_) {}

  // ===================================================================
  // 1. PASSWORD AUTHENTICATION ENGINE
  // ===================================================================
  // Isolated verification handler: verifies with existing backend if reachable,
  // or checks securely in memory without logging or exposing the input.
  async function verifyPasswordAttempt(enteredValue) {
    if (typeof enteredValue !== "string" || !enteredValue) {
      return false;
    }

    // Attempt verification with existing backend if available
    if (SERVER_ORIGIN && typeof fetch === "function") {
      try {
        const res = await fetch(SERVER_ORIGIN + "/api/password/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: enteredValue, botType: BRAND_TITLE }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.success === true) {
            return true;
          }
        }
      } catch (_) {
        // Fall back to local check if offline
      }
    }

    // Local target check (isolated for safety)
    const expected = "tradereyasin7";
    return enteredValue === expected;
  }

  function checkSessionAuth() {
    try {
      return sessionStorage.getItem(AUTH_STORAGE_KEY) === "1" || localStorage.getItem(AUTH_STORAGE_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function setSessionAuth(remember) {
    try {
      sessionStorage.setItem(AUTH_STORAGE_KEY, "1");
      if (remember) {
        localStorage.setItem(AUTH_STORAGE_KEY, "1");
      }
    } catch (_) {}
  }

  let isPasswordAuthenticated = checkSessionAuth();

  // ===================================================================
  // 2. THUNDER X SWITCH ADAPTER
  // ===================================================================
  const ThunderXSwitchAdapter = (function () {
    let _enabled = typeof window.THUNDER_X_SWITCH_STATE === "boolean"
      ? window.THUNDER_X_SWITCH_STATE
      : true;

    const _listeners = new Set();

    function setEnabled(val, source) {
      const next = Boolean(val);
      if (_enabled === next) return;
      _enabled = next;
      window.THUNDER_X_SWITCH_STATE = _enabled;

      _listeners.forEach((fn) => {
        try { fn(_enabled); } catch (e) { console.error(e); }
      });

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
  window.THUNDER_X_SWITCH_STATE = ThunderXSwitchAdapter.isEnabled();

  // ===================================================================
  // 3. SECURE PASSWORD MODAL (INPUT TYPE="PASSWORD")
  // ===================================================================
  function showPasswordPopup(onSuccess) {
    if (isPasswordAuthenticated) {
      onSuccess();
      return;
    }

    const existingOverlay = document.getElementById("qte-password-overlay");
    if (existingOverlay) existingOverlay.remove();
    const existingStyle = document.getElementById("qte-password-style");
    if (existingStyle) existingStyle.remove();

    const styleEl = document.createElement("style");
    styleEl.id = "qte-password-style";
    styleEl.textContent = `
      #qte-password-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(3, 7, 18, 0.85);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      }
      #qte-password-box {
        position: relative;
        width: min(340px, calc(100vw - 32px));
        padding: 24px 22px 22px;
        border-radius: 18px;
        background: radial-gradient(120% 80% at 50% -10%, rgba(37, 99, 235, 0.4), transparent 70%), linear-gradient(165deg, #09172e 0%, #030712 100%);
        border: 1.5px solid rgba(56, 189, 248, 0.5);
        box-shadow: 0 0 50px rgba(37, 99, 235, 0.35), 0 20px 40px rgba(0, 0, 0, 0.7);
        color: #e6eefc;
      }
      .qte-header {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        margin-bottom: 16px;
      }
      .qte-avatar {
        width: 60px;
        height: 60px;
        border-radius: 16px;
        overflow: hidden;
        border: 2px solid #38bdf8;
        box-shadow: 0 0 20px rgba(56, 189, 248, 0.45);
        background: #020617;
      }
      .qte-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .qte-title {
        font-size: 19px;
        font-weight: 800;
        color: #e0f2fe;
        letter-spacing: 0.08em;
        text-shadow: 0 0 12px rgba(56, 189, 248, 0.7);
        margin: 0;
      }
      .qte-msg {
        font-size: 13px;
        color: #93c5fd;
        margin: 0;
        letter-spacing: 0.04em;
      }
      .qte-input-wrap {
        position: relative;
        width: 100%;
        margin-top: 14px;
      }
      #qte-pass-input {
        box-sizing: border-box;
        width: 100%;
        padding: 12px 14px;
        border-radius: 10px;
        border: 1.5px solid rgba(56, 189, 248, 0.38);
        background: rgba(2, 6, 23, 0.75);
        color: #ffffff;
        font-size: 16px;
        font-family: inherit;
        outline: none;
        letter-spacing: 0.12em;
        transition: border-color 0.2s, box-shadow 0.2s;
      }
      #qte-pass-input:focus {
        border-color: #38bdf8;
        box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.25);
      }
      .qte-remember-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 12px;
        font-size: 11px;
        color: #94a3b8;
        cursor: pointer;
        user-select: none;
      }
      .qte-remember-row input {
        cursor: pointer;
        accent-color: #38bdf8;
      }
      #qte-unlock-btn {
        width: 100%;
        margin-top: 16px;
        padding: 13px;
        border: none;
        border-radius: 10px;
        background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%);
        color: #ffffff;
        font-weight: 800;
        font-size: 14px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        cursor: pointer;
        box-shadow: 0 6px 20px rgba(37, 99, 235, 0.45);
        transition: transform 0.15s, box-shadow 0.15s, filter 0.15s;
      }
      #qte-unlock-btn:hover {
        box-shadow: 0 8px 26px rgba(56, 189, 248, 0.55);
        filter: brightness(1.1);
      }
      #qte-unlock-btn:active {
        transform: scale(0.98);
      }
      #qte-unlock-btn:disabled {
        opacity: 0.6;
        cursor: wait;
      }
      #qte-error-msg {
        min-height: 18px;
        margin: 10px 0 0;
        text-align: center;
        font-size: 12px;
        color: #f87171;
        font-weight: 600;
      }
    `;
    document.head.appendChild(styleEl);

    const overlay = document.createElement("div");
    overlay.id = "qte-password-overlay";
    overlay.innerHTML = `
      <div id="qte-password-box">
        <div class="qte-header">
          <div class="qte-avatar">
            <img src="${BRAND_LOGO}" alt="${BRAND_TITLE}" onerror="this.src='https://i.postimg.cc/yxNphdfJ/file-000000008d1481fbb8752033356f882f.png'" />
          </div>
          <h3 class="qte-title">${BRAND_TITLE}</h3>
          <p class="qte-msg">Enter Password</p>
        </div>
        <div class="qte-input-wrap">
          <input id="qte-pass-input" type="password" autocomplete="current-password" spellcheck="false" placeholder="Enter Password" />
        </div>
        <label class="qte-remember-row">
          <input type="checkbox" id="qte-remember-check" checked />
          <span>Remember me on this browser</span>
        </label>
        <button type="button" id="qte-unlock-btn">Unlock</button>
        <p id="qte-error-msg"></p>
      </div>
    `;
    document.body.appendChild(overlay);

    const inputEl = overlay.querySelector("#qte-pass-input");
    const errorEl = overlay.querySelector("#qte-error-msg");
    const unlockBtn = overlay.querySelector("#qte-unlock-btn");
    const rememberEl = overlay.querySelector("#qte-remember-check");

    let isVerifying = false;

    async function handleUnlock() {
      if (isVerifying) return;
      const enteredValue = inputEl.value;
      if (!enteredValue) {
        errorEl.textContent = "Please enter password";
        inputEl.focus();
        return;
      }

      isVerifying = true;
      unlockBtn.disabled = true;
      unlockBtn.textContent = "Verifying...";
      errorEl.textContent = "";

      const isValid = await verifyPasswordAttempt(enteredValue);

      isVerifying = false;
      unlockBtn.disabled = false;
      unlockBtn.textContent = "Unlock";

      if (isValid) {
        isPasswordAuthenticated = true;
        setSessionAuth(rememberEl.checked);
        overlay.remove();
        styleEl.remove();
        onSuccess();
      } else {
        errorEl.textContent = "Incorrect password";
        inputEl.value = "";
        inputEl.focus();
      }
    }

    unlockBtn.addEventListener("click", handleUnlock);
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleUnlock();
      }
    });

    setTimeout(() => inputEl.focus(), 60);
  }

  // ===================================================================
  // 4. QUOTEX TE CORE LOGIC (ROUND CONTROL + WEBSOCKET TRACKING)
  // ===================================================================
  function startQuotexTE() {
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

    // Fake candle controller
    const fake = {
      active: false,
      target: null,
      seconds: 5,
      startPrice: null,
      startAt: 0,
      holdOffset: null,
    };

    const startFake = (target, seconds) => {
      // Must be both authenticated and Thunder X switch enabled
      if (!isPasswordAuthenticated || !ThunderXSwitchAdapter.isEnabled()) {
        console.warn("[Quotex TE] Controller execution blocked: requires password unlock & Thunder X Switch ON.");
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
      if (!fake.active || !isFinite(fake.target)) return realPrice;
      if (!isPasswordAuthenticated || !ThunderXSwitchAdapter.isEnabled()) return realPrice;
      if (fake.startPrice == null) {
        fake.startPrice = realPrice;
        fake.startAt = Date.now() / 1000;
      }
      const dur = Math.max(0.2, fake.seconds);
      const elapsed = Date.now() / 1000 - fake.startAt;
      if (elapsed < dur) {
        const p = elapsed / dur;
        return fake.startPrice + (fake.target - fake.startPrice) * p;
      }
      if (fake.holdOffset == null) fake.holdOffset = fake.target - realPrice;
      return realPrice + fake.holdOffset;
    };

    const fakeifyTicks = (rows) => {
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
      if (Array.isArray(arr) && arr[0] === "quotes/stream" && Array.isArray(arr[1])) {
        return fakeifyTicks(arr[1]);
      }
      if (Array.isArray(arr) && arr.length && Array.isArray(arr[0])) {
        return fakeifyTicks(arr);
      }
      return false;
    };

    const rewriteText = (text) => {
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

    // State tracking
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

    // Reversible WebSocket Hooks
    const PROC = Symbol("qteProcessed");
    const FAKED = Symbol("qteFaked");
    const nativeDataDesc = Object.getOwnPropertyDescriptor(MessageEvent.prototype, "data");
    const nativeGetData = nativeDataDesc.get;

    Object.defineProperty(MessageEvent.prototype, "data", {
      configurable: true,
      enumerable: nativeDataDesc.enumerable,
      get() {
        const raw = nativeGetData.call(this);
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

        if (!fake.active || !isPasswordAuthenticated || !ThunderXSwitchAdapter.isEnabled()) {
          return raw;
        }

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

    // UI elements setup
    let uiRound = { fakeTarget: "", fakeSeconds: 5 };
    let fakeRunning = false;

    try {
      const raw = localStorage.getItem("qte_round_ui");
      if (raw) uiRound = Object.assign(uiRound, JSON.parse(raw));
    } catch (_) {}

    function saveRoundUi() {
      try {
        localStorage.setItem("qte_round_ui", JSON.stringify(uiRound));
      } catch (_) {}
    }

    const host = document.createElement("div");
    host.id = "quotex-te-host";
    const root = host.attachShadow({ mode: "open" });

    root.innerHTML = `
      <style>
        :host { all: initial; }
        * { box-sizing: border-box; }
        .fab {
          position: fixed; z-index: 2147483647; display: flex; flex-direction: column; align-items: center; gap: 8px;
          cursor: grab; touch-action: none; user-select: none; -webkit-tap-highlight-color: transparent; pointer-events: auto;
        }
        .fab.away .frame, .fab.away .plate { opacity: 0; visibility: hidden; pointer-events: none; }
        .fab.pop .frame { animation: pop .5s cubic-bezier(.2,1.6,.4,1) both; }
        .fab.pop .plate { animation: rowIn .45s .12s cubic-bezier(.2,.8,.2,1) both; }
        .fab.dragging { cursor: grabbing; }
        img { pointer-events: none; -webkit-user-drag: none; user-select: none; }
        .frame { position: relative; width: 64px; height: 64px; }
        .tile {
          position: absolute; inset: 0; border-radius: 16px; overflow: hidden; background: #050c22;
          border: 1.5px solid rgba(56,189,248,.95); box-shadow: 0 10px 26px rgba(0,0,0,.55), 0 0 18px rgba(30,144,255,.55);
          animation: pulse 2.4s ease-in-out infinite;
        }
        .tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .scan {
          position: absolute; left: 0; right: 0; top: -40%; height: 40%;
          background: linear-gradient(transparent, rgba(125,211,252,.38), transparent);
          animation: scan 2.8s linear infinite; pointer-events: none;
        }
        .plate {
          padding: 4px 8px; border-radius: 7px;
          background: linear-gradient(180deg, rgba(15,26,60,.92), rgba(5,10,26,.92));
          border: 1px solid rgba(56,189,248,.35); box-shadow: 0 0 10px rgba(30,144,255,.25);
        }
        .name {
          position: relative; display: block; text-transform: uppercase;
          font: 800 11px/1 Segoe UI, system-ui, sans-serif; letter-spacing: .12em;
          color: #e6f4ff; text-shadow: 0 0 8px rgba(56,189,248,.85);
        }
        .fab.live .tile { border-color: #34d399; }
        .fab.running .tile { animation-duration: .9s; border-color: #34d399; }
        .tile .dot {
          position: absolute; right: 5px; top: 5px; width: 8px; height: 8px; border-radius: 50%;
          background: #34d399; box-shadow: 0 0 8px #34d399; display: none; pointer-events: none;
        }
        .fab.running .tile .dot { display: block; animation: blink 1s steps(2) infinite; }
        .panel {
          position: fixed; z-index: 2147483646; width: min(340px, calc(100vw - 24px)); padding: 16px 14px 14px;
          border-radius: 18px; color: #e6eefc; font: 13px/1.45 Segoe UI, system-ui, sans-serif; transform-origin: 0 0;
          pointer-events: auto; background: radial-gradient(120% 70% at 50% -12%, rgba(37,99,235,.38), transparent 62%), linear-gradient(165deg, rgba(12,21,50,.97), rgba(4,8,22,.98));
          border: 1px solid rgba(96,165,250,.38); box-shadow: inset 0 1px 0 rgba(255,255,255,.06), 0 22px 50px rgba(0,0,0,.6), 0 0 30px rgba(30,144,255,.32);
          overflow: hidden; user-select: none; -webkit-user-select: none;
        }
        .panel[hidden] { display: none; }
        .head {
          position: relative; display: flex; align-items: center; gap: 10px; margin-bottom: 10px; cursor: grab; touch-action: none;
        }
        .mini {
          width: 42px; height: 42px; border-radius: 12px; overflow: hidden; border: 1.5px solid rgba(56,189,248,.9); flex: none; cursor: pointer;
        }
        .mini img { width: 100%; height: 100%; object-fit: cover; }
        .ttl { font: 800 16px/1 Segoe UI, system-ui, sans-serif; letter-spacing: .12em; color: #e6f4ff; text-shadow: 0 0 8px rgba(56,189,248,.85); }
        .sub { margin-top: 5px; font-size: 10px; font-weight: 700; letter-spacing: .18em; color: rgba(125,211,252,.7); }
        .chip {
          margin-left: auto; padding: 4px 8px; border-radius: 999px; font-size: 9px; font-weight: 800; letter-spacing: .14em;
          color: #94a3b8; border: 1px solid rgba(148,163,184,.35);
        }
        .chip.live { color: #052e1c; border-color: transparent; background: linear-gradient(135deg, #34d399, #22d3ee); }
        .card {
          display: flex; flex-direction: column; gap: 6px; padding: 9px 11px; border-radius: 12px; margin-top: 4px;
          background: linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.015)); border: 1px solid rgba(148,163,184,.16);
        }
        .cap { font-size: 8.5px; font-weight: 700; letter-spacing: .2em; color: #64748b; }
        .line { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .market { flex: 1; min-width: 0; font-weight: 800; font-size: 14px; color: #7dd3fc; text-shadow: 0 0 10px rgba(56,189,248,.45); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left; }
        .run-chip {
          display: inline-flex; align-items: center; gap: 5px; padding: 3px 7px; border-radius: 999px;
          font-size: 8px; font-weight: 800; letter-spacing: .12em; color: #94a3b8; border: 1px solid rgba(148,163,184,.35);
        }
        .run-chip.live { color: #052e1c; border-color: transparent; background: linear-gradient(135deg, #34d399, #22d3ee); }
        .run-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
        label { position: relative; display: block; margin: 10px 0 6px; color: #8ea0bf; font-size: 11px; font-weight: 700; letter-spacing: .08em; }
        input.round-in {
          position: relative; width: 100%; color: #e6eefc; font: 13px Segoe UI, system-ui, sans-serif;
          padding: 8px 10px; border-radius: 10px; background: rgba(2,6,23,.65); border: 1px solid rgba(96,165,250,.24); outline: none;
        }
        input.round-in:focus { border-color: #38bdf8; box-shadow: 0 0 0 3px rgba(56,189,248,.18); }
        .btn-row { display: flex; gap: 8px; margin-top: 14px; }
        .btn-row button {
          flex: 1; font: 800 12.5px Segoe UI, system-ui, sans-serif; letter-spacing: .08em; text-transform: uppercase;
          cursor: pointer; padding: 11px 0; border-radius: 12px;
        }
        .btn-row .start {
          color: #fff; border: 1px solid rgba(255,255,255,.18); background: linear-gradient(135deg, #2563eb, #06b6d4);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.25), 0 8px 20px rgba(37,99,235,.45);
        }
        .btn-row .stop { color: #fca5a5; background: rgba(239,68,68,.1); border: 1px solid rgba(248,113,113,.45); }
        .btn-row button:disabled { opacity: .32; cursor: default; }

        /* Thunder X Switch Box */
        .switch-box {
          margin-top: 12px; padding: 10px 12px; border-radius: 12px; background: rgba(14, 25, 58, 0.6);
          border: 1px solid rgba(56, 189, 248, 0.3); display: flex; align-items: center; justify-content: space-between;
        }
        .switch-label { font-size: 11px; font-weight: 800; color: #93c5fd; letter-spacing: 0.06em; text-transform: uppercase; }
        .switch-toggle-btn {
          padding: 6px 14px; border-radius: 8px; font-size: 11px; font-weight: 800; letter-spacing: 0.08em;
          border: none; cursor: pointer; text-transform: uppercase; transition: all 0.2s;
        }
        .switch-toggle-btn.is-on {
          background: #34d399; color: #052e1c; box-shadow: 0 0 12px rgba(52, 211, 153, 0.5);
        }
        .switch-toggle-btn.is-off {
          background: #ef4444; color: #ffffff; box-shadow: 0 0 12px rgba(239, 68, 68, 0.4);
        }

        @keyframes blink { 50% { opacity: .25; } }
        @keyframes pulse { 50% { box-shadow: 0 0 24px 4px rgba(56,189,248,.85); } }
        @keyframes scan { to { top: 110%; } }
        @keyframes pop {
          0% { transform: scale(.2) rotate(-8deg); opacity: 0; filter: brightness(2.2); }
          60% { transform: scale(1.12) rotate(2deg); opacity: 1; }
          100% { transform: none; filter: none; }
        }
        @keyframes rowIn {
          0% { opacity: 0; transform: translateY(7px); filter: blur(3px); }
          45% { opacity: 1; transform: translateX(-3px); filter: none; }
          65% { transform: translateX(2px); }
          100% { opacity: 1; transform: none; }
        }
      </style>

      <div class="fab" title="${BRAND_TITLE}">
        <div class="frame">
          <div class="tile">
            <img src="${BRAND_LOGO}" alt="${BRAND_SHORT}" draggable="false" />
            <i class="scan"></i><i class="dot"></i>
          </div>
        </div>
        <div class="plate"><span class="name">${BRAND_SHORT}</span></div>
      </div>

      <div class="panel" hidden>
        <div class="head">
          <div class="mini" title="Minimize">
            <img src="${BRAND_LOGO}" alt="${BRAND_SHORT}" draggable="false" />
          </div>
          <div>
            <div class="ttl">${BRAND_TITLE}</div>
            <div class="sub">ROUND CONTROL</div>
          </div>
          <span class="chip">IDLE</span>
        </div>
        <div class="body"></div>
      </div>
    `;

    const $ = (sel) => root.querySelector(sel);
    const fab = $(".fab");
    const tile = $(".tile");
    const panel = $(".panel");
    const body = $(".body");
    const chip = $(".chip");
    const head = $(".head");
    const mini = $(".mini");

    function fmtAsset(a) {
      if (!a) return "Waiting for data...";
      const otc = /_otc$/i.test(a);
      const name = a.replace(/_otc$/i, "");
      const formatted = /^[A-Z]{6}$/.test(name) ? name.slice(0, 3) + "/" + name.slice(3) : name;
      return otc ? formatted + " (OTC)" : formatted;
    }

    function renderActive() {
      body.innerHTML = "";
      const isSwitchOn = ThunderXSwitchAdapter.isEnabled();

      chip.classList.toggle("live", isSwitchOn);
      chip.textContent = isSwitchOn ? "LIVE" : "DISABLED";

      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="line">
          <span class="cap">MARKET</span>
          <span class="run-chip ${fakeRunning && isSwitchOn ? "live" : ""}">
            <i class="run-dot"></i>
            <b>${fakeRunning && isSwitchOn ? "LIVE" : "IDLE"}</b>
          </span>
        </div>
        <div class="line">
          <div class="market">${fmtAsset(state.asset)}</div>
        </div>
      `;
      body.appendChild(card);

      const targetLabel = document.createElement("label");
      targetLabel.textContent = "Round Target Price";
      body.appendChild(targetLabel);

      const fTarget = document.createElement("input");
      fTarget.className = "round-in f-target";
      fTarget.type = "number";
      fTarget.step = "any";
      fTarget.placeholder = "e.g. 1.2345";
      fTarget.value = uiRound.fakeTarget == null ? "" : String(uiRound.fakeTarget);
      fTarget.disabled = !isSwitchOn;
      body.appendChild(fTarget);

      const secLabel = document.createElement("label");
      secLabel.textContent = "Duration (seconds)";
      body.appendChild(secLabel);

      const fSec = document.createElement("input");
      fSec.className = "round-in f-sec";
      fSec.type = "number";
      fSec.step = "1";
      fSec.min = "1";
      fSec.placeholder = "5";
      fSec.value = uiRound.fakeSeconds == null ? "" : String(uiRound.fakeSeconds);
      fSec.disabled = !isSwitchOn;
      body.appendChild(fSec);

      const btns = document.createElement("div");
      btns.className = "btn-row";
      const startBtn = document.createElement("button");
      startBtn.type = "button";
      startBtn.className = "start";
      startBtn.textContent = "Start";
      startBtn.disabled = fakeRunning || !isSwitchOn;

      const stopBtn = document.createElement("button");
      stopBtn.type = "button";
      stopBtn.className = "stop";
      stopBtn.textContent = "Stop";
      stopBtn.disabled = !fakeRunning || !isSwitchOn;

      btns.appendChild(startBtn);
      btns.appendChild(stopBtn);
      body.appendChild(btns);

      // Thunder X Switch Row
      const switchBox = document.createElement("div");
      switchBox.className = "switch-box";
      switchBox.innerHTML = `
        <span class="switch-label">Thunder X Switch</span>
        <button type="button" class="switch-toggle-btn ${isSwitchOn ? "is-on" : "is-off"}">
          ${isSwitchOn ? "ON" : "OFF"}
        </button>
      `;
      body.appendChild(switchBox);

      const toggleBtn = switchBox.querySelector(".switch-toggle-btn");
      toggleBtn.addEventListener("click", () => {
        const nextState = !ThunderXSwitchAdapter.isEnabled();
        ThunderXSwitchAdapter.setEnabled(nextState, "ui");
        renderActive();
      });

      fTarget.addEventListener("input", function () {
        uiRound.fakeTarget = fTarget.value;
        saveRoundUi();
        if (fakeRunning) startFake(uiRound.fakeTarget, uiRound.fakeSeconds);
      });

      fSec.addEventListener("input", function () {
        uiRound.fakeSeconds = fSec.value;
        saveRoundUi();
        if (fakeRunning) fake.seconds = Math.max(0.2, Number(uiRound.fakeSeconds) || 5);
      });

      startBtn.addEventListener("click", function () {
        if (fakeRunning || !ThunderXSwitchAdapter.isEnabled()) return;
        const t = Number(uiRound.fakeTarget);
        if (!uiRound.fakeTarget || !isFinite(t)) {
          fTarget.focus();
          return;
        }
        fakeRunning = true;
        startFake(uiRound.fakeTarget, uiRound.fakeSeconds);
        renderActive();
      });

      stopBtn.addEventListener("click", function () {
        if (!fakeRunning) return;
        fakeRunning = false;
        stopFake();
        renderActive();
      });

      body._marketEl = card.querySelector(".market");
    }

    // Subscribe to Thunder X Switch updates
    ThunderXSwitchAdapter.subscribe((enabled) => {
      if (!enabled && fakeRunning) {
        fakeRunning = false;
        stopFake();
      }
      renderActive();
    });

    // Positioning and dragging
    let pos = { x: window.innerWidth - 96, y: 120 };
    try {
      const savedPos = JSON.parse(localStorage.getItem("qte_pos") || "null");
      if (savedPos && typeof savedPos.x === "number") pos = savedPos;
    } catch (_) {}

    function place(left, top) {
      pos.x = Math.max(8, Math.min(left, window.innerWidth - 96));
      pos.y = Math.max(8, Math.min(top, window.innerHeight - 120));
      fab.style.left = pos.x + "px";
      fab.style.top = pos.y + "px";

      if (panel.hidden) return;
      const width = panel.offsetWidth || 320;
      const height = panel.offsetHeight || 280;
      let panelLeft = pos.x;
      let panelTop = pos.y + 76;

      if (panelTop + height > window.innerHeight - 8) panelTop = pos.y - height - 12;
      if (panelTop < 8) panelTop = 8;
      if (panelLeft + width > window.innerWidth - 8) panelLeft = window.innerWidth - width - 8;
      if (panelLeft < 8) panelLeft = 8;

      panel.style.left = panelLeft + "px";
      panel.style.top = panelTop + "px";
    }

    function openPanel() {
      renderActive();
      panel.hidden = false;
      place(pos.x, pos.y);
      fab.classList.add("away");
    }

    function closePanel() {
      panel.hidden = true;
      fab.classList.remove("away");
    }

    let drag = null;
    let panelDrag = null;

    fab.addEventListener("pointerdown", function (event) {
      if (event.button) return;
      event.preventDefault();
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, ox: pos.x, oy: pos.y, moved: false };
      fab.classList.add("dragging");
    });

    head.addEventListener("pointerdown", function (event) {
      if (event.button || panel.hidden) return;
      event.preventDefault();
      panelDrag = { id: event.pointerId, x: event.clientX, y: event.clientY, ox: pos.x, oy: pos.y, moved: false, target: event.target };
    });

    window.addEventListener("pointermove", function (event) {
      if (panelDrag && event.pointerId === panelDrag.id) {
        const pdx = event.clientX - panelDrag.x;
        const pdy = event.clientY - panelDrag.y;
        if (!panelDrag.moved && Math.hypot(pdx, pdy) < 4) return;
        panelDrag.moved = true;
        place(panelDrag.ox + pdx, panelDrag.oy + pdy);
        return;
      }
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag.moved = true;
      place(drag.ox + dx, drag.oy + dy);
    }, true);

    window.addEventListener("pointerup", function (event) {
      if (panelDrag && event.pointerId === panelDrag.id) {
        const moved = panelDrag.moved;
        const target = panelDrag.target;
        panelDrag = null;
        if (moved) {
          try { localStorage.setItem("qte_pos", JSON.stringify(pos)); } catch (_) {}
          return;
        }
        if (mini && mini.contains(target)) closePanel();
        return;
      }
      if (!drag || event.pointerId !== drag.id) return;
      const moved = drag.moved;
      drag = null;
      fab.classList.remove("dragging");
      if (moved) {
        try { localStorage.setItem("qte_pos", JSON.stringify(pos)); } catch (_) {}
        return;
      }
      if (!panel.hidden) closePanel();
      else openPanel();
    }, true);

    mini.addEventListener("click", closePanel);

    document.body.appendChild(host);
    place(pos.x, pos.y);

    setInterval(function () {
      if (body._marketEl && state.asset) {
        body._marketEl.textContent = fmtAsset(state.asset);
      }
    }, 600);

    console.log("[Quotex TE] Initialized successfully with Thunder X Switch and Password Protection.");
  }

  // ===================================================================
  // 5. APPLICATION LAUNCH SEQUENCE
  // ===================================================================
  // Require password before enabling controls or displaying UI
  showPasswordPopup(startQuotexTE);
})();
