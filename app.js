const API = "https://en.wikipedia.org/w/api.php";
const firebaseConfig = {apiKey:"AIzaSyCzSZ_x6ypPdezmJHAJEYkgHFz07M5sc6M",authDomain:"wikirace-ebf2d.firebaseapp.com",projectId:"wikirace-ebf2d",storageBucket:"wikirace-ebf2d.firebasestorage.app",messagingSenderId:"184191673134",appId:"1:184191673134:web:ec0cae69438c06873550bf",measurementId:"G-8Y3FE8HGST"};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const REST = "https://en.wikipedia.org/w/rest.php/v1/page/";
const GUEST_STATS_KEY = "wikirace-guest-stats";
let currentUser = null;
let currentUsername = "";
let spectatorPlayersUnsubscribe = null;
let viewedProfileUid = "";
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
const soundToggle=$("soundEffectsEnabled");if(soundToggle){soundToggle.checked=localStorage.getItem("wikirace-sounds")!=="off";soundToggle.addEventListener("change",()=>localStorage.setItem("wikirace-sounds",soundToggle.checked?"on":"off"));}
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
  dailySubmitted: false,
  realSeconds:0,powerupsEnabled:false,timeFreezeStartedAt:0,timeFreezeUntil:0,timeFreezeTotalMs:0,timeFreezeUsed:false,timeFreezeRefundPending:false,clickShieldActive:false,powerupsUsed:[]
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
  $("homeTabs").classList.toggle("hidden", name === "game");
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


function levelFromXp(xp){return Math.floor(Math.sqrt(Math.max(0,Number(xp)||0)/100))+1;}
function xpForNextLevel(level){return Math.pow(Math.max(1,Number(level)||1),2)*100;}
function titleForLevel(level){if(level>=50)return "Encyclopedia Legend";if(level>=30)return "Wiki Master";if(level>=20)return "Knowledge Expert";if(level>=10)return "Page Navigator";if(level>=5)return "Article Explorer";return "Newcomer";}
function awardXp(clicks,seconds,difficulty){const bonus={easy:0,medium:5,hard:10}[difficulty]||0;return Math.max(10,20+bonus+Math.max(0,10-Number(clicks||0))+(Number(seconds||0)<=30?10:0));}
const POWERUP_CATALOG=[{id:"hint",name:"Hint",description:"Shows the first letter and word count of the destination.",cost:1},{id:"undo",name:"Undo",description:"Return to your previous article without adding a click.",cost:1},{id:"timeFreeze",name:"Time Freeze",description:"Pauses the displayed timer for 10 seconds.",cost:2},{id:"linkFinder",name:"Link Finder",description:"Highlights links related to your destination.",cost:1},{id:"clickShield",name:"Click Shield",description:"Your next article navigation will not add a click.",cost:2}];
const POWERUP_EXCHANGE_RATE=100;let powerupInventory={},spendableXp=0,gameTokens=0,powerupShopBusy=false;
function normalizeInventory(v={}){const o={};POWERUP_CATALOG.forEach(p=>o[p.id]=Math.max(0,Math.floor(Number(v?.[p.id]||0))));return o;}
async function loadPowerupWallet(){if(!currentUser){spendableXp=0;gameTokens=0;powerupInventory={};renderPowerupWallet();return;}try{const snap=await db.collection("users").doc(currentUser.uid).get(),p=snap.data()||{};spendableXp=Math.max(0,Number(p.spendableXp||0));gameTokens=Math.max(0,Number(p.gameTokens||0));powerupInventory=normalizeInventory(p.powerupInventory||{});}catch(e){console.warn(e);}renderPowerupWallet();}
function renderPowerupWallet(){const x=$("powerupSpendableXp"),t=$("powerupTokenCount");if(x)x.textContent=String(spendableXp);if(t)t.textContent=String(gameTokens);const host=$("powerupShopItems");if(!host)return;host.replaceChildren();POWERUP_CATALOG.forEach(p=>{const row=document.createElement("article");row.className="powerup-shop-item";const copy=document.createElement("div");copy.className="powerup-shop-copy";const n=document.createElement("strong");n.textContent=p.name;const d=document.createElement("p");d.textContent=p.description;const o=document.createElement("small");o.textContent="Owned: "+(powerupInventory[p.id]||0);copy.append(n,d,o);const b=document.createElement("button");b.className="secondary-button";b.type="button";b.textContent="Buy · "+p.cost+" token"+(p.cost===1?"":"s");b.disabled=!currentUser||gameTokens<p.cost||powerupShopBusy;b.onclick=()=>buyPowerup(p.id);row.append(copy,b);host.append(row);});const ex=$("exchangeXpButton");if(ex)ex.disabled=!currentUser||spendableXp<100||powerupShopBusy;}
function openPowerupShop(){if(!currentUser){authMode("signin");setToast("Sign in to earn and buy powerups.");return;}$("powerupShopModal").classList.remove("hidden");loadPowerupWallet();}
async function exchangeSpendableXp(){if(!currentUser||powerupShopBusy)return;powerupShopBusy=true;renderPowerupWallet();try{const ref=db.collection("users").doc(currentUser.uid),w=await db.runTransaction(async tx=>{const snap=await tx.get(ref),p=snap.data()||{},xp=Number(p.spendableXp||0),tokens=Number(p.gameTokens||0);if(xp<100)throw Error("You need 100 Spendable XP for 1 token.");tx.set(ref,{spendableXp:xp-100,gameTokens:tokens+1},{merge:true});return {xp:xp-100,tokens:tokens+1};});spendableXp=w.xp;gameTokens=w.tokens;setToast("Exchanged 100 Spendable XP for 1 token.");}catch(e){setToast(e.message||authError(e));}finally{powerupShopBusy=false;renderPowerupWallet();}}
async function buyPowerup(id){if(!currentUser||powerupShopBusy)return;const p=POWERUP_CATALOG.find(x=>x.id===id);if(!p)return;powerupShopBusy=true;renderPowerupWallet();try{const ref=db.collection("users").doc(currentUser.uid),w=await db.runTransaction(async tx=>{const snap=await tx.get(ref),data=snap.data()||{},tokens=Number(data.gameTokens||0);if(tokens<p.cost)throw Error("You do not have enough tokens.");const inv=normalizeInventory(data.powerupInventory||{});inv[id]++;tx.set(ref,{gameTokens:tokens-p.cost,powerupInventory:inv},{merge:true});return {tokens:tokens-p.cost,inv};});gameTokens=w.tokens;powerupInventory=w.inv;setToast(p.name+" purchased.");}catch(e){setToast(e.message||authError(e));}finally{powerupShopBusy=false;renderPowerupWallet();renderRacePowerups();}}
async function consumePowerup(id){if(!currentUser)throw Error("Sign in to use powerups.");const ref=db.collection("users").doc(currentUser.uid);powerupInventory=await db.runTransaction(async tx=>{const snap=await tx.get(ref),p=snap.data()||{},inv=normalizeInventory(p.powerupInventory||{});if(!inv[id])throw Error("You do not own this powerup.");inv[id]--;tx.set(ref,{powerupInventory:inv},{merge:true});return inv;});renderPowerupWallet();renderRacePowerups();}
function renderRacePowerups(){const host=$("racePowerups");if(!host)return;host.replaceChildren();if(!state.powerupsEnabled||state.mode==="daily"||!currentUser){host.classList.add("hidden");return;}host.classList.remove("hidden");POWERUP_CATALOG.forEach(p=>{const n=Number(powerupInventory[p.id]||0),b=document.createElement("button");b.type="button";b.className="race-powerup-button";b.textContent=p.name+" · "+n;b.title=p.description;b.disabled=n<1||state.loading||multiplayerLocalFinished||multiplayerEnded||(p.id==="timeFreeze"&&state.timeFreezeUsed)||(p.id==="undo"&&state.historyIndex<=0);b.onclick=()=>activatePowerup(p.id);host.append(b);});}
async function activatePowerup(id){if(!state.powerupsEnabled||state.mode==="daily"||!screens.game.classList.contains("active")||!currentUser)return;if(id==="undo"&&(state.historyIndex<=0||state.loading))return setToast("There is no previous article to return to.");if(id==="timeFreeze"&&state.timeFreezeUsed)return setToast("Time Freeze can only be used once per race.");if(id==="clickShield"&&state.clickShieldActive)return setToast("Click Shield is already active.");try{await consumePowerup(id);state.powerupsUsed.push(id);if(id==="hint"){const words=String(state.goal||"").trim().split(" ").filter(Boolean);setToast("Hint: the destination starts with “"+(words[0]?.charAt(0)||"?")+"” and has "+words.length+" word"+(words.length===1?"":"s")+".");}else if(id==="undo"){state.historyIndex--;await loadArticle(state.history[state.historyIndex],false);updateRoomPlayer(false,{scrollY:0,scrollPercent:0});setToast("Returned to the previous article without adding a click.");}else if(id==="timeFreeze"){state.timeFreezeUsed=true;state.timeFreezeStartedAt=Date.now();state.timeFreezeUntil=state.timeFreezeStartedAt+10000;setToast("Timer paused for 10 seconds.");}else if(id==="linkFinder"){const frame=$("articleContent").querySelector("iframe");frame?.contentWindow?.postMessage({type:"wikirace-powerup-linkfinder",goal:state.goal},"*");setToast("Looking for useful links on this article.");}else if(id==="clickShield"){state.clickShieldActive=true;setToast("Your next navigation will not count as a click.");}renderRacePowerups();}catch(e){setToast(e.message||authError(e));}}
function finishTimeFreezeAccounting(now=Date.now()){if(state.timeFreezeStartedAt){state.timeFreezeTotalMs+=Math.max(0,Math.min(10000,now-state.timeFreezeStartedAt));state.timeFreezeStartedAt=0;state.timeFreezeUntil=0;}}
function resetRacePowerups(enabled=false){state.powerupsEnabled=!!enabled;state.timeFreezeStartedAt=0;state.timeFreezeUntil=0;state.timeFreezeTotalMs=0;state.timeFreezeUsed=false;state.timeFreezeRefundPending=false;state.clickShieldActive=false;state.powerupsUsed=[];renderRacePowerups();}

function getDailyBonus(){const day=Math.floor(Date.now()/86400000),challenges=[{title:"Quick Finish",description:"Finish any race in under 60 seconds for +30 XP.",test:(c,s)=>s<60},{title:"Efficient Explorer",description:"Reach the destination in 8 clicks or fewer for +30 XP.",test:(c)=>c<=8},{title:"Hard Mode Hero",description:"Complete a Hard race for +30 XP.",test:(c,s,d)=>d==="hard"},{title:"Speed Reader",description:"Finish in 30 seconds or less for +30 XP.",test:(c,s)=>s<=30}];return challenges[day%challenges.length];}
function renderDailyBonus(claimed=false){const challenge=getDailyBonus();const title=$("dailyBonusTitle"),description=$("dailyBonusDescription"),status=$("dailyBonusStatus"),card=$("dailyBonusCard");if(title)title.textContent=challenge.title;if(description)description.textContent=challenge.description;if(status){status.textContent=claimed?"DONE":"NOT COMPLETE";status.classList.toggle("is-done",claimed);}if(card)card.classList.toggle("is-complete",claimed);}

