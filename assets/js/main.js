import { createStage, createMiniScenes } from "./scene.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/* ------------------------------------------------------------------
   Preloader
------------------------------------------------------------------- */

const preloader = document.getElementById("preloader");
const loadbar = document.getElementById("loadbar");
const loadpct = document.getElementById("loadpct");

let loadValue = 0;
let loadDone = false;

function setLoad(v) {
  loadValue = clamp(v, 0, 100);
  loadbar.style.width = `${loadValue}%`;
  loadpct.textContent = String(Math.round(loadValue)).padStart(2, "0");
}

const loadTimer = window.setInterval(() => {
  if (loadDone) return;
  setLoad(loadValue + Math.random() * 9 + 2);
}, 130);

function finishLoad() {
  if (loadDone) return;
  loadDone = true;
  window.clearInterval(loadTimer);
  setLoad(100);
  window.setTimeout(() => {
    preloader.classList.add("is-hidden");
    document.body.classList.remove("is-loading");
    document.body.classList.add("is-ready");
    window.setTimeout(() => {
      preloader.setAttribute("aria-hidden", "true");
      preloader.style.display = "none";
    }, 1000);
  }, 380);
}

window.addEventListener("load", finishLoad, { once: true });
window.setTimeout(finishLoad, 3600);

/* ------------------------------------------------------------------
   Three.js stage
------------------------------------------------------------------- */

let stage = null;
const stageCanvas = document.getElementById("stage");
try {
  stage = createStage(stageCanvas);
} catch (error) {
  console.error("WebGL stage failed:", error);
  stageCanvas.style.display = "none";
}

/* ------------------------------------------------------------------
   Small utilities
------------------------------------------------------------------- */

const header = document.getElementById("header");
const burger = document.getElementById("burger");
const mobileMenu = document.getElementById("mobileMenu");
const cursor = document.getElementById("cursor");
const morph = document.querySelector("[data-morph]");
const morphBar = document.getElementById("morphBar");
const morphPct = document.getElementById("morphPct");
const hudLod = document.getElementById("hudLod");
const hudElements = document.getElementById("hudElements");
const morphTexts = [...document.querySelectorAll("[data-morph-text]")];
const legendRender = document.querySelector(".legend--render");
const legendBim = document.querySelector(".legend--bim");
const heroCopy = document.querySelector(".hero__copy");
const heroTopline = document.querySelector(".hero__topline");
const stageShade = document.querySelector(".stage-shade");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const isFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/* ------------------------------------------------------------------
   Scroll: header, morph progress, hero parallax
------------------------------------------------------------------- */

let lastScroll = 0;
let morphP = 0;
let menuOpen = false;

function updateScrollUI() {
  const y = window.scrollY;
  header.classList.toggle("is-scrolled", y > 36);

  if (heroCopy) {
    const heroShift = Math.min(y, window.innerHeight) * 0.055;
    heroCopy.style.transform = reduceMotion ? "" : `translate3d(0, ${heroShift}px, 0)`;
  }
  if (heroTopline) {
    const lineShift = Math.min(y, window.innerHeight) * 0.025;
    heroTopline.style.transform = reduceMotion ? "" : `translate3d(0, ${lineShift}px, 0)`;
  }

  if (morph) {
    const total = Math.max(1, morph.offsetHeight - window.innerHeight);
    const rect = morph.getBoundingClientRect();
    morphP = clamp(-rect.top / total, 0, 1);

    stage?.setProgress(morphP);

    const isBim = morphP > 0.22;
    const inMorphView = rect.top < 0 && rect.bottom > window.innerHeight * 0.85;
    morph.classList.toggle("is-bim", isBim);
    document.body.classList.toggle("is-bim", isBim && inMorphView);

    /* The paper veil fades out continuously with the morph so it never snaps
       back over a tower that is already in BIM mode. */
    if (stageShade) {
      stageShade.style.opacity = reduceMotion
        ? ""
        : String(clamp(1 - morphP / 0.22, 0, 1));
    }

    if (morphBar) morphBar.style.width = `${morphP * 100}%`;
    if (morphPct) morphPct.textContent = `${String(Math.round(morphP * 100)).padStart(2, "0")}%`;

    const stageIndex = morphP < 0.33 ? 0 : morphP < 0.68 ? 1 : 2;
    morphTexts.forEach((text, index) => {
      text.classList.toggle("is-active", index === stageIndex);
    });

    legendRender?.classList.toggle("is-on", morphP < 0.5);
    legendBim?.classList.toggle("is-on", morphP >= 0.5);

    if (hudLod) {
      const lod = morphP < 0.24 ? 200 : morphP < 0.54 ? 300 : morphP < 0.8 ? 350 : 400;
      if (hudLod.textContent !== String(lod)) hudLod.textContent = lod;
    }
    if (hudElements) {
      const elements = Math.round(easeOut(morphP) * 18420);
      const formatted = elements.toLocaleString("ru-RU").replace(/\s/g, " ");
      if (hudElements.textContent !== formatted) hudElements.textContent = formatted;
    }
  }

  lastScroll = y;
}

