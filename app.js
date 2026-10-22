import {initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getAuth,onAuthStateChanged,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,sendPasswordResetEmail} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {getFirestore,collection,collectionGroup,doc,getDoc,getDocs,setDoc,addDoc,updateDoc,deleteDoc,query,where,orderBy,limit,onSnapshot,serverTimestamp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {firebaseConfig} from "./firebase-config.js";

const fb = initializeApp(firebaseConfig), auth = getAuth(fb), db = getFirestore(fb);
const $ = s => document.querySelector(s), app = $("#app");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const CATS = {
  borrow:{name:"Borrow & Share",icon:"🧰",ph:"Condition, how long it can be borrowed…",ask:"Request to borrow"},
  ask:{name:"Ask People",icon:"💬",ph:"Topic (e.g. cooking, legal, bikes)…",ask:null},
  build:{name:"Build Together",icon:"🛠️",ph:"Skills or roles you need / offer…",ask:"I'm interested"},
  give:{name:"Give & Get",icon:"🎁",ph:"Item condition, pickup details…",ask:"Ask for this"},
  local:{name:"Find Local Help",icon:"📍",ph:"When, how long, any tools needed…",ask:"Offer / request help"}
};
let user = null, profile = null, admin = false, unsubs = [], live = [], unreadMsgs = 0, unreadNotes = 0;
const toast = m => { const t=$("#toast"); t.textContent=m; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),3000); };
const errMsg = e => ({"auth/invalid-credential":"Email or password is wrong.","auth/email-already-in-use":"That email already has an account.","auth/weak-password":"Use a password of at least 6 characters.","auth/invalid-email":"That email address looks wrong.","permission-denied":"You aren't allowed to do that."}[e.code?.replace("firestore/","")] || e.message || "Something went wrong.");
const when = t => t?.toDate ? t.toDate().toLocaleString([], {dateStyle:"medium",timeStyle:"short"}) : "just now";
const go = h => { location.hash = h; };
const clearLive = () => { live.forEach(u=>u()); live = []; };
const notify = (toUid, text, link) => toUid && toUid !== user.uid && addDoc(collection(db,"notifications"),{toUid,fromUid:user.uid,text,link,read:false,createdAt:serverTimestamp()}).catch(()=>{});
const cidOf = (a,b) => [a,b].sort().join("_");

/* ---------- shell ---------- */
function shell(){
  const t = (h,i,l,b=0) => `<a href="#/${h}" data-t="${h}"><b aria-hidden="true">${i}</b>${l}${b?`<span class="dot" aria-label="${b} unread">${b}</span>`:""}</a>`;
  $("#tabs").innerHTML = user ? t("","🏠","Home")+t("explore","🔎","Explore")+t("new","➕","Create")+t("messages","✉️","Messages",unreadMsgs)+t("profile/"+user.uid,"👤","Profile") : "";
  $("#topnav").innerHTML = user ? `<a class="btn sm alt" href="#/notifications" aria-label="Notifications">🔔${unreadNotes?` ${unreadNotes}`:""}</a>${admin?`<a class="btn sm gold" href="#/admin">Admin</a>`:""}<button class="btn sm alt" id="out">Log out</button>`
    : `<a class="btn sm alt" href="#/login">Log in</a><a class="btn sm" href="#/signup">Sign up</a>`;
  $("#out")?.addEventListener("click", ()=>signOut(auth));
  const cur = location.hash.split("/")[1] || ""; document.querySelectorAll("#tabs a").forEach(a=>a.classList.toggle("on",a.dataset.t===cur));
}
function startBadges(){
  unsubs.forEach(u=>u()); unsubs=[];
  if(!user) return;
  unsubs.push(onSnapshot(query(collection(db,"conversations"),where("participants","array-contains",user.uid)),s=>{unreadMsgs=s.docs.filter(d=>d.data().unreadFor===user.uid).length;shell();},()=>{}));
  unsubs.push(onSnapshot(query(collection(db,"notifications"),where("toUid","==",user.uid)),s=>{unreadNotes=s.docs.filter(d=>!d.data().read).length;shell();},()=>{}));
}

