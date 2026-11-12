const API = "https://en.wikipedia.org/w/api.php";
const firebaseConfig = {apiKey:"AIzaSyCzSZ_x6ypPdezmJHAJEYkgHFz07M5sc6M",authDomain:"wikirace-ebf2d.firebaseapp.com",projectId:"wikirace-ebf2d",storageBucket:"wikirace-ebf2d.firebasestorage.app",messagingSenderId:"184191673134",appId:"1:184191673134:web:ec0cae69438c06873550bf",measurementId:"G-8Y3FE8HGST"};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const REST = "https://en.wikipedia.org/w/rest.php/v1/page/";
const $ = (id) => document.getElementById(id);

const screens = {
  home: $("homeScreen"),
  game: $("gameScreen"),
  win: $("winScreen")
};

// Easy uses very familiar subjects. Medium uses a wider mix of recognizable
// topics, rather than completely random Wikipedia pages.
const popularArticles = [
  "Minecraft", "United States", "YouTube", "Basketball", "The Beatles",
  "Solar System", "Dinosaur", "Pizza", "Nintendo", "Ancient Egypt",
  "Taylor Swift", "Artificial intelligence", "Ocean", "Space exploration",
  "Pokémon", "World War II", "Mount Everest", "Coffee", "Internet",
  "Leonardo da Vinci", "Amazon rainforest", "Video game", "Shark",
  "New York City", "Moon", "Harry Potter", "Volcano", "Japan",
  "Cat", "Dog", "Earth", "Sun", "Football", "Soccer", "Apple",
  "Google", "Microsoft", "Disney", "Star Wars", "Spider-Man",
  "Cars", "Dolphin", "Lion", "Elephant", "Great Wall of China",
  "Eiffel Tower", "United Kingdom", "Canada", "Australia", "Paris",
  "London", "Christmas", "Olympic Games", "Pizza", "YouTube"
];

const mediumArticles = [
  "Roblox", "Fortnite", "LEGO", "PlayStation", "Xbox",
  "Nintendo Switch", "Super Mario", "Sonic the Hedgehog",
  "Pokémon", "The Legend of Zelda", "Among Us", "Tetris",
  "SpongeBob SquarePants", "The Simpsons", "Shrek", "Toy Story",
  "Jurassic Park", "Avatar (2009 film)", "Harry Potter",
  "The Lord of the Rings", "Star Wars", "Spider-Man",
  "MrBeast", "Mark Rober", "TikTok", "Instagram",
  "Netflix", "YouTube Shorts", "Google Chrome", "Apple Inc.",
  "Lego minifigure", "Roller coaster", "Skateboarding",
  "Basketball", "American football", "Baseball", "Swimming",
  "Olympic Games", "Formula One", "Dodgeball", "Bicycle",
  "Golden retriever", "Red panda", "Penguin", "Dolphin",
  "Great white shark", "Koala", "Giraffe", "Panda",
  "Volcano", "Tornado", "Earthquake", "Rainbow",
  "Northern Lights", "Solar eclipse", "Moon landing",
  "International Space Station", "Mars", "Jupiter",
  "Great Wall of China", "Eiffel Tower", "Statue of Liberty",
  "Grand Canyon", "Niagara Falls", "Mount Everest",
  "Japan", "Italy", "New York City", "Hawaii",
  "Chocolate", "Sushi", "Pancake", "Popcorn"
];

const themeSelect = $("themeSelect");
const backEnabledInput = $("backEnabled");
const blockFindInput = $("blockFindShortcuts");
const blockBrowserNavigationInput = $("blockBrowserNavigation");
let backEnabled = localStorage.getItem("wikirace-back-enabled") !== "false";
const raceOptions = {
  blockFind: localStorage.getItem("wikirace-block-find") === "true",
  blockBrowserNavigation: localStorage.getItem("wikirace-block-browser-navigation") === "true"
};
blockFindInput.checked = raceOptions.blockFind;
blockBrowserNavigationInput.checked = raceOptions.blockBrowserNavigation;
blockFindInput.addEventListener("change", () => {
  raceOptions.blockFind = blockFindInput.checked;
  localStorage.setItem("wikirace-block-find", String(raceOptions.blockFind));
});
blockBrowserNavigationInput.addEventListener("change", () => {
  raceOptions.blockBrowserNavigation = blockBrowserNavigationInput.checked;
  localStorage.setItem("wikirace-block-browser-navigation", String(raceOptions.blockBrowserNavigation));
});
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
  historyIndex: -1,
  mode: "solo",
  dailyDate: null,
  dailySubmitted: false
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

function pickTwoDifferent(pool) {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 2);
}

async function chooseRoute() {
  if (state.difficulty === "easy") {
    return pickTwoDifferent(popularArticles);
  }

  if (state.difficulty === "medium") {
    return pickTwoDifferent(mediumArticles);
  }

  // Hard is the only mode that uses fully random Wikipedia articles.
  // Ask for a larger batch, remove duplicates, then choose two at random.
  let titles = [];
  for (let attempt = 0; attempt < 3 && titles.length < 2; attempt++) {
    const batch = await apiRandomTitles(30);
    titles = [...new Set([...titles, ...batch])];
  }
  if (titles.length < 2) throw new Error("Could not find two different articles. Try again.");
  return pickTwoDifferent(titles);
}

function updateStats() {
  $("timer").textContent = formatTime(state.seconds);
  $("clickCount").textContent = String(state.clicks);
  const best = localStorage.getItem("wikirace-best-" + (state.mode === "daily" ? "daily" : state.difficulty));
  $("bestScore").textContent = best || "—";
}