function renderProgression(profile={}){const xp=Number(profile.xp||0),level=levelFromXp(xp),floor=xpForNextLevel(level-1),ceil=xpForNextLevel(level),pct=Math.max(0,Math.min(100,(xp-floor)/(ceil-floor)*100));const el=$("profileLevel");if(el)el.textContent="Level "+level;const label=$("profileXp");if(label)label.textContent=xp+" XP · "+Math.max(0,ceil-xp)+" to next level";const bar=$("profileXpBar");if(bar)bar.style.width=pct+"%";const title=$("profileTitleLabel");if(title)title.textContent=profile.customTitle||titleForLevel(level);}
function playRaceSound(kind){try{if(localStorage.getItem("wikirace-sounds")==="off")return;const C=window.AudioContext||window.webkitAudioContext;if(!C)return;const ctx=new C(),osc=ctx.createOscillator(),gain=ctx.createGain(),now=ctx.currentTime;const tone={click:[520,.04],win:[760,.14],level:[920,.2],start:[640,.08]}[kind]||[520,.04];osc.connect(gain);gain.connect(ctx.destination);osc.frequency.setValueAtTime(tone[0],now);osc.frequency.exponentialRampToValueAtTime(tone[0]*1.35,now+tone[1]);gain.gain.setValueAtTime(.05,now);gain.gain.exponentialRampToValueAtTime(.001,now+tone[1]);osc.start(now);osc.stop(now+tone[1]);osc.onended=()=>ctx.close();}catch(error){}}
function renderProfileFavorites(profile={}){const host=$("profileFavorites");if(!host)return;host.replaceChildren();const items=Array.isArray(profile.favoriteArticles)?profile.favoriteArticles:[];if(!items.length){const p=document.createElement("p");p.className="profile-empty";p.textContent="No favorites yet. Use ☆ Favorite while viewing a Wikipedia article.";host.append(p);return;}items.forEach(title=>{const a=document.createElement("a");a.href="https://en.wikipedia.org/wiki/"+encodeURIComponent(title.replace(/ /g,"_"));a.target="_blank";a.rel="noopener noreferrer";a.textContent=title;host.append(a);});}
async function toggleFavoriteArticle(){if(!currentUser)return authMode("signin");const title=state.current;if(!title)return;const ref=db.collection("users").doc(currentUser.uid);try{const snap=await ref.get(),p=snap.data()||{},items=Array.isArray(p.favoriteArticles)?p.favoriteArticles:[],exists=items.includes(title),next=exists?items.filter(x=>x!==title):[...items,title].slice(-30);await ref.set({favoriteArticles:next},{merge:true});await db.collection("publicProfiles").doc(currentUser.uid).set({favoriteArticles:next},{merge:true});const b=$("favoriteArticleButton");b.textContent=next.includes(title)?"★ Saved":"☆ Favorite";b.classList.toggle("is-favorite",next.includes(title));setToast(exists?"Removed from favorites.":"Added to favorites.");}catch(error){setToast(authError(error));}}
async function loadLeaderboard(kind="global"){const host=$("leaderboardRows");if(!host)return;host.replaceChildren();const loading=document.createElement("li");loading.className="board-empty";loading.textContent="Loading rankings…";host.append(loading);try{let profiles=[];if(kind==="friends"){if(!currentUser)throw new Error("Sign in to view your friends leaderboard.");const links=await db.collection("friendships").where("members","array-contains",currentUser.uid).get();const ids=links.docs.map(d=>(d.data().members||[]).find(x=>x!==currentUser.uid)).filter(Boolean);ids.push(currentUser.uid);const docs=await Promise.all(ids.map(id=>db.collection("publicProfiles").doc(id).get()));profiles=docs.filter(d=>d.exists).map(d=>d.data());}else{const field=kind==="streaks"?"longestStreak":"xp";const snap=await db.collection("publicProfiles").orderBy(field,"desc").limit(50).get();profiles=snap.docs.map(d=>d.data());}profiles.sort((a,b)=>kind==="streaks"?Number(b.longestStreak||0)-Number(a.longestStreak||0):Number(b.xp||0)-Number(a.xp||0));host.replaceChildren();if(!profiles.length){const li=document.createElement("li");li.className="board-empty";li.textContent="No rankings yet.";host.append(li);return;}profiles.slice(0,25).forEach((p,i)=>{const li=document.createElement("li");li.className="leaderboard-row";const rank=document.createElement("strong");rank.textContent="#"+(i+1);const name=document.createElement("span");name.textContent=p.username||"WikiRace player";const score=document.createElement("b");score.textContent=kind==="streaks"?Number(p.longestStreak||0)+" days":Number(p.xp||0)+" XP · Lv "+levelFromXp(p.xp||0);li.append(rank,name,score);host.append(li);});}catch(error){host.replaceChildren();const li=document.createElement("li");li.className="board-empty";li.textContent=error.message||authError(error);host.append(li);}}
function openLeaderboard(kind="global"){$("leaderboardModal").classList.remove("hidden");document.querySelectorAll("[data-board-tab]").forEach(b=>b.classList.toggle("active",b.dataset.boardTab===kind));loadLeaderboard(kind);}

function updateStats() {
  const favorite=$("favoriteArticleButton");if(favorite&&state.current){favorite.classList.remove("hidden");favorite.textContent="☆ Favorite";if(currentUser)db.collection("users").doc(currentUser.uid).get().then(s=>{const saved=(s.data()?.favoriteArticles||[]).includes(state.current);favorite.textContent=saved?"★ Saved":"☆ Favorite";favorite.classList.toggle("is-favorite",saved);}).catch(()=>{});}
  $("timer").textContent = formatTime(state.seconds);
  $("clickCount").textContent = String(state.clicks);
  const best = localStorage.getItem("wikirace-best-" + (state.mode === "daily" ? "daily" : state.difficulty));
  $("bestScore").textContent = best || "—";
}

