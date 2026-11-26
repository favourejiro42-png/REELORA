import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp, query, orderBy, limit, setDoc } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAahjNURpZ2n05kfncqX-p2SEqx1OEzDvc",
  authDomain: "reelora-66c1d.firebaseapp.com",
  projectId: "reelora-66c1d",
  storageBucket: "reelora-66c1d.firebasestorage.app",
  messagingSenderId: "135925571451",
  appId: "1:135925571451:web:e33f7f48a51db598da67de"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app), db = getFirestore(app);
setPersistence(auth, browserLocalPersistence).catch(console.error);
const $ = id => document.getElementById(id);
let currentUser = null, stopWatchlist = null;
const CREATOR_EMAIL = "artdark962@gmail.com";
let creatorDashboardLoaded = false;
let chatHistory = [];
let countdownTimer = null, episodeCountdownTimer = null;

function authStatus(message){ $("authStatus").textContent = message; }
function showAuth(){ $("authModal").classList.remove("hidden"); }
function hideAuth(){ $("authModal").classList.add("hidden"); }
$("authOpen").onclick = () => currentUser ? signOut(auth) : showAuth();
$("authClose").onclick = hideAuth;
$("loginBtn").onclick = async () => { try { await signInWithEmailAndPassword(auth,$("email").value,$("password").value); hideAuth(); } catch(e){authStatus(e.message);} };
$("registerBtn").onclick = async () => { try { await createUserWithEmailAndPassword(auth,$("email").value,$("password").value); hideAuth(); } catch(e){authStatus(e.message);} };
$("googleBtn").onclick = async () => { try { await signInWithPopup(auth,new GoogleAuthProvider()); hideAuth(); } catch(e){authStatus(e.message);} };

onAuthStateChanged(auth, async user => {
  currentUser = user;
  $("userLabel").textContent = user ? (user.displayName || user.email || "Signed in") : "Not signed in";
  $("authOpen").textContent = user ? "Sign out" : "Sign in";
  const isCreator = !!user && user.emailVerified === true && (user.email || "").toLowerCase() === CREATOR_EMAIL;
  $("creatorNav").hidden = !isCreator;
  $("settings").hidden = !isCreator;
  if (!isCreator && location.hash === "#settings") location.hash = "#home";
  if (stopWatchlist) stopWatchlist();
  if (user) {
    const q = query(collection(db,"users",user.uid,"watchlist"),orderBy("addedAt","desc"),limit(50));
    stopWatchlist = onSnapshot(q,snap => renderWatchlist(snap.docs.map(d=>({id:d.id,...d.data()}))),err => console.error(err));
  } else {
    renderWatchlist([]);
  }
  recordSiteVisit(user).catch(err => console.debug("Visit metric unavailable:", err));
  if (isCreator) loadCreatorDashboard();
  else creatorDashboardLoaded = false;
});