/* ---------- auth ---------- */
onAuthStateChanged(auth, async u => {
  user = u; profile = null; admin = false;
  if(u){
    try{ admin = (await getDoc(doc(db,"admins",u.uid))).exists(); }catch{}
    try{ const p = await getDoc(doc(db,"users",u.uid)); profile = p.exists()?p.data():null; }catch{}
  }
  startBadges(); shell(); route();
});
function authView(mode){
  const t = {login:"Log in",signup:"Create your account",reset:"Reset your password"}[mode];
  app.innerHTML = `<h2>${t}</h2><form class="card" id="f" novalidate>
   ${mode==="signup"?`<label for="n">Your name</label><input id="n" required maxlength="60" autocomplete="name">`:""}
   <label for="e">Email</label><input id="e" type="email" required autocomplete="email">
   ${mode!=="reset"?`<label for="p">Password</label><input id="p" type="password" required minlength="6" autocomplete="${mode==="signup"?"new-password":"current-password"}">`:""}
   <p class="err" id="er" role="alert"></p><button class="btn">${t}</button></form>
   <p>${mode!=="login"?`<a href="#/login">Log in</a> · `:""}${mode!=="signup"?`<a href="#/signup">Sign up</a> · `:""}${mode!=="reset"?`<a href="#/reset">Forgot password?</a>`:""}</p>`;
  $("#f").onsubmit = async ev => {
    ev.preventDefault(); const e=$("#e").value.trim(), p=$("#p")?.value, er=$("#er"); er.textContent="";
    try{
      if(mode==="signup"){
        const n=$("#n").value.trim(); if(!n) throw {message:"Please enter your name."};
        const c = await createUserWithEmailAndPassword(auth,e,p);
        const pr={name:n,bio:"",city:"",createdAt:serverTimestamp()}; await setDoc(doc(db,"users",c.user.uid),pr);
        profile={...pr}; toast("Welcome to NeedLoop!"); go("#/");
      } else if(mode==="login"){ await signInWithEmailAndPassword(auth,e,p); go("#/"); }
      else { await sendPasswordResetEmail(auth,e); toast("If that email has an account, a reset link is on its way."); }
    }catch(x){ er.textContent = errMsg(x); }
  };
}

/* ---------- views ---------- */
function landing(){
  app.innerHTML = `<section class="hero"><h1>Your neighbours have what you need.</h1>
  <p>NeedLoop is a community where people lend things, answer questions, find teammates, give stuff away and offer a hand nearby.</p>
  <div class="row"><a class="btn" href="#/signup">Sign up</a><a class="btn alt" href="#/login">Log in</a><a class="btn gold" href="#/explore">Explore</a></div></section>
  <div class="grid g2">${Object.entries(CATS).map(([k,c])=>`<div class="card"><h3>${c.icon} ${c.name}</h3></div>`).join("")}</div>`;
}
function home(){
  if(!user) return landing();
  app.innerHTML = `<h2>Hi ${esc(profile?.name||"there")} 👋</h2><div class="grid g2">${Object.entries(CATS).map(([k,c])=>`<a class="card" href="#/explore/${k}"><h3>${c.icon} ${c.name}</h3></a>`).join("")}</div><a class="btn" href="#/new">Create a post</a>`;
}
const postCard = (id,p) => `<a class="card" href="#/post/${id}"><span class="chip c">${CATS[p.category]?.name}</span><span class="chip">${p.type==="offer"?"Offering":"Needed"}</span>${p.status==="closed"?`<span class="chip on">Closed</span>`:""}<h3>${esc(p.title)}</h3><p>${esc(p.description.slice(0,140))}${p.description.length>140?"…":""}</p><span class="mut">${esc(p.ownerName)} · ${esc(p.location||"—")} · ${when(p.createdAt)}</span></a>`;