function startTimer() {
  window.clearInterval(state.timerInterval);
  state.startedAt = Date.now();
  state.seconds=0;state.realSeconds=0;
  state.timerInterval=window.setInterval(()=>{
    const now=Date.now();
    if(state.timeFreezeStartedAt&&now>=state.timeFreezeUntil)finishTimeFreezeAccounting(state.timeFreezeUntil);
    state.realSeconds=Math.floor((now-state.startedAt)/1000);
    const frozen=state.timeFreezeTotalMs+(state.timeFreezeStartedAt?Math.max(0,Math.min(10000,now-state.timeFreezeStartedAt)):0);
    state.seconds=Math.floor(Math.max(0,now-state.startedAt-frozen)/1000);
    $("timer").textContent = formatTime(state.seconds);
    if(state.mode==="multiplayer" && state.realSeconds%2===0 && state.realSeconds!==lastRoomProgressSecond && !multiplayerLocalFinished && !multiplayerEnded){
      lastRoomProgressSecond=state.realSeconds;
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
    while(articleHtmlCache.size>32)articleHtmlCache.delete(articleHtmlCache.keys().next().value);
    return html;
  })();
  articleHtmlPending.set(key,request);
  try{return await request;}finally{articleHtmlPending.delete(key);}
}
const articlePrefetchQueue = [];
const articlePrefetchQueued = new Set();
let articlePrefetchActive = 0;
function prefetchArticle(title){
  if(!title)return;
  const key=normaliseTitle(title);
  if(articleHtmlCache.has(key)||articleHtmlPending.has(key)||articlePrefetchQueued.has(key))return;
  articlePrefetchQueued.add(key);
  articlePrefetchQueue.push({title,key});
  pumpArticlePrefetchQueue();
}
function pumpArticlePrefetchQueue(){
  while(articlePrefetchActive<3&&articlePrefetchQueue.length){
    const item=articlePrefetchQueue.shift();
    articlePrefetchActive++;
    getArticleHtml(item.title).catch(()=>{}).finally(()=>{
      articlePrefetchActive--;
      articlePrefetchQueued.delete(item.key);
      pumpArticlePrefetchQueue();
    });
  }
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
    const stylesheetLinks = prepared.stylesheets.map(href => '<link rel="preload" as="style" href="' + href.replace(/&/g, "&amp;").replace(/"/g, "&quot;") + '" onload="this.onload=null;this.rel=\'stylesheet\'">').join("");
    const articleMarkup = prepared.wrapper.outerHTML;
    frame.srcdoc = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' + stylesheetLinks + '<style>html,body{margin:0;padding:0;background:#fff;color:#202122;font-family:Arial,Helvetica,sans-serif}body{padding:24px clamp(18px,4vw,48px) 48px;box-sizing:border-box}.mw-body{max-width:none!important;margin:0 auto!important}.mw-body-content{font-family:Arial,Helvetica,sans-serif}img{max-width:100%;height:auto}</style></head><body>' + articleMarkup + '<script>function reportHeight(){parent.postMessage({type:"wikirace-height",height:Math.ceil(document.documentElement.scrollHeight)},"*")}const heightObserver=new ResizeObserver(reportHeight);heightObserver.observe(document.documentElement);window.addEventListener("load",reportHeight);function prefetchNearbyArticles(){Array.from(document.querySelectorAll("a[data-wiki-title]")).slice(0,12).forEach(function(a){if(!a.dataset.prefetched){a.dataset.prefetched="1";parent.postMessage({type:"wikirace-prefetch",title:a.dataset.wikiTitle},"*");}})}prefetchNearbyArticles();document.addEventListener("pointerover",function(e){const a=e.target.closest("a[data-wiki-title]");if(a&&!a.dataset.prefetched){a.dataset.prefetched="1";parent.postMessage({type:"wikirace-prefetch",title:a.dataset.wikiTitle},"*");}});document.addEventListener("click",function(e){const a=e.target.closest("a[data-wiki-title]");if(a){e.preventDefault();parent.postMessage({type:"wikirace-navigation",title:a.dataset.wikiTitle},"*");}});window.addEventListener("message",function(e){var d=e.data||{};if(d.type!=="wikirace-powerup-linkfinder")return;var words=String(d.goal||"").toLowerCase().split(/[^a-z0-9]+/).filter(function(w){return w.length>2&&!["the","and","for","with","from","into","that"].includes(w)});var links=Array.from(document.querySelectorAll("a[data-wiki-title]"));var matched=links.filter(function(a){var t=(a.dataset.wikiTitle+" "+a.textContent).toLowerCase();return words.some(function(w){return t.includes(w)});});var targets=matched.length?matched:links;var style=document.getElementById("wikirace-powerup-style");if(!style){style=document.createElement("style");style.id="wikirace-powerup-style";document.head.appendChild(style);}style.textContent="a.wikirace-powerup-match{outline:3px solid #f0b429!important;background:#fff3b0!important;color:#202122!important}";targets.forEach(function(a){a.classList.add("wikirace-powerup-match");});});reportHeight();' +
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
    resetRacePowerups(false);
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
  finishTimeFreezeAccounting();
  state.realSeconds=Math.floor((Date.now()-state.startedAt)/1000);
  const displaySeconds=state.seconds,raceSeconds=state.realSeconds||state.seconds;
  state.timeFreezeRefundPending=state.timeFreezeUsed&&((displaySeconds<=10&&raceSeconds>10)||(displaySeconds<=30&&raceSeconds>30)||(displaySeconds<60&&raceSeconds>=60));
  state.seconds=raceSeconds;
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
  const freezeNotice=$("timeFreezeNotice");if(freezeNotice){freezeNotice.textContent=state.timeFreezeRefundPending?"Time Freeze refunded. Your real time was used for rewards and records.":"";freezeNotice.classList.toggle("hidden",!state.timeFreezeRefundPending);}
  const guestPrompt=$("guestSignupPrompt");
  guestPrompt?.classList.toggle("hidden",!!currentUser || state.mode==="daily" || state.mode==="multiplayer");
  if(!currentUser && state.mode!=="daily" && state.mode!=="multiplayer")saveGuestRaceStats();
  $("multiplayerResults")?.classList.toggle("hidden",state.mode!=="multiplayer");
  $("playAgainButton").classList.toggle("hidden",state.mode==="multiplayer");
  $("homeButton").textContent=state.mode==="multiplayer"?"Leave game":"Back to home";
  showScreen("win");
  launchConfetti();
  playRaceSound("win");
  if(state.mode==="multiplayer"){
    updateRoomPlayer(true);
    renderMultiplayerResults();
  }
  if(currentUser) {
    const userId=currentUser.uid;
    const raceSeconds=state.realSeconds||state.seconds;
    const raceClicks=state.clicks;
    const baseXp=awardXp(raceClicks,raceSeconds,state.difficulty);
    const bonusDate=utcDateKey();
    const bonusEligible=state.mode==="solo"&&getDailyBonus().test(raceClicks,raceSeconds,state.difficulty);
    const profileRef=db.collection("users").doc(userId);
    db.runTransaction(async transaction=>{
      const snapshot=await transaction.get(profileRef);
      const profile=snapshot.data()||{};
      transaction.set(profileRef,{
        races:Number(profile.races||0)+1,
        wins:Number(profile.wins||0)+1,
        xp:Number(profile.xp||0)+baseXp+(bonusEligible&&profile.dailyBonusClaimedDate!==bonusDate?30:0),
        spendableXp:Number(profile.spendableXp||0)+baseXp+(bonusEligible&&profile.dailyBonusClaimedDate!==bonusDate?30:0),
        ...(state.timeFreezeRefundPending?{powerupInventory:{...normalizeInventory(profile.powerupInventory||{}),timeFreeze:normalizeInventory(profile.powerupInventory||{}).timeFreeze+1}}:{}),
        ...(bonusEligible&&profile.dailyBonusClaimedDate!==bonusDate?{dailyBonusClaimedDate:bonusDate}:{}),
        bestRaceTime:profile.bestRaceTime==null?raceSeconds:Math.min(Number(profile.bestRaceTime),raceSeconds),
        fewestRaceClicks:profile.fewestRaceClicks==null?raceClicks:Math.min(Number(profile.fewestRaceClicks),raceClicks),
        raceHistory:[...(Array.isArray(profile.raceHistory)?profile.raceHistory:[]),{date:new Date().toISOString(),start:state.start,goal:state.goal,clicks:raceClicks,seconds:raceSeconds,difficulty:state.difficulty||"standard",mode:state.mode||"solo"}].slice(-50),
        lastRaceAt:firebase.firestore.FieldValue.serverTimestamp()
      },{merge:true});
    }).then(()=>profileRef.get()).then(async snapshot=>{
      const profile=snapshot.data()||{};
      renderProfileProgress(profile);renderProgression(profile);renderDailyBonus(profile.dailyBonusClaimedDate===bonusDate);if(state.timeFreezeRefundPending)setToast("Time Freeze refunded because it would have changed a time-based reward.");loadPowerupWallet();
      await db.collection("publicProfiles").doc(userId).set({
        uid:userId,username:currentUsername,races:Number(profile.races||0),wins:Number(profile.wins||0),xp:Number(profile.xp||0),longestStreak:Number(profile.longestStreak||0),customTitle:profile.customTitle||"",
        bestRaceTime:profile.bestRaceTime??null,fewestRaceClicks:profile.fewestRaceClicks??null,
        raceHistory:Array.isArray(profile.raceHistory)?profile.raceHistory.slice(-50):[],favoriteArticles:Array.isArray(profile.favoriteArticles)?profile.favoriteArticles.slice(-30):[],
        currentStreak:Number(profile.currentStreak||0),longestStreak:Number(profile.longestStreak||0),
        totalDailyRuns:Number(profile.totalDailyRuns||0),dailyHistory:Array.isArray(profile.dailyHistory)?profile.dailyHistory.slice(0,60):[],
        streakBadges:profile.streakBadges||[],profileFrame:profile.profileFrame||"none",createdAt:profile.createdAt||null
      },{merge:true});
    }).catch(error=>console.warn("Could not update race records:",error));
  }
  if(state.mode==="daily")saveDailyResult();
}
function saveGuestRaceStats(){
  try{
    const previous=JSON.parse(localStorage.getItem(GUEST_STATS_KEY)||"{}");
    const stats={
      races:Number(previous.races||0)+1,
      wins:Number(previous.wins||0)+1,
      bestRaceTime:previous.bestRaceTime==null?state.seconds:Math.min(Number(previous.bestRaceTime),state.seconds),
      fewestRaceClicks:previous.fewestRaceClicks==null?state.clicks:Math.min(Number(previous.fewestRaceClicks),state.clicks)
    };
    localStorage.setItem(GUEST_STATS_KEY,JSON.stringify(stats));
  }catch(error){console.warn("Could not save guest race stats:",error);}
}
async function claimGuestRaceStats(user){
  let guest;
  try{guest=JSON.parse(localStorage.getItem(GUEST_STATS_KEY)||"null");}catch(error){return;}
  if(!guest||!Number(guest.races))return;
  const profileRef=db.collection("users").doc(user.uid);
  await db.runTransaction(async transaction=>{
    const snapshot=await transaction.get(profileRef);
    const profile=snapshot.data()||{};
    transaction.set(profileRef,{
      races:Number(profile.races||0)+Number(guest.races||0),
      wins:Number(profile.wins||0)+Number(guest.wins||0),
      bestRaceTime:profile.bestRaceTime==null?guest.bestRaceTime:Math.min(Number(profile.bestRaceTime),Number(guest.bestRaceTime)),
      fewestRaceClicks:profile.fewestRaceClicks==null?guest.fewestRaceClicks:Math.min(Number(profile.fewestRaceClicks),Number(guest.fewestRaceClicks))
    },{merge:true});
  });
  localStorage.removeItem(GUEST_STATS_KEY);
  const updated=await profileRef.get();
  renderProfileProgress(updated.data()||{});
}
function closeOpponentFinishedPrompt(){
  $("opponentFinishedModal").classList.add("hidden");
}
function showOpponentFinishedPrompt(opponent){
  if(!opponent||multiplayerLocalFinished||multiplayerEnded||opponentFinishPromptedFor.has(opponent.uid))return;
  opponentFinishPromptedFor.add(opponent.uid);
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

async function spectateRoomByCode(){if(!currentUser)return authMode("signin");const code=$("spectateCodeInput").value.trim().toUpperCase();if(!/^[A-HJ-NP-Z2-9]{6}$/.test(code))return setToast("Enter a valid 6-character race code.");try{const found=await db.collection("rooms").where("code","==",code).limit(1).get();const roomDoc=found.docs.find(d=>d.data().status==="racing");if(!roomDoc)return setToast("No active race was found with that code.");if(spectatorPlayersUnsubscribe)spectatorPlayersUnsubscribe();const room=roomDoc.data();$("spectatorRoute").textContent=room.start+" → "+room.goal+" · "+String(room.difficulty||"").toUpperCase();$("spectatorModal").classList.remove("hidden");const host=$("spectatorPlayers");host.innerHTML='<p class="board-empty">Loading racers…</p>';spectatorPlayersUnsubscribe=roomDoc.ref.collection("players").onSnapshot(snapshot=>{host.replaceChildren();const players=snapshot.docs.map(d=>d.data()).sort((a,b)=>Number(a.clicks||0)-Number(b.clicks||0)||Number(a.seconds||0)-Number(b.seconds||0));if(!players.length){const p=document.createElement("p");p.className="board-empty";p.textContent="No racers are visible.";host.append(p);return;}players.forEach((player,index)=>{const row=document.createElement("div");row.className="spectator-player";const rank=document.createElement("strong");rank.textContent="#"+(index+1);const info=document.createElement("div");info.className="spectator-player-info";const name=document.createElement("b");name.textContent=player.username||"Player";const current=document.createElement("span");current.textContent=player.finished?"Reached the destination":player.ended?"Left the race":"At: "+(player.current||"Starting");info.append(name,current);const stats=document.createElement("small");stats.textContent=Number(player.clicks||0)+" clicks · "+formatTime(Number(player.seconds||0));row.append(rank,info,stats);host.append(row);});},error=>setToast(authError(error)));}catch(error){setToast(authError(error));}}
function closeSpectator(){if(spectatorPlayersUnsubscribe)spectatorPlayersUnsubscribe();spectatorPlayersUnsubscribe=null;$("spectatorModal").classList.add("hidden");}

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
  if(rematchStarting||!activeRoom||activeRoom.hostUid!==currentUser?.uid||activeRoom.status!=="racing"||players.length<2||!players.every(p=>p.rematch===true))return;
  rematchStarting=true;
  try{await activeRoomRef().update({status:"waiting",startedAt:null,start:"",goal:"",rematchAt:firebase.firestore.FieldValue.serverTimestamp()});}
  catch(error){setToast(authError(error));}
  finally{rematchStarting=false;}
}
async function resetPlayerForRematch(){
  if(rematchResetInProgress||!activeRoom||!currentUser)return;
  rematchResetInProgress=true;
  try{
    await activeRoomRef().collection("players").doc(currentUser.uid).update({ready:false,finished:false,ended:false,rematch:false,clicks:0,seconds:0,current:"",finishedAt:firebase.firestore.FieldValue.delete(),endedAt:firebase.firestore.FieldValue.delete()});
    multiplayerLocalFinished=false;multiplayerEnded=false;opponentFinishPromptedFor=new Set();opponentDisconnectNotified=false;lastRoomProgressSecond=-1;
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
    if(value!==previous){
      label.textContent=value;
      label.className="count-"+(value==="GO!"?"go":value);
      overlay.dataset.step=value==="GO!"?"go":value;
      previous=value;
    }
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
    resetRacePowerups($("soloPowerupsEnabled")?.checked!==false);
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


function leaveRace() {
  if (activeRoomCode) leaveRoom();
  stopTimer();
  if (state.requestController) state.requestController.abort();
  state.loading = false;
  showScreen("home");
}

let activeHomeTab = "solo";
function setHomeTab(tab) {
  if (tab === activeHomeTab) return;
  const tabOrder = { solo: 0, multiplayer: 1, daily: 2 };
  const direction = tabOrder[tab] > tabOrder[activeHomeTab] ? "right" : "left";
  activeHomeTab = tab;

  const multiplayer = tab === "multiplayer";
  const daily = tab === "daily";
  $("homeScreen").classList.toggle("show-multiplayer", multiplayer);
  $("homeScreen").classList.toggle("show-daily", daily);
  $("soloTab").classList.toggle("active", !multiplayer && !daily);
  $("multiplayerTab").classList.toggle("active", multiplayer);
  $("dailyTab").classList.toggle("active", daily);
  $("soloTab").setAttribute("aria-selected", String(!multiplayer && !daily));
  $("multiplayerTab").setAttribute("aria-selected", String(multiplayer));
  $("dailyTab").setAttribute("aria-selected", String(daily));
  $("soloTabPanel").setAttribute("aria-hidden", String(multiplayer || daily));
  $("accountPanel").setAttribute("aria-hidden", String(!multiplayer));
  $("dailyPanel").setAttribute("aria-hidden", String(!daily));

  // Use the Web Animations API so the transition does not depend on CSS animation classes.
  const activeView = daily ? $("dailyPanel") : $("homeScreen").querySelector(".hero");
  activeView.classList.remove("tab-swipe-from-left", "tab-swipe-from-right");
  if (activeView && typeof activeView.animate === "function") {
    activeView.animate(
      direction === "right"
        ? [
            { opacity: 0.35, transform: "translateX(110px)" },
            { opacity: 1, transform: "translateX(0)" }
          ]
        : [
            { opacity: 0.35, transform: "translateX(-110px)" },
            { opacity: 1, transform: "translateX(0)" }
          ],
      { duration: 520, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
    );
  }

  window.scrollTo({ top: 0, behavior: "instant" });
}
$("soloTab").addEventListener("click", () => setHomeTab("solo"));
$("multiplayerTab").addEventListener("click", () => setHomeTab("multiplayer"));
$("dailyTab").addEventListener("click", () => setHomeTab("daily"));

document.querySelectorAll(".difficulty-option").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".difficulty-option").forEach(item => item.classList.remove("selected"));
    button.classList.add("selected");
    state.difficulty = button.dataset.difficulty;
  });
});

$("startButton").addEventListener("click", handleStartAction);
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
    if(state.clickShieldActive)state.clickShieldActive=false;else state.clicks += 1;
    state.current = title;
    updateStats();
    finishRace();
    return;
  }
  recordArticleVisit(title);
  const countThisClick=!state.clickShieldActive;state.clickShieldActive=false;
  await loadArticle(title, countThisClick);
  updateRoomPlayer(false,{scrollY:0,scrollPercent:0});
});

