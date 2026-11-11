const API = "https://en.wikipedia.org/w/api.php";
const REST = "https://en.wikipedia.org/w/rest.php/v1/page/";
const $ = (id) => document.getElementById(id);

const screens = {
  home: $("homeScreen"),
  game: $("gameScreen"),
  win: $("winScreen")
};

const popularArticles = [
  "Minecraft", "United States", "YouTube", "Basketball", "The Beatles",
  "Solar System", "Dinosaur", "Pizza", "Nintendo", "Ancient Egypt",
  "Taylor Swift", "Artificial intelligence", "Ocean", "Space exploration",
  "Pokémon", "World War II", "Mount Everest", "Coffee", "Internet",
  "Leonardo da Vinci", "Amazon rainforest", "Video game", "Shark",
  "New York City", "Moon", "Harry Potter", "Volcano", "Japan"
];

const themeSelect = $("themeSelect");
const backEnabledInput = $("backEnabled");
let backEnabled = localStorage.getItem("wikirace-back-enabled") !== "false";
backEnabledInput.checked = backEnabled;
backEnabledInput.addEventListener("change", () => {
  backEnabled = backEnabledInput.checked;
  localStorage.setItem("wikirace-back-enabled", String(backEnabled));
  updateBackButton();
});
const themePreference = localStorage.getItem("wikirace-theme") || "system";
const colorScheme = window.matchMedia("(prefers-color-scheme: light)");
function applyTheme() {
  const resolved = themePreference === "system" ? (colorScheme.matches ? "light" : "dark") : themePreference;
  document.documentElement.dataset.theme = resolved;
  themeSelect.value = themePreference;
}
let activeThemePreference = themePreference;
function setThemePreference(value) {
  activeThemePreference = value;
  localStorage.setItem("wikirace-theme", value);
  const resolved = value === "system" ? (colorScheme.matches ? "light" : "dark") : value;
  document.documentElement.dataset.theme = resolved;
  themeSelect.value = value;
}
themeSelect.addEventListener("change", () => setThemePreference(themeSelect.value));
colorScheme.addEventListener("change", () => {
  if (activeThemePreference === "system") {
    document.documentElement.dataset.theme = colorScheme.matches ? "light" : "dark";
  }
});
applyTheme();

const state = {
  difficulty: "easy",
  start: null,
  goal: null,
  current: null,
  clicks: 0,
  startedAt: 0,
  timerInterval: null,
  seconds: 0,
  loading: false,
  requestController: null,
  history: [],
  historyIndex: -1
};

function updateBackButton() {
  const button = $("previousButton");
  button.disabled = !backEnabled || state.loading || state.historyIndex <= 0;
  button.classList.toggle("hidden", !backEnabled);
}

function recordArticleVisit(title) {
  state.history = state.history.slice(0, state.historyIndex + 1);
  state.history.push(title);
  state.historyIndex = state.history.length - 1;
  updateBackButton();
}

async function goBackArticle() {
  if (!backEnabled || state.loading || state.historyIndex <= 0) return;
  state.historyIndex -= 1;
  const previousTitle = state.history[state.historyIndex];
  updateBackButton();
  await loadArticle(previousTitle, false);
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, element]) => {
    element.classList.toggle("active", key === name);
  });
  window.scrollTo({ top: 0, behavior: "instant" });
}

function normaliseTitle(title) {
  return decodeURIComponent(String(title || "").replace(/_/g, " "))
    .replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return minutes + ":" + seconds;
}

function setToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(setToast.timeout);
  setToast.timeout = window.setTimeout(() => toast.classList.remove("show"), 2600);
}

async function apiRandomTitles(count = 2) {
  const url = new URL(API);
  url.search = new URLSearchParams({
    action: "query",
    list: "random",
    rnnamespace: "0",
    rnlimit: String(count),
    rnfilterredir: "nonredirects",
    format: "json",
    origin: "*"
  });
  const response = await fetch(url);
  if (!response.ok) throw new Error("Wikipedia could not provide random articles.");
  const data = await response.json();
  return (data.query?.random || []).map(item => item.title);
}


async function resolveWikipediaTitle(input) {
  const value = input.trim();
  const url = new URL(API);
  url.search = new URLSearchParams({
    action: "query",
    titles: value,
    redirects: "1",
    format: "json",
    origin: "*"
  });
  const response = await fetch(url);
  if (!response.ok) throw new Error("Wikipedia couldn't check the article names. Try again.");
  const data = await response.json();
  const page = Object.values(data.query?.pages || {})[0];
  if (!page || page.missing !== undefined) {
    throw new Error('Could not find "' + value + '" on Wikipedia. Check the spelling.');
  }
  return page.title;
}