async function explore(cat=""){
  app.innerHTML = `<h2>${cat?CATS[cat]?.name:"Explore"}</h2>
  <div class="row">${[["","All"],...Object.entries(CATS).map(([k,c])=>[k,c.name])].map(([k,n])=>`<a class="chip ${k===cat?"on":""}" href="#/explore${k?"/"+k:""}">${n}</a>`).join("")}</div>
  <label for="q">Search</label><input id="q" type="search" placeholder="Search keywords">
  <div class="row"><div><label for="ty">Type</label><select id="ty"><option value="">Any</option><option value="offer">Offering</option><option value="need">Needed</option></select></div>
  <div><label for="st">Status</label><select id="st"><option value="open">Open</option><option value="">All</option><option value="closed">Closed</option></select></div></div>
  <div id="list" style="margin-top:14px"><p class="note">Loading…</p></div>`;
  let all=[];
  const draw=()=>{ const q=$("#q").value.toLowerCase(),ty=$("#ty").value,st=$("#st").value;
    const r=all.filter(([,p])=>(!cat||p.category===cat)&&(!ty||p.type===ty)&&(!st||p.status===st)&&(!q||(p.title+" "+p.description+" "+p.detail+" "+p.location).toLowerCase().includes(q)));
    $("#list").innerHTML = r.length? r.map(([i,p])=>postCard(i,p)).join("") : `<p class="note">No posts match yet. ${user?`<a href="#/new">Create the first one</a>`:`<a href="#/signup">Sign up</a> to post`}.</p>`; };
  ["q","ty","st"].forEach(i=>$("#"+i).addEventListener("input",draw));
  if(!user){ $("#list").innerHTML=`<p class="note"><a href="#/login">Log in</a> or <a href="#/signup">sign up</a> to browse community posts.</p>`; return; }
  try{ const s=await getDocs(query(collection(db,"posts"),orderBy("createdAt","desc"),limit(100))); all=s.docs.map(d=>[d.id,d.data()]); draw(); }
  catch(e){ $("#list").innerHTML=`<p class="err">${esc(errMsg(e))}</p>`; }
}

function postForm(id,p={}){
  if(!user) return go("#/login");
  app.innerHTML = `<h2>${id?"Edit post":"Create a post"}</h2><form class="card" id="f">
  <label for="c">Category</label><select id="c" ${id?"disabled":""}>${Object.entries(CATS).map(([k,c])=>`<option value="${k}" ${p.category===k?"selected":""}>${c.name}</option>`).join("")}</select>
  <label for="ty">This is</label><select id="ty"><option value="need" ${p.type==="need"?"selected":""}>Something I need</option><option value="offer" ${p.type==="offer"?"selected":""}>Something I'm offering</option></select>
  <label for="t">Title</label><input id="t" required maxlength="120" value="${esc(p.title)}">
  <label for="d">Description</label><textarea id="d" required maxlength="3000">${esc(p.description)}</textarea>
  <label for="de">Details</label><input id="de" maxlength="300" value="${esc(p.detail)}">
  <label for="l">Area (general area only – no street address)</label><input id="l" maxlength="100" value="${esc(p.location)}">
  ${id?`<label for="s">Status</label><select id="s"><option value="open">Open</option><option value="closed" ${p.status==="closed"?"selected":""}>Closed</option></select>`:""}
  <p class="err" id="er" role="alert"></p><button class="btn">${id?"Save changes":"Publish post"}</button></form>`;
  const ph=()=>$("#de").placeholder=CATS[$("#c").value].ph; $("#c").onchange=ph; ph();
  $("#f").onsubmit=async ev=>{ev.preventDefault();
    const data={title:$("#t").value.trim(),description:$("#d").value.trim(),detail:$("#de").value.trim(),location:$("#l").value.trim(),type:$("#ty").value};
    if(!data.title||!data.description) return $("#er").textContent="Title and description are required.";
    try{
      if(id){ await updateDoc(doc(db,"posts",id),{...data,status:$("#s").value}); toast("Saved"); go("#/post/"+id); }
      else { const r=await addDoc(collection(db,"posts"),{...data,category:$("#c").value,ownerId:user.uid,ownerName:profile?.name||"Member",status:"open",createdAt:serverTimestamp()}); toast("Published"); go("#/post/"+r.id); }
    }catch(e){ $("#er").textContent=errMsg(e); }};
}

