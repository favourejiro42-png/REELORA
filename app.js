import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

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
let chatHistory = [];

function authStatus(message){ $("authStatus").textContent = message; }
function showAuth(){ $("authModal").classList.remove("hidden"); }
function hideAuth(){ $("authModal").classList.add("hidden"); }
$("authOpen").onclick = () => currentUser ? signOut(auth) : showAuth();
$("authClose").onclick = hideAuth;
$("loginBtn").onclick = async () => { try { await signInWithEmailAndPassword(auth,$("email").value,$("password").value); hideAuth(); } catch(e){authStatus(e.message);} };
$("registerBtn").onclick = async () => { try { await createUserWithEmailAndPassword(auth,$("email").value,$("password").value); hideAuth(); } catch(e){authStatus(e.message);} };
$("googleBtn").onclick = async () => { try { await signInWithPopup(auth,new GoogleAuthProvider()); hideAuth(); } catch(e){authStatus(e.message);} };

onAuthStateChanged(auth, user => {
  currentUser = user;
  $("userLabel").textContent = user ? (user.displayName || user.email || "Signed in") : "Not signed in";
  $("authOpen").textContent = user ? "Sign out" : "Sign in";
  if (stopWatchlist) stopWatchlist();
  if (user) {
    const q = query(collection(db,"users",user.uid,"watchlist"),orderBy("addedAt","desc"),limit(50));
    stopWatchlist = onSnapshot(q,snap => renderWatchlist(snap.docs.map(d=>({id:d.id,...d.data()}))),err => console.error(err));
  } else {
    renderWatchlist([]);
  }
});
function posterUrl(path){return path ? `https://image.tmdb.org/t/p/w342${path}` : "";}
function titleCard(item, saved=false) {
  const card=document.createElement("article");card.className="title-card";
  const img=document.createElement("img");img.alt=item.title;img.loading="lazy";
  if(item.poster_path) img.src=posterUrl(item.poster_path); else img.style.visibility="hidden";
  const info=document.createElement("div");info.className="title-info";
  const title=document.createElement("b");title.textContent=item.title;
  const meta=document.createElement("small");meta.textContent=`${item.media_type==="tv"?"TV series":"Movie"}${item.release_date?" · "+item.release_date.slice(0,4):""}`;
  const btn=document.createElement("button");btn.className="save-btn";btn.textContent=saved?"Remove from watchlist":"＋ Add to watchlist";
  btn.onclick=()=>saved?removeWatch(item.id):saveWatch(item);
  info.append(title,meta,btn);card.append(img,info);return card;
}
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
function openChat(){$("chatPanel").classList.add("open");$("visionInput").focus();}
function closeChat(){$("chatPanel").classList.remove("open");}
$("floatVision").onclick=openChat;$("openVision").onclick=openChat;$("closeVision").onclick=closeChat;
function addBubble(role,text){const b=document.createElement("div");b.className=`bubble ${role}`;b.textContent=text;$("chatMessages").append(b);$("chatMessages").scrollTop=$("chatMessages").scrollHeight;return b;}
async function sendVision(){
  const input=$("visionInput"), text=input.value.trim();if(!text)return;
  input.value="";addBubble("user",text);chatHistory.push({role:"user",content:text});
  const pending=addBubble("assistant","VISION is thinking…");$("sendVision").disabled=true;
  try{
    const r=await fetch("/api/vision",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:chatHistory})});
    const data=await r.json();if(!r.ok)throw new Error(data.error||"VISION is unavailable.");
    pending.textContent=data.reply;chatHistory.push({role:"assistant",content:data.reply});
    if(chatHistory.length>20)chatHistory=chatHistory.slice(-20);
  }catch(e){pending.textContent=e.message;chatHistory.pop();}
  finally{$("sendVision").disabled=false;}
}
$("sendVision").onclick=sendVision;
$("visionInput").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendVision();}});
