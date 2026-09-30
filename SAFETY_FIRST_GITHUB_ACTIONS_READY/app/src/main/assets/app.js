
const app=document.getElementById("app");
const state={
 screen:"splash", score:86, journey:false, guardian:false, demo:true,
 contacts:loadContacts(),
 reports:[], timer:null, timerValue:10, sos:false, user:loadUser(),
 loginError:""
};

// Local app database for the HTML/PWA prototype. In a native APK this can be
// replaced with Room/SQLite/Firebase without changing the UI flow.
function dbGet(key,fallback){try{const v=localStorage.getItem(key);return v?JSON.parse(v):fallback}catch(e){return fallback}}
function dbSet(key,value){localStorage.setItem(key,JSON.stringify(value))}
function loadUsers(){return dbGet("herguard_users",[])}
function saveUsers(users){dbSet("herguard_users",users)}
function loadUser(){return dbGet("herguard_session",null)}
function validEmail(e){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)}
function logout(){localStorage.removeItem("herguard_session");state.user=null;state.screen="login";toast("Logged out");render()}
function loginUser(){
 const email=(document.getElementById("loginEmail")?.value||"").trim().toLowerCase();
 const password=document.getElementById("loginPassword")?.value||"";
 if(!validEmail(email)||!password){toast("Enter a valid email and password");return}
 const user=loadUsers().find(u=>u.email===email&&u.password===password);
 if(!user){toast("Invalid email or password. Please register first.");return}
 state.user={id:user.id,name:user.name,email:user.email,phone:user.phone};
 dbSet("herguard_session",state.user);
 state.screen="home";render();
}
function registerUser(){
 const name=(document.getElementById("regName")?.value||"").trim();
 const email=(document.getElementById("regEmail")?.value||"").trim().toLowerCase();
 const phone=(document.getElementById("regPhone")?.value||"").trim();
 const password=document.getElementById("regPassword")?.value||"";
 if(name.length<2){toast("Enter your full name");return}
 if(!validEmail(email)){toast("Enter a valid email");return}
 if(cleanPhone(phone).length<7){toast("Enter a valid phone number");return}
 if(password.length<6){toast("Password must be at least 6 characters");return}
 const users=loadUsers();
 if(users.some(u=>u.email===email)){toast("Account already exists. Please login.");return}
 const user={id:"u_"+Date.now(),name,email,phone:cleanPhone(phone),password};
 users.push(user);saveUsers(users);
 state.user={id:user.id,name:user.name,email:user.email,phone:user.phone};dbSet("herguard_session",state.user);
 state.screen="home";toast("Account created successfully");render();
}