function startTimer() {
  window.clearInterval(state.timerInterval);
  state.startedAt = Date.now();
  state.seconds = 0;
  state.timerInterval = window.setInterval(() => {
    state.seconds = Math.floor((Date.now() - state.startedAt) / 1000);
    $("timer").textContent = formatTime(state.seconds);
    if(state.mode==="multiplayer" && state.seconds%2===0 && state.seconds!==lastRoomProgressSecond && !multiplayerLocalFinished && !multiplayerEnded){
      lastRoomProgressSecond=state.seconds;
      updateRoomPlayer(false);
    }
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


const articleHtmlCache = new Map();
const articleHtmlPending = new Map();
async function getArticleHtml(title){
  const key=normaliseTitle(title);
  if(articleHtmlCache.has(key))return articleHtmlCache.get(key);
  if(articleHtmlPending.has(key))return articleHtmlPending.get(key);
  const request=(async()=>{
    const url=REST+encodeURIComponent(title.replace(/ /g,"_"))+"/html";
    const response=await fetch(url,{headers:{"Accept":"text/html; charset=utf-8"}});
    if(!response.ok)throw new Error(response.status===404?"That article could not be found.":"Wikipedia returned an error. Please try another link.");
    const html=await response.text();
    articleHtmlCache.set(key,html);
    while(articleHtmlCache.size>18)articleHtmlCache.delete(articleHtmlCache.keys().next().value);
    return html;
  })();
  articleHtmlPending.set(key,request);
  try{return await request;}finally{articleHtmlPending.delete(key);}
}
function prefetchArticle(title){
  if(!title)return;
  const key=normaliseTitle(title);
  if(articleHtmlCache.has(key)||articleHtmlPending.has(key))return;
  getArticleHtml(title).catch(()=>{});
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
    const html = await getArticleHtml(title);
    if(state.requestController?.signal.aborted)return;
    const prepared = cleanAndPrepareArticle(html, title);
    const frame = document.createElement("iframe");
    frame.className = "wiki-article-frame";
    frame.title = title + " — Wikipedia article";
    frame.setAttribute("sandbox", "allow-scripts allow-popups");
    const stylesheetLinks = prepared.stylesheets.map(href => '<link rel="stylesheet" href="' + href.replace(/&/g, "&amp;").replace(/"/g, "&quot;") + '">').join("");
    const articleMarkup = prepared.wrapper.outerHTML;
    frame.srcdoc = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' + stylesheetLinks + '<style>html,body{margin:0;padding:0;background:#fff;color:#202122;font-family:Arial,Helvetica,sans-serif}body{padding:24px clamp(18px,4vw,48px) 48px;box-sizing:border-box}.mw-body{max-width:none!important;margin:0 auto!important}.mw-body-content{font-family:Arial,Helvetica,sans-serif}img{max-width:100%;height:auto}</style></head><body>' + articleMarkup + '<script>function reportHeight(){parent.postMessage({type:"wikirace-height",height:Math.ceil(document.documentElement.scrollHeight)},"*")}const heightObserver=new ResizeObserver(reportHeight);heightObserver.observe(document.documentElement);window.addEventListener("load",reportHeight);document.addEventListener("pointerover",function(e){const a=e.target.closest("a[data-wiki-title]");if(a&&!a.dataset.prefetched){a.dataset.prefetched="1";parent.postMessage({type:"wikirace-prefetch",title:a.dataset.wikiTitle},"*");}});document.addEventListener("click",function(e){const a=e.target.closest("a[data-wiki-title]");if(a){e.preventDefault();parent.postMessage({type:"wikirace-navigation",title:a.dataset.wikiTitle},"*");}});reportHeight();' +
      (raceOptions.blockFind ? 'document.addEventListener("keydown",function(e){var k=e.key.toLowerCase();if(((e.ctrlKey||e.metaKey)&&(k==="f"||k==="g"))||k==="f3"){e.preventDefault();e.stopImmediatePropagation();}},true);' : '') +
      (raceOptions.blockBrowserNavigation ? 'document.addEventListener("keydown",function(e){var k=e.key.toLowerCase();if((e.altKey&&(k==="arrowleft"||k==="arrowright"))||(k==="backspace"&&!/input|textarea|select/i.test(e.target.tagName))){e.preventDefault();e.stopImmediatePropagation();}},true);' : '') +
      '</script></body></html>';
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
    updateBackButton();
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


function utcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
function addUtcDays(dateKey, amount) {
  const date = new Date(dateKey + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + amount);
  return utcDateKey(date);
}
function dailyRouteForDate(dateKey) {
  const pool = [...new Set([...popularArticles, ...mediumArticles])];
  let seed = 2166136261;
  for (let i = 0; i < dateKey.length; i++) {
    seed ^= dateKey.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  const random = () => {
    seed += 0x6D2B79F5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (((value ^ (value >>> 14)) >>> 0) / 4294967296);
  };
  const startIndex = Math.floor(random() * pool.length);
  let goalIndex = Math.floor(random() * pool.length);
  while (goalIndex === startIndex) goalIndex = (goalIndex + 1) % pool.length;
  return [pool[startIndex], pool[goalIndex]];
}
function dailyDateLabel(dateKey) {
  return new Date(dateKey + "T12:00:00Z").toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric", timeZone: "UTC"
  });
}
function formatDailyBadge(milestone) {
  return ({3:"3-Day Streak",7:"Weekly Runner",14:"Dedicated Racer",30:"Monthly Legend",60:"Elite Runner",100:"Century",365:"Year-Round"})[milestone] || (milestone + "-Day Streak");
}
function renderProfileProgress(profile = {}) {
  const current = Number(profile.currentStreak || 0);
  const longest = Number(profile.longestStreak || 0);
  $("currentStreak").textContent = current + " day" + (current === 1 ? "" : "s");
  $("longestStreak").textContent = longest + " day" + (longest === 1 ? "" : "s");
  $("streakFreezes").textContent = String(profile.streakFreezes || 0);
  const frame = profile.profileFrame || "none";
  $("profileFrameLabel").textContent = ({bronze:"Bronze",silver:"Silver",gold:"Gold",diamond:"Diamond"})[frame] || "None";
  $("profileProgress").className = "profile-progress frame-" + frame;
  const badges = $("profileBadges");
  badges.replaceChildren();
  const earned = profile.streakBadges || [];
  if (!earned.length) {
    const empty = document.createElement("span");
    empty.className = "profile-empty";
    empty.textContent = "Complete Daily Runs to earn badges.";
    badges.appendChild(empty);
  } else {
    earned.slice().sort((a,b)=>a-b).forEach(milestone=>{
      const badge=document.createElement("span");
      badge.className="profile-badge";
      badge.textContent=formatDailyBadge(milestone);
      badges.appendChild(badge);
    });
  }
  const bestTime = profile.bestRaceTime == null ? "—" : formatTime(profile.bestRaceTime);
  const fewest = profile.fewestRaceClicks == null ? "—" : profile.fewestRaceClicks;
  const dailyTime = profile.bestDailyTime == null ? "—" : formatTime(profile.bestDailyTime);
  const dailyClicks = profile.bestDailyClicks == null ? "—" : profile.bestDailyClicks;
  $("profileRecords").textContent = "Races: " + (profile.races||0) + " · Wins: " + (profile.wins||0) +
    " | Best time: " + bestTime + " · Fewest clicks: " + fewest +
    " | Daily best: " + dailyTime + " · Fewest daily clicks: " + dailyClicks;
}
function appendLeaderboardRow(list, rank, name, detail, extraClass = "") {
  const row=document.createElement("li");
  if(extraClass)row.className=extraClass;
  const position=document.createElement("span");position.className="board-rank";position.textContent=String(rank)+".";
  const player=document.createElement("strong");player.textContent=name;
  const score=document.createElement("span");score.className="board-score";score.textContent=detail;
  row.append(position,player,score);list.appendChild(row);
}
async function loadDailyLeaderboard(dateKey = utcDateKey()) {
  const list=$("dailyLeaderboard");
  list.replaceChildren();
  try {
    const snapshot=await db.collection("dailyRuns").doc(dateKey).collection("results").get();
    const results=snapshot.docs.map(doc=>doc.data()).sort((a,b)=>(a.clicks-b.clicks)||(a.seconds-b.seconds));
    $("dailyCompletionCount").textContent=String(results.length);
    const average=results.length ? (results.reduce((sum,item)=>sum+Number(item.clicks||0),0)/results.length).toFixed(1) : "—";
    $("dailyAverageClicks").textContent=average;
    if(!results.length){
      const empty=document.createElement("li");empty.className="board-empty";empty.textContent="No completed runs yet. Set the first score.";list.appendChild(empty);
    } else {
      results.slice(0,10).forEach((result,index)=>appendLeaderboardRow(list,index+1,result.username||"WikiRace player",result.clicks+" clicks · "+formatTime(result.seconds)));
    }
    if(currentUser){
      const own=await db.collection("dailyRuns").doc(dateKey).collection("results").doc(currentUser.uid).get();
      $("dailyRunButton").textContent=own.exists?"Improve today's score":"Play today's run";
    }
  } catch(error) {
    $("dailyCompletionCount").textContent="—";
    $("dailyAverageClicks").textContent="—";
    const empty=document.createElement("li");empty.className="board-empty";empty.textContent="Sign in to load today's leaderboard.";list.appendChild(empty);
  }
}
async function loadStreakLeaderboard() {
  const list=$("streakLeaderboard");
  list.replaceChildren();
  try {
    const snapshot=await db.collection("publicProfiles").orderBy("longestStreak","desc").limit(10).get();
    const players=snapshot.docs.map(doc=>doc.data()).filter(player=>Number(player.longestStreak||0)>0);
    if(!players.length){
      const empty=document.createElement("li");empty.className="board-empty";empty.textContent="No streaks yet.";list.appendChild(empty);return;
    }
    players.forEach((player,index)=>appendLeaderboardRow(list,index+1,player.username||"WikiRace player",player.longestStreak+" days",player.profileFrame||""));
  } catch(error) {
    const empty=document.createElement("li");empty.className="board-empty";empty.textContent="Sign in to load the streak leaderboard.";list.appendChild(empty);
  }
}
async function loadDailyChallenge() {
  const dateKey=utcDateKey();
  const route=dailyRouteForDate(dateKey);
  $("dailyDate").textContent=dailyDateLabel(dateKey)+" · Resets at midnight UTC";
  $("dailyStartArticle").textContent=route[0];
  $("dailyGoal").textContent=route[1];
  $("dailyRunButton").textContent="Play today's run";
  await Promise.all([loadDailyLeaderboard(dateKey),loadStreakLeaderboard()]);
}
async function startDailyRun() {
  if(!currentUser){authMode("signin");setToast("Sign in to save your Daily Run score and streak.");return;}
  const button=$("dailyRunButton");
  button.disabled=true;
  try {
    if(state.requestController)state.requestController.abort();
    stopTimer();
    state.mode="daily";
    state.dailyDate=utcDateKey();
    state.dailySubmitted=false;
    state.clicks=0;state.seconds=0;state.loading=false;
    const [start,goal]=dailyRouteForDate(state.dailyDate);
    state.start=start;state.goal=goal;state.current=start;
    state.history=[];state.historyIndex=-1;recordArticleVisit(start);
    $("startTitle").textContent=start;$("goalTitle").textContent=goal;$("currentTitle").textContent=start;
    $("articleContent").innerHTML='<div class="article-loading"><div class="loader"></div><p>Loading today\'s Daily Run…</p></div>';
    $("articleError").classList.add("hidden");
    updateStats();showScreen("game");startTimer();
    await loadArticle(start,false);
  } catch(error) {
    setToast(error.message||"Could not start today's Daily Run.");
  } finally {
    button.disabled=false;
  }
}
async function saveDailyResult() {
  if(state.mode!=="daily"||state.dailySubmitted||!currentUser||!state.dailyDate)return;
  state.dailySubmitted=true;
  const dateKey=state.dailyDate;
  const uid=currentUser.uid;
  const score={clicks:state.clicks,seconds:state.seconds,start:state.start,goal:state.goal,username:currentUsername||"WikiRace player"};
  const resultRef=db.collection("dailyRuns").doc(dateKey).collection("results").doc(uid);
  const userRef=db.collection("users").doc(uid);
  const publicRef=db.collection("publicProfiles").doc(uid);
  try {
    const outcome=await db.runTransaction(async transaction=>{
      const [resultSnap,userSnap]=await Promise.all([transaction.get(resultRef),transaction.get(userRef)]);
      const oldResult=resultSnap.exists?resultSnap.data():null;
      const improved=!oldResult||score.clicks<oldResult.clicks||(score.clicks===oldResult.clicks&&score.seconds<oldResult.seconds);
      if(!improved)return {improved:false,profile:userSnap.data()||{}};
      const profile=userSnap.data()||{};
      const lastDate=profile.lastDailyDate||"";
      let current=Number(profile.currentStreak||0);
      let longest=Number(profile.longestStreak||0);
      let freezes=Number(profile.streakFreezes||0);
      let total=Number(profile.totalDailyRuns||0);
      let lastFreezeMilestone=Number(profile.lastFreezeMilestone||0);
      let usedFreeze=false;
      if(lastDate!==dateKey){
        if(lastDate===addUtcDays(dateKey,-1))current+=1;
        else if(lastDate===addUtcDays(dateKey,-2)&&freezes>0){current+=1;freezes-=1;usedFreeze=true;}
        else current=1;
        total+=1;
        longest=Math.max(longest,current);
        if(current>=30&&current%30===0&&lastFreezeMilestone<current){
          freezes=Math.min(3,freezes+1);
          lastFreezeMilestone=current;
        }
      }
      const oldBadges=Array.isArray(profile.streakBadges)?profile.streakBadges:[];
      const milestones=[3,7,14,30,60,100,365];
      const badges=[...new Set([...oldBadges,...milestones.filter(value=>longest>=value)])].sort((a,b)=>a-b);
      const frame=longest>=365?"diamond":longest>=100?"gold":longest>=60?"silver":longest>=30?"bronze":"none";
      const history=Array.isArray(profile.dailyHistory)?profile.dailyHistory.slice():[];
      const historyIndex=history.findIndex(item=>item.date===dateKey);
      const historyItem={date:dateKey,start:score.start,goal:score.goal,clicks:score.clicks,seconds:score.seconds};
      if(historyIndex>=0)history[historyIndex]=historyItem;else history.push(historyItem);
      history.sort((a,b)=>b.date.localeCompare(a.date));
      const bestDailyTime=profile.bestDailyTime==null?score.seconds:Math.min(Number(profile.bestDailyTime),score.seconds);
      const bestDailyClicks=profile.bestDailyClicks==null?score.clicks:Math.min(Number(profile.bestDailyClicks),score.clicks);
      const nextProfile={
        lastDailyDate:dateKey,currentStreak:current,longestStreak:longest,streakFreezes:freezes,
        totalDailyRuns:total,lastFreezeMilestone,streakBadges:badges,profileFrame:frame,
        bestDailyTime,bestDailyClicks,dailyHistory:history.slice(0,60)
      };
      transaction.set(resultRef,{
        uid,date:dateKey,username:score.username,
        start:score.start,goal:score.goal,clicks:score.clicks,seconds:score.seconds,
        completedAt:firebase.firestore.FieldValue.serverTimestamp()
      });
      transaction.set(userRef,nextProfile,{merge:true});
      transaction.set(publicRef,{
        uid,username:score.username,
        currentStreak:current,longestStreak:longest,totalDailyRuns:total,
        streakBadges:badges,profileFrame:frame
      },{merge:true});
      return {improved:true,profile:{...profile,...nextProfile},usedFreeze};
    });
    if(outcome.improved){
      renderProfileProgress(outcome.profile);
      setToast(outcome.usedFreeze?"Daily Run saved. A streak freeze protected your streak.":"Daily Run saved to the leaderboard.");
    } else {
      setToast("That score did not beat your best result for today.");
    }
    await Promise.all([loadDailyLeaderboard(dateKey),loadStreakLeaderboard()]);
  } catch(error) {
    setToast("Your run finished, but its score could not be saved: "+authError(error));
  }
}
async function openDailyHistory() {
  const list=$("dailyHistoryList");
  list.replaceChildren();
  $("dailyHistoryModal").classList.remove("hidden");
  if(!currentUser){
    const empty=document.createElement("p");empty.className="board-empty";empty.textContent="Sign in to view your Daily Run history.";list.appendChild(empty);return;
  }
  try {
    const snap=await db.collection("users").doc(currentUser.uid).get();
    const history=snap.data()?.dailyHistory||[];
    if(!history.length){
      const empty=document.createElement("p");empty.className="board-empty";empty.textContent="Your completed Daily Runs will appear here.";list.appendChild(empty);return;
    }
    history.slice().sort((a,b)=>b.date.localeCompare(a.date)).forEach(item=>{
      const row=document.createElement("div");row.className="history-row";
      const date=document.createElement("strong");date.textContent=dailyDateLabel(item.date);
      const route=document.createElement("span");route.textContent=item.start+" → "+item.goal;
      const score=document.createElement("small");score.textContent=item.clicks+" clicks · "+formatTime(item.seconds);
      row.append(date,route,score);list.appendChild(row);
    });
  } catch(error) {
    const empty=document.createElement("p");empty.className="board-empty";empty.textContent=authError(error);list.appendChild(empty);
  }
}

function finishRace() {
  if(state.mode==="multiplayer" && multiplayerLocalFinished)return;
  stopTimer();
  state.loading = false;
  if(state.mode==="multiplayer")multiplayerLocalFinished=true;
  const bestKey = "wikirace-best-" + (state.mode === "daily" ? "daily" : state.difficulty);
  const oldBest = Number(localStorage.getItem(bestKey));
  if (!oldBest || state.seconds < oldBest) localStorage.setItem(bestKey, String(state.seconds));
  $("winScreen").querySelector(".eyebrow").textContent="RACE COMPLETE";
  $("winScreen").querySelector(".win-card h1").textContent="You did it!";
  $("winScreen").querySelector(".win-copy").innerHTML='You navigated from <strong id="winStart">Start</strong> to <strong id="winGoal">Finish</strong>.';
  $("winStart").textContent = state.start;
  $("winGoal").textContent = state.goal;
  $("finalTime").textContent = formatTime(state.seconds);
  $("finalClicks").textContent = String(state.clicks);
  $("multiplayerResults")?.classList.toggle("hidden",state.mode!=="multiplayer");
  $("playAgainButton").classList.toggle("hidden",state.mode==="multiplayer");
  $("homeButton").textContent=state.mode==="multiplayer"?"Leave game":"Back to home";
  showScreen("win");
  launchConfetti();
  if(state.mode==="multiplayer"){
    updateRoomPlayer(true);
    renderMultiplayerResults();
  }
  if(currentUser) {
    const userId=currentUser.uid;
    const raceSeconds=state.seconds;
    const raceClicks=state.clicks;
    const profileRef=db.collection("users").doc(userId);
    db.runTransaction(async transaction=>{
      const snapshot=await transaction.get(profileRef);
      const profile=snapshot.data()||{};
      transaction.set(profileRef,{
        races:Number(profile.races||0)+1,
        wins:Number(profile.wins||0)+1,
        bestRaceTime:profile.bestRaceTime==null?raceSeconds:Math.min(Number(profile.bestRaceTime),raceSeconds),
        fewestRaceClicks:profile.fewestRaceClicks==null?raceClicks:Math.min(Number(profile.fewestRaceClicks),raceClicks),
        lastRaceAt:firebase.firestore.FieldValue.serverTimestamp()
      },{merge:true});
    }).then(()=>profileRef.get()).then(snapshot=>renderProfileProgress(snapshot.data()||{})).catch(error=>console.warn("Could not update race records:",error));
  }
  if(state.mode==="daily")saveDailyResult();
}
function closeOpponentFinishedPrompt(){
  $("opponentFinishedModal").classList.add("hidden");
}
function showOpponentFinishedPrompt(opponent){
  if(!opponent||multiplayerLocalFinished||multiplayerEnded||opponentFinishPromptedFor===opponent.uid)return;
  opponentFinishPromptedFor=opponent.uid;
  $("opponentFinishedMessage").textContent=(opponent.username||"Your opponent")+" reached the destination. Do you want to keep racing?";
  $("opponentFinishedModal").classList.remove("hidden");
}
async function endMultiplayerRace(){
  if(!activeRoom||!currentUser||multiplayerLocalFinished||multiplayerEnded)return;
  multiplayerEnded=true;
  stopTimer();
  closeOpponentFinishedPrompt();
  await updateRoomPlayer(false,{ended:true,endedAt:firebase.firestore.FieldValue.serverTimestamp()});
  showMultiplayerEndedResults("You ended the race.");
}
function showMultiplayerEndedResults(message){
  stopTimer();
  state.loading=false;
  $("winStart").textContent=state.start;
  $("winGoal").textContent=state.goal;
  $("finalTime").textContent=formatTime(state.seconds);
  $("finalClicks").textContent=String(state.clicks);
  $("multiplayerResults")?.classList.remove("hidden");
  $("playAgainButton").classList.add("hidden");
  $("homeButton").textContent="Leave game";
  $("winScreen").querySelector(".eyebrow").textContent="RACE ENDED";
  $("winScreen").querySelector(".win-card h1").textContent="Race ended";
  $("winScreen").querySelector(".win-copy").textContent=message;
  showScreen("win");
  renderMultiplayerResults();
}
function renderMultiplayerResults(){
  const panel=$("multiplayerResults"),list=$("multiplayerResultsList");
  if(!panel||!list||state.mode!=="multiplayer")return;
  panel.classList.remove("hidden");
  list.replaceChildren();
  const players=window.roomPlayers||[];
  const finished=players.filter(p=>p.finished).sort((a,b)=>(a.finishedAt?.toMillis?.()||Infinity)-(b.finishedAt?.toMillis?.()||Infinity));
  const firstUid=finished[0]?.uid;
  players.forEach(player=>{
    const row=document.createElement("div");row.className="multiplayer-result-row";
    const identity=document.createElement("div");identity.className="multiplayer-result-identity";
    const name=document.createElement("strong");name.textContent=player.username||"Player";
    const status=document.createElement("span");
    const presence=roomPresenceStates.get(player.uid);
    let label=player.finished?(player.uid===firstUid?"Finished first":"Finished"):player.ended?"Ended":(presence===false?"Disconnected":"Still racing");
    status.textContent=label;
    identity.append(name,status);
    const stats=document.createElement("div");stats.className="multiplayer-result-stats";
    const current=document.createElement("span");current.textContent=player.finished?"Destination reached":player.ended?"Race ended":"At: "+(player.current||"Starting");
    const score=document.createElement("span");score.textContent=(Number(player.clicks||0))+" clicks · "+formatTime(Number(player.seconds||0));
    stats.append(current,score);row.append(identity,stats);list.appendChild(row);
  });
  const allDone=players.length>=2&&players.every(p=>p.finished||p.ended);
  const allRequested=players.length>=2&&players.every(p=>p.rematch===true);
  const me=players.find(p=>p.uid===currentUser?.uid);
  $("requestRematchButton").disabled=!allDone||allRequested||!!me?.rematch;
  $("requestRematchButton").textContent=allRequested?"Starting rematch…":(me?.rematch?"Rematch requested":"Request rematch");
  $("rematchStatus").textContent=!allDone?"Waiting for the other player to finish or end the race.":allRequested?"Both players requested a rematch.":(players.some(p=>p.rematch&&p.uid!==currentUser?.uid)?"Your opponent requested a rematch.":"When both players request a rematch, a new waiting room will open.");
}
async function requestRoomRematch(){
  if(!activeRoom||!currentUser)return;
  const players=window.roomPlayers||[];
  if(players.length<2||!players.every(p=>p.finished||p.ended))return;
  try{await activeRoomRef().collection("players").doc(currentUser.uid).update({rematch:true});}
  catch(error){setToast(authError(error));}
}
async function maybeStartRoomRematch(players){
  if(!activeRoom||activeRoom.hostUid!==currentUser?.uid||activeRoom.status!=="racing"||players.length<2||!players.every(p=>p.rematch===true))return;
  try{await activeRoomRef().update({status:"waiting",startedAt:null,start:"",goal:"",rematchAt:firebase.firestore.FieldValue.serverTimestamp()});}
  catch(error){setToast(authError(error));}
}
async function resetPlayerForRematch(){
  if(rematchResetInProgress||!activeRoom||!currentUser)return;
  rematchResetInProgress=true;
  try{
    await activeRoomRef().collection("players").doc(currentUser.uid).update({ready:false,finished:false,ended:false,rematch:false,clicks:0,seconds:0,current:"",finishedAt:firebase.firestore.FieldValue.delete(),endedAt:firebase.firestore.FieldValue.delete()});
    multiplayerLocalFinished=false;multiplayerEnded=false;opponentFinishPromptedFor="";lastRoomProgressSecond=-1;
    $("multiplayerResults").classList.add("hidden");
    $("winScreen").querySelector(".eyebrow").textContent="RACE COMPLETE";
    $("winScreen").querySelector(".win-card h1").textContent="You did it!";
    $("winScreen").querySelector(".win-copy").innerHTML='You navigated from <strong id="winStart">Start</strong> to <strong id="winGoal">Finish</strong>.';
    $("playAgainButton").classList.remove("hidden");
    $("homeButton").textContent="Leave game";
    showScreen("home");
    roomPanel("Waiting for the rematch",window.roomPlayers);
  }catch(error){setToast(authError(error));}
  finally{rematchResetInProgress=false;}
}

async function showRaceCountdown(startedAt=null){
  let overlay=$("raceCountdown");
  if(!overlay){
    overlay=document.createElement("div");
    overlay.id="raceCountdown";
    overlay.className="race-countdown hidden";
    overlay.setAttribute("aria-live","assertive");
    overlay.setAttribute("aria-label","Race starting countdown");
    const label=document.createElement("span");
    label.id="raceCountdownText";
    overlay.appendChild(label);
    document.body.appendChild(overlay);
  }
  const label=$("raceCountdownText");
  const startMs=startedAt?.toMillis?.()||Date.now();
  overlay.classList.remove("hidden");
  let previous="";
  while(Date.now()-startMs<4000){
    const elapsed=Math.max(0,Date.now()-startMs);
    const index=Math.min(3,Math.floor(elapsed/1000));
    const value=["3","2","1","GO!"][index];
    if(value!==previous){label.textContent=value;previous=value;}
    await new Promise(resolve=>setTimeout(resolve,40));
  }
  overlay.classList.add("hidden");
}

async function beginRace() {
  state.mode="solo";
  state.dailyDate=null;
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
    await showRaceCountdown();
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
  state.mode="solo";
  state.dailyDate=null;
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
  if (activeRoomCode) leaveRoom();
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

$("startButton").addEventListener("click", handleStartAction);
$("restartButton").addEventListener("click", () => newRoute().catch(error => setToast(error.message)));
$("previousButton").addEventListener("click", goBackArticle);
$("quitButton").addEventListener("click", leaveRace);
$("playAgainButton").addEventListener("click", () => { showScreen("home"); beginRace(); });
$("homeButton").addEventListener("click", () => { if(activeRoomCode)leaveRoom(); showScreen("home"); });
$("continueRaceButton").addEventListener("click",closeOpponentFinishedPrompt);
$("endRaceButton").addEventListener("click",endMultiplayerRace);
$("requestRematchButton").addEventListener("click",requestRoomRematch);
$("homeLink").addEventListener("click", event => { event.preventDefault(); leaveRace(); });
$("helpButton").addEventListener("click", () => $("helpModal").classList.remove("hidden"));
$("closeHelp").addEventListener("click", () => $("helpModal").classList.add("hidden"));
$("helpModal").addEventListener("click", event => {
  if (event.target === $("helpModal")) $("helpModal").classList.add("hidden");
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") $("helpModal").classList.add("hidden");
  const key = event.key.toLowerCase();
  if (raceOptions.blockFind && (((event.ctrlKey || event.metaKey) && (key === "f" || key === "g")) || key === "f3")) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  if (raceOptions.blockBrowserNavigation && ((event.altKey && (key === "arrowleft" || key === "arrowright")) || (key === "backspace" && !/input|textarea|select/i.test(event.target.tagName)))) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
});

window.addEventListener("message", async event => {
  if (event.source !== $("articleContent").querySelector("iframe")?.contentWindow) return;
  if (event.data?.type === "wikirace-height") {
    const frame = $("articleContent").querySelector("iframe");
    const height = Number(event.data.height);
    if (frame && Number.isFinite(height)) frame.style.height = Math.max(500, height) + "px";
    return;
  }
  if (event.data?.type === "wikirace-prefetch") { prefetchArticle(String(event.data.title || "")); return; }
  if (event.data?.type !== "wikirace-navigation") return;
  const requestedTitle = String(event.data.title || "");
  if (!requestedTitle || state.loading) return;

  // Resolve redirects before comparing the clicked article with the destination.
  // For example, "Sharks" may redirect to the "Shark" destination page.
  let title;
  try {
    title = await resolveWikipediaTitle(requestedTitle);
  } catch (error) {
    setToast(error.message || "Could not open that Wikipedia article.");
    return;
  }
  if (state.loading) return;
  if (normaliseTitle(title) === normaliseTitle(state.goal)) {
    state.clicks += 1;
    state.current = title;
    updateStats();
    finishRace();
    return;
  }
  recordArticleVisit(title);
  await loadArticle(title, true);
  updateRoomPlayer(false);
});

updateStats();

let currentUser = null;
let currentUsername = "";
let activeRoom = null;
let activeRoomCode = "";
let chatUnsubscribe = null;
let chatSending = false;
let roomUnsubscribe = null;
let playersUnsubscribe = null;
let inviteUnsubscribe = null;
let presenceHeartbeat = null;
let friendPresenceUnsubs = [];
let friendPresenceStates = new Map();
let friendPresenceRefreshTimer = null;
let roomLaunchKey = "";
let multiplayerLocalFinished = false;
let multiplayerEnded = false;
let opponentFinishPromptedFor = "";
let lastRoomProgressSecond = -1;
let roomPresenceUnsubs = new Map();
let roomPresenceStates = new Map();
let rematchResetInProgress = false;
window.roomPlayers = [];

function authError(error) {
  const map = {"auth/email-already-in-use":"That email already has an account.","auth/invalid-email":"Enter a valid email.","auth/weak-password":"Use at least 6 characters.","auth/user-not-found":"No account found with that email.","auth/wrong-password":"Incorrect password.","auth/invalid-credential":"Email or password is incorrect."};
  return map[error.code] || error.message || "Something went wrong.";
}
function authMode(mode) {
  $("authModeLabel").textContent = mode === "signup" ? "CREATE ACCOUNT" : "EMAIL ACCOUNT";
  $("authTitle").textContent = mode === "signup" ? "Create account" : "Sign in";
  $("authSubmit").textContent = mode === "signup" ? "Create account" : "Sign in";
  $("authModal").dataset.mode = mode;
  $("authSwitchText").firstChild.textContent = mode === "signup" ? "Already have an account? " : "Don't have an account? ";
  $("authSwitchButton").textContent = mode === "signup" ? "Sign in" : "Sign up";
  $("authError").textContent = "";
  $("authModal").classList.remove("hidden");
}
function renderAccount() {
  $("accountButton").textContent = currentUser ? (currentUsername || currentUser.displayName || currentUser.email || "Account").split(" ")[0] : "Sign in";
  $("topSignOutButton").classList.toggle("hidden", !currentUser);
  $("accountStatus").textContent = currentUser ? (currentUsername || currentUser.displayName || currentUser.email) : "Not signed in";
  $("signedOutArea").classList.toggle("hidden", !!currentUser);
  $("signedInArea").classList.toggle("hidden", !currentUser);
}
function usernameKey(value){return String(value||"").trim().toLowerCase().replace(/[^a-z0-9_-]/g,"");}
async function profileFor(user) {
  const ref = db.collection("users").doc(user.uid);
  const snap = await ref.get();
  let profile = snap.data();
  if (!snap.exists) {
    const fallback = (user.displayName || (user.email || "Player").split("@")[0]).slice(0,20);
    const chosen = prompt("Choose a WikiRace username:", fallback);
    profile = {username:(chosen || fallback).trim().slice(0,20) || fallback,email:user.email || "",createdAt:firebase.firestore.FieldValue.serverTimestamp(),races:0,wins:0};
    await ref.set(profile);
  }
  currentUsername = profile.username || (user.displayName || (user.email || "Player").split("@")[0]).slice(0,20);
  renderProfileProgress(profile);
  await db.collection("publicProfiles").doc(user.uid).set({
    uid:user.uid,username:currentUsername,
    currentStreak:Number(profile.currentStreak||0),
    longestStreak:Number(profile.longestStreak||0),
    totalDailyRuns:Number(profile.totalDailyRuns||0),
    streakBadges:profile.streakBadges||[],
    profileFrame:profile.profileFrame||"none"
  },{merge:true}).catch(error=>console.warn("Could not sync public profile:",error));
  const key = usernameKey(currentUsername);
  if(key) {
    const indexRef=db.collection("usernames").doc(key), indexSnap=await indexRef.get();
    if(indexSnap.exists && indexSnap.data().uid!==user.uid) {
      setToast("That username is already in use. Change it in your account settings.");
    } else {
      await indexRef.set({uid:user.uid,username:currentUsername});
    }
  }
}
auth.onAuthStateChanged(async user => {
  currentUser = user;
  currentUsername = "";
  renderAccount();
  if (user) { try { await profileFor(user); listenForGameInvites(); startPresenceTracking(); } catch(e) { setToast(authError(e)); } }
  else { if(presenceHeartbeat)clearInterval(presenceHeartbeat); presenceHeartbeat=null; document.removeEventListener("visibilitychange",handlePresenceVisibility); stopFriendPresenceListeners(); if(inviteUnsubscribe)inviteUnsubscribe(); inviteUnsubscribe=null; $("gameInviteNotifications").replaceChildren(); detachRoomListeners(); activeRoom=null; activeRoomCode=""; $("roomStatus").classList.add("hidden"); }
  renderAccount();
  loadDailyChallenge();
});
$("accountButton").addEventListener("click",()=>currentUser ? openFriends() : authMode("signin"));
$("googleSignIn").addEventListener("click",async()=>{try{await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());}catch(e){setToast(authError(e));}});
$("modalGoogleSignIn").addEventListener("click",async()=>{try{await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());$("authModal").classList.add("hidden");}catch(e){$("authError").textContent=authError(e);}});
$("emailSignIn").addEventListener("click",()=>authMode("signin"));
$("emailSignUp").addEventListener("click",()=>authMode("signup"));
$("authSwitchButton").addEventListener("click",()=>authMode($("authModal").dataset.mode === "signup" ? "signin" : "signup"));
$("authClose").addEventListener("click",()=>$("authModal").classList.add("hidden"));
$("authModal").addEventListener("click",e=>{if(e.target===$("authModal"))$("authModal").classList.add("hidden");});
$("authForm").addEventListener("submit",async e=>{
  e.preventDefault();
  $("authSubmit").disabled=true;
  try {
    const email=$("authEmail").value.trim(), password=$("authPassword").value;
    if($("authModal").dataset.mode==="signup") await auth.createUserWithEmailAndPassword(email,password);
    else await auth.signInWithEmailAndPassword(email,password);
    $("authModal").classList.add("hidden"); $("authForm").reset();
  } catch(error) {$("authError").textContent=authError(error);}
  finally {$("authSubmit").disabled=false;}
});
$("logoutButton").addEventListener("click",async()=>{if(activeRoomCode)await leaveRoom();await auth.signOut();});
$("topSignOutButton").addEventListener("click",async()=>{if(activeRoomCode)await leaveRoom();await auth.signOut();setToast("Signed out.");});

$("friendsClose").addEventListener("click",()=>$("friendsModal").classList.add("hidden"));
$("friendsModal").addEventListener("click",e=>{if(e.target===$("friendsModal"))$("friendsModal").classList.add("hidden");});
$("addFriendButton").addEventListener("click",addFriendByUsername);
$("friendUsernameInput").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();addFriendByUsername();}});
function friendMessage(message,isError=false){$("friendsMessage").textContent=message;$("friendsMessage").classList.toggle("error",isError);}
function openFriends(){
  if(!currentUser)return authMode("signin");
  $("friendsModal").classList.remove("hidden");
  $("friendUsernameInput").value="";
  friendMessage("");
  loadFriends();
}
function friendRow(name,detail,actions=[]){
  const row=document.createElement("div");row.className="friend-row";
  const info=document.createElement("div");info.className="friend-info";
  const strong=document.createElement("strong");strong.textContent=name;
  const small=document.createElement("span");small.textContent=detail||"";
  info.append(strong,small);row.appendChild(info);
  const controls=document.createElement("div");controls.className="friend-actions";
  actions.forEach(({label,run,kind})=>{const b=document.createElement("button");b.type="button";b.className="secondary-button"+(kind?" "+kind:"");b.textContent=label;b.addEventListener("click",run);controls.appendChild(b);});
  row.appendChild(controls);return row;
}
async function loadFriends(){
  if(!currentUser)return;
  stopFriendPresenceListeners();
  const requests=$("friendRequestsList"), friends=$("friendsList");
  requests.replaceChildren();friends.replaceChildren();
  try{
    const [incoming,connections]=await Promise.all([
      db.collection("friendRequests").where("toUid","==",currentUser.uid).get(),
      db.collection("friendships").where("members","array-contains",currentUser.uid).get()
    ]);
    const pending=incoming.docs.filter(doc=>doc.data().status==="pending");
    if(!pending.length){const p=document.createElement("p");p.className="friends-empty";p.textContent="No pending requests.";requests.appendChild(p);}
    pending.forEach(doc=>{
      const req=doc.data();
      requests.appendChild(friendRow(req.fromUsername||"WikiRace player","Wants to be your friend",[
        {label:"Accept",kind:"friend-accept",run:()=>acceptFriendRequest(doc.id,req)},
        {label:"Decline",run:()=>declineFriendRequest(doc.id)}
      ]));
    });
    if(connections.empty){const p=document.createElement("p");p.className="friends-empty";p.textContent="No friends added yet.";friends.appendChild(p);}
    connections.forEach(doc=>{
      const data=doc.data(), otherUid=data.members.find(id=>id!==currentUser.uid);
      const name=data.usernames?.[otherUid]||"WikiRace player";
      const row=friendRow(name,"Friend",[{label:"Invite",kind:"friend-invite",run:()=>inviteFriend(otherUid,name)}]);
      friends.appendChild(row);
      watchFriendPresence(otherUid,row);
    });
  }catch(error){friendMessage(authError(error),true);}
}
function stopFriendPresenceListeners(){
  friendPresenceUnsubs.forEach(unsubscribe=>unsubscribe());
  friendPresenceUnsubs=[];
  friendPresenceStates.clear();
  if(friendPresenceRefreshTimer)clearInterval(friendPresenceRefreshTimer);
  friendPresenceRefreshTimer=null;
}
function updateFriendPresenceDisplay(){
  document.querySelectorAll(".friend-presence").forEach(el=>{
    const state=friendPresenceStates.get(el.dataset.uid);
    const online=!!state && state.online && state.lastSeen && Date.now()-state.lastSeen<120000;
    el.classList.toggle("is-online",online);
    el.classList.toggle("is-offline",!online);
    const label=el.querySelector(".presence-label");
    if(label)label.textContent=online?"Online":"Offline";
  });
}
function watchFriendPresence(uid,row){
  const status=document.createElement("span");
  status.className="friend-presence is-offline";
  status.dataset.uid=uid;
  const dot=document.createElement("i");
  dot.className="presence-dot";
  const label=document.createElement("span");
  label.className="presence-label";
  label.textContent="Offline";
  status.append(dot,label);
  row.querySelector(".friend-info").appendChild(status);
  const unsubscribe=db.collection("presence").doc(uid).onSnapshot(snap=>{
    const data=snap.data()||{};
    friendPresenceStates.set(uid,{
      online:data.online===true,
      lastSeen:data.lastSeen?.toMillis?.()||0
    });
    updateFriendPresenceDisplay();
  },error=>setToast(authError(error)));
  friendPresenceUnsubs.push(unsubscribe);
  if(!friendPresenceRefreshTimer)friendPresenceRefreshTimer=setInterval(updateFriendPresenceDisplay,30000);
}
async function updateMyPresence(online=true){
  if(!currentUser)return;
  try{
    await db.collection("presence").doc(currentUser.uid).set({
      online,
      lastSeen:firebase.firestore.FieldValue.serverTimestamp(),
      username:currentUsername
    },{merge:true});
  }catch(error){if(online)setToast(authError(error));}
}
function startPresenceTracking(){
  if(presenceHeartbeat)clearInterval(presenceHeartbeat);
  updateMyPresence(true);
  presenceHeartbeat=setInterval(()=>updateMyPresence(true),60000);
  document.removeEventListener("visibilitychange",handlePresenceVisibility);
  document.addEventListener("visibilitychange",handlePresenceVisibility);
}
function handlePresenceVisibility(){
  if(document.visibilityState==="visible")updateMyPresence(true);
}

async function addFriendByUsername(){
  if(!currentUser)return;
  const entered=$("friendUsernameInput").value.trim(), key=usernameKey(entered);
  if(!key)return friendMessage("Enter a valid username.",true);
  if(key===usernameKey(currentUsername))return friendMessage("You cannot add yourself.",true);
  $("addFriendButton").disabled=true;
  try{
    const target=await db.collection("usernames").doc(key).get();
    if(!target.exists)return friendMessage("No account was found with that username.",true);
    const person=target.data();
    if(person.uid===currentUser.uid)return friendMessage("You cannot add yourself.",true);
    const existing=await db.collection("friendships").where("members","array-contains",currentUser.uid).get();
    if(existing.docs.some(d=>d.data().members.includes(person.uid)))return friendMessage("You are already friends.");
    const requests=await db.collection("friendRequests")
      .where("fromUid","==",currentUser.uid)
      .where("toUid","==",person.uid)
      .get();
    const previous=requests.docs[0];
    if(previous && previous.data().status==="pending")return friendMessage("You already sent a request to this person.");
    if(previous)await previous.ref.delete();
    const requestId=currentUser.uid+"_"+person.uid;
    await db.collection("friendRequests").doc(requestId).set({
      fromUid:currentUser.uid,
      toUid:person.uid,
      fromUsername:currentUsername,
      toUsername:person.username,
      status:"pending",
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    });
    $("friendUsernameInput").value="";
    friendMessage("Friend request sent to "+person.username+".");
  }catch(error){friendMessage(authError(error),true);}
  finally{$("addFriendButton").disabled=false;}
}
async function acceptFriendRequest(requestId,request){
  try{
    const members=[currentUser.uid,request.fromUid].sort();
    const names={};names[currentUser.uid]=currentUsername;names[request.fromUid]=request.fromUsername||"WikiRace player";
    await db.collection("friendships").doc(members.join("__")).set({members,usernames:names,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
    await db.collection("friendRequests").doc(requestId).update({status:"accepted",respondedAt:firebase.firestore.FieldValue.serverTimestamp()});
    friendMessage("Friend added.");loadFriends();
  }catch(error){friendMessage(authError(error),true);}
}
async function declineFriendRequest(requestId){
  try{await db.collection("friendRequests").doc(requestId).update({status:"declined"});loadFriends();}
  catch(error){friendMessage(authError(error),true);}
}
async function inviteFriend(friendUid,friendName){
  if(!activeRoom || !activeRoomCode)return friendMessage("Create or join a game first, then invite "+friendName+".",true);
  if(activeRoom.status!=="waiting")return friendMessage("Invites can only be sent before the race starts.",true);
  try{
    await db.collection("gameInvites").add({
      fromUid:currentUser.uid,
      toUid:friendUid,
      fromUsername:currentUsername,
      roomId:activeRoom.id,
      roomCode:activeRoomCode,
      status:"pending",
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    });
    friendMessage("Invitation sent to "+friendName+".");
  }catch(error){friendMessage(authError(error),true);}
}

function showGameInvite(doc){
  const invite=doc.data();
  const container=$("gameInviteNotifications");
  if(!container || document.getElementById("game-invite-"+doc.id))return;
  const card=document.createElement("div");
  card.className="game-invite-notification";
  card.id="game-invite-"+doc.id;
  const message=document.createElement("p");
  message.textContent=(invite.fromUsername||"Someone")+" invited you to a WikiRace game.";
  const actions=document.createElement("div");
  actions.className="game-invite-actions";
  const join=document.createElement("button");
  join.type="button";join.className="secondary-button";join.textContent="Join game";
  join.addEventListener("click",async()=>{
    join.disabled=true;
    try{
      const roomRef=db.collection("rooms").doc(invite.roomId);
      const roomSnap=await roomRef.get();
      if(!roomSnap.exists || roomSnap.data().status!=="waiting")throw new Error("This game is no longer waiting for players.");
      await roomRef.collection("players").doc(currentUser.uid).set({
        uid:currentUser.uid,username:currentUsername||await username(),clicks:0,seconds:0,current:"",finished:false
      });
      await db.collection("gameInvites").doc(doc.id).delete();
      card.remove();
      await listenRoom(invite.roomId,invite.roomCode);
    }catch(error){setToast(error.message||authError(error));join.disabled=false;}
  });
  const dismiss=document.createElement("button");
  dismiss.type="button";dismiss.className="text-button";dismiss.textContent="Dismiss";
  dismiss.addEventListener("click",async()=>{
    try{await db.collection("gameInvites").doc(doc.id).delete();card.remove();}
    catch(error){setToast(authError(error));}
  });
  actions.append(join,dismiss);
  card.append(message,actions);
  container.appendChild(card);
}

function listenForGameInvites(){
  if(inviteUnsubscribe)inviteUnsubscribe();
  inviteUnsubscribe=null;
  $("gameInviteNotifications").replaceChildren();
  if(!currentUser)return;
  inviteUnsubscribe=db.collection("gameInvites").where("toUid","==",currentUser.uid).onSnapshot(snapshot=>{
    snapshot.docChanges().forEach(change=>{
      if(change.type==="removed"){
        document.getElementById("game-invite-"+change.doc.id)?.remove();
      }else if(change.doc.data().status==="pending"){
        showGameInvite(change.doc);
      }
    });
  },error=>setToast(authError(error)));
}

function detachRoomListeners(){if(roomUnsubscribe)roomUnsubscribe();if(playersUnsubscribe)playersUnsubscribe();if(chatUnsubscribe)chatUnsubscribe();roomUnsubscribe=null;playersUnsubscribe=null;chatUnsubscribe=null;for(const unsubscribe of roomPresenceUnsubs.values())unsubscribe();roomPresenceUnsubs.clear();roomPresenceStates.clear();$("multiplayerChat")?.classList.add("hidden");$("chatLauncher")?.classList.add("hidden");closeOpponentFinishedPrompt();}
function makeRoomCode(){const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let s="";for(let i=0;i<6;i++)s+=chars[Math.floor(Math.random()*chars.length)];return s;}
async function username(){const snap=await db.collection("users").doc(currentUser.uid).get();return snap.data()?.username || currentUser.displayName || (currentUser.email||"Player").split("@")[0];}
function roomPanel(message,players=[]){
  const el=$("roomStatus");el.classList.remove("hidden");el.replaceChildren();
  const heading=document.createElement("strong");heading.textContent=message;el.appendChild(heading);
  if(activeRoomCode){const code=document.createElement("div");code.className="room-code-display";code.textContent="GAME CODE: "+activeRoomCode;el.appendChild(code);}
  if(activeRoom?.status==="waiting"){
    const prompt=document.createElement("p");prompt.className="room-ready-prompt";prompt.textContent="Are you ready? Everyone needs to ready up before the host can start.";el.appendChild(prompt);
    const ready=document.createElement("button");ready.className="secondary-button room-ready-button";ready.textContent=players.find(p=>p.uid===currentUser?.uid)?.ready?"Cancel ready":"Ready";ready.classList.toggle("is-ready",players.find(p=>p.uid===currentUser?.uid)?.ready===true);ready.onclick=toggleRoomReady;el.appendChild(ready);
  }
  if(players.length){
    const list=document.createElement("div");list.className="room-player-list";
    players.forEach(p=>{const item=document.createElement("span");item.className=p.ready?"player-ready":"player-not-ready";item.textContent=(p.username||"Player")+" · "+(activeRoom?.status==="waiting"?(p.ready?"Ready":"Not ready"):(p.finished?"Finished":"Playing"));list.appendChild(item);});
    el.appendChild(list);
  }
  if(activeRoom?.hostUid===currentUser?.uid && activeRoom.status==="waiting"){
    const allReady=players.length>0&&players.every(p=>p.ready===true);
    const b=document.createElement("button");b.className="secondary-button room-start-button";b.textContent=allReady?"Start race for everyone":"Waiting for everyone to ready up";b.disabled=!allReady;b.onclick=startRoomRace;el.appendChild(b);
  }
  const leave=document.createElement("button");leave.className="text-button";leave.textContent="Leave game";leave.onclick=leaveRoom;el.appendChild(leave);
}
async function toggleRoomReady(){
  if(!activeRoom||activeRoom.status!=="waiting"||!currentUser)return;
  const player=window.roomPlayers.find(p=>p.uid===currentUser.uid);
  try{await activeRoomRef().collection("players").doc(currentUser.uid).update({ready:player?.ready!==true});}
  catch(error){setToast(authError(error));}
}
function activeRoomRef(){return db.collection("rooms").doc(activeRoom.id);}
async function listenRoom(id,code){
  detachRoomListeners();activeRoomCode=code;
  roomUnsubscribe=db.collection("rooms").doc(id).onSnapshot(async snap=>{
    if(!snap.exists){setToast("This room no longer exists.");detachRoomListeners();activeRoom=null;activeRoomCode="";return;}
    const previousStatus=activeRoom?.status;
    activeRoom={id:snap.id,...snap.data()};
    if(activeRoom.status==="racing"){
      const key=activeRoom.id+":"+(activeRoom.startedAt?.toMillis?.()||"started");
      if(roomLaunchKey!==key){
        roomLaunchKey=key;multiplayerLocalFinished=false;multiplayerEnded=false;opponentFinishPromptedFor="";lastRoomProgressSecond=-1;
        await launchSharedRace(activeRoom);
      }
    } else {
      if(previousStatus==="racing"&&roomLaunchKey.startsWith(activeRoom.id+":")){
        roomLaunchKey="";
        await resetPlayerForRematch();
      } else roomPanel("Waiting for the host to start",window.roomPlayers);
    }
  },e=>setToast(authError(e)));
  playersUnsubscribe=db.collection("rooms").doc(id).collection("players").onSnapshot(s=>{
    window.roomPlayers=s.docs.map(d=>d.data());
    syncRoomPresence(window.roomPlayers);
    if(activeRoom?.status==="waiting")roomPanel("Waiting for players",window.roomPlayers);
    if(activeRoom?.status==="racing"){handleRoomPlayersUpdate();maybeStartRoomRematch(window.roomPlayers);}
  });
  roomPanel("Waiting for players",window.roomPlayers);
  listenRoomChat(id);
}
function syncRoomPresence(players){
  const ids=new Set(players.map(p=>p.uid).filter(uid=>uid&&uid!==currentUser?.uid));
  for(const [uid,unsubscribe] of roomPresenceUnsubs){
    if(!ids.has(uid)){unsubscribe();roomPresenceUnsubs.delete(uid);roomPresenceStates.delete(uid);}
  }
  ids.forEach(uid=>{
    if(roomPresenceUnsubs.has(uid))return;
    const unsubscribe=db.collection("presence").doc(uid).onSnapshot(snapshot=>{
      const data=snapshot.data();
      const lastSeen=data?.lastSeen?.toMillis?.()||0;
      roomPresenceStates.set(uid,!!data?.online&&(!lastSeen||Date.now()-lastSeen<120000));
      if(screens.win.classList.contains("active"))renderMultiplayerResults();
    },()=>{roomPresenceStates.set(uid,false);if(screens.win.classList.contains("active"))renderMultiplayerResults();});
    roomPresenceUnsubs.set(uid,unsubscribe);
  });
}
function handleRoomPlayersUpdate(){
  const players=window.roomPlayers||[];
  const opponent=players.find(p=>p.uid!==currentUser?.uid);
  if(!opponent)return;
  if(opponent.finished&&!multiplayerLocalFinished&&!multiplayerEnded)showOpponentFinishedPrompt(opponent);
  if(opponent.ended&&!multiplayerLocalFinished&&!multiplayerEnded){
    multiplayerEnded=true;
    showMultiplayerEndedResults((opponent.username||"Your opponent")+" ended the race.");
    updateRoomPlayer(false,{ended:true,endedAt:firebase.firestore.FieldValue.serverTimestamp()});
  }
  if(screens.win.classList.contains("active"))renderMultiplayerResults();
}

async function createRoom(){
  if(!currentUser)return authMode("signin");
  try{
    const code=makeRoomCode(), name=await username(), ref=db.collection("rooms").doc();
    await ref.set({code,hostUid:currentUser.uid,status:"waiting",createdAt:firebase.firestore.FieldValue.serverTimestamp(),start:"",goal:"",difficulty:"medium"});
    await ref.collection("players").doc(currentUser.uid).set({uid:currentUser.uid,username:name,clicks:0,seconds:0,current:"",finished:false,ready:false});
    await listenRoom(ref.id,code);
  }catch(e){setToast(authError(e));}
}
async function joinRoom(){
  if(!currentUser)return authMode("signin");
  const code=$("joinCodeInput").value.trim().toUpperCase();
  if(!/^[A-HJ-NP-Z2-9]{6}$/.test(code))return setToast("Enter a valid 6-character code.");
  try{
    const found=await db.collection("rooms").where("code","==",code).limit(1).get();
    const doc=found.docs.find(d=>d.data().status==="waiting");
    if(!doc)return setToast("No waiting game was found with that code.");
    await doc.ref.collection("players").doc(currentUser.uid).set({uid:currentUser.uid,username:await username(),clicks:0,seconds:0,current:"",finished:false,ready:false});
    await listenRoom(doc.id,code);$("joinCodeInput").value="";
  }catch(e){setToast(authError(e));}
}
async function startRoomRace(){
  if(!activeRoom || activeRoom.hostUid!==currentUser?.uid || activeRoom.status!=="waiting")return;
  if(!window.roomPlayers.length||window.roomPlayers.some(p=>p.ready!==true))return setToast("Everyone needs to ready up first.");
  const b=$("roomStatus").querySelector(".room-start-button");if(b)b.disabled=true;
  try{
    const custom=await chooseCustomRoute(), route=custom || await chooseRoute();
    await db.collection("rooms").doc(activeRoom.id).update({start:route[0],goal:route[1],difficulty:state.difficulty,options:{blockFind:raceOptions.blockFind,blockBrowserNavigation:raceOptions.blockBrowserNavigation,backEnabled},status:"racing",startedAt:firebase.firestore.FieldValue.serverTimestamp()});
  }catch(e){setToast(authError(e));if(b)b.disabled=false;}
}
function renderRoomChat(messages){
  const list=$("chatMessages");if(!list)return;
  list.replaceChildren();
  if(!messages.length){const empty=document.createElement("p");empty.className="chat-empty";empty.textContent="No messages yet. Say hello.";list.appendChild(empty);return;}
  messages.forEach(message=>{
    const row=document.createElement("div");row.className="chat-message";
    if(message.uid===currentUser?.uid)row.classList.add("own");
    const meta=document.createElement("div");meta.className="chat-message-meta";
    const name=document.createElement("strong");name.textContent=message.username||"Player";
    const time=document.createElement("span");const date=message.createdAt?.toDate?.();time.textContent=date?date.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}):"";
    const body=document.createElement("p");body.textContent=message.text||"";
    meta.append(name,time);row.append(meta,body);list.appendChild(row);
  });
  list.scrollTop=list.scrollHeight;
}
function setRoomChatOpen(open){
  const panel=$("multiplayerChat"),launcher=$("chatLauncher");
  panel.classList.toggle("chat-open",open);panel.classList.toggle("hidden",!open);
  panel.setAttribute("aria-hidden",String(!open));launcher.classList.toggle("hidden",!activeRoom);
  launcher.setAttribute("aria-expanded",String(open));
  if(open){$("chatUnread").classList.add("hidden");$("chatUnread").textContent="0";$("chatInput").focus();}
}
function listenRoomChat(roomId){
  if(chatUnsubscribe)chatUnsubscribe();
  $("chatRoomLabel").textContent="GAME "+activeRoomCode;
  $("chatLauncher").classList.remove("hidden");
  setRoomChatOpen(true);
  chatUnsubscribe=db.collection("rooms").doc(roomId).collection("chat").orderBy("createdAt","asc").limitToLast(100).onSnapshot(snapshot=>{
    renderRoomChat(snapshot.docs.map(doc=>doc.data()));
  },error=>{console.warn("Chat listener failed:",error);setToast("Chat could not load. Check the Firestore rules.");});
}
async function sendRoomChat(event){
  event.preventDefault();
  const input=$("chatInput"),message=input.value.trim();
  if(!message||chatSending||!activeRoom||!["waiting","racing"].includes(activeRoom.status)||!currentUser)return;
  chatSending=true;$("chatSendButton").disabled=true;
  try{
    await db.collection("rooms").doc(activeRoom.id).collection("chat").add({
      uid:currentUser.uid,username:await username(),text:message.slice(0,300),
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    });
    input.value="";
  }catch(error){setToast(authError(error));}
  finally{chatSending=false;$("chatSendButton").disabled=false;input.focus();}
}
$("chatForm").addEventListener("submit",sendRoomChat);
$("chatLauncher").addEventListener("click",()=>setRoomChatOpen(true));
$("chatClose").addEventListener("click",()=>setRoomChatOpen(false));

async function launchSharedRace(room){
  stopTimer();if(state.requestController)state.requestController.abort();
  state.mode="multiplayer";state.dailyDate=null;
  multiplayerLocalFinished=false;multiplayerEnded=false;opponentFinishPromptedFor="";lastRoomProgressSecond=-1;closeOpponentFinishedPrompt();
  state.clicks=0;state.seconds=0;state.loading=false;state.difficulty=room.difficulty||"medium";
  state.start=room.start;state.goal=room.goal;state.current=room.start;state.history=[];state.historyIndex=-1;
   Object.assign(raceOptions, room.options || {});
   blockFindInput.checked = raceOptions.blockFind;
   blockBrowserNavigationInput.checked = raceOptions.blockBrowserNavigation;
   backEnabled = room.options?.backEnabled !== false;
   backEnabledInput.checked = backEnabled;
  recordArticleVisit(room.start);$("startTitle").textContent=room.start;$("goalTitle").textContent=room.goal;$("currentTitle").textContent=room.start;
  updateStats();showScreen("game");await showRaceCountdown(room.startedAt);startTimer();await loadArticle(room.start,false);
  roomPanel("Race in progress",window.roomPlayers);
}
async function updateRoomPlayer(finished=false,extra={}){
  if(!activeRoom || activeRoom.status!=="racing" || !currentUser)return;
  if((multiplayerLocalFinished||multiplayerEnded)&&!finished&&!Object.keys(extra).length)return;
  try{
    const data={uid:currentUser.uid,username:currentUsername||await username(),clicks:state.clicks,seconds:state.seconds,current:state.current||"",finished,...extra,updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
    if(finished)data.finishedAt=firebase.firestore.FieldValue.serverTimestamp();
    await activeRoomRef().collection("players").doc(currentUser.uid).set(data,{merge:true});
  }catch(e){console.warn(e);}
}

async function leaveRoom(){
  if(activeRoom&&currentUser){try{await db.collection("rooms").doc(activeRoom.id).collection("players").doc(currentUser.uid).delete();}catch(e){}}
  detachRoomListeners();activeRoom=null;activeRoomCode="";roomLaunchKey="";window.roomPlayers=[];multiplayerLocalFinished=false;multiplayerEnded=false;
  if(chatUnsubscribe){chatUnsubscribe();chatUnsubscribe=null;}
  $("chatLauncher").classList.add("hidden");$("multiplayerChat").classList.add("hidden");$("multiplayerChat").classList.remove("chat-open");
  $("roomStatus").classList.add("hidden");setToast("You left the game.");
}
async function handleStartAction(){
  if(activeRoomCode){if(activeRoom?.hostUid===currentUser?.uid)await startRoomRace();else setToast("Waiting for the host to start the race.");return;}
  await beginRace();
}
$("dailyRunButton").addEventListener("click",startDailyRun);
$("dailyHistoryButton").addEventListener("click",openDailyHistory);
$("dailyHistoryClose").addEventListener("click",()=>$("dailyHistoryModal").classList.add("hidden"));
$("dailyHistoryModal").addEventListener("click",event=>{if(event.target===$("dailyHistoryModal"))$("dailyHistoryModal").classList.add("hidden");});
$("createRoomButton").addEventListener("click",createRoom);
$("joinRoomButton").addEventListener("click",joinRoom);
$("joinCodeInput").addEventListener("input",()=>{$("joinCodeInput").value=$("joinCodeInput").value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g,"").slice(0,6);});


// Show the Wikipedia donation message once per browser unless dismissed.
const donationPopup = $("donationPopup");
const donationDismissedKey = "wikirace-donation-dismissed";
if (donationPopup && localStorage.getItem(donationDismissedKey) !== "true") {
  window.setTimeout(() => donationPopup.classList.remove("hidden"), 4500);
}
$("closeDonation")?.addEventListener("click", () => {
  donationPopup?.classList.add("hidden");
  localStorage.setItem(donationDismissedKey, "true");
});

window.addEventListener("pagehide",()=>{if(currentUser)updateMyPresence(false);});
loadDailyChallenge();