function visitorSessionId(){
  const key="reelora_visitor_session";
  let id=sessionStorage.getItem(key);
  if(!id){id=(crypto.randomUUID?crypto.randomUUID():"v"+Date.now().toString(36)+Math.random().toString(36).slice(2));sessionStorage.setItem(key,id);}
  return id;
}
async function recordSiteVisit(user){
  const token=user?await user.getIdToken():"";
  await fetch("/api/creator",{method:"POST",headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({visitorId:visitorSessionId(),page:location.pathname+location.hash})});
}
function safeCell(value){const el=document.createElement("span");el.textContent=value==null||value===""?"—":String(value);return el;}
function creatorTable(containerId,headers,rows){
  const host=$(containerId);host.replaceChildren();
  if(!rows.length){const p=document.createElement("p");p.className="empty";p.textContent="Nothing recorded yet.";host.append(p);return;}
  const table=document.createElement("table"),thead=document.createElement("thead"),tr=document.createElement("tr");
  headers.forEach(h=>{const th=document.createElement("th");th.textContent=h;tr.append(th);});thead.append(tr);table.append(thead);
  const tbody=document.createElement("tbody");rows.forEach(row=>{const line=document.createElement("tr");row.forEach(value=>{const td=document.createElement("td");td.textContent=value==null||value===""?"—":String(value);line.append(td);});tbody.append(line);});table.append(tbody);host.append(table);
}
function formatCreatorDate(value){if(!value)return "—";const d=new Date(value);return Number.isNaN(d.getTime())?"—":d.toLocaleString();}
async function loadCreatorDashboard(){
  if(!currentUser||currentUser.emailVerified!==true||currentUser.email?.toLowerCase()!==CREATOR_EMAIL)return;
  const status=$("creatorStatus");status.textContent="Loading account and visitor records…";
  try{
    const token=await currentUser.getIdToken(true);
    const response=await fetch("/api/creator",{headers:{Authorization:`Bearer ${token}`}});
    const data=await response.json();if(!response.ok)throw new Error(data.error||"Unable to load creator dashboard.");
    $("creatorUserCount").textContent=data.users.length;
    $("creatorVisitCount").textContent=data.visits.length;
    $("creatorPageViews").textContent=data.visits.reduce((sum,v)=>sum+v.pageViews,0);
    creatorTable("creatorUsers",["Account","Display name","Created","Last sign-in","Status"],data.users.map(u=>[u.email,u.displayName,formatCreatorDate(u.createdAt),formatCreatorDate(u.lastSignInAt),u.disabled?"Disabled":"Active"]));
    creatorTable("creatorVisits",["Visitor","Account / session","Page","Views","Last seen"],data.visits.map(v=>[v.uid?"Signed in":"Anonymous",v.email||v.visitorId,v.page,v.pageViews,formatCreatorDate(v.lastSeen)]));
    status.textContent=`Updated ${formatCreatorDate(data.generatedAt)}. Anonymous visitor sessions are not personally identified.`;
    creatorDashboardLoaded=true;
  }catch(error){status.textContent=error.message;creatorTable("creatorUsers",["Account"],[]);creatorTable("creatorVisits",["Visitor"],[]);}
}
$("refreshCreator").addEventListener("click",loadCreatorDashboard);
window.addEventListener("hashchange",()=>{recordSiteVisit(currentUser).catch(err=>console.debug("Visit metric unavailable:",err));if(location.hash==="#settings"&&currentUser?.emailVerified===true&&currentUser?.email?.toLowerCase()===CREATOR_EMAIL)loadCreatorDashboard();});
function posterUrl(path){return path ? `https://image.tmdb.org/t/p/w342${path}` : "";}
function titleCard(item, saved=false) {
  const card=document.createElement("article");card.className="title-card";
  const detailItem = saved ? { ...item, id: item.tmdbId } : item;
  const img=document.createElement("img");img.alt=`View details for ${item.title}`;img.loading="lazy";
  if(item.poster_path) img.src=posterUrl(item.poster_path); else img.style.visibility="hidden";
  img.className="poster-click";img.tabIndex=0;img.setAttribute("role","button");
  img.onclick=()=>openDetails(detailItem);
  img.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openDetails(detailItem);}};
  const info=document.createElement("div");info.className="title-info";
  const title=document.createElement("b");title.textContent=item.title;title.className="title-click";
  title.tabIndex=0;title.setAttribute("role","button");title.onclick=()=>openDetails(detailItem);
  title.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openDetails(detailItem);}};
  const meta=document.createElement("small");meta.textContent=`${item.media_type==="tv"?"TV series":"Movie"}${item.release_date?" · "+item.release_date.slice(0,4):""}`;
  const btn=document.createElement("button");btn.className="save-btn";btn.textContent=saved?"Remove from watchlist":"＋ Add to watchlist";
  btn.onclick=()=>saved?removeWatch(item.id):saveWatch(item);
  info.append(title,meta,btn);card.append(img,info);return card;
}

function closeDetails(){
  if(countdownTimer){clearInterval(countdownTimer);countdownTimer=null;}
  if(episodeCountdownTimer){clearInterval(episodeCountdownTimer);episodeCountdownTimer=null;}
  $("detailModal").classList.add("hidden");
  document.body.classList.remove("detail-open");
}
$("detailClose").onclick=closeDetails;
$("detailBackdrop").onclick=closeDetails;
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("detailModal").classList.contains("hidden"))closeDetails();});

function detailLine(label,value){
  if(value===null||value===undefined||value==="") return null;
  const line=document.createElement("span");line.className="detail-meta-item";
  const strong=document.createElement("b");strong.textContent=label;
  const text=document.createElement("span");text.textContent=value;
  line.append(strong,text);return line;
}
function updateEpisodeCountdowns(){
  const clocks=document.querySelectorAll(".episode-countdown[data-episode-target]");
  let active=0;
  clocks.forEach(clock=>{
    const target=Number(clock.dataset.episodeTarget);
    const remaining=target-Date.now();
    if(!Number.isFinite(target))return;
    if(remaining<=0){clock.textContent="Premiere day reached";clock.classList.add("episode-countdown-now");return;}
    active++;
    const days=Math.floor(remaining/86400000);
    const hours=Math.floor((remaining%86400000)/3600000);
    const minutes=Math.floor((remaining%3600000)/60000);
    const seconds=Math.floor((remaining%60000)/1000);
    clock.textContent=`${days}d ${String(hours).padStart(2,"0")}h ${String(minutes).padStart(2,"0")}m ${String(seconds).padStart(2,"0")}s until release`;
  });
  if(!active&&episodeCountdownTimer){clearInterval(episodeCountdownTimer);episodeCountdownTimer=null;}
}

