document.documentElement.classList.add("js");

// i18n: Spanish is the markup default; English lives here.
const en = {
  "nav.projects": "Projects",
  "nav.about": "About Us",
  "nav.values": "Values",
  "nav.contact": "CONTACT",
  "menu.home": "Home",
  "menu.values": "Our values",
  "hero.title":
    "We bring your project to life in the heart of the <em>Mediterranean.</em>",
  "hero.cta": "Let’s talk about your project",
  "projects.eyebrow": "02 / Projects",
  "projects.title": "PROJECTS",
  "proj.viviendas": "HOMES",
  "proj.hoteles": "HOTELS",
  "proj.reformas": "RENOVATIONS",
  "proj.naves": "WAREHOUSES",
  "proj.viviendas.d": "Custom homes, from the first sketch to handing over the keys.",
  "proj.hoteles.d":
    "Hotels and tourist accommodation with refined finishes and controlled timelines.",
  "proj.reformas.d":
    "Full renovations that refresh every space without losing its character.",
  "proj.naves.d":
    "Functional, durable warehouses and structures, ready to work.",
  "proj.more": "see more",
  "projects.all": "See all projects",
  "about.kicker": "03 / About us",
  "about.title": "<b>CAMINER</b> is a construction and architecture company",
  "about.p1":
    "Based in Sa Pobla, Balearic Islands, we specialize in a wide range of projects. We deliver high-quality construction solutions tailored to our clients’ needs.",
  "about.p2":
    "We carry out residential projects as well as hotels, warehouses, structures and renovations, always with a comprehensive, professional approach.",
  "about.more": "Discover Caminer",
  "about.quote":
    "To build is to understand the place and the people who live in it.",
  "values.eyebrow": "04 / Our values",
  "values.title": "What you don’t see matters too.",
  "values.lead":
    "Trust is built in how we listen, coordinate and care for every decision.",
  "values.1.t": "Personalized guidance",
  "values.1.p":
    "Our technical team gets involved with you from the first moment to ensure results aligned with your expectations.",
  "values.2.t": "Solid construction experience",
  "values.2.p":
    "Years of successfully delivered projects back our way of working.",
  "values.3.t": "Comprehensive project management",
  "values.3.p":
    "We accompany you from architectural design to final execution.",
  "values.4.t": "Quality and detail in every line",
  "values.4.p":
    "We work with high-quality materials and meticulous attention to detail, so every space speaks for itself.",
  "contact.eyebrow": "05 / Let’s start with a conversation",
  "contact.title": "Your next project starts here.",
  "contact.p":
    "Tell us what you have in mind. We’ll help you find the best starting point.",
  "foot.projects": "Projects",
  "foot.contact": "Contact",
  "foot.legal": "Legal notice",
  "brands.title": "Brands we work with",
  "filters.all": "ALL",
  "filters.viviendas": "Homes",
  "filters.hoteles": "Hotels",
  "filters.reformas": "Renovations",
  "filters.naves": "Warehouses",
};
const nodes = [...document.querySelectorAll("[data-i18n]")];
const es = Object.fromEntries(nodes.map((n) => [n.dataset.i18n, n.innerHTML]));
const langBtns = document.querySelectorAll(".lang");
function setLang(l) {
  const d = l === "en" ? en : es;
  nodes.forEach((n) => (n.innerHTML = d[n.dataset.i18n] ?? es[n.dataset.i18n]));
  document.documentElement.lang = l;
  langBtns.forEach((b) => (b.textContent = l === "es" ? "EN" : "ES"));
  try {
    localStorage.setItem("lang", l);
  } catch {}
}
langBtns.forEach((b) =>
  b.addEventListener("click", () =>
    setLang(document.documentElement.lang === "es" ? "en" : "es"),
  ),
);
try {
  if (localStorage.getItem("lang") === "en") setLang("en");
} catch {}

document
  .querySelectorAll("[data-year]")
  .forEach((n) => (n.textContent = new Date().getFullYear()));

// Scroll reveal
const io = new IntersectionObserver(
  (entries) =>
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      }
    }),
  { rootMargin: "0px 0px -10% 0px" },
);
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

// Header gets a solid background once the hero has scrolled away
const header = document.querySelector(".site-header"),
  hero = document.querySelector(".hero");
if (hero)
  new IntersectionObserver(
    ([e]) => header.classList.toggle("is-solid", !e.isIntersecting),
    { rootMargin: "-72px 0px 0px 0px" },
  ).observe(hero);

// Menu card (native <dialog>: focus trap + Esc for free)
const menu = document.getElementById("menu"),
  burger = document.querySelector(".burger");
burger.addEventListener("click", () => {
  menu.showModal();
  burger.setAttribute("aria-expanded", "true");
});
menu.addEventListener("close", () =>
  burger.setAttribute("aria-expanded", "false"),
);
menu.addEventListener("click", (e) => {
  if (
    e.target === menu ||
    e.target.closest(".menu__close") ||
    e.target.closest("a")
  )
    menu.close();
});
matchMedia("(min-width: 860px)").addEventListener("change", (e) => {
  if (e.matches && menu.open) menu.close();
});

// Hero video: local, muted, so autoplay works on every load (incl. F5)
const vid = document.querySelector(".hero__video");
if (vid) {
  vid.muted = true;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) vid.pause();
  else vid.play?.().catch(() => {});
}

// Page background: black on projects/brands, easing to white as the About section scrolls in
const about = document.querySelector(".about");
if (about) {
  const root = document.documentElement;
  let tick = 0;
  const update = () => {
    tick = 0;
    const vh = innerHeight;
    const t = Math.min(
      1,
      Math.max(0, (vh * 0.9 - about.getBoundingClientRect().top) / (vh * 0.6)),
    );
    root.style.setProperty("--p", (t * t * (3 - 2 * t)).toFixed(3)); // smoothstep
  };
  const queue = () => tick || (tick = requestAnimationFrame(update));
  addEventListener("scroll", queue, { passive: true });
  addEventListener("resize", queue);
  update();
}