async function postView(id){
  if(!user){ return authView("login"); }
  clearLive();
  let snap; try{ snap=await getDoc(doc(db,"posts",id)); }catch(e){ return app.innerHTML=`<p class="err">${esc(errMsg(e))}</p>`; }
  if(!snap.exists()) return app.innerHTML=`<p class="note">This post was removed or doesn't exist. <a href="#/explore">Back to Explore</a></p>`;
  const p=snap.data(), mine=p.ownerId===user.uid, c=CATS[p.category];
  app.innerHTML = `<a href="#/explore/${p.category}">← ${c.name}</a><article class="card"><span class="chip c">${c.name}</span><span class="chip">${p.type==="offer"?"Offering":"Needed"}</span><span class="chip ${p.status==="closed"?"on":""}">${p.status}</span>
  <h2>${esc(p.title)}</h2><p style="white-space:pre-wrap">${esc(p.description)}</p>${p.detail?`<p><b>Details:</b> ${esc(p.detail)}</p>`:""}<p class="mut">Area: ${esc(p.location||"—")} · ${when(p.createdAt)}</p>
  <p>Posted by <a href="#/profile/${p.ownerId}">${esc(p.ownerName)}</a></p>
  <div class="row">${mine?`<a class="btn sm" href="#/edit/${id}">Edit</a><button class="btn sm danger" id="del">Delete</button>`:`<a class="btn sm gold" href="#/chat/${p.ownerId}">Message</a><button class="btn sm alt" id="rep">Report</button>`}${admin&&!mine?`<button class="btn sm danger" id="del">Delete (admin)</button>`:""}</div></article>
  <div id="reqs"></div><section><h3>${p.category==="ask"?"Answers":"Replies"}</h3><div id="rl"><p class="note">Loading…</p></div>
  <form id="rf" class="card"><label for="rt">${p.category==="ask"?"Write an answer":"Write a reply"}</label><textarea id="rt" maxlength="2000" required></textarea><button class="btn sm">Post</button></form></section>`;
  $("#del")?.addEventListener("click",async()=>{ if(!confirm("Delete this post permanently?"))return; try{await deleteDoc(doc(db,"posts",id));toast("Deleted");go("#/explore");}catch(e){toast(errMsg(e));}});
  $("#rep")?.addEventListener("click",async()=>{ const r=prompt("Why are you reporting this post?"); if(!r?.trim())return; try{await addDoc(collection(db,"reports"),{reporterId:user.uid,postId:id,postTitle:p.title,reason:r.trim().slice(0,500),status:"open",createdAt:serverTimestamp()});toast("Report sent to moderators");}catch(e){toast(errMsg(e));}});
  $("#rf").onsubmit=async ev=>{ev.preventDefault();const text=$("#rt").value.trim();if(!text)return;
    try{await addDoc(collection(db,"posts",id,"replies"),{authorId:user.uid,authorName:profile?.name||"Member",text,helpful:false,createdAt:serverTimestamp()});notify(p.ownerId,`${profile?.name||"Someone"} replied to "${p.title}"`,"#/post/"+id);$("#rt").value="";}catch(e){toast(errMsg(e));}};
  live.push(onSnapshot(query(collection(db,"posts",id,"replies"),orderBy("createdAt")),s=>{
    $("#rl").innerHTML = s.empty?`<p class="note">No replies yet. Be the first.</p>`:s.docs.map(d=>{const r=d.data();return `<div class="card reply ${r.helpful?"helpful":""}"><b><a href="#/profile/${r.authorId}">${esc(r.authorName)}</a></b> ${r.helpful?`<span class="chip c">Marked helpful</span>`:""}<p style="white-space:pre-wrap">${esc(r.text)}</p><span class="mut">${when(r.createdAt)}</span>
      ${mine&&r.authorId!==user.uid?`<button class="btn sm alt" data-h="${d.id}" data-v="${!r.helpful}" data-a="${r.authorId}">${r.helpful?"Unmark helpful":"Mark helpful"}</button>`:""}</div>`}).join("");
    document.querySelectorAll("[data-h]").forEach(b=>b.onclick=async()=>{try{await updateDoc(doc(db,"posts",id,"replies",b.dataset.h),{helpful:b.dataset.v==="true"});if(b.dataset.v==="true")notify(b.dataset.a,`Your reply on "${p.title}" was marked helpful`,"#/post/"+id);}catch(e){toast(errMsg(e));}});
  },e=>$("#rl").innerHTML=`<p class="err">${esc(errMsg(e))}</p>`));
  if(p.category==="ask") return;
  if(mine){ // owner manages requests
    live.push(onSnapshot(collection(db,"posts",id,"requests"),s=>{
      $("#reqs").innerHTML=`<h3>Requests</h3>`+(s.empty?`<p class="note">No requests yet.</p>`:s.docs.map(d=>{const r=d.data();return `<div class="card"><b><a href="#/profile/${r.requesterId}">${esc(r.requesterName)}</a></b> <span class="chip">${r.status}</span><p>${esc(r.message)}</p><div class="row"><button class="btn sm" data-r="${d.id}" data-s="accepted">Accept</button><button class="btn sm alt" data-r="${d.id}" data-s="rejected">Decline</button><a class="btn sm gold" href="#/chat/${r.requesterId}">Message</a></div></div>`}).join(""));
      document.querySelectorAll("[data-r]").forEach(b=>b.onclick=async()=>{try{await updateDoc(doc(db,"posts",id,"requests",b.dataset.r),{status:b.dataset.s});notify(b.dataset.r,`Your request for "${p.title}" was ${b.dataset.s}`,"#/post/"+id);}catch(e){toast(errMsg(e));}});
    },()=>{}));
  } else if(c.ask && p.status==="open"){
    live.push(onSnapshot(doc(db,"posts",id,"requests",user.uid),s=>{
      if(s.exists()){const r=s.data();$("#reqs").innerHTML=`<div class="card">Your request: <span class="chip">${r.status}</span> <button class="btn sm danger" id="wd">Withdraw</button></div>`;$("#wd").onclick=()=>deleteDoc(doc(db,"posts",id,"requests",user.uid)).catch(e=>toast(errMsg(e)));}
      else{$("#reqs").innerHTML=`<form class="card" id="qf"><label for="qm">${c.ask}</label><textarea id="qm" maxlength="1000" required placeholder="Introduce yourself and explain"></textarea><button class="btn sm">Send request</button></form>`;
        $("#qf").onsubmit=async ev=>{ev.preventDefault();try{await setDoc(doc(db,"posts",id,"requests",user.uid),{requesterId:user.uid,requesterName:profile?.name||"Member",message:$("#qm").value.trim(),status:"pending",createdAt:serverTimestamp()});notify(p.ownerId,`New request on "${p.title}"`,"#/post/"+id);}catch(e){toast(errMsg(e));}};}
    },()=>{}));
  }
}