const A="assets/";
let mapInstance=null;
let userMarker=null;
function loadContacts(){try{const x=JSON.parse(localStorage.getItem("herguard_contacts")||"null");if(Array.isArray(x)&&x.length)return x}catch(e){}return [{name:"Mother",phone:"",rel:"Mother",sos:true},{name:"Father",phone:"",rel:"Father",sos:false},{name:"Friend",phone:"",rel:"Friend",sos:false}]};
function saveContacts(){localStorage.setItem("herguard_contacts",JSON.stringify(state.contacts));}
function cleanPhone(p){return String(p||"").replace(/[^+0-9]/g,"")}
function contactForm(){return `<div class="card"><div class="h2">Add SOS Contact</div><div class="form-group"><div class="label">Name</div><input id="contactName" class="input" placeholder="e.g. Mother"></div><div class="form-group"><div class="label">Phone Number</div><input id="contactPhone" class="input" type="tel" placeholder="e.g. +91 98765 43210"></div><div class="form-group"><div class="label">Relationship</div><input id="contactRel" class="input" placeholder="e.g. Parent / Friend"></div><button class="primary" onclick="addContact()">ADD CONTACT</button></div>`}
function addContact(){const name=document.getElementById("contactName")?.value.trim();const phone=cleanPhone(document.getElementById("contactPhone")?.value);const rel=document.getElementById("contactRel")?.value.trim()||"Trusted Contact";if(!name||phone.length<7){toast("Enter a valid name and phone number");return}state.contacts.push({name,phone,rel,sos:state.contacts.length===0});saveContacts();toast(`${name} added as trusted contact`);render()}
function removeContact(i){const c=state.contacts[i];if(!confirm(`Remove ${c.name} from trusted contacts?`))return;state.contacts.splice(i,1);if(state.contacts.length&&!state.contacts.some(x=>x.sos))state.contacts[0].sos=true;saveContacts();render()}
function setSOSContact(i){state.contacts.forEach((c,j)=>c.sos=j===i);saveContacts();toast(`${state.contacts[i].name} is the primary SOS contact`);render()}
function callContact(i){
 const c=state.contacts[i];
 if(!c?.phone){toast("Add a phone number first");return false}
 const phone=cleanPhone(c.phone);
 // Native Android bridge: a WebView APK can expose window.Android.callPhone().
 // Fallback to tel: for browsers and wrappers that do not expose the bridge.
 try{if(window.Android&&typeof window.Android.callPhone==="function"){window.Android.callPhone(phone);return true}}catch(e){}
 window.location.href=`tel:${phone}`;
 return true;
}
function smsContact(i){const c=state.contacts[i];if(!c.phone){toast("Add a phone number first");return}const msg=encodeURIComponent(`SAFETY FIRST SOS: I may need help. My current location is being shared. Please contact me immediately.`);window.location.href=`sms:${cleanPhone(c.phone)}?body=${msg}`}
function shareSOS(){const names=state.contacts.filter(c=>c.sos).map(c=>c.name).join(", ")||"trusted contacts";const msg=`SAFETY FIRST SOS: Emergency activated. Please help me. Trusted contact: ${names}.`;if(navigator.share) navigator.share({title:"SAFETY FIRST SOS",text:msg}).catch(()=>{});else navigator.clipboard?.writeText(msg).then(()=>toast("SOS message copied")).catch(()=>toast("SOS message ready"))}
function requestLocationPermission(){
  try{if(window.Android&&typeof window.Android.requestLocationPermission==="function"){window.Android.requestLocationPermission();return}}catch(e){}
  if(!navigator.geolocation){toast("Location is not supported on this device");return}
  navigator.geolocation.getCurrentPosition(()=>{toast("Location permission enabled");if(mapInstance)locateMe(mapInstance)},err=>{
    if(err&&err.code===1){toast("Please allow Location permission in Android Settings");try{if(window.Android&&typeof window.Android.openLocationSettings==="function")window.Android.openLocationSettings()}catch(e){}}
    else toast("Turn on phone Location/GPS and try again")
  },{enableHighAccuracy:true,timeout:12000,maximumAge:0});
}
function openLocationSettings(){
  try{if(window.Android&&typeof window.Android.openLocationSettings==="function"){window.Android.openLocationSettings();return}}catch(e){}
  try{window.location.href="intent:#Intent;action=android.settings.LOCATION_SOURCE_SETTINGS;end"}catch(e){toast("Open Android Settings → Location and turn it on") }
}
function locateMe(map){if(!navigator.geolocation){toast("Location is not supported on this device");return}navigator.geolocation.getCurrentPosition(pos=>{const {latitude,longitude}=pos.coords;map.setView([latitude,longitude],16);if(userMarker)userMarker.setLatLng([latitude,longitude]);else userMarker=L.marker([latitude,longitude],{title:"My location"}).addTo(map).bindPopup("You are here").openPopup();toast("Current location found")},err=>{if(err&&err.code===1){toast("Location permission denied. Tap ENABLE GPS")}else if(err&&err.code===2){toast("GPS/location is off. Tap ENABLE GPS")}else toast("Unable to get your location")},{enableHighAccuracy:true,timeout:12000,maximumAge:10000})}
function mountMap(id){
 if(typeof L==="undefined"){toast("Map library is still loading");return}
 const el=document.getElementById(id);if(!el)return;
 if(mapInstance){try{mapInstance.remove()}catch(e){}mapInstance=null;userMarker=null}
 mapInstance=L.map(el,{zoomControl:false,attributionControl:true}).setView([13.1143,80.1548],13);
 L.control.zoom({position:"bottomright"}).addTo(mapInstance);
 L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap contributors"}).addTo(mapInstance);
 L.marker([13.1143,80.1548],{title:"Demo area"}).addTo(mapInstance).bindPopup("SAFETY FIRST map area");
 L.circle([13.1143,80.1548],{radius:450,color:"#1683F5",fillColor:"#1683F5",fillOpacity:.08}).addTo(mapInstance);
 setTimeout(()=>{mapInstance.invalidateSize();locateMe(mapInstance)},250);
}
function searchMap(){const q=document.getElementById("mapSearch")?.value.trim();if(!q||!mapInstance)return;fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,{headers:{Accept:"application/json"}}).then(r=>r.json()).then(rows=>{if(!rows.length){toast("Location not found");return}const x=rows[0];const lat=+x.lat,lon=+x.lon;mapInstance.setView([lat,lon],15);L.marker([lat,lon]).addTo(mapInstance).bindPopup(x.display_name).openPopup()}).catch(()=>toast("Search needs an internet connection"))}
function currentLocation(){if(mapInstance)locateMe(mapInstance)}
const navItems=[["home","⌂","Home"],["journey","⌁","Journey"],["map","⌖","Map"],["safety","♢","Safety"],["profile","♙","Profile"]];
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function toast(msg){const d=document.createElement("div");d.className="toast";d.textContent=msg;document.body.appendChild(d);setTimeout(()=>d.remove(),1800)}
function appbar(title,back=true,bell=true){return `<div class="appbar">${back?`<button class="back" onclick="goBack()">‹</button>`:""}<div class="title">${title}</div>${bell?`<div class="bell">♧</div>`:""}</div>`}
function nav(active){return `<nav class="nav">${navItems.map(([id,ic,t])=>`<button class="${active===id?"active":""}" onclick="route('${id}')"><span>${ic}</span><span>${t}</span></button>`).join("")}</nav>`}
function wrap(content,active="",noNav=false){return `<main class="screen">${content}</main>${noNav?"":nav(active)}`}
function goBack(){state.screen="home";render()}
function route(id){state.screen=id;render()}
function setScreen(id){state.screen=id;render()}
function splash(){setTimeout(()=>{if(state.screen==="splash"){state.screen="onboard";render()}},1800);return `<section class="hero"><img class="logo" src="${A}herguard-logo.jpg"><h1>SAFETY FIRST</h1><p>SAFETY FIRST. STAY CONNECTED. STAY SAFE.</p><div class="loader"><i></i></div></section>`}
function onboard(){return `<section class="onboard"><div class="label" style="margin-top:18px;color:#1683F5">WOMEN SAFETY</div><h1 style="margin-top:20px">Safety First<br>Every Journey</h1><p class="muted">Personal safety tools for<br>a safer journey.</p><img class="girl" src="${A}herguard-girl.jpg"><div class="dots"><b></b><b></b><b></b></div><button class="primary" onclick="setScreen('login')">NEXT</button><button style="margin-top:12px;border:0;background:none;color:#244766;font-weight:700" onclick="setScreen('login')">SKIP</button></section>`}
function login(){return `<section class="onboard" style="justify-content:center"><img class="login-logo" src="${A}herguard-logo.jpg"><h1>SAFETY FIRST</h1><p class="muted">Safety first. Stay connected. Stay safe.</p><div class="form-group"><input id="loginEmail" class="input" type="email" autocomplete="email" placeholder="✉  Email"></div><div class="form-group"><input id="loginPassword" class="input" type="password" autocomplete="current-password" placeholder="🔒  Password"></div><button class="primary" onclick="loginUser()">LOGIN</button><div class="small-note" style="margin:14px">Don't have an account?</div><button class="secondary" onclick="setScreen('register')">CREATE ACCOUNT</button></section>`}
function register(){return `<section class="screen"><div class="content">${appbar("Create Account",true,false)}<div class="card" style="margin-top:16px"><div class="form-group"><div class="label">Full Name</div><input id="regName" class="input" autocomplete="name" placeholder="Enter your name"></div><div class="form-group"><div class="label">Email</div><input id="regEmail" class="input" type="email" autocomplete="email" placeholder="Email"></div><div class="form-group"><div class="label">Phone</div><input id="regPhone" class="input" type="tel" autocomplete="tel" placeholder="Phone number"></div><div class="form-group"><div class="label">Password</div><input id="regPassword" class="input" type="password" autocomplete="new-password" placeholder="Minimum 6 characters"></div><label class="check"><input id="regAgree" type="checkbox"> I agree to the Privacy Policy.</label><button class="primary" onclick="if(!document.getElementById('regAgree').checked){toast('Please accept the Privacy Policy');return}registerUser()">CREATE ACCOUNT</button></div></div></section>`}
function home(){return wrap(`<div class="content">${`<div class="row" style="margin:3px 0 12px"><div><div class="label">SAFETY FIRST</div><div class="h1" style="font-size:24px;margin-bottom:0">Good Morning, ${esc(state.user?.name||"there")} 👋</div></div><span class="badge low">● PROTECTED</span></div>`}
<div class="card"><div class="label">Safety Score</div><div class="score-wrap" style="margin-top:8px"><div class="score-ring" style="background:conic-gradient(var(--green) 0 ${state.score}%,#E7EFF5 ${state.score}% 100%)"><strong>${state.score}</strong></div><div class="score-meta"><div><span class="big">${state.score}</span><span>/100</span></div><span class="badge ${state.score<40?"high":state.score<70?"mod":"low"}">${state.score<40?"HIGH RISK":state.score<70?"MODERATE RISK":"LOW RISK"}</span></div></div><div style="margin-top:13px"><button class="primary" onclick="setScreen('start')">START SAFE JOURNEY</button></div></div>
<div class="grid2"><div class="action-card" onclick="setScreen('guardian')"><div class="ico">🛡</div><strong>Silent Guardian</strong></div><div class="action-card" onclick="setScreen('sos')"><div class="ico">🚨</div><strong>Emergency SOS</strong></div></div>
<div class="card insight"><div class="label">AI Safety Insight</div><div style="margin-top:6px">Your current safety status appears normal.</div></div>
<div class="card location-card"><div class="row"><div><div class="label">Current Location</div><strong>Downtown Central & 5th Ave</strong></div><span class="badge" style="color:#1267D8;background:#EAF3FF">GPS Active</span></div><div class="line"></div><div class="stat3"><div><span>BATTERY</span><strong>94% Stable</strong></div><div><span>NETWORK</span><strong>5G Secure</strong></div><div><span>GUARDIAN</span><strong style="color:#0A9D70">Active</strong></div></div></div>
<div class="label" style="margin:18px 4px 8px">Safety Actions</div>
<div class="card" style="background:linear-gradient(135deg,#176FD9,#0B58B7);color:#fff;cursor:pointer" onclick="setScreen('start')"><div style="font-size:25px">➤</div><h2 style="margin:8px 0 3px;color:#fff">START SAFE JOURNEY</h2><div style="font-size:13px;opacity:.9">Real-time GPS tracking, safety guidance and AI risk scoring.</div></div></div>`,"home")}
function start(){return wrap(`<div class="content">${appbar("Start Safe Journey")}<div class="card" style="margin-top:16px"><div class="form-group"><div class="label">From</div><input class="input" value="Current Location" readonly></div><div class="form-group"><div class="label">To</div><input id="dest" class="input" placeholder="Enter destination"></div><label class="check"><input type="checkbox" checked> Share journey with trusted contacts</label><label class="check"><input type="checkbox" checked> Enable safety check-ins</label><button class="primary" onclick="startJourney()">START JOURNEY</button></div><div class="label">Recent Places</div><div class="place">🏠 Home <span class="muted">1.2 km</span></div><div class="place">🏫 College <span class="muted">3.8 km</span></div></div>`,"journey")}
function startJourney(){state.journey=true;state.score=86;toast("Journey started");setScreen("live")}
function live(){return wrap(`<div class="content">${appbar("Live Journey")}<div class="map"><span class="pin blue" style="left:30%;top:38%"></span><span class="pin" style="right:22%;top:22%"></span></div><div class="card route-card"><div class="row"><div><div class="label">Safety Score</div><strong style="font-size:30px">${state.score}<small>/100</small></strong></div><span class="badge low">LOW RISK</span></div><div class="line"></div><div class="row"><strong>College → Home</strong><span class="muted">ETA 24 min</span></div></div><div class="card"><div class="risk-row"><span>◷ Location Risk</span><span class="risk-pill risk-low">LOW</span></div><div class="risk-row"><span>◷ Time Risk</span><span class="risk-pill risk-low">LOW</span></div><div class="risk-row"><span>⌖ Route Risk</span><span class="risk-pill risk-mod">MODERATE</span></div></div><div class="grid2"><button class="primary" onclick="setScreen('analysis')">SAFETY ANALYSIS</button><button class="secondary" onclick="setScreen('guardian')">SILENT GUARDIAN</button></div><button class="danger" style="margin-top:10px" onclick="setScreen('sos')">🚨 SOS</button></div>`,"journey")}
function analysis(){return wrap(`<div class="content">${appbar("Safety Analysis")}<div class="card" style="margin-top:16px"><div class="row"><div><div class="label">Safety Score</div><strong style="font-size:30px">${state.score}<small>/100</small></strong></div><span class="badge ${state.score<70?"mod":"low"}">${state.score<70?"MODERATE RISK":"LOW RISK"}</span></div><div class="chart"><svg viewBox="0 0 360 120" preserveAspectRatio="none"><polyline points="10,25 90,38 170,58 250,80 340,102" fill="none" stroke="#1683F5" stroke-width="3"/><circle cx="10" cy="25" r="4" fill="#1683F5"/><circle cx="90" cy="38" r="4" fill="#1683F5"/><circle cx="170" cy="58" r="4" fill="#FFC107"/><circle cx="250" cy="80" r="4" fill="#FF6B4A"/><circle cx="340" cy="102" r="4" fill="#FF3045"/></svg><span class="chart-label">88 → 82 → 73 → 61 → 48</span></div></div><div class="card"><div class="h2">Risk Factor Analysis</div><div class="risk-row"><span>Location Risk</span><span class="risk-pill risk-mod">MODERATE</span></div><div class="risk-row"><span>Time Risk</span><span class="risk-pill risk-low">LOW</span></div><div class="risk-row"><span>Route Risk</span><span class="risk-pill risk-mod">MODERATE</span></div><div class="risk-row"><span>Environment Risk</span><span class="risk-pill risk-low">LOW</span></div><div class="risk-row"><span>Movement Risk</span><span class="risk-pill risk-low">LOW</span></div></div><div class="card insight"><strong>⚠ Recommendation</strong><p class="muted">Stay aware and consider a populated route.</p></div></div>`,"safety")}
function guardian(){return wrap(`<div class="content">${appbar("Silent Guardian")}<div class="card" style="margin-top:16px"><div class="row"><div><div class="label">Status</div><span class="badge low">● ${state.guardian?"ACTIVE":"INACTIVE"}</span></div><div class="label">Journey<br><strong style="color:var(--text)">College → Home</strong></div></div><div class="line"></div><div class="row"><div><div class="label">Safety Score</div><strong style="font-size:25px">${state.score}/100</strong></div><div><div class="label">Next Check-in</div><strong style="font-size:22px;color:${state.timerValue<5?"var(--red)":"var(--text)"}">00:${String(state.timerValue).padStart(2,"0")}</strong></div></div></div><div class="card"><div class="label">Check-in Interval</div><div class="grid2" style="margin-top:10px"><button class="secondary">15 min</button><button class="secondary">30 min</button><button class="secondary">60 min</button><button class="secondary" onclick="demoTimer()">Demo (10 sec)</button></div></div><button class="primary" onclick="activateGuardian()">${state.guardian?"GUARDIAN ACTIVE":"ACTIVATE SILENT GUARDIAN"}</button><div class="card insight" style="margin-top:14px">You will be asked “Are you safe?” at regular intervals.</div></div>`,"safety")}
function activateGuardian(){state.guardian=true;state.timerValue=10;toast("Silent Guardian activated");render()}
function demoTimer(){state.guardian=true;state.timerValue=10;clearInterval(state.timer);state.timer=setInterval(()=>{state.timerValue--;if(state.timerValue<=0){clearInterval(state.timer);setScreen("checkin")}render()},1000);render()}
function checkin(){return wrap(`<div class="content center">${appbar("Safety Check-in")}<div class="card" style="margin-top:18px;padding-top:28px"><h2>Are You Safe?</h2><div class="countdown"><span>00:${String(state.timerValue).padStart(2,"0")}</span></div><p class="muted">Please respond to confirm your safety.</p><button class="success" onclick="safe()">I'M SAFE</button><button class="danger" style="margin-top:10px" onclick="setScreen('sos')">NEED HELP</button></div></div>`,"safety")}
function safe(){state.timerValue=10;toast("Safety confirmed");setScreen("guardian")}
function sos(){return wrap(`<div class="content center">${appbar("Emergency")}<button class="sos sos-single" onclick="triggerImmediateSOS()" aria-label="Emergency SOS">🚨<br><span style="font-size:28px">SOS</span></button><h2>EMERGENCY SOS</h2><p class="muted">Tap once to immediately call your primary SOS contact</p><div class="card" style="text-align:left"><div class="h2">SOS Contacts</div>${state.contacts.length?state.contacts.map((c,i)=>`<div class="contact-row"><div><strong>👤 ${esc(c.name)}</strong><div class="muted">${esc(c.rel||"Trusted Contact")} · ${esc(c.phone||"No number")}</div></div><div class="contact-actions"><button onclick="callContact(${i})">☎</button><button onclick="smsContact(${i})">✉</button>${c.sos?`<span class="badge low">PRIMARY</span>`:""}</div></div>`).join(""):"<div class=muted>No SOS contacts added.</div>"}<button class="secondary" style="margin-top:12px" onclick="setScreen('contacts')">MANAGE SOS CONTACTS</button></div></div>`,"safety")}
let sosHold=null;
function sosHoldStart(){sosHold=setTimeout(()=>setScreen("emergency"),3000)}
function sosHoldEnd(){clearTimeout(sosHold)}
try{state.lastLocation=JSON.parse(localStorage.getItem("herguard_last_location")||"null")}catch(e){state.lastLocation=null}
function triggerImmediateSOS(){
  const i=state.contacts.findIndex(c=>c.sos);
  if(i<0||!state.contacts[i].phone){
    toast("Set a primary SOS contact with a phone number first");
    setScreen("contacts");
    return;
  }
  state.sos=true; saveContacts();
  const contact=state.contacts[i];
  const backend=window.HERGUARD_BACKEND_URL||"";
  const sendCloud=(lat,lon)=>{
    const payload=JSON.stringify({contactPhone:contact.phone,userName:state.user?.name||"the user",latitude:lat,longitude:lon});
    if(window.Android&&typeof window.Android.triggerCloudSOS==="function"&&backend&&!backend.includes("YOUR-RENDER-SERVICE")){
      window.Android.triggerCloudSOS(backend,payload);
      toast("Calling your SOS contact with SAFETY FIRST voice assistant…");
    } else {
      callContact(i);
      try{if(window.Android&&typeof window.Android.speakEmergency==="function")window.Android.speakEmergency(`SAFETY FIRST SOS activated for ${state.user?.name||"the user"}.`)}catch(e){}
    }
  };
  // Do not delay the emergency call waiting for GPS. Use a fresh location if available,
  // otherwise let the backend call immediately and share location when available later.
  let sent=false;
  try{
    const cached=state.lastLocation||null;
    if(cached) sendCloud(cached.latitude,cached.longitude);
    else sendCloud(null,null);
    sent=true;
  }catch(e){}
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(p=>{
      state.lastLocation={latitude:p.coords.latitude,longitude:p.coords.longitude};
      localStorage.setItem("herguard_last_location",JSON.stringify(state.lastLocation));
    },()=>{}, {enableHighAccuracy:true,timeout:5000,maximumAge:15000});
  }
}
function emergency(){const primary=state.contacts.findIndex(c=>c.sos);return `<main class="screen emergency"><div class="content">${appbar("Emergency Mode")}<div class="alert-card" style="margin-top:16px">🚨 EMERGENCY MODE ACTIVE</div><div class="card" style="margin-top:12px"><div class="risk-row"><span>📍 Current Location</span><strong>Live</strong></div><div class="risk-row"><span>◷ Time</span><strong>Now</strong></div><div class="risk-row"><span>♧ Journey</span><strong>College → Home</strong></div><div class="risk-row"><span>🛡 Safety Score</span><span class="badge high">${state.score}/100</span></div></div><button class="danger" onclick="window.location.href='tel:112'">☎ CALL EMERGENCY SERVICES (112)</button>${primary>=0?`<button class="primary" style="margin-top:10px" onclick="callContact(${primary})">☎ CALL ${esc(state.contacts[primary].name.toUpperCase())}</button><button class="secondary" style="margin-top:10px" onclick="smsContact(${primary})">✉ SMS ${esc(state.contacts[primary].name.toUpperCase())}</button>`:""}<button class="primary" style="margin-top:10px" onclick="shareSOS()">👥 SHARE SOS MESSAGE</button><button class="secondary" style="margin-top:10px" onclick="currentLocation();toast('Location sharing prepared')">⌖ UPDATE MY LOCATION</button><button class="secondary" style="margin-top:10px;border-color:#FF9CA8;color:#C51E32" onclick="setScreen('home')">CANCEL EMERGENCY</button></div></main>`}
function mapScreen(){setTimeout(()=>mountMap("safetyMap"),50);return wrap(`<div class="content">${appbar("Safety Map")}<div class="card" style="margin-top:12px"><div class="row"><div><strong>📍 Location Access</strong><div class="muted">Allow location permission and turn on GPS for live tracking.</div></div><span class="badge low">GPS</span></div><div class="grid2" style="margin-top:10px"><button class="primary" onclick="requestLocationPermission()">ENABLE GPS & LOCATION</button><button class="secondary" onclick="openLocationSettings()">OPEN LOCATION SETTINGS</button></div></div><div class="map-tools"><input id="mapSearch" class="input" style="margin:0" placeholder="🔍 Search place or area" onkeydown="if(event.key==='Enter')searchMap()"><button class="secondary map-btn" onclick="searchMap()">SEARCH</button><button class="secondary map-btn" onclick="currentLocation()">📍 MY LOCATION</button></div><div id="safetyMap" class="real-map"></div><div class="map-note">Map uses OpenStreetMap. Allow precise location and keep phone Location/GPS enabled for live positioning.</div><div class="card" style="margin-top:12px"><div class="label">Current Safety Level</div><div style="margin-top:8px"><span class="badge low">✓ LOW RISK</span></div><div class="line"></div><div class="row"><span>📍 Police Station</span><span class="muted">Demo marker</span></div><div class="row" style="margin-top:10px"><span>🏥 Hospital</span><span class="muted">Demo marker</span></div></div></div>` ,"map")}
function report(){return wrap(`<div class="content">${appbar("Report Safety Concern")}<div class="card" style="margin-top:16px"><div class="label">Location</div><input class="input" value="Current Location" readonly><div class="label" style="margin-top:16px">Category</div>${["Poor Lighting","Isolated Area","Unsafe Transport","Harassment Concern","Suspicious Activity","Other"].map((x,i)=>`<div class="report-item"><div class="report-icon">${["💡","⚠","🚌","!","◉","＋"][i]}</div><strong>${x}</strong></div>`).join("")}<div class="label" style="margin-top:16px">Description</div><textarea class="input" style="height:85px;padding-top:12px" placeholder="Enter details (optional)"></textarea><button class="primary" style="margin-top:12px" onclick="toast('Safety report saved locally')">SUBMIT REPORT</button></div></div>`,"map")}
function contacts(){return wrap(`<div class="content">${appbar("SOS Contacts")}<p class="muted" style="margin:4px 2px 14px">Add people you trust. The primary contact is shown first during SOS.</p>${state.contacts.map((c,i)=>`<div class="card contact-card"><div class="row"><div><strong>${esc(c.name)}</strong><div class="muted">${esc(c.rel||"Trusted Contact")}</div><div class="contact-phone">${esc(c.phone||"No phone number")}</div></div>${c.sos?`<span class="badge low">PRIMARY SOS</span>`:`<button class="secondary small-btn" onclick="setSOSContact(${i})">SET AS SOS</button>`}</div><div class="contact-bottom"><button class="secondary" onclick="callContact(${i})">☎ CALL</button><button class="secondary" onclick="smsContact(${i})">✉ SMS</button><button class="icon-danger" onclick="removeContact(${i})">DELETE</button></div></div>`).join("")}${contactForm()}<div class="card insight">For a real APK, automatic SMS/location sharing needs native Android permissions. This prototype opens your phone's call/SMS apps so you can confirm the action.</div></div>` ,"profile")}
function profile(){return wrap(`<div class="content">${appbar("Profile")}<div class="card profile-head" style="margin-top:16px"><img class="avatar" src="${A}herguard-girl.jpg"><h2 style="margin:8px 0 3px">${esc(state.user?.name||"User")}</h2><div class="muted">${esc(state.user?.email||"")}</div><div class="muted">${esc(state.user?.phone||"")}</div></div><div class="card"><div class="list-row" onclick="setScreen('contacts')"><span>👥 Trusted / SOS Contacts</span><span class="chev">›</span></div>${["🛡 Safety Preferences","🔔 Notifications","🔐 Privacy","🟢 Permissions"].map(x=>`<div class="list-row"><span>${x}</span><span class="chev">›</span></div>`).join("")}<div class="list-row"><span>🚪 Logout</span><button class="secondary small-btn" onclick="logout()">LOG OUT</button></div><div class="list-row"><span>🎛 Demo Mode</span><button class="toggle ${state.demo?"on":""}" onclick="state.demo=!state.demo;render()"><i></i></button></div></div></div>` ,"profile")}
function render(){
  let c="";
  switch(state.screen){
    case"splash":c=splash();break;case"onboard":c=onboard();break;case"login":c=login();break;case"register":c=register();break;
    case"home":c=home();break;case"start":c=start();break;case"journey":c=live();break;case"live":c=live();break;case"analysis":c=analysis();break;
    case"guardian":c=guardian();break;case"checkin":c=checkin();break;case"sos":c=sos();break;case"emergency":c=emergency();break;
    case"map":c=mapScreen();break;case"report":c=report();break;case"contacts":c=contacts();break;case"profile":c=profile();break;case"safety":c=analysis();break;
    default:c=home();
  }
  app.innerHTML=`<div class="phone">${c}</div>`;
}
if(state.user){state.screen="home";} render();
