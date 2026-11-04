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
  if (loadbar) loadbar.style.width = `${loadValue}%`;
  if (loadpct) loadpct.textContent = String(Math.round(loadValue)).padStart(2, "0");
}

const loadTimer = window.setInterval(() => {
  if (loadDone) return;
  setLoad(loadValue + Math.random() * 12 + 4);
}, 100);

function finishLoad() {
  if (loadDone) return;
  loadDone = true;
  window.clearInterval(loadTimer);
  setLoad(100);
  window.setTimeout(() => {
    preloader?.classList.add("is-hidden");
    document.body.classList.remove("is-loading");
    document.body.classList.add("is-ready");
    window.setTimeout(() => {
      if (preloader) {
        preloader.setAttribute("aria-hidden", "true");
        preloader.style.display = "none";
      }
    }, 1000);
  }, 300);
}

window.addEventListener("load", finishLoad, { once: true });
window.setTimeout(finishLoad, 2500);

/* ------------------------------------------------------------------
   Three.js stage
------------------------------------------------------------------- */

let stage = null;
const stageCanvas = document.getElementById("stage");
try {
  stage = createStage(stageCanvas);
} catch (error) {
  console.error("WebGL stage failed:", error);
  if (stageCanvas) stageCanvas.style.display = "none";
}

/* ------------------------------------------------------------------
   DOM Elements
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
const layerButtons = [...document.querySelectorAll(".layer[data-layer]")];
const heroCopy = document.querySelector(".hero__copy");
const heroTopline = document.querySelector(".hero__topline");
const stageShade = document.querySelector(".stage-shade");
const waFab = document.getElementById("waFab");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/* ------------------------------------------------------------------
   Scroll handling (Unified, Single rAF, High Performance)
------------------------------------------------------------------- */

let morphP = 0;
let menuOpen = false;

function updateScrollUI() {
  const y = window.scrollY;
  header?.classList.toggle("is-scrolled", y > 36);
  waFab?.classList.toggle("is-on", y > 300);

  if (heroCopy && !reduceMotion) {
    const heroShift = Math.min(y, window.innerHeight) * 0.05;
    heroCopy.style.transform = `translate3d(0, ${heroShift}px, 0)`;
  }
  if (heroTopline && !reduceMotion) {
    const lineShift = Math.min(y, window.innerHeight) * 0.02;
    heroTopline.style.transform = `translate3d(0, ${lineShift}px, 0)`;
  }

  // 3D Morph progress
  if (morph) {
    const total = Math.max(1, morph.offsetHeight - window.innerHeight);
    const rect = morph.getBoundingClientRect();
    morphP = clamp(-rect.top / total, 0, 1);

    stage?.setProgress(morphP);

    const isBim = morphP > 0.22;
    const inMorphView = rect.top < 0 && rect.bottom > window.innerHeight * 0.85;
    morph.classList.toggle("is-bim", isBim);
    document.body.classList.toggle("is-bim", isBim && inMorphView);

    if (stageShade) {
      stageShade.style.opacity = reduceMotion ? "" : String(clamp(1 - morphP / 0.22, 0, 1));
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
      if (hudLod.textContent !== String(lod)) hudLod.textContent = String(lod);
    }
    if (hudElements) {
      const elements = Math.round(easeOut(morphP) * 18420);
      const formatted = elements.toLocaleString("ru-RU").replace(/\s/g, " ");
      if (hudElements.textContent !== formatted) hudElements.textContent = formatted;
    }
  }
}

const footerWord = document.querySelector(".footer__word");
function updateFooterWord() {
  if (!footerWord) return;
  const r = footerWord.getBoundingClientRect();
  const p = Math.min(1, Math.max(0, (window.innerHeight - r.top) / (window.innerHeight * 0.6)));
  footerWord.style.setProperty("--fp", p.toFixed(3));
}
updateFooterWord();

let scrollTicking = false;
window.addEventListener(
  "scroll",
  () => {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
      updateScrollUI();
      updateFooterWord();
      scrollTicking = false;
    });
  },
  { passive: true }
);

window.addEventListener("resize", updateScrollUI, { passive: true });

/* ------------------------------------------------------------------
   Mouse + Cursor
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
   BIM Discipline Layers
------------------------------------------------------------------- */

layerButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const id = button.dataset.layer;
    const on = !button.classList.contains("is-on");
    button.classList.toggle("is-on", on);
    const state = button.querySelector("b");
    if (state) state.textContent = on ? "on" : "off";
    stage?.setLayer(id, on);
  });
});

/* ------------------------------------------------------------------
   Reveal Observer + Counters
------------------------------------------------------------------- */

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-in");
      revealObserver.unobserve(entry.target);
    });
  },
  { threshold: 0.1, rootMargin: "0px 0px -6% 0px" }
);

document.querySelectorAll("[data-reveal]").forEach((element) => {
  revealObserver.observe(element);
});