async function profileView(uid){
  if(!user) return authView("login");
  let s; try{ s=await getDoc(doc(db,"users",uid)); }catch(e){ return app.innerHTML=`<p class="err">${esc(errMsg(e))}</p>`; }
  if(!s.exists()) return app.innerHTML=`<p class="note">Profile not found.</p>`;
  const u=s.data(), mine=uid===user.uid; let posts=[];
  try{ posts=(await getDocs(query(collection(db,"posts"),where("ownerId","==",uid)))).docs; }catch{}
  // Badges are DERIVED from real data on every load – they can't be claimed or faked.
  const badges=[]; if(posts.length>=1)badges.push("First post"); if(posts.length>=5)badges.push("Active contributor"); if(new Set(posts.map(d=>d.data().category)).size>=3)badges.push("All-rounder");
  app.innerHTML=`<div class="card"><h2>${esc(u.name)}</h2><p>${esc(u.bio||"No bio yet.")}</p><p class="mut">${esc(u.city||"Area not shared")} · Member since ${u.createdAt?.toDate?u.createdAt.toDate().toLocaleDateString():"today"}</p>
  <p>${badges.map(b=>`<span class="chip">🏅 ${b}</span>`).join("")||`<span class="mut">No badges yet – they're earned from real activity.</span>`}</p>
  <div class="row">${mine?`<a class="btn sm" href="#/editprofile">Edit profile</a>`:`<a class="btn sm gold" href="#/chat/${uid}">Message</a>`}</div></div>
  <h3>Posts (${posts.length})</h3>${posts.map(d=>postCard(d.id,d.data())).join("")||`<p class="note">No posts yet.</p>`}`;
}
function editProfile(){
  if(!user) return go("#/login"); const p=profile||{name:"",bio:"",city:""};
  app.innerHTML=`<h2>Edit profile</h2><p class="mut">Name, bio and area are visible to other members. Your email is never shown.</p><form class="card" id="f"><label for="n">Name</label><input id="n" required maxlength="60" value="${esc(p.name)}"><label for="b">Bio</label><textarea id="b" maxlength="500">${esc(p.bio)}</textarea><label for="c">Area (e.g. town or neighbourhood)</label><input id="c" maxlength="60" value="${esc(p.city)}"><p class="err" id="er"></p><button class="btn">Save changes</button></form>`;
  $("#f").onsubmit=async ev=>{ev.preventDefault();try{const d={name:$("#n").value.trim(),bio:$("#b").value.trim(),city:$("#c").value.trim(),createdAt:p.createdAt||serverTimestamp()};await setDoc(doc(db,"users",user.uid),d);profile=d;toast("Saved");go("#/profile/"+user.uid);}catch(e){$("#er").textContent=errMsg(e);}};
}

function messages(){
  if(!user) return go("#/login"); clearLive();
  app.innerHTML=`<h2>Messages</h2><div id="cl"><p class="note">Loading…</p></div>`;
  live.push(onSnapshot(query(collection(db,"conversations"),where("participants","array-contains",user.uid)),s=>{
    const r=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.lastAt?.seconds||0)-(a.lastAt?.seconds||0));
    $("#cl").innerHTML=r.length?r.map(c=>{const o=c.participants.find(x=>x!==user.uid);return `<a class="card" href="#/chat/${o}"><b>${esc(c.names?.[o]||"Member")}</b> ${c.unreadFor===user.uid?`<span class="chip c">New</span>`:""}<br><span class="mut">${esc(c.lastMessage)} · ${when(c.lastAt)}</span></a>`}).join(""):`<p class="note">No conversations yet. Open a post or profile and tap Message.</p>`;
  },e=>$("#cl").innerHTML=`<p class="err">${esc(errMsg(e))}</p>`));
}
async function chat(other){
  if(!user) return go("#/login"); if(other===user.uid) return go("#/messages"); clearLive();
  let on="Member"; try{on=(await getDoc(doc(db,"users",other))).data()?.name||"Member";}catch{}
  const cid=cidOf(user.uid,other);
  app.innerHTML=`<a href="#/messages">← Messages</a><h2>${esc(on)}</h2><div id="ml" aria-live="polite"></div><form id="mf" class="row" style="margin-top:12px"><label for="mt" class="skip">Message</label><input id="mt" style="flex:1" maxlength="2000" required placeholder="Write a message"><button class="btn">Send</button></form>`;
  live.push(onSnapshot(query(collection(db,"conversations",cid,"messages"),orderBy("createdAt")),s=>{
    $("#ml").innerHTML=s.empty?`<p class="note">Say hello 👋</p>`:s.docs.map(d=>{const m=d.data();return `<div class="msg ${m.senderId===user.uid?"me":""}">${esc(m.text)}<br><span class="mut">${when(m.createdAt)}</span></div>`}).join("");
    window.scrollTo(0,document.body.scrollHeight);
    updateDoc(doc(db,"conversations",cid),{unreadFor:null}).catch(()=>{});
  },()=>{}));
  $("#mf").onsubmit=async ev=>{ev.preventDefault();const text=$("#mt").value.trim();if(!text)return;$("#mt").value="";
    try{
      await setDoc(doc(db,"conversations",cid),{participants:[user.uid,other].sort(),names:{[user.uid]:profile?.name||"Member",[other]:on},lastMessage:text.slice(0,80),lastAt:serverTimestamp(),unreadFor:other},{merge:true});
      await addDoc(collection(db,"conversations",cid,"messages"),{senderId:user.uid,text,createdAt:serverTimestamp()});
      notify(other,`New message from ${profile?.name||"someone"}`,"#/chat/"+user.uid);
    }catch(e){toast(errMsg(e));}};
}

function notifications(){
  if(!user) return go("#/login"); clearLive();
  app.innerHTML=`<h2>Notifications</h2><div id="nl"><p class="note">Loading…</p></div>`;
  live.push(onSnapshot(query(collection(db,"notifications"),where("toUid","==",user.uid)),s=>{
    const r=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)).slice(0,50);
    $("#nl").innerHTML=r.length?r.map(n=>`<a class="card" href="${esc(n.link)}" data-n="${n.id}">${n.read?"":`<span class="chip c">New</span>`}${esc(n.text)}<br><span class="mut">${when(n.createdAt)}</span></a>`).join(""):`<p class="note">You're all caught up.</p>`;
    document.querySelectorAll("[data-n]").forEach(a=>a.onclick=()=>updateDoc(doc(db,"notifications",a.dataset.n),{read:true}).catch(()=>{}));
  },()=>{}));
}

