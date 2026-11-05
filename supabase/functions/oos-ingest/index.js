import process from "node:process";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/.pnpm/@capacitor+core@8.5.3/node_modules/@capacitor/core/dist/index.cjs.js
var require_index_cjs = __commonJS({
  "node_modules/.pnpm/@capacitor+core@8.5.3/node_modules/@capacitor/core/dist/index.cjs.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ExceptionCode = void 0;
    (function(ExceptionCode) {
      ExceptionCode["Unimplemented"] = "UNIMPLEMENTED";
      ExceptionCode["Unavailable"] = "UNAVAILABLE";
    })(exports.ExceptionCode || (exports.ExceptionCode = {}));
    var CapacitorException = class extends Error {
      constructor(message, code, data) {
        super(message);
        this.message = message;
        this.code = code;
        this.data = data;
      }
    };
    var getPlatformId = (win) => {
      var _a, _b;
      if (win === null || win === void 0 ? void 0 : win.androidBridge) {
        return "android";
      } else if ((_b = (_a = win === null || win === void 0 ? void 0 : win.webkit) === null || _a === void 0 ? void 0 : _a.messageHandlers) === null || _b === void 0 ? void 0 : _b.bridge) {
        return "ios";
      } else {
        return "web";
      }
    };
    var createCapacitor = (win) => {
      const capCustomPlatform = win.CapacitorCustomPlatform || null;
      const cap = win.Capacitor || {};
      const Plugins = cap.Plugins = cap.Plugins || {};
      const getPlatform = () => {
        return capCustomPlatform !== null ? capCustomPlatform.name : getPlatformId(win);
      };
      const isNativePlatform = () => getPlatform() !== "web";
      const isPluginAvailable = (pluginName) => {
        const plugin = registeredPlugins.get(pluginName);
        if (plugin === null || plugin === void 0 ? void 0 : plugin.platforms.has(getPlatform())) {
          return true;
        }
        if (getPluginHeader(pluginName)) {
          return true;
        }
        return false;
      };
      const getPluginHeader = (pluginName) => {
        var _a;
        return (_a = cap.PluginHeaders) === null || _a === void 0 ? void 0 : _a.find((h) => h.name === pluginName);
      };
      const handleError = (err) => win.console.error(err);
      const registeredPlugins = /* @__PURE__ */ new Map();
      const registerPlugin2 = (pluginName, jsImplementations = {}) => {
        const registeredPlugin = registeredPlugins.get(pluginName);
        if (registeredPlugin) {
          console.warn(`Capacitor plugin "${pluginName}" already registered. Cannot register plugins twice.`);
          return registeredPlugin.proxy;
        }
        const platform = getPlatform();
        const pluginHeader = getPluginHeader(pluginName);
        let jsImplementation;
        const loadPluginImplementation = async () => {
          if (!jsImplementation && platform in jsImplementations) {
            jsImplementation = typeof jsImplementations[platform] === "function" ? jsImplementation = await jsImplementations[platform]() : jsImplementation = jsImplementations[platform];
          } else if (capCustomPlatform !== null && !jsImplementation && "web" in jsImplementations) {
            jsImplementation = typeof jsImplementations["web"] === "function" ? jsImplementation = await jsImplementations["web"]() : jsImplementation = jsImplementations["web"];
          }
          return jsImplementation;
        };
        const createPluginMethod = (impl, prop) => {
          var _a, _b;
          if (pluginHeader) {
            const methodHeader = pluginHeader === null || pluginHeader === void 0 ? void 0 : pluginHeader.methods.find((m) => prop === m.name);
            if (methodHeader) {
              if (methodHeader.rtype === "promise") {
                return (options) => cap.nativePromise(pluginName, prop.toString(), options);
              } else {
                return (options, callback) => cap.nativeCallback(pluginName, prop.toString(), options, callback);
              }
            } else if (impl) {
              return (_a = impl[prop]) === null || _a === void 0 ? void 0 : _a.bind(impl);
            }
          } else if (impl) {
            return (_b = impl[prop]) === null || _b === void 0 ? void 0 : _b.bind(impl);
          } else {
            throw new CapacitorException(`"${pluginName}" plugin is not implemented on ${platform}`, exports.ExceptionCode.Unimplemented);
          }
        };
        const createPluginMethodWrapper = (prop) => {
          let remove;
          const wrapper = (...args) => {
            const p = loadPluginImplementation().then((impl) => {
              const fn = createPluginMethod(impl, prop);
              if (fn) {
                const p2 = fn(...args);
                remove = p2 === null || p2 === void 0 ? void 0 : p2.remove;
                return p2;
              } else {
                throw new CapacitorException(`"${pluginName}.${prop}()" is not implemented on ${platform}`, exports.ExceptionCode.Unimplemented);
              }
            });
            if (prop === "addListener") {
              p.remove = async () => remove();
            }
            return p;
          };
          wrapper.toString = () => `${prop.toString()}() { [capacitor code] }`;
          Object.defineProperty(wrapper, "name", {
            value: prop,
            writable: false,
            configurable: false
          });
          return wrapper;
        };
        const addListener = createPluginMethodWrapper("addListener");
        const removeListener = createPluginMethodWrapper("removeListener");
        const addListenerNative = (eventName, callback) => {
          const call = addListener({ eventName }, callback);
          const remove = async () => {
            const callbackId = await call;
            removeListener({
              eventName,
              callbackId
            }, callback);
          };
          const p = new Promise((resolve) => call.then(() => resolve({ remove })));
          p.remove = async () => {
            console.warn(`Using addListener() without 'await' is deprecated.`);
            await remove();
          };
          return p;
        };
        const proxy = new Proxy({}, {
          get(_, prop) {
            switch (prop) {
              // https://github.com/facebook/react/issues/20030
              case "$$typeof":
                return void 0;
              case "toJSON":
                return () => ({});
              case "addListener":
                return pluginHeader ? addListenerNative : addListener;
              case "removeListener":
                return removeListener;
              default:
                return createPluginMethodWrapper(prop);
            }
          }
        });
        Plugins[pluginName] = proxy;
        registeredPlugins.set(pluginName, {
          name: pluginName,
          proxy,
          platforms: /* @__PURE__ */ new Set([...Object.keys(jsImplementations), ...pluginHeader ? [platform] : []])
        });
        return proxy;
      };
      if (!cap.convertFileSrc) {
        cap.convertFileSrc = (filePath) => filePath;
      }
      cap.getPlatform = getPlatform;
      cap.handleError = handleError;
      cap.isNativePlatform = isNativePlatform;
      cap.isPluginAvailable = isPluginAvailable;
      cap.registerPlugin = registerPlugin2;
      cap.Exception = CapacitorException;
      cap.DEBUG = !!cap.DEBUG;
      cap.isLoggingEnabled = !!cap.isLoggingEnabled;
      return cap;
    };
    var initCapacitorGlobal = (win) => win.Capacitor = createCapacitor(win);
    var Capacitor2 = /* @__PURE__ */ initCapacitorGlobal(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
    var registerPlugin = Capacitor2.registerPlugin;
    var WebPlugin = class {
      constructor() {
        this.listeners = {};
        this.retainedEventArguments = {};
        this.windowListeners = {};
      }
      addListener(eventName, listenerFunc) {
        let firstListener = false;
        const listeners = this.listeners[eventName];
        if (!listeners) {
          this.listeners[eventName] = [];
          firstListener = true;
        }
        this.listeners[eventName].push(listenerFunc);
        const windowListener = this.windowListeners[eventName];
        if (windowListener && !windowListener.registered) {
          this.addWindowListener(windowListener);
        }
        if (firstListener) {
          this.sendRetainedArgumentsForEvent(eventName);
        }
        const remove = async () => this.removeListener(eventName, listenerFunc);
        const p = Promise.resolve({ remove });
        return p;
      }
      async removeAllListeners() {
        this.listeners = {};
        for (const listener in this.windowListeners) {
          this.removeWindowListener(this.windowListeners[listener]);
        }
        this.windowListeners = {};
      }
      notifyListeners(eventName, data, retainUntilConsumed) {
        const listeners = this.listeners[eventName];
        if (!listeners) {
          if (retainUntilConsumed) {
            let args = this.retainedEventArguments[eventName];
            if (!args) {
              args = [];
            }
            args.push(data);
            this.retainedEventArguments[eventName] = args;
          }
          return;
        }
        listeners.forEach((listener) => listener(data));
      }
      hasListeners(eventName) {
        var _a;
        return !!((_a = this.listeners[eventName]) === null || _a === void 0 ? void 0 : _a.length);
      }
      registerWindowListener(windowEventName, pluginEventName) {
        this.windowListeners[pluginEventName] = {
          registered: false,
          windowEventName,
          pluginEventName,
          handler: (event) => {
            this.notifyListeners(pluginEventName, event);
          }
        };
      }
      unimplemented(msg = "not implemented") {
        return new Capacitor2.Exception(msg, exports.ExceptionCode.Unimplemented);
      }
      unavailable(msg = "not available") {
        return new Capacitor2.Exception(msg, exports.ExceptionCode.Unavailable);
      }
      async removeListener(eventName, listenerFunc) {
        const listeners = this.listeners[eventName];
        if (!listeners) {
          return;
        }
        const index = listeners.indexOf(listenerFunc);
        if (index !== -1) {
          this.listeners[eventName].splice(index, 1);
        }
        if (!this.listeners[eventName].length) {
          this.removeWindowListener(this.windowListeners[eventName]);
        }
      }
      addWindowListener(handle) {
        window.addEventListener(handle.windowEventName, handle.handler);
        handle.registered = true;
      }
      removeWindowListener(handle) {
        if (!handle) {
          return;
        }
        window.removeEventListener(handle.windowEventName, handle.handler);
        handle.registered = false;
      }
      sendRetainedArgumentsForEvent(eventName) {
        const args = this.retainedEventArguments[eventName];
        if (!args) {
          return;
        }
        delete this.retainedEventArguments[eventName];
        args.forEach((arg) => {
          this.notifyListeners(eventName, arg);
        });
      }
    };
    var WebView = /* @__PURE__ */ registerPlugin("WebView");
    var encode = (str) => encodeURIComponent(str).replace(/%(2[346B]|5E|60|7C)/g, decodeURIComponent).replace(/[()]/g, escape);
    var decode = (str) => str.replace(/(%[\dA-F]{2})+/gi, decodeURIComponent);
    var CapacitorCookiesPluginWeb = class extends WebPlugin {
      async getCookies() {
        const cookies = document.cookie;
        const cookieMap = {};
        cookies.split(";").forEach((cookie) => {
          if (cookie.length <= 0)
            return;
          let [key, value] = cookie.replace(/=/, "CAP_COOKIE").split("CAP_COOKIE");
          key = decode(key).trim();
          value = decode(value).trim();
          cookieMap[key] = value;
        });
        return cookieMap;
      }
      async setCookie(options) {
        try {
          const encodedKey = encode(options.key);
          const encodedValue = encode(options.value);
          const expires = options.expires ? `; expires=${options.expires.replace("expires=", "")}` : "";
          const path = (options.path || "/").replace("path=", "");
          const domain = options.url != null && options.url.length > 0 ? `domain=${options.url}` : "";
          document.cookie = `${encodedKey}=${encodedValue || ""}${expires}; path=${path}; ${domain};`;
        } catch (error) {
          return Promise.reject(error);
        }
      }
      async deleteCookie(options) {
        try {
          document.cookie = `${options.key}=; Max-Age=0`;
        } catch (error) {
          return Promise.reject(error);
        }
      }
      async clearCookies() {
        try {
          const cookies = document.cookie.split(";") || [];
          for (const cookie of cookies) {
            document.cookie = cookie.replace(/^ +/, "").replace(/=.*/, `=;expires=${(/* @__PURE__ */ new Date()).toUTCString()};path=/`);
          }
        } catch (error) {
          return Promise.reject(error);
        }
      }
      async clearAllCookies() {
        try {
          await this.clearCookies();
        } catch (error) {
          return Promise.reject(error);
        }
      }
    };
    var CapacitorCookies = registerPlugin("CapacitorCookies", {
      web: () => new CapacitorCookiesPluginWeb()
    });
    var readBlobAsBase64 = async (blob) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result;
        resolve(base64String.indexOf(",") >= 0 ? base64String.split(",")[1] : base64String);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(blob);
    });
    var normalizeHttpHeaders = (headers = {}) => {
      const originalKeys = Object.keys(headers);
      const loweredKeys = Object.keys(headers).map((k) => k.toLocaleLowerCase());
      const normalized = loweredKeys.reduce((acc, key, index) => {
        acc[key] = headers[originalKeys[index]];
        return acc;
      }, {});
      return normalized;
    };
    var buildUrlParams = (params, shouldEncode = true) => {
      if (!params)
        return null;
      const output = Object.entries(params).reduce((accumulator, entry) => {
        const [key, value] = entry;
        let encodedValue;
        let item;
        if (Array.isArray(value)) {
          item = "";
          value.forEach((str) => {
            encodedValue = shouldEncode ? encodeURIComponent(str) : str;
            item += `${key}=${encodedValue}&`;
          });
          item.slice(0, -1);
        } else {
          encodedValue = shouldEncode ? encodeURIComponent(value) : value;
          item = `${key}=${encodedValue}`;
        }
        return `${accumulator}&${item}`;
      }, "");
      return output.substr(1);
    };
    var buildRequestInit = (options, extra = {}) => {
      const output = Object.assign({ method: options.method || "GET", headers: options.headers }, extra);
      const headers = normalizeHttpHeaders(options.headers);
      const type = headers["content-type"] || "";
      if (typeof options.data === "string") {
        output.body = options.data;
      } else if (type.includes("application/x-www-form-urlencoded")) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(options.data || {})) {
          params.set(key, value);
        }
        output.body = params.toString();
      } else if (type.includes("multipart/form-data") || options.data instanceof FormData) {
        const form = new FormData();
        if (options.data instanceof FormData) {
          options.data.forEach((value, key) => {
            form.append(key, value);
          });
        } else {
          for (const key of Object.keys(options.data)) {
            form.append(key, options.data[key]);
          }
        }
        output.body = form;
        const headers2 = new Headers(output.headers);
        headers2.delete("content-type");
        output.headers = headers2;
      } else if (type.includes("application/json") || typeof options.data === "object") {
        output.body = JSON.stringify(options.data);
      }
      return output;
    };
    var CapacitorHttpPluginWeb = class extends WebPlugin {
      /**
       * Perform an Http request given a set of options
       * @param options Options to build the HTTP request
       */
      async request(options) {
        const requestInit = buildRequestInit(options, options.webFetchExtra);
        const urlParams = buildUrlParams(options.params, options.shouldEncodeUrlParams);
        const url = urlParams ? `${options.url}?${urlParams}` : options.url;
        const response = await fetch(url, requestInit);
        const contentType = response.headers.get("content-type") || "";
        let { responseType = "text" } = response.ok ? options : {};
        if (contentType.includes("application/json")) {
          responseType = "json";
        }
        let data;
        let blob;
        switch (responseType) {
          case "arraybuffer":
          case "blob":
            blob = await response.blob();
            data = await readBlobAsBase64(blob);
            break;
          case "json":
            data = await response.json();
            break;
          case "document":
          case "text":
          default:
            data = await response.text();
        }
        const headers = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });
        return {
          data,
          headers,
          status: response.status,
          url: response.url
        };
      }
      /**
       * Perform an Http GET request given a set of options
       * @param options Options to build the HTTP request
       */
      async get(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "GET" }));
      }
      /**
       * Perform an Http POST request given a set of options
       * @param options Options to build the HTTP request
       */
      async post(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "POST" }));
      }
      /**
       * Perform an Http PUT request given a set of options
       * @param options Options to build the HTTP request
       */
      async put(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "PUT" }));
      }
      /**
       * Perform an Http PATCH request given a set of options
       * @param options Options to build the HTTP request
       */
      async patch(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "PATCH" }));
      }
      /**
       * Perform an Http DELETE request given a set of options
       * @param options Options to build the HTTP request
       */
      async delete(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "DELETE" }));
      }
    };
    var CapacitorHttp = registerPlugin("CapacitorHttp", {
      web: () => new CapacitorHttpPluginWeb()
    });
    exports.SystemBarsStyle = void 0;
    (function(SystemBarsStyle) {
      SystemBarsStyle["Dark"] = "DARK";
      SystemBarsStyle["Light"] = "LIGHT";
      SystemBarsStyle["Default"] = "DEFAULT";
    })(exports.SystemBarsStyle || (exports.SystemBarsStyle = {}));
    exports.SystemBarType = void 0;
    (function(SystemBarType) {
      SystemBarType["StatusBar"] = "StatusBar";
      SystemBarType["NavigationBar"] = "NavigationBar";
    })(exports.SystemBarType || (exports.SystemBarType = {}));
    var SystemBarsPluginWeb = class extends WebPlugin {
      async setStyle() {
        this.unavailable("not available for web");
      }
      async setAnimation() {
        this.unavailable("not available for web");
      }
      async show() {
        this.unavailable("not available for web");
      }
      async hide() {
        this.unavailable("not available for web");
      }
    };
    var SystemBars = registerPlugin("SystemBars", {
      web: () => new SystemBarsPluginWeb()
    });
    exports.Capacitor = Capacitor2;
    exports.CapacitorCookies = CapacitorCookies;
    exports.CapacitorException = CapacitorException;
    exports.CapacitorHttp = CapacitorHttp;
    exports.SystemBars = SystemBars;
    exports.WebPlugin = WebPlugin;
    exports.WebView = WebView;
    exports.buildRequestInit = buildRequestInit;
    exports.registerPlugin = registerPlugin;
  }
});

// node_modules/.pnpm/@capacitor+preferences@8.0.1_@capacitor+core@8.5.3/node_modules/@capacitor/preferences/dist/plugin.cjs.js
var require_plugin_cjs = __commonJS({
  "node_modules/.pnpm/@capacitor+preferences@8.0.1_@capacitor+core@8.5.3/node_modules/@capacitor/preferences/dist/plugin.cjs.js"(exports) {
    "use strict";
    var core = require_index_cjs();
    var Preferences2 = core.registerPlugin("Preferences", {
      web: () => Promise.resolve().then(function() {
        return web;
      }).then((m) => new m.PreferencesWeb())
    });
    var PreferencesWeb = class extends core.WebPlugin {
      constructor() {
        super(...arguments);
        this.group = "CapacitorStorage";
      }
      async configure({ group }) {
        if (typeof group === "string") {
          this.group = group;
        }
      }
      async get(options) {
        const value = this.impl.getItem(this.applyPrefix(options.key));
        return { value };
      }
      async set(options) {
        this.impl.setItem(this.applyPrefix(options.key), options.value);
      }
      async remove(options) {
        this.impl.removeItem(this.applyPrefix(options.key));
      }
      async keys() {
        const keys = this.rawKeys().map((k) => k.substring(this.prefix.length));
        return { keys };
      }
      async clear() {
        for (const key of this.rawKeys()) {
          this.impl.removeItem(key);
        }
      }
      async migrate() {
        var _a;
        const migrated = [];
        const existing = [];
        const oldprefix = "_cap_";
        const keys = Object.keys(this.impl).filter((k) => k.indexOf(oldprefix) === 0);
        for (const oldkey of keys) {
          const key = oldkey.substring(oldprefix.length);
          const value = (_a = this.impl.getItem(oldkey)) !== null && _a !== void 0 ? _a : "";
          const { value: currentValue } = await this.get({ key });
          if (typeof currentValue === "string") {
            existing.push(key);
          } else {
            await this.set({ key, value });
            migrated.push(key);
          }
        }
        return { migrated, existing };
      }
      async removeOld() {
        const oldprefix = "_cap_";
        const keys = Object.keys(this.impl).filter((k) => k.indexOf(oldprefix) === 0);
        for (const oldkey of keys) {
          this.impl.removeItem(oldkey);
        }
      }
      get impl() {
        return window.localStorage;
      }
      get prefix() {
        return this.group === "NativeStorage" ? "" : `${this.group}.`;
      }
      rawKeys() {
        return Object.keys(this.impl).filter((k) => k.indexOf(this.prefix) === 0);
      }
      applyPrefix(key) {
        return this.prefix + key;
      }
    };
    var web = /* @__PURE__ */ Object.freeze({
      __proto__: null,
      PreferencesWeb
    });
    exports.Preferences = Preferences2;
  }
});

// lib/device-preferences.ts
var import_core = __toESM(require_index_cjs());
var import_preferences = __toESM(require_plugin_cjs());

// lib/app-states.ts
var ALL_STATES = [
  { id: "alabama", code: "AL", label: "Alabama", centerLat: 32.8, centerLon: -86.8 },
  { id: "alaska", code: "AK", label: "Alaska", centerLat: 64.2, centerLon: -152 },
  { id: "arizona", code: "AZ", label: "Arizona", centerLat: 34.3, centerLon: -111.7 },
  { id: "arkansas", code: "AR", label: "Arkansas", centerLat: 34.9, centerLon: -92.4 },
  { id: "california", code: "CA", label: "California", centerLat: 37.2, centerLon: -119.7 },
  { id: "colorado", code: "CO", label: "Colorado", centerLat: 39, centerLon: -105.5 },
  { id: "connecticut", code: "CT", label: "Connecticut", centerLat: 41.6, centerLon: -72.7 },
  { id: "delaware", code: "DE", label: "Delaware", centerLat: 39, centerLon: -75.5 },
  { id: "florida", code: "FL", label: "Florida", centerLat: 28.1, centerLon: -82.1 },
  { id: "georgia", code: "GA", label: "Georgia", centerLat: 32.6, centerLon: -83.4 },
  { id: "hawaii", code: "HI", label: "Hawaii", centerLat: 20.8, centerLon: -156.3 },
  { id: "idaho", code: "ID", label: "Idaho", centerLat: 44.2, centerLon: -114.5 },
  { id: "illinois", code: "IL", label: "Illinois", centerLat: 40, centerLon: -89.2 },
  { id: "indiana", code: "IN", label: "Indiana", centerLat: 39.9, centerLon: -86.3 },
  { id: "iowa", code: "IA", label: "Iowa", centerLat: 42, centerLon: -93.5 },
  { id: "kansas", code: "KS", label: "Kansas", centerLat: 38.5, centerLon: -98.3 },
  { id: "kentucky", code: "KY", label: "Kentucky", centerLat: 37.5, centerLon: -85.3 },
  { id: "louisiana", code: "LA", label: "Louisiana", centerLat: 31, centerLon: -92 },
  { id: "maine", code: "ME", label: "Maine", centerLat: 45.3, centerLon: -69 },
  { id: "maryland", code: "MD", label: "Maryland", centerLat: 39, centerLon: -76.7 },
  { id: "massachusetts", code: "MA", label: "Massachusetts", centerLat: 42.2, centerLon: -71.8 },
  { id: "michigan", code: "MI", label: "Michigan", centerLat: 44.3, centerLon: -85.6 },
  { id: "minnesota", code: "MN", label: "Minnesota", centerLat: 46, centerLon: -94.5 },
  { id: "mississippi", code: "MS", label: "Mississippi", centerLat: 32.7, centerLon: -89.7 },
  { id: "missouri", code: "MO", label: "Missouri", centerLat: 38.5, centerLon: -92.5 },
  { id: "montana", code: "MT", label: "Montana", centerLat: 47, centerLon: -109.6 },
  { id: "nebraska", code: "NE", label: "Nebraska", centerLat: 41.5, centerLon: -99.8 },
  { id: "nevada", code: "NV", label: "Nevada", centerLat: 39.3, centerLon: -116.6 },
  { id: "new-hampshire", code: "NH", label: "New Hampshire", centerLat: 43.8, centerLon: -71.6 },
  { id: "new-jersey", code: "NJ", label: "New Jersey", centerLat: 40.1, centerLon: -74.7 },
  { id: "new-mexico", code: "NM", label: "New Mexico", centerLat: 34.5, centerLon: -106 },
  { id: "new-york", code: "NY", label: "New York", centerLat: 42.9, centerLon: -75.5 },
  { id: "north-carolina", code: "NC", label: "North Carolina", centerLat: 35.6, centerLon: -79.8 },
  { id: "north-dakota", code: "ND", label: "North Dakota", centerLat: 47.5, centerLon: -100.5 },
  { id: "ohio", code: "OH", label: "Ohio", centerLat: 40.2, centerLon: -82.8 },
  { id: "oklahoma", code: "OK", label: "Oklahoma", centerLat: 35.6, centerLon: -97.5 },
  { id: "oregon", code: "OR", label: "Oregon", centerLat: 44, centerLon: -120.6 },
  { id: "pennsylvania", code: "PA", label: "Pennsylvania", centerLat: 40.9, centerLon: -77.8 },
  { id: "rhode-island", code: "RI", label: "Rhode Island", centerLat: 41.7, centerLon: -71.5 },
  { id: "south-carolina", code: "SC", label: "South Carolina", centerLat: 33.8, centerLon: -80.9 },
  { id: "south-dakota", code: "SD", label: "South Dakota", centerLat: 44.4, centerLon: -100.2 },
  { id: "tennessee", code: "TN", label: "Tennessee", centerLat: 35.8, centerLon: -86.4 },
  { id: "texas", code: "TX", label: "Texas", centerLat: 31, centerLon: -99 },
  { id: "utah", code: "UT", label: "Utah", centerLat: 39.3, centerLon: -111.7 },
  { id: "vermont", code: "VT", label: "Vermont", centerLat: 44, centerLon: -72.7 },
  { id: "virginia", code: "VA", label: "Virginia", centerLat: 37.5, centerLon: -79 },
  { id: "washington", code: "WA", label: "Washington", centerLat: 47.4, centerLon: -120.8 },
  { id: "west-virginia", code: "WV", label: "West Virginia", centerLat: 38.6, centerLon: -80.6 },
  { id: "wisconsin", code: "WI", label: "Wisconsin", centerLat: 44.6, centerLon: -89.8 },
  { id: "wyoming", code: "WY", label: "Wyoming", centerLat: 43, centerLon: -107.6 }
];
var APP_STATES = ALL_STATES.filter((state) => state.code === "WA" || state.code === "CA" || state.code === "TX");
var SUPPORTED_STATE_CODES = APP_STATES.map((state) => state.code);
var DEFAULT_STATE_CODE = "WA";
function isSupportedStateCode(value) {
  return typeof value === "string" && APP_STATES.some((state) => state.code === value.toUpperCase());
}
function getAppState(value) {
  const normalized = value?.trim();
  return ALL_STATES.find(
    (state) => state.id === normalized || state.code === normalized?.toUpperCase()
  ) ?? ALL_STATES.find((state) => state.code === DEFAULT_STATE_CODE);
}
function stateCodeForId(id) {
  return getAppState(id).code;
}

// cloud-backend/src/runtime.ts
var runtime = globalThis.Deno;
Object.assign(globalThis, { Netlify: { env: runtime.env } });
var json = (body, status = 200) => Response.json(body, {
  status,
  headers: { "Cache-Control": "no-store" }
});

// lib/supabase/server.ts
import { createClient } from "npm:@supabase/supabase-js@2.110.9";
var client = null;
function withNoStore(init) {
  return { ...init, cache: "no-store" };
}
var supabaseFetch = (input, init) => fetch(input, withNoStore(init));
function isSupabaseConfigured() {
  return Boolean(
    readServerEnv("SUPABASE_URL") && readServerEnv("SUPABASE_SERVICE_ROLE_KEY")
  );
}
function getSupabaseAdmin() {
  if (client) return client;
  const url = readServerEnv("SUPABASE_URL");
  const serviceRoleKey = readServerEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  client = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      // Next.js extends server-side fetch with a persistent data cache. The
      // Supabase client performs reads through fetch, so opt every database
      // request out explicitly; otherwise current aircraft rows can remain
      // frozen even while the ingestion worker continues writing positions.
      fetch: supabaseFetch,
      headers: {
        "X-Client-Info": "out-of-sight-netlify"
      }
    }
  });
  return client;
}
function readServerEnv(name) {
  const netlify = globalThis.Netlify;
  return netlify?.env?.get(name) ?? process.env[name];
}

