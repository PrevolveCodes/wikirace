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
  "Roman Empire", "Greek mythology", "Black hole", "Coral reef",
  "Taj Mahal", "Machu Picchu", "Renaissance", "French Revolution",
  "Industrial Revolution", "Hubble Space Telescope", "Great Barrier Reef",
  "Sahara", "Nile", "Amazon River", "Antarctica", "Volcano",
  "Tyrannosaurus", "Octopus", "Honey bee", "Red panda",
  "Bermuda Triangle", "Stonehenge", "Pompeii", "Silk Road",
  "Mona Lisa", "Vincent van Gogh", "William Shakespeare",
  "Sherlock Holmes", "J. R. R. Tolkien", "The Lord of the Rings",
  "Nintendo Switch", "Super Mario", "Minecraft modding",
  "Nintendo Entertainment System", "Tetris", "Chess",
  "Formula One", "Tour de France", "Wimbledon Championships",
  "Mount Fuji", "Grand Canyon", "Yellowstone National Park",
  "Statue of Liberty", "Big Ben", "Colosseum", "Pyramids of Giza",
  "Great Depression", "Cold War", "Apollo 11", "International Space Station",
  "Solar eclipse", "Aurora", "Tsunami", "Hurricane",
  "Renewable energy", "Electric car", "Robotics", "Photography",
  "Jazz", "Classical music", "Origami", "Sushi", "Chocolate"
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
  updateRoomPlayer(true);
  if(currentUser) db.collection("users").doc(currentUser.uid).set({races:firebase.firestore.FieldValue.increment(1),wins:firebase.firestore.FieldValue.increment(1),lastRaceAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true}).catch(()=>{});
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

$("startButton").addEventListener("click", handleStartAction);
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
  updateRoomPlayer(false);
});

updateStats();

let currentUser = null;
let activeRoom = null;
let activeRoomCode = "";
let roomUnsubscribe = null;
let playersUnsubscribe = null;
let roomLaunchKey = "";
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
  $("authError").textContent = "";
  $("authModal").classList.remove("hidden");
}
function renderAccount() {
  $("accountButton").textContent = currentUser ? (currentUser.displayName || currentUser.email || "Account").split(" ")[0] : "Sign in";
  $("accountStatus").textContent = currentUser ? (currentUser.displayName || currentUser.email) : "Not signed in";
  $("signedOutArea").classList.toggle("hidden", !!currentUser);
  $("signedInArea").classList.toggle("hidden", !currentUser);
}
async function profileFor(user) {
  const ref = db.collection("users").doc(user.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    const fallback = (user.displayName || (user.email || "Player").split("@")[0]).slice(0,20);
    const chosen = prompt("Choose a WikiRace username:", fallback);
    await ref.set({username:(chosen || fallback).trim().slice(0,20) || fallback,email:user.email || "",createdAt:firebase.firestore.FieldValue.serverTimestamp(),races:0,wins:0});
  }
}
auth.onAuthStateChanged(async user => {
  currentUser = user;
  renderAccount();
  if (user) { try { await profileFor(user); } catch(e) { setToast(authError(e)); } }
  else { detachRoomListeners(); activeRoom=null; activeRoomCode=""; $("roomStatus").classList.add("hidden"); }
  renderAccount();
});
$("accountButton").addEventListener("click",()=>currentUser ? $("accountPanel").scrollIntoView({behavior:"smooth",block:"center"}) : authMode("signin"));
$("googleSignIn").addEventListener("click",async()=>{try{await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());}catch(e){setToast(authError(e));}});
$("emailSignIn").addEventListener("click",()=>authMode("signin"));
$("emailSignUp").addEventListener("click",()=>authMode("signup"));
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