async function openDetails(item){
  if(countdownTimer){clearInterval(countdownTimer);countdownTimer=null;}
  if(episodeCountdownTimer){clearInterval(episodeCountdownTimer);episodeCountdownTimer=null;}
  const modal=$("detailModal"), content=$("detailContent");
  modal.classList.remove("hidden");document.body.classList.add("detail-open");
  content.replaceChildren();
  const loading=document.createElement("div");loading.className="detail-loading";loading.textContent="Loading details from TMDB…";content.append(loading);
  try{
    const id=item.tmdbId || item.id;
    const type=item.media_type;
    const response=await fetch(`/api/tmdb?id=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}`);
    const data=await response.json();
    if(!response.ok) throw new Error(data.error||"Could not load title details.");
    if(modal.classList.contains("hidden")) return;
    content.replaceChildren();

    const hero=document.createElement("div");hero.className="detail-hero";
    if(data.backdrop_path){hero.style.backgroundImage=`linear-gradient(90deg,rgba(9,8,18,.98),rgba(9,8,18,.66) 58%,rgba(9,8,18,.18)),url("https://image.tmdb.org/t/p/w1280${data.backdrop_path}")`;}
    const poster=document.createElement("img");poster.className="detail-poster";poster.alt=data.title;
    if(data.poster_path) poster.src=`https://image.tmdb.org/t/p/w500${data.poster_path}`;
    else poster.src="";
    const copy=document.createElement("div");copy.className="detail-copy";
    const eyebrow=document.createElement("div");eyebrow.className="kicker";eyebrow.textContent=type==="tv"?"TELEVISION SERIES":"FEATURE FILM";
    const heading=document.createElement("h2");heading.textContent=data.title;
    copy.append(eyebrow,heading);
    if(data.tagline){const tagline=document.createElement("p");tagline.className="detail-tagline";tagline.textContent=data.tagline;copy.append(tagline);}
    const meta=document.createElement("div");meta.className="detail-meta";
    const year=(data.release_date||"").slice(0,4);
    [detailLine("⭐ TMDB",data.vote_average!==null?`${data.vote_average.toFixed(1)} / 10`:"Not rated"),
     detailLine("RELEASE",data.release_date||"Not available"),
     detailLine("TYPE",type==="tv"?"TV series":"Movie"),
     detailLine("RUNTIME",data.runtime?`${data.runtime} min`:null),
     detailLine("SEASONS",data.number_of_seasons?String(data.number_of_seasons):null),
     detailLine("EPISODES",data.number_of_episodes?String(data.number_of_episodes):null)
    ].filter(Boolean).forEach(x=>meta.append(x));
    const genres=document.createElement("div");genres.className="detail-genres";
    (data.genres||[]).forEach(name=>{const chip=document.createElement("span");chip.textContent=name;genres.append(chip);});
    copy.append(meta,genres);
    hero.append(poster,copy);content.append(hero);

    // Live countdown to the title's premiere date (TMDB movie release date or TV first-air date).
    if(data.release_date){
      const countdown=document.createElement("section");countdown.className="release-countdown";
      const label=document.createElement("div");label.className="kicker";label.textContent=type==="tv"?"SERIES PREMIERE COUNTDOWN":"PREMIERE COUNTDOWN";
      const dateLabel=document.createElement("small");dateLabel.className="countdown-date";dateLabel.textContent=`Release date: ${data.release_date}`;
      const clock=document.createElement("div");clock.className="countdown-clock";clock.setAttribute("aria-live","off");
      countdown.append(label,dateLabel,clock);content.append(countdown);
      const premiereDate=new Date(`${data.release_date}T00:00:00`);
      const updateCountdown=()=>{
        const remaining=premiereDate.getTime()-Date.now();
        if(!Number.isFinite(premiereDate.getTime())){clock.textContent="Release date unavailable";return;}
        if(remaining<=0){clock.textContent="Already premiered";if(countdownTimer){clearInterval(countdownTimer);countdownTimer=null;}return;}
        const days=Math.floor(remaining/86400000);
        const hours=Math.floor((remaining%86400000)/3600000);
        const minutes=Math.floor((remaining%3600000)/60000);
        const seconds=Math.floor((remaining%60000)/1000);
        clock.replaceChildren();
        [[days,"DAYS"],[hours,"HRS"],[minutes,"MIN"],[seconds,"SEC"]].forEach(([value,unit])=>{
          const cell=document.createElement("span");cell.className="countdown-unit";
          const number=document.createElement("b");number.textContent=String(value).padStart(2,"0");
          const caption=document.createElement("small");caption.textContent=unit;
          cell.append(number,caption);clock.append(cell);
        });
      };
      updateCountdown();
      if(premiereDate.getTime()>Date.now())countdownTimer=setInterval(updateCountdown,1000);
    }

    const overviewWrap=document.createElement("div");overviewWrap.className="detail-overview";
    const sub=document.createElement("div");sub.className="kicker";sub.textContent="THE STORY";
    const overview=document.createElement("p");overview.textContent=data.overview||"No synopsis is available for this title yet.";
    overviewWrap.append(sub,overview);content.append(overviewWrap);

    // TV season browser: load each season's episode list on demand.
    if(type === "tv" && Array.isArray(data.seasons) && data.seasons.length){
      const seasonsWrap=document.createElement("section");seasonsWrap.className="season-browser";
      const seasonsHeading=document.createElement("div");seasonsHeading.className="kicker";seasonsHeading.textContent="SEASONS & EPISODES";
      const seasonList=document.createElement("div");seasonList.className="season-list";
      seasonsWrap.append(seasonsHeading,seasonList);content.append(seasonsWrap);
      data.seasons.forEach(season=>{
        const seasonBlock=document.createElement("section");seasonBlock.className="season-block";
        const toggle=document.createElement("button");toggle.type="button";toggle.className="season-toggle";
        const seasonName=document.createElement("span");seasonName.textContent=season.name || (season.season_number===0?"Specials":`Season ${season.season_number}`);
        const seasonMeta=document.createElement("small");
        const dateText=season.air_date?` · ${season.air_date.slice(0,4)}`:"";
        seasonMeta.textContent=`${season.episode_count||0} episodes${dateText}`;
        const indicator=document.createElement("span");indicator.className="season-indicator";indicator.textContent="＋";
        toggle.append(seasonName,seasonMeta,indicator);
        const episodeArea=document.createElement("div");episodeArea.className="episode-list hidden";
        let loaded=false,loading=false;
        toggle.onclick=async()=>{
          const opening=episodeArea.classList.contains("hidden");
          episodeArea.classList.toggle("hidden",!opening);indicator.textContent=opening?"−":"＋";
          if(!opening||loaded||loading)return;
          loading=true;episodeArea.replaceChildren();
          const status=document.createElement("p");status.className="episode-status";status.textContent="Loading episodes…";episodeArea.append(status);
          try{
            const seasonResponse=await fetch(`/api/tmdb?id=${encodeURIComponent(data.id)}&type=tv&season=${encodeURIComponent(season.season_number)}`);
            const seasonData=await seasonResponse.json();
            if(!seasonResponse.ok)throw new Error(seasonData.error||"Could not load this season.");
            if(modal.classList.contains("hidden"))return;
            episodeArea.replaceChildren();
            if(!seasonData.episodes?.length){const empty=document.createElement("p");empty.className="episode-status";empty.textContent="No episode information is available yet.";episodeArea.append(empty);}
            (seasonData.episodes||[]).forEach(episode=>{
              const row=document.createElement("article");row.className="episode-card";
              if(episode.still_path){const still=document.createElement("img");still.loading="lazy";still.alt="";still.src=`https://image.tmdb.org/t/p/w300${episode.still_path}`;row.append(still);}
              const episodeCopy=document.createElement("div");episodeCopy.className="episode-copy";
              const episodeTitle=document.createElement("b");episodeTitle.textContent=`${episode.episode_number}. ${episode.name}`;
              const episodeDate=document.createElement("small");episodeDate.textContent=episode.air_date?`Air date: ${episode.air_date}`:"Air date not announced";
              const episodeOverview=document.createElement("p");episodeOverview.textContent=episode.overview||"Episode description not available yet.";
              const episodeState=document.createElement("span");episodeState.className="episode-state";
              let episodeCountdown=null;
              if(episode.air_date){
                const airTime=new Date(`${episode.air_date}T00:00:00`).getTime();
                const upcoming=Number.isFinite(airTime)&&airTime>Date.now();
                episodeState.textContent=upcoming?"UPCOMING":"RELEASED";
                episodeState.classList.add(upcoming?"upcoming":"released");
                if(upcoming){
                  episodeCountdown=document.createElement("div");
                  episodeCountdown.className="episode-countdown";
                  episodeCountdown.dataset.episodeTarget=String(airTime);
                  episodeCountdown.setAttribute("aria-label",`Countdown to episode release on ${episode.air_date}`);
                }
              }
              episodeCopy.append(episodeTitle,episodeDate,episodeOverview);
              if(episodeState.textContent)episodeCopy.append(episodeState);
              if(episodeCountdown)episodeCopy.append(episodeCountdown);
              row.append(episodeCopy);episodeArea.append(row);
            });
            updateEpisodeCountdowns();
            if(!episodeCountdownTimer && document.querySelector(".episode-countdown[data-episode-target]")){
              episodeCountdownTimer=setInterval(updateEpisodeCountdowns,1000);
            }
            loaded=true;
          }catch(err){episodeArea.replaceChildren();const error=document.createElement("p");error.className="episode-status";error.textContent=err.message;episodeArea.append(error);}
          finally{loading=false;}
        };
        seasonBlock.append(toggle,episodeArea);seasonList.append(seasonBlock);
      });
    }

    const actions=document.createElement("div");actions.className="detail-actions";
    const save=document.createElement("button");save.className="cta";save.textContent="＋ Add to watchlist";
    save.onclick=async()=>{await saveWatch({...data,media_type:type});save.textContent="Added (if signed in)";};
    actions.append(save);
    const close=document.createElement("button");close.className="ghost";close.textContent="Close";close.onclick=closeDetails;actions.append(close);
    content.append(actions);

    const attribution=document.createElement("small");attribution.className="tmdb-attribution";
    attribution.textContent="Movie and TV data provided by TMDB. Ratings are user/community scores and may change.";
    content.append(attribution);
  }catch(error){
    content.replaceChildren();
    const message=document.createElement("p");message.className="detail-error";message.textContent=error.message;
    const retry=document.createElement("button");retry.className="ghost";retry.textContent="Close";retry.onclick=closeDetails;
    content.append(message,retry);
  }
}

