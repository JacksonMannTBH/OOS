// Isolated native recording, location and aircraft data for packaged-app checks.
const base = process.env.OOS_VISUAL_BASE_URL ?? "http://127.0.0.1:4183";

export async function fixture(page, seeded = false, aircraftCount = 0) {
  page.setDefaultTimeout(30000);
  const aircraft = Array.from({ length: aircraftCount }, (_, i) => ({
    // Production state feeds use home_state_code; these new tails deliberately
    // do not exist in the bundled aircraft catalog.
    tail: `N${100 + i}TEST`, home_state_code: "WA", nickname: `Aircraft ${i + 1}`,
    role: i % 2 ? "fixed_wing" : "patrol", model: i % 2 ? "Cessna 182" : "Bell 407",
    airborne: true, observed: true, lat: 47.48 + i * .04, lon: i % 3 === 0 ? -122.33 : i % 3 === 1 ? -122.19 : -122.26,
    heading: 0, ground_speed_kt: 100, altitude_ft: 2000,
  }));
  await page.routeWebSocket("**/realtime/v1/**", socket => {
    socket.onMessage(raw => {
      const [join, ref, topic, event] = JSON.parse(String(raw));
      if (event === "phx_join" || event === "heartbeat") {
        socket.send(JSON.stringify([join, ref, topic, "phx_reply", { status: "ok", response: {} }]));
      }
    });
  });
  await page.route("**/*", route => {
    const url = route.request().url();
    if (url.startsWith(base) || url.startsWith("blob:") || url.startsWith("data:")) return route.continue();
    if (url.includes("/oos-riders/riders?")) return route.fulfill({
      headers: { "Access-Control-Allow-Origin": base, "Access-Control-Allow-Headers": "apikey" },
      json: { riders: [], serverTime: Date.now() },
    });
    if (url.includes("/live?")) return route.fulfill({ json: {
      version: 1, state: "WA", revision: Date.now(),
      snapshot: { aircraft, fetched_at: Date.now(), source_ok: true, source: "adsbfi" }, trails: {},
    } });
    if (url.includes("style") && !url.includes("aircraft")) return route.fulfill({ json: { version: 8, sources: {}, layers: [] } });
    return route.fulfill({ json: { aircraft, fetched_at: Date.now(), source_ok: true } });
  });
  await page.addInitScript(({ seeded }) => {
    const ride = (id, days = 0) => ({ id, startedAt: Date.now() - days * 86400000 - 3600000,
      updatedAt: Date.now() - days * 86400000, endedAt: Date.now() - days * 86400000,
      distanceMeters: 19800, topSpeedMps: 22, durationSeconds: 3600, sampleCount: 3600,
      hasGaps: false, interrupted: false, route: [
        { latitude: 47.5, longitude: -122.26, startsSegment: true },
        { latitude: 47.502, longitude: -122.258, startsSegment: false },
        { latitude: 47.504, longitude: -122.258, startsSegment: false },
        { latitude: 47.506, longitude: -122.254, startsSegment: false },
      ] });
    const state = window.rideFixture = JSON.parse(sessionStorage.getItem("rideFixture") || "null") ?? {
      supported: true, consentRequired: true, active: null,
      rides: seeded ? [ride("one"), ride("two", 1), ride("three", 2)] : [],
      receivingLocation: true, message: "", starts: 0, finishes: 0, failure: "", live: false,
    };
    const save = () => sessionStorage.setItem("rideFixture", JSON.stringify(state));
    const compass = window.headingFixture = { heading: 0, callbacks: {} };
    const orientation = window.orientationFixture = { locked: true, sessionId: "fixture-ride", changes: [], failure: "" };
    const location = window.locationFixture = { watches: [], started: 0, callbacks: {}, latitude: 47.5, longitude: -122.26 };
    const position = () => ({ timestamp: Date.now(), coords: { latitude: location.latitude, longitude: location.longitude,
      accuracy: 5, altitude: null, altitudeAccuracy: null, speed: 0, heading: 0 } });
    window.webkit = { messageHandlers: { bridge: {} } };
    window.Capacitor = {
      PluginHeaders: [
        { name: "OOSScreenAwake", methods: ["acquire", "release", "orientationStatus", "setOrientationLocked"].map(name => ({ name, rtype: "promise" })) },
        { name: "PushNotifications", methods: ["checkPermissions", "requestPermissions", "register", "unregister", "removeListener", "removeAllListeners"].map(name => ({ name, rtype: "promise" })).concat([{ name: "addListener", rtype: "callback" }]) },
        { name: "OOSLocation", methods: ["clearWatch", "clearHeading"].map(name => ({ name, rtype: "promise" })).concat(["watchPosition", "watchHeading"].map(name => ({ name, rtype: "callback" }))) },
        { name: "OOSRideRecorder", methods: ["start", "finish", "delete", "status"].map(name => ({ name, rtype: "promise" })) },
        { name: "OOSLiveTracking", methods: ["start", "stop", "status", "configure"].map(name => ({ name, rtype: "promise" })) },
        { name: "Preferences", methods: ["get", "set", "remove"].map(name => ({ name, rtype: "promise" })) },
        { name: "Geolocation", methods: ["getCurrentPosition", "clearWatch"].map(name => ({ name, rtype: "promise" })).concat([{ name: "watchPosition", rtype: "callback" }]) },
      ],
      nativePromise: async (plugin, method, args) => {
        if (plugin === "OOSScreenAwake") {
          if (method === "acquire" || method === "release") return {};
          if (method === "setOrientationLocked") {
            if (orientation.failure) throw new Error(orientation.failure);
            if (args.sessionId !== orientation.sessionId) throw new Error("Stale Ride screen");
            orientation.locked = args.locked;
            orientation.changes.push(args.locked);
          }
          return { supported: true, locked: orientation.locked, sessionId: orientation.sessionId };
        }
        if (plugin === "PushNotifications") return { receive: "denied" };
        if (plugin === "OOSLocation") {
          if (method === "clearWatch") { location.watches = location.watches.filter(id => id !== args.id); delete location.callbacks[args.id]; }
          if (method === "clearHeading") delete compass.callbacks[args.id];
          return {};
        }
        if (plugin === "Preferences") return { value: null };
        if (plugin === "Geolocation") {
          if (method === "clearWatch") { location.watches = location.watches.filter(id => id !== args.id); delete location.callbacks[args.id]; }
          return position();
        }
        if (plugin === "OOSLiveTracking") {
          if (method === "start") state.live = true;
          if (method === "stop") state.live = false;
          save();
          return { supported: true, enabled: true, active: state.live, message: "" };
        }
        if (plugin === "OOSRideRecorder") {
          if (state.failure && method !== "status") throw new Error(state.failure);
          if (method === "start") {
            if (!state.active) {
              if (state.consentRequired && !args.consent) throw new Error("Consent required");
              state.consentRequired = false;
              state.active = { ...ride("recorded"), endedAt: null };
              state.starts++;
            }
          }
          if (method === "finish") {
            assertId(args.id, state.active?.id);
            const result = { ...state.active, endedAt: Date.now() };
            state.rides = [result, ...state.rides].slice(0, 10);
            state.active = null;
            state.finishes++;
            save();
            return { ride: result };
          }
          if (method === "delete") state.rides = state.rides.filter(item => item.id !== args.id);
          save();
          return JSON.parse(JSON.stringify(state));
        }
        throw new Error(`Unexpected bridge call ${plugin}.${method}`);
      },
      nativeCallback: (plugin, method, _options, callback) => {
        if (plugin === "PushNotifications") return "push-fixture";
        if (plugin === "OOSLocation" && method === "watchHeading") {
          const id = `compass-${Math.random()}`;
          compass.callbacks[id] = callback;
          callback({ heading: compass.heading });
          return id;
        }
        const id = `fixture-watch-${++location.started}`;
        location.watches.push(id);
        location.callbacks[id] = () => callback(plugin === "OOSLocation" ? { position: position() } : position());
        location.callbacks[id]();
        return id;
      },
    };
    function assertId(actual, expected) { if (!expected || actual !== expected) throw new Error("Wrong ride ID"); }
  }, { seeded });
  return aircraft;
}