updateStats();
$("powerupShopButton")?.addEventListener("click",openPowerupShop);
$("powerupShopClose")?.addEventListener("click",()=>$("powerupShopModal").classList.add("hidden"));
$("powerupShopModal")?.addEventListener("click",e=>{if(e.target===$("powerupShopModal"))$("powerupShopModal").classList.add("hidden");});
$("exchangeXpButton")?.addEventListener("click",exchangeSpendableXp);
$("soloPowerupsEnabled")?.addEventListener("change",()=>localStorage.setItem("wikirace-powerups-enabled",String($("soloPowerupsEnabled").checked)));
$("multiplayerPowerupsEnabled")?.addEventListener("change",()=>localStorage.setItem("wikirace-multiplayer-powerups-enabled",String($("multiplayerPowerupsEnabled").checked)));
if($("soloPowerupsEnabled"))$("soloPowerupsEnabled").checked=localStorage.getItem("wikirace-powerups-enabled")!=="false";
if($("multiplayerPowerupsEnabled"))$("multiplayerPowerupsEnabled").checked=localStorage.getItem("wikirace-multiplayer-powerups-enabled")!=="false";
$("favoriteArticleButton")?.addEventListener("click",toggleFavoriteArticle);
$("leaderboardButton")?.addEventListener("click",()=>openLeaderboard("global"));
$("leaderboardClose")?.addEventListener("click",()=>$("leaderboardModal").classList.add("hidden"));
$("leaderboardModal")?.addEventListener("click",e=>{if(e.target===$("leaderboardModal"))$("leaderboardModal").classList.add("hidden")});
document.querySelectorAll("[data-board-tab]").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll("[data-board-tab]").forEach(x=>x.classList.toggle("active",x===b));loadLeaderboard(b.dataset.boardTab)}));

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
let opponentFinishPromptedFor = new Set();
let opponentDisconnectNotified = false;
let rematchStarting = false;
let lastRoomProgressSecond = -1;
let roomPresenceUnsubs = new Map();
let roomPresenceStates = new Map();
let rematchResetInProgress = false;
let matchmakingUnsubscribe = null;
let matchmakingInterval = null;
let matchmakingRef = null;
let matchmakingActive = false;
let matchmakingJoining = false;
let matchmakingAttemptInProgress = false;
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
  $("topFriendsButton").classList.toggle("hidden",!currentUser);
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
  renderProfileProgress(profile);renderProgression(profile);renderDailyBonus(profile.dailyBonusClaimedDate===utcDateKey());
  await db.collection("publicProfiles").doc(user.uid).set({
    uid:user.uid,username:currentUsername,
    races:Number(profile.races||0),wins:Number(profile.wins||0),xp:Number(profile.xp||0),longestStreak:Number(profile.longestStreak||0),customTitle:profile.customTitle||"",
    bestRaceTime:profile.bestRaceTime??null,fewestRaceClicks:profile.fewestRaceClicks??null,
    currentStreak:Number(profile.currentStreak||0),longestStreak:Number(profile.longestStreak||0),
    totalDailyRuns:Number(profile.totalDailyRuns||0),raceHistory:Array.isArray(profile.raceHistory)?profile.raceHistory.slice(-50):[],dailyHistory:Array.isArray(profile.dailyHistory)?profile.dailyHistory.slice(0,60):[],streakBadges:profile.streakBadges||[],
    profileFrame:profile.profileFrame||"none",profileBio:profile.profileBio||"",photoDataUrl:profile.photoDataUrl||"",favoriteArticles:Array.isArray(profile.favoriteArticles)?profile.favoriteArticles.slice(-30):[],createdAt:profile.createdAt||null
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
  if(user)$("guestSignupPrompt")?.classList.add("hidden");
  currentUsername = "";
  renderAccount();
  if (user) { try { await profileFor(user); await claimGuestRaceStats(user); listenForGameInvites(); startPresenceTracking(); } catch(e) { setToast(authError(e)); } }
  else { if(matchmakingActive)cancelRandomMatch(false); if(presenceHeartbeat)clearInterval(presenceHeartbeat); presenceHeartbeat=null; document.removeEventListener("visibilitychange",handlePresenceVisibility); stopFriendPresenceListeners(); if(inviteUnsubscribe)inviteUnsubscribe(); inviteUnsubscribe=null; $("gameInviteNotifications").replaceChildren(); detachRoomListeners(); activeRoom=null; activeRoomCode=""; $("roomStatus").classList.add("hidden"); }
  renderAccount();
  if(user)loadPowerupWallet();else{powerupInventory={};spendableXp=0;gameTokens=0;renderPowerupWallet();}
  if(!user)renderDailyBonus(false);
  loadDailyChallenge();
});
$("accountButton").addEventListener("click",()=>currentUser ? openProfile(currentUser.uid,currentUsername,true) : authMode("signin"));
$("topFriendsButton").addEventListener("click",openFriends);
$("profileClose").addEventListener("click",()=>$("profileModal").classList.add("hidden"));
$("profileBlockButton")?.addEventListener("click",blockViewedProfile);$("profileReportButton")?.addEventListener("click",reportViewedProfile);
$("profileEditButton").addEventListener("click",async()=>{
 try{const snap=await db.collection("users").doc(currentUser.uid).get();openProfileSettings(snap.data()||{});}
 catch(error){setToast(authError(error));}
});
$("profileSettingsCancel").addEventListener("click",()=>$("profileSettingsPanel").classList.add("hidden"));
$("settingsPhotoFile").addEventListener("change",async()=>{
 const file=$("settingsPhotoFile").files?.[0];if(!file)return;
 try{pendingProfilePhoto=await imageFileToDataUrl(file);$("settingsPhotoPreview").style.backgroundImage='url("'+pendingProfilePhoto+'")';$("settingsPhotoPreview").textContent="";}
 catch(error){$("profileSettingsMessage").textContent=error.message;$("settingsPhotoFile").value="";}
});
$("removeProfilePhotoButton").addEventListener("click",()=>{
 pendingProfilePhoto=false;$("settingsPhotoPreview").style.backgroundImage="";$("settingsPhotoPreview").textContent=($("settingsUsername").value||"W").trim().charAt(0).toUpperCase();$("settingsPhotoFile").value="";
});
$("saveProfileSettingsButton").addEventListener("click",saveProfileSettings);
$("profileModal").addEventListener("click",e=>{if(e.target===$("profileModal"))$("profileModal").classList.add("hidden");});
document.querySelectorAll("[data-friends-tab]").forEach(button=>button.addEventListener("click",()=>setFriendsTab(button.dataset.friendsTab)));
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
function setFriendsTab(tab){
  document.querySelectorAll("[data-friends-tab]").forEach(button=>button.classList.toggle("active",button.dataset.friendsTab===tab));
  $("friendsFindView").classList.toggle("active",tab==="find");
  $("friendsRequestsView").classList.toggle("active",tab==="requests");
  $("friendsListView").classList.toggle("active",tab==="friends");
}
let profileChartType="line";
let profilePeriod="day";
let profilePeriodOffset=0;
function shiftProfileDate(date,amount,unit){
 const d=new Date(date);
 if(unit==="month")d.setMonth(d.getMonth()+amount);
 else d.setDate(d.getDate()+amount);
 return d;
}
function profileWeekStart(date){
 const d=new Date(date.getFullYear(),date.getMonth(),date.getDate());
 d.setDate(d.getDate()-((d.getDay()+6)%7));d.setHours(0,0,0,0);return d;
}
function renderProfileLineChart(history){
 const host=$("profileRaceChart");if(!host)return;host.replaceChildren();
 const now=new Date();let start,end,buckets=[],label="";const fmt={month:"short",day:"numeric"};
 if(profilePeriod==="day"){
  start=new Date(now.getFullYear(),now.getMonth(),now.getDate());start=shiftProfileDate(start,profilePeriodOffset,"day");end=shiftProfileDate(start,1,"day");
  label=profilePeriodOffset===0?"Today":start.toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"});
  buckets=Array.from({length:24},(_,i)=>({key:i,label:i===0?"12 AM":i<12?i+" AM":i===12?"12 PM":(i-12)+" PM",clicks:[],seconds:[],races:[]}));
 }else if(profilePeriod==="week"){
  start=shiftProfileDate(profileWeekStart(now),profilePeriodOffset*7,"day");end=shiftProfileDate(start,7,"day");
  label=profilePeriodOffset===0?"This week":start.toLocaleDateString(undefined,fmt)+" – "+shiftProfileDate(end,-1,"day").toLocaleDateString(undefined,fmt);
  buckets=Array.from({length:7},(_,i)=>({key:i,label:shiftProfileDate(start,i,"day").toLocaleDateString(undefined,{weekday:"short"}),clicks:[],seconds:[],races:[]}));
 }else{
  start=new Date(now.getFullYear(),now.getMonth()+profilePeriodOffset,1);end=new Date(start.getFullYear(),start.getMonth()+1,1);
  label=profilePeriodOffset===0?"This month":start.toLocaleDateString(undefined,{month:"long",year:"numeric"});
  buckets=Array.from({length:end.getDate()},(_,i)=>({key:i,label:String(i+1),clicks:[],seconds:[],races:[]}));
 }
 $("profileWeekLabel").textContent=label;
 $("profileWeekNext").disabled=profilePeriodOffset>=0;
 history.forEach(r=>{
  const date=r.date?new Date(r.date):null;
  if(!date||!Number.isFinite(date.getTime())||date<start||date>=end||!Number.isFinite(Number(r.clicks)))return;
  let index;
  if(profilePeriod==="day")index=date.getHours();
  else if(profilePeriod==="week")index=Math.floor((new Date(date.getFullYear(),date.getMonth(),date.getDate())-start)/86400000);
  else index=date.getDate()-1;
  if(index>=0&&index<buckets.length){
   buckets[index].clicks.push(Number(r.clicks));
   if(Number.isFinite(Number(r.seconds)))buckets[index].seconds.push(Number(r.seconds));
   buckets[index].races.push(r);
  }
 });
 const values=buckets.map(d=>d.clicks.length?d.clicks.reduce((a,b)=>a+b,0)/d.clicks.length:0);
 const total=buckets.reduce((n,d)=>n+d.races.length,0);
 const avg=total?Math.round(buckets.reduce((n,d)=>n+d.clicks.reduce((a,b)=>a+b,0),0)/total*10)/10:null;
 const summary=document.createElement("div");summary.className="profile-week-summary";
 summary.innerHTML='<span><strong>'+total+'</strong> races</span><span><strong>'+(avg===null?"—":avg)+'</strong> avg. clicks</span>';
 host.appendChild(summary);
 if(!total){const empty=document.createElement("p");empty.className="profile-empty";empty.textContent="No completed races in this "+profilePeriod+".";host.appendChild(empty);return;}
 const w=720,h=220,pad=34,ns="http://www.w3.org/2000/svg",max=Math.max(5,...values);
 const svg=document.createElementNS(ns,"svg");svg.setAttribute("viewBox",`0 0 ${w} ${h}`);svg.setAttribute("role","img");svg.setAttribute("aria-label","Race performance by "+profilePeriod);
 [0,1,2,3].forEach(i=>{const line=document.createElementNS(ns,"line"),y=pad+i*(h-pad*2)/3;line.setAttribute("x1",pad);line.setAttribute("x2",w-pad);line.setAttribute("y1",y);line.setAttribute("y2",y);line.setAttribute("class","profile-chart-gridline");svg.appendChild(line);});
 const x=i=>pad+(i+.5)*(w-pad*2)/buckets.length;
 if(profilePeriod==="day"&&profileChartType==="line"){
  const addSeries=(key,className,labelText)=>{
   const raw=buckets.map(d=>d[key].length?d[key].reduce((a,b)=>a+b,0)/d[key].length:null);
   const present=raw.map((v,i)=>v===null?-1:i).filter(i=>i>=0);
   if(!present.length)return;
   const first=present[0],last=present[present.length-1],maxValue=Math.max(1,...present.map(i=>raw[i]));
   const points=[];
   for(let i=first;i<=last;i++){
    let value=raw[i];
    if(value===null){
     let before=i-1,after=i+1;while(before>=first&&raw[before]===null)before--;while(after<=last&&raw[after]===null)after++;
     if(before<first||after>last)continue;
     value=raw[before]+(raw[after]-raw[before])*(i-before)/(after-before);
    }
    points.push({x:x(i),y:h-pad-(value/maxValue)*(h-pad*2),hour:i,value});
   }
   const path=document.createElementNS(ns,"path");path.setAttribute("d",points.map((p,i)=>(i?"L":"M")+p.x+" "+p.y).join(" "));path.setAttribute("class","profile-chart-line "+className);svg.appendChild(path);
   present.forEach(i=>{
    const p=points.find(point=>point.hour===i);if(!p)return;
    const dot=document.createElementNS(ns,"circle");dot.setAttribute("cx",p.x);dot.setAttribute("cy",p.y);dot.setAttribute("r",4.5);dot.setAttribute("class","profile-chart-dot "+className);
    const title=document.createElementNS(ns,"title");title.textContent=buckets[i].label+": "+buckets[i].races.length+" race(s), "+raw[i].toFixed(1)+" average "+labelText.toLowerCase();dot.appendChild(title);svg.appendChild(dot);
   });
  };
  addSeries("clicks","profile-chart-clicks","Clicks");
  addSeries("seconds","profile-chart-time","Completion time (seconds)");
  const legend=document.createElement("div");legend.className="profile-chart-legend profile-chart-legend-multiple";
  legend.innerHTML='<span><i class="profile-chart-clicks"></i> Average clicks</span><span><i class="profile-chart-time"></i> Average time</span>';host.appendChild(legend);
 }else if(profileChartType==="bar"){
  const barWidth=Math.max(3,Math.min(44,(w-pad*2)/buckets.length*.62));
  buckets.forEach((d,i)=>{if(!d.races.length)return;const rect=document.createElementNS(ns,"rect");const barH=Math.max(2,h-pad-(values[i]/max)*(h-pad*2));rect.setAttribute("x",x(i)-barWidth/2);rect.setAttribute("y",h-pad-barH);rect.setAttribute("width",barWidth);rect.setAttribute("height",barH);rect.setAttribute("class","profile-chart-bar");const title=document.createElementNS(ns,"title");title.textContent=d.label+": "+d.races.length+" race(s), "+values[i].toFixed(1)+" average clicks";rect.appendChild(title);svg.appendChild(rect);});
 }else{
  const pts=values.map((v,i)=>({x:x(i),y:h-pad-(v/max)*(h-pad*2),hasData:buckets[i].races.length>0})).filter(p=>p.hasData);
  if(pts.length){const path=document.createElementNS(ns,"path");path.setAttribute("d",pts.map((p,i)=>(i?"L":"M")+p.x+" "+p.y).join(" "));path.setAttribute("class","profile-chart-line");svg.appendChild(path);}
  pts.forEach(p=>{const dot=document.createElementNS(ns,"circle");dot.setAttribute("cx",p.x);dot.setAttribute("cy",p.y);dot.setAttribute("r",5);dot.setAttribute("class","profile-chart-dot");svg.appendChild(dot);});
 }
 host.appendChild(svg);
 const labels=document.createElement("div");labels.className="profile-chart-labels profile-week-labels";
 const stride=profilePeriod==="day"?3:profilePeriod==="week"?1:Math.ceil(buckets.length/7);
 buckets.forEach((d,i)=>{if(i%stride!==0&&i!==buckets.length-1)return;const span=document.createElement("span");span.textContent=d.label;labels.appendChild(span);});
 host.appendChild(labels);
}
document.querySelectorAll("[data-profile-chart]").forEach(button=>button.addEventListener("click",()=>{
 profileChartType=button.dataset.profileChart;
 document.querySelectorAll("[data-profile-chart]").forEach(b=>b.classList.toggle("active",b===button));
 if(window.profileDisplayedRaceHistory)renderProfileLineChart(window.profileDisplayedRaceHistory);
}));
document.querySelectorAll("[data-profile-period]").forEach(button=>button.addEventListener("click",()=>{
 profilePeriod=button.dataset.profilePeriod;profilePeriodOffset=0;
 document.querySelectorAll("[data-profile-period]").forEach(b=>b.classList.toggle("active",b===button));
 if(window.profileDisplayedRaceHistory)renderProfileLineChart(window.profileDisplayedRaceHistory);
}));
$("profileWeekPrev").addEventListener("click",()=>{
 profilePeriodOffset--;
 if(window.profileDisplayedRaceHistory)renderProfileLineChart(window.profileDisplayedRaceHistory);
});
$("profileWeekNext").addEventListener("click",()=>{
 if(profilePeriodOffset<0){profilePeriodOffset++;if(window.profileDisplayedRaceHistory)renderProfileLineChart(window.profileDisplayedRaceHistory);}
});