// COMING SOON discovery hub: upcoming movies and series, filterable by genre.
const comingState = { media: "movie", genre: "", page: 1, totalPages: 1, busy: false, genres: { movie: [], tv: [] } };
const comingGenreFallback = [
  { id: 28, name: "Action" }, { id: 12, name: "Adventure" }, { id: 16, name: "Animation" },
  { id: 35, name: "Comedy" }, { id: 80, name: "Crime" }, { id: 99, name: "Documentary" },
  { id: 18, name: "Drama" }, { id: 10751, name: "Family" }, { id: 14, name: "Fantasy" },
  { id: 27, name: "Horror" }, { id: 9648, name: "Mystery" }, { id: 10749, name: "Romance" },
  { id: 878, name: "Science Fiction" }, { id: 53, name: "Thriller" }, { id: 10752, name: "War" }
];
async function loadComingGenres(media) {
  const select = $("comingGenre");
  select.replaceChildren();
  const all = document.createElement("option"); all.value = ""; all.textContent = "All genres"; select.append(all);
  let genres = comingState.genres[media];
  if (!genres.length) {
    try {
      const response = await fetch(`/api/tmdb?action=genres&media=${media}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load genres.");
      genres = data.genres || [];
      comingState.genres[media] = genres;
    } catch (error) {
      // The common genre list keeps the discovery panel usable if genre lookup is temporarily unavailable.
      genres = comingGenreFallback;
    }
  }
  genres.slice().sort((a,b)=>a.name.localeCompare(b.name)).forEach(genre=>{
    const option=document.createElement("option");option.value=String(genre.id);option.textContent=genre.name;select.append(option);
  });
  select.value = comingState.genre;
}
async function loadComingSoon(reset=true) {
  if (comingState.busy) return;
  if (reset) { comingState.page=1; $("comingResults").replaceChildren(); }
  comingState.busy=true;
  const status=$("comingStatus"), more=$("comingMore");
  status.textContent=reset?`Finding upcoming ${comingState.media === "movie" ? "movies" : "series"}…`:"Loading more titles…";
  more.disabled=true;
  try {
    const params=new URLSearchParams({action:"discover",media:comingState.media,page:String(comingState.page)});
    if(comingState.genre)params.set("genre",comingState.genre);
    const response=await fetch(`/api/tmdb?${params}`),data=await response.json();
    if(!response.ok)throw new Error(data.error||"Could not load upcoming titles.");
    const today = new Date(); today.setHours(0,0,0,0);
    const results=(data.results||[]).filter(item=>item.release_date && new Date(`${item.release_date}T00:00:00`) >= today);
    if(reset && !results.length){status.textContent="No upcoming titles found for this filter yet. Try another genre.";}
    else if(reset){status.textContent=`${comingState.media === "movie" ? "Upcoming movies" : "Upcoming series"} selected for you`;} 
    results.forEach(item=>$("comingResults").append(titleCard(item)));
    comingState.totalPages=Math.min(data.total_pages||1,10);
    more.hidden=comingState.page>=comingState.totalPages || results.length===0;
    if(!reset && !results.length)status.textContent="No more titles in this selection.";
  } catch(error) {
    status.textContent=error.message;
    more.hidden=true;
  } finally { comingState.busy=false;more.disabled=false; }
}
function setupComingSoon(){
  document.querySelectorAll(".coming-tab").forEach(button=>button.addEventListener("click",async()=>{
    if(button.dataset.media===comingState.media)return;
    comingState.media=button.dataset.media;comingState.genre="";
    document.querySelectorAll(".coming-tab").forEach(tab=>tab.classList.toggle("active",tab===button));
    await loadComingGenres(comingState.media);await loadComingSoon(true);
  }));
  $("comingGenre").addEventListener("change",()=>{comingState.genre=$("comingGenre").value;loadComingSoon(true);});
  $("comingMore").addEventListener("click",()=>{if(comingState.page<comingState.totalPages){comingState.page++;loadComingSoon(false);}});
  loadComingGenres("movie").then(()=>loadComingSoon(true));
}
setupComingSoon();


async function searchTitles(){
  const term=$("searchInput").value.trim();if(!term){$("searchStatus").textContent="Enter a title to search.";return;}
  $("searchStatus").textContent="Searching the catalogue…";$("results").replaceChildren();
  try{
    const r=await fetch(`/api/tmdb?q=${encodeURIComponent(term)}`), data=await r.json();
    if(!r.ok) throw new Error(data.error||"Search failed.");
    $("searchStatus").textContent=data.results.length?`${data.results.length} results`:"No matching titles found.";
    data.results.forEach(x=>$("results").append(titleCard(x)));
  }catch(e){$("searchStatus").textContent=e.message;}
}
$("searchBtn").onclick=searchTitles;
$("searchInput").addEventListener("keydown",e=>{if(e.key==="Enter")searchTitles();});
async function saveWatch(item){
  if(!currentUser){showAuth();authStatus("Sign in to save titles to your watchlist.");return;}
  try{await addDoc(collection(db,"users",currentUser.uid,"watchlist"),{tmdbId:item.id,media_type:item.media_type,title:item.title,overview:item.overview||"",poster_path:item.poster_path||null,release_date:item.release_date||null,addedAt:serverTimestamp()});}
  catch(e){$("watchCount").textContent=e.message;}
}
async function removeWatch(id){if(!currentUser)return;try{await deleteDoc(doc(db,"users",currentUser.uid,"watchlist",id));}catch(e){console.error(e);}}
function renderWatchlist(items){
  $("watchlistItems").replaceChildren();$("watchCount").textContent=currentUser?`${items.length} saved title${items.length===1?"":"s"}`:"Sign in to sync across devices";
  if(!items.length){const empty=document.createElement("div");empty.className="empty";empty.textContent=currentUser?"Your watchlist is empty. Search for a title and save it here.":"Your saved titles will appear here after you sign in."; $("watchlistItems").append(empty);return;}
  items.forEach(item=>$("watchlistItems").append(titleCard(item,true)));
}
async function enableReleaseAlerts(){
  if(!currentUser){showAuth();authStatus("Sign in first to connect release alerts to your watchlist.");return;}
  const status=$("alertStatus"), button=$("enableAlerts");
  try{
    button.disabled=true;status.textContent="Connecting notifications…";
    const OneSignal=await window.oneSignalReady;
    await OneSignal.login(currentUser.uid);
    await OneSignal.Notifications.requestPermission();
    const permission=OneSignal.Notifications.permission;
    await setDoc(doc(db,"users",currentUser.uid,"settings","notifications"),{releaseAlerts:permission===true,updatedAt:serverTimestamp()},{merge:true});
    status.textContent=permission===true?"This device is subscribed. REELORA can now send release alerts when scheduled.":"Notifications were not allowed. Enable them in your browser settings to receive alerts.";
    button.textContent=permission===true?"Alerts enabled":"Try again";
  }catch(e){status.textContent=e.message||"Could not enable notifications.";}
  finally{button.disabled=false;}
}
$("enableAlerts").onclick=enableReleaseAlerts;
function openChat() {
  $("chatPanel").classList.add("open");
  document.body.classList.add("vision-chat-open");
  setTimeout(() => $("visionInput").focus(), 100);
}
function closeChat() {
  $("chatPanel").classList.remove("open");
  document.body.classList.remove("vision-chat-open");
  stopVisionAudio();
  stopLiveTalk();
}
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && $("chatPanel").classList.contains("open")) closeChat();
});
$("floatVision").onclick = openChat;
$("openVision").onclick = openChat;
$("closeVision").onclick = closeChat;

let activeAudio = null, audioUrls = [], recognition = null, isListening = false;
let speechRunId = 0, liveTalkEnabled = false, liveRecognition = null;
let lastAssistantBubble = null;

function stopVisionAudio() {
  speechRunId++;
  if (activeAudio) { activeAudio.pause(); activeAudio = null; }
  audioUrls.forEach(URL.revokeObjectURL);
  audioUrls = [];
  document.querySelectorAll(".listen-vision").forEach(b => {
    b.disabled = false;
    b.classList.remove("speaking");
    b.setAttribute("aria-label", "Read VISION's reply aloud");
  });
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}
function scrollChat() {
  const box = $("chatMessages");
  requestAnimationFrame(() => { box.scrollTo({top: box.scrollHeight, behavior: "smooth"}); });
}
function copyText(text, button) {
  const done = () => {
    const old = button.innerHTML;
    button.innerHTML = "✓";
    button.setAttribute("aria-label", "Copied");
    setTimeout(() => { button.innerHTML = old; button.setAttribute("aria-label", "Copy message"); }, 1300);
  };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, button, done));
  } else fallbackCopy(text, button, done);
}
function fallbackCopy(text, button, done) {
  const field = document.createElement("textarea");
  field.value = text;
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  field.select();
  try { document.execCommand("copy"); done(); }
  catch { button.setAttribute("aria-label", "Copy failed"); }
  field.remove();
}
function addBubble(role, text, options = {}) {
  const bubble = document.createElement("article");
  bubble.className = `bubble ${role}`;
  bubble.dataset.role = role;
  const body = document.createElement("div");
  body.className = "bubble-text";
  body.textContent = text;
  bubble.append(body);

  if (role !== "system" && !options.pending) {
    const controls = document.createElement("div");
    controls.className = "bubble-controls";

    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "chat-tool copy-message";
    copy.innerHTML = "▢";
    copy.title = "Copy full message";
    copy.setAttribute("aria-label", "Copy message");
    copy.onclick = () => copyText(body.textContent, copy);
    controls.append(copy);

    if (role === "assistant") {
      const speak = document.createElement("button");
      speak.type = "button";
      speak.className = "chat-tool listen-vision";
      speak.innerHTML = "🔊";
      speak.title = "Read reply aloud";
      speak.setAttribute("aria-label", "Read VISION's reply aloud");
      speak.onclick = () => speakVision(body.textContent, speak);
      controls.append(speak);
      const regenerate = document.createElement("button");
      regenerate.type = "button";
      regenerate.className = "chat-tool regenerate-message";
      regenerate.innerHTML = "↻";
      regenerate.title = "Regenerate reply";
      regenerate.setAttribute("aria-label", "Regenerate reply");
      regenerate.onclick = () => regenerateAssistantReply(bubble);
      controls.append(regenerate);
    } else if (role === "user") {
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "chat-tool edit-message";
      edit.innerHTML = "✎";
      edit.title = "Edit message";
      edit.setAttribute("aria-label", "Edit message");
      edit.onclick = () => editUserMessage(bubble);
      controls.append(edit);
    }
    bubble.append(controls);
  }
  $("chatMessages").append(bubble);
  scrollChat();
  if (role === "assistant" && !options.pending) lastAssistantBubble = bubble;
  return bubble;
}
function splitForSpeech(text, max = 185) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const parts = [];
  let part = "";
  for (const word of words) {
    if ((part + " " + word).trim().length > max) {
      if (part) parts.push(part);
      part = word;
    } else part = (part + " " + word).trim();
  }
  if (part) parts.push(part);
  return parts;
}
function browserSpeak(text) {
  return new Promise((resolve, reject) => {
    if (!("speechSynthesis" in window) || !window.SpeechSynthesisUtterance) {
      reject(new Error("This browser does not support spoken replies."));
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.94;
    utterance.pitch = 0.88;
    utterance.onend = resolve;
    utterance.onerror = () => reject(new Error("Browser voice playback failed."));
    window.speechSynthesis.speak(utterance);
  });
}
async function speakVision(text, button, preferBrowser = false) {
  stopVisionAudio();
  const runId = speechRunId;
  button.disabled = true;
  button.classList.add("speaking");
  button.innerHTML = "…";
  const bubble = button.closest(".bubble");
  const oldError = bubble?.querySelector(".voice-error");
  if (oldError) oldError.remove();

  try {
    if (preferBrowser) {
      await browserSpeak(text);
    } else {
      for (const chunk of splitForSpeech(text)) {
        if (runId !== speechRunId) return;
        const response = await fetch("/api/vision-speech", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({text: chunk})
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `Voice request failed (${response.status}).`);
        }
        const url = URL.createObjectURL(await response.blob());
        audioUrls.push(url);
        if (runId !== speechRunId) return;
        await new Promise((resolve, reject) => {
          const audio = new Audio(url);
          activeAudio = audio;
          audio.onended = resolve;
          audio.onpause = resolve;
          audio.onerror = () => reject(new Error("Audio playback failed."));
          audio.play().catch(reject);
        });
      }
    }
  } catch (error) {
    // If Groq voice access has not been approved yet, keep the Listen control useful.
    if (!preferBrowser && runId === speechRunId) {
      try { await browserSpeak(text); }
      catch (fallbackError) {
        const status = document.createElement("small");
        status.className = "voice-error";
        status.textContent = error.message || fallbackError.message;
        bubble?.append(status);
      }
    } else if (runId === speechRunId) {
      const status = document.createElement("small");
      status.className = "voice-error";
      status.textContent = error.message;
      bubble?.append(status);
    }
  } finally {
    if (runId === speechRunId) {
      activeAudio = null;
      button.disabled = false;
      button.classList.remove("speaking");
      button.innerHTML = "🔊";
    }
  }
}

function editUserMessage(bubble) {
  const body = bubble.querySelector(".bubble-text");
  const original = body.textContent;
  const editor = document.createElement("textarea");
  editor.className = "message-editor";
  editor.value = original;
  editor.rows = Math.min(6, Math.max(2, original.split("\n").length));
  body.replaceWith(editor);

  const controls = document.createElement("div");
  controls.className = "edit-controls";
  const save = document.createElement("button");
  save.className = "chat-action primary";
  save.textContent = "Save & regenerate";
  const cancel = document.createElement("button");
  cancel.className = "chat-action";
  cancel.textContent = "Cancel";
  cancel.onclick = () => { editor.replaceWith(body); controls.remove(); };
  save.onclick = async () => {
    const revised = editor.value.trim();
    if (!revised) return;
    const index = [...$("chatMessages").children].indexOf(bubble);
    const historyIndex = chatHistory.findIndex((m, i) => m.role === "user" && m.content === original && i <= index);
    if (historyIndex < 0) { editor.replaceWith(body); controls.remove(); return; }
    chatHistory = chatHistory.slice(0, historyIndex);
    chatHistory.push({role:"user", content:revised});
    body.textContent = revised;
    editor.replaceWith(body);
    controls.remove();
    while (bubble.nextElementSibling) bubble.nextElementSibling.remove();
    await requestVisionReply();
  };
  controls.append(cancel, save);
  bubble.append(controls);
  editor.focus();
}

async function regenerateAssistantReply(bubble) {
  let previous = bubble.previousElementSibling;
  while (previous && !previous.classList.contains("user")) previous = previous.previousElementSibling;
  if (!previous) return;
  const prompt = previous.querySelector(".bubble-text")?.textContent || "";
  const historyIndex = chatHistory.map((m, i) => ({m, i}))
    .filter(x => x.m.role === "user" && x.m.content === prompt)
    .pop()?.i;
  if (historyIndex === undefined) return;
  chatHistory = chatHistory.slice(0, historyIndex + 1);
  let node = bubble;
  while (node) {
    const next = node.nextElementSibling;
    node.remove();
    node = next;
  }
  await requestVisionReply();
}

async function requestVisionReply() {
  stopVisionAudio();
  const pending = addBubble("assistant", "VISION is thinking…", {pending:true});
  $("sendVision").disabled = true;
  try {
    const response = await fetch("/api/vision", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({messages:chatHistory})
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "VISION is unavailable.");
    pending.remove();
    const replyBubble = addBubble("assistant", data.reply || "I couldn't form a reply just now.");
    chatHistory.push({role:"assistant",content:data.reply || ""});
    if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
    if (liveTalkEnabled) {
      const voiceButton = replyBubble.querySelector(".listen-vision");
      if (voiceButton) await speakVision(data.reply, voiceButton);
      if (liveTalkEnabled) startLiveRecognition();
    }
  } catch (error) {
    pending.querySelector(".bubble-text").textContent = error.message;
    chatHistory.pop();
  } finally {
    $("sendVision").disabled = false;
    scrollChat();
  }
}
async function sendVision() {
  const input = $("visionInput");
  const text = input.value.trim();
  if (!text || $("sendVision").disabled) return;
  stopVisionAudio();
  input.value = "";
  addBubble("user", text);
  chatHistory.push({role:"user",content:text});
  await requestVisionReply();
}
$("sendVision").onclick = sendVision;
$("visionInput").addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendVision(); }
});
$("visionInput").addEventListener("input", () => {
  $("visionInput").style.height = "auto";
  $("visionInput").style.height = Math.min($("visionInput").scrollHeight, 140) + "px";
});

// One-tap live conversation. Speech recognition is provided by the browser;
// replies use VISION's speech endpoint, with browser speech as a fallback.
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
function setLiveState(on, message) {
  liveTalkEnabled = on;
  const button = $("liveTalk");
  button?.classList.toggle("live-active", on);
  if (button) button.setAttribute("aria-label", on ? "End live talk" : "Start live talk");
  const status = $("liveStatus");
  if (status) status.textContent = message || (on ? "Listening for you…" : "Live talk is off");
}
function startLiveRecognition() {
  if (!liveTalkEnabled) return;
  if (!SpeechRecognition) {
    setLiveState(false, "Live speech recognition isn't supported in this browser.");
    return;
  }
  try {
    liveRecognition = new SpeechRecognition();
    liveRecognition.lang = "en-NG";
    liveRecognition.interimResults = true;
    liveRecognition.continuous = false;
    let finalText = "";
    liveRecognition.onresult = event => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }
      $("visionInput").value = (finalText || interim).trim();
    };
    liveRecognition.onerror = event => {
      if (event.error !== "no-speech" && event.error !== "aborted") setLiveState(false, "Microphone: " + event.error);
    };
    liveRecognition.onend = async () => {
      liveRecognition = null;
      const spoken = finalText.trim();
      if (!liveTalkEnabled) return;
      if (spoken) {
        $("visionInput").value = spoken;
        await sendVision();
      } else {
        setLiveState(true, "Didn't catch that. Listening again…");
        setTimeout(startLiveRecognition, 350);
      }
    };
    setLiveState(true, "Listening… speak naturally");
    liveRecognition.start();
  } catch (error) {
    setLiveState(false, "Couldn't start the microphone. Check browser permission.");
  }
}
function stopLiveTalk() {
  liveTalkEnabled = false;
  if (liveRecognition) {
    const active = liveRecognition;
    liveRecognition = null;
    try { active.onend = null; active.stop(); } catch {}
  }
  setLiveState(false, "Live talk is off");
}

$("visionMic").onclick = () => {
  if (!SpeechRecognition) {
    $("liveStatus").textContent = "Voice input isn't supported in this browser.";
    return;
  }
  if (isListening && recognition) { recognition.stop(); return; }
  try {
    recognition = new SpeechRecognition();
    recognition.lang = "en-NG";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onstart = () => { isListening = true; $("visionMic").classList.add("listening"); };
    recognition.onresult = event => {
      let value = "";
      for (let i = event.resultIndex; i < event.results.length; i++) value += event.results[i][0].transcript;
      $("visionInput").value = value.trim();
    };
    recognition.onerror = () => { isListening = false; $("visionMic").classList.remove("listening"); };
    recognition.onend = () => { isListening = false; $("visionMic").classList.remove("listening"); };
    recognition.start();
  } catch (error) { console.warn("VISION microphone:", error); }
};

$("liveTalk").onclick = () => {
  if (liveTalkEnabled) {
    stopLiveTalk();
    stopVisionAudio();
  } else {
    if (!SpeechRecognition) {
      setLiveState(false, "Live talk needs a browser with speech recognition.");
      return;
    }
    setLiveState(true, "Starting microphone…");
    startLiveRecognition();
  }
};

const welcomeBubble = $("chatMessages").querySelector(".bubble.assistant");
if (welcomeBubble) {
  const welcomeCopy = welcomeBubble.querySelector(".copy-message");
  const welcomeSpeak = welcomeBubble.querySelector(".listen-vision");
  if (welcomeCopy) welcomeCopy.onclick = () => copyText(welcomeBubble.querySelector(".bubble-text").textContent, welcomeCopy);
  if (welcomeSpeak) welcomeSpeak.onclick = () => speakVision(welcomeBubble.querySelector(".bubble-text").textContent, welcomeSpeak);
}

$("stopVisionAudio").onclick = stopVisionAudio;