async function chooseCustomRoute() {
  const startInput = $("customStart").value.trim();
  const goalInput = $("customGoal").value.trim();
  if (!startInput && !goalInput) return null;
  if (!startInput || !goalInput) {
    throw new Error("Enter both a starting article and a destination, or leave both blank for a random route.");
  }
  const [start, goal] = await Promise.all([
    resolveWikipediaTitle(startInput),
    resolveWikipediaTitle(goalInput)
  ]);
  if (normaliseTitle(start) === normaliseTitle(goal)) {
    throw new Error("Choose two different Wikipedia articles.");
  }
  return [start, goal];
}

async function chooseRoute() {
  if (state.difficulty === "easy") {
    const first = popularArticles[Math.floor(Math.random() * popularArticles.length)];
    let second = popularArticles[Math.floor(Math.random() * popularArticles.length)];
    while (second === first) second = popularArticles[Math.floor(Math.random() * popularArticles.length)];
    return [first, second];
  }

  let titles = await apiRandomTitles(8);
  titles = [...new Set(titles)];
  if (titles.length < 2) titles = await apiRandomTitles(8);
  if (state.difficulty === "hard") {
    // A larger random sample makes it less likely that the route uses a familiar topic.
    titles = await apiRandomTitles(20);
  }
  if (titles.length < 2) throw new Error("Could not find two different articles. Try again.");
  const firstIndex = Math.floor(Math.random() * titles.length);
  let secondIndex = Math.floor(Math.random() * titles.length);
  while (secondIndex === firstIndex) secondIndex = Math.floor(Math.random() * titles.length);
  return [titles[firstIndex], titles[secondIndex]];
}

function updateStats() {
  $("timer").textContent = formatTime(state.seconds);
  $("clickCount").textContent = String(state.clicks);
  const best = localStorage.getItem("wikirace-best-" + state.difficulty);
  $("bestScore").textContent = best || "—";
}

function startTimer() {
  window.clearInterval(state.timerInterval);
  state.startedAt = Date.now();
  state.seconds = 0;
  state.timerInterval = window.setInterval(() => {
    state.seconds = Math.floor((Date.now() - state.startedAt) / 1000);
    $("timer").textContent = formatTime(state.seconds);
  }, 250);
}

function stopTimer() {
  window.clearInterval(state.timerInterval);
  state.timerInterval = null;
}

function setArticleLoading(title) {
  $("currentTitle").textContent = title;
  $("articleError").classList.add("hidden");
  $("articleContent").innerHTML = '<div class="article-loading"><div class="loader"></div><p>Loading the Wikipedia article…</p></div>';
}

function getWikipediaStyles(parsed) {
  return [...parsed.querySelectorAll('head link[rel="stylesheet"][href]')]
    .map(source => new URL(source.getAttribute("href"), "https://en.wikipedia.org").href);
}

function cleanAndPrepareArticle(html, title) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const stylesheets = getWikipediaStyles(parsed);
  const root = parsed.querySelector(".mw-parser-output") || parsed.body;
  const content = root.cloneNode(true);

  // Keep the original article markup and its Wikipedia-specific classes.
  // Only remove editing controls and executable/interactive page chrome.
  content.querySelectorAll("script, style, link, meta, noscript, form, .mw-editsection, .mw-empty-elt, .mw-indicators").forEach(node => node.remove());

  content.querySelectorAll("a").forEach(anchor => {
    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("#")) return;
    let url;
    try { url = new URL(href, "https://en.wikipedia.org/wiki/" + encodeURIComponent(title.replace(/ /g, "_"))); }
    catch { anchor.removeAttribute("href"); return; }

    const isWikipedia = url.hostname === "en.wikipedia.org" || url.hostname === "en.m.wikipedia.org";
    let targetTitle = "";
    if (isWikipedia && url.pathname.startsWith("/wiki/")) {
      targetTitle = decodeURIComponent(url.pathname.slice(6)).replace(/_/g, " ");
    } else if (isWikipedia && url.pathname === "/w/index.php" && url.searchParams.has("title")) {
      targetTitle = url.searchParams.get("title").replace(/_/g, " ");
    }

    if (targetTitle) {
      const namespace = /^(Special|Talk|User|User talk|Wikipedia|Wikipedia talk|File|File talk|MediaWiki|Template|Template talk|Help|Category|Portal|Draft|Module|TimedText|Gadget|Gadget definition):/i;
      if (namespace.test(targetTitle)) {
        anchor.removeAttribute("href");
        anchor.classList.add("non-game-link");
        anchor.title = "This Wikipedia page is not part of the race";
        return;
      }
      anchor.href = "#";
      anchor.dataset.wikiTitle = targetTitle;
      anchor.classList.add("race-link");
      anchor.removeAttribute("target");
      anchor.removeAttribute("rel");
    } else if (url.origin !== "https://en.wikipedia.org" && url.origin !== "https://upload.wikimedia.org") {
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
    } else if (url.pathname.startsWith("/wiki/") === false) {
      anchor.removeAttribute("href");
    }
  });

  content.querySelectorAll("img").forEach(img => {
    const source = img.getAttribute("src") || img.getAttribute("resource");
    if (source && source.startsWith("//")) img.src = "https:" + source;
    img.removeAttribute("srcset");
    img.loading = "lazy";
  });

  // Recreate the outer article landmarks used by Vector so Wikipedia's
  // own ResourceLoader CSS can style the title and article body correctly.
  const wrapper = document.createElement("div");
  wrapper.className = "mw-body";
  const heading = document.createElement("h1");
  heading.className = "firstHeading mw-first-heading";
  heading.textContent = title;
  const body = document.createElement("div");
  body.className = "mw-body-content";
  body.appendChild(content);
  wrapper.append(heading, body);
  return { wrapper, stylesheets };
}