function renderProfileRaces(history){
 const list=$("profileRecentRaces");list.replaceChildren();$("profileRaceCount").textContent=history.length+" races";
 if(!history.length){const p=document.createElement("p");p.className="profile-empty";p.textContent="No races recorded yet. Your completed races will appear here.";list.appendChild(p);return;}
 history.slice().reverse().slice(0,12).forEach(r=>{const row=document.createElement("article");row.className="profile-race-row";const route=document.createElement("div");route.className="profile-race-route";const name=document.createElement("strong");name.textContent=(r.start||"Start")+" → "+(r.goal||"Finish");const meta=document.createElement("span");meta.textContent=(r.mode==="multiplayer"?"Multiplayer":r.mode==="daily"?"Daily Run":"Solo")+" · "+(r.date?new Date(r.date).toLocaleDateString():"Date unavailable");route.append(name,meta);const score=document.createElement("div");score.className="profile-race-score";const clicks=document.createElement("strong");clicks.textContent=(r.clicks??"—")+" clicks";const time=document.createElement("span");time.textContent=r.seconds==null?"—":formatTime(r.seconds);score.append(clicks,time);row.append(route,score);list.appendChild(row);});
}
function renderProfileDaily(history){
 const host=$("profileDailyHistory");host.replaceChildren();if(!history.length){const p=document.createElement("p");p.className="profile-empty";p.textContent="No Daily Runs recorded yet.";host.appendChild(p);return;}
 history.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,8).forEach(r=>{const row=document.createElement("div");row.className="profile-daily-row";const route=document.createElement("div");route.className="profile-race-route";const name=document.createElement("strong");name.textContent=(r.start||"Starting article")+" → "+(r.goal||"Destination");const date=document.createElement("span");date.textContent=r.date?new Date(r.date+"T00:00:00Z").toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}):"Date unavailable";route.append(name,date);const score=document.createElement("span");score.textContent=r.clicks+" clicks · "+formatTime(r.seconds);row.append(route,score);host.appendChild(row);});
}
let pendingProfilePhoto = null;
function applyProfileAvatar(photo,username){
 const avatar=$("profileAvatar");
 avatar.textContent=(username||"W").trim().charAt(0).toUpperCase();
 avatar.style.backgroundImage=photo?'url("'+photo+'")':"";
 avatar.classList.toggle("has-photo",!!photo);
}
async function imageFileToDataUrl(file){
 if(!file||!file.type.startsWith("image/"))throw new Error("Choose an image file.");
 if(file.size>8*1024*1024)throw new Error("Choose an image smaller than 8 MB.");
 const bitmap=await createImageBitmap(file);
 const scale=Math.min(1,256/Math.max(bitmap.width,bitmap.height));
 const canvas=document.createElement("canvas");
 canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
 const context=canvas.getContext("2d");context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
 const data=canvas.toDataURL("image/jpeg",.78);
 if(data.length>220000)throw new Error("That image is too detailed. Try a smaller image.");
 return data;
}
function openProfileSettings(profile={}){
 pendingProfilePhoto=null;
 $("settingsUsername").value=profile.username||currentUsername||"";
 $("settingsBio").value=profile.profileBio||"";
 const titleSelect=$("settingsTitle");if(titleSelect){const level=levelFromXp(profile.xp||0),unlocks=[["Article Explorer",5],["Page Navigator",10],["Knowledge Expert",20],["Wiki Master",30],["Encyclopedia Legend",50]];[...titleSelect.options].forEach(option=>{const requirement=unlocks.find(x=>x[0]===option.value)?.[1]||1;option.disabled=option.value!==""&&level<requirement;});titleSelect.value=profile.customTitle||"";}
 $("settingsPhotoFile").value="";
 $("settingsPhotoPreview").style.backgroundImage=profile.photoDataUrl?'url("'+profile.photoDataUrl+'")':"";
 $("settingsPhotoPreview").textContent=profile.photoDataUrl?"":(profile.username||currentUsername||"W").charAt(0).toUpperCase();
 $("profileSettingsMessage").textContent="";
 $("profileSettingsPanel").classList.remove("hidden");
 $("profileSettingsPanel").scrollIntoView({behavior:"smooth",block:"start"});
}
async function saveProfileSettings(){
 if(!currentUser)return;
 const button=$("saveProfileSettingsButton");button.disabled=true;
 $("profileSettingsMessage").textContent="Saving…";
 try{
  const nextName=$("settingsUsername").value.trim();
  const nextBio=$("settingsBio").value.trim().slice(0,160);
  const nextTitle=$("settingsTitle").value;
  const nextKey=usernameKey(nextName),oldKey=usernameKey(currentUsername);
  if(nextName.length<3||nextName.length>20||!/^[a-zA-Z0-9_-]+$/.test(nextName))throw new Error("Username must be 3–20 characters and use only letters, numbers, _ or -.");
  const userRef=db.collection("users").doc(currentUser.uid);
  const publicRef=db.collection("publicProfiles").doc(currentUser.uid);
  const nextIndexRef=db.collection("usernames").doc(nextKey);
  const oldIndexRef=db.collection("usernames").doc(oldKey);
  await db.runTransaction(async tx=>{
   const [userSnap,newIndexSnap]=await Promise.all([tx.get(userRef),tx.get(nextIndexRef)]);
   if(newIndexSnap.exists&&newIndexSnap.data().uid!==currentUser.uid)throw new Error("That username is already taken.");
   const oldData=userSnap.exists?userSnap.data()||{}:{};
   const photo=pendingProfilePhoto===null?(oldData.photoDataUrl||""):(pendingProfilePhoto||"");
   const level=levelFromXp(oldData.xp||0),requirements={"Article Explorer":5,"Page Navigator":10,"Knowledge Expert":20,"Wiki Master":30,"Encyclopedia Legend":50};if(nextTitle&&level<(requirements[nextTitle]||999))throw new Error("Reach the required level to use that title.");
   const updates={username:nextName,profileBio:nextBio,photoDataUrl:photo,customTitle:nextTitle};
   tx.set(userRef,updates,{merge:true});
   tx.set(nextIndexRef,{uid:currentUser.uid,username:nextName});
   if(oldKey&&oldKey!==nextKey)tx.delete(oldIndexRef);
   tx.set(publicRef,{uid:currentUser.uid,username:nextName,profileBio:nextBio,photoDataUrl:photo,customTitle:nextTitle},{merge:true});
  });
  currentUsername=nextName;
  setProfileTitle(nextName);$("profileBio").textContent=nextBio||"No bio added yet.";
  const updatedProfile=(await userRef.get()).data()||{};renderProgression(updatedProfile);
  applyProfileAvatar(pendingProfilePhoto===null?($("settingsPhotoPreview").style.backgroundImage?$("settingsPhotoPreview").style.backgroundImage.slice(5,-2):""):pendingProfilePhoto,nextName);
  $("profileJoined").textContent=$("profileJoined").textContent;
  $("profileSettingsPanel").classList.add("hidden");
  $("accountButton").textContent=nextName.split(" ")[0];$("accountStatus").textContent=nextName;
  setToast("Profile updated.");
 }catch(error){$("profileSettingsMessage").textContent=error.message||authError(error);}
 finally{button.disabled=false;}
}
function setProfileTitle(name){
 const title=$("profileTitle");
 if(!title)return;
 const badge=$("profileOwnerBadge");
 const label=document.createTextNode(name||"WikiRace player");
 if(badge)title.replaceChildren(label,badge);
 else title.replaceChildren(label);
}
async function openProfile(uid,name,isOwn=false){
 if(!uid)return;
 viewedProfileUid=uid;
 $("profileModal").classList.remove("hidden");
 setProfileTitle(name||"WikiRace player");
 $("profileAvatar").textContent=(name||"W").trim().charAt(0).toUpperCase();
 $("profileJoined").textContent="Loading profile…";
 $("profileInviteButton").classList.add("hidden");
 $("profileBlockButton")?.classList.add("hidden");$("profileReportButton")?.classList.add("hidden");if($("profileBlockButton")){$("profileBlockButton").disabled=false;$("profileBlockButton").textContent="Block player";}
 try{
  let p=null;
  let profileError=null;
  if(isOwn){
   try{
    const ownSnap=await db.collection("users").doc(uid).get();
    if(ownSnap.exists)p=ownSnap.data()||{};
   }catch(error){profileError=error;}
   if(!p){
    try{
     const publicSnap=await db.collection("publicProfiles").doc(uid).get();
     if(publicSnap.exists)p=publicSnap.data()||{};
    }catch(error){profileError=error;}
   }
   if(!p&&profileError)throw profileError;
   if(!p)p={uid,username:name||currentUsername||"WikiRace player",races:0,wins:0};
   if(!Array.isArray(p.raceHistory)||!p.raceHistory.length){
    try{
     const publicSnap=await db.collection("publicProfiles").doc(uid).get();
     const publicData=publicSnap.exists?publicSnap.data()||{}:{};
     if(Array.isArray(publicData.raceHistory)&&publicData.raceHistory.length)p.raceHistory=publicData.raceHistory;
     if((!Array.isArray(p.dailyHistory)||!p.dailyHistory.length)&&Array.isArray(publicData.dailyHistory))p.dailyHistory=publicData.dailyHistory;
    }catch(error){console.warn("Could not load public profile history:",error);}
   }
  }else{
   const publicSnap=await db.collection("publicProfiles").doc(uid).get();
   if(!publicSnap.exists)throw new Error("This player’s public profile has not been created yet. Ask them to sign in and refresh WikiRace.");
   p=publicSnap.data()||{};
   
  }
  setProfileTitle(p.username||name||"WikiRace player");
  const ownerBadge=$("profileOwnerBadge");
  if(ownerBadge)ownerBadge.classList.toggle("hidden",!(isOwn&&String(currentUser?.email||"").toLowerCase()==="prevolveyt@gmail.com"));
  applyProfileAvatar(p.photoDataUrl||"",p.username||name);
  $("profileBio").textContent=p.profileBio||"No bio added yet.";
  $("profileEditButton").classList.toggle("hidden",!isOwn);
  $("profileSettingsPanel").classList.add("hidden");
  $("profileJoined").textContent=p.createdAt?.toDate?.()?("Member since "+p.createdAt.toDate().toLocaleDateString(undefined,{month:"long",year:"numeric"})):(isOwn?"Your WikiRace profile":"WikiRace player");
  $("viewProfileRaces").textContent=String(p.races||0);
  $("viewProfileWins").textContent=String(p.wins||0);
  $("viewProfileBestTime").textContent=p.bestRaceTime==null?"—":formatTime(p.bestRaceTime);
  $("viewProfileFewest").textContent=p.fewestRaceClicks==null?"—":String(p.fewestRaceClicks);
  $("viewProfileStreak").textContent=String(p.currentStreak||0);
  $("viewProfileLongest").textContent=String(p.longestStreak||0);
  const badges=p.streakBadges||[];
  $("viewProfileBadges").replaceChildren();
  if(!badges.length){
   const empty=document.createElement("span");empty.className="profile-empty";empty.textContent="No Daily Run badges yet."; $("viewProfileBadges").appendChild(empty);
  }else badges.slice().sort((x,y)=>x-y).forEach(m=>{
   const badge=document.createElement("span");badge.className="profile-badge";badge.textContent=formatDailyBadge(m);$("viewProfileBadges").appendChild(badge);
  });
  const races=Array.isArray(p.raceHistory)?p.raceHistory:[];
  profilePeriodOffset=0;window.profileDisplayedRaceHistory=races;renderProgression(p);renderProfileFavorites(p);renderProfileLineChart(races);renderProfileRaces(races);renderProfileDaily(Array.isArray(p.dailyHistory)?p.dailyHistory:[]);renderProfileAchievements(p,races,Array.isArray(p.dailyHistory)?p.dailyHistory:[]);
  $("profileInviteButton").classList.toggle("hidden",isOwn||!currentUser);
  $("profileBlockButton").classList.toggle("hidden",isOwn||!currentUser);
  $("profileReportButton").classList.toggle("hidden",isOwn||!currentUser);
  $("profileInviteButton").onclick=()=>inviteFriend(uid,p.username||name||"player");
 }catch(error){
  console.error("WikiRace profile could not load:",error);
  $("profileJoined").textContent="Could not load profile";
  setToast(error.code?authError(error):(error.message||"Could not load this profile."));
 }
}