// lib/faa-public-safety-aircraft.ts
var FAA_PUBLIC_SAFETY_AIRCRAFT_ROWS = [
  ["california", "N10CX", "A002A3", "Cessna 206H", "Alameda County Sheriff's Office (Livermore)", "87 gal", "161 ktas", "~4 hr 45 min", 285],
  ["california", "N911AC", "AC9A65", "Bell 505", "Alameda County Sheriff's Office (Oakland)", "84.85 gal standard / 104.85 gal with aux", "133 kt", "~4 hr 30 min with aux", 270],
  ["california", "N488BC", "A6066D", "Bell 206B", "Butte County Sheriff's Office (Oroville)", "91 gal", "120 kt", "~3 hr 00 min", 180],
  ["california", "N263HP", "A28ADF", "Cessna 208 Caravan", "California Highway Patrol (McClellan)", "332 gal", "185 ktas", "~5 hr 20 min", 320],
  ["california", "N911CA", "AC9A95", "Beechcraft King Air B300", "California Highway Patrol (Sacramento)", "539 gal", "312 ktas", "~5 hr 30 min", 330],
  ["california", "N918CA", "ACB496", "Beechcraft King Air B200", "California Highway Patrol (Sacramento)", "544 gal", "270 ktas", "~5 hr 00 min", 300],
  ["california", "N710PD", "A97D56", "Bell 505", "Chino Police Department (Chino)", "84.85 gal standard / 104.85 gal with aux", "133 kt", "~4 hr 30 min with aux", 270],
  ["california", "N520PD", "A68A37", "MD Helicopters 500N", "City Of Glendale Police Department / City Of Burbank Police Department (Glendale)", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["california", "N30NT", "A31E37", "Airbus AS350B3 / H125", "City Of Ontario / Police Department Air Support Unit (Ontario)", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N60NT", "A7C624", "Airbus AS350B3 / H125", "City Of Ontario / Police Department Air Support Unit (Ontario)", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N8NF", "AADE5D", "Bell 206B", "City Of Pasadena / Police Department (Pasadena)", "91 gal", "120 kt", "~3 hr 00 min", 180],
  ["california", "N501RM", "A63F2A", "McDonnell Douglas 369E", "City Of Pasadena / Police Department-Aviation Section (Pasadena)", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["california", "N911RP", "AC9BE7", "Airbus AS350B3 / H125", "City Of Riverside / Police - Aviation Unit (Riverside)", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N951RP", "AD39E3", "Airbus AS350B3 / H125", "City Of Riverside / Police Aviation Unit (Riverside)", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N19600", "A180E6", "Cessna 172 Skyhawk", "Corona Police Aero Squadron Inc (Calimesa)", "53 gal total / 50 gal usable", "124 kt", "~5 hr 00 min", 300],
  ["california", "N487HB", "A6034B", "Airbus AS350B3 / H125", "County Of Butte / A Political Subdivision Of The State Of California Through The Butte County Sheriff's Office (Oroville)", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N3972G", "A49F6F", "Cessna 206H", "County Of Merced Sheriff'S Department (Merced)", "87 gal", "161 ktas", "~4 hr 45 min", 285],
  ["california", "N992SD", "ADDBA5", "Airbus AS350B3 / H125", "County Of Riverside / Riverside Sheriff's Aviation Unit (Hemet)", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N288JK", "A2EC85", "Eurocopter EC120B", "County Of Sacramento / Sacramento Co Sheriff'S Department (Mather)", "110 gal", "125 kt", "~4 hr 32 min", 272],
  ["california", "N805SL", "AAF60B", "Cessna 182 Skylane", "County Of San Luis Obispo Sheriff's Office (San Luis Obispo)", "92 gal", "~145 kt", "~5 hr 30 min", 330],
  ["california", "N408SD", "A4CBED", "Eurocopter EC120B", "County Of Santa Clara / Office Of The Sheriff Air Support Unit (San Jose)", "110 gal", "125 kt", "~4 hr 32 min", 272],
  ["california", "N412VC", "A4DD6C", "Bell 412EP", "County Of Ventura Sheriff's Office (Camarillo)", "331 gal standard", "126 kt", "~3 hr 48 min", 228],
  ["california", "N708PD", "A9738F", "Airbus AS350B3 / H125", "East Bay Regional Park District / Police Air Support Unit (Livermore)", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N530EC", "A6B0D4", "Airbus AS350B3 / H125", "El Dorado County Sheriff's Office (Placerville)", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N923SD", "ACCAE3", "Cessna T206H", "Fresno County Sheriff's Department / Air Support Unit (Fresno)", "87 gal", "161 ktas", "~4 hr 45 min", 285],
  ["california", "N97E", "AD81B0", "Cessna T210", "Kern County Sheriff's Department (Bakersfield)", "90 gal", "~205 kt", "~5 hr 00 min", 300],
  ["california", "N9658X", "AD723F", "Cessna 182 Skylane", "Kings County Sheriff's Department (Hanford)", "92 gal", "~145 kt", "~5 hr 30 min", 330],
  ["california", "N299DR", "A31744", "McDonnell Douglas 369E", "Kings County Sheriff's Office (Hanford)", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["california", "N299KC", "A317CD", "Cessna T206H", "Kings County Sheriff'S Office (Hanford)", "87 gal", "161 ktas", "~4 hr 45 min", 285],
  ["california", "N950MB", "AD35BC", "Beechcraft King Air B200", "Los Angeles County Sheriff's Department (Long Beach)", "544 gal", "270 ktas", "~5 hr 00 min", 300],
  ["california", "N80NT", "AAE0C2", "Eurocopter AS350B2", "Los Angeles Interagency Metropolitan Police (Commerce)", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N851EM", "ABAB7F", "Beechcraft King Air B200", "Los Angeles Police Department / Air Support Division (Los Angeles)", "544 gal", "270 ktas", "~5 hr 00 min", 300],
  ["california", "N21844", "A1DA3B", "Bell 412EP", "Los Angeles Police Department Air Support Division (Los Angeles)", "331 gal standard", "126 kt", "~3 hr 48 min", 228],
  ["california", "N668PD", "A8D33A", "Eurocopter AS350B2", "Los Angeles Police Department Air Support Division (Los Angeles)", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N98708", "ADC79E", "Cessna 172 Skyhawk", "Madera County Sheriff's Office (Madera)", "53 gal total / 50 gal usable", "124 kt", "~5 hr 00 min", 300],
  ["california", "N759BU", "AA3BA4", "Cessna 182 Skylane", "Marin County Sheriff's Office (San Rafael)", "92 gal", "~145 kt", "~5 hr 30 min", 330],
  ["california", "N7527G", "AA24CB", "Robinson R44 II", "Merced County Sheriff's Office (Merced)", "49 gal", "117 kt", "~3 hr 00 min", 180],
  ["california", "N911SS", "AC9C03", "Bell UH-1H", "Merced County Sheriff's Office (Merced)", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["california", "N209PD", "A1B4BB", "GippsAero GA8 TC-320", "Modesto Police Department (Modesto)", "~87.7 gal", "~130 kt", "~8 hr 12 min", 492],
  ["california", "N90TF", "AC6E82", "Cessna 206H", "Monterey County Sheriff's Office (Salinas)", "87 gal", "161 ktas", "~4 hr 45 min", 285],
  ["california", "N505HB", "A64D34", "Bell 505", "Office Of The Sheriff (Oroville)", "84.85 gal standard / 104.85 gal with aux", "133 kt", "~4 hr 30 min with aux", 270],
  ["california", "N239PS", "A22B45", "Bell OH-58A", "Pasadena Police Department (Altadena)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["california", "N854RJ", "ABB7B4", "Bell OH-58A", "Pasadena Police Department (Altadena)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["california", "N224KB", "A1F0C0", "Bell OH-58A", "Pasadena Police Department (Pasadena)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["california", "N1851A", "A155BB", "Piper PA-31", "Placer County Sheriff's Department (Auburn)", "182 gal", "~190 kt", "~5 hr 00 min", 300],
  ["california", "N52393", "A697C2", "Cessna 182 Skylane", "Riverside County Sheriff's Department (Hemet)", "92 gal", "~145 kt", "~5 hr 30 min", 330],
  ["california", "N996RS", "ADEA75", "Airbus AS350B3 / H125", "Riverside County Sheriff's Department (Hemet)", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N40SB", "A4ABDA", "Beechcraft King Air B200", "San Bernadino County Sheriff's Office (San Bernardino)", "544 gal", "270 ktas", "~5 hr 00 min", 300],
  ["california", "N306SB", "A3372E", "Bell 412EP", "San Bernardiino County Sheriff's Department (San Bernardino)", "331 gal standard", "126 kt", "~3 hr 48 min", 228],
  ["california", "N548PW", "A6F6FE", "Diamond DA62", "San Joaquin County Sheriff's Office (French Camp)", "89 gal", "171 kt", "~6 hr 00 min", 360],
  ["california", "N51HF", "A65FCB", "Cessna 206H", "San Mateo County Sheriff'S Office (Redwood City)", "87 gal", "161 ktas", "~4 hr 45 min", 285],
  ["california", "N1850W", "A155AC", "Bell OH-58A", "Santa Barbara County Sheriff's Department (Santa Barbara)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["california", "N4911S", "A6165B", "Bell OH-58A", "Santa Barbara County Sheriff's Department (Santa Barbara)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["california", "N911HN", "AC9B1E", "Bell HH-1H", "Santa Barbara County Sheriff's Department (Santa Barbara)", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["california", "N911KP", "AC9B51", "Bell UH-1H", "Santa Barbara Sheriff's Department (Santa Barbara)", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["california", "N5525U", "A709F3", "Cessna 206H", "Sheriff's Department (Oakland)", "87 gal", "161 ktas", "~4 hr 45 min", 285],
  ["california", "N206LW", "A1A95C", "Bell 206L", "Stanislaus County Sheriff's Department (Modesto)", "98-111 gal", "110 kt", "~3 hr 00 min", 180],
  ["california", "N3501R", "A3E758", "Cessna 206H", "Stanislaus County Sheriff's Department (Modesto)", "87 gal", "161 ktas", "~4 hr 45 min", 285],
  ["california", "N737TJ", "A9E6BE", "Cessna 172 Skyhawk", "Stanislaus County Sheriff's Department (Modesto)", "53 gal total / 50 gal usable", "124 kt", "~5 hr 00 min", 300],
  ["california", "N911NN", "AC9B9B", "Bell UH-1H", "Tehama County Sheriff'S Office (Red Bluff)", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["california", "N7125E", "A98687", "Cessna 182 Skylane", "Trinity County Sheriff's Department (Weaverville)", "92 gal", "~145 kt", "~5 hr 30 min", 330],
  ["california", "N705JW", "A967FE", "Cessna T206H", "Tulare County Sheriff (Visalia)", "87 gal", "161 ktas", "~4 hr 45 min", 285],
  ["california", "N24HP", "A22E63", "Cessna 182 Skylane", "Yolo County/Yolo County Sheriff's Office (Woodland)", "92 gal", "~145 kt", "~5 hr 30 min", 330],
  ["florida", "N112EG", "A0340C", "Bell OH-58A", "Alachua County Sheriff's Office (Gainesville)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N167AC", "A10BB2", "Bell OH-58A", "Alachua County Sheriff's Office (Gainesville)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N284AC", "A2DCDA", "Bell OH-58A", "Alachua County Sheriff's Office (Gainesville)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N533WB", "A6BD88", "Bell OH-58A", "Bay County Sheriff'S Department (Panama City)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N82778", "AB4E4A", "Bell OH-58A", "Bay County Sheriff's Office (Panama City)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N113PD", "A038A1", "Bell OH-58A", "Brevard County Sheriff Office (Merritt Island)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N679SD", "A8FEBB", "Bell UH-1H", "Brevard County Sheriff Office (Merritt Island)", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["florida", "N911JU", "AC9B3D", "Bell OH-58A", "Brevard County Sheriff's Department (Merritt Island)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N110FC", "A02CB3", "Bell OH-58A", "Brevard County Sheriff's Office (Merritt Island)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N295HS", "A308CD", "Bell OH-58A", "Brevard County Sheriff's Office (Merritt Island)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N569SS", "A749FA", "Bell UH-1H", "Brevard County Sheriff's Office (Merritt Island)", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["florida", "N911DJ", "AC9AB6", "Bell OH-58A", "Brevard County Sheriff's Office (Merritt Island)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N911PW", "AC9BBC", "Bell OH-58A", "Brevard County Sheriff's Office (Merritt Island)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N533QC", "A6BCF3", "Bell OH-58A", "Calhoun County Sheriff's Office (Blountstown)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N533SC", "A6BD25", "Bell OH-58A", "Calhoun County Sheriff's Office (Blountstown)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N7248F", "A9B5DE", "Bell OH-58A", "Calhoun County Sheriff's Office (Blountstown)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N64586", "A87B5D", "Bell UH-1H", "Charlotte County Sheriff's Office (Punta Gorda)", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["florida", "N911NQ", "AC9B9D", "Airbus AS350B3 / H125", "Charlotte County Sheriff's Office (Punta Gorda)", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N151PR", "A0CF3B", "Bell OH-58A", "Citrus County Sheriff's Office (Inverness)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N286JW", "A2E522", "Bell OH-58A", "Citrus County Sheriff's Office (Inverness)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N673AL", "A8E6E8", "Bell OH-58A", "Citrus County Sheriff'S Office (Inverness)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N503PH", "A64662", "Eurocopter AS350B2", "City Of Miami Police Department (Miami)", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["florida", "N411TP", "A4D98E", "Bell 407", "City Of Tampa Police Department (Tampa)", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["florida", "N610TP", "A7F075", "Bell 206L", "City Of Tampa Police Department (Tampa)", "98-111 gal", "110 kt", "~3 hr 00 min", 180],
  ["florida", "N158LE", "A0E8E6", "Bell OH-58A", "Collier County Sheriff's Office (Naples)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N205LE", "A1A595", "Bell UH-1H", "Collier County Sheriff's Office (Naples)", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["florida", "N258LE", "A27635", "Bell OH-58A", "Collier County Sheriff's Office (Naples)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N529LE", "A6AB5C", "Bell 429", "Collier County Sheriff's Office (Naples)", "~215 gal", "150 kt", "~3 hr 30 min", 210],
  ["florida", "N82LE", "AB2F81", "Cessna 182 Skylane", "Collier County Sheriff's Office (Naples)", "92 gal", "~145 kt", "~5 hr 30 min", 330],
  ["florida", "N611FC", "A7F2F5", "Bell 505", "Flagler County Sheriff's Office (Bunnell)", "84.85 gal standard / 104.85 gal with aux", "133 kt", "~4 hr 30 min with aux", 270],
  ["florida", "N252ED", "A25F54", "Bell TH-57", "Florida Department Of Law Enforcement (Tallahassee)", "~91 gal", "120 kt", "~3 hr 00 min", 180],
  ["florida", "N943FL", "AD18D5", "Cessna Citation Latitude 680A", "Florida Department Of Law Enforcement (Tallahassee)", "~1,700 gal", "446 kt", "~4 hr 00 min", 240],
  ["florida", "N960FL", "AD5CAE", "Bell TH-57", "Florida Department Of Law Enforcement (Tallahassee)", "~91 gal", "120 kt", "~3 hr 00 min", 180],
  ["florida", "N970FL", "AD842D", "Bell TH-57", "Florida Department Of Law Enforcement (Tallahassee)", "~91 gal", "120 kt", "~3 hr 00 min", 180],
  ["florida", "N109HP", "A026E0", "Cessna 208B", "Florida Highway Patrol (Tampa)", "332 gal", "185 ktas", "~5 hr 20 min", 320],
  ["florida", "N268HP", "A29D72", "Cessna T206H", "Florida Highway Patrol (Tampa)", "87 gal", "161 ktas", "~4 hr 45 min", 285],
  ["florida", "N504HP", "A64989", "Pilatus PC-12", "Florida Highway Patrol (Tampa)", "2,704 lb / ~402 gal", "290 ktas", "~7 hr 00 min", 420],
  ["florida", "N63097", "A8416F", "Bell OH-58A", "Hernando County Sheriff (Brooksville)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N623HC", "A82214", "Bell OH-58A", "Hernando County Sheriff's Office (Brooksville)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N720SR", "A9A52C", "Bell OH-58A", "Indian River County Sheriff's Office (Vero Beach)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N813RR", "AB1608", "Bell 206B", "Indian River County Sheriff's Office (Vero Beach)", "91 gal", "120 kt", "~3 hr 00 min", 180],
  ["florida", "N911UD", "AC9C28", "Bell 206B", "Indian River County Sheriff'S Office (Vero Beach)", "91 gal", "120 kt", "~3 hr 00 min", 180],
  ["florida", "N325JC", "A381AE", "Bell OH-58A", "Jackson County Sheriff's Department (Marianna)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N525JC", "A69C4C", "Bell OH-58A", "Jackson County Sheriff's Department (Marianna)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N425JC", "A50EFD", "Bell OH-58A", "Jackson County Sheriff's Office (Marianna)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N14SD", "A0A1EB", "Bell UH-1H", "Lake County Sheriff's Office (Tavares)", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["florida", "N213LC", "A1C5A4", "Bell OH-58A", "Lake County Sheriff's Office (Tavares)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N214LC", "A1C95B", "Bell OH-58A", "Lake County Sheriff's Office (Tavares)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N215LC", "A1CD12", "Bell OH-58A", "Lake County Sheriff's Office (Tavares)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N308LC", "A33E07", "Bell 206B", "Leon County Sheriff's Office (Tallahassee)", "91 gal", "120 kt", "~3 hr 00 min", 180],
  ["florida", "N762LC", "AA49F3", "Bell 206B", "Leon County Sheriff's Office (Tallahassee)", "91 gal", "120 kt", "~3 hr 00 min", 180],
  ["florida", "N605MC", "A7DAE8", "Bell 505", "Manatee County Sheriff's Office (Bradenton)", "84.85 gal standard / 104.85 gal with aux", "133 kt", "~4 hr 30 min with aux", 270],
  ["florida", "N911KV", "AC9B57", "Bell 407", "Marion County Sheriff Office (Ocala)", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["florida", "N911MG", "AC9B7C", "Bell OH-58A", "Marion County Sheriff's Department (Ocala)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N87461", "AC0876", "Cessna 310R", "Marion County Sheriff's Office (Ocala)", "163 gal", "205 kt", "~4 hr 30 min", 270],
  ["florida", "N911AF", "AC9A68", "Bell 206B", "Marion County Sheriff's Office (Ocala)", "91 gal", "120 kt", "~3 hr 00 min", 180],
  ["florida", "N911BA", "AC9A7C", "Bell 407", "Marion County Sheriff's Office (Ocala)", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["florida", "N800MC", "AAE2F3", "Bell OH-58A", "Martin County Sheriff's Department (Stuart)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N258RC", "A276B0", "Bell OH-58A", "Martin County Sheriff's Office (Stuart)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N814MC", "AB194E", "Airbus AS350B3 / H125", "Martin County Sheriff's Office (Stuart)", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N901JB", "AC73AD", "Airbus AS350B3 / H125", "Martin County Sheriff's Office (Stuart)", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N911WS", "AC9C67", "Bell OH-58A", "Martin County Sheriff's Office (Stuart)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N306MP", "A336BD", "Airbus AS350B3 / H125", "Miami-Dade Sheriff's Office (Doral)", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N307MP", "A33A74", "Airbus AS350B3 / H125", "Miami-Dade Sheriff's Office (Doral)", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N308MP", "A33E2B", "Airbus AS350B3 / H125", "Miami-Dade Sheriff's Office (Doral)", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N309MP", "A341E2", "Airbus AS350B3 / H125", "Miami-Dade Sheriff's Office (Doral)", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N304MP", "A32F4F", "Airbus AS350B3 / H125", "Miami-Dade Sheriff'S Office (Doral)", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N305MP", "A33306", "Airbus AS350B3 / H125", "Miami-Dade Sheriff'S Office (Doral)", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N402MP", "A4B530", "Cessna 206H", "Miami-Dade Sheriff'S Office (Doral)", "87 gal", "161 ktas", "~4 hr 45 min", 285],
  ["florida", "N982TS", "ADB44C", "Sikorsky S-76C", "Monroe County Sheriff's Office (Key West)", "~281 gal", "155 kt", "~3 hr 30 min", 210],
  ["florida", "N74AW", "A9F046", "Beechcraft King Air B200", "Monroe County Sheriff'S Office (Key West)", "544 gal", "270 ktas", "~5 hr 00 min", 300],
  ["florida", "N1148Z", "A03E97", "Bell OH-58A", "Osceola County Sheriff's Office (Kissimmee)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N212FL", "A1C178", "Bell OH-58A", "Osceola County Sheriff's Office (Kissimmee)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N218BH", "A1D75B", "Bell 407", "Osceola County Sheriff's Office (Kissimmee)", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["florida", "N219BH", "A1DB12", "Bell 407", "Osceola County Sheriff's Office (Kissimmee)", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["florida", "N319RB", "A369B9", "Beechcraft King Air B200", "Palm Beach County Sheriff's Department (West Palm Beach)", "544 gal", "270 ktas", "~5 hr 00 min", 300],
  ["florida", "N158DB", "A0E834", "Bell 429", "Palm Beach County Sheriff's Office (West Palm Beach)", "~215 gal", "150 kt", "~3 hr 30 min", 210],
  ["florida", "N526RB", "A6A0B1", "Bell 429", "Palm Beach County Sheriff's Office (West Palm Beach)", "~215 gal", "150 kt", "~3 hr 30 min", 210],
  ["florida", "N795RB", "AACC11", "Bell 429", "Palm Beach County Sheriff's Office (West Palm Beach)", "~215 gal", "150 kt", "~3 hr 30 min", 210],
  ["florida", "N282MP", "A2D68A", "Bell OH-58A", "Pasco County Sheriff's Office (New Port Richey)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N284MP", "A2DDF8", "Bell OH-58A", "Pasco County Sheriff's Office (New Port Richey)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N316LC", "A35E18", "Bell OH-58A", "Pasco County Sheriff's Office (New Port Richey)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N319LC", "A3693D", "Bell OH-58A", "Pasco County Sheriff's Office (New Port Richey)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N205FW", "A1A528", "Bell UH-1H", "Pasco Sheriff's Office (New Port Richey)", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["florida", "N317CN", "A36111", "Bell UH-1H", "Pasco Sheriff's Office (New Port Richey)", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["florida", "N801DS", "AAE5F0", "Bell 407", "Pasco Sheriff's Office (New Port Richey)", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["florida", "N803DS", "AAED5E", "Bell 407", "Pasco Sheriff's Office (New Port Richey)", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["florida", "N211SL", "A1BED4", "Robinson R66", "Polk County Sheriff's Office (Winter Haven)", "74 gal", "120 kt", "~3 hr 30 min", 210],
  ["florida", "N911GJ", "AC9B01", "Robinson R66", "Polk County Sheriff's Office (Winter Haven)", "74 gal", "120 kt", "~3 hr 30 min", 210],
  ["florida", "N911WJ", "AC9C5F", "Robinson R66", "Polk County Sheriff's Office (Winter Haven)", "74 gal", "120 kt", "~3 hr 30 min", 210],
  ["florida", "N972GJ", "AD8BB2", "Cessna 182 Skylane", "Polk County Sheriff's Office (Winter Haven)", "92 gal", "~145 kt", "~5 hr 30 min", 330],
  ["florida", "N537P", "A6CBB3", "Bell OH-58A", "Putnam County Sheriff's Office (Palatka)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N91EC", "AC94B9", "Bell OH-58A", "Putnam County Sheriff's Office (Palatka)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N2891", "A2F1E5", "Bell 429", "Sarasota County Sheriff's Office (Sarasota)", "~215 gal", "150 kt", "~3 hr 30 min", 210],
  ["florida", "N407FL", "A4C72A", "Bell 407", "Sarasota County Sheriff's Office (Sarasota)", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["florida", "N1028S", "A00FA3", "Bell 407", "St Johns County Sheriff's Office (Saint Augustine)", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["florida", "N911SL", "AC9BFD", "Bell OH-58A", "St Lucie County Sheriff's Department (Fort Pierce)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N911AH", "AC9A6A", "Bell OH-58A", "St Lucie County Sheriff's Office (Fort Pierce)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N911SY", "AC9C09", "Bell OH-58A", "St Lucie County Sheriff's Office (Fort Pierce)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N911BD", "AC9A7F", "Bell OH-58A", "Sumter County Sheriff's Office (Wildwood)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["ohio", "N699BC", "A94C41", "Bell OH-58A", "Butler County Sheriff (Hamilton)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["ohio", "N766CP", "AA5812", "Cessna 172 Skyhawk", "City Of Cleveland / Division Of Police (Cleveland)", "53 gal total / 50 gal usable", "124 kt", "~5 hr 00 min", 300],
  ["ohio", "N65HP", "A88B1E", "GippsAero GA8 TC-320", "Ohio Department Of Public Safety (Columbus)", "~87.7 gal", "~130 kt", "~8 hr 12 min", 492],
  ["ohio", "N715HP", "A98F5D", "Cessna 182 Skylane", "Ohio Department Of Public Safety (Columbus)", "92 gal", "~145 kt", "~5 hr 30 min", 330],
  ["ohio", "N717HP", "A996CB", "Cessna 208B", "Ohio Department Of Public Safety (Columbus)", "332 gal", "185 ktas", "~5 hr 20 min", 320],
  ["ohio", "N910HP", "AC9768", "Cessna 182 Skylane", "State Of Ohio / Department Of Public Safety (Columbus)", "92 gal", "~145 kt", "~5 hr 30 min", 330],
  ["texas", "N65144", "A89372", "Bell OH-58A", "Canton Police Department (Canton)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["texas", "N2091R", "A1B5FD", "McDonnell Douglas 369E", "City Of El Paso Police Department (El Paso)", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["texas", "N813FK", "AB1508", "Bell 412EP", "Department Of Justice (Fort Worth)", "331 gal standard", "126 kt", "~3 hr 48 min", 228],
  ["texas", "N985MB", "ADBECC", "Bell 412EP", "Department Of Justice (Fort Worth)", "331 gal standard", "126 kt", "~3 hr 48 min", 228],
  ["texas", "N454TB", "A582A3", "Beechcraft King Air B300", "Department Of Public Safety Of The State Of Texas (Austin)", "539 gal", "312 ktas", "~5 hr 30 min", 330],
  ["texas", "N735TV", "A9DF5B", "Cessna 182 Skylane", "El Paso Police Department (El Paso)", "92 gal", "~145 kt", "~5 hr 30 min", 330],
  ["texas", "N218FB", "A1D7B9", "Bell OH-58A", "Fort Bend County Sheriff's Office (Richmond)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["texas", "N259FB", "A2796C", "Bell OH-58A", "Fort Bend County Sheriff's Office (Richmond)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["texas", "N556SD", "A71749", "Airbus AS350B3 / H125", "Harris County Sheriff's Office (Houston)", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["texas", "N11SD", "A02B6E", "Cirrus SR22", "Harris County Sheriff's Office (Spring)", "92 gal", "183 kt", "~5 hr 00 min", 300],
  ["texas", "N303SD", "A32C0B", "Cessna 182 Skylane", "Harris County Sheriff'S Office (Spring)", "92 gal", "~145 kt", "~5 hr 30 min", 330],
  ["texas", "N7492F", "AA169D", "Schweizer 269C", "Houston Police Department / Air Support Div (Houston)", "~41 gal", "95 kt", "~3 hr 30 min", 210],
  ["texas", "N7493F", "AA16C0", "Schweizer 269C", "Houston Police Department / Air Support Div (Houston)", "~41 gal", "95 kt", "~3 hr 30 min", 210],
  ["texas", "N8700F", "ABF8B4", "Schweizer 269C", "Houston Police Department / Air Support Division (Houston)", "~41 gal", "95 kt", "~3 hr 30 min", 210],
  ["texas", "N909K", "AC917C", "Bell OH-58A", "Jefferson County Sheriff Department (Beaumont)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["texas", "N600SD", "A7C8D3", "Bell UH-1H", "Jefferson County Sheriff's Office (Beaumont)", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["texas", "N601SD", "A7CC8A", "Mitsubishi MU-2B", "Jefferson County Sheriff's Office (Beaumont)", "~384 gal", "~283 kt", "~4 hr 30 min", 270],
  ["texas", "N681SD", "A90882", "Beechcraft King Air C90A", "Jefferson County Sheriff's Office (Beaumont)", "544 gal", "270 ktas", "~5 hr 00 min", 300],
  ["texas", "N602SD", "A7D041", "Bell 407", "Jefferson County Sheriff'S Office (Beaumont)", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["texas", "N9240N", "ACCF6B", "Bell OH-58A", "Mc Lennan County Sheriff's Department (Waco)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["texas", "N9240P", "ACCF6C", "Bell OH-58A", "Mclennan County Sheriff'S Department (Waco)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["texas", "N9240D", "ACCF62", "Bell OH-58A", "Mclennan County Sheriff's Office (Waco)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["texas", "N191TX", "A16DA1", "Airbus AS350B3 / H125", "Texas Department Of Public Safety (Austin)", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["texas", "N215TX", "A1CDD4", "Cessna 208 Caravan", "Texas Department Of Public Safety (Austin)", "332 gal", "185 ktas", "~5 hr 20 min", 320],
  ["texas", "N556TX", "A71774", "Airbus AS350B3 / H125", "Texas Department Of Public Safety (Austin)", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["texas", "N829CK", "AB5286", "Beechcraft King Air B300", "US Department Of Justice (Fort Worth)", "539 gal", "312 ktas", "~5 hr 30 min", 330],
  ["texas", "N959TL", "AD57CA", "Bell 412EP", "US Department Of Justice (Fort Worth)", "331 gal standard", "126 kt", "~3 hr 48 min", 228],
  ["texas", "N993MG", "ADDEE2", "Bell 412EP", "US Department Of Justice (Ft Worth)", "331 gal standard", "126 kt", "~3 hr 48 min", 228],
  ["texas", "N255BP", "A26A38", "Bell OH-58A", "Victoria County Sheriff (Victoria)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["washington", "N911YC", "AC9C8B", "Bell OH-58A", "Chelan County Sheriff's Office (Wenatchee)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["washington", "N912YC", "ACA042", "Bell OH-58A", "Chelan County Sheriff's Office (Wenatchee)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["washington", "N7561N", "AA32DB", "Cessna T206H", "Pierce County Sheriff's Department (South Hill)", "87 gal", "161 ktas", "~4 hr 45 min", 285],
  ["washington", "N500EV", "A63A68", "McDonnell Douglas 369E", "Snohomish County Sheriff (Snohomish)", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["washington", "N13SD", "A07A6C", "McDonnell Douglas 369E", "Snohomish County Sheriff's Office (Snohomish)", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["washington", "N608SD", "A7E68B", "Bell UH-1H", "Snohomish County Sheriff's Office (Snohomish)", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["washington", "N215SC", "A1CDA8", "Bell OH-58A", "Spokane County Sheriff's Office (Spokane)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["washington", "N509JS", "A65C38", "Bell UH-1H", "Spokane County Sheriff's Office (Spokane)", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["washington", "N509SC", "A65CF2", "Bell OH-58A", "Spokane County Sheriff's Office (Spokane)", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["washington", "N646JS", "A87C5E", "Cessna T206H", "Washington State Patrol (Olympia)", "87 gal", "161 ktas", "~4 hr 45 min", 285],
  ["washington", "N823EG", "AB3C6B", "Cessna T206H", "Washington State Patrol (Olympia)", "87 gal", "161 ktas", "~4 hr 45 min", 285],
  // Second-pass FAA government-owner cross-check. These rows are registered
  // only to a city/county/state owner in FAA data, but public agency pages,
  // FAA owner detail pages, or current aircraft-photo/tracking records tie
  // them to law-enforcement air units.
  ["california", "N326PD", "A385E3", "Eurocopter AS350B2", "Anaheim Police Department Air Support Unit (Fullerton)", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N508BH", "A657C9", "Cessna 208B", "Anaheim Police Department Air Support Unit (Fullerton)", "332 gal", "185 ktas", "~5 hr 20 min", 320],
  ["california", "N826PD", "AB486E", "Eurocopter AS350B2", "Anaheim Police Department Air Support Unit (Fullerton)", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N103CG", "A01012", "MD Helicopters 500N", "Burbank / Glendale Police Joint Air Support Unit (Burbank)", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["california", "N275BP", "A2B936", "Eurocopter AS350B1", "Burbank / Glendale Police Joint Air Support Unit (Burbank)", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N818PD", "AB285D", "Airbus AS350B3 / H125", "Burbank / Glendale Police Joint Air Support Unit (Glendale)", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N681HB", "A9079F", "MD Helicopters 369FF / MD 530F", "Huntington Beach Police Department Air Support Unit", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["california", "N682HB", "A90B56", "MD Helicopters 369FF / MD 530F", "Huntington Beach Police Department Air Support Unit", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["california", "N683HB", "A90F0D", "MD Helicopters 369FF / MD 530F", "Huntington Beach Police Department Air Support Unit", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["california", "N229LA", "A2036B", "Eurocopter AS350B2", "Los Angeles Police Department / LAPD Air Support Division", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N108PP", "A023BF", "McDonnell Douglas 369E", "Pomona Police Department", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["california", "N199PD", "A18AE3", "Cessna R172K", "Sacramento Police Department Air Operations Unit", "52 gal", "122 kt", "~4 hr 30 min", 270],
  ["california", "N279PD", "A2C934", "Bell 505", "Sacramento Police Department Air Operations Unit", "84.85 gal standard / 104.85 gal with aux", "133 kt", "~4 hr 30 min with aux", 270],
  ["california", "N916PD", "ACAE3E", "Bell OH-58A", "Sacramento Police Department Air Operations Unit", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["california", "N916SP", "ACAE93", "Bell OH-58A", "Sacramento Police Department Air Operations Unit", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["california", "N184SD", "A1511C", "Eurocopter AS350B2", "Orange County Sheriff's Department / Air Support Bureau", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N993SD", "ADDF5C", "Airbus AS350B3 / H125", "Riverside County Sheriff's Department Aviation Unit", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N994SD", "ADE313", "Airbus AS350B3 / H125", "Riverside County Sheriff's Department Aviation Unit", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N995RC", "ADE6B0", "Airbus H145 / BK117 D-2", "Riverside County Sheriff's Department Aviation Unit", "242 gal / 1,649 lb", "143 kt", "~3 hr 35 min", 215],
  ["california", "N997SD", "ADEE38", "Airbus AS350B3 / H125", "Riverside County Sheriff's Department Aviation Unit", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N998SD", "ADF1EF", "Airbus AS350B3 / H125", "Riverside County Sheriff's Department Aviation Unit", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N107BZ", "A01EE6", "Bell 205A-1", "San Diego County Sheriff's Department / ASTREA", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["california", "N449RC", "A56D86", "Bell 205A-1", "San Diego County Sheriff's Department / ASTREA", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["california", "N450TP", "A573D3", "Cessna T206H", "San Joaquin County Sheriff's Office", "87 gal", "161 ktas", "~4 hr 45 min", 285],
  ["california", "N206SB", "A1A9DF", "Cessna 206H", "Santa Barbara County Sheriff's Office", "87 gal", "161 ktas", "~4 hr 45 min", 285],
  ["california", "N108SC", "A023FF", "Bell 407", "Sonoma County Sheriff's Office / Henry 1", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["florida", "N512TP", "A66A94", "Bell 407", "Tampa Police Department", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["texas", "N137AH", "A0953A", "Airbus AS350B3 / H125", "Dallas Police Department Air One", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["texas", "N1510L", "A0D049", "Bell 206B", "Dallas Police Department Air One", "91 gal", "120 kt", "~3 hr 00 min", 180],
  ["texas", "N1511L", "A0D06C", "Bell 206B", "Dallas Police Department Air One", "91 gal", "120 kt", "~3 hr 00 min", 180],
  ["texas", "N716DP", "A992B0", "Bell 407", "Dallas Police Department Air One", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["texas", "N5277F", "A6A642", "McDonnell Douglas 369E", "Houston Police Department Air Support Division", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["texas", "N5278F", "A6A665", "McDonnell Douglas 369E", "Houston Police Department Air Support Division", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["texas", "N5279F", "A6A688", "McDonnell Douglas 369E", "Houston Police Department Air Support Division", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["texas", "N5280F", "A6A904", "McDonnell Douglas 369E", "Houston Police Department Air Support Division", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["texas", "N5284F", "A6A990", "McDonnell Douglas 369E", "Houston Police Department Air Support Division", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["texas", "N7050F", "A9697F", "GippsAero GA8", "Houston Police Department Air Support Division", "~87.7 gal", "~130 kt", "~8 hr 12 min", 492],
  ["texas", "N382BM", "A462DD", "Airbus AS350B3 / H125", "San Antonio Police Department Helicopter Detail", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["texas", "N582RD", "A77ED1", "Airbus AS350B3 / H125", "San Antonio Police Department Helicopter Detail", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["texas", "N1603M", "A0F47B", "Airbus AS350B3 / H125", "San Antonio Police Department Helicopter Detail", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["texas", "N520DT", "A6894B", "Eurocopter EC120B", "San Antonio Police Department Helicopter Detail", "110 gal", "125 kt", "~4 hr 32 min", 272]
];

// lib/national-aircraft-data.ts
var NATIONAL_AIRCRAFT_REGISTRY_DATE = "2026-09-04";
var NATIONAL_AIRCRAFT_ROWS = [
  ["alabama", "N7514K", "AA20AE", "Bell OH-58C", "Al Etowah Co Sheriff Department", "Gadsden", "Helicopter", "Bell OH-58A"],
  ["alabama", "N1263S", "A06CCE", "Cessna 182P", "Alabama Law Enforcement Agency", "Montgomery", "Plane", "Cessna 182 Skylane"],
  ["alabama", "N1363S", "A0944D", "Cessna 182P", "Alabama Law Enforcement Agency", "Montgomery", "Plane", "Cessna 182 Skylane"],
  ["alabama", "N154SA", "A0DA9C", "Bell OH-58A", "Alabama Law Enforcement Agency", "Montgomery", "Helicopter", "Bell OH-58A"],
  ["alabama", "N155SA", "A0DE53", "Bell OH-58A", "Alabama Law Enforcement Agency", "Montgomery", "Helicopter", "Bell OH-58A"],
  ["alabama", "N157SA", "A0E5C1", "Bell OH-58A", "Alabama Law Enforcement Agency", "Montgomery", "Helicopter", "Bell OH-58A"],
  ["alabama", "N158SA", "A0E978", "Bell OH-58A", "Alabama Law Enforcement Agency", "Montgomery", "Helicopter", "Bell OH-58A"],
  ["alabama", "N159SA", "A0ED2F", "Bell OH-58A", "Alabama Law Enforcement Agency", "Montgomery", "Helicopter", "Bell OH-58A"],
  ["alabama", "N160SA", "A0F33F", "Bell OH-58A", "Alabama Law Enforcement Agency", "Montgomery", "Helicopter", "Bell OH-58A"],
  ["alabama", "N171SA", "A11E75", "Bell OH-58A", "Alabama Law Enforcement Agency", "Montgomery", "Helicopter", "Bell OH-58A"],
  ["alabama", "N173SA", "A125E3", "Bell OH-58", "Alabama Law Enforcement Agency", "Montgomery", "Helicopter", "Bell OH-58A"],
  ["alabama", "N182CU", "A1485F", "Cessna 182P", "Alabama Law Enforcement Agency", "Montgomery", "Plane", "Cessna 182 Skylane"],
  ["alabama", "N225LH", "A1F496", "Beechcraft C-12C", "Alabama Law Enforcement Agency", "Montgomery", "Plane", null],
  ["alabama", "N3173H", "A3639B", "Bell 206L-1", "Alabama Law Enforcement Agency", "Montgomery", "Helicopter", "Bell 206L"],
  ["alabama", "N407SA", "A4C833", "Bell 407", "Alabama Law Enforcement Agency", "Montgomery", "Helicopter", "Bell 407"],
  ["alabama", "N512SA", "A66A6E", "Bell UH-1H", "Alabama Law Enforcement Agency", "Montgomery", "Helicopter", "Bell UH-1H"],
  ["alabama", "N52437", "A69AAB", "Piper PA-31-310", "Alabama Law Enforement Agency", "Montgomery", "Plane", "Piper PA-31"],
  ["alabama", "N369LE", "A42EBA", "Hughes OH-6A", "City Of Oxford Alabama Police Department", "Oxford", "Helicopter", null],
  ["alabama", "N199CC", "A189CF", "Bell OH-58C", "Coffee County Sheriff Office", "New Brockton", "Helicopter", "Bell OH-58A"],
  ["alabama", "N198CC", "A18618", "Bell OH-58C", "Coffee County Sheriffs Office", "New Brockton", "Helicopter", "Bell OH-58A"],
  ["alabama", "N250CP", "A257BE", "Bell OH-58A", "Cullman Police Department", "Cullman", "Helicopter", "Bell OH-58A"],
  ["alabama", "N262SD", "A287FF", "Hughes 369A", "Cullman Police Department", "Cullman", "Helicopter", null],
  ["alabama", "N278KC", "A2C518", "Hughes 369A", "Cullman Police Department", "Cullman", "Helicopter", null],
  ["alabama", "N930PD", "ACE6F2", "Bell OH-58", "Cullman Police Department", "Cullman", "Helicopter", "Bell OH-58A"],
  ["alabama", "N262LE", "A2876A", "Bell OH-58", "Dale Co Sheriffs Department", "Ozark", "Helicopter", "Bell OH-58A"],
  ["alabama", "N263LE", "A28B21", "Bell OH-58C", "Dale County Sheriff's Office", "Ozark", "Helicopter", "Bell OH-58A"],
  ["alabama", "N108SP", "A0240A", "Cessna 182M", "Dale County Sheriffs Office", "Ozark", "Plane", "Cessna 182 Skylane"],
  ["alabama", "N1903A", "A16AED", "Bell 407", "Dale County Sheriffs Office", "Ozark", "Helicopter", "Bell 407"],
  ["alabama", "N262AL", "A28676", "Cessna R182", "Dale County Sheriffs Office", "Ozark", "Plane", null],
  ["alabama", "N264LE", "A28ED8", "Bell OH-58A", "Dale County Sheriffs Office", "Ozark", "Helicopter", "Bell OH-58A"],
  ["alabama", "N268DC", "A29D03", "Bell OH-58A", "Dale County Sheriffs Office", "Ozark", "Helicopter", "Bell OH-58A"],
  ["alabama", "N2998S", "A31A6A", "Bell OH-58A", "Dale County Sheriffs Office", "Ozark", "Helicopter", "Bell OH-58A"],
  ["alabama", "N5203F", "A68BB5", "Cessna 172F", "Dale County Sheriffs Office", "Ozark", "Plane", "Cessna 172 Skyhawk"],
  ["alabama", "N630JT", "A83E96", "Bell OH-58C", "Dale County Sheriffs Office", "Ozark", "Helicopter", "Bell OH-58A"],
  ["alabama", "N510MN", "A6628F", "Bell OH-58A", "Dekalb County Sheriffs Office", "Fort Payne", "Helicopter", "Bell OH-58A"],
  ["alabama", "N632TC", "A846D6", "Bell OH-58C", "Etowah County Sheriffs Office", "Gadsden", "Helicopter", "Bell OH-58A"],
  ["alabama", "N991EC", "ADD6C1", "Bell TH-57", "Etowah County Sheriffs Office", "Gadsden", "Helicopter", "Bell TH-57"],
  ["alabama", "N992EC", "ADDA78", "Bell TH-57", "Etowah County Sheriffs Office", "Gadsden", "Helicopter", "Bell TH-57"],
  ["alabama", "N371HC", "A43834", "Bell OH-58C", "Henry County Sheriff's Office", "Abbeville", "Helicopter", "Bell OH-58A"],
  ["alabama", "N373HC", "A43FA2", "Bell OH-58C", "Henry County Sheriffs Office", "Abbeville", "Helicopter", "Bell OH-58A"],
  ["alabama", "N1084X", "A02566", "Bell 206B", "Jefferson County Sheriffs Office", "Birmingham", "Helicopter", "Bell 206B"],
  ["alabama", "N402JC", "A4B4DA", "Airbus AS 350 B3", "Jefferson County Sheriffs Office", "Birmingham", "Helicopter", "Airbus AS350B3 / H125"],
  ["alabama", "N243LC", "A23C21", "Bell OH-58A", "Limestone County Sheriff Department", "Athens", "Helicopter", "Bell OH-58A"],
  ["alabama", "N244LC", "A23FD8", "Bell OH-58C", "Limestone County Sheriff Department", "Athens", "Helicopter", "Bell OH-58A"],
  ["alabama", "N3971Y", "A49F5C", "Cessna 210D", "Limestone County Sheriff Department", "Athens", "Plane", null],
  ["alabama", "N100DE", "A00504", "Bell OH-58A", "Marshall County Sheriff Department", "Guntersville", "Helicopter", "Bell OH-58A"],
  ["alabama", "N45DE", "A57013", "Bell OH-58A", "Marshall County Sheriff Department", "Guntersville", "Helicopter", "Bell OH-58A"],
  ["alabama", "N530X", "A6B27A", "MD Helicopters 369FF", "Oxford Police Department", "Oxford", "Helicopter", "MD Helicopters 369FF / MD 530F"],
  ["alabama", "N535X", "A6C50D", "Hughes 369A", "Oxford Police Department", "Oxford", "Helicopter", null],
  ["alabama", "N501JS", "A63E80", "Bell 206B", "Shelby County Sheriffs Office", "Columbiana", "Helicopter", "Bell 206B"],
  ["alabama", "N581AL", "A779AA", "Bell OH-58C", "Shelby County Sheriffs Office", "Columbiana", "Helicopter", "Bell OH-58A"],
  ["alabama", "N581SC", "A77B32", "Bell 206B", "Shelby County Sheriffs Office", "Columbiana", "Helicopter", "Bell 206B"],
  ["alabama", "N180SC", "A1423F", "Bell OH-58", "St Clair County Sheriffs Department", "Pell City", "Helicopter", "Bell OH-58A"],
  ["alabama", "N264SC", "A28F6C", "Bell OH-58", "St Clair County Sheriffs Department", "Pell City", "Helicopter", "Bell OH-58A"],
  ["alabama", "N631TC", "A8431F", "Bell OH-58", "Tuscaloosa Police Department", "Tuscaloosa", "Helicopter", "Bell OH-58A"],
  ["alabama", "N297GR", "A31021", "Bell OH-58C", "Walker County Sheriff Department", "Jasper", "Helicopter", "Bell OH-58A"],
  ["alabama", "N298GR", "A313D8", "Bell OH-58C", "Walker County Sheriff Department", "Jasper", "Helicopter", "Bell OH-58A"],
  ["alabama", "N299GR", "A3178F", "Bell OH-58C", "Walker County Sheriff Department", "Jasper", "Helicopter", "Bell OH-58A"],
  ["alaska", "N246CC", "A2467E", "Cessna U206G", "Alaska Department Of Public Safety", "Anchorage", "Plane", null],
  ["alaska", "N5582C", "A71FC4", "Piper PA-18-150", "Alaska Department Of Public Safety", "Anchorage", "Plane", null],
  ["alaska", "N9380N", "AD05C6", "Cessna A185F", "Alaska Department Of Public Safety", "Anchorage", "Plane", null],
  ["alaska", "N9452N", "AD2266", "Cessna A185F", "Alaska Department Of Public Safety", "Anchorage", "Plane", null],
  ["alaska", "N1867", "A15A43", "Beechcraft B300", "Alaska Department of Public Safety", "Anchorage", "Plane", "Beechcraft King Air B300"],
  ["alaska", "N911AA", "AC9A63", "Airbus AS350B3", "Alaska Department of Public Safety", "Anchorage", "Helicopter", "Airbus AS350B3 / H125"],
  ["alaska", "N911NT", "AC9BA0", "Airbus AS350B3", "Alaska Department of Public Safety", "Anchorage", "Helicopter", "Airbus AS350B3 / H125"],
  ["alaska", "N1086B", "A02598", "Robinson R44 II", "State Of Alaska / Department Of Public Safety", "Anchorage", "Helicopter", "Robinson R44 II"],
  ["alaska", "N1323Y", "A08577", "Cessna 208", "State Of Alaska / Department Of Public Safety", "Anchorage", "Plane", "Cessna 208 Caravan"],
  ["alaska", "N2400S", "A23268", "Piper PA-18-150", "State Of Alaska / Department Of Public Safety", "Anchorage", "Plane", null],
  ["alaska", "N326CL", "A384D7", "Robinson R44 II", "State Of Alaska / Department Of Public Safety", "Anchorage", "Helicopter", "Robinson R44 II"],
  ["alaska", "N4151T", "A4E940", "Piper PA-18-150", "State Of Alaska / Department Of Public Safety", "Anchorage", "Plane", null],
  ["alaska", "N5461X", "A6F0C7", "Cessna U206G", "State Of Alaska / Department Of Public Safety", "Anchorage", "Plane", null],
  ["alaska", "N54741", "A6F4EB", "Piper PA-18-150", "State Of Alaska / Department Of Public Safety", "Anchorage", "Plane", null],
  ["alaska", "N607TC", "A7E2EC", "Cessna 208", "State Of Alaska / Department Of Public Safety", "Anchorage", "Plane", "Cessna 208 Caravan"],
  ["alaska", "N7046", "A96694", "Alaska Department Of Public Safety PA-18 150", "State Of Alaska / Department Of Public Safety", "Anchorage", "Plane", null],
  ["alaska", "N7049", "A966FD", "Piper PA-18-150", "State Of Alaska / Department Of Public Safety", "Anchorage", "Plane", null],
  ["alaska", "N7051", "A9699C", "Piper PA-18-150", "State Of Alaska / Department Of Public Safety", "Anchorage", "Plane", null],
  ["alaska", "N7054", "A96A05", "Piper PA-18-150", "State Of Alaska / Department Of Public Safety", "Anchorage", "Plane", null],
  ["alaska", "N7055", "A96A28", "Piper PA-18", "State Of Alaska / Department Of Public Safety", "Anchorage", "Plane", null],
  ["alaska", "N7056", "A96A4B", "Piper PA-18", "State Of Alaska / Department Of Public Safety", "Anchorage", "Plane", null],
  ["alaska", "N70713", "A97126", "Cessna A185E", "State Of Alaska / Department Of Public Safety", "Anchorage", "Plane", null],
  ["alaska", "N70714", "A97127", "Piper PA-18-150", "State Of Alaska / Department Of Public Safety", "Anchorage", "Plane", null],
  ["alaska", "N70715", "A97128", "Cessna 208", "State Of Alaska / Department Of Public Safety", "Anchorage", "Plane", "Cessna 208 Caravan"],
  ["alaska", "N7085", "A9754D", "Piper PA-18-150", "State Of Alaska / Department Of Public Safety", "Anchorage", "Plane", null],
  ["alaska", "N714NK", "A98C1F", "Cessna A185F", "State Of Alaska / Department Of Public Safety", "Anchorage", "Plane", null],
  ["alaska", "N7183C", "A99C89", "Robinson R44", "State Of Alaska / Department Of Public Safety", "Anchorage", "Helicopter", null],
  ["alaska", "N7196H", "A9A0AE", "Robinson R44", "State Of Alaska / Department Of Public Safety", "Anchorage", "Helicopter", null],
  ["alaska", "N82732", "AB4DB8", "Piper PA-18-150", "State Of Alaska / Department Of Public Safety", "Anchorage", "Plane", null],
  ["alaska", "N82735", "AB4DBB", "Piper PA-18-150", "State Of Alaska / Department Of Public Safety", "Anchorage", "Plane", null],
  ["alaska", "N82736", "AB4DBC", "Piper PA-18-150", "State Of Alaska / Department Of Public Safety", "Anchorage", "Plane", null],
  ["alaska", "N88AK", "AC1B86", "Piper PA-18-150", "State Of Alaska / Department Of Public Safety", "Anchorage", "Plane", null],
  ["alaska", "N981AK", "ADAEE5", "Cessna TU206G", "State Of Alaska / Department Of Public Safety", "Anchorage", "Plane", null],
  ["alaska", "N145PL", "A0B693", "Cessna U206G", "State Of Alaska / Department Of Public Safety  Acft Section", "Anchorage", "Plane", null],
  ["alaska", "N20786", "A1AF93", "Cessna A185F", "State Of Alaska / Department Of Public Safety A/C", "Anchorage", "Plane", null],
  ["alaska", "N1386A", "A09C14", "Piper PA-18-125", "State Of Alaska / Department Of Public Safety Alaska Wildlife Troopers", "Anchorage", "Plane", null],
  ["alaska", "N7041", "A965E5", "Piper PA-18-150", "State Of Alaska / Department Pub Safety Acft Sec", "Anchorage", "Plane", null],
  ["alaska", "N7052", "A969BF", "Piper PA-18-150", "State Of Alaska / Department Pub Safety Acft Sec", "Anchorage", "Plane", null],
  ["alaska", "N1092C", "A028C4", "Robinson R44 II", "State Of Alaska Department Of Public Safety", "Anchorage", "Helicopter", "Robinson R44 II"],
  ["alaska", "N273S", "A2B331", "Robinson R44 II", "State Of Alaska Department Of Public Safety", "Anchorage", "Helicopter", "Robinson R44 II"],
  ["alaska", "N275F", "A2B98C", "Cessna U206G", "State Of Alaska Department Of Public Safety", "Anchorage", "Plane", null],
  ["alaska", "N7059", "A96AB4", "Piper PA-18-150", "State Of Alaska Department Of Public Safety", "Anchorage", "Plane", null],
  ["alaska", "N7326S", "A9D5B4", "Cessna 182P", "State Of Alaska Department Of Public Safety", "Anchorage", "Plane", "Cessna 182 Skylane"],
  ["alaska", "N90322", "AC7D0A", "Cessna 206H", "State Of Alaska Department Of Public Safety", "Anchorage", "Plane", "Cessna 206H"],
  ["alaska", "N907ST", "AC8ACF", "Piper PA-18-150", "State Of Alaska Department Of Public Safety", "Anchorage", "Plane", null],
  ["arizona", "N822AZ", "AB3861", "Bell 429", "Arizona Department Of Public Safety", "Phoenix", "Helicopter", "Bell 429"],
  ["arizona", "N921AZ", "ACC1F9", "Beechcraft B200", "Arizona Department Of Public Safety", "Phoenix", "Plane", "Beechcraft King Air B200"],
  ["arizona", "N683MN", "A90F7C", "Airbus EC 130 T2", "Arizona Law Enforcement Air Support", "Sierra Vista", "Helicopter", null],
  ["arizona", "N505MP", "A64DA4", "MD Helicopters 369FF", "City Of Mesa Police Department", "Mesa", "Helicopter", "MD Helicopters 369FF / MD 530F"],
  ["arizona", "N304PD", "A32F77", "Bell 206B", "City Of Tucson Police Department", "Tucson", "Helicopter", "Bell 206B"],
  ["arizona", "N306PD", "A336E5", "Bell 206B", "City Of Tucson Police Department", "Tucson", "Helicopter", "Bell 206B"],
  ["arizona", "N155AZ", "A0DCDA", "Cessna 182Q", "Coconino County Sheriffs Office", "Flagstaff", "Plane", "Cessna 182 Skylane"],
  ["arizona", "N117FT", "A046C3", "Bell OH-58C", "La Paz Co Sheriffs Department", "Parker", "Helicopter", "Bell OH-58A"],
  ["arizona", "N812LE", "AB11C9", "Bell 429", "Maricopa County Sheriff's Office Aviation Unit", "Phoenix", "Helicopter", "Bell 429"],
  ["arizona", "N977MS", "AD9ECA", "Bell 407", "Maricopa County Sheriff's Office Aviation Unit", "Phoenix", "Helicopter", "Bell 407"],
  ["arizona", "N1423W", "A0ACF4", "Cessna T206H", "Maricopa County Sheriffs Office", "Phoenix", "Plane", "Cessna T206H"],
  ["arizona", "N756HQ", "AA3111", "Cessna U206G", "Maricopa County Sheriffs Office", "Phoenix", "Plane", null],
  ["arizona", "N507MP", "A65512", "MD Helicopters 369FF", "Mesa Police Department", "Mesa", "Helicopter", "MD Helicopters 369FF / MD 530F"],
  ["arizona", "N42WB", "A4FB3C", "Cessna P210N", "Mesa Police Department Air Support Unit", "Mesa", "Plane", null],
  ["arizona", "N506MP", "A6515B", "MD Helicopters 369E", "Mesa Police Department Air Support Unit", "Mesa", "Helicopter", "McDonnell Douglas 369E"],
  ["arizona", "N86AW", "ABCC93", "Cessna 414A", "Mohave County Sheriff's Office", "Kingman", "Plane", null],
  ["arizona", "N359FB", "A406BB", "Airbus AS350B3", "Phoenix Police Department", "Phoenix", "Helicopter", "Airbus AS350B3 / H125"],
  ["arizona", "N109FB", "A026A2", "Leonardo A109E", "Phoenix Police Department Air Support Unit", "Phoenix", "Helicopter", null],
  ["arizona", "N620FB", "A816BC", "Pilatus PC-12/47E", "Phoenix Police Department Air Support Unit", "Phoenix", "Plane", "Pilatus PC-12"],
  ["arizona", "N621FB", "A81A73", "Airbus AS350B3", "Phoenix Police Department Air Support Unit", "Phoenix", "Helicopter", "Airbus AS350B3 / H125"],
  ["arizona", "N622FB", "A81E2A", "Airbus AS350B3", "Phoenix Police Department Air Support Unit", "Phoenix", "Helicopter", "Airbus AS350B3 / H125"],
  ["arizona", "N623FB", "A821E1", "Airbus AS350B3", "Phoenix Police Department Air Support Unit", "Phoenix", "Helicopter", "Airbus AS350B3 / H125"],
  ["arizona", "N624FB", "A82598", "Airbus AS350B3", "Phoenix Police Department Air Support Unit", "Phoenix", "Helicopter", "Airbus AS350B3 / H125"],
  ["arizona", "N625FB", "A8294F", "Airbus AS350B3", "Phoenix Police Department Air Support Unit", "Phoenix", "Helicopter", "Airbus AS350B3 / H125"],
  ["arizona", "N630FB", "A83E3B", "Pilatus PC-12/47E", "Phoenix Police Department Air Support Unit", "Phoenix", "Plane", "Pilatus PC-12"],
  ["arizona", "N671AZ", "A8DF87", "Cessna 208", "Pima County Board Of Supervisors / Pima County Sheriffs Department", "Tucson", "Plane", "Cessna 208 Caravan"],
  ["arizona", "N672AZ", "A8E33E", "Cessna 208", "Pima County Board Of Supervisors / Pima County Sheriffs Department", "Tucson", "Plane", "Cessna 208 Caravan"],
  ["arizona", "N1865S", "A15A0E", "Cessna 310R", "Pima County Board Of Supervisors / Sheriffs Department Air Unit", "Tucson", "Plane", "Cessna 310R"],
  ["arizona", "N599SD", "A7C06A", "Airbus AS350B3", "Pima County Sheriffs Department", "Tucson", "Helicopter", "Airbus AS350B3 / H125"],
  ["arizona", "N110SD", "A02DC7", "Bell UH-1V", "Pinal County Sheriff Department", "Florence", "Helicopter", null],
  ["arizona", "N118SD", "A04B7F", "Bell OH-58", "Pinal County Sheriffs Office", "Florence", "Helicopter", "Bell OH-58A"],
  ["arizona", "N259BW", "A2791B", "Cessna T206H", "Pinal County Sheriffs Office", "Florence", "Plane", "Cessna T206H"],
  ["arizona", "N925AZ", "ACD0D5", "Bell OH-58C", "Pinal County Sheriffs Office", "Florence", "Helicopter", "Bell OH-58A"],
  ["arizona", "N911AZ", "AC9A7A", "Bell 429", "State Of Arizona / Arizona Department Of Public Safety", "Phoenix", "Helicopter", "Bell 429"],
  ["arizona", "N58AZ", "A773A7", "Bell 407", "State Of Arizona / Department Of Public Safety", "Phoenix", "Helicopter", "Bell 407"],
  ["arizona", "N56AZ", "A724A9", "Bell 407", "State Of Arizona Department Of Public Safety", "Phoenix", "Helicopter", "Bell 407"],
  ["arizona", "N783AZ", "AA9BC3", "Bell 429", "State Of Arizona Department Of Public Safety", "Phoenix", "Helicopter", "Bell 429"],
  ["arkansas", "N523SP", "A695B1", "Cessna T206H", "Arkansas State Police", "Little Rock", "Plane", "Cessna T206H"],
  ["arkansas", "N524SP", "A69968", "Bell 407", "Arkansas State Police", "Little Rock", "Helicopter", "Bell 407"],
  ["arkansas", "N120BX", "A053E1", "Bell OH-58A", "Baxter County Sheriffs Department", "Mountain Home", "Helicopter", "Bell OH-58A"],
  ["arkansas", "N521BZ", "A68CD6", "Bell OH-58A", "Baxter County Sheriffs Office", "Mountain Home", "Helicopter", "Bell OH-58A"],
  ["arkansas", "N131SD", "A0807C", "Bell OH-58A", "Benton County Sheriffs Department", "Bentonville", "Helicopter", "Bell OH-58A"],
  ["arkansas", "N134SD", "A08BA1", "Bell OH-58A", "Benton County Sheriffs Office", "Bentonville", "Helicopter", "Bell OH-58A"],
  ["arkansas", "N2071A", "A1AE80", "Bell OH-58A", "Benton County Sheriffs Office", "Bentonville", "Helicopter", "Bell OH-58A"],
  ["arkansas", "N752DC", "AA21C5", "Bell OH-58A", "Mississippi County Sheriff Department", "Luxora", "Helicopter", "Bell OH-58A"],
  ["arkansas", "N35LD", "A3E372", "Bell OH-58C", "Mississippi County Sheriffs Department", "Luxora", "Helicopter", "Bell OH-58A"],
  ["arkansas", "N500TF", "A63B9F", "Cessna 172N", "Pine Bluff Police Department", "Pine Bluff", "Plane", "Cessna 172 Skyhawk"],
  ["arkansas", "N390SP", "A48467", "Raytheon Aircraft Company B200", "State Of Arkansas / Arkansas State Police", "Little Rock", "Plane", null],
  ["connecticut", "N401SP", "A4B1F6", "Bell OH-58A", "Connecticut State Police", "Hartford", "Helicopter", "Bell OH-58A"],
  ["connecticut", "N402SP", "A4B5AD", "Bell OH-58A", "Connecticut State Police", "Hartford", "Helicopter", "Bell OH-58A"],
  ["connecticut", "N107SP", "A02053", "Cessna 182R", "Department Of Emergency Svc & Public Protection / Division Of State Police", "Hartford", "Plane", "Cessna 182 Skylane"],
  ["connecticut", "N105SP", "A018E5", "Cessna 182R", "Department Of Emergency Svcs & Public Protection / Ct State Police/Aviation Section", "Hartford", "Plane", "Cessna 182 Skylane"],
  ["connecticut", "N95ND", "AD337E", "Bell OH58A", "New Milford Police Department", "New Milford", "Helicopter", "Bell OH-58A"],
  ["connecticut", "N91ND", "AC9582", "Bell OH-58A", "Stratford Police Department", "Southport", "Helicopter", "Bell OH-58A"],
  ["connecticut", "N93ND", "ACE480", "Bell UH-1H", "Stratford Police Department", "Southport", "Helicopter", "Bell UH-1H"],
  ["delaware", "N1SP", "A001A0", "Bell 429", "Delaware State Police", "Dover", "Helicopter", "Bell 429"],
  ["delaware", "N2SP", "A18EEF", "Bell 429", "Delaware State Police", "Middletown", "Helicopter", "Bell 429"],
  ["delaware", "N6SP", "A7C42B", "Bell 429", "Delaware State Police", "Dover", "Helicopter", "Bell 429"],
  ["delaware", "N71SP", "A97B52", "Bell 429", "Delaware State Police", "Middletown", "Helicopter", "Bell 429"],
  ["delaware", "N51SP", "A660B4", "Cessna 182Q", "Department Of Public Safety", "Dover", "Plane", "Cessna 182 Skylane"],
  ["georgia", "N367PD", "A42796", "MD Helicopters 369FF", "Atlanta Police Department Aviation Unit", "Atlanta", "Helicopter", "MD Helicopters 369FF / MD 530F"],
  ["georgia", "N369PD", "A42F04", "MD Helicopters 369FF", "Atlanta Police Department Aviation Unit", "Atlanta", "Helicopter", "MD Helicopters 369FF / MD 530F"],
  ["georgia", "N371PD", "A438CB", "MD Helicopters 369FF", "Atlanta Police Department Aviation Unit", "Atlanta", "Helicopter", "MD Helicopters 369FF / MD 530F"],
  ["georgia", "N296CC", "A30BF9", "Bell 206L-3", "Clayton County Police Department", "Jonesboro", "Helicopter", "Bell 206L"],
  ["georgia", "N330DC", "A3961D", "Bell OH-58A", "Coweta County Sheriff's Office", "Newnan", "Helicopter", "Bell OH-58A"],
  ["georgia", "N90DK", "AC6D28", "Airbus AS 350 B2", "Dekalb County Police", "Tucker", "Helicopter", "Eurocopter AS350B2"],
  ["georgia", "N91DK", "AC94A7", "Airbus AS 350 B2", "Dekalb Police Department", "Tucker", "Helicopter", "Eurocopter AS350B2"],
  ["georgia", "N3188Z", "A36811", "Bell 206B", "Fulton County Police Headquarters", "Atlanta", "Helicopter", "Bell 206B"],
  ["georgia", "N230DK", "A208D5", "Bell 407", "Georgia Department Of Public Safety", "Kennesaw", "Helicopter", "Bell 407"],
  ["georgia", "N412AD", "A4DB92", "Bell 412EP", "Georgia Department Of Public Safety", "Kennesaw", "Helicopter", "Bell 412EP"],
  ["georgia", "N466DW", "A5B045", "Bell 407", "Georgia Department Of Public Safety", "Kennesaw", "Helicopter", "Bell 407"],
  ["georgia", "N905SP", "AC835D", "Bell OH-58A", "Georgia Department Of Public Safety", "Kennesaw", "Helicopter", "Bell OH-58A"],
  ["georgia", "N906SP", "AC8714", "Bell OH-58A", "Georgia Department Of Public Safety", "Kennesaw", "Helicopter", "Bell OH-58A"],
  ["georgia", "N908SP", "AC8E82", "Bell OH-58A", "Georgia Department Of Public Safety", "Kennesaw", "Helicopter", "Bell OH-58A"],
  ["georgia", "N922SP", "ACC736", "Bell 407", "Georgia Department Of Public Safety", "Kennesaw", "Helicopter", "Bell 407"],
  ["georgia", "N924SP", "ACCEA4", "Bell 429", "Georgia Department Of Public Safety", "Kennesaw", "Helicopter", "Bell 429"],
  ["georgia", "N925SP", "ACD25B", "Bell 407", "Georgia Department Of Public Safety", "Kennesaw", "Helicopter", "Bell 407"],
  ["georgia", "N927SP", "ACD9C9", "Bell OH-58C", "Georgia Department Of Public Safety", "Kennesaw", "Helicopter", "Bell OH-58A"],
  ["georgia", "N930SP", "ACE747", "Bell 407", "Georgia Department Of Public Safety", "Kennesaw", "Helicopter", "Bell 407"],
  ["georgia", "N991MH", "ADD775", "Bell 407", "Georgia Department Of Public Safety", "Kennesaw", "Helicopter", "Bell 407"],
  ["georgia", "N921SP", "ACC37F", "Bell 407", "Georgia Department Of Public Saftey", "Kennesaw", "Helicopter", "Bell 407"],
  ["georgia", "N67715", "A8F852", "Bell 206B", "Georgia State Patrol Aviation Div", "Kennesaw", "Helicopter", "Bell 206B"],
  ["georgia", "N67363", "A8EA23", "Bell 206B", "Georgia State Patrol Aviation Division", "Kennesaw", "Helicopter", "Bell 206B"],
  ["georgia", "N1808", "A1441C", "MD Helicopters 369FF", "Gwinnett County Police Department", "Lawrenceville", "Helicopter", "MD Helicopters 369FF / MD 530F"],
  ["georgia", "N295CC", "A30842", "Bell OH-58C", "Henry County Sheriffs Office", "Mcdonough", "Helicopter", "Bell OH-58A"],
  ["georgia", "N943SC", "AD19E0", "Bell OH-58C", "Spalding County Sheriffs Office", "Griffin", "Helicopter", "Bell OH-58A"],
  ["georgia", "N944SC", "AD1D97", "Bell OH-58C", "Spalding County Sheriffs Office", "Griffin", "Helicopter", "Bell OH-58A"],
  ["georgia", "N946SC", "AD2505", "Bell UH-1V", "Spalding County Sheriffs Office", "Griffin", "Helicopter", null],
  ["hawaii", "N501HP", "A63E64", "MD Helicopters 369E", "Honolulu Police Department", "Honolulu", "Helicopter", "McDonnell Douglas 369E"],
  ["hawaii", "N502HP", "A6421B", "MD Helicopters 369E", "Honolulu Police Department", "Honolulu", "Helicopter", "McDonnell Douglas 369E"],
  ["idaho", "N67176", "A8E2DB", "Bell 206B", "Kootenai County Regional Air Support Unit / Sheriff's Office", "Hayden", "Helicopter", "Bell 206B"],
  ["illinois", "N911UU", "AC9C37", "Bell 206B", "City Of Chicago / Chicago Police Department", "Chicago", "Helicopter", "Bell 206B"],
  ["illinois", "N911YY", "AC9C9F", "Bell 206-L4", "City Of Chicago / Department Of Police", "Chicago", "Helicopter", "Bell 206L"],
  ["illinois", "N911ZQ", "AC9CB0", "Bell 407", "City Of Chicago / Department Of Police", "Chicago", "Helicopter", "Bell 407"],
  ["illinois", "N911ZR", "AC9CB1", "Bell 407", "City Of Chicago / Department Of Police", "Chicago", "Helicopter", "Bell 407"],
  ["illinois", "N88SD", "AC1D10", "Bell HH-1N", "City Of Chicago Department Of Police", "Chicago", "Helicopter", null],
  ["illinois", "N911ZP", "AC9CAF", "Bell 429", "City Of Chicago Department Of Police", "Chicago", "Helicopter", "Bell 429"],
  ["illinois", "N911VH", "AC9C45", "Bell 429", "Cook County Sheriff's Office", "Chicago", "Helicopter", "Bell 429"],
  ["illinois", "N551SP", "A704C0", "Cessna T206H", "Illinois State Police", "Springfield", "Plane", "Cessna T206H"],
  ["illinois", "N561SP", "A72C3F", "Cessna 182S", "Illinois State Police", "Springfield", "Plane", "Cessna 182 Skylane"],
  ["illinois", "N661SP", "A8B98E", "Cessna T206H", "Illinois State Police", "Springfield", "Plane", "Cessna T206H"],
  ["illinois", "N771SP", "AA6E5C", "Cessna T206H", "Illinois State Police", "Springfield", "Plane", "Cessna T206H"],
  ["illinois", "N881SP", "AC232A", "Cessna 182S", "Illinois State Police", "Springfield", "Plane", "Cessna 182 Skylane"],
  ["illinois", "N971SP", "AD88FA", "Cessna 182S", "Illinois State Police", "Springfield", "Plane", "Cessna 182 Skylane"],
  ["illinois", "N991SP", "ADD7F8", "Cessna 182S", "Illinois State Police", "Springfield", "Plane", "Cessna 182 Skylane"],
  ["indiana", "N823XC", "AB3E10", "Bell OH-58A", "Clark County Sheriff's Office", "Jeffersonville", "Helicopter", "Bell OH-58A"],
  ["indiana", "N79PD", "AAB6F5", "Bell OH-58C", "Clark County Sheriffs Office", "Jeffersonville", "Helicopter", "Bell OH-58A"],
  ["indiana", "N92PD", "ACBD1A", "Bell OH-58C", "Clark County Sheriffs Office", "Jeffersonville", "Helicopter", "Bell OH-58A"],
  ["indiana", "N193SP", "A174EE", "Cessna 172P", "Indiana State Police", "Greenwood", "Plane", "Cessna 172 Skyhawk"],
  ["indiana", "N54SP", "A6D731", "Bell 206L-3", "Indiana State Police", "Indianapolis", "Helicopter", "Bell 206L"],
  ["indiana", "N356LC", "A3FC14", "Airbus EC120B", "Lake County Indiana / C/O Lake County Sheriff's Department", "Crown Point", "Helicopter", "Eurocopter EC120B"],
  ["indiana", "N512LC", "A669DA", "Bell OH-58A", "Lake County Sheriff Department", "Crown Point", "Helicopter", "Bell OH-58A"],
  ["indiana", "N515LC", "A674FF", "Bell UH-1V", "Lake County Sheriff Department", "Crown Point", "Helicopter", null],
  ["indiana", "N513LC", "A66D91", "Bell OH-58", "Lake County Sheriffs Department", "Griffith", "Helicopter", "Bell OH-58A"],
  ["indiana", "N514LC", "A67148", "Bell UH-1H", "Lake County Sheriffs Department", "Griffith", "Helicopter", "Bell UH-1H"],
  ["indiana", "N407SS", "A4C843", "Bell 407", "State Of Indiana / Indiana State Police", "Indianapolis", "Helicopter", "Bell 407"],
  ["indiana", "N507SP", "A6558F", "Bell 407", "State Of Indiana / Indiana State Police", "Indianapolis", "Helicopter", "Bell 407"],
  ["iowa", "N227SP", "A1FCA0", "Cirrus SR22", "Iowa State Patrol", "Des Moines", "Plane", "Cirrus SR22"],
  ["iowa", "N231SP", "A20DD5", "Cessna 182T", "Iowa State Patrol", "Des Moines", "Plane", "Cessna 182 Skylane"],
  ["iowa", "N996CS", "ADE930", "Cessna T206H", "Iowa State Patrol", "Des Moines", "Plane", "Cessna T206H"],
  ["iowa", "N171SP", "A11E82", "Cessna 182T", "State Of Iowa - Iowa State Patrol", "Des Moines", "Plane", "Cessna 182 Skylane"],
  ["kansas", "N550KS", "A7005D", "Cessna 525B", "Kansas Highway Patrol", "Topeka", "Plane", null],
  ["kansas", "N600HP", "A7C7FC", "Cessna 208B", "Kansas Highway Patrol", "Topeka", "Plane", "Cessna 208B"],
  ["kansas", "N650HP", "A88D77", "Airbus AS350B3", "Kansas Highway Patrol", "Topeka", "Helicopter", "Airbus AS350B3 / H125"],
  ["kansas", "N670HP", "A8DC75", "Airbus AS350B3", "Kansas Highway Patrol", "Topeka", "Helicopter", "Airbus AS350B3 / H125"],
  ["kansas", "N900HP", "AC6FE9", "Cessna 206H", "Kansas Highway Patrol", "Topeka", "Plane", "Cessna 206H"],
  ["kansas", "N940HP", "AD0DE5", "Cessna 206H", "Kansas Highway Patrol", "Topeka", "Plane", "Cessna 206H"],
  ["kansas", "N950HP", "AD3564", "Cessna 206H", "Kansas Highway Patrol", "Topeka", "Plane", "Cessna 206H"],
  ["kentucky", "N220SP", "A1E29F", "Bell OH-58A", "Kentucky State Police", "Frankfort", "Helicopter", "Bell OH-58A"],
  ["kentucky", "N282SP", "A2D707", "Bell OH-58A", "Kentucky State Police", "Frankfort", "Helicopter", "Bell OH-58A"],
  ["kentucky", "N283SP", "A2DABE", "Bell OH-58A", "Kentucky State Police", "Frankfort", "Helicopter", "Bell OH-58A"],
  ["kentucky", "N284SP", "A2DE75", "Bell 407", "Kentucky State Police", "Frankfort", "Helicopter", "Bell 407"],
  ["kentucky", "N285SP", "A2E22C", "Bell 429", "Kentucky State Police", "Frankfort", "Helicopter", "Bell 429"],
  ["kentucky", "N36SP", "A40B91", "Learjet 35A", "Kentucky State Police", "Frankfort", "Plane", null],
  ["kentucky", "N421SP", "A500F4", "MD Helicopters 369FF", "Kentucky State Police", "Frankfort", "Helicopter", "MD Helicopters 369FF / MD 530F"],
  ["kentucky", "N45SP", "A57161", "Bell UH-1H", "Kentucky State Police", "Frankfort", "Helicopter", "Bell UH-1H"],
  ["kentucky", "N46SP", "A598E0", "Hughes OH-6A", "Kentucky State Police", "Frankfort", "Helicopter", null],
  ["kentucky", "N53KG", "A6AEFC", "Beechcraft B300", "Kentucky State Police", "Frankfort", "Plane", "Beechcraft King Air B300"],
  ["kentucky", "N632TK", "A846DD", "Cessna 182T", "Kentucky State Police", "Frankfort", "Plane", "Cessna 182 Skylane"],
  ["kentucky", "N911LP", "AC9B6A", "Bell OH-58C", "Ky Lexington Fayette Urban Co Pd", "Lexington", "Helicopter", "Bell OH-58A"],
  ["kentucky", "N912LP", "AC9F21", "Bell OH-58C", "Lexington Fayette Urban County / Division Of Police", "Lexington", "Helicopter", "Bell OH-58A"],
  ["kentucky", "N502LM", "A64264", "Airbus AS350B3", "Louisville Metro Police Department Air Unit", "Louisville", "Helicopter", "Airbus AS350B3 / H125"],
  ["kentucky", "N65231", "A89703", "Bell 206B", "Louisville Metro Police Department Air Unit", "Louisville", "Helicopter", "Bell 206B"],
  ["kentucky", "N67830", "A8FC4A", "Bell 206B", "Louisville Metro Police Department Air Unit", "Louisville", "Helicopter", "Bell 206B"],
  ["kentucky", "N830VP", "AB5A43", "Bell OH-58", "Pulaski County Sheriffs Office", "Somerset", "Helicopter", "Bell OH-58A"],
  ["kentucky", "N830WK", "AB5A58", "Bell OH-58", "Pulaski County Sheriffs Office", "Somerset", "Helicopter", "Bell OH-58A"],
  ["kentucky", "N10SP", "A003F9", "Bell 206L-3", "State Of Kentucky / Department Of Kentucky State Police", "Frankfort", "Helicopter", "Bell 206L"],
  ["louisiana", "N225PD", "A1F4DD", "Bell 206B", "Baton Rouge Police Department", "Baton Rouge", "Helicopter", "Bell 206B"],
  ["louisiana", "N441PD", "A54F9D", "Robinson R44 II", "Baton Rouge Police Department", "Baton Rouge", "Helicopter", "Robinson R44 II"],
  ["louisiana", "N52285", "A693EA", "Cessna T206H", "Calcasieu Parish Sheriffs Office", "Lake Charles", "Plane", "Cessna T206H"],
  ["louisiana", "N269SP", "A2A20A", "Bell UH-1V", "Department Of Public Safety", "Baton Rouge", "Helicopter", null],
  ["louisiana", "N57266", "A75920", "Aero Commander 500 S", "Department Of Public Safety", "Baton Rouge", "Plane", null],
  ["louisiana", "N670SP", "A8DD56", "Bell UH-1H", "Department Of Public Safety", "Baton Rouge", "Helicopter", "Bell UH-1H"],
  ["louisiana", "N355DS", "A3F7BC", "Bell OH-58A", "Desoto Parish Sheriff Office", "Mansfield", "Helicopter", "Bell OH-58A"],
  ["louisiana", "N442PD", "A55354", "Robinson R44 II", "Desoto Parish Sheriff Office", "Mansfield", "Helicopter", "Robinson R44 II"],
  ["louisiana", "N530SD", "A6B201", "Bell OH58A", "East Baton Rouge Parish Sheriff", "Baton Rouge", "Helicopter", "Bell OH-58A"],
  ["louisiana", "N911HL", "AC9B1C", "Bell 407", "Jefferson Parish Sheriffs Office", "Harvey", "Helicopter", "Bell 407"],
  ["louisiana", "N911JL", "AC9B35", "Bell 429", "Jefferson Parish Sheriffs Office", "Harvey", "Helicopter", "Bell 429"],
  ["louisiana", "N111JS", "A030C3", "Bell OH-58C", "Livingston Parish Sheriff Department", "Livingston", "Helicopter", "Bell OH-58A"],
  ["louisiana", "N230MH", "A2099B", "Bell 206-L4", "Livingston Parish Sheriff's Office", "Livingston", "Helicopter", "Bell 206L"],
  ["louisiana", "N901LP", "AC73EB", "Bell OH-58", "Livingston Parish Sheriffs Office", "Livingston", "Helicopter", "Bell OH-58A"],
  ["louisiana", "N356SP", "A3FCB5", "Bell UH-1", "Louisiana Department Of Public Safety", "Baton Rouge", "Helicopter", null],
  ["louisiana", "N357SP", "A4006C", "Bell 206-L4", "Louisiana Department Of Public Safety", "Baton Rouge", "Helicopter", "Bell 206L"],
  ["louisiana", "N9750L", "AD989B", "Cessna 172P", "Louisiana Department Of Public Safety", "Baton Rouge", "Plane", "Cessna 172 Skyhawk"],
  ["louisiana", "N354SP", "A3F547", "Bell 407", "Louisiana State Police", "Baton Rouge", "Helicopter", "Bell 407"],
  ["louisiana", "N355SP", "A3F8FE", "Bell 407", "Louisiana State Police", "Baton Rouge", "Helicopter", "Bell 407"],
  ["louisiana", "N508SP", "A65946", "Bell 407", "Louisiana State Police", "Baton Rouge", "Helicopter", "Bell 407"],
  ["louisiana", "N57265", "A7591F", "Pilatus PC-12/47E", "Louisiana State Police", "Baton Rouge", "Plane", "Pilatus PC-12"],
  ["louisiana", "N965SP", "AD7057", "Bell 429", "Louisiana State Police", "Baton Rouge", "Helicopter", "Bell 429"],
  ["louisiana", "N480PQ", "A5E9ED", "Enstrom 480B", "Plaquemines Parish Sheriff's Office", "Belle Chasse", "Helicopter", null],
  ["louisiana", "N67183", "A8E2FB", "Bell 206B", "State Of Louisiana / Department Of Public Safety", "Baton Rouge", "Helicopter", "Bell 206B"],
  ["louisiana", "N430M", "A52431", "Cessna 182R", "State Of Louisiana / Department Of Public Safety / Office Of State Police", "Baton Rouge", "Plane", "Cessna 182 Skylane"],
  ["louisiana", "N64034", "A86819", "Cessna 172P", "State Of Louisiana / Department Of Public Safety / Office Of State Police", "Baton Rouge", "Plane", "Cessna 172 Skyhawk"],
  ["maine", "N5339N", "A6BF32", "Cessna 182Q", "Maine State Police", "Augusta", "Plane", "Cessna 182 Skylane"],
  ["maryland", "N153PD", "A0D69D", "Bell OH-58A", "Anne Arundel County Police Department", "Millersville", "Helicopter", "Bell OH-58A"],
  ["maryland", "N154PD", "A0DA54", "Bell OH-58A", "Anne Arundel County Police Department", "Millersville", "Helicopter", "Bell OH-58A"],
  ["maryland", "N803CP", "AAED42", "Airbus AS350B3", "Baltimore County Police Department Aviation Team", "Middle River", "Helicopter", "Airbus AS350B3 / H125"],
  ["maryland", "N804CP", "AAF0F9", "Airbus AS 350 B3", "Baltimore County Police Department Aviation Team", "Baltimore", "Helicopter", "Airbus AS350B3 / H125"],
  ["maryland", "N808CP", "AAFFD5", "Airbus AS 350 B3", "Baltimore County Police Department Aviation Team", "Baltimore", "Helicopter", "Airbus AS350B3 / H125"],
  ["maryland", "N451F", "A57650", "Airbus AS350B3", "Baltimore Police Department Aviation Unit", "Baltimore", "Helicopter", "Airbus AS350B3 / H125"],
  ["maryland", "N452F", "A57A07", "Airbus AS350B3", "Baltimore Police Department Aviation Unit", "Baltimore", "Helicopter", "Airbus AS350B3 / H125"],
  ["maryland", "N453F", "A57DBE", "Airbus AS350B3", "Baltimore Police Department Aviation Unit", "Baltimore", "Helicopter", "Airbus AS350B3 / H125"],
  ["maryland", "N191NR", "A16D1E", "Airbus AS350B3", "Maryland Natural Resources Police", "Stevensville", "Helicopter", "Airbus AS350B3 / H125"],
  ["maryland", "N9111G", "AC9CE4", "Piper PA-32-301", "Maryland State Police", "Baltimore", "Plane", null],
  ["maryland", "N381MD", "A46018", "Leonardo AW139", "Maryland State Police Aviation Command", "Middle River", "Helicopter", null],
  ["maryland", "N382MD", "A463CF", "Leonardo AW139", "Maryland State Police Aviation Command", "Middle River", "Helicopter", null],
  ["maryland", "N383MD", "A46786", "Leonardo AW139", "Maryland State Police Aviation Command", "Middle River", "Helicopter", null],
  ["maryland", "N384MD", "A46B3D", "Leonardo AW139", "Maryland State Police Aviation Command", "Middle River", "Helicopter", null],
  ["maryland", "N385MD", "A46EF4", "Leonardo AW139", "Maryland State Police Aviation Command", "Middle River", "Helicopter", null],
  ["maryland", "N386MD", "A472AB", "Leonardo AW139", "Maryland State Police Aviation Command", "Middle River", "Helicopter", null],
  ["maryland", "N387MD", "A47662", "Leonardo AW139", "Maryland State Police Aviation Command", "Middle River", "Helicopter", null],
  ["maryland", "N388MD", "A47A19", "Leonardo AW139", "Maryland State Police Aviation Command", "Middle River", "Helicopter", null],
  ["maryland", "N389MD", "A47DD0", "Leonardo AW139", "Maryland State Police Aviation Command", "Middle River", "Helicopter", null],
  ["maryland", "N390MD", "A483E0", "Leonardo AW139", "Maryland State Police Aviation Command", "Middle River", "Helicopter", null],
  ["maryland", "N554NR", "A70F83", "Bell OH-58A+", "Md Dnr Police Department", "Annapolis", "Helicopter", "Bell OH-58A"],
  ["maryland", "N912PG", "AC9F65", "MD Helicopters 500N", "Prince Georges County Police Department", "College Park", "Helicopter", "MD Helicopters 500N"],
  ["maryland", "N913PG", "ACA31C", "MD Helicopters 500N", "Prince Georges County Police Department", "College Park", "Helicopter", "MD Helicopters 500N"],
  ["massachusetts", "N6340F", "A84EF6", "Cessna 182P", "Commonwealth Of Massachusetts / Massachusetts State Police", "Plymouth", "Plane", "Cessna 182 Skylane"],
  ["massachusetts", "N822PP", "AB399C", "Airbus EC135T3", "Massachusetts State Police", "Plymouth", "Helicopter", null],
  ["massachusetts", "N823JM", "AB3CD4", "Airbus EC135T2+", "Massachusetts State Police", "Plymouth", "Helicopter", null],
  ["massachusetts", "N824AH", "AB3FBF", "Airbus EC 135 T2+", "Massachusetts State Police", "Plymouth", "Helicopter", null],
  ["massachusetts", "N825MM", "AB448D", "Airbus EC 135 T2+", "Massachusetts State Police", "Plymouth", "Helicopter", null],
  ["massachusetts", "N891TD", "AC4AB8", "Cessna 208B", "Massachusetts State Police", "Plymouth", "Plane", "Cessna 208B"],
  ["michigan", "N514PD", "A67194", "Bell OH58A", "City Of Detroit / Detroit Public Safety Headquarters", "Detroit", "Helicopter", "Bell OH-58A"],
  ["michigan", "N513PD", "A66DDD", "Bell OH-58C", "City Of Detroit / Police Department", "Detroit", "Helicopter", "Bell OH-58A"],
  ["michigan", "N511PD", "A6666F", "Bell 407", "Detroit Police Department", "Detroit", "Helicopter", "Bell 407"],
  ["michigan", "N738PX", "A9EA1E", "Cessna 172N", "Macomb County Sheriffs Aviation Division", "Oakland", "Plane", "Cessna 172 Skyhawk"],
  ["michigan", "N768ST", "AA60E2", "Bell UH-1H", "Mi State Police Field Supp Aviation", "Lansing", "Helicopter", "Bell UH-1H"],
  ["michigan", "N827ST", "AB4C7E", "Bell UH-1H", "Mi State Police Field Supp Aviation", "Lansing", "Helicopter", "Bell UH-1H"],
  ["michigan", "N174ST", "A129AB", "Cessna T206H", "Michigan State Police", "Lansing", "Plane", "Cessna T206H"],
  ["michigan", "N631SD", "A84307", "Airbus AS 350 B2", "Oakland County Sheriff's Office Aviation Unit", "Pontiac", "Helicopter", "Eurocopter AS350B2"],
  ["michigan", "N632SD", "A846BE", "Airbus AS 350 B2", "Oakland County Sheriff's Office Aviation Unit", "Oakland", "Helicopter", "Eurocopter AS350B2"],
  ["michigan", "N111SP", "A03188", "Bell 206L-3", "State Of Michigan / Department Of State Police", "Lansing", "Helicopter", "Bell 206L"],
  ["michigan", "N162ST", "A0FABE", "Beechcraft E-90", "State Of Michigan / Department Of State Police", "Lansing", "Plane", null],
  ["michigan", "N312ST", "A34FE1", "Bell 407", "State Of Michigan / Department Of State Police", "Lansing", "Helicopter", "Bell 407"],
  ["michigan", "N4617E", "A5A0A4", "Cessna 182R", "State Of Michigan / Department Of State Police", "Lansing", "Plane", "Cessna 182 Skylane"],
  ["michigan", "N696ST", "A942A2", "Bell 407", "State Of Michigan / Department Of State Police", "Lansing", "Helicopter", "Bell 407"],
  ["michigan", "N383ST", "A46811", "Bell 407", "State Of Michigan Department Of State Police", "Lansing", "Helicopter", "Bell 407"],
  ["minnesota", "N112SP", "A0353F", "Cessna 182T", "Minnesota Department Of Public Safety", "Saint Paul", "Plane", "Cessna 182 Skylane"],
  ["minnesota", "N114CZ", "A03B59", "Cessna 182R", "Minnesota Department Of Public Safety", "Saint Paul", "Plane", "Cessna 182 Skylane"],
  ["minnesota", "N115SP", "A04064", "Cirrus SR22", "Minnesota State Patrol", "Saint Paul", "Plane", "Cirrus SR22"],
  ["minnesota", "N118SP", "A04B89", "Bell 407", "Minnesota State Patrol", "Saint Paul", "Helicopter", "Bell 407"],
  ["minnesota", "N124SP", "A0642C", "Cirrus SR22", "Minnesota State Patrol", "Saint Paul", "Plane", "Cirrus SR22"],
  ["minnesota", "N717SP", "A997AC", "Bell 429", "Minnesota State Patrol", "Saint Paul", "Helicopter", "Bell 429"],
  ["minnesota", "N145NR", "A0B67F", "Enstrom 480B", "State Of Minnesota Dnr Enforcement Aviation", "Grand Rapids", "Helicopter", null],
  ["mississippi", "N67041", "A8DEB6", "Bell 206B", "Desoto County Sheriff Department", "Hernando", "Helicopter", "Bell 206B"],
  ["mississippi", "N129SD", "A076B5", "Hughes MH-6C", "Desoto County Sherriffs Department", "Hernando", "Helicopter", null],
  ["mississippi", "N301SD", "A3249D", "Hughes 369A", "Harrison County Sheriffs Department", "Gulfport", "Helicopter", null],
  ["mississippi", "N304SD", "A32FC2", "Bell OH-58A", "Harrison County Sheriffs Department", "Gulfport", "Helicopter", "Bell OH-58A"],
  ["mississippi", "N153SD", "A0D6E8", "Bell OH-58C", "Jackson County Sheriffs Department", "Pascagoula", "Helicopter", "Bell OH-58A"],
  ["mississippi", "N155SD", "A0DE56", "Bell OH-58C", "Jackson County Sheriffs Department", "Pascagoula", "Helicopter", "Bell OH-58A"],
  ["mississippi", "N980SD", "ADACB8", "Bell OH-58C", "Marshall County Sheriff Office", "Holly Springs", "Helicopter", "Bell OH-58A"],
  ["mississippi", "N670SD", "A8DD4C", "Bell OH-58C", "Marshall County Sheriffs Office", "Holly Springs", "Helicopter", "Bell OH-58A"],
  ["mississippi", "N840SD", "AB816D", "Bell OH-58C", "Marshall County Sheriffs Office", "Holly Springs", "Helicopter", "Bell OH-58A"],
  ["mississippi", "N350MS", "A3E5F1", "Airbus AS350B3", "Mississippi Department Of Public Safety", "Jackson", "Helicopter", "Airbus AS350B3 / H125"],
  ["mississippi", "N351MS", "A3E9A8", "Airbus EC 135 T2+", "Mississippi Department Of Public Safety", "Jackson", "Helicopter", null],
  ["missouri", "N690PD", "A92BFF", "MD Helicopters 369E", "Board Of Police Commissioners", "Kansas City", "Helicopter", "McDonnell Douglas 369E"],
  ["missouri", "N691PD", "A92FB6", "MD Helicopters 369E", "Board Of Police Commissioners", "Kansas City", "Helicopter", "McDonnell Douglas 369E"],
  ["missouri", "N692PD", "A9336D", "MD Helicopters 369E", "Board Of Police Commissioners", "Kansas City", "Helicopter", "McDonnell Douglas 369E"],
  ["missouri", "N79MP", "AAB6CD", "Cessna 182T", "Missouri State Highway Patrol", "Jefferson City", "Plane", "Cessna 182 Skylane"],
  ["missouri", "N83MP", "AB5722", "Beechcraft B200GT", "Missouri State Highway Patrol", "Jefferson City", "Plane", null],
  ["missouri", "N86MP", "ABCD9F", "Kodiak 200", "Missouri State Highway Patrol", "Jefferson City", "Plane", null],
  ["missouri", "N93MP", "ACE471", "Bell 407", "Missouri State Highway Patrol", "Jefferson City", "Helicopter", "Bell 407"],
  ["missouri", "N94MP", "AD0BF0", "Cessna 182S", "Missouri State Highway Patrol", "Jefferson City", "Plane", "Cessna 182 Skylane"],
  ["missouri", "N95MP", "AD336F", "Bell 407", "Missouri State Highway Patrol Aircraft Division", "Jefferson City", "Helicopter", "Bell 407"],
  ["missouri", "N911NY", "AC9BA5", "MD Helicopters 369E", "St Louis County (Mo) Police Department", "Chesterfield", "Helicopter", "McDonnell Douglas 369E"],
  ["missouri", "N911JX", "AC9B40", "Hughes 369A", "St Louis County Police", "Chesterfield", "Helicopter", null],
  ["missouri", "N911CP", "AC9AA2", "MD Helicopters 369E", "St Louis County Police Department", "Clayton", "Helicopter", "McDonnell Douglas 369E"],
  ["missouri", "N911MU", "AC9B88", "MD Helicopters 369E", "St Louis County Police Department", "Clayton", "Helicopter", "McDonnell Douglas 369E"],
  ["missouri", "N911PH", "AC9BAF", "MD Helicopters 369E", "St Louis County Police Department", "Clayton", "Helicopter", "McDonnell Douglas 369E"],
  ["missouri", "N90MP", "AC6DF4", "Bell 206B", "State Of Missouri / Missouri Highway Patrol", "Jefferson City", "Helicopter", "Bell 206B"],
  ["montana", "N151HP", "A0CEA3", "Bell OH-58A", "Montana Highway Patrol", "Helena", "Helicopter", "Bell OH-58A"],
  ["montana", "N1664R", "A10AEC", "Cessna R182", "State Of Montana / Montana Highway Patrol Division", "Helena", "Plane", null],
  ["montana", "N311YC", "A34CB1", "Bell OH-58C", "Yellowstone County Sheriff Office", "Billings", "Helicopter", "Bell OH-58A"],
  ["montana", "N381YC", "A4612A", "Bell OH-58C", "Yellowstone County Sheriff Office", "Billings", "Helicopter", "Bell OH-58A"],
  ["montana", "N342YC", "A3C6E5", "Bell OH-58C", "Yellowstone County Sheriffs Offfice", "Billings", "Helicopter", "Bell OH-58A"],
  ["nebraska", "N340PD", "A3BE97", "Bell 505", "City Of Omaha / By And Through The Omaha Police Department", "Omaha", "Helicopter", "Bell 505"],
  ["nebraska", "N240PD", "A23148", "Bell 505", "City Of Omaha / Omaha Police Department", "Omaha", "Helicopter", "Bell 505"],
  ["nebraska", "N402PD", "A4B558", "Bell 407", "City Of Omaha / Omaha Police Department", "Omaha", "Helicopter", "Bell 407"],
  ["nebraska", "N1746L", "A12B3E", "Cessna T206H", "Nebraska State Patrol", "Lincoln", "Plane", "Cessna T206H"],
  ["nebraska", "N2383L", "A22904", "Cessna T206H", "Nebraska State Patrol", "Lincoln", "Plane", "Cessna T206H"],
  ["nebraska", "N373NE", "A44021", "Bell 505", "Nebraska State Patrol", "Lincoln", "Helicopter", "Bell 505"],
  ["nebraska", "N575NE", "A7622D", "Bell 407", "Nebraska State Patrol", "Lincoln", "Helicopter", "Bell 407"],
  ["nevada", "N145DV", "A0B5A2", "Airbus MBB-BK 117 D-2", "Las Vegas Metropolitan Police Department", "North Las Vegas", "Helicopter", "Airbus H145 / BK117 D-2"],
  ["nevada", "N5185G", "A68235", "MD Helicopters 369FF", "Las Vegas Metropolitan Police Department", "North Las Vegas", "Helicopter", "MD Helicopters 369FF / MD 530F"],
  ["nevada", "N530JL", "A6B140", "MD Helicopters 369FF", "Las Vegas Metropolitan Police Department", "Las Vegas", "Helicopter", "MD Helicopters 369FF / MD 530F"],
  ["nevada", "N741SM", "A9F7DD", "Airbus AS350B3", "Las Vegas Metropolitan Police Department", "North Las Vegas", "Helicopter", "Airbus AS350B3 / H125"],
  ["nevada", "N911WY", "AC9C6D", "MD Helicopters 369FF", "Las Vegas Metropolitan Police Department", "North Las Vegas", "Helicopter", "MD Helicopters 369FF / MD 530F"],
  ["nevada", "N233JP", "A2147B", "Bell HH-1H", "Washoe County Sheriff Department", "Reno", "Helicopter", "Bell HH-1H"],
  ["nevada", "N91JK", "AC9524", "Bell HH-1H", "Washoe County Sheriff Department", "Reno", "Helicopter", "Bell HH-1H"],
  ["nevada", "N1032F", "A0127D", "Bell OH-58A", "Washoe County Sheriffs Office", "Reno", "Helicopter", "Bell OH-58A"],
  ["nevada", "N1911", "A16E5D", "Bell OH-58A", "Washoe County Sheriffs Office", "Reno", "Helicopter", "Bell OH-58A"],
  ["nevada", "N911NV", "AC9BA2", "Bell HH-1H", "Washoe County Sheriffs Office", "Reno", "Helicopter", "Bell HH-1H"],
  ["new-hampshire", "N366SP", "A42434", "Bell 407", "New Hampshire State Police", "Concord", "Helicopter", "Bell 407"],
  ["new-hampshire", "N366NH", "A423CA", "Cessna 182T", "State Of New Hampshire Department Of Safety / Division Of State Police Aviation Unit", "Concord", "Plane", "Cessna 182 Skylane"],
  ["new-jersey", "N12NP", "A05293", "Bell OH-58", "City Of Newark / N J Police Department", "Newark", "Helicopter", "Bell OH-58A"],
  ["new-jersey", "N1NJ", "A00137", "Leonardo AW139", "New Jersey State Police", "Trenton", "Helicopter", null],
  ["new-jersey", "N2NJ", "A18E86", "Bell 206L-3", "New Jersey State Police", "Ewing", "Helicopter", "Bell 206L"],
  ["new-jersey", "N3NJ", "A31BD5", "Leonardo AW139", "New Jersey State Police", "Trenton", "Helicopter", null],
  ["new-jersey", "N4NJ", "A4A924", "Bell OH-58A", "New Jersey State Police", "Ewing", "Helicopter", "Bell OH-58A"],
  ["new-jersey", "N5NJ", "A63673", "Leonardo AW139", "New Jersey State Police", "Ewing", "Helicopter", null],
  ["new-jersey", "N6NJ", "A7C3C2", "Bell 206-L4", "New Jersey State Police", "West Trenton", "Helicopter", "Bell 206L"],
  ["new-jersey", "N7NJ", "A95111", "Leonardo AW139", "New Jersey State Police", "Trenton", "Helicopter", null],
  ["new-jersey", "N9NJ", "AC6BAF", "Leonardo AW139", "New Jersey State Police", "Trenton", "Helicopter", null],
  ["new-mexico", "N120PD", "A054FB", "Airbus AS350B3", "Albuquerque Police Department Air Support Unit", "Albuquerque", "Helicopter", "Airbus AS350B3 / H125"],
  ["new-mexico", "N125PD", "A0678E", "Airbus AS 350B3", "Albuquerque Police Department Air Support Unit", "Albuquerque", "Helicopter", "Airbus AS350B3 / H125"],
  ["new-mexico", "N412TX", "A4DD4D", "Bell 412EP", "Bernailillo County Sheriffs Office", "Albuquerque", "Helicopter", "Bell 412EP"],
  ["new-mexico", "N911ZS", "AC9CB2", "Cessna T41C", "Bernalalillo County Sheriffs Office", "Albuquerque", "Plane", null],
  ["new-mexico", "N911ZZ", "AC9CB9", "Airbus AS 350 B3", "Bernalillo County Sheriff's Department", "Albuquerque", "Helicopter", "Airbus AS350B3 / H125"],
  ["new-mexico", "N9958H", "ADE8AE", "Cessna 182R", "City Of Albuquerque / Police Department", "Albuquerque", "Plane", "Cessna 182 Skylane"],
  ["new-mexico", "N607SP", "A7E2DE", "Airbus MBB-BK 117 D-2", "New Mexico State Police Aircraft Section", "Santa Fe", "Helicopter", "Airbus H145 / BK117 D-2"],
  ["new-mexico", "N917SJ", "ACB245", "Bell OH-58A", "San Juan County Sheriff Department", "Aztec", "Helicopter", "Bell OH-58A"],
  ["new-york", "N119NY", "A04EE5", "Leonardo AW119MKII", "City Of New York / Department Of Environmental Protection Police", "Wappingers Falls", "Helicopter", null],
  ["new-york", "N120NY", "A054F5", "Leonardo AW119MKII", "City Of New York / Department Of Environmental Protection Police", "Wappingers Falls", "Helicopter", null],
  ["new-york", "N921PD", "ACC32A", "Bell 412EP", "City Of New York Police Department", "Brooklyn", "Helicopter", "Bell 412EP"],
  ["new-york", "N922PD", "ACC6E1", "Bell 412EP", "City Of New York Police Department", "Brooklyn", "Helicopter", "Bell 412EP"],
  ["new-york", "N454PD", "A58241", "Airbus MBB-BK117 D-3", "County Of Suffolk Police Department", "Ronkonkoma", "Helicopter", null],
  ["new-york", "N235AH", "A21B1B", "Airbus AS350B3", "Erie County Sheriffs Office", "Buffalo", "Helicopter", "Airbus AS350B3 / H125"],
  ["new-york", "N339SD", "A3B8D2", "Airbus AS350B3", "Erie County Sheriffs Office", "Buffalo", "Helicopter", "Airbus AS350B3 / H125"],
  ["new-york", "N604PD", "A7D764", "Bell 429", "Nassau County Police Department", "Bethpage", "Helicopter", "Bell 429"],
  ["new-york", "N605PD", "A7DB1B", "Bell 407", "Nassau County Police Department", "Bethpage", "Helicopter", "Bell 407"],
  ["new-york", "N606PD", "A7DED2", "Bell 429", "Nassau County Police Department", "Bethpage", "Helicopter", "Bell 429"],
  ["new-york", "N407NY", "A4C7E5", "Bell 407", "New York City Police Aviation Unit", "Brooklyn", "Helicopter", "Bell 407"],
  ["new-york", "N917PD", "ACB1F5", "Bell 429", "New York City Police Department", "Brooklyn", "Helicopter", "Bell 429"],
  ["new-york", "N918PD", "ACB5AC", "Bell 429", "New York City Police Department", "Brooklyn", "Helicopter", "Bell 429"],
  ["new-york", "N919PD", "ACB963", "Bell 429", "New York City Police Department", "Brooklyn", "Helicopter", "Bell 429"],
  ["new-york", "N920PD", "ACBF73", "Bell 429", "New York City Police Department", "Brooklyn", "Helicopter", "Bell 429"],
  ["new-york", "N129SP", "A076BF", "Bell UH-1H", "New York State Police", "Albany", "Helicopter", "Bell UH-1H"],
  ["new-york", "N12SP", "A052F7", "Bell 430", "New York State Police", "Albany", "Helicopter", null],
  ["new-york", "N13SP", "A07A76", "Cessna 172H", "New York State Police", "Latham", "Plane", "Cessna 172 Skyhawk"],
  ["new-york", "N174SP", "A129A7", "Bell UH-1H", "New York State Police", "Albany", "Helicopter", "Bell UH-1H"],
  ["new-york", "N17SP", "A11872", "Bell 407", "New York State Police", "Albany", "Helicopter", "Bell 407"],
  ["new-york", "N19SP", "A16770", "Bell UH-1H", "New York State Police", "Albany", "Helicopter", "Bell UH-1H"],
  ["new-york", "N200NY", "A19346", "Beechcraft C-12C", "New York State Police", "Latham", "Plane", null],
  ["new-york", "N20SP", "A19148", "Bell 430", "New York State Police", "Albany", "Helicopter", null],
  ["new-york", "N430SP", "A524BC", "Airbus MBB-BK117 D-3", "New York State Police", "Latham", "Helicopter", null],
  ["new-york", "N605", "A7D9D1", "Partenavia P 68 OBSERVER", "New York State Police", "Albany", "Plane", null],
  ["new-york", "N61SP", "A7EE03", "Bell UH-1H", "New York State Police", "Albany", "Helicopter", "Bell UH-1H"],
  ["new-york", "N651SP", "A8920F", "Cessna U206G", "New York State Police", "Latham", "Plane", null],
  ["new-york", "N749SP", "AA1597", "Cessna U206G", "New York State Police", "Latham", "Plane", null],
  ["new-york", "N761NY", "AA4682", "Sikorsky S-76D", "New York State Police", "Latham", "Helicopter", null],
  ["new-york", "N948SP", "AD2C7E", "Kodiak 100", "New York State Police", "Latham", "Plane", null],
  ["new-york", "N959SP", "AD57B4", "Kodiak 100", "New York State Police", "Latham", "Plane", null],
  ["new-york", "N988SP", "ADCA7A", "Kodiak 100", "New York State Police", "Latham", "Plane", null],
  ["new-york", "N9SP", "AC6C18", "Airbus MBB-BK117 D-3", "New York State Police", "Latham", "Helicopter", null],
  ["new-york", "N224SP", "A1F17B", "Bell UH-1H", "New York State Police Aviation Unit", "Albany", "Helicopter", "Bell UH-1H"],
  ["new-york", "N882NC", "AC2672", "Bell OH-58C", "Niagara County Sheriffs Department", "Lockport", "Helicopter", "Bell OH-58A"],
  ["new-york", "N407SD", "A4C836", "Bell 407", "Onondaga County Sheriff's Office Aviation Unit", "Syracuse", "Helicopter", "Bell 407"],
  ["new-york", "N11SP", "A02B78", "Bell 407", "State Of New York / Division Of State Police", "Albany", "Helicopter", "Bell 407"],
  ["new-york", "N16SP", "A0F0F3", "Bell 407", "State Of New York / Division Of State Police", "Albany", "Helicopter", "Bell 407"],
  ["new-york", "N18SP", "A13FF1", "Bell 407", "State Of New York / Division Of State Police", "Albany", "Helicopter", "Bell 407"],
  ["new-york", "N361NY", "A41146", "Beechcraft B300", "State Of New York / Division Of State Police", "Albany", "Plane", "Beechcraft King Air B300"],
  ["new-york", "N427SP", "A5173E", "Bell 430", "State Of New York / Division Of State Police", "Albany", "Helicopter", null],
  ["new-york", "N432NY", "A52BCF", "Bell 430", "State Of New York / Division Of State Police", "Albany", "Helicopter", null],
  ["new-york", "N171PD", "A11E2D", "Airbus MBB-BK 117 C-2", "Suffolk County Police Department", "Yaphank", "Helicopter", null],
  ["new-york", "N352PD", "A3ED84", "Airbus AS 350 B2", "Suffolk County Police Department", "Yaphank", "Helicopter", "Eurocopter AS350B2"],
  ["new-york", "N354PD", "A3F4F2", "Airbus AS 350 B2", "Suffolk County Police Department", "Yaphank", "Helicopter", "Eurocopter AS350B2"],
  ["new-york", "N3PD", "A31BE9", "Airbus MBB-BK 117 C-2", "Suffolk County Police Department", "Yaphank", "Helicopter", null],
  ["new-york", "N536PD", "A6C800", "Bell 407", "Westchester County Department Of Public Safety", "Hawthorne", "Helicopter", "Bell 407"],
  ["new-york", "N592PD", "A7A61E", "Bell 407", "Westchester County Department Of Public Safety Trnspn", "Hawthorne", "Helicopter", "Bell 407"],
  ["north-carolina", "N8176S", "AB2698", "Bell OH-58A+", "Bladen County Sheriff Department North Carolina", "Elizabethtown", "Helicopter", "Bell OH-58A"],
  ["north-carolina", "N85359", "ABB5A6", "Bell OH-58C", "Bladen County Sheriffs Office", "Elizabethtown", "Helicopter", "Bell OH-58A"],
  ["north-carolina", "N314BC", "A355C9", "Bell OH-58A", "Brunswick County Sheriffs Office", "Bolivia", "Helicopter", "Bell OH-58A"],
  ["north-carolina", "N62619", "A82F24", "Bell UH-1H", "Brunswick County Sheriffs Office", "Bolivia", "Helicopter", "Bell UH-1H"],
  ["north-carolina", "N699RC", "A94D9F", "Bell OH-58A", "Brunswick County Sheriffs Office", "Bolivia", "Helicopter", "Bell OH-58A"],
  ["north-carolina", "N455PD", "A585F8", "Bell 407", "Charlotte Mecklenburg Police Department", "Charlotte", "Helicopter", "Bell 407"],
  ["north-carolina", "N406PD", "A4C434", "Bell 407", "Charlotte-Mecklenburg Police Department", "Charlotte", "Helicopter", "Bell 407"],
  ["north-carolina", "N67LE", "A8DA5E", "Bell OH-58C", "City Of Wilmington Police Department", "Wilmington", "Helicopter", "Bell OH-58A"],
  ["north-carolina", "N407NC", "A4C7D1", "Bell 407", "Nc Highway Patrol", "Cary", "Helicopter", "Bell 407"],
  ["north-carolina", "N193P", "A17495", "Cessna 206H", "Nc Wildlife Resources Commission Enforcement Div", "Raleigh", "Plane", "Cessna 206H"],
  ["north-carolina", "N123NC", "A06006", "Bell 206A", "North Carolina State Highway Patrol", "Cary", "Helicopter", null],
  ["north-carolina", "N401NC", "A4B187", "Bell 429", "North Carolina State Highway Patrol", "Cary", "Helicopter", "Bell 429"],
  ["north-carolina", "N404NC", "A4BCAC", "Bell 407", "North Carolina State Highway Patrol", "Cary", "Helicopter", "Bell 407"],
  ["north-carolina", "N405NC", "A4C063", "Bell 407", "North Carolina State Highway Patrol", "Cary", "Helicopter", "Bell 407"],
  ["north-carolina", "N406NC", "A4C41A", "Bell 407", "North Carolina State Highway Patrol", "Cary", "Helicopter", "Bell 407"],
  ["north-carolina", "N308HB", "A33DBB", "Bell OH-58A", "Robeson County Sheriffs Office", "Lumberton", "Helicopter", "Bell OH-58A"],
  ["north-carolina", "N306HB", "A3364D", "Bell OH-58A", "Wayne County Sheriffs Office", "Goldsboro", "Helicopter", "Bell OH-58A"],
  ["north-carolina", "N778AW", "AA86D4", "Bell OH-58A", "Wayne County Sheriffs Office", "Goldsboro", "Helicopter", "Bell OH-58A"],
  ["north-carolina", "N54LE", "A6D692", "Bell OH-58C", "Wilmington Police Department", "Wilmington", "Helicopter", "Bell OH-58A"],
  ["north-dakota", "N299SP", "A31887", "Cessna T206H", "North Dakota Highway Patrol", "Bismarck", "Plane", "Cessna T206H"],
  ["oklahoma", "N92CC", "ACBC06", "Cessna 172F", "Canadian Co Sheriffs Office", "El Reno", "Plane", "Cessna 172 Skyhawk"],
  ["oklahoma", "N620HP", "A816FA", "Cessna T206H", "Department Of Public Safety", "Norman", "Plane", "Cessna T206H"],
  ["oklahoma", "N740KC", "A9F36E", "Airbus AS350B3", "Oklahoma City Police Department Air Support Unit", "Oklahoma City", "Helicopter", "Airbus AS350B3 / H125"],
  ["oklahoma", "N760KC", "AA426C", "Airbus AS350B3", "Oklahoma City Police Department Air Support Unit", "Oklahoma City", "Helicopter", "Airbus AS350B3 / H125"],
  ["oklahoma", "N200HP", "A192C0", "Cessna U206G", "Oklahoma Department Of Public Safety", "Norman", "Plane", null],
  ["oklahoma", "N370HP", "A43488", "Airbus AS350B3", "Oklahoma Department Of Public Safety", "Norman", "Helicopter", "Airbus AS350B3 / H125"],
  ["oklahoma", "N90HP", "AC6D90", "Cessna 182T", "Oklahoma Department Of Public Safety", "Norman", "Plane", "Cessna 182 Skylane"],
  ["oklahoma", "N340RD", "A3BEC9", "Cessna 340", "Oklahoma State Bureau Of Narcotics And Dangerous", "Oklahoma City", "Plane", null],
  ["oklahoma", "N302TP", "A32877", "Airbus AS350B3", "Tulsa Police Department Air Support Unit", "Tulsa", "Helicopter", "Airbus AS350B3 / H125"],
  ["oklahoma", "N901TP", "AC749A", "Airbus AS350B3", "Tulsa Police Department Air Support Unit", "Tulsa", "Helicopter", "Airbus AS350B3 / H125"],
  ["oregon", "N425EJ", "A50E9F", "Cessna 182T", "City Of Portland / Portland Police Bureau", "Portland", "Plane", "Cessna 182 Skylane"],
  ["oregon", "N931EM", "ACE9D0", "Cessna 182P", "Clackamas County Sheriffs Office", "Oregon City", "Plane", "Cessna 182 Skylane"],
  ["oregon", "N4343Z", "A534D3", "Piper PA-18-150", "Hood River County Sheriff's Office", "Hood River", "Plane", null],
  ["oregon", "N910TW", "AC9869", "Cessna R172K", "Multnomah County Sheriffs Office", "Portland", "Plane", "Cessna R172K"],
  ["oregon", "N17386", "A127E1", "Cessna T206H", "Oregon State Police", "Salem", "Plane", "Cessna T206H"],
  ["oregon", "N2237S", "A1EF84", "Cessna T182T", "Oregon State Police", "Salem", "Plane", null],
  ["oregon", "N2163J", "A1D296", "Cessna 182T", "Portland Police Bureau", "Portland", "Plane", "Cessna 182 Skylane"],
  ["oregon", "N2181N", "A1D9C2", "Cessna 182T", "State Of Oregon / Department Of State Police", "Salem", "Plane", "Cessna 182 Skylane"],
  ["oregon", "N427AM", "A515AC", "Cessna T182T", "State Of Oregon / Oregon State Police", "Salem", "Plane", null],
  ["pennsylvania", "N296PD", "A30D0D", "Airbus AS350B2", "City Of Philadelphia / C/O Philadelphia Police Aviation Unit", "Philadelphia", "Helicopter", "Eurocopter AS350B2"],
  ["pennsylvania", "N297PD", "A310C4", "Airbus AS350B2", "City Of Philadelphia / C/O Philadelphia Police Aviation Unit", "Philadelphia", "Helicopter", "Eurocopter AS350B2"],
  ["pennsylvania", "N870ST", "ABF7F8", "Beechcraft B300", "Pennsylvania State Police", "Hershey", "Plane", "Beechcraft King Air B300"],
  ["pennsylvania", "N871ST", "ABFBAF", "Bell 407", "Pennsylvania State Police", "Hershey", "Helicopter", "Bell 407"],
  ["pennsylvania", "N872ST", "ABFF66", "Bell 407", "Pennsylvania State Police", "Hershey", "Helicopter", "Bell 407"],
  ["pennsylvania", "N873ST", "AC031D", "Bell 407", "Pennsylvania State Police", "Hershey", "Helicopter", "Bell 407"],
  ["pennsylvania", "N874ST", "AC06D4", "Bell 407", "Pennsylvania State Police", "Hershey", "Helicopter", "Bell 407"],
  ["pennsylvania", "N875ST", "AC0A8B", "Bell 407", "Pennsylvania State Police", "Hershey", "Helicopter", "Bell 407"],
  ["pennsylvania", "N876ST", "AC0E42", "Bell 407", "Pennsylvania State Police", "Hershey", "Helicopter", "Bell 407"],
  ["pennsylvania", "N878ST", "AC15B0", "Cessna 208B", "Pennsylvania State Police", "Hershey", "Plane", "Cessna 208B"],
  ["pennsylvania", "N879ST", "AC1967", "Pilatus PC-12/47E", "Pennsylvania State Police", "Hershey", "Plane", "Pilatus PC-12"],
  ["south-carolina", "N501TW", "A63F65", "Bell OH-58A", "Anderson County Sheriffs Office", "Anderson", "Helicopter", "Bell OH-58A"],
  ["south-carolina", "N930BC", "ACE5C5", "Bell 206B", "Beaufort County Sheriffs Office", "Beaufort", "Helicopter", "Bell 206B"],
  ["south-carolina", "N430CC", "A52353", "Bell 407", "Charleston County Sheriffs Office", "North Charleston", "Helicopter", "Bell 407"],
  ["south-carolina", "N18FC", "A13ED3", "Bell OH-58A", "Florence County Sheriff Department", "Effingham", "Helicopter", "Bell OH-58A"],
  ["south-carolina", "N58FC", "A7740F", "Bell OH-58A", "Florence County Sheriff Department", "Effingham", "Helicopter", "Bell OH-58A"],
  ["south-carolina", "N258FC", "A275B6", "Bell OH-58", "Florence County Sherrifs Department", "Effingham", "Helicopter", "Bell OH-58A"],
  ["south-carolina", "N158PS", "A0E93D", "Bell OH-58C", "Greenville County Sheriffs Office", "Greenville", "Helicopter", "Bell OH-58A"],
  ["south-carolina", "N232GS", "A21095", "Bell OH-58C", "Greenville County Sheriffs Office", "Greenville", "Helicopter", "Bell OH-58A"],
  ["south-carolina", "N233GS", "A2144C", "Cessna 182P", "Greenville County Sheriffs Office", "Greenville", "Plane", "Cessna 182 Skylane"],
  ["south-carolina", "N545TS", "A6EC39", "Bell OH-58A", "Oconee County Sheriff Department", "Walhalla", "Helicopter", "Bell OH-58A"],
  ["south-carolina", "N94550", "AD22DB", "Bell OH-58C", "Oconee County Sheriff's Department", "Walhalla", "Helicopter", "Bell OH-58A"],
  ["south-carolina", "N182PC", "A14962", "Cessna 182Q", "Pickens County Sheriffs Office", "Pickens", "Plane", "Cessna 182 Skylane"],
  ["south-carolina", "N263RC", "A28B9C", "Cessna T206H", "Richland County Sheriffs Department", "Columbia", "Plane", "Cessna T206H"],
  ["south-carolina", "N502SL", "A642F9", "MD Helicopters 369E", "Sc Law Enforcement Division", "Columbia", "Helicopter", "McDonnell Douglas 369E"],
  ["south-carolina", "N500SC", "A63B83", "Bell 407", "South Carolina Law Enforcement Division", "Columbia", "Helicopter", "Bell 407"],
  ["south-carolina", "N504SL", "A64A67", "MD Helicopters 369E", "South Carolina Law Enforcement Division", "Columbia", "Helicopter", "McDonnell Douglas 369E"],
  ["south-carolina", "N600SC", "A7C8D2", "Bell 412EP", "South Carolina Law Enforcement Division", "Columbia", "Helicopter", "Bell 412EP"],
  ["south-carolina", "N142SC", "A0ABB1", "Hughes 369A", "Spartanburg County Sheriffs Office", "Spartanburg", "Helicopter", null],
  ["south-carolina", "N67099", "A8DF6D", "Bell 206B", "Spartanburg County Sheriffs Office", "Spartanburg", "Helicopter", "Bell 206B"],
  ["south-carolina", "N734XQ", "A9DC03", "Cessna 172N", "Sumter County Sheriffs Office", "Sumter", "Plane", "Cessna 172 Skyhawk"],
  ["south-dakota", "N2118A", "A1C0AA", "Cessna T206H", "South Dakota Highway Patrol", "Pierre", "Plane", "Cessna T206H"],
  ["tennessee", "N6401X", "A867CC", "Bell 206B", "City Of Memphis / Police Department", "Memphis", "Helicopter", "Bell 206B"],
  ["tennessee", "N350MP", "A3E5EE", "Airbus AS 350 B3", "City Of Memphis Police Department", "Memphis", "Helicopter", "Airbus AS350B3 / H125"],
  ["tennessee", "N425PD", "A50F7B", "Bell OH-58A", "Jackson Police Department", "Jackson", "Helicopter", "Bell OH-58A"],
  ["tennessee", "N919AW", "ACB82F", "Bell OH-58A", "Knox County Sheriffs Depart", "Knoxville", "Helicopter", "Bell OH-58A"],
  ["tennessee", "N912AW", "AC9E2E", "Bell OH-58A", "Knox County Sheriffs Department", "Knoxville", "Helicopter", "Bell OH-58A"],
  ["tennessee", "N910KC", "AC978F", "Bell UH-1H", "Knox County Sheriffs Office", "Knoxville", "Helicopter", "Bell UH-1H"],
  ["tennessee", "N912AU", "AC9E2C", "Bell OH-58A", "Knox County Sheriffs Office", "Knoxville", "Helicopter", "Bell OH-58A"],
  ["tennessee", "N919AU", "ACB82D", "Bell OH-58A", "Knox County Sheriffs Office", "Knoxville", "Helicopter", "Bell OH-58A"],
  ["tennessee", "N164K", "A1016B", "Bell 206B", "Memphis Police Department", "Memphis", "Helicopter", "Bell 206B"],
  ["tennessee", "N41EW", "A4D240", "Bell 206B", "Memphis Police Department", "Memphis", "Helicopter", "Bell 206B"],
  ["tennessee", "N929NP", "ACE0D3", "Airbus AS350B3", "Metro Nashville Police", "Nashville", "Helicopter", "Airbus AS350B3 / H125"],
  ["tennessee", "N703MP", "A960D4", "Bell OH-58A", "Metro-Nashville P D", "Nashville", "Helicopter", "Bell OH-58A"],
  ["tennessee", "N704MP", "A9648B", "Bell OH-58A", "Metro-Nashville Pd", "Nashville", "Helicopter", "Bell OH-58A"],
  ["tennessee", "N849NP", "ABA282", "Airbus AS350B3", "Metropolitan Nashville Police", "Nashville", "Helicopter", "Airbus AS350B3 / H125"],
  ["tennessee", "N300PC", "A3209A", "Bell OH-58", "Putnam County Sheriff's Department", "Cookeville", "Helicopter", "Bell OH-58A"],
  ["tennessee", "N1872", "A15D4B", "Bell 206C", "Putnam County Sheriff's Ofice", "Cookeville", "Helicopter", null],
  ["tennessee", "N720HP", "A9A449", "Bell 407", "Tennessee Highway Patrol Department Of Safety", "Nashville", "Helicopter", "Bell 407"],
  ["tennessee", "N730HP", "A9CBC8", "Bell 407", "Tennessee Highway Patrol Department Of Safety", "Nashville", "Helicopter", "Bell 407"],
  ["tennessee", "N901TN", "AC7499", "Bell OH-58A", "Tn Department Of Public Safety", "Nashville", "Helicopter", "Bell OH-58A"],
  ["tennessee", "N7900N", "AABA6A", "Cessna R172E", "Warren County Sheriffs Department", "Mcminnville", "Plane", null],
  ["tennessee", "N615WC", "A80348", "Bell OH-58A", "Williamson County Sheriff Office", "Franklin", "Helicopter", "Bell OH-58A"],
  ["tennessee", "N617WC", "A80AB6", "Bell UH-1V", "Williamson County Sheriff's Office", "Franklin", "Helicopter", null],
  ["tennessee", "N616WC", "A806FF", "Bell OH-58C", "Williamson County Sherrif's Office", "Franklin", "Helicopter", "Bell OH-58A"],
  ["utah", "N211S", "A1BEC9", "Cessna U206G", "Sherrifs Office Kane County Utah", "Kanab", "Plane", null],
  ["utah", "N505UC", "A64E48", "Utah County Sheriff CCX-2000", "Utah County Sheriff", "Spanish Fork", "Plane", null],
  ["utah", "N93354", "ACF3F2", "Cessna T210L", "Utah County Sheriff", "Spanish Fork", "Plane", null],
  ["utah", "N352HP", "A3ECF8", "Airbus AS350B3", "Utah Department of Public Safety Aero Bureau", "Salt Lake City", "Helicopter", "Airbus AS350B3 / H125"],
  ["utah", "N353HP", "A3F0AF", "Airbus AS350B3", "Utah Department of Public Safety Aero Bureau", "Salt Lake City", "Helicopter", "Airbus AS350B3 / H125"],
  ["utah", "N354HP", "A3F466", "Airbus AS350B3", "Utah Department of Public Safety Aero Bureau", "Salt Lake City", "Helicopter", "Airbus AS350B3 / H125"],
  ["virginia", "N40VA", "A4AC24", "Bell 412EP", "Commonwealth Of Virgina Department Of State Police", "Richmond", "Helicopter", "Bell 412EP"],
  ["virginia", "N210VA", "A1BB5E", "Kodiak 100", "Commonwealth Of Virginia / Department Of State Police", "North Chesterfield", "Plane", null],
  ["virginia", "N30VA", "A31ED5", "Bell 407", "Commonwealth Of Virginia / Department Of State Police", "Richmond", "Helicopter", "Bell 407"],
  ["virginia", "N33VA", "A39552", "Kodiak 100", "Commonwealth Of Virginia / Department Of State Police", "North Chesterfield", "Plane", null],
  ["virginia", "N34VA", "A3BCD1", "Bell 407", "Commonwealth Of Virginia / Department Of State Police", "Richmond", "Helicopter", "Bell 407"],
  ["virginia", "N36VA", "A40BCF", "Bell 407", "Commonwealth Of Virginia / Department Of State Police", "N Chesterfield", "Helicopter", "Bell 407"],
  ["virginia", "N53VA", "A6AFF0", "Bell 407", "Commonwealth Of Virginia / Department Of State Police", "North Chesterfield", "Helicopter", "Bell 407"],
  ["virginia", "N876VA", "AC0E7C", "Kodiak 100", "Commonwealth Of Virginia / Department Of State Police", "North Chesterfield", "Plane", null],
  ["virginia", "N211FX", "A1BDCC", "Bell 429", "Fairfax County Police Department Helicopter Division", "Fairfax", "Helicopter", "Bell 429"],
  ["virginia", "N212FX", "A1C183", "Bell 429", "Fairfax County Police Department Helicopter Division", "Fairfax", "Helicopter", "Bell 429"],
  ["virginia", "N665HC", "A8C77E", "Cessna T206H", "Henrico County Police Division / Metro Aviation Unit", "Henrico", "Plane", "Cessna T206H"],
  ["virginia", "N531VB", "A6B601", "MD Helicopters 369FF", "Virginia Beach Police Department Aviation Unit", "Virginia Beach", "Helicopter", "MD Helicopters 369FF / MD 530F"],
  ["virginia", "N911VB", "AC9C3F", "MD Helicopters 369FF", "Virginia Beach Police Department Aviation Unit", "Virginia Beach", "Helicopter", "MD Helicopters 369FF / MD 530F"],
  ["virginia", "N26VA", "A27E80", "Bell 407", "Virginia State Police", "Richmond", "Helicopter", "Bell 407"],
  ["virginia", "N28VA", "A2CD7E", "Bell 412EP", "Virginia State Police", "Richmond", "Helicopter", "Bell 412EP"],
  ["virginia", "N71VA", "A97B90", "Bell 407", "Virginia State Police", "North Chesterfield", "Helicopter", "Bell 407"],
  ["west-virginia", "N890SP", "AC46F2", "Bell 206B", "West Virginia State Police", "South Charleston", "Helicopter", "Bell 206B"],
  ["west-virginia", "N895SP", "AC5985", "Bell 206B", "West Virginia State Police", "South Charleston", "Helicopter", "Bell 206B"],
  ["wisconsin", "N831MA", "AB5D25", "Cessna 172S", "Wisconsin State Patrol", "Madison", "Plane", "Cessna 172 Skyhawk"],
  ["wisconsin", "N832MA", "AB60DC", "Cessna 172S", "Wisconsin State Patrol", "Madison", "Plane", "Cessna 172 Skyhawk"],
  ["wisconsin", "N833MA", "AB6493", "Cessna 172S", "Wisconsin State Patrol", "Madison", "Plane", "Cessna 172 Skyhawk"],
  ["wyoming", "N335SB", "A3A9F4", "Aviat Husky A-1B", "Park County Sheriffs Office", "Cody", "Plane", null]
];

// lib/aircraft-directory.ts
var WA_ROWS = [
  ["N102LP", "Cessna 182T Skylane", "WSP", "145 ktas / 167 mph", "Approx. 6.0 hours", 360],
  ["N207HB", "Beechcraft King Air B200", "State of WA", "290 kts / 334 mph", "Approx. 5.4-7.0 hours, depending on cruise setting", 372],
  ["N2446X", "Cessna 206H Stationair", "WSP", "142 kts / 163 mph", "Approx. 5.4 hours range-derived; WSP mission profile often listed at 6-8 hours", 420],
  ["N305DK", "Cessna 206H Stationair", "WSP", "142 kts / 163 mph", "Approx. 5.4 hours range-derived; WSP mission profile often listed at 6-8 hours", 420],
  ["N305RC", "Cessna 182T Skylane", "WSP", "145 ktas / 167 mph", "Approx. 6.0 hours", 360],
  ["N3532K", "Cessna 182T Skylane", "WSP historical", "145 ktas / 167 mph", "Approx. 6.0 hours by aircraft type", 360],
  ["N407KS", "Bell 407", "KCSO", "133 kts / 153 mph max cruise", "Approx. 4.0 hours", 240],
  ["N411KS", "Bell 206B JetRanger", "KCSO former", "118 kts / 136 mph", "Approx. 3.0-3.3 hours range-derived", 189],
  ["N67817", "Bell 206B / TH-67A type", "KCSO", "118 kts / 136 mph", "Approx. 3.0-3.3 hours range-derived", 189],
  ["N67880", "Bell 206B / TH-67A type", "KCSO", "118 kts / 136 mph", "Approx. 3.0-3.3 hours range-derived", 189],
  ["N78906", "Bell 206B / TH-67A type", "KCSO", "118 kts / 136 mph", "Approx. 3.0-3.3 hours range-derived", 189],
  ["N790RJ", "Bell UH-1H Huey", "KCSO", "117 kts / 135 mph", "Approx. 2.5 hours range-derived", 150],
  ["N71KP", "Bell UH-1H Iroquois", "KCSO reserve", "117 kts / 135 mph", "Approx. 2.5 hours range-derived", 150],
  ["N815SC", "Bell UH-1H Huey", "Snohomish SO", "117 kts / 135 mph", "Approx. 2.5 hours range-derived", 150],
  ["N9446P", "Cessna T206H Turbo Stationair", "Pierce SO", "161 ktas / 185 mph", "Approx. 4.4-5.0 hours range-derived", 282],
  ["N422CT", "Bell 407 / 407GXi", "KCSO", "133 kts / 153 mph max cruise", "Approx. 4.0 hours", 240],
  ["N509DV", "Bell 505 Jet Ranger X", "Spokane SO", "133 kt / 153 mph", "Approx. 4.5 hours with auxiliary fuel", 270],
  ["CGNR6594", "Eurocopter MH-65E Dolphin", "USCG Port Angeles", "148 kt cruise", "Approx. 3.5 hours", 210]
];
var WA = WA_ROWS.map(
  ([tail, model, unit, speedText, enduranceText, durationMin]) => ({
    stateId: "washington",
    tail,
    model,
    unit,
    speedText,
    enduranceText,
    durationMin
  })
);
var NEW_ROW_DATA = [
  ["california", "N976HP", "Airbus AS350B3 / H125", "CHP H14 / Northern Division, Redding", "~155 kt Vne / ~136 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N511HP", "Cessna T206H Turbo Stationair", "CHP Air11 / Northern Division, Redding", "~161 kt", "~4 hr 45 min", 285],
  ["california", "N159HP", "GippsAero GA8 TC-320 Airvan", "CHP Air13 / Northern Division, Redding", "~130 kt", "~6 hr 30 min", 390],
  ["california", "N617HP", "Eurocopter AS350B3", "CHP H1 / Headquarters helicopter, McClellan", "~155 kt Vne / ~136 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N974HP", "Airbus AS350B3 / H125", "CHP H20 / Valley Division, Auburn", "~155 kt Vne / ~136 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N978HP", "Airbus AS350B3 / H125", "CHP H24 / Valley Division, Auburn", "~155 kt Vne / ~136 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N202HP", "Cessna 208B Grand Caravan", "CHP Air21 / Valley Division, Auburn", "~185 kt", "~5 hr 00 min", 300],
  ["california", "N153HP", "GippsAero GA8 TC-320 Airvan", "CHP Air23 / Valley Division, Auburn", "~130 kt", "~6 hr 30 min", 390],
  ["california", "N981HP", "Airbus AS350B3 / H125", "CHP H30 / Golden Gate Division, Napa", "~155 kt Vne / ~136 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N982HP", "Airbus AS350B3 / H125", "CHP H32 / Golden Gate Division, Napa", "~155 kt Vne / ~136 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N137HP", "GippsAero GA8 TC-320 Airvan", "CHP Air37 / Golden Gate Division, Napa", "~130 kt", "~6 hr 30 min", 390],
  ["california", "N975HP", "Airbus AS350B3 / H125", "CHP H40 / Central Division, Fresno", "~155 kt Vne / ~136 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N986HP", "Airbus AS350B3 / H125", "CHP H42 / Central Division, Fresno", "~155 kt Vne / ~136 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N156HP", "GippsAero GA8 TC-320 Airvan", "CHP Air41 / Central Division, Fresno", "~130 kt", "~6 hr 30 min", 390],
  ["california", "N139HP", "GippsAero GA8 TC-320 Airvan", "CHP Air43 / Central Division, Fresno", "~130 kt", "~6 hr 30 min", 390],
  ["california", "N983HP", "Airbus AS350B3 / H125", "CHP H70 / Coastal Division, Paso Robles", "~155 kt Vne / ~136 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N443HP", "Cessna T206H Turbo Stationair", "CHP Air71 / Coastal Division, Paso Robles", "~161 kt", "~4 hr 45 min", 285],
  ["california", "N553HP", "Cessna T206H Turbo Stationair", "CHP Air73 / Coastal Division, Paso Robles", "~161 kt", "~4 hr 45 min", 285],
  ["california", "N984HP", "Airbus AS350B3 / H125", "CHP H80 / Inland Division, Apple Valley", "~155 kt Vne / ~136 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N985HP", "Airbus AS350B3 / H125", "CHP H82 / Inland Division, Apple Valley", "~155 kt Vne / ~136 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N441HP", "Cessna T206H Turbo Stationair", "CHP Air81 / Inland Division, Apple Valley", "~161 kt", "~4 hr 45 min", 285],
  ["california", "N513HP", "Cessna T206H Turbo Stationair", "CHP Air83 / Inland Division, Apple Valley", "~161 kt", "~4 hr 45 min", 285],
  ["california", "N979HP", "Airbus AS350B3 / H125", "CHP H58 / Southern Division, Fullerton", "~155 kt Vne / ~136 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N140HP", "GippsAero GA8 TC-320 Airvan", "CHP Air51 / Southern Division, Fullerton", "~130 kt", "~6 hr 30 min", 390],
  ["california", "N988HP", "Airbus AS350B3 / H125", "CHP H60 / Border Division, Thermal", "~155 kt Vne / ~136 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N661HP", "Cessna T206H Turbo Stationair", "CHP Air61 / Border Division, Thermal", "~161 kt", "~4 hr 45 min", 285],
  ["california", "N551HP", "Cessna T206H Turbo Stationair", "CHP Air63 / Border Division, Thermal", "~161 kt", "~4 hr 45 min", 285],
  ["texas", "N60TX", "Airbus AS350B2", "Texas DPS", "~155 kt Vne / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["texas", "N90TX", "Airbus AS350B2", "Texas DPS", "~155 kt Vne / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["texas", "N124TX", "Airbus AS350B2", "Texas DPS", "~155 kt Vne / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["texas", "N204TX", "Airbus AS350B2", "Texas DPS", "~155 kt Vne / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["texas", "N405TX", "Airbus AS350B2", "Texas DPS", "~155 kt Vne / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["texas", "N702TX", "Airbus AS350B2", "Texas DPS", "~155 kt Vne / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["texas", "N227TX", "Airbus AS350B3 / H125", "Texas DPS", "~155 kt Vne / ~136 kt fast cruise", "~4 hr 00 min", 240],
  ["texas", "N2374F", "Airbus AS350B3 / H125", "Texas DPS", "~155 kt Vne / ~136 kt fast cruise", "~4 hr 00 min", 240],
  ["texas", "N329TX", "Airbus AS350B3 / H125", "Texas DPS", "~155 kt Vne / ~136 kt fast cruise", "~4 hr 00 min", 240],
  ["texas", "N361TX", "Airbus AS350B3 / H125", "Texas DPS", "~155 kt Vne / ~136 kt fast cruise", "~4 hr 00 min", 240],
  ["texas", "N674TX", "Airbus AS350B3 / H125", "Texas DPS", "~155 kt Vne / ~136 kt fast cruise", "~4 hr 00 min", 240],
  ["texas", "N819TX", "Airbus AS350B3 / H125", "Texas DPS", "~155 kt Vne / ~136 kt fast cruise", "~4 hr 00 min", 240],
  ["texas", "N824TX", "Airbus AS350B3 / H125", "Texas DPS", "~155 kt Vne / ~136 kt fast cruise", "~4 hr 00 min", 240],
  ["texas", "N827TX", "Airbus AS350B3 / H125", "Texas DPS", "~155 kt Vne / ~136 kt fast cruise", "~4 hr 00 min", 240],
  ["texas", "N844TX", "Airbus AS350B3 / H125", "Texas DPS", "~155 kt Vne / ~136 kt fast cruise", "~4 hr 00 min", 240],
  ["texas", "N929TX", "Airbus AS350B3 / H125", "Texas DPS", "~155 kt Vne / ~136 kt fast cruise", "~4 hr 00 min", 240],
  ["texas", "N145TX", "MBB / Airbus BK117 C-2 / EC145", "Texas DPS", "~133 kt", "~3 hr 30 min", 210],
  ["texas", "N1727L", "Cessna T206H Turbo Stationair", "Texas DPS", "~161 kt", "~4 hr 45 min", 285],
  ["texas", "N5271B", "Cessna T206H Turbo Stationair", "Texas DPS", "~161 kt", "~4 hr 45 min", 285],
  ["texas", "N219TX", "Pilatus PC-12/47E", "Texas DPS", "~290 kt", "~7 hr 00 min", 420],
  ["texas", "N243TX", "Pilatus PC-12/47E", "Texas DPS", "~290 kt", "~7 hr 00 min", 420],
  ["texas", "N430TX", "Cessna 208 Caravan", "Texas DPS", "~186 kt", "~5 hr 30 min", 330],
  ["texas", "N956TX", "Cessna 208 Caravan", "Texas DPS", "~186 kt", "~5 hr 30 min", 330],
  ["texas", "N968TX", "Cessna 208 Caravan", "Texas DPS", "~186 kt", "~5 hr 30 min", 330],
  ["florida", "N25HP", "Cessna 182T Skylane", "Florida Highway Patrol", "~145 kt", "~5 hr 30 min", 330],
  ["florida", "N611HP", "Cessna 182T Skylane", "Florida Highway Patrol", "~145 kt", "~5 hr 30 min", 330],
  ["florida", "N267HP", "Cessna 172S Skyhawk", "Florida Highway Patrol", "~124 kt", "~5 hr 00 min", 300],
  ["florida", "N610HP", "Cessna 172RG Cutlass RG", "Florida Highway Patrol", "~144 kt", "~5 hr 00 min", 300],
  ["florida", "N706HP", "Cessna R182 Skylane RG", "Florida Highway Patrol", "~150-187 kt, depending source/config", "~5 hr 00 min", 300],
  ["florida", "N531HP", "Cessna T206H Turbo Stationair", "Florida Highway Patrol", "~161 kt", "~4 hr 45 min", 285],
  ["florida", "N773HP", "Cessna T206H Turbo Stationair", "Florida Highway Patrol", "~161 kt", "~4 hr 45 min", 285],
  ["ohio", "N6HP", "Cessna 182T Skylane", "Ohio State Highway Patrol", "~145 kt", "~5 hr 30 min", 330],
  ["ohio", "N12HP", "Cessna 182T Skylane", "Ohio State Highway Patrol", "~145 kt", "~5 hr 30 min", 330],
  ["ohio", "N17HP", "Cessna 182T Skylane", "Ohio State Highway Patrol", "~145 kt", "~5 hr 30 min", 330],
  ["ohio", "N18HP", "Cessna 182T Skylane", "Ohio State Highway Patrol", "~145 kt", "~5 hr 30 min", 330],
  ["ohio", "N19HP", "Cessna 182T Skylane", "Ohio State Highway Patrol", "~145 kt", "~5 hr 30 min", 330],
  ["ohio", "N113HP", "Cessna 182T Skylane", "Ohio State Highway Patrol", "~145 kt", "~5 hr 30 min", 330],
  ["ohio", "N514HP", "Cessna 182T Skylane", "Ohio State Highway Patrol", "~145 kt", "~5 hr 30 min", 330],
  ["ohio", "N716HP", "Cessna 182T Skylane", "Ohio State Highway Patrol", "~145 kt", "~5 hr 30 min", 330],
  ["ohio", "N311HP", "Cessna 182S Skylane", "Ohio State Highway Patrol", "~145 kt", "~5 hr 30 min", 330],
  ["ohio", "N71HP", "Airbus AS350B2", "Ohio State Highway Patrol", "~155 kt Vne / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["ohio", "N73HP", "Airbus AS350B2", "Ohio State Highway Patrol", "~155 kt Vne / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["ohio", "N72HP", "Airbus H125", "Ohio State Highway Patrol", "~155 kt Vne / ~136 kt fast cruise", "~4 hr 00 min", 240],
  ["colorado", "N202SP", "Cessna T182T Turbo Skylane", "Colorado State Patrol", "~165 kt", "~4 hr 45 min", 285],
  ["colorado", "N203SP", "Cessna T182T Turbo Skylane", "Colorado State Patrol", "~165 kt", "~4 hr 45 min", 285],
  ["colorado", "N201SP", "Pilatus PC-12/47E", "Colorado State Patrol", "~290 kt", "~7 hr 00 min", 420]
];
var LOCAL_ROW_DATA = [
  // California
  ["california", "N408DC", "Kodiak 100", "City of San Jose / Police Department", "320 gal", "174 ktas", "~9 hr 54 min", 594],
  ["california", "N408PD", "Airbus AS350B3 / H125", "City of San Jose / Police Department", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N220PD", "McDonnell Douglas 369E", "City of Oakland / Police Department Helicopter Unit", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["california", "N330PD", "Schweizer 269C-1", "City of Oakland / Police Department Helicopter Unit", "~41 gal", "95 kt", "~3 hr 30 min", 210],
  ["california", "N510PD", "McDonnell Douglas 369E", "City of Oakland / Police Department Helicopter Unit", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["california", "N407CC", "Bell 407", "Contra Costa County", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["california", "N408CC", "Bell 407", "Contra Costa County", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["california", "N175JC", "Socata TBM 700", "Sacramento County Sheriff's Office", "290 gal", "300 kt", "~5 hr 00 min", 300],
  ["california", "N255SD", "Eurocopter EC120B", "Sacramento County Sheriff's Office", "110 gal", "125 kt", "~4 hr 32 min", 272],
  ["california", "N266SD", "Eurocopter EC120B", "Sacramento County Sheriff's Office", "110 gal", "125 kt", "~4 hr 32 min", 272],
  ["california", "N277SD", "Eurocopter EC120B", "Sacramento County Sheriff's Office", "110 gal", "125 kt", "~4 hr 32 min", 272],
  ["california", "N774FL", "Cessna T206H", "Sacramento County Sheriff's Office", "87 gal", "161 ktas", "~4 hr 45 min", 285],
  ["california", "N911GC", "Bell UH-1H", "Sacramento County Sheriff's Office", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["california", "N911RY", "Bell UH-1H", "Sacramento County Sheriff's Office", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["california", "N920FC", "MD Helicopters 369FF", "Fresno County Sheriff / County of Fresno", "403 lb / ~60 gal", "~136 kt", "~2 hr 30 min", 150],
  ["california", "N921SD", "McDonnell Douglas 369E", "Fresno County Sheriff / County of Fresno", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["california", "N922SD", "McDonnell Douglas 369E", "Fresno County Sheriff / County of Fresno", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["california", "N514JD", "Eurocopter EC120B", "City of Fresno", "110 gal", "125 kt", "~4 hr 32 min", 272],
  ["california", "N524MW", "Eurocopter EC120B", "City of Fresno", "110 gal", "125 kt", "~4 hr 32 min", 272],
  ["california", "N534PD", "Airbus AS350B3 / H125", "City of Fresno / Fresno Police Department", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N189JC", "Textron Aviation / Cessna T206H", "Tulare County Sheriff", "87 gal", "~161 ktas", "~4 hr 45 min", 285],
  ["california", "N297E", "Hughes 369E", "Kern County Sheriff's Department / County of Kern", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["california", "N35438", "Cessna T206H", "Kern County Sheriff's Department", "87 gal", "161 ktas", "~4 hr 45 min", 285],
  ["california", "N397E", "Bell OH-58A", "Kern County Sheriff's Department", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["california", "N497E", "Bell OH-58A", "Kern County Sheriff's Department", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["california", "N597E", "Bell UH-1H", "Kern County Sheriff's Department / County of Kern", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["california", "N911KC", "Rockwell International 690A", "Kern County Sheriff's Department / County of Kern", "~384 gal", "~283 kt", "~4 hr 30 min", 270],
  ["california", "N912KC", "Airbus AS350B3", "Kern County Sheriff's Department", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N913KC", "Airbus AS350B3", "Kern County Sheriff's Department", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N737ZA", "Cessna 172N", "County of Santa Cruz", "53 gal total / 50 gal usable", "163 kt", "~7 hr 54 min", 474],
  ["california", "N991YC", "Bell OH-58A", "City of Sacramento", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  // Southern California local agencies
  ["california", "N213PF", "Airbus AS350B3 / H125", "Los Angeles Police Department / LAPD Air Support Division", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N221LA", "Airbus AS350B3 / H125", "Los Angeles Police Department / LAPD Air Support Division", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N223LA", "Airbus AS350B3 / H125", "Los Angeles Police Department / LAPD Air Support Division", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N224LA", "Airbus AS350B3 / H125", "Los Angeles Police Department / LAPD Air Support Division", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N225LA", "Airbus AS350B3 / H125", "Los Angeles Police Department / LAPD Air Support Division", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N226LA", "Airbus AS350B3 / H125", "Los Angeles Police Department / LAPD Air Support Division", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N228LA", "Eurocopter AS350B2", "Los Angeles Police Department / LAPD Air Support Division", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N230LA", "Airbus AS350B3 / H125", "Los Angeles Police Department / LAPD Air Support Division", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N232LA", "Airbus AS350B3 / H125", "Los Angeles Police Department / LAPD Air Support Division", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N233LA", "Airbus AS350B3 / H125", "Los Angeles Police Department / LAPD Air Support Division", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N267LA", "Airbus AS350B3 / H125", "Los Angeles Police Department / LAPD Air Support Division", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N472LA", "Airbus AS350B3 / H125", "Los Angeles Police Department / LAPD Air Support Division", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N665PD", "Eurocopter AS350B2", "Los Angeles Police Department / LAPD Air Support Division", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N913WB", "Eurocopter AS350B2", "Los Angeles Police Department / LAPD Air Support Division", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N104RC", "McDonnell Douglas 369E", "Los Angeles County Sheriff's Department", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["california", "N535JP", "McDonnell Douglas 369E", "Los Angeles County Sheriff's Department", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["california", "N6330C", "Cessna 210N", "Los Angeles County Sheriff's Department", "90 gal", "174 kt", "~5 hr 15 min", 315],
  ["california", "N732WQ", "Cessna T210M", "Los Angeles County Sheriff's Department", "90 gal", "~205 kt", "~5 hr 00 min", 300],
  ["california", "N950JE", "Airbus / Eurocopter AS332L1", "Los Angeles County Sheriff's Department / County of Los Angeles", "~370 gal", "~150 kt max / ~140 kt cruise", "~4 hr 00 min", 240],
  ["california", "N950LA", "Eurocopter AS350B2", "Los Angeles County Sheriff's Department / County of Los Angeles", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N951LA", "Eurocopter AS350B2", "Los Angeles County Sheriff's Department / County of Los Angeles", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N951LB", "Airbus / Eurocopter AS332L1", "Los Angeles County Sheriff's Department / County of Los Angeles", "~370 gal", "~150 kt max / ~140 kt cruise", "~4 hr 00 min", 240],
  ["california", "N952JH", "Airbus / Eurocopter AS332L1", "Los Angeles County Sheriff's Department / County of Los Angeles", "~370 gal", "~150 kt max / ~140 kt cruise", "~4 hr 00 min", 240],
  ["california", "N953LA", "Eurocopter AS350B2", "Los Angeles County Sheriff's Department / County of Los Angeles", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N954LA", "Eurocopter AS350B2", "Los Angeles County Sheriff's Department / County of Los Angeles", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N955LA", "Eurocopter AS350B2", "Los Angeles County Sheriff's Department / County of Los Angeles", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N956LA", "Eurocopter AS350B2", "Los Angeles County Sheriff's Department / County of Los Angeles", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N957LA", "Eurocopter AS350B2", "Los Angeles County Sheriff's Department / County of Los Angeles", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N958LA", "Eurocopter AS350B2", "Los Angeles County Sheriff's Department / County of Los Angeles", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N959LA", "Eurocopter AS350B2", "Los Angeles County Sheriff's Department / County of Los Angeles", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N960LA", "Eurocopter AS350B2", "Los Angeles County Sheriff's Department / County of Los Angeles", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N961LA", "Eurocopter AS350B2", "Los Angeles County Sheriff's Department / County of Los Angeles", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N961SD", "Eurocopter AS350B2", "Los Angeles County Sheriff's Department / County of Los Angeles", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N962LA", "Eurocopter AS350B2", "Los Angeles County Sheriff's Department / County of Los Angeles", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N963SD", "Eurocopter AS350B2", "Los Angeles County Sheriff's Department / County of Los Angeles", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N966SD", "Eurocopter AS350B2", "Los Angeles County Sheriff's Department / County of Los Angeles", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N166PD", "Robinson R66", "City of Fontana", "73.6 gal", "120 kt", "~3 hr 42 min", 222],
  ["california", "N462PD", "Robinson R66", "City of Fontana", "73.6 gal", "120 kt", "~3 hr 42 min", 222],
  ["california", "N641EG", "American Eurocopter AS350B2", "City of Fontana", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N226PD", "Eurocopter AS350B2", "Anaheim Police Department", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N28LB", "Eurocopter AS350B2", "City of Long Beach", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N29LB", "Eurocopter AS350B2", "City of Long Beach", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N9495F", "Hughes 269B", "City of Long Beach", "32 gal", "95 kt", "~3 hr 30 min", 210],
  ["california", "N9549F", "Hughes 269B", "City of Long Beach", "32 gal", "95 kt", "~3 hr 30 min", 210],
  ["california", "N165PW", "GippsAero GA8 TC-320", "San Bernardino County Sheriff's Department", "~87.7 gal", "~130 kt", "~8 hr 12 min", 492],
  ["california", "N214SB", "Beech A200", "San Bernardino County Sheriff's Department", "549 gal", "~289 kt", "~5 hr 00 min", 300],
  ["california", "N265PW", "GippsAero GA8 TC-320", "San Bernardino County Sheriff's Department", "~87.7 gal", "~130 kt", "~8 hr 12 min", 492],
  ["california", "N305SB", "Bell UH-1H", "San Bernardino County Sheriff's Department", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["california", "N307SB", "Bell 212", "San Bernardino County Sheriff's Department", "215 gal", "130 kt Vmo", "~3 hr 30 min", 210],
  ["california", "N308SB", "Bell 412EP", "San Bernardino County Sheriff's Department", "331 gal standard", "126 kt", "~3 hr 48 min", 228],
  ["california", "N309SB", "Bell UH-1H", "San Bernardino County Sheriff's Department", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["california", "N625SB", "MD Helicopters 600N", "San Bernardino County Sheriff's Department", "116.2 gal", "135 kt", "~3 hr 00 min", 180],
  ["california", "N631SB", "Airbus AS350B3", "San Bernardino County Sheriff's Department", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N803SB", "McDonnell Douglas 369E", "San Bernardino County Sheriff's Department", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["california", "N831SB", "Airbus AS350B3", "San Bernardino County Sheriff's Department", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N832SB", "Airbus AS350B3", "San Bernardino County Sheriff's Department", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N833SB", "Airbus AS350B3", "San Bernardino County Sheriff's Department", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N834SB", "Airbus AS350B3", "San Bernardino County Sheriff's Department", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N835SB", "Airbus AS350B3", "San Bernardino County Sheriff's Department", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N836SB", "Airbus AS350B3", "San Bernardino County Sheriff's Department", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N313DP", "Bell 407", "San Diego County Sheriff's Department", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["california", "N319MW", "Bell 407", "San Diego County Sheriff's Department", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["california", "N670PC", "Bell 407", "San Diego County Sheriff's Department", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["california", "N709WG", "Bell 407", "San Diego County Sheriff's Department", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["california", "N989RL", "Bell 412EP", "San Diego County Sheriff's Department", "331 gal standard", "126 kt", "~3 hr 48 min", 228],
  ["california", "N881SD", "Airbus AS350B3", "City of San Diego / Police Air Support Unit", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N882SD", "Airbus AS350B3", "City of San Diego / Police Air Support Unit", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N883SD", "Airbus AS350B3", "City of San Diego / Police Air Support Unit", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N884SD", "Airbus AS350B3", "City of San Diego / Police Air Support Unit", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N181SD", "Bell UH-1H", "Orange County Sheriff's Department / RNSP", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["california", "N183SD", "Airbus AS350B3", "Orange County Sheriff's Department / RNSP", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N185SD", "Airbus AS350B3", "Orange County Sheriff's Department / RNSP", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N186SD", "Bell UH-1H", "Orange County Sheriff's Department / RNSP", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["california", "N6045C", "Cessna T206H", "Orange County Sheriff's Department / RNSP", "87 gal", "161 ktas", "~4 hr 45 min", 285],
  ["california", "N960RN", "GippsAero GA8 TC-320", "Orange County Sheriff's Department / RNSP", "~87.7 gal", "~130 kt", "~8 hr 12 min", 492],
  ["california", "N893RC", "Pilatus PC-12/47E", "Riverside County Sheriff's Office", "2,704 lb / ~402 gal", "290 ktas", "~7 hr 00 min", 420],
  ["california", "N205SD", "Bell HH-1H", "Ventura County Sheriff's Department", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["california", "N205VC", "Bell 205B", "Ventura County Sheriff's Department", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["california", "N206VC", "Bell 206L-1", "Ventura County Sheriff's Department", "98-111 gal", "110 kt", "~3 hr 00 min", 180],
  ["california", "N32240", "Bell 205A-1", "Ventura County Sheriff's Department", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["california", "N911VC", "Bell 206L-3", "Ventura County Sheriff's Department", "98-111 gal", "110 kt", "~3 hr 00 min", 180],
  ["california", "N371DM", "American Champion 8GCBC", "City of Bakersfield", "72 gal / 70 gal usable", "122 kt / 140 mph", "~7 hr 30 min", 450],
  ["california", "N47PS", "Cessna 182P", "City of Palm Springs", "92 gal", "~150 kt", "~6 hr 40 min", 400],
  // Texas
  ["texas", "N1576F", "McDonnell Douglas 369E", "City of Houston Police Department", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["texas", "N8372F", "McDonnell Douglas 369E", "City of Houston Police Department", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["texas", "N9298F", "Hughes 269C", "City of Houston Police Department", "~41 gal", "95 kt", "~3 hr 30 min", 210],
  ["texas", "N9686F", "Hughes 269C", "City of Houston Police Department", "~41 gal", "95 kt", "~3 hr 30 min", 210],
  ["texas", "N125AP", "Airbus AS350B3", "Austin Police Department", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["texas", "N21475", "Cessna 182P", "Austin Police Department", "92 gal", "~150 kt", "~6 hr 40 min", 400],
  ["texas", "N6227", "Airbus AS350B3", "Austin Police Department", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["texas", "N67662", "Bell 206B", "Austin Police Department", "91 gal", "120 kt", "~3 hr 00 min", 180],
  ["texas", "N917FW", "Bell 206B", "Fort Worth Police Department", "91 gal", "120 kt", "~3 hr 00 min", 180],
  ["texas", "N911FW", "Bell 505", "Fort Worth Police Department", "84.85 gal standard / 104.85 gal with aux", "133 kt", "~4 hr 30 min with aux", 270],
  ["texas", "N206FW", "Bell 206B", "Fort Worth Police Department", "91 gal", "120 kt", "~3 hr 00 min", 180],
  ["texas", "N505FW", "Bell 505", "Fort Worth Police Department", "84.85 gal standard / 104.85 gal with aux", "133 kt", "~4 hr 30 min with aux", 270],
  ["texas", "N111NK", "Airbus AS350B3", "San Antonio Police Department", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["texas", "N820PM", "Eurocopter EC120B", "San Antonio Police Department", "110 gal", "125 kt", "~4 hr 32 min", 272],
  ["texas", "N312SD", "Airbus AS350B3", "Harris County Sheriff's Office", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["texas", "N731SD", "Bell OH-58A", "Harris County Sheriff's Office", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["texas", "N915SD", "Bell OH-58A", "Harris County Sheriff's Office", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  // Florida
  ["florida", "N71LC", "Airbus / Eurocopter AS350B3", "Lee County Sheriff's Office", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N72LC", "Airbus / Eurocopter AS350B2", "Lee County Sheriff's Office", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["florida", "N73LC", "Airbus / Eurocopter AS350B3", "Lee County Sheriff's Office", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N74LC", "Cessna T210L", "Lee County Sheriff's Office", "90 gal", "~205 kt", "~5 hr 00 min", 300],
  ["florida", "N407KB", "Bell 407", "Orange County Sheriff's Office", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["florida", "N407LM", "Bell 407", "Orange County Sheriff's Office", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["florida", "N407NL", "Bell 407", "Orange County Sheriff's Office", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["florida", "N481RC", "Bell 206L-3", "Orange County Sheriff's Office", "98-111 gal", "110 kt", "~3 hr 00 min", 180],
  ["florida", "N552CH", "Bell 407", "Orange County Sheriff's Office", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["florida", "N866DM", "Cessna T206H", "Orange County Sheriff's Office", "87 gal", "161 ktas", "~4 hr 45 min", 285],
  ["florida", "N103JP", "Bell 407", "Jacksonville Sheriff's Office / City of Jacksonville", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["florida", "N311JP", "Bell OH-58A", "Jacksonville Sheriff's Office / City of Jacksonville", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N312JP", "Bell 206B", "Jacksonville Sheriff's Office / City of Jacksonville", "91 gal", "120 kt", "~3 hr 00 min", 180],
  ["florida", "N313JP", "Bell 206B-III / MD 369E", "Jacksonville Sheriff's Office / City of Jacksonville", "91 gal if Bell 206B-III / ~60 gal if MD 369E", "120 kt if Bell / 136 kt if MD 369E", "~3 hr 00 min if Bell / ~2 hr 30 min if MD", 180],
  ["florida", "N314JP", "Bell 407", "Jacksonville Sheriff's Office / City of Jacksonville", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["florida", "N317JP", "Bell 206B", "Jacksonville Sheriff's Office / City of Jacksonville", "91 gal", "120 kt", "~3 hr 00 min", 180],
  ["florida", "N92JP", "Bell 407", "Jacksonville Sheriff's Office / City of Jacksonville", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["florida", "N109BC", "Eurocopter EC135T1", "Broward County Sheriff's Office", "179 gal standard / 232 gal max with aux", "141 kt", "~3 hr 36 min", 216],
  ["florida", "N257BC", "Eurocopter EC135T2+", "Broward County Sheriff's Office", "179 gal standard / 232 gal max with aux", "141 kt", "~3 hr 36 min", 216],
  ["florida", "N265BC", "Airbus MBB-BK117 D-3 / H145", "Broward County Sheriff's Office", "242 gal / 1,649 lb", "143 kt", "~3 hr 35 min", 215],
  ["florida", "N268BC", "Airbus MBB-BK117 D-3 / H145", "Broward County Sheriff's Office", "242 gal / 1,649 lb", "143 kt", "~3 hr 35 min", 215],
  ["florida", "N781BC", "Airbus AS350B3", "Broward County Sheriff's Office", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N782BC", "Airbus AS350B3", "Broward County Sheriff's Office", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N783BC", "Airbus AS350B3", "Broward County Sheriff's Office", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N101TN", "Textron Aviation 208 / Cessna 208 Caravan", "Hillsborough County Sheriff's Office", "332 gal", "185 ktas", "~5 hr 20 min", 320],
  ["florida", "N227ND", "Airbus AS350B3", "Hillsborough County Sheriff's Office", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N245HC", "Pilatus PC-12/47E", "Hillsborough County Sheriff's Office", "2,704 lb / ~402 gal", "290 ktas", "~7 hr 00 min", 420],
  ["florida", "N413JM", "Airbus AS350B3", "Hillsborough County Sheriff's Office", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N717CD", "Airbus AS350B3", "Hillsborough County Sheriff's Office", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N911DG", "Airbus AS350B3", "Hillsborough County Sheriff's Office", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N1SD", "Airbus AS350B2", "Pinellas County Sheriff's Office / Pinellas County", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["florida", "N2SD", "Eurocopter AS350B2", "Pinellas County Sheriff's Office / Pinellas County", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["florida", "N43SD", "Airbus AS350B3", "Pinellas County Sheriff's Office / Pinellas County", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N14806", "Airbus AS350B3", "Pinellas County Sheriff's Office / Pinellas County", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N58501", "Cessna 208B", "Pinellas County Sheriff's Office / Pinellas County", "332 gal", "185 ktas", "~5 hr 20 min", 320],
  ["florida", "N518DS", "Bell 407", "Volusia Sheriff's Office", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["florida", "N618DS", "Bell 407", "Volusia Sheriff's Office", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["florida", "N718DS", "Bell 407", "Volusia Sheriff's Office", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["florida", "N401H", "Bell 407", "St. Johns County Sheriff's Office", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["florida", "N506MC", "Bell 407", "Manatee County Sheriff's Office", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["florida", "N175SC", "Airbus H125 / AS350B3-type", "Seminole County Sheriff's Office", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N176SC", "Airbus H125 / AS350B3-type", "Seminole County Sheriff's Office", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N401MP", "Cessna P210N", "Miami-Dade Police Department", "90 gal", "204 kt", "~5 hr 00 min", 300],
  ["florida", "N772GJ", "Kodiak 100", "Polk County Sheriff's Office", "320 gal", "174 ktas", "~9 hr 54 min", 594],
  // Ohio
  ["ohio", "N551CP", "MD Helicopters 369FF", "City of Columbus / Division of Police", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["ohio", "N552CP", "Bell 505", "City of Columbus / Division of Police", "84.85 gal standard / 104.85 gal with aux", "133 kt", "~4 hr 30 min with aux", 270],
  ["ohio", "N553CP", "MD Helicopters 369FF", "City of Columbus / Division of Police", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["ohio", "N556CP", "MD Helicopters 369FF", "City of Columbus / Division of Police", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["ohio", "N557CP", "MD Helicopters 369FF", "City of Columbus / Division of Police", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["ohio", "N559CP", "Bell 505", "City of Columbus / Division of Police", "84.85 gal standard / 104.85 gal with aux", "133 kt", "~4 hr 30 min with aux", 270],
  ["ohio", "N951CP", "McDonnell Douglas 369E", "City of Cleveland / Cleveland Division of Police", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["ohio", "N952CP", "McDonnell Douglas 369E", "City of Cleveland / Cleveland Division of Police", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  // Colorado
  ["colorado", "N720DP", "Bell 407", "City and County of Denver / Denver Police", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275]
];
var NEW_ROWS = NEW_ROW_DATA.map(
  ([stateId, tail, model, unit, speedText, enduranceText, durationMin]) => ({
    stateId,
    tail,
    model,
    unit,
    speedText,
    enduranceText,
    durationMin
  })
);
var LOCAL_ROWS = LOCAL_ROW_DATA.map(
  ([
    stateId,
    tail,
    model,
    unit,
    fuelText,
    speedText,
    enduranceText,
    durationMin
  ]) => ({
    stateId,
    tail,
    model,
    unit,
    fuelText,
    speedText,
    enduranceText,
    durationMin
  })
);
var FAA_PUBLIC_SAFETY_ROWS = FAA_PUBLIC_SAFETY_AIRCRAFT_ROWS.map(
  ([
    stateId,
    tail,
    ,
    model,
    unit,
    fuelText,
    speedText,
    enduranceText,
    durationMin
  ]) => ({
    stateId,
    tail,
    model,
    unit,
    fuelText,
    speedText,
    enduranceText,
    durationMin
  })
);
var PERFORMANCE_BY_MODEL = new Map(
  FAA_PUBLIC_SAFETY_AIRCRAFT_ROWS.map((row) => [row[3], row])
);
var NATIONAL_OPS_AIRCRAFT = NATIONAL_AIRCRAFT_ROWS.map(
  ([stateId, tail, , model, unit, , , performanceModel]) => {
    const profile = performanceModel ? PERFORMANCE_BY_MODEL.get(performanceModel) : void 0;
    return {
      stateId,
      tail,
      model,
      unit,
      fuelText: profile ? `Type estimate: ${profile[5]}` : "Not verified",
      speedText: profile ? `Type estimate: ${profile[6]}` : "Not verified",
      enduranceText: profile ? `Type estimate: ${profile[7]}` : "Not verified",
      durationMin: profile?.[8] ?? null
    };
  }
);
var OPS_AIRCRAFT = [
  ...WA,
  ...NEW_ROWS,
  ...LOCAL_ROWS,
  ...FAA_PUBLIC_SAFETY_ROWS,
  ...NATIONAL_OPS_AIRCRAFT
];
var OPS_AIRCRAFT_STATE_BY_TAIL = new Map(
  OPS_AIRCRAFT.map((row) => [row.tail, row.stateId])
);
function stateIdForOpsAircraftTail(tail) {
  return OPS_AIRCRAFT_STATE_BY_TAIL.get(tail.trim().toUpperCase()) ?? null;
}
var ADDITIONAL_TRACKED_TAILS = [
  ...NEW_ROWS,
  ...LOCAL_ROWS,
  ...FAA_PUBLIC_SAFETY_ROWS,
  ...NATIONAL_OPS_AIRCRAFT
].map((row) => row.tail);
var AIRCRAFT_DURATION_MINUTES = Object.fromEntries(
  OPS_AIRCRAFT.flatMap((row) => row.durationMin == null ? [] : [[row.tail, row.durationMin]])
);
var ADDITIONAL_FLEET = [
  ...NEW_ROWS.map((row) => {
    const role = roleForModel(row.model);
    const operator = operatorForState(row.stateId) ?? row.unit;
    return {
      tail: row.tail,
      hex: null,
      operator,
      model: row.model,
      nickname: callSignFromUnit(row.unit),
      roleDescription: "Traffic enforcement",
      base: row.unit,
      role,
      roleConfidence: "tentative",
      roleNote: `${operator} traffic enforcement aircraft`
    };
  }),
  ...LOCAL_ROWS.map((row) => {
    const role = roleForModel(row.model);
    return {
      tail: row.tail,
      hex: null,
      operator: row.unit,
      model: row.model,
      nickname: null,
      roleDescription: role === "patrol" ? "Patrol / air support" : "Law enforcement / surveillance",
      base: row.unit,
      role,
      roleConfidence: "tentative",
      roleNote: `${row.unit} local agency aircraft`
    };
  }),
  ...FAA_PUBLIC_SAFETY_AIRCRAFT_ROWS.map((row) => {
    const [stateId, tail, hex, model, unit] = row;
    const role = roleForModel(model);
    const statewideOperator = operatorForState(stateId);
    const operator = statewideOperator && unit.includes(statewideOperator) ? statewideOperator : unit;
    return {
      tail,
      hex,
      operator,
      model,
      nickname: null,
      roleDescription: role === "patrol" ? "Patrol / air support" : "Law enforcement / surveillance",
      base: unit,
      role,
      roleConfidence: "tentative",
      roleNote: `${unit} FAA public-safety registry aircraft`
    };
  }),
  ...NATIONAL_AIRCRAFT_ROWS.map((row) => {
    const [, tail, hex, model, operator, city, aircraftType] = row;
    return {
      tail,
      hex,
      model,
      operator,
      nickname: null,
      base: `${city} (registration city; operating base unverified)`,
      role: aircraftType === "Helicopter" ? "patrol" : "fixed_wing",
      roleDescription: "Law enforcement / air support (registry attribution)",
      roleConfidence: "tentative",
      roleNote: `FAA registration ${NATIONAL_AIRCRAFT_REGISTRY_DATE}; mission and operational status unverified.`
    };
  })
];
function operatorForState(stateId) {
  switch (stateId) {
    case "california":
      return "CHP";
    case "texas":
      return "Texas DPS";
    case "florida":
      return "Florida Highway Patrol";
    case "ohio":
      return "Ohio State Highway Patrol";
    case "colorado":
      return "Colorado State Patrol";
    case "washington":
      return "WSP";
    default:
      return null;
  }
}
function callSignFromUnit(unit) {
  if (!unit.includes("/")) return null;
  const first = unit.split("/")[0]?.trim();
  return first || null;
}
function roleForModel(model) {
  return /\b(airbus|eurocopter|as350|h125|h145|ec120|ec135|ec145|bk117|bell|mcdonnell douglas|md helicopters|md 369|369e|369ff|hughes|robinson|r66|uh-1|oh-58|helicopter)\b/i.test(
    model
  ) ? "patrol" : "fixed_wing";
}

// lib/aircraft-freshness.ts
var AIRCRAFT_FRESHNESS_MS = 5 * 6e4;

// lib/icao.ts
var CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ";
var DIGITSET = "0123456789";
var ALLCHARS = CHARSET + DIGITSET;
var NNUMBER_MAX_SIZE = 6;
var SUFFIX_SIZE = 1 + CHARSET.length * (1 + CHARSET.length);
var BUCKET4_SIZE = 1 + CHARSET.length + DIGITSET.length;
var BUCKET3_SIZE = DIGITSET.length * BUCKET4_SIZE + SUFFIX_SIZE;
var BUCKET2_SIZE = DIGITSET.length * BUCKET3_SIZE + SUFFIX_SIZE;
var BUCKET1_SIZE = DIGITSET.length * BUCKET2_SIZE + SUFFIX_SIZE;
var US_BASE = 10485761;
function isLetter(c) {
  return CHARSET.includes(c);
}
function suffixOffset(suffix) {
  if (suffix.length === 0) return 0;
  if (![...suffix].every(isLetter)) return -1;
  let count = (CHARSET.length + 1) * CHARSET.indexOf(suffix[0]) + 1;
  if (suffix.length === 2) count += CHARSET.indexOf(suffix[1]) + 1;
  return count;
}
function nNumberToIcao(n) {
  if (!n || n[0] !== "N" || n.length > NNUMBER_MAX_SIZE) return null;
  const body = n.slice(1).toUpperCase();
  if (body.length === 0) return null;
  if (!/[1-9]/.test(body[0])) return null;
  let output = US_BASE;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (i === NNUMBER_MAX_SIZE - 2) {
      const idx = ALLCHARS.indexOf(c);
      if (idx < 0) return null;
      output += idx + 1;
      break;
    }
    if (isLetter(c)) {
      const off = suffixOffset(body.slice(i));
      if (off < 0) return null;
      output += off;
      break;
    }
    if (!DIGITSET.includes(c)) return null;
    const d = Number(c);
    if (i === 0) {
      output += (d - 1) * BUCKET1_SIZE;
    } else if (i === 1) {
      output += d * BUCKET2_SIZE + SUFFIX_SIZE;
    } else if (i === 2) {
      output += d * BUCKET3_SIZE + SUFFIX_SIZE;
    } else if (i === 3) {
      output += d * BUCKET4_SIZE + SUFFIX_SIZE;
    } else if (i === 4) {
      output += d + SUFFIX_SIZE;
    }
  }
  return output.toString(16).padStart(6, "0");
}

// lib/seed.ts
var FLEET = [
  // Washington State Patrol — Olympia (all WSP fixed-wing are fixed_wing)
  { tail: "N305DK", hex: "A3323A", operator: "WSP", model: "Cessna 206H Stationair (FLIR)", nickname: "Bird 4", roleDescription: "Speed enforcement", base: "KOLM Olympia", role: "fixed_wing", roleConfidence: "confirmed", roleNote: "Bird 4 \u2014 WSP fixed-wing FLIR" },
  { tail: "N305RC", hex: "A3335F", operator: "WSP", model: "Cessna 182T Skylane", nickname: null, roleDescription: "Speed enforcement", base: "KOLM Olympia", role: "fixed_wing", roleConfidence: "confirmed", roleNote: "WSP fixed-wing speed enforcement" },
  { tail: "N2446X", hex: null, operator: "WSP", model: "Cessna 206H Stationair (FLIR)", nickname: "Bird 3", roleDescription: "Speed enforcement", base: "KOLM Olympia", role: "fixed_wing", roleConfidence: "confirmed", roleNote: "Bird 3 \u2014 WSP fixed-wing FLIR" },
  { tail: "N102LP", hex: "A00D2A", operator: "WSP", model: "Cessna 182T Skylane", nickname: null, roleDescription: "Speed enforcement", base: "KOLM Olympia", role: "fixed_wing", roleConfidence: "confirmed", roleNote: "WSP fixed-wing speed enforcement" },
  { tail: "N3532K", hex: null, operator: "WSP", model: "Cessna 182T Skylane", nickname: null, roleDescription: "Speed enforcement", base: "KOLM Olympia", role: "fixed_wing", roleConfidence: "confirmed", roleNote: "WSP fixed-wing speed enforcement" },
  // State of Washington (multi-mission, shared with WSP/WSDOT)
  // Owner of record per FAA registry is State of Washington / Olympia, but
  // WSP operates this airframe — it's the all-weather IFR plane the WSP
  // aviation team flies on missions a Cessna 182/206 can't handle.
  { tail: "N207HB", hex: "A1ACB5", operator: "State of WA", model: "Beechcraft B200 Super King Air", nickname: null, roleDescription: "Transport / multi-mission (all-weather)", base: "KOLM Olympia (WSP-operated)", role: "transport", roleConfidence: "tentative", roleNote: "WSP-flown all-weather King Air; owned by State of WA" },
  // King County Sheriff — Renton
  { tail: "N422CT", hex: "A50351", operator: "KCSO", model: "Bell 407GXi", nickname: "Guardian One", roleDescription: "Patrol / pursuit / SAR", base: "KRNT Renton", role: "patrol", roleConfidence: "confirmed", roleNote: "Guardian One \u2014 multi-role" },
  { tail: "N407KS", hex: "A4C794", operator: "KCSO", model: "Bell 407", nickname: "Guardian One (legacy)", roleDescription: "Patrol / pursuit (backup)", base: "KRNT Renton", role: "patrol", roleConfidence: "tentative", roleNote: "Guardian One legacy airframe" },
  { tail: "N411KS", hex: null, operator: "KCSO", model: "Bell 206B JetRanger", nickname: null, roleDescription: "Patrol / training", base: "KRNT Renton", role: "patrol", roleConfidence: "tentative", roleNote: "Former KCSO Bell 206B / JetRanger" },
  { tail: "N790RJ", hex: "AAB985", operator: "KCSO", model: "Bell UH-1H Iroquois", nickname: "Guardian Two", roleDescription: "SAR / SWAT insertion", base: "KRNT Renton", role: "sar", roleConfidence: "tentative", roleNote: "Guardian Two \u2014 likely SAR/SWAT" },
  { tail: "N71KP", hex: "A97AA3", operator: "KCSO", model: "Bell UH-1H Iroquois", nickname: null, roleDescription: "SAR / SWAT (reserve)", base: "KRNT Renton", role: "sar", roleConfidence: "tentative", roleNote: "KCSO reserve Huey" },
  { tail: "N67817", hex: null, operator: "KCSO", model: "Bell 206B / TH-67A Creek", nickname: null, roleDescription: "Patrol / training", base: "KRNT Renton", role: "patrol", roleConfidence: "tentative", roleNote: "KCSO Bell 206/TH-67" },
  { tail: "N67880", hex: "A8FCF9", operator: "KCSO", model: "Bell 206B / TH-67A Creek", nickname: null, roleDescription: "Patrol / training", base: "KRNT Renton", role: "patrol", roleConfidence: "tentative", roleNote: "KCSO Bell 206/TH-67" },
  { tail: "N78906", hex: "AAB46C", operator: "KCSO", model: "Bell 206B / TH-67A Creek", nickname: null, roleDescription: "Patrol / training", base: "KRNT Renton", role: "patrol", roleConfidence: "tentative", roleNote: "KCSO Bell 206/TH-67" },
  // Pierce County Sheriff — Puyallup
  // Pierce One is a 2012 Cessna T206H, FAA-registered to Pierce County
  // Sheriff's Department, equipped with FLIR + downlink. Acquired via DHS
  // grant in cooperation with the Port of Tacoma. Pierce Two (older
  // Cessna 206 from 1980s drug seizure) operates as backup but no
  // confirmed tail number publicly — omitted here.
  { tail: "N9446P", hex: null, operator: "Pierce SO", model: "Cessna T206H Stationair (FLIR)", nickname: "Pierce One", roleDescription: "Patrol / SAR / port security", base: "KPLU Thun Field, Puyallup", role: "fixed_wing", roleConfidence: "confirmed", roleNote: "Pierce One \u2014 Cessna T206H FLIR (2012)" },
  // Snohomish County Sheriff
  { tail: "N815SC", hex: "AB1D82", operator: "Snohomish SO", model: "Bell UH-1H Iroquois Plus", nickname: "SnoHawk 10", roleDescription: "Mountain SAR / hoist / SWAT", base: "Taylor's Landing", role: "sar", roleConfidence: "tentative", roleNote: "SnoHawk 10 \u2014 likely SAR" },
  // Spokane County Sheriff — Felts Field
  // SRASU historical fleet: two Bell OH-58s (Air 1 / Air 2, ex-Army
  // surplus 2005) + one Bell UH-1H Super Huey (Rescue 3). N509DV is the
  // Bell 505 added in 2024 (BJA grant 15PBJA-23-GG-00183-BRND); likely
  // assumed the Air 1 designation. OH-58 / UH-1H tails not publicly
  // confirmed — omitted to avoid mis-labeling.
  { tail: "N509DV", hex: "A65BBE", operator: "Spokane SO", model: "Bell 505 Jet Ranger X", nickname: "Air 1", roleDescription: "Patrol / SAR / fugitive apprehension", base: "KSFF Felts Field, Spokane", role: "patrol", roleConfidence: "tentative", roleNote: "Spokane SO Bell 505 \u2014 likely Air 1 since 2024" },
  // US Coast Guard — Air Station Port Angeles, KCLM
  // Non-FAA registered (military serial); hex is authoritative. Air Station
  // Port Angeles operates three MH-65E Dolphins per the 2021 transition
  // delivery; CGNR 6594 is the only one with a publicly documented
  // mode-S hex. Other airframes intentionally omitted until confirmed.
  // Role = sar because USCG missions are search & rescue, not enforcement
  // against motorists. Status still turns BIRD UP when airborne.
  { tail: "CGNR6594", hex: "AE26B4", operator: "USCG", model: "Eurocopter MH-65E Dolphin", nickname: "Dolphin 6594", roleDescription: "Maritime search and rescue", base: "KCLM Port Angeles", role: "sar", roleConfidence: "confirmed", roleNote: "CGAS Port Angeles MH-65E (Jan 2021 delivery)" },
  ...ADDITIONAL_FLEET
];
function fleetHex(entry) {
  const seeded = entry.hex?.toLowerCase();
  if (seeded) return seeded;
  return (nNumberToIcao(entry.tail) ?? "").toLowerCase();
}

// lib/catalog-pagination.ts
var CATALOG_PAGE_SIZE = 500;
var CATALOG_KEY_BATCH_SIZE = 100;
async function readAllCatalogPages(fetchPage, context) {
  const rows = [];
  for (; ; ) {
    const { data, error } = await fetchPage(
      rows.length,
      rows.length + CATALOG_PAGE_SIZE - 1
    );
    if (error) throw new Error(`${context}: ${error.message}`);
    if (!data?.length) return rows;
    rows.push(...data);
  }
}
function catalogBatches(values, size = CATALOG_KEY_BATCH_SIZE) {
  if (!Number.isInteger(size) || size < 1) throw new Error("Invalid catalog batch size");
  const batches = [];
  for (let index = 0; index < values.length; index += size) {
    batches.push(values.slice(index, index + size));
  }
  return batches;
}
async function readCatalogKeyBatches(keys, fetchBatch, context) {
  const rows = [];
  for (const batch of catalogBatches([...new Set(keys)])) {
    const { data, error } = await fetchBatch(batch);
    if (error) throw new Error(`${context}: ${error.message}`);
    rows.push(...data ?? []);
  }
  return rows;
}

// lib/aircraft-data.ts
var TAKEOFF_CONFIRMATION_SAMPLES = 2;
var LANDING_CONFIRMATION_SAMPLES = 2;
var TAKEOFF_NOTIFICATION_COOLDOWN_MS = 30 * 60 * 1e3;
var CURRENT_OBSERVATION_MAX_AGE_MS = AIRCRAFT_FRESHNESS_MS;
var FLIGHT_TRANSITION_MAX_GAP_MS = 2 * 6e4;
var FLIGHT_SESSION_LOST_GRACE_MS = 15 * 60 * 1e3;
var MAX_OPEN_FLIGHT_SESSION_MS = 18 * 60 * 60 * 1e3;
async function ensureCatalogSeeded() {
  if (!isSupabaseConfigured()) return;
  const db = getSupabaseAdmin();
  const { data: stateRows, error: stateError } = await db.from("states").select("code");
  if (stateError) throw new Error(`State catalog read failed: ${stateError.message}`);
  const existingStates = new Set((stateRows ?? []).map((row) => String(row.code)));
  const missingStates = APP_STATES.filter((state) => !existingStates.has(state.code));
  if (missingStates.length) {
    const { error } = await db.from("states").upsert(
      missingStates.map((state) => ({
        code: state.code,
        slug: state.id,
        name: state.label,
        center_lat: state.centerLat,
        center_lon: state.centerLon
      })),
      { onConflict: "code", ignoreDuplicates: true }
    );
    if (error) throw new Error(`State catalog seed failed: ${error.message}`);
  }
  const existingRows = await readAllCatalogPages(
    (from, to) => db.from("aircraft").select("tail").order("tail").range(from, to),
    "Catalog read failed"
  );
  const existingTails = new Set(
    (existingRows ?? []).map((row) => String(row.tail).trim().toUpperCase())
  );
  const missing = supportedFleet().filter(
    (entry) => !existingTails.has(entry.tail.trim().toUpperCase())
  );
  if (missing.length === 0) return;
  const updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  for (const batch of catalogBatches(missing)) {
    const { data: aircraftRows, error: upsertError } = await db.from("aircraft").upsert(
      batch.map((entry) => fleetEntryToCatalogRow(entry, updatedAt)),
      { onConflict: "tail", ignoreDuplicates: true }
    ).select("id,tail");
    if (upsertError) {
      throw new Error(`Catalog seed sync failed: ${upsertError.message}`);
    }
    const performanceRows = buildPerformanceRows(aircraftRows ?? [], updatedAt);
    if (performanceRows.length === 0) continue;
    const { error: performanceError } = await db.from("aircraft_performance_profiles").upsert(performanceRows, { onConflict: "aircraft_id" });
    if (performanceError) {
      throw new Error(`Catalog performance sync failed: ${performanceError.message}`);
    }
  }
}
async function getDatabaseSnapshot(stateCode = DEFAULT_STATE_CODE) {
  if (!isSupabaseConfigured()) {
    return {
      fetched_at: Date.now(),
      source: "mock",
      aircraft: filterSeedByState(FLEET, stateCode).map((entry) => ({
        ...entry,
        tail: entry.tail,
        icao24: fleetHex(entry),
        observed: false,
        airborne: false,
        observation_status: "unknown",
        home_state_code: stateCode,
        last_seen_min: null
      })),
      live_seen_count: 0
    };
  }
  const db = getSupabaseAdmin();
  const [liveResult, ingestionResult] = await Promise.all([
    db.from("aircraft_live_public").select("*").eq("home_state_code", stateCode).order("tail"),
    db.from("ingestion_runs").select("finished_at,source").in("status", ["succeeded", "partial"]).not("finished_at", "is", null).order("started_at", { ascending: false }).limit(1).maybeSingle()
  ]);
  if (liveResult.error) {
    throw new Error(`Live aircraft read failed: ${liveResult.error.message}`);
  }
  const data = liveResult.data;
  const snapshotReadAt = Date.now();
  let fetchedAt = parseTime(ingestionResult.data?.finished_at) ?? 0;
  const aircraft = (data ?? []).map((row) => {
    const observedAt = parseTime(row.observed_at);
    const lastSeenAt = parseTime(row.last_seen_at);
    if (observedAt != null) fetchedAt = Math.max(fetchedAt, observedAt);
    const hasCurrentObservation = observedAt != null;
    const status = row.observation_status;
    const airborne = hasCurrentObservation && (status === "airborne" || status === "airborne_candidate" || status === "landing_candidate");
    const hasDisplayObservation = hasCurrentObservation;
    const takeoffAt = parseTime(row.detected_takeoff_at);
    const takeoffConfidence = row.takeoff_confidence ?? null;
    const elapsedStart = takeoffAt != null && (takeoffConfidence === "medium" || takeoffConfidence === "high") ? takeoffAt : null;
    return {
      tail: String(row.tail),
      icao24: String(row.icao24),
      operator: String(row.operator),
      model: String(row.model),
      nickname: row.nickname ? String(row.nickname) : null,
      roleDescription: String(row.role_description ?? "\u2014"),
      base: String(row.base),
      role: row.role,
      roleConfidence: row.role_confidence,
      roleNote: row.role_note ? String(row.role_note) : void 0,
      observed: hasCurrentObservation,
      observed_at: observedAt != null ? new Date(observedAt).toISOString() : null,
      position_observed_at: observedAt != null ? new Date(observedAt).toISOString() : null,
      airborne,
      last_known_airborne: false,
      observation_status: hasCurrentObservation ? status ?? "unknown" : "unknown",
      home_state_code: String(row.home_state_code),
      current_state_code: hasCurrentObservation && row.current_state_code ? String(row.current_state_code) : null,
      flight_session_id: hasCurrentObservation && row.flight_session_id ? String(row.flight_session_id) : null,
      tracking_started_at: hasCurrentObservation && row.tracking_started_at ? String(row.tracking_started_at) : null,
      detected_takeoff_at: hasCurrentObservation && row.detected_takeoff_at ? String(row.detected_takeoff_at) : null,
      takeoff_confidence: hasCurrentObservation ? takeoffConfidence : null,
      as_of: snapshotReadAt,
      starting_fuel_estimate_gal: finiteNumber(
        row.starting_fuel_estimate_gal
      ),
      usable_fuel_gallons: finiteNumber(row.usable_fuel_gallons),
      nominal_endurance_min: finiteNumber(row.nominal_endurance_min),
      low_burn_gph: finiteNumber(row.low_burn_gph),
      high_burn_gph: finiteNumber(row.high_burn_gph),
      reserve_min: finiteNumber(row.reserve_min),
      lat: hasDisplayObservation ? finiteNumber(row.latitude) : void 0,
      lon: hasDisplayObservation ? finiteNumber(row.longitude) : void 0,
      altitude_ft: hasDisplayObservation ? finiteNumber(row.altitude_ft) : void 0,
      ground_speed_kt: hasDisplayObservation ? finiteNumber(row.ground_speed_kt) : void 0,
      heading: hasDisplayObservation ? finiteNumber(row.heading_deg) : void 0,
      squawk: hasCurrentObservation && row.squawk ? String(row.squawk) : null,
      time_aloft_min: airborne && elapsedStart != null ? Math.max(0, Math.floor((snapshotReadAt - elapsedStart) / 6e4)) : void 0,
      last_seen_min: lastSeenAt ? Math.max(0, Math.floor((snapshotReadAt - lastSeenAt) / 6e4)) : null
    };
  });
  return {
    fetched_at: fetchedAt || snapshotReadAt,
    source: inferSnapshotSource(data, ingestionResult.data?.source),
    source_ok: fetchedAt > 0 && snapshotReadAt - fetchedAt < CURRENT_OBSERVATION_MAX_AGE_MS,
    aircraft,
    live_seen_count: aircraft.filter((row) => row.observed).length
  };
}
async function ingestSnapshot(snapshot, workerId, options = {}) {
  const db = getSupabaseAdmin();
  if (!options.catalogSeeded) await ensureCatalogSeeded();
  const snapshotObservedAt = new Date(snapshot.fetched_at).toISOString();
  if (snapshot.source_ok === false) {
    const { error: healthError2 } = await db.from("data_source_health").upsert(
      {
        source: snapshot.source,
        last_attempt_at: snapshotObservedAt,
        last_failure_at: snapshotObservedAt,
        last_error: snapshot.source_error ?? "all live sources failed",
        metadata: { worker_id: workerId },
        updated_at: snapshotObservedAt
      },
      { onConflict: "source" }
    );
    if (healthError2) {
      throw new Error(`Source-health write failed: ${healthError2.message}`);
    }
    return {
      positionsInserted: 0,
      takeoffsCreated: 0,
      trackedAircraftCount: 0,
      sourceHealthy: false,
      byState: {},
      priorityAircraftTails: []
    };
  }
  const catalogData = await readCatalogKeyBatches(
    snapshot.aircraft.map((aircraft) => aircraft.tail.toUpperCase()),
    (tails) => db.from("aircraft").select(
      "id,tail,icao24,home_state_code,operator,model,nickname,base,role,role_confidence,role_description,role_note"
    ).eq("active", true).in("tail", tails),
    "Ingestion catalog read failed"
  );
  const catalog = catalogData ?? [];
  const catalogByTail = new Map(catalog.map((row) => [row.tail, row]));
  const catalogById = new Map(catalog.map((row) => [row.id, row]));
  const ids = catalog.map((row) => row.id);
  const currentData = await readCatalogKeyBatches(
    ids,
    (batch) => db.from("aircraft_current_state").select("*").in("aircraft_id", batch),
    "Current-state read failed"
  );
  const currentByAircraft = new Map(
    (currentData ?? []).map((row) => [row.aircraft_id, row])
  );
  const openFlightSessionIds = [
    ...new Set(
      (currentData ?? []).map((row) => row.flight_session_id).filter((id) => typeof id === "string" && id.length > 0)
    )
  ];
  const sessionData = await readCatalogKeyBatches(
    openFlightSessionIds,
    (batch) => db.from("flight_sessions").select("id,detected_takeoff_at,tracking_started_at,last_seen_at,closed_at").in("id", batch),
    "Open-session read failed"
  );
  const openSessionById = new Map(
    (sessionData ?? []).map((row) => [row.id, row])
  );
  const stateRows = [];
  const positionRows = [];
  const newFlightSessionRows = [];
  const takeoffEventCandidates = [];
  const flightSessionsToFinalize = /* @__PURE__ */ new Map();
  const byState = {};
  let takeoffsCreated = 0;
  for (const aircraft of snapshot.aircraft) {
    const catalogRow = catalogByTail.get(aircraft.tail.toUpperCase());
    if (!catalogRow) continue;
    const stateSummary = byState[catalogRow.home_state_code] ??= {
      positionsInserted: 0,
      takeoffsCreated: 0,
      trackedAircraftCount: 0
    };
    stateSummary.trackedAircraftCount += 1;
    const previous = currentByAircraft.get(catalogRow.id);
    const wasObserved = aircraft.observed !== false;
    if (!wasObserved) {
      if (!shouldClearUnobservedState(previous)) continue;
      if (previous?.flight_session_id && !isUnseenFlightSessionExpired(previous, snapshotObservedAt)) {
        continue;
      }
      if (previous?.flight_session_id) {
        flightSessionsToFinalize.set(previous.flight_session_id, {
          status: "unknown",
          closedAt: previous.last_seen_at ?? previous.observed_at ?? snapshotObservedAt,
          endReason: "coverage_lost",
          detectedLandingAt: null,
          landingConfirmedAt: null
        });
      }
      stateRows.push({
        aircraft_id: catalogRow.id,
        flight_session_id: null,
        observation_status: "unknown",
        consecutive_airborne: 0,
        consecutive_grounded: 0,
        current_state_code: null,
        observed_at: null,
        last_seen_at: previous?.last_seen_at ?? null,
        // A provider gap invalidates transition continuity. Retaining either
        // boundary would manufacture a takeoff/landing midpoint on reacquisition.
        last_grounded_at: null,
        last_airborne_at: null,
        airborne_candidate_started_at: null,
        landing_candidate_started_at: null,
        latitude: null,
        longitude: null,
        altitude_ft: null,
        ground_speed_kt: null,
        heading_deg: null,
        squawk: null,
        source: snapshot.source,
        updated_at: snapshotObservedAt
      });
      continue;
    }
    const aircraftObservedAt = normalizedAircraftTimestamp(
      aircraft.observed_at,
      snapshot.fetched_at,
      snapshotObservedAt
    );
    if (!isNewerAircraftObservation(previous, aircraftObservedAt)) continue;
    const positionObservedAt = normalizedAircraftTimestamp(
      aircraft.position_observed_at,
      snapshot.fetched_at,
      aircraftObservedAt
    );
    const previousOpenSession = previous?.flight_session_id ? openSessionById.get(previous.flight_session_id) : void 0;
    const hasStaleOpenSession = isStaleOpenFlightSession(
      previousOpenSession,
      snapshotObservedAt
    );
    const hasStaleAirborneCandidate = isStaleAirborneCandidate(
      previous,
      snapshotObservedAt
    );
    const hasStaleLandingCandidate = isStaleLandingCandidate(
      previous,
      snapshotObservedAt
    );
    if (hasStaleOpenSession && previous?.flight_session_id) {
      flightSessionsToFinalize.set(previous.flight_session_id, {
        status: "unknown",
        closedAt: previous.last_seen_at ?? previousOpenSession?.last_seen_at ?? previous.observed_at ?? snapshotObservedAt,
        endReason: "stale_session",
        detectedLandingAt: null,
        landingConfirmedAt: null
      });
    }
    const continuityPrevious = hasStaleOpenSession || hasStaleAirborneCandidate || hasStaleLandingCandidate ? void 0 : previous;
    let flightSessionId = hasStaleOpenSession ? null : previous?.flight_session_id ?? null;
    const groundState = aircraftObservationGroundState(aircraft);
    if (groundState === "unknown") {
      stateRows.push({
        aircraft_id: catalogRow.id,
        flight_session_id: flightSessionId,
        observation_status: "unknown",
        consecutive_airborne: 0,
        consecutive_grounded: 0,
        current_state_code: await resolveCurrentStateCode(
          db,
          aircraft.lat,
          aircraft.lon,
          catalogRow.home_state_code
        ),
        observed_at: aircraftObservedAt,
        last_seen_at: aircraftObservedAt,
        // An ambiguous provider sample breaks both transition intervals. It
        // updates contact/position without being evidence of air or ground.
        last_grounded_at: null,
        last_airborne_at: null,
        airborne_candidate_started_at: null,
        landing_candidate_started_at: null,
        latitude: aircraft.lat ?? null,
        longitude: aircraft.lon ?? null,
        altitude_ft: aircraft.altitude_ft ?? null,
        ground_speed_kt: aircraft.ground_speed_kt ?? null,
        heading_deg: aircraft.heading ?? null,
        squawk: aircraft.squawk ?? null,
        source: snapshot.source,
        updated_at: snapshotObservedAt
      });
      continue;
    }
    const isAirborne = groundState === "airborne";
    const consecutiveAirborne = isAirborne ? (continuityPrevious?.consecutive_airborne ?? 0) + 1 : 0;
    const consecutiveGrounded = !isAirborne ? (continuityPrevious?.consecutive_grounded ?? 0) + 1 : 0;
    const lastGroundedAt = isAirborne ? continuityPrevious?.last_grounded_at ?? null : aircraftObservedAt;
    const airborneCandidateStartedAt = isAirborne ? continuityPrevious?.consecutive_airborne ? continuityPrevious.airborne_candidate_started_at ?? aircraftObservedAt : aircraftObservedAt : null;
    const lastAirborneAt = isAirborne ? aircraftObservedAt : continuityPrevious?.last_airborne_at ?? (continuityPrevious?.observation_status === "airborne" || continuityPrevious?.observation_status === "airborne_candidate" ? continuityPrevious.observed_at : null);
    let landingCandidateStartedAt = !isAirborne && flightSessionId ? continuityPrevious?.consecutive_grounded ? continuityPrevious.landing_candidate_started_at ?? aircraftObservedAt : aircraftObservedAt : null;
    let status = isAirborne ? "airborne_candidate" : "grounded";
    if (isAirborne && !flightSessionId && consecutiveAirborne >= TAKEOFF_CONFIRMATION_SAMPLES) {
      const detectedTakeoffAt = interpolateFlightTransition(
        continuityPrevious?.last_grounded_at,
        airborneCandidateStartedAt
      );
      const trackingStartedAt = airborneCandidateStartedAt ?? aircraftObservedAt;
      flightSessionId = crypto.randomUUID();
      newFlightSessionRows.push({
        id: flightSessionId,
        aircraft_id: catalogRow.id,
        status: "airborne",
        tracking_started_at: trackingStartedAt,
        // First-seen-airborne is an observation boundary, not a takeoff.
        detected_takeoff_at: detectedTakeoffAt,
        last_seen_at: aircraftObservedAt,
        takeoff_time_source: detectedTakeoffAt ? "interpolated" : "tracking_started_airborne",
        confidence: detectedTakeoffAt ? "high" : "low",
        starting_fuel_estimate_gal: null
      });
      takeoffEventCandidates.push({
        flightSessionId,
        aircraftId: catalogRow.id,
        eventOccurredAt: takeoffNotificationOccurredAt(
          detectedTakeoffAt,
          trackingStartedAt
        ),
        takeoffTimeSource: detectedTakeoffAt ? "interpolated" : "tracking_started_airborne",
        catalogRow
      });
    }
    if (isAirborne && flightSessionId) {
      status = "airborne";
    } else if (!isAirborne && flightSessionId && consecutiveGrounded >= LANDING_CONFIRMATION_SAMPLES) {
      const detectedLandingAt = estimateLandingTransitionAt(
        lastAirborneAt,
        landingCandidateStartedAt
      ) ?? aircraftObservedAt;
      flightSessionsToFinalize.set(flightSessionId, {
        status: "landed",
        closedAt: aircraftObservedAt,
        endReason: "confirmed_landing",
        detectedLandingAt,
        landingConfirmedAt: aircraftObservedAt
      });
      flightSessionId = null;
      landingCandidateStartedAt = null;
      status = "grounded";
    } else if (!isAirborne && flightSessionId) {
      status = "landing_candidate";
    }
    stateRows.push({
      aircraft_id: catalogRow.id,
      flight_session_id: flightSessionId,
      observation_status: status,
      consecutive_airborne: consecutiveAirborne,
      consecutive_grounded: consecutiveGrounded,
      current_state_code: await resolveCurrentStateCode(
        db,
        aircraft.lat,
        aircraft.lon,
        catalogRow.home_state_code
      ),
      observed_at: aircraftObservedAt,
      last_seen_at: aircraftObservedAt,
      last_grounded_at: lastGroundedAt,
      last_airborne_at: lastAirborneAt,
      airborne_candidate_started_at: flightSessionId ? null : airborneCandidateStartedAt,
      landing_candidate_started_at: landingCandidateStartedAt,
      latitude: aircraft.lat ?? null,
      longitude: aircraft.lon ?? null,
      altitude_ft: aircraft.altitude_ft ?? null,
      ground_speed_kt: aircraft.ground_speed_kt ?? null,
      heading_deg: aircraft.heading ?? null,
      squawk: aircraft.squawk ?? null,
      source: snapshot.source,
      updated_at: snapshotObservedAt
    });
    if (isAirborne && aircraft.lat != null && aircraft.lon != null) {
      positionRows.push({
        aircraft_id: catalogRow.id,
        flight_session_id: flightSessionId,
        observed_at: positionObservedAt,
        latitude: aircraft.lat,
        longitude: aircraft.lon,
        altitude_ft: aircraft.altitude_ft ?? null,
        ground_speed_kt: aircraft.ground_speed_kt ?? null,
        heading_deg: aircraft.heading ?? null,
        source: snapshot.source
      });
    }
  }
  const finalizationRows = [...flightSessionsToFinalize].map(
    ([flightSessionId, finalState]) => ({
      flight_session_id: flightSessionId,
      status: finalState.status,
      closed_at: finalState.closedAt,
      end_reason: finalState.endReason,
      detected_landing_at: finalState.detectedLandingAt,
      landing_confirmed_at: finalState.landingConfirmedAt,
      updated_at: snapshotObservedAt
    })
  );
  const { data: lifecycleResult, error: lifecycleError } = await db.rpc(
    "apply_aircraft_lifecycle_batch",
    {
      input_sessions: newFlightSessionRows,
      input_state_rows: stateRows,
      input_position_rows: positionRows,
      input_finalizations: finalizationRows
    }
  );
  if (lifecycleError) {
    throw new Error(`Aircraft lifecycle write failed: ${lifecycleError.message}`);
  }
  const lifecycleSummary = isRecord(lifecycleResult) ? lifecycleResult : {};
  const positionsInserted = finiteNumber(lifecycleSummary.positions_inserted) ?? 0;
  const insertedAircraftIds = Array.isArray(
    lifecycleSummary.inserted_aircraft_ids
  ) ? lifecycleSummary.inserted_aircraft_ids : [];
  for (const aircraftId of insertedAircraftIds) {
    const catalogRow = catalogById.get(String(aircraftId));
    if (catalogRow) {
      const stateSummary = byState[catalogRow.home_state_code];
      if (stateSummary) stateSummary.positionsInserted += 1;
    }
  }
  for (const candidate of takeoffEventCandidates) {
    const suppressNotification = await shouldSuppressTakeoffNotification(
      db,
      candidate.aircraftId,
      candidate.flightSessionId,
      candidate.eventOccurredAt
    );
    if (suppressNotification) continue;
    const { error: eventError } = await db.from("notification_events").upsert(
      {
        flight_session_id: candidate.flightSessionId,
        aircraft_id: candidate.aircraftId,
        state_code: candidate.catalogRow.home_state_code,
        event_type: "takeoff",
        occurred_at: candidate.eventOccurredAt,
        payload: {
          tail: candidate.catalogRow.tail,
          nickname: candidate.catalogRow.nickname,
          model: candidate.catalogRow.model,
          state_code: candidate.catalogRow.home_state_code,
          takeoff_time_source: candidate.takeoffTimeSource
        }
      },
      { onConflict: "flight_session_id,event_type", ignoreDuplicates: true }
    );
    if (eventError) {
      console.warn("[ingest] takeoff-event write failed:", eventError.message);
    } else {
      takeoffsCreated += 1;
      const stateSummary = byState[candidate.catalogRow.home_state_code];
      if (stateSummary) stateSummary.takeoffsCreated += 1;
    }
  }
  const { error: healthError } = await db.from("data_source_health").upsert(
    {
      source: snapshot.source,
      last_attempt_at: snapshotObservedAt,
      last_success_at: snapshotObservedAt,
      last_error: null,
      metadata: { worker_id: workerId, live_seen_count: snapshot.live_seen_count },
      updated_at: snapshotObservedAt
    },
    { onConflict: "source" }
  );
  if (healthError) {
    throw new Error(`Source-health write failed: ${healthError.message}`);
  }
  return {
    positionsInserted,
    takeoffsCreated,
    trackedAircraftCount: snapshot.aircraft.length,
    sourceHealthy: true,
    byState,
    priorityAircraftTails: catalog.filter((row) => {
      const state = stateRows.find((state2) => state2.aircraft_id === row.id) ?? currentByAircraft.get(row.id);
      return isPriorityAircraftState(state);
    }).map((row) => row.tail)
  };
}
function isPriorityAircraftState(state) {
  return Boolean(state?.flight_session_id) || state?.observation_status === "airborne" || state?.observation_status === "airborne_candidate" || state?.observation_status === "landing_candidate";
}
function fleetEntryStateCode(entry) {
  const id = stateIdForOpsAircraftTail(entry.tail) ?? "washington";
  return stateCodeForId(id);
}
function filterSeedByState(entries, stateCode) {
  return entries.filter((entry) => {
    const code = fleetEntryStateCode(entry);
    return isSupportedStateCode(code) && (!stateCode || code === stateCode);
  });
}
function supportedFleet() {
  return FLEET.filter((entry) => isSupportedStateCode(fleetEntryStateCode(entry)));
}
function fleetEntryToCatalogRow(entry, updatedAt) {
  const stateId = stateIdForOpsAircraftTail(entry.tail) ?? "washington";
  return {
    tail: entry.tail.trim().toUpperCase(),
    icao24: fleetHex(entry).toUpperCase(),
    home_state_code: stateCodeForId(stateId),
    operator: entry.operator,
    model: entry.model,
    nickname: entry.nickname,
    base: entry.base,
    role: entry.role,
    role_confidence: entry.roleConfidence,
    role_description: entry.roleDescription,
    role_note: entry.roleNote ?? null,
    active: true,
    updated_at: updatedAt
  };
}
function buildPerformanceRows(aircraftRows, updatedAt) {
  return aircraftRows.map((row) => ({
    aircraft_id: String(row.id),
    nominal_endurance_min: AIRCRAFT_DURATION_MINUTES[String(row.tail).toUpperCase()] ?? null,
    reserve_min: 30,
    source_note: "Catalog endurance estimate; verify against an authoritative aircraft source.",
    updated_at: updatedAt
  })).filter((row) => row.nominal_endurance_min != null);
}
function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseTime(value) {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function aircraftObservationGroundState(aircraft) {
  switch (aircraft.observation_status) {
    case "airborne":
    case "airborne_candidate":
      return "airborne";
    case "grounded":
    case "landing_candidate":
      return "grounded";
    case "unknown":
      return "unknown";
    default:
      return aircraft.airborne ? "airborne" : "grounded";
  }
}
function interpolateFlightTransition(beforeAt, afterAt, maxGapMs = FLIGHT_TRANSITION_MAX_GAP_MS) {
  const beforeMs = parseTime(beforeAt);
  const afterMs = parseTime(afterAt);
  if (beforeMs == null || afterMs == null || afterMs < beforeMs || afterMs - beforeMs > maxGapMs) {
    return null;
  }
  return new Date(Math.floor((beforeMs + afterMs) / 2)).toISOString();
}
function estimateLandingTransitionAt(lastAirborneAt, firstGroundedAt) {
  const interpolated = interpolateFlightTransition(
    lastAirborneAt,
    firstGroundedAt
  );
  if (interpolated) return interpolated;
  const firstGroundedMs = parseTime(firstGroundedAt);
  return firstGroundedMs == null ? null : new Date(firstGroundedMs).toISOString();
}
async function resolveCurrentStateCode(db, latitude, longitude, fallbackStateCode) {
  if (latitude == null || longitude == null) return null;
  const { data, error } = await db.rpc("resolve_state_code", {
    input_latitude: latitude,
    input_longitude: longitude
  });
  if (error) {
    console.warn("[ingest] state-code resolution failed:", error.message);
    return fallbackStateCode;
  }
  return typeof data === "string" ? data : fallbackStateCode;
}
function isStaleOpenFlightSession(session, nowIso) {
  if (session?.closed_at) return true;
  const startedAt = parseTime(session?.detected_takeoff_at) ?? parseTime(session?.tracking_started_at);
  const now = parseTime(nowIso);
  return startedAt != null && now != null && now - startedAt > MAX_OPEN_FLIGHT_SESSION_MS;
}
function isUnseenFlightSessionExpired(previous, nowIso) {
  if (!previous?.flight_session_id) return false;
  const lastSeenAt = parseTime(previous.last_seen_at) ?? parseTime(previous.observed_at);
  const now = parseTime(nowIso);
  return lastSeenAt != null && now != null && now - lastSeenAt >= FLIGHT_SESSION_LOST_GRACE_MS;
}
function isStaleAirborneCandidate(previous, nowIso) {
  const startedAt = parseTime(previous?.airborne_candidate_started_at);
  const now = parseTime(nowIso);
  return startedAt != null && now != null && now - startedAt > FLIGHT_TRANSITION_MAX_GAP_MS;
}
function isStaleLandingCandidate(previous, nowIso) {
  const startedAt = parseTime(previous?.landing_candidate_started_at);
  const now = parseTime(nowIso);
  return startedAt != null && now != null && now - startedAt > FLIGHT_TRANSITION_MAX_GAP_MS;
}
function shouldClearUnobservedState(previous) {
  return !previous || previous.flight_session_id != null || previous.observation_status !== "unknown" || previous.observed_at != null;
}
function isNewerAircraftObservation(previous, observedAt) {
  const previousObservedAt = parseTime(previous?.last_seen_at) ?? parseTime(previous?.observed_at);
  const incomingObservedAt = parseTime(observedAt);
  return incomingObservedAt != null && (previousObservedAt == null || incomingObservedAt > previousObservedAt);
}
function shouldSuppressTakeoffNotificationForTimes(detectedTakeoffAt, previousNotificationAt, previousLandingAt) {
  const takeoffMs = parseTime(detectedTakeoffAt);
  if (takeoffMs == null) return false;
  return [previousNotificationAt, previousLandingAt].some((value) => {
    const previousMs = parseTime(value);
    return previousMs != null && previousMs <= takeoffMs && takeoffMs - previousMs < TAKEOFF_NOTIFICATION_COOLDOWN_MS;
  });
}
function takeoffNotificationOccurredAt(detectedTakeoffAt, trackingStartedAt) {
  return detectedTakeoffAt ?? trackingStartedAt;
}
function normalizedAircraftTimestamp(value, snapshotFetchedAt, fallback) {
  const parsed = parseTime(value);
  if (parsed == null) return fallback;
  return new Date(Math.min(parsed, snapshotFetchedAt)).toISOString();
}
async function shouldSuppressTakeoffNotification(db, aircraftId, flightSessionId, detectedTakeoffAt) {
  const takeoffMs = parseTime(detectedTakeoffAt);
  if (takeoffMs == null) return false;
  const cooldownStartedAt = new Date(
    takeoffMs - TAKEOFF_NOTIFICATION_COOLDOWN_MS
  ).toISOString();
  const [
    { data: previousEvent, error: eventError },
    { data: previousSession, error: sessionError }
  ] = await Promise.all([
    db.from("notification_events").select("occurred_at").eq("aircraft_id", aircraftId).eq("event_type", "takeoff").gte("occurred_at", cooldownStartedAt).lt("occurred_at", detectedTakeoffAt).order("occurred_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("flight_sessions").select("detected_landing_at").eq("aircraft_id", aircraftId).neq("id", flightSessionId).not("detected_landing_at", "is", null).gte("detected_landing_at", cooldownStartedAt).lt("detected_landing_at", detectedTakeoffAt).order("detected_landing_at", { ascending: false }).limit(1).maybeSingle()
  ]);
  if (eventError) {
    throw new Error(`Recent takeoff event read failed: ${eventError.message}`);
  }
  if (sessionError) {
    throw new Error(`Recent landing read failed: ${sessionError.message}`);
  }
  return shouldSuppressTakeoffNotificationForTimes(
    detectedTakeoffAt,
    typeof previousEvent?.occurred_at === "string" ? previousEvent.occurred_at : null,
    typeof previousSession?.detected_landing_at === "string" ? previousSession.detected_landing_at : null
  );
}
function inferSnapshotSource(rows, lastSource) {
  const source = rows?.find((row) => row.source)?.source ?? lastSource;
  return source === "opensky" ? "opensky" : "adsbfi";
}

// adsb.fi observation parser
var MAX_AGE_MS = 6e4;
var trialCatalog = FLEET.flatMap((aircraft) => {
  const state = stateIdForOpsAircraftTail(aircraft.tail) ?? "washington";
  if (state !== "washington" && state !== "california") return [];
  return [{
    tail: aircraft.tail,
    hex: fleetHex(aircraft),
    state: state === "washington" ? "WA" : "CA",
    operator: aircraft.operator,
    model: aircraft.model
  }];
});
var finite = (value) => typeof value === "number" && Number.isFinite(value) ? value : null;
var record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
function parseTrialPayload(payload, receivedAt) {
  if (!record(payload) || !Array.isArray(payload.ac) || finite(payload.now) === null) {
    throw new Error("Invalid adsb.fi response: expected ac array and timestamp");
  }
  if (payload.msg != null && payload.msg !== "No error") {
    throw new Error(`adsb.fi: ${String(payload.msg)}`);
  }
  const rawNow = payload.now;
  const sourceNow = rawNow < 1e12 ? rawNow * 1e3 : rawNow;
  if (sourceNow > receivedAt + MAX_AGE_MS) throw new Error("adsb.fi timestamp is in the future");
  const observations = /* @__PURE__ */ new Map();
  for (const row of payload.ac) {
    if (!record(row) || typeof row.hex !== "string") continue;
    const seen = finite(row.seen);
    if (seen === null || seen < 0) continue;
    const positionAge = finite(row.seen_pos);
    const lat = finite(row.lat);
    const lon = finite(row.lon);
    const validPosition = lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && positionAge !== null && positionAge >= 0;
    observations.set(row.hex.toLowerCase(), {
      observedAt: sourceNow - seen * 1e3,
      positionAt: validPosition ? sourceNow - positionAge * 1e3 : null,
      lat: validPosition ? lat : null,
      lon: validPosition ? lon : null,
      altitudeFeet: finite(row.alt_baro),
      speedKnots: finite(row.gs),
      headingDegrees: finite(row.track),
      ground: row.alt_baro === "ground" ? true : finite(row.alt_baro) !== null ? false : null,
      squawk: typeof row.squawk === "string" ? row.squawk : null
    });
  }
  return observations;
}

// adsb.fi live adapter
var AdsbFiError = class extends Error {
  constructor(message, retryAfterMs = 0) {
    super(message);
    this.retryAfterMs = retryAfterMs;
  }
  retryAfterMs;
};
async function fetchAdsbFiSnapshot(catalog, fetcher = fetch) {
  const entries = catalog.filter((entry) => isSupportedStateCode(entry.homeStateCode));
  const hexes = [...new Set(entries.map((entry) => fleetHex(entry.aircraft)))];
  if (!hexes.length || hexes.some((hex) => !/^[a-f0-9]{6}$/.test(hex))) {
    throw new Error("Supported-state catalog contains missing or invalid aircraft identifiers");
  }
  const observations = new Map();
  let previousRequestStartedAt = 0;
  for (let offset = 0; offset < hexes.length; offset += 75) {
    if (previousRequestStartedAt > 0) {
      const delay = 1100 - (Date.now() - previousRequestStartedAt);
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    }
    previousRequestStartedAt = Date.now();
    const batch = hexes.slice(offset, offset + 75);
    const response = await fetcher(`https://opendata.adsb.fi/api/v2/icao/${batch.join(",")}`, {
      headers: { Accept: "application/json", "User-Agent": "OutOfSight/adsb.fi-backend" },
      cache: "no-store",
      signal: AbortSignal.timeout(15e3)
    });
    if (!response.ok) {
      const header = response.headers.get("retry-after");
      const delay = header === null ? 0 : /^\d+(\.\d+)?$/.test(header) ? Number(header) * 1e3 : Math.max(0, Date.parse(header) - Date.now()) || 0;
      throw new AdsbFiError(`adsb.fi HTTP ${response.status}`, delay);
    }
    const payload = await response.json();
    const receivedAt = Date.now();
    const rows = parseTrialPayload(payload, receivedAt);
    const sourceNow = payload.now < 1e12 ? payload.now * 1e3 : payload.now;
    if (receivedAt - sourceNow > 6e4) throw new AdsbFiError("adsb.fi returned an outdated snapshot");
    for (const [hex, observation] of rows) observations.set(hex, observation);
  }
  const now = Date.now();
  const aircraft = entries.map(({ aircraft: aircraft2, homeStateCode }) => {
    const hex = fleetHex(aircraft2);
    const observation = observations.get(hex);
    const base = { ...aircraft2, icao24: hex, home_state_code: homeStateCode };
    if (!observation || now - observation.observedAt > 6e4) {
      return { ...base, observed: false, airborne: false, observation_status: "unknown", last_seen_min: null };
    }
    const positionFresh = observation.positionAt !== null && now - observation.positionAt <= 6e4;
    return {
      ...base,
      observed: true,
      observed_at: new Date(observation.observedAt).toISOString(),
      airborne: observation.ground === false,
      observation_status: observation.ground === true ? "grounded" : observation.ground === false ? "airborne_candidate" : "unknown",
      position_observed_at: positionFresh ? new Date(observation.positionAt).toISOString() : null,
      lat: positionFresh ? observation.lat ?? void 0 : void 0,
      lon: positionFresh ? observation.lon ?? void 0 : void 0,
      altitude_ft: observation.altitudeFeet ?? void 0,
      ground_speed_kt: observation.speedKnots ?? void 0,
      heading: observation.headingDegrees ?? void 0,
      squawk: observation.squawk,
      last_seen_min: Math.max(0, (now - observation.observedAt) / 6e4)
    };
  });
  return {
    source: "adsbfi",
    source_ok: true,
    fetched_at: now,
    aircraft,
    live_seen_count: aircraft.filter((row) => row.observed).length
  };
}

// lib/tracks.ts
var CURRENT_FLIGHT_GAP_SECONDS = 5 * 60;
function getCurrentFlightTrackFromPoints(points, nowMs = Date.now(), gapSeconds = CURRENT_FLIGHT_GAP_SECONDS) {
  const sorted = points.filter((point) => Number.isFinite(point.ts)).sort((a, b) => a.ts - b.ts);
  const latest = sorted.at(-1);
  if (!latest) return null;
  const gapMs = gapSeconds * 1e3;
  if (Math.abs(nowMs - latest.ts * 1e3) > gapMs) return null;
  const session = [];
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const point = sorted[index];
    session.unshift(point);
    const previous = sorted[index - 1];
    if (!previous || point.ts - previous.ts > gapSeconds) break;
  }
  const first = session[0];
  if (!first) return null;
  return {
    points: session,
    startedAtMs: first.ts * 1e3,
    lastSampleMs: latest.ts * 1e3
  };
}
async function getCurrentFlightTrack(tail, nowMs = Date.now()) {
  const points = await readCurrentFlightPoints(tail);
  const track = getCurrentFlightTrackFromPoints(
    points,
    nowMs,
    Number.MAX_SAFE_INTEGER
  );
  return track;
}
async function readCurrentFlightPoints(tail) {
  if (!isSupabaseConfigured()) return [];
  const db = getSupabaseAdmin();
  const { data: aircraft, error: aircraftError } = await db.from("aircraft").select("id").eq("tail", tail.trim().toUpperCase()).maybeSingle();
  if (aircraftError || !aircraft) return [];
  const { data: current, error: currentError } = await db.from("aircraft_current_state").select("flight_session_id").eq("aircraft_id", aircraft.id).maybeSingle();
  if (currentError || !current?.flight_session_id) return [];
  const { data, error } = await db.from("aircraft_positions").select(
    "latitude,longitude,altitude_ft,ground_speed_kt,heading_deg,observed_at"
  ).eq("flight_session_id", current.flight_session_id).order("observed_at", { ascending: true });
  if (error) {
    console.warn(`[tracks] read failed for ${tail}:`, error.message);
    return [];
  }
  return (data ?? []).map((row) => ({
    lat: Number(row.latitude),
    lon: Number(row.longitude),
    alt: nullableNumber(row.altitude_ft),
    spd: nullableNumber(row.ground_speed_kt),
    trk: nullableNumber(row.heading_deg),
    ts: Math.floor(Date.parse(String(row.observed_at)) / 1e3)
  }));
}
function nullableNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// lib/live-data-protocol.ts
var liveTopic = (state) => `oos-live:${state}`;
var CHUNK_CHARS = 24e3;
var MAX_CHUNKS = 256;
function encodeLiveState(update) {
  const data = JSON.stringify(update);
  const count = Math.ceil(data.length / CHUNK_CHARS);
  if (count > MAX_CHUNKS) throw new Error("Live state exceeds broadcast limit");
  return Array.from({ length: count }, (_, index) => ({
    version: 1,
    state: update.state,
    revision: update.revision,
    index,
    count,
    data: data.slice(index * CHUNK_CHARS, (index + 1) * CHUNK_CHARS)
  }));
}

// lib/live-data-server.ts
async function getLiveState(state) {
  const revision = Date.now();
  const snapshot = await getDatabaseSnapshot(state);
  const entries = await Promise.all(snapshot.aircraft.filter((a) => a.airborne || a.last_known_airborne).map(async (a) => {
    const track = await getCurrentFlightTrack(a.tail, revision);
    return [a.tail, (track?.points ?? []).map(({ lat, lon, ts }) => ({ lat, lon, ts }))];
  }));
  return { version: 1, state, revision, snapshot, trails: Object.fromEntries(entries) };
}
async function broadcastLiveStates(sourceUnavailable = false) {
  const url = readServerEnv("SUPABASE_URL");
  const key = readServerEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Live backend is not configured");
  await Promise.all(SUPPORTED_STATE_CODES.map(async (state) => {
    const update = await getLiveState(state);
    if (sourceUnavailable) update.snapshot = {
      ...update.snapshot,
      source_ok: false,
      source_error: "Aircraft feed is temporarily unavailable."
    };
    const frames = encodeLiveState(update);
    for (let offset = 0; offset < frames.length; offset += 4) {
      const response = await fetch(`${url}/realtime/v1/api/broadcast`, {
        method: "POST",
        signal: AbortSignal.timeout(5e3),
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messages: frames.slice(offset, offset + 4).map((payload) => ({
          topic: liveTopic(state),
          event: "state",
          private: true,
          payload
        })) })
      });
      if (!response.ok) throw new Error(`Live broadcast failed (${response.status})`);
    }
  }));
}

// cloud-backend/src/ingest.ts
runtime.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Use POST" }, 405);
  const token = request.headers.get("x-oos-ingest-token");
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return json({ error: "Unauthorized" }, 401);
  const db = getSupabaseAdmin();
  const auth = await db.from("app_settings").select("value").eq("key", "aircraft_ingest_token_hash").single();
  const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  if (auth.error || auth.data?.value !== digest) return json({ error: "Unauthorized" }, 401);
  const workerId = crypto.randomUUID();
  const claim = await db.rpc("claim_worker_lease", {
    lease_name: "aircraft-ingestion",
    lease_owner: workerId,
    lease_seconds: 90
  });
  if (claim.error) return json({ error: "Worker lease unavailable" }, 503);
  if (!claim.data) return json({ skipped: "another worker is active" });
  let runId;
  const started = Date.now();
  try {
    const run = await db.from("ingestion_runs").insert({
      worker_id: workerId,
      source: "adsbfi",
      started_at: new Date(started).toISOString(),
      metadata: { states: SUPPORTED_STATE_CODES, interval_seconds: 30 }
    }).select("id").single();
    if (run.error) throw new Error(run.error.message);
    runId = run.data.id;
    const result = await db.from("aircraft_catalog_public").select("*").in("home_state_code", SUPPORTED_STATE_CODES).order("tail").limit(1e3);
    if (result.error) throw new Error(result.error.message);
    if (!result.data.length || result.data.length >= 1e3) throw new Error("Unexpected supported-state catalog size");
    const catalog = result.data.map((row) => ({
      aircraft: {
        tail: row.tail,
        hex: row.icao24,
        operator: row.operator,
        model: row.model,
        nickname: row.nickname,
        base: row.base,
        role: row.role,
        roleConfidence: row.role_confidence,
        roleDescription: row.role_description,
        roleNote: row.role_note ?? void 0
      },
      homeStateCode: row.home_state_code,
      nominalEnduranceMin: row.nominal_endurance_min,
      usableFuelGallons: row.usable_fuel_gallons,
      lowBurnGph: row.low_burn_gph,
      highBurnGph: row.high_burn_gph,
      reserveMin: row.reserve_min
    }));
    const snapshot = await fetchAdsbFiSnapshot(catalog);
    const summary = await ingestSnapshot(snapshot, workerId, { catalogSeeded: true });
    const finished = (/* @__PURE__ */ new Date()).toISOString();
    const update = await db.from("ingestion_runs").update({
      status: "succeeded",
      finished_at: finished,
      source_aircraft_count: snapshot.live_seen_count,
      tracked_aircraft_count: snapshot.aircraft.length,
      positions_inserted: summary.positionsInserted,
      takeoffs_created: summary.takeoffsCreated,
      metadata: { states: SUPPORTED_STATE_CODES, interval_seconds: 30, duration_ms: Date.now() - started, by_state: summary.byState }
    }).eq("id", runId);
    if (update.error) throw new Error(update.error.message);
    try {
      await broadcastLiveStates();
    } catch (error) {
      console.error("Live broadcast failed:", error instanceof Error ? error.message : "unknown");
    }
    return json({ ok: true, aircraft: snapshot.aircraft.length, observed: snapshot.live_seen_count, positions: summary.positionsInserted });
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
    const failedAt = (/* @__PURE__ */ new Date()).toISOString();
    const writes = await Promise.all([
      db.from("data_source_health").upsert({
        source: "adsbfi",
        last_attempt_at: new Date(started).toISOString(),
        last_failure_at: failedAt,
        last_error: message,
        updated_at: failedAt
      }),
      ...runId ? [db.from("ingestion_runs").update({ status: "failed", error: message, finished_at: failedAt }).eq("id", runId)] : []
    ]);
    for (const write of writes) if (write.error) console.error("Failure log write:", write.error.message);
    console.error("adsb.fi ingestion failed:", message);
    try {
      await broadcastLiveStates(true);
    } catch (error2) {
      console.error("Live health broadcast failed:", error2 instanceof Error ? error2.message : "unknown");
    }
    return json({ ok: false, error: message, retry_after_seconds: 30 }, 503);
  } finally {
    const release = await db.rpc("release_worker_lease", { lease_name: "aircraft-ingestion", lease_owner: workerId });
    if (release.error) console.error("Lease release failed:", release.error.message);
  }
});
/*! Bundled license information:

@capacitor/core/dist/index.cjs.js:
  (*! Capacitor: https://capacitorjs.com/ - MIT License *)
*/

