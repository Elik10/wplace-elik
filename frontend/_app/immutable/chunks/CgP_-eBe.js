import "./ClL9a_Zs.js";
import {
  e as ne,
  F as re,
  N as ce,
  I as oe,
  bx as le,
  p as J,
  o as q,
  l as Q,
  w as ie,
  a as X,
  g as k,
  b as I,
  c as Z,
  f as R,
  t as K,
  u as p,
  z as se,
  m as de,
  d,
  r as u,
  s as f,
  n as H,
} from "./iK5FT0Sa.js";
import { s as g } from "./BHnQYZx5.js";
import { i as B } from "./6Mc7KQD2.js";
import { a as $, c as ee, d as ue, s as O } from "./Cw1VVyw7.js";
import { p as s, r as fe } from "./ClBgBzqC.js";
import { g as Y, t as V, P as _e, a as ve } from "./B3m8Ax5i.js";
import { o as me } from "./Ba2x20r8.js";
import { g as h } from "./DQcFTXWv.js";
import { L as be } from "./qHbcPXTE.js";
(function () {
  try {
    var a =
      typeof window < "u"
        ? window
        : typeof global < "u"
        ? global
        : typeof globalThis < "u"
        ? globalThis
        : typeof self < "u"
        ? self
        : {};
    a.SENTRY_RELEASE = { id: "0fdca126ca32380ac4e95a0011d2b66881dfb9e6" };
  } catch {}
})();
try {
  (function () {
    var a =
        typeof window < "u"
          ? window
          : typeof global < "u"
          ? global
          : typeof globalThis < "u"
          ? globalThis
          : typeof self < "u"
          ? self
          : {},
      e = new a.Error().stack;
    e &&
      ((a._sentryDebugIds = a._sentryDebugIds || {}),
      (a._sentryDebugIds[e] = "f9ec5ba7-3f48-458c-85a2-338d14fd2c54"),
      (a._sentryDebugIdIdentifier =
        "sentry-dbid-f9ec5ba7-3f48-458c-85a2-338d14fd2c54"));
  })();
} catch {}
function ge(a, e, n) {
  ne(() => {
    var r = re(() => e(a, n == null ? void 0 : n()) || {});
    if (n && r != null && r.update) {
      var y = !1,
        m = {};
      ce(() => {
        var _ = n();
        oe(_), y && le(m, _) && ((m = _), r.update(_));
      }),
        (y = !0);
    }
    if (r != null && r.destroy) return () => r.destroy();
  });
}
const he = (a) => `Login with ${a.name}`,
  ye = (a) => `Entrar com ${a.name}`,
  we = (a, e = {}) => ((e.locale ?? h()) === "en" ? he(a) : ye(a)),
  xe = () => "By signing in, you agree to the rules set by the owner of this instance.",
  ke = () => "",
  Ie = (a = {}, e = {}) => ((e.locale ?? h()) === "en" ? xe() : ke()),
  Ce = () => "Terms of Service",
  Le = () => "Termos de Serviço",
  Ee = (a = {}, e = {}) => ((e.locale ?? h()) === "en" ? Ce() : Le()),
  Te = () => "and",
  Me = () => "e",
  Be = (a = {}, e = {}) => ((e.locale ?? h()) === "en" ? Te() : Me()),
  De = () => "Privacy Policy",
  Fe = () => "Política de privacidade",
  Pe = (a = {}, e = {}) => ((e.locale ?? h()) === "en" ? De() : Fe()),
  Se = () => "Do you have a gplace Twitch account?",
  Ne = () => "Você tem uma conta gplace associada à Twitch?",
  ze = (a = {}, e = {}) => ((e.locale ?? h()) === "en" ? Se() : Ne()),
  Ke = () => "Migrate your account",
  Re = () => "Migre sua conta",
  Ue = (a = {}, e = {}) => ((e.locale ?? h()) === "en" ? Ke() : Re()),
  je = () => "Code of Conduct",
  Ae = () => "Código de Conduta",
  Ge = (a = {}, e = {}) => ((e.locale ?? h()) === "en" ? je() : Ae());