async function loadArticle(title, countClick = false) {
  if (state.loading) return;
  if (state.requestController) state.requestController.abort();
  state.requestController = new AbortController();
  state.loading = true;
  if (countClick) state.clicks += 1;
  state.current = title;
  updateBackButton();
  updateStats();
updateBackButton();
  $("currentTitle").textContent = title;
  setArticleLoading(title);

  if (normaliseTitle(title) === normaliseTitle(state.goal)) {
    state.loading = false;
    finishRace();
    return;
  }

  try {
    const url = REST + encodeURIComponent(title.replace(/ /g, "_")) + "/html";
    const response = await fetch(url, {
      signal: state.requestController.signal,
      headers: { "Accept": "text/html; charset=utf-8" }
    });
    if (!response.ok) throw new Error(response.status === 404 ? "That article could not be found." : "Wikipedia returned an error. Please try another link.");
    const html = await response.text();
    const prepared = cleanAndPrepareArticle(html, title);
    const frame = document.createElement("iframe");
    frame.className = "wiki-article-frame";
    frame.title = title + " — Wikipedia article";
    frame.setAttribute("sandbox", "allow-scripts allow-popups");
    const stylesheetLinks = prepared.stylesheets.map(href => '<link rel="stylesheet" href="' + href.replace(/&/g, "&amp;").replace(/"/g, "&quot;") + '">').join("");
    const articleMarkup = prepared.wrapper.outerHTML;
    frame.srcdoc = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' + stylesheetLinks + '<style>html,body{margin:0;padding:0;background:#fff;color:#202122;font-family:Arial,Helvetica,sans-serif}body{padding:24px clamp(18px,4vw,48px) 48px;box-sizing:border-box}.mw-body{max-width:none!important;margin:0 auto!important}.mw-body-content{font-family:Arial,Helvetica,sans-serif}img{max-width:100%;height:auto}</style></head><body>' + articleMarkup + '<script>function reportHeight(){parent.postMessage({type:"wikirace-height",height:Math.ceil(document.documentElement.scrollHeight)},"*")}const heightObserver=new ResizeObserver(reportHeight);heightObserver.observe(document.documentElement);window.addEventListener("load",reportHeight);document.addEventListener("click",function(e){const a=e.target.closest("a[data-wiki-title]");if(a){e.preventDefault();parent.postMessage({type:"wikirace-navigation",title:a.dataset.wikiTitle},"*");}});reportHeight();</script></body></html>';
    $("articleContent").replaceChildren(frame);
    $("articleError").classList.add("hidden");
    updateBackButton();
    $("currentTitle").textContent = title;
    const sourceLink = $("sourceLink");
    sourceLink.href = "https://en.wikipedia.org/wiki/" + encodeURIComponent(title.replace(/ /g, "_"));
    sourceLink.textContent = "View original article ↗";
  } catch (error) {
    if (error.name === "AbortError") return;
    $("articleContent").innerHTML = '<div class="article-loading"><p>Could not load this article.</p></div>';
    $("articleError").textContent = error.message + " You can try another link or start a new route.";
    $("articleError").classList.remove("hidden");
  } finally {
    state.loading = false;
  }
}

function launchConfetti() {
  const layer = $("confettiLayer");
  if (!layer || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  layer.replaceChildren();
  const colors = ["#a5f36b", "#62c5ff", "#ffcf5a", "#ff7d9c", "#b69cff", "#ffffff"];
  for (let i = 0; i < 90; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = Math.random() * 100 + "%";
    piece.style.setProperty("--confetti-color", colors[Math.floor(Math.random() * colors.length)]);
    piece.style.setProperty("--confetti-drift", (Math.random() * 320 - 160) + "px");
    piece.style.setProperty("--confetti-spin", (Math.random() * 1200 - 600) + "deg");
    piece.style.setProperty("--confetti-duration", (2.5 + Math.random() * 2) + "s");
    piece.style.setProperty("--confetti-delay", (Math.random() * 0.65) + "s");
    piece.style.width = (6 + Math.random() * 6) + "px";
    piece.style.height = (8 + Math.random() * 8) + "px";
    if (Math.random() > 0.72) piece.style.borderRadius = "50%";
    layer.appendChild(piece);
  }
  window.clearTimeout(launchConfetti.cleanup);
  launchConfetti.cleanup = window.setTimeout(() => layer.replaceChildren(), 5200);
}

function finishRace() {
  stopTimer();
  state.loading = false;
  const bestKey = "wikirace-best-" + state.difficulty;
  const oldBest = Number(localStorage.getItem(bestKey));
  if (!oldBest || state.seconds < oldBest) localStorage.setItem(bestKey, String(state.seconds));
  $("winStart").textContent = state.start;
  $("winGoal").textContent = state.goal;
  $("finalTime").textContent = formatTime(state.seconds);
  $("finalClicks").textContent = String(state.clicks);
  showScreen("win");
  launchConfetti();
}

async function beginRace() {
  const startButton = $("startButton");
  startButton.disabled = true;
  startButton.querySelector("span").textContent = "Finding a route…";
  try {
    if (state.requestController) state.requestController.abort();
    stopTimer();
    state.clicks = 0;
    state.seconds = 0;
    state.loading = false;
    const customRoute = await chooseCustomRoute();
    const [start, goal] = customRoute || await chooseRoute();
    state.start = start;
    state.goal = goal;
    state.current = start;
    state.history = [];
    state.historyIndex = -1;
    recordArticleVisit(start);
    $("startTitle").textContent = start;
    $("goalTitle").textContent = goal;
    $("currentTitle").textContent = start;
    $("articleContent").innerHTML = '<div class="article-loading"><div class="loader"></div><p>Loading your starting article…</p></div>';
    $("articleError").classList.add("hidden");
    updateStats();
    showScreen("game");
    startTimer();
    await loadArticle(start, false);
  } catch (error) {
    setToast(error.message || "Could not start a race.");
  } finally {
    startButton.disabled = false;
    startButton.querySelector("span").textContent = "Start a race";
  }
}

async function newRoute() {
  stopTimer();
  state.loading = false;
  if (state.requestController) state.requestController.abort();
  const [start, goal] = await chooseRoute();
  state.start = start;
  state.goal = goal;
  state.history = [];
  state.historyIndex = -1;
  recordArticleVisit(start);
  state.clicks = 0;
  state.seconds = 0;
  $("startTitle").textContent = start;
  $("goalTitle").textContent = goal;
  updateStats();
  startTimer();
  await loadArticle(start, false);
}

function leaveRace() {
  stopTimer();
  if (state.requestController) state.requestController.abort();
  state.loading = false;
  showScreen("home");
}

document.querySelectorAll(".difficulty-option").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".difficulty-option").forEach(item => item.classList.remove("selected"));
    button.classList.add("selected");
    state.difficulty = button.dataset.difficulty;
  });
});