let scrollTicking = false;
window.addEventListener(
  "scroll",
  () => {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
      updateScrollUI();
      scrollTicking = false;
    });
  },
  { passive: true }
);

window.addEventListener("resize", updateScrollUI, { passive: true });

/* ------------------------------------------------------------------
   Mouse + cursor
------------------------------------------------------------------- */

let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
let cursorX = mouseX;
let cursorY = mouseY;

if (isFinePointer && cursor) {
  window.addEventListener(
    "pointermove",
    (event) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
      const nx = (mouseX / window.innerWidth) * 2 - 1;
      const ny = (mouseY / window.innerHeight) * 2 - 1;
      stage?.setMouse(nx, ny);
      cursor.classList.remove("is-hidden");
    },
    { passive: true }
  );

  document.addEventListener("pointerover", (event) => {
    if (event.target.closest("a, button, canvas, [data-cursor]")) {
      cursor.classList.add("is-hover");
    }
  });

  document.addEventListener("pointerout", (event) => {
    if (event.target.closest("a, button, canvas, [data-cursor]")) {
      cursor.classList.remove("is-hover");
    }
  });

  document.documentElement.addEventListener("mouseleave", () => {
    cursor.classList.add("is-hidden");
  });

  const cursorLoop = () => {
    cursorX += (mouseX - cursorX) * 0.18;
    cursorY += (mouseY - cursorY) * 0.18;
    cursor.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0) translate(-50%, -50%)`;
    requestAnimationFrame(cursorLoop);
  };
  requestAnimationFrame(cursorLoop);
} else if (cursor) {
  cursor.style.display = "none";
}

/* ------------------------------------------------------------------
   Magnetic buttons
------------------------------------------------------------------- */

if (isFinePointer && !reduceMotion) {
  document.querySelectorAll(".btn, .header__cta").forEach((button) => {
    button.addEventListener("pointermove", (event) => {
      const rect = button.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;
      button.style.transform = `translate(${x * 0.12}px, ${y * 0.16}px)`;
    });
    button.addEventListener("pointerleave", () => {
      button.style.transform = "";
    });
  });
}

/* ------------------------------------------------------------------
   Reveal + counters
------------------------------------------------------------------- */

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-in");
      revealObserver.unobserve(entry.target);
    });
  },
  { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
);

document.querySelectorAll("[data-reveal]").forEach((element) => {
  revealObserver.observe(element);
});

const stepObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      entry.target.classList.toggle("is-active", entry.isIntersecting);
    });
  },
  { threshold: 0.55, rootMargin: "-20% 0px -28% 0px" }
);

document.querySelectorAll(".step").forEach((step) => stepObserver.observe(step));

function animateCounter(element) {
  const raw = element.dataset.count;
  if (raw === undefined) return;
  const target = Number(raw);
  const suffix = element.dataset.suffix || "";
  const decimals = raw.includes(".") ? 1 : 0;
  const nogroup = "nogroup" in element.dataset;
  const duration = reduceMotion ? 0 : 1300;
  const start = performance.now();

  const tick = (now) => {
    const t = duration === 0 ? 1 : clamp((now - start) / duration, 0, 1);
    const value = target * easeOut(t);
    const text =
      decimals > 0
        ? value.toFixed(decimals).replace(".", ",")
        : nogroup
          ? String(Math.round(value))
          : Math.round(value).toLocaleString("ru-RU");
    element.textContent = text + suffix;
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const counterObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      animateCounter(entry.target);
      counterObserver.unobserve(entry.target);
    });
  },
  { threshold: 0.6 }
);

document.querySelectorAll("[data-count]").forEach((element) => {
  counterObserver.observe(element);
});

/* ------------------------------------------------------------------
   Mobile menu + anchors
------------------------------------------------------------------- */

function setMenu(open) {
  menuOpen = open;
  burger.classList.toggle("is-open", open);
  burger.setAttribute("aria-expanded", String(open));
  burger.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
  mobileMenu.classList.toggle("is-open", open);
  mobileMenu.setAttribute("aria-hidden", String(!open));
  document.body.classList.toggle("menu-open", open);
  document.body.style.overflow = open ? "hidden" : "";
}

burger?.addEventListener("click", () => setMenu(!menuOpen));

mobileMenu?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => setMenu(false));
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 900 && menuOpen) setMenu(false);
});

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const hash = link.getAttribute("href");
    if (!hash || hash.length < 2) return;
    const target = document.querySelector(hash);
    if (!target) return;

    event.preventDefault();
    if (menuOpen) setMenu(false);

    const headerOffset = hash === "#morph" ? 0 : 58;
    const top =
      hash === "#top"
        ? 0
        : target.getBoundingClientRect().top + window.scrollY - headerOffset;

    window.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
  });
});

/* ------------------------------------------------------------------
   Contact form
------------------------------------------------------------------- */

const form = document.getElementById("contactForm");
const formHint = document.getElementById("formHint");

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const name = String(data.get("name") || "").trim();
  const company = String(data.get("company") || "").trim();
  const contact = String(data.get("contact") || "").trim();
  const area = String(data.get("area") || "").trim();
  const type = String(data.get("type") || "").trim();
  const floors = String(data.get("floors") || "").trim();
  const message = String(data.get("message") || "").trim();

  if (!name || !contact) {
    formHint.textContent = "Заполните имя и контакт — иначе мы не сможем ответить.";
    formHint.style.color = "#fb7185";
    formHint.classList.remove("is-ok");
    return;
  }

  const subject = `BIM-запрос — ${company || name}`;
  const body = [
    `Имя: ${name}`,
    `Компания: ${company || "—"}`,
    `Контакт: ${contact}`,
    `Тип объекта: ${type || "—"}`,
    `Этажность: ${floors || "—"}`,
    `Площадь: ${area || "—"} м²`,
    "",
    message || "Без комментария",
  ].join("\n");

  const waText = `${subject}\n\n${body}`;
  const waUrl = `https://wa.me/77775556789?text=${encodeURIComponent(
    waText
  )}`;

  formHint.textContent = "Запрос сформирован. Открываем WhatsApp — или позвоните нам.";
  formHint.style.color = "";
  formHint.classList.add("is-ok");

  window.setTimeout(() => {
    window.location.href = waUrl;
  }, 320);
});

/* ------------------------------------------------------------------
   TIMSO deadline checker
------------------------------------------------------------------- */

const DEADLINES = {
  inf: "2026-08-01",
  soc600: "2026-08-01",
  main: "2028-01-01",
  rest: "2030-01-01",
};

const KIND_ATTRS = {
  res: { label: "Этажность", show: "floors" },
  pub: { label: "Этажность", show: "floors" },
  soc: { label: "Вместимость, мест", show: "capacity" },
  ind: { label: "Крупный объект перечня", show: "hint" },
  inf: { label: "Инфраструктура перечня", show: "hint" },
};

const KIND_HINTS = {
  ind: "Энергетика, нефтегаз и магистральные сети входят в перечень приказа № 114 — дата 01.01.2028.",
  inf: "Мосты от 100 м, аэропорты, тоннели и метро — перечень первой волны. Мосты до 100 м переходят на 01.01.2030.",
};

const chkKindBtns = document.querySelectorAll("[data-kind]");
const chkFloorBtns = document.querySelectorAll("[data-floors]");
const chkAttr = document.getElementById("chkAttr");
const chkAttrLabel = document.getElementById("chkAttrLabel");
const chkFloors = document.getElementById("chkFloors");
const chkCap = document.getElementById("chkCap");
const chkHint = document.getElementById("chkHint");
const chkDate = document.getElementById("chkDate");
const chkLeft = document.getElementById("chkLeft");
const chkWhy = document.getElementById("chkWhy");
const chkNote = document.getElementById("chkNote");

const checkerState = { kind: "res", floors: "mid" };

function fmtDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function daysLeft(iso) {
  const target = new Date(`${iso}T00:00:00`);
  const now = new Date();
  const diff = Math.ceil((target - now) / 86400000);
  if (diff > 1) return `осталось ${diff.toLocaleString("ru-RU")} дней`;
  if (diff === 1) return "осталось 1 день";
  if (diff === 0) return "вступает в силу сегодня";
  return "уже действует";
}

function verdict() {
  const { kind, floors } = checkerState;

  if (kind === "inf") {
    return {
      iso: DEADLINES.inf,
      why: "Мосты от 100 метров, аэропорты и авиационная инфраструктура, тоннели и метро входят в первую волну приказа № 114 — обязательный ТИМСО с 1 августа 2026 года.",
      note: KIND_HINTS.inf,
    };
  }

  if (kind === "soc") {
    const cap = Number(chkCap.value || 0);
    if (cap >= 600) {
      return {
        iso: DEADLINES.soc600,
        why: `Школы от 600 учащихся — объект первой волны приказа № 114. При вместимости ${cap.toLocaleString("ru-RU")} мест обязательный ТИМСО действует с 1 августа 2026 года.`,
        note: "Для точного статуса важно назначение объекта: школы, интернаты и медицинские учреждения попадают в разные строки перечня.",
      };
    }
    return {
      iso: DEADLINES.main,
      why: cap > 0
        ? `При вместимости ${cap.toLocaleString("ru-RU")} мест объект не относится к школам первой волны, но социальные объекты общей строки перечня переходят на обязательный ТИМСО с 1 января 2028 года.`
        : "Объекты здравоохранения, дошкольного и среднего образования из перечня приказа № 114 переходят на обязательный ТИМСО с 1 января 2028 года. Укажите вместимость — так оценка будет точнее.",
      note: "Это предварительная оценка. Точный статус объекта зависит от назначения и уровня ответственности — его подтверждает экспресс-аудит.",
    };
  }

  if (kind === "ind") {
    return {
      iso: DEADLINES.main,
      why: "Энергетика, нефтегаз и магистральные сети включены в перечень приказа № 114 и переходят на обязательный ТИМСО с 1 января 2028 года.",
      note: KIND_HINTS.ind,
    };
  }

  if (kind === "pub" && floors === "low") {
    return {
      iso: DEADLINES.rest,
      why: "Общественные и административно-бытовые здания до 3 этажей не входят в волну 2028 года. Универсальное требование для остальных объектов начинается с 1 января 2030 года.",
      note: "Статус зависит от назначения и уровня ответственности: ТРЦ, гостиницы и офисы различаются по строкам перечня.",
    };
  }

  if (kind === "res" && floors === "low") {
    return {
      iso: DEADLINES.rest,
      why: "Жилые дома до 5 этажей не попадают в волну 2028 года. Универсальное требование для остальных объектов начинается с 1 января 2030 года.",
      note: "Исключение — объекты первой волны и сложные инженерные условия. Точный статус подтверждает экспресс-аудит.",
    };
  }

  if (kind === "pub") {
    return {
      iso: DEADLINES.main,
      why: "Общественные и административно-бытовые здания от 3 этажей входят в перечень приказа № 114 — обязательный ТИМСО с 1 января 2028 года.",
      note: "Это предварительная оценка. Точный статус объекта зависит от назначения, уровня ответственности и параметров — его подтверждает экспресс-аудит.",
    };
  }

  return {
    iso: DEADLINES.main,
    why: "Жилые и многофункциональные здания от 6 этажей входят в перечень приказа № 114 и переходят на обязательный ТИМСО с 1 января 2028 года.",
    note: "Это предварительная оценка. Точный статус объекта зависит от назначения, уровня ответственности и параметров — его подтверждает экспресс-аудит.",
  };
}

function renderChecker() {
  if (!chkDate) return;
  const result = verdict();
  chkDate.textContent = fmtDate(result.iso);
  chkLeft.textContent = daysLeft(result.iso);
  chkWhy.textContent = result.why;
  chkNote.textContent = result.note;
}

function setKind(kind) {
  checkerState.kind = kind;
  const cfg = KIND_ATTRS[kind];
  chkAttrLabel.textContent = cfg.label;
  chkFloors.hidden = cfg.show !== "floors";
  chkCap.hidden = cfg.show !== "capacity";
  chkHint.hidden = cfg.show !== "hint";
  if (cfg.show === "hint") chkHint.textContent = KIND_HINTS[kind];
  renderChecker();
}

chkKindBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    chkKindBtns.forEach((b) => b.classList.remove("is-on"));
    btn.classList.add("is-on");
    setKind(btn.dataset.kind);
  });
});

chkFloorBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    chkFloorBtns.forEach((b) => b.classList.remove("is-on"));
    btn.classList.add("is-on");
    checkerState.floors = btn.dataset.floors;
    renderChecker();
  });
});

chkCap?.addEventListener("input", renderChecker);
setKind("res");

/* ------------------------------------------------------------------
   Mini project models
------------------------------------------------------------------- */

try {
  createMiniScenes();
} catch (error) {
  console.error("Mini scenes failed:", error);
}

/* ------------------------------------------------------------------
   Init
------------------------------------------------------------------- */

updateScrollUI();