async function blockViewedProfile(){if(!currentUser||!viewedProfileUid||viewedProfileUid===currentUser.uid)return;const confirmed=confirm("Block this player? They will be added to your blocked list.");if(!confirmed)return;try{await db.collection("userBlocks").doc(currentUser.uid).collection("blocked").doc(viewedProfileUid).set({uid:viewedProfileUid,createdAt:firebase.firestore.FieldValue.serverTimestamp()});$("profileBlockButton").textContent="Blocked";$("profileBlockButton").disabled=true;setToast("Player blocked.");}catch(error){setToast(authError(error));}}
async function reportViewedProfile(){if(!currentUser||!viewedProfileUid||viewedProfileUid===currentUser.uid)return;const reason=prompt("Why are you reporting this player?");if(!reason||!reason.trim())return;try{await db.collection("userReports").add({reporterUid:currentUser.uid,targetUid:viewedProfileUid,reason:reason.trim().slice(0,500),createdAt:firebase.firestore.FieldValue.serverTimestamp(),status:"new"});setToast("Report submitted.");}catch(error){setToast(authError(error));}}
function renderProfileAchievements(profile={},races=[],dailyHistory=[]){
 const host=$("profileAchievements");if(!host)return;host.replaceChildren();
 const total=Number(profile.races||0),wins=Number(profile.wins||0);
 const pages=new Set(),routes=new Set();
 races.forEach(r=>{
  if(r.start)pages.add(String(r.start).toLowerCase());
  if(r.goal)pages.add(String(r.goal).toLowerCase());
  if(r.start&&r.goal)routes.add(String(r.start).toLowerCase()+"|"+String(r.goal).toLowerCase());
 });
 const multiplayer=races.filter(r=>r.mode==="multiplayer").length;
 const solo=races.filter(r=>!r.mode||r.mode==="solo").length;
 const hard=races.filter(r=>String(r.difficulty||"").toLowerCase()==="hard").length;
 const medium=races.filter(r=>String(r.difficulty||"").toLowerCase()==="medium").length;
 const fast=races.filter(r=>Number(r.seconds)>0&&Number(r.seconds)<=60).length;
 const under30=races.filter(r=>Number(r.seconds)>0&&Number(r.seconds)<=30).length;
 const under10=races.filter(r=>Number(r.seconds)>0&&Number(r.seconds)<=10).length;
 const lowClicks=races.filter(r=>Number(r.clicks)<=5).length;
 const night=races.filter(r=>{const d=new Date(r.date);return Number.isFinite(d.getTime())&&(d.getHours()>=0&&d.getHours()<5);}).length;
 const morning=races.filter(r=>{const d=new Date(r.date);return Number.isFinite(d.getTime())&&d.getHours()>=5&&d.getHours()<9;}).length;
 const marathon=races.filter(r=>Number(r.seconds)>=600).length;
 const daily=Number(profile.totalDailyRuns||dailyHistory.length||0),streak=Number(profile.longestStreak||0);
 const achievements=[
  ["first-race","First Steps","Complete your first race","1 race",total,1,"🏁"],
  ["five-races","Getting Warmed Up","Complete 5 races","5 races",total,5,"🔥"],
  ["ten-races","Regular Racer","Complete 10 races","10 races",total,10,"🏎️"],
  ["twenty-five-races","Dedicated","Complete 25 races","25 races",total,25,"🎖️"],
  ["fifty-races","Race Veteran","Complete 50 races","50 races",total,50,"🏆"],
  ["hundred-races","Century Club","Complete 100 races","100 races",total,100,"💯"],
  ["two-fifty-races","WikiRace Machine","Complete 250 races","250 races",total,250,"⚙️"],
  ["five-hundred-races","Legendary Racer","Complete 500 races","500 races",total,500,"👑"],
  ["first-win","First Victory","Win your first race","1 win",wins,1,"🥇"],
  ["ten-wins","Winning Streak","Win 10 races","10 wins",wins,10,"🏅"],
  ["fifty-wins","Champion","Win 50 races","50 wins",wins,50,"🏆"],
  ["explorer-10","Curious Mind","Use 10 different start or finish articles","10 articles",pages.size,10,"🧭"],
  ["explorer-25","Deep Explorer","Use 25 different start or finish articles","25 articles",pages.size,25,"🗺️"],
  ["routes-10","Route Collector","Complete 10 different routes","10 routes",routes.size,10,"🔀"],
  ["speed-60","Quick Thinker","Finish a race in under 60 seconds","1 race",fast,1,"⏱️"],
  ["speed-30","Speedrunner","Finish a race in 30 seconds or less","1 race",under30,1,"⚡"],
  ["speed-10","Lightning Fast","Finish a race in 10 seconds or less","1 race",under10,1,"🌩️"],
  ["five-clicks","Efficient","Finish a race in 5 clicks or fewer","1 race",lowClicks,1,"🎯"],
  ["solo-10","Solo Specialist","Complete 10 solo races","10 races",solo,10,"🧩"],
  ["multiplayer-1","Not Alone","Complete a multiplayer race","1 race",multiplayer,1,"👥"],
  ["multiplayer-10","Rival","Complete 10 multiplayer races","10 races",multiplayer,10,"⚔️"],
  ["hard-1","Hard Mode","Complete a Hard difficulty race","1 race",hard,1,"💀"],
  ["hard-10","Hardcore","Complete 10 Hard difficulty races","10 races",hard,10,"🔥"],
  ["medium-10","Finding Your Pace","Complete 10 Medium difficulty races","10 races",medium,10,"📈"],
  ["daily-1","Daily Starter","Complete a Daily Run","1 run",daily,1,"📅"],
  ["daily-7","Daily Regular","Complete 7 Daily Runs","7 runs",daily,7,"🗓️"],
  ["daily-30","Daily Dedicated","Complete 30 Daily Runs","30 runs",daily,30,"🌟"],
  ["streak-3","Three in a Row","Reach a 3-day Daily Run streak","3 days",streak,3,"🔥"],
  ["streak-7","Week of Knowledge","Reach a 7-day Daily Run streak","7 days",streak,7,"📆"],
  ["streak-30","Unstoppable","Reach a 30-day Daily Run streak","30 days",streak,30,"💎"],
  ["early-bird","Early Bird","Complete a race before 9 AM","1 race",morning,1,"🌅"],
  ["night-owl","Night Owl","Complete a race between midnight and 5 AM","1 race",night,1,"🦉"],
  ["marathon","Marathon","Spend 10 minutes or more on a single race","1 race",marathon,1,"🧠"]
 ];
 let unlocked=0;
 achievements.forEach(([id,title,description,target,current,goal,icon])=>{
  const earned=current>=goal;if(earned)unlocked++;
  const card=document.createElement("article");card.className="profile-achievement"+(earned?" is-earned":" is-locked");
  const symbol=document.createElement("span");symbol.className="profile-achievement-icon";symbol.textContent=icon;
  const content=document.createElement("div");content.className="profile-achievement-copy";
  const heading=document.createElement("div");heading.className="profile-achievement-heading";
  const name=document.createElement("strong");name.textContent=title;
  const status=document.createElement("span");status.className="profile-achievement-status";status.textContent=earned?"UNLOCKED":"LOCKED";
  heading.append(name,status);
  const detail=document.createElement("p");detail.textContent=description;
  const progress=document.createElement("div");progress.className="profile-achievement-progress";
  const track=document.createElement("span");track.className="profile-achievement-track";
  const fill=document.createElement("i");fill.style.width=Math.min(100,Math.max(0,current/goal*100))+"%";track.appendChild(fill);
  const count=document.createElement("small");count.textContent=Math.min(current,goal)+" / "+goal+" "+target.replace(/^\d+ /,"");
  progress.append(track,count);content.append(heading,detail,progress);card.append(symbol,content);host.appendChild(card);
 });
 const summary=document.createElement("p");summary.className="profile-achievement-summary";summary.textContent=unlocked+" of "+achievements.length+" achievements unlocked";
 host.prepend(summary);
}
function friendMessage(message,isError=false){$("friendsMessage").textContent=message;$("friendsMessage").classList.toggle("error",isError);}
function openFriends(){
  if(!currentUser)return authMode("signin");
  setFriendsTab("find");
  $("friendsModal").classList.remove("hidden");
  $("friendUsernameInput").value="";
  friendMessage("");
  loadFriends();
}
function friendRow(name,detail,actions=[]){
  const row=document.createElement("div");row.className="friend-row";
  const info=document.createElement("div");info.className="friend-info";
  const avatar=document.createElement("div");avatar.className="friend-avatar";avatar.textContent=(name||"W").trim().charAt(0).toUpperCase();
  const copy=document.createElement("div");copy.className="friend-copy";
  const strong=document.createElement("strong");strong.textContent=name;
  const small=document.createElement("span");small.textContent=detail||"";
  copy.append(strong,small);info.append(avatar,copy);row.appendChild(info);
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
    $("friendRequestCount").textContent=String(pending.length);$("friendRequestCount").classList.toggle("hidden",pending.length===0);
    if(!pending.length){const p=document.createElement("p");p.className="friends-empty";p.textContent="No pending requests.";requests.appendChild(p);}
    pending.forEach(doc=>{
      const req=doc.data();
      const requestRow=friendRow(req.fromUsername||"WikiRace player","Wants to be your friend",[
        {label:"Accept",kind:"friend-accept",run:()=>acceptFriendRequest(doc.id,req)},
        {label:"Decline",run:()=>declineFriendRequest(doc.id)}
      ]);
      requests.appendChild(requestRow);loadFriendAvatar(req.fromUid,requestRow,req.fromUsername);
    });
    if(connections.empty){const p=document.createElement("p");p.className="friends-empty";p.textContent="No friends added yet.";friends.appendChild(p);}
    connections.forEach(doc=>{
      const data=doc.data(), otherUid=data.members.find(id=>id!==currentUser.uid);
      const name=data.usernames?.[otherUid]||"WikiRace player";
      const row=friendRow(name,"Friend",[{label:"Profile",run:()=>openProfile(otherUid,name,false)},{label:"Invite",kind:"friend-invite",run:()=>inviteFriend(otherUid,name)}]);
      friends.appendChild(row);
      loadFriendAvatar(otherUid,row,name);
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
async function loadFriendAvatar(uid,row,name){
 if(!uid||!row)return;
 try{
  const snap=await db.collection("publicProfiles").doc(uid).get();
  const photo=snap.exists?(snap.data()?.photoDataUrl||""):"";
  const avatar=row.querySelector(".friend-avatar");
  if(avatar&&photo){avatar.style.backgroundImage='url("'+photo+'")';avatar.classList.add("has-photo");avatar.textContent="";}
 }catch(error){console.warn("Could not load friend profile picture:",error);}
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
  if(currentUser){const blocked=await db.collection("userBlocks").doc(currentUser.uid).collection("blocked").doc(friendUid).get();if(blocked.exists)return friendMessage("Unblock this player before inviting them.",true);}
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
        const invite=change.doc.data();
        db.collection("userBlocks").doc(currentUser.uid).collection("blocked").doc(invite.fromUid).get().then(blocked=>{if(!blocked.exists)showGameInvite(change.doc);}).catch(()=>showGameInvite(change.doc));
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
        roomLaunchKey=key;multiplayerLocalFinished=false;multiplayerEnded=false;opponentFinishPromptedFor=new Set();opponentDisconnectNotified=false;lastRoomProgressSecond=-1;
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
      const online=!!data?.online&&(!lastSeen||Date.now()-lastSeen<120000);
      roomPresenceStates.set(uid,online);
      if(!online&&activeRoom?.status==="racing"&&!multiplayerLocalFinished&&!multiplayerEnded&&!opponentDisconnectNotified){
        opponentDisconnectNotified=true;
        setToast("Your opponent disconnected.");
      }
      if(screens.win.classList.contains("active"))renderMultiplayerResults();
    },()=>{roomPresenceStates.set(uid,false);if(screens.win.classList.contains("active"))renderMultiplayerResults();});
    roomPresenceUnsubs.set(uid,unsubscribe);
  });
}
function handleRoomPlayersUpdate(){
  const opponents=(window.roomPlayers||[]).filter(p=>p.uid!==currentUser?.uid);
  if(!opponents.length){
    if(!opponentDisconnectNotified&&!multiplayerLocalFinished&&!multiplayerEnded){
      opponentDisconnectNotified=true;
      setToast("Your opponent left the game.");
    }
    return;
  }
  const finisher=opponents.find(p=>p.finished&&!opponentFinishPromptedFor.has(p.uid));
  if(finisher&&!multiplayerLocalFinished&&!multiplayerEnded)showOpponentFinishedPrompt(finisher);
  const ended=opponents.find(p=>p.ended);
  if(ended&&!multiplayerLocalFinished&&!multiplayerEnded){
    multiplayerEnded=true;
    showMultiplayerEndedResults((ended.username||"Your opponent")+" ended the race.");
    updateRoomPlayer(false,{ended:true,endedAt:firebase.firestore.FieldValue.serverTimestamp()});
  }
  if(screens.win.classList.contains("active"))renderMultiplayerResults();
}