$("startButton").addEventListener("click", beginRace);
$("restartButton").addEventListener("click", () => newRoute().catch(error => setToast(error.message)));
$("previousButton").addEventListener("click", goBackArticle);
$("quitButton").addEventListener("click", leaveRace);
$("playAgainButton").addEventListener("click", () => { showScreen("home"); beginRace(); });
$("homeButton").addEventListener("click", () => { showScreen("home"); });
$("homeLink").addEventListener("click", event => { event.preventDefault(); leaveRace(); });
$("helpButton").addEventListener("click", () => $("helpModal").classList.remove("hidden"));
$("closeHelp").addEventListener("click", () => $("helpModal").classList.add("hidden"));
$("helpModal").addEventListener("click", event => {
  if (event.target === $("helpModal")) $("helpModal").classList.add("hidden");
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") $("helpModal").classList.add("hidden");
});

window.addEventListener("message", async event => {
  if (event.source !== $("articleContent").querySelector("iframe")?.contentWindow) return;
  if (event.data?.type === "wikirace-height") {
    const frame = $("articleContent").querySelector("iframe");
    const height = Number(event.data.height);
    if (frame && Number.isFinite(height)) frame.style.height = Math.max(500, height) + "px";
    return;
  }
  if (event.data?.type !== "wikirace-navigation") return;
  const title = String(event.data.title || "");
  if (!title || state.loading) return;
  if (normaliseTitle(title) === normaliseTitle(state.goal)) {
    state.clicks += 1;
    state.current = title;
    updateStats();
    finishRace();
    return;
  }
  recordArticleVisit(title);
  await loadArticle(title, true);
});

updateStats();