var We = R("<div></div>");
function Ye(a, e) {
  J(e, !0);
  let n = s(e, "widgetId", 15),
    r = s(e, "appearance", 3, "always"),
    y = s(e, "language", 3, "auto"),
    m = s(e, "execution", 3, "render"),
    _ = s(e, "retryInterval", 3, 8e3),
    U = s(e, "retry", 3, "auto"),
    C = s(e, "refreshExpired", 3, "auto"),
    j = s(e, "theme", 3, "auto"),
    D = s(e, "size", 3, "normal"),
    L = s(e, "tabIndex", 3, 0);
  s(
    e,
    "reset",
    15
  )(() => {
    var t;
    n() &&
      ((t = window == null ? void 0 : window.turnstile) == null ||
        t.reset(n()));
  });
  const E = p(() => ({
      sitekey: e.siteKey,
      callback: (t, l) => {
        var o;
        (o = e.callback) == null || o.call(e, t, l);
      },
      "error-callback": (t) => {
        var l;
        (l = e.errorCallback) == null || l.call(e, t);
      },
      "timeout-callback": () => {
        var t;
        (t = e.timeoutCallback) == null || t.call(e);
      },
      "expired-callback": () => {
        var t;
        (t = e.expiredCallback) == null || t.call(e);
      },
      "before-interactive-callback": () => {
        var t;
        (t = e.beforeInteractiveCallback) == null || t.call(e);
      },
      "after-interactive-callback": () => {
        var t;
        (t = e.afterInteractiveCallback) == null || t.call(e);
      },
      "unsupported-callback": () => {
        var t;
        return (t = e.unsupportedCallback) == null ? void 0 : t.call(e);
      },
      "response-field-name":
        e.responseFieldName ?? e.formsField ?? "cf-turnstile-response",
      "response-field": e.responseField ?? e.forms ?? !0,
      "refresh-expired": C(),
      "retry-interval": _(),
      tabindex: L(),
      appearance: r(),
      execution: m(),
      language: y(),
      action: e.action,
      retry: U(),
      theme: j(),
      cData: e.cData,
      size: D(),
    })),
    T = (t, l) => {
      let o = window.turnstile.render(t, l);
      return (
        n(o),
        {
          destroy() {
            window.turnstile.remove(o);
          },
          update(c) {
            window.turnstile.remove(o),
              (o = window.turnstile.render(t, c)),
              n(o);
          },
        }
      );
    };
  let w = Q(!1);
  me(() => {
    if ((q(w, !0), !Y.turnstatileLoaded)) {
      const t = document.createElement("script");
      (t.type = "text/javascript"),
        (t.src =
          "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"),
        (t.async = !0),
        t.addEventListener("load", () => (Y.turnstatileLoaded = !0), {
          once: !0,
        }),
        document.head.appendChild(t);
    }
    return () => {
      q(w, !1);
    };
  });
  var F = ie(),
    P = X(F);
  {
    var S = (t) => {
      var l = We();
      let o;
      ge(
        l,
        (c, i) => (T == null ? void 0 : T(c, i)),
        () => k(E)
      ),
        K(
          () =>
            (o = $(l, 1, ee(e.class), "svelte-1lm836y", o, {
              flexible: D() == "flexible",
            }))
        ),
        I(t, l);
    };
    B(P, (t) => {
      Y.turnstatileLoaded && k(w) && t(S);
    });
  }
  I(a, F), Z();
}
var qe = se(
  '<svg><path d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027" fill="#4285F4"></path><path d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1" fill="#34A853"></path><path d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782" fill="#FBBC05"></path><path d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251" fill="#EB4335"></path></svg>'
);
function He(a, e) {
  let n = fe(e, ["$$slots", "$$events", "$$legacy"]);
  var r = qe();
  ue(r, () => ({
    viewBox: "0 0 256 262",
    xmlns: "http://www.w3.org/2000/svg",
		style: "display: none;",
    ...n,
  })),
    I(a, r);
}
var Oe = R(
    '<a><!> </a> <div class="mt-2 flex flex-col items-center gap-1"><!> <!></div>',
    1
  ),
  Ve = R(
    '<p class="text-base-content/60 mt-8 text-center text-xs"> <a class="font-medium"> </a>.</p>'
  ),
  Je = R(
    '<div><div class="flex justify-center py-4"><!></div> <div class="flex flex-col items-center gap-2 pt-6"><!></div> <p class="text-base-content/60 mt-2 text-center text-xs"> <a class="font-medium" href="/terms/terms-of-service" target="_blank"> </a> <a class="font-medium" href="/terms/privacy" target="_blank"> </a> <a class="font-medium" href="/terms/code-of-conduct" target="_blank"> </a> </p> <!></div>'
  );