function setMatchmakingUI(message,searching=true){
  const status=$("matchmakingStatus");
  if(status){status.textContent=message||"";status.classList.toggle("hidden",!message);}
  $("randomMatchButton").classList.toggle("hidden",searching);
  $("cancelMatchButton").classList.toggle("hidden",!searching);
  $("randomMatchButton").disabled=searching;
}
function stopMatchmakingListeners(){
  if(matchmakingInterval){clearInterval(matchmakingInterval);matchmakingInterval=null;}
  if(matchmakingUnsubscribe){matchmakingUnsubscribe();matchmakingUnsubscribe=null;}
}
async function cancelRandomMatch(showMessage=true){
  stopMatchmakingListeners();
  const ref=matchmakingRef;
  matchmakingRef=null;matchmakingActive=false;matchmakingJoining=false;
  if(ref&&currentUser){try{await ref.delete();}catch(error){}}
  setMatchmakingUI("",false);
  if(showMessage)setToast("Matchmaking cancelled.");
}
async function enterMatchedRoom(data){
  if(matchmakingJoining||!currentUser||!data?.roomId)return;
  matchmakingJoining=true;
  stopMatchmakingListeners();
  try{
    const roomRef=db.collection("rooms").doc(data.roomId);
    const roomSnap=await roomRef.get();
    if(!roomSnap.exists||roomSnap.data().status!=="waiting")throw new Error("That match is no longer available. Search again.");
    await roomRef.collection("players").doc(currentUser.uid).set({
      uid:currentUser.uid,username:currentUsername||await username(),clicks:0,seconds:0,current:"",finished:false,ready:false
    });
    const code=data.roomCode||roomSnap.data().code||"";
    if(matchmakingRef){await matchmakingRef.delete().catch(()=>{});}
    matchmakingRef=null;matchmakingActive=false;matchmakingJoining=false;
    setMatchmakingUI("",false);
    window.roomPlayers=[];
    await listenRoom(roomRef.id,code);
    setToast("Match found. You're in the game room.");
  }catch(error){
    matchmakingJoining=false;
    await cancelRandomMatch(false);
    setToast(error.message||authError(error));
  }
}
async function tryFindRandomOpponent(){
  if(!matchmakingActive||!currentUser||!matchmakingRef||matchmakingJoining||matchmakingAttemptInProgress)return;
  matchmakingAttemptInProgress=true;
  try{
    const waiting=await db.collection("matchmakingQueue")
      .where("status","==","waiting")
      .limit(20).get();
    const candidates=waiting.docs.filter(doc=>
      doc.id!==currentUser.uid && doc.data().difficulty===state.difficulty && doc.data().powerupsEnabled===($("multiplayerPowerupsEnabled")?.checked!==false)
    );
    for(const candidate of candidates){
      const roomRef=db.collection("rooms").doc();
      const code=makeRoomCode();
      const playerName=currentUsername||await username();
      const candidateClaimed=await db.runTransaction(async tx=>{
        const latest=await tx.get(candidate.ref);
        if(!latest.exists||latest.data().status!=="waiting"||latest.data().uid===currentUser.uid)return false;
        const created=latest.data().createdAt?.toMillis?.()||0;
        if(created&&Date.now()-created>120000)return false;
        tx.set(roomRef,{
          code,hostUid:currentUser.uid,status:"waiting",
          createdAt:firebase.firestore.FieldValue.serverTimestamp(),
          start:"",goal:"",difficulty:state.difficulty,options:{powerupsEnabled:$("multiplayerPowerupsEnabled")?.checked!==false,blockFind:raceOptions.blockFind,blockBrowserNavigation:raceOptions.blockBrowserNavigation,backEnabled},matchType:"random"
        });
        tx.set(roomRef.collection("players").doc(currentUser.uid),{
          uid:currentUser.uid,username:playerName,clicks:0,seconds:0,current:"",finished:false,ready:false
        });
        tx.update(candidate.ref,{
          status:"matched",roomId:roomRef.id,roomCode:code,matchedByUid:currentUser.uid,
          matchedAt:firebase.firestore.FieldValue.serverTimestamp()
        });
        return true;
      });
      if(candidateClaimed){
        await matchmakingRef.update({
          status:"matched",roomId:roomRef.id,roomCode:code,matchedByUid:currentUser.uid,
          matchedAt:firebase.firestore.FieldValue.serverTimestamp()
        });
        return;
      }
    }
  }catch(error){
    console.warn("Random matchmaking search failed:",error);
    setToast(authError(error));
    await cancelRandomMatch(false);
  }finally{
    matchmakingAttemptInProgress=false;
  }
}
async function startRandomMatch(){
  if(!currentUser)return authMode("signin");
  if(activeRoomCode||matchmakingActive)return;
  matchmakingActive=true;matchmakingJoining=false;
  setMatchmakingUI("Searching for another player on "+state.difficulty+" difficulty…");
  try{
    const ref=db.collection("matchmakingQueue").doc(currentUser.uid);
    matchmakingRef=ref;
    await ref.set({
      uid:currentUser.uid,username:currentUsername||await username(),
      status:"waiting",difficulty:state.difficulty,powerupsEnabled:$("multiplayerPowerupsEnabled")?.checked!==false,
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    });
    matchmakingUnsubscribe=ref.onSnapshot(snapshot=>{
      if(!snapshot.exists){if(matchmakingActive&&!matchmakingJoining){setToast("Your matchmaking search ended.");cancelRandomMatch(false);}return;}
      const data=snapshot.data();
      if(data.status==="matched")enterMatchedRoom(data);
    },error=>{setToast(authError(error));cancelRandomMatch(false);});
    await tryFindRandomOpponent();
    if(matchmakingActive&&!matchmakingJoining){
      matchmakingInterval=setInterval(tryFindRandomOpponent,3000);
      setMatchmakingUI("Searching for another player on "+state.difficulty+" difficulty…");
    }
  }catch(error){
    await cancelRandomMatch(false);
    setToast(authError(error));
  }
}
async function createRoom(){
  if(!currentUser)return authMode("signin");
  try{
    const code=makeRoomCode(), name=await username(), ref=db.collection("rooms").doc();
    await ref.set({code,hostUid:currentUser.uid,status:"waiting",createdAt:firebase.firestore.FieldValue.serverTimestamp(),start:"",goal:"",difficulty:state.difficulty||"medium",options:{powerupsEnabled:$("multiplayerPowerupsEnabled")?.checked!==false,blockFind:raceOptions.blockFind,blockBrowserNavigation:raceOptions.blockBrowserNavigation,backEnabled}});
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
    await db.collection("rooms").doc(activeRoom.id).update({start:route[0],goal:route[1],difficulty:state.difficulty,options:{blockFind:raceOptions.blockFind,blockBrowserNavigation:raceOptions.blockBrowserNavigation,backEnabled,powerupsEnabled:$("multiplayerPowerupsEnabled")?.checked!==false},status:"racing",startedAt:firebase.firestore.FieldValue.serverTimestamp()});
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
async function sendQuickChat(message){if(!activeRoom||!currentUser||!["waiting","racing"].includes(activeRoom.status))return;try{await db.collection("rooms").doc(activeRoom.id).collection("chat").add({uid:currentUser.uid,username:currentUsername||"Player",text:message,createdAt:firebase.firestore.FieldValue.serverTimestamp()});}catch(error){setToast(authError(error));}}
document.querySelectorAll("[data-quick-chat]").forEach(button=>button.addEventListener("click",()=>sendQuickChat(button.dataset.quickChat)));
$("chatLauncher").addEventListener("click",()=>setRoomChatOpen(true));
$("chatClose").addEventListener("click",()=>setRoomChatOpen(false));

async function launchSharedRace(room){
  stopTimer();if(state.requestController)state.requestController.abort();
  state.mode="multiplayer";state.dailyDate=null;resetRacePowerups(room.options?.powerupsEnabled===true);
  multiplayerLocalFinished=false;multiplayerEnded=false;opponentFinishPromptedFor=new Set();opponentDisconnectNotified=false;lastRoomProgressSecond=-1;closeOpponentFinishedPrompt();
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
    const data={uid:currentUser.uid,username:currentUsername||await username(),clicks:state.clicks,seconds:state.realSeconds||state.seconds,current:state.current||"",finished,...extra,updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
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
$("guestSignupButton").addEventListener("click",()=>authMode("signup"));
$("dailyRunButton").addEventListener("click",startDailyRun);
$("dailyHistoryButton").addEventListener("click",openDailyHistory);
renderDailyBonus();
renderPowerupWallet();
$("dailyHistoryClose").addEventListener("click",()=>$("dailyHistoryModal").classList.add("hidden"));
$("dailyHistoryModal").addEventListener("click",event=>{if(event.target===$("dailyHistoryModal"))$("dailyHistoryModal").classList.add("hidden");});
$("randomMatchButton").addEventListener("click",startRandomMatch);
$("cancelMatchButton").addEventListener("click",()=>cancelRandomMatch(true));
$("createRoomButton").addEventListener("click",createRoom);
$("spectateRoomButton")?.addEventListener("click",spectateRoomByCode);$("spectatorClose")?.addEventListener("click",closeSpectator);$("spectatorModal")?.addEventListener("click",e=>{if(e.target===$("spectatorModal"))closeSpectator()});
$("spectateCodeInput")?.addEventListener("input",()=>{$("spectateCodeInput").value=$("spectateCodeInput").value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g,"").slice(0,6)});
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