function detachRoomListeners(){if(roomUnsubscribe)roomUnsubscribe();if(playersUnsubscribe)playersUnsubscribe();roomUnsubscribe=null;playersUnsubscribe=null;}
function makeRoomCode(){const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let s="";for(let i=0;i<6;i++)s+=chars[Math.floor(Math.random()*chars.length)];return s;}
async function username(){const snap=await db.collection("users").doc(currentUser.uid).get();return snap.data()?.username || currentUser.displayName || (currentUser.email||"Player").split("@")[0];}
function roomPanel(message,players=[]){
  const el=$("roomStatus");el.classList.remove("hidden");el.replaceChildren();
  const heading=document.createElement("strong");heading.textContent=message;el.appendChild(heading);
  if(activeRoomCode){const code=document.createElement("div");code.className="room-code-display";code.textContent="GAME CODE: "+activeRoomCode;el.appendChild(code);}
  if(players.length){const list=document.createElement("div");list.className="room-player-list";players.forEach(p=>{const item=document.createElement("span");item.textContent=p.username+(p.finished?" ✓":"");list.appendChild(item);});el.appendChild(list);}
  if(activeRoom?.hostUid===currentUser?.uid && activeRoom.status==="waiting"){const b=document.createElement("button");b.className="secondary-button room-start-button";b.textContent="Start race for everyone";b.onclick=startRoomRace;el.appendChild(b);}
  const leave=document.createElement("button");leave.className="text-button";leave.textContent="Leave game";leave.onclick=leaveRoom;el.appendChild(leave);
}
async function listenRoom(id,code){
  detachRoomListeners();activeRoomCode=code;
  roomUnsubscribe=db.collection("rooms").doc(id).onSnapshot(async snap=>{
    if(!snap.exists){setToast("This room no longer exists.");detachRoomListeners();activeRoom=null;activeRoomCode="";return;}
    activeRoom={id:snap.id,...snap.data()};
    if(activeRoom.status==="racing"){
      const key=activeRoom.id+":"+(activeRoom.startedAt?.toMillis?.()||"started");
      if(roomLaunchKey!==key){roomLaunchKey=key;await launchSharedRace(activeRoom);}
    } else roomPanel("Waiting for the host to start",window.roomPlayers);
  },e=>setToast(authError(e)));
  playersUnsubscribe=db.collection("rooms").doc(id).collection("players").onSnapshot(s=>{
    window.roomPlayers=s.docs.map(d=>d.data());
    if(activeRoom?.status==="waiting")roomPanel("Waiting for the host to start",window.roomPlayers);
  });
  roomPanel("Waiting for players");
}
async function createRoom(){
  if(!currentUser)return authMode("signin");
  try{
    const code=makeRoomCode(), name=await username(), ref=db.collection("rooms").doc();
    await ref.set({code,hostUid:currentUser.uid,status:"waiting",createdAt:firebase.firestore.FieldValue.serverTimestamp(),start:"",goal:"",difficulty:"medium"});
    await ref.collection("players").doc(currentUser.uid).set({uid:currentUser.uid,username:name,clicks:0,seconds:0,current:"",finished:false});
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
    await doc.ref.collection("players").doc(currentUser.uid).set({uid:currentUser.uid,username:await username(),clicks:0,seconds:0,current:"",finished:false});
    await listenRoom(doc.id,code);$("joinCodeInput").value="";
  }catch(e){setToast(authError(e));}
}
async function startRoomRace(){
  if(!activeRoom || activeRoom.hostUid!==currentUser?.uid || activeRoom.status!=="waiting")return;
  const b=$("roomStatus").querySelector(".room-start-button");if(b)b.disabled=true;
  try{
    const custom=await chooseCustomRoute(), route=custom || await chooseRoute();
    await db.collection("rooms").doc(activeRoom.id).update({start:route[0],goal:route[1],difficulty:state.difficulty,status:"racing",startedAt:firebase.firestore.FieldValue.serverTimestamp()});
  }catch(e){setToast(authError(e));if(b)b.disabled=false;}
}
async function launchSharedRace(room){
  stopTimer();if(state.requestController)state.requestController.abort();
  state.clicks=0;state.seconds=0;state.loading=false;state.difficulty=room.difficulty||"medium";
  state.start=room.start;state.goal=room.goal;state.current=room.start;state.history=[];state.historyIndex=-1;
  recordArticleVisit(room.start);$("startTitle").textContent=room.start;$("goalTitle").textContent=room.goal;$("currentTitle").textContent=room.start;
  updateStats();showScreen("game");startTimer();await loadArticle(room.start,false);
  roomPanel("Race in progress",window.roomPlayers);
}
async function updateRoomPlayer(finished=false){
  if(!activeRoom || activeRoom.status!=="racing" || !currentUser)return;
  try{await db.collection("rooms").doc(activeRoom.id).collection("players").doc(currentUser.uid).set({uid:currentUser.uid,username:await username(),clicks:state.clicks,seconds:state.seconds,current:state.current||"",finished,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});}catch(e){console.warn(e);}
}
async function leaveRoom(){
  if(activeRoom&&currentUser){try{await db.collection("rooms").doc(activeRoom.id).collection("players").doc(currentUser.uid).delete();}catch(e){}}
  detachRoomListeners();activeRoom=null;activeRoomCode="";roomLaunchKey="";window.roomPlayers=[];
  $("roomStatus").classList.add("hidden");setToast("You left the game.");
}
async function handleStartAction(){
  if(activeRoomCode){if(activeRoom?.hostUid===currentUser?.uid)await startRoomRace();else setToast("Waiting for the host to start the race.");return;}
  await beginRace();
}
$("createRoomButton").addEventListener("click",createRoom);
$("joinRoomButton").addEventListener("click",joinRoom);
$("joinCodeInput").addEventListener("input",()=>{$("joinCodeInput").value=$("joinCodeInput").value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g,"").slice(0,6);});