function ct(a, e) {
  J(e, !0);
  const n = document.createElement("div");
  n.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:16px 8px 8px;">
      <div style="text-align:center;">
        <div style="font-size:40px;line-height:1;font-weight:800;color:#4169e1;letter-spacing:0.03em;">gplace</div>
        <p data-auth-subtitle style="margin:10px 0 0;color:rgba(30,41,59,.68);font-size:14px;">Create an account</p>
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;width:100%;max-width:420px;padding:6px;border-radius:18px;background:rgba(65,105,225,.08);">
        <button type="button" data-auth-tab="register" style="border:0;border-radius:14px;padding:12px 14px;background:#4169e1;color:#fff;font:inherit;font-weight:700;cursor:pointer;">Register</button>
        <button type="button" data-auth-tab="login" style="border:0;border-radius:14px;padding:12px 14px;background:transparent;color:#516784;font:inherit;font-weight:700;cursor:pointer;">Log in</button>
      </div>
      <form data-auth-form="register" style="display:flex;flex-direction:column;gap:12px;width:100%;max-width:420px;">
        <label style="display:flex;flex-direction:column;gap:6px;">
          <span style="font-size:13px;font-weight:700;color:#5b708a;">Username</span>
          <input name="username" autocomplete="username" minlength="3" maxlength="16" required style="width:100%;box-sizing:border-box;border:1px solid #d4e0f4;border-radius:16px;padding:14px 16px;background:#fff;color:#223a5f;font:inherit;outline:none;" />
        </label>
        <label style="display:flex;flex-direction:column;gap:6px;">
          <span style="font-size:13px;font-weight:700;color:#5b708a;">Password</span>
          <input name="password" type="password" autocomplete="new-password" minlength="8" required style="width:100%;box-sizing:border-box;border:1px solid #d4e0f4;border-radius:16px;padding:14px 16px;background:#fff;color:#223a5f;font:inherit;outline:none;" />
        </label>
        <div data-auth-error style="min-height:18px;font-size:13px;color:#cc3d56;"></div>
        <button type="submit" style="border:0;border-radius:18px;padding:14px 18px;background:linear-gradient(180deg,#4d78ef 0%,#315fd9 100%);color:#fff;font:inherit;font-weight:800;cursor:pointer;">Create account</button>
      </form>
      <form data-auth-form="login" style="display:none;flex-direction:column;gap:12px;width:100%;max-width:420px;">
        <label style="display:flex;flex-direction:column;gap:6px;">
          <span style="font-size:13px;font-weight:700;color:#5b708a;">Username</span>
          <input name="username" autocomplete="username" minlength="3" maxlength="16" required style="width:100%;box-sizing:border-box;border:1px solid #d4e0f4;border-radius:16px;padding:14px 16px;background:#fff;color:#223a5f;font:inherit;outline:none;" />
        </label>
        <label style="display:flex;flex-direction:column;gap:6px;">
          <span style="font-size:13px;font-weight:700;color:#5b708a;">Password</span>
          <input name="password" type="password" autocomplete="current-password" minlength="8" required style="width:100%;box-sizing:border-box;border:1px solid #d4e0f4;border-radius:16px;padding:14px 16px;background:#fff;color:#223a5f;font:inherit;outline:none;" />
        </label>
        <div data-auth-error style="min-height:18px;font-size:13px;color:#cc3d56;"></div>
        <button type="submit" style="border:0;border-radius:18px;padding:14px 18px;background:linear-gradient(180deg,#4d78ef 0%,#315fd9 100%);color:#fff;font:inherit;font-weight:800;cursor:pointer;">Log in</button>
      </form>
      <p style="margin:0;color:#95a4b9;font-size:12px;text-align:center;">By continuing, you agree to the rules set by the owner of this instance.</p>
    </div>
  `;
  const r = n.firstElementChild;
  const y = r.querySelectorAll("[data-auth-tab]");
  const m = r.querySelectorAll("[data-auth-form]");
  const _ = r.querySelector("[data-auth-subtitle]");
  function U(c) {
    y.forEach((i) => {
      const v = i.getAttribute("data-auth-tab") === c;
      i.style.background = v ? "#4169e1" : "transparent";
      i.style.color = v ? "#fff" : "#516784";
      i.style.boxShadow = v ? "0 10px 24px rgba(65,105,225,.22)" : "none";
    }),
      m.forEach((i) => {
        const v = i.getAttribute("data-auth-form") === c;
        i.style.display = v ? "flex" : "none";
        const b = i.querySelector("[data-auth-error]");
        b && (b.textContent = "");
      });
    _ && (_.textContent = c === "login" ? "login to your account" : "Create an account");
  }
  function C(c, i) {
    const v = i.querySelector('input[name="username"]'),
      b = i.querySelector('input[name="password"]'),
      M = i.querySelector("[data-auth-error]"),
      N = i.querySelector('button[type="submit"]'),
      z = v ? v.value.trim() : "",
      G = b ? b.value : "";
    M && (M.textContent = ""),
      !z || !G
        ? M && (M.textContent = "Username and password required.")
        : G.length < 8
        ? M && (M.textContent = "Password must be at least 8 characters.")
        : ((N.disabled = !0),
          (N.textContent = "Please wait..."),
          v && (v.disabled = !0),
          b && (b.disabled = !0),
          fetch(c === "register" ? "/register" : "/login", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            credentials: "include",
            body: JSON.stringify({ username: z, password: G }),
          })
            .then((x) =>
              x.json().catch(() => ({})).then((W) => {
                if (!x.ok || !W.success) throw new Error(W.error || "Something went wrong. Please try again.");
                window.location.reload();
              })
            )
            .catch((x) => {
              M && (M.textContent = x instanceof Error ? x.message : "Something went wrong. Please try again.");
            })
            .finally(() => {
              N.disabled = !1,
                (N.textContent = c === "register" ? "Create account" : "Log in"),
                v && (v.disabled = !1),
                b && (b.disabled = !1);
            }));
  }
  y.forEach((c) => {
    c.addEventListener("click", () => U(c.getAttribute("data-auth-tab") || "register"));
  }),
    m.forEach((c) => {
      c.addEventListener("submit", (i) => {
        i.preventDefault(), C(c.getAttribute("data-auth-form") || "register", c);
      });
    }),
    U("register"),
    I(a, r),
    Z();
}
export { ct as L };