function animateCounter(element) {
  const raw = element.dataset.count;
  if (raw === undefined) return;
  const target = Number(raw);
  const suffix = element.dataset.suffix || "";
  const decimals = raw.includes(".") ? 1 : 0;
  const nogroup = "nogroup" in element.dataset;
  const duration = reduceMotion ? 0 : 1200;
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
  { threshold: 0.5 }
);

document.querySelectorAll("[data-count]").forEach((element) => {
  counterObserver.observe(element);
});

/* ------------------------------------------------------------------
   Mobile Menu + Anchors
------------------------------------------------------------------- */

function setMenu(open) {
  menuOpen = open;
  burger?.classList.toggle("is-open", open);
  burger?.setAttribute("aria-expanded", String(open));
  burger?.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
  mobileMenu?.classList.toggle("is-open", open);
  mobileMenu?.setAttribute("aria-hidden", String(!open));
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

    const headerOffset = hash === "#morph" ? 0 : 64;
    const top =
      hash === "#top"
        ? 0
        : target.getBoundingClientRect().top + window.scrollY - headerOffset;

    window.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
  });
});

/* ------------------------------------------------------------------
   Interactive Urgent Estimator Calculator
------------------------------------------------------------------- */

const calcState = {
  dwg: "yes",
  sec: "arkr",
  urgency: "fire"
};

const calcDwgBtns = document.querySelectorAll("#calcDwgGroup button");
const calcSecBtns = document.querySelectorAll("#calcSectionGroup button");
const calcTimeBtns = document.querySelectorAll("#calcTimeGroup button");
const calcTimeOut = document.getElementById("calcTimeOut");
const calcStatusOut = document.getElementById("calcStatusOut");
const calcWhyOut = document.getElementById("calcWhyOut");
const calcCtaBtn = document.getElementById("calcCtaBtn");

function updateCalculator() {
  if (!calcTimeOut) return;

  const { dwg, sec, urgency } = calcState;

  let timeText = "3–5 ДНЕЙ";
  let whyText = "";
  let ctaText = "Отправить исходники на оценку в WhatsApp";
  let statusText = "Формат: Autodesk Revit (.rvt) + IFC";

  if (dwg === "sketch") {
    if (urgency === "fire") {
      timeText = "3–5 ДНЕЙ (ФОРСАЖ)";
      whyText = "Сроки горят — берем в работу даже по эскизам и наброскам! Архитекторы садятся на параллельное допроектирование каркаса прямо в Revit, связываясь с вами по WhatsApp.";
      statusText = "Экспресс-моделирование по эскизам";
      ctaText = "Сбросить эскизы архитектору в WhatsApp";
    } else {
      timeText = "5–7 ДНЕЙ";
      whyText = "Поднимаем базовую 3D-модель по эскизам/ПД, уточняя габариты и высоты в процессе сборки.";
      statusText = "Концептуальный подъем в Revit";
      ctaText = "Отправить эскизы на согласование";
    }
  } else if (sec === "arkr") {
    if (urgency === "fire") {
      timeText = "3–5 ДНЕЙ";
      whyText = "Запускаем 2–3 моделлеров параллельно. Первый фрагмент (типовой этаж) отдаем через 48 часов, всю коробку с фасадами закрываем за 5 дней.";
    } else if (urgency === "urgent") {
      timeText = "5–8 ДНЕЙ";
      whyText = "Стандартный форсированный темп: детальная проработка АР + КР, спецификации элементов, экспорт в чистый IFC 4.3.";
    } else {
      timeText = "8–12 ДНЕЙ";
      whyText = "Размеренный график: АР, КР, ведомости объемов, оформление листов рабочей документации.";
    }
  } else if (sec === "full") {
    if (urgency === "fire") {
      timeText = "7–10 ДНЕЙ";
      whyText = "Экстренная мобилизация: архитекторы поднимают каркас, инженеры параллельно трассируют ОВ/ВК/ЭО, координатор ежедневно сводит коллизии в Navisworks.";
    } else if (urgency === "urgent") {
      timeText = "10–14 ДНЕЙ";
      whyText = "Полный комплекс АР + КР + сети с отчетом об устранении пересечений и таблицами объемов материалов.";
    } else {
      timeText = "14–20 ДНЕЙ";
      whyText = "Комплексная модель со всеми инженерными разделами, ведомостями и подготовкой под экспертизу.";
    }
  } else if (sec === "mep") {
    if (urgency === "fire") {
      timeText = "4–6 ДНЕЙ";
      whyText = "Разводка сетей по вашей готовой подоснове или чертежам. Ловим пересечения вентиляции с трубами и несущими конструкциями.";
    } else {
      timeText = "6–10 ДНЕЙ";
      whyText = "Инженерные системы ОВ, ВК, ЭО с семействами оборудования и спецификациями.";
    }
  }

  if (dwg === "partial") {
    timeText += " (+1-2 дня)";
    whyText += " Так как чертежи частичные, потребуется быстрая стыковка с вашим ГИПом для снятия вопросов.";
  }

  calcTimeOut.textContent = timeText;
  if (calcStatusOut) calcStatusOut.textContent = statusText;
  if (calcWhyOut) calcWhyOut.textContent = whyText;

  const waMsg = `Здравствуйте! По калькулятору: чертежи: ${dwg}, разделы: ${sec}, срок: ${urgency} (${timeText}). Хотим отправить чертежи на экспресс-оценку.`;
  if (calcCtaBtn) {
    calcCtaBtn.querySelector("span").textContent = ctaText;
    calcCtaBtn.href = `https://wa.me/77775556789?text=${encodeURIComponent(waMsg)}`;
  }
}

calcDwgBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    calcDwgBtns.forEach((b) => b.classList.remove("is-on"));
    btn.classList.add("is-on");
    calcState.dwg = btn.dataset.dwg;
    updateCalculator();
  });
});

calcSecBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    calcSecBtns.forEach((b) => b.classList.remove("is-on"));
    btn.classList.add("is-on");
    calcState.sec = btn.dataset.sec;
    updateCalculator();
  });
});

calcTimeBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    calcTimeBtns.forEach((b) => b.classList.remove("is-on"));
    btn.classList.add("is-on");
    calcState.urgency = btn.dataset.urgency;
    updateCalculator();
  });
});

updateCalculator();

/* ------------------------------------------------------------------
   Interactive NDA vs Pilot Switch
------------------------------------------------------------------- */

const btnNda = document.getElementById("btnNda");
const btnPilot = document.getElementById("btnPilot");
const dealTitle = document.getElementById("dealTitle");
const dealText = document.getElementById("dealText");
const dealBadge = document.getElementById("dealBadge");
const dealNote = document.getElementById("dealNote");

if (btnNda && btnPilot) {
  btnNda.addEventListener("click", () => {
    btnNda.classList.add("is-active");
    btnPilot.classList.remove("is-active");
    if (dealTitle) dealTitle.textContent = "Вариант 1. Железная конфиденциальность (NDA)";
    if (dealText) dealText.textContent = "Перед тем как вы передадите нам чертежи, мы подписываем соглашение о неразглашении (NDA). Ваш объект, планировки, ведомости объемов и сметные данные никогда не попадут в рекламу, соцсети или конкурентам. Все права и исходные файлы Revit остаются исключительно вашей собственностью.";
    if (dealBadge) dealBadge.textContent = "100% Защита данных";
    if (dealNote) dealNote.textContent = "Оплата производится по этапам с договором на юридическое лицо в Казахстане.";
  });

  btnPilot.addEventListener("click", () => {
    btnPilot.classList.add("is-active");
    btnNda.classList.remove("is-active");
    if (dealTitle) dealTitle.textContent = "Вариант 2. Экспериментальный пилот без предоплаты";
    if (dealText) dealText.textContent = "Сомневаетесь в нашей скорости или точности? Мы бесплатно сделаем пилотный блок или типовой этаж вашего объекта за 48 часов. Единственное условие: мы получаем право открыто транслировать эту модель в наших кейсах и соцсетях. Вы проверяете качество модели без риска и копейки вложений.";
    if (dealBadge) dealBadge.textContent = "0 ₸ Предоплаты";
    if (dealNote) dealNote.textContent = "Идеально для тех, кому нужно срочно убедиться в результате перед оплатой.";
  });
}

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
  const deadline = String(data.get("deadline") || "").trim();
  const format = String(data.get("format") || "").trim();
  const area = String(data.get("area") || "").trim();
  const message = String(data.get("message") || "").trim();

  if (!name || !contact) {
    if (formHint) {
      formHint.textContent = "Заполните имя и контакт — иначе мы не сможем ответить.";
      formHint.style.color = "#fb7185";
      formHint.classList.remove("is-ok");
    }
    return;
  }

  const subject = `Срочный BIM-запрос — ${company || name}`;
  const body = [
    `Имя: ${name}`,
    `Компания: ${company || "—"}`,
    `Контакт: ${contact}`,
    `Дедлайн: ${deadline || "Горит"}`,
    `Формат: ${format || "Autodesk Revit"}`,
    `Площадь: ${area || "—"} м²`,
    "",
    message || "Чертежи прикрепим в диалоге",
  ].join("\n");

  const waText = `${subject}\n\n${body}`;
  const waUrl = `https://wa.me/77775556789?text=${encodeURIComponent(waText)}`;

  if (formHint) {
    formHint.textContent = "Запрос сформирован. Переходим в WhatsApp...";
    formHint.style.color = "";
    formHint.classList.add("is-ok");
  }

  window.setTimeout(() => {
    window.location.href = waUrl;
  }, 300);
});

/* ------------------------------------------------------------------
   Init Mini Scenes & First Layout
------------------------------------------------------------------- */

try {
  createMiniScenes();
} catch (error) {
  console.error("Mini scenes failed:", error);
}

updateScrollUI();
