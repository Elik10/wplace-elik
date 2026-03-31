import "./ClL9a_Zs.js";
import {
  p as b,
  t as f,
  b as A,
  c as m,
  r as _,
} from "./iK5FT0Sa.js";
import { d as w, s as x } from "./Cw1VVyw7.js";
import { p as E, r as T } from "./ClBgBzqC.js";
(function () {
  try {
    var e =
      typeof window < "u"
        ? window
        : typeof global < "u"
        ? global
        : typeof globalThis < "u"
        ? globalThis
        : typeof self < "u"
        ? self
        : {};
    e.SENTRY_RELEASE = { id: "0fdca126ca32380ac4e95a0011d2b66881dfb9e6" };
  } catch {}
})();
try {
  (function () {
    var e =
        typeof window < "u"
          ? window
          : typeof global < "u"
          ? global
          : typeof globalThis < "u"
          ? globalThis
          : typeof self < "u"
          ? self
          : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "5060eff3-df12-495e-bdd2-4e362ec484ae"),
      (e._sentryDebugIdIdentifier =
        "sentry-dbid-5060eff3-df12-495e-bdd2-4e362ec484ae"));
  })();
} catch {}
const S = "/img/gplace-logo.png";
function z(e, t) {
  b(t, !0);
  let a = E(t, "size", 3, "default"),
    p = T(t, ["$$slots", "$$events", "$$legacy", "hasText", "size"]);
  var s = document.createElement("div");
  w(s, () => ({ ...p }));
  var l = document.createElement("img");
  l.alt = "gplace";
  s.appendChild(l);
  let o = null;
  if (t.hasText) {
    o = document.createElement("span");
    o.textContent = "gplace";
    s.appendChild(o);
  }
  _(s),
    f(() => {
      const i = a();
      s.className = `flex items-center gap-1.5 ${t.class ?? ""}`.trim();
      l.className = `pixelated ${i === "default" ? "size-10" : i === "medium" ? "size-16" : "size-20"}`;
      x(l, "src", S);
      if (o) {
        o.className = `text-base-content font-pixel ${i === "default" ? "text-4xl" : "text-5xl"}`;
      }
    }),
    A(e, s),
    m();
}
export { z as L };