async function adminView(){
  if(!admin) return app.innerHTML=`<p class="note">Admins only.</p>`;
  app.innerHTML=`<h2>Moderation</h2><div id="al"><p class="note">Loading…</p></div>`;
  try{ const s=await getDocs(query(collection(db,"reports"),where("status","==","open")));
    $("#al").innerHTML=s.empty?`<p class="note">No open reports 🎉</p>`:s.docs.map(d=>{const r=d.data();return `<div class="card"><b>${esc(r.postTitle)}</b><p>${esc(r.reason)}</p><div class="row"><a class="btn sm alt" href="#/post/${r.postId}">View post</a><button class="btn sm danger" data-del="${r.postId}" data-id="${d.id}">Remove post</button><button class="btn sm" data-ok="${d.id}">Dismiss</button></div></div>`}).join("");
    document.querySelectorAll("[data-ok]").forEach(b=>b.onclick=async()=>{await updateDoc(doc(db,"reports",b.dataset.ok),{status:"dismissed"});adminView();});
    document.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{if(!confirm("Remove this post?"))return;await deleteDoc(doc(db,"posts",b.dataset.del));await updateDoc(doc(db,"reports",b.dataset.id),{status:"actioned"});adminView();});
  }catch(e){ $("#al").innerHTML=`<p class="err">${esc(errMsg(e))}</p>`; }
}

/* ---------- router ---------- */
function route(){
  clearLive(); shell();
  const [,a="",b=""]=location.hash.replace("#","").split("/");
  ({"":home,login:()=>authView("login"),signup:()=>authView("signup"),reset:()=>authView("reset"),explore:()=>explore(b),new:()=>postForm(),
    edit:async()=>{if(!user)return go("#/login");const s=await getDoc(doc(db,"posts",b));s.exists()&&s.data().ownerId===user.uid?postForm(b,s.data()):app.innerHTML=`<p class="note">You can only edit your own posts.</p>`;},
    post:()=>postView(b),profile:()=>profileView(b),editprofile:editProfile,messages,chat:()=>chat(b),notifications,admin:adminView}[a]||home)();
  app.focus({preventScroll:true}); window.scrollTo(0,0);
}
window.addEventListener("hashchange",route);
