import { useState, useEffect, useMemo } from "react";

const uid = () => Math.random().toString(36).slice(2, 10);
const pad = (n) => String(n).padStart(2, "0");
const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const getToday = () => fmtDate(new Date());
const todayKey = getToday(); // for seed data init only
const nowISO = () => new Date().toISOString().slice(0, 16);
const startOfWeek = () => { const d = new Date(); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); return fmtDate(new Date(d.getFullYear(), d.getMonth(), diff)); };
const endOfWeek = () => { const d = new Date(); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? 0 : 7); return fmtDate(new Date(d.getFullYear(), d.getMonth(), diff)); };
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYNAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const STATUSES = [
  { id: "todo", label: "To Do", color: "#797E93" },
  { id: "working", label: "Working", color: "#FDAB3D" },
  { id: "stuck", label: "Stuck", color: "#E2445C" },
  { id: "done", label: "Done", color: "#00C875" },
  { id: "review", label: "Review", color: "#579BFC" },
];
const PRIORITIES = [
  { id: "urgent", label: "Urgent", color: "#E2445C" },
  { id: "high", label: "High", color: "#FD7E41" },
  { id: "medium", label: "Medium", color: "#FDAB3D" },
  { id: "low", label: "Low", color: "#579BFC" },
  { id: "none", label: "—", color: "#797E93" },
];
const GC = ["#579BFC","#00C875","#FDAB3D","#E2445C","#A25DDC","#FF642E","#CAB641","#00D2D2"];

function playAlarm() { try { const c = new (window.AudioContext || window.webkitAudioContext)(); const b = (t,f,d) => { const o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.value=f;o.type="sine";g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.2,t+0.02);g.gain.exponentialRampToValueAtTime(0.001,t+d);o.start(t);o.stop(t+d);}; for(let i=0;i<3;i++){b(c.currentTime+i*0.3,880,0.18);b(c.currentTime+i*0.3+0.08,1100,0.12)}} catch(e){} }

// ICS
function icsDS(ds,ts){return ds.replace(/-/g,"")+"T"+(ts?ts.replace(/:/g,"")+"00":"090000")}
function genICSEvent(t){const s=new Date().toISOString().replace(/[-:]/g,"").split(".")[0]+"Z";const dd=t.dueDate||getToday();const dt=icsDS(dd);const et=icsDS(dd,"10:00");const desc=[t.note,`Status: ${STATUSES.find(x=>x.id===t.status)?.label}`,`Priority: ${PRIORITIES.find(x=>x.id===t.priority)?.label}`].filter(Boolean).join("\\n");let l=["BEGIN:VEVENT",`UID:${t.id}-ev@orbitask.app`,`DTSTAMP:${s}`,`CREATED:${s}`,`DTSTART:${dt}`,`DTEND:${et}`,`SUMMARY:${t.text}`,`DESCRIPTION:${desc}`,`SEQUENCE:0`];if(t.reminder){const rd=new Date(t.reminder).toISOString().replace(/[-:]/g,"").split(".")[0]+"Z";l.push("BEGIN:VALARM","ACTION:DISPLAY",`DESCRIPTION:${t.text}`,`TRIGGER;VALUE=DATE-TIME:${rd}`,"END:VALARM")}else if(t.priority==="urgent"||t.priority==="high"){l.push("BEGIN:VALARM","ACTION:DISPLAY",`DESCRIPTION:${t.text}`,"TRIGGER:-PT15M","END:VALARM")}l.push("END:VEVENT");return l.join("\r\n")}
function genICSAlert(t){const s=new Date().toISOString().replace(/[-:]/g,"").split(".")[0]+"Z";const dd=t.dueDate||getToday();const dy=dd.replace(/-/g,"");const desc=[t.note].filter(Boolean).join("\\n");let l=["BEGIN:VEVENT",`UID:${t.id}-al@orbitask.app`,`DTSTAMP:${s}`,`CREATED:${s}`,`DTSTART;VALUE=DATE:${dy}`,`DTEND;VALUE=DATE:${dy}`,`SUMMARY:⚡ ${t.text}`,`DESCRIPTION:${desc}`,`TRANSP:TRANSPARENT`,`SEQUENCE:0`];if(t.reminder){const rd=new Date(t.reminder).toISOString().replace(/[-:]/g,"").split(".")[0]+"Z";l.push("BEGIN:VALARM","ACTION:DISPLAY",`DESCRIPTION:⚡ ${t.text}`,`TRIGGER;VALUE=DATE-TIME:${rd}`,"END:VALARM")}else{l.push("BEGIN:VALARM","ACTION:DISPLAY",`DESCRIPTION:⚡ ${t.text}`,"TRIGGER:PT8H","END:VALARM");if(t.priority==="urgent"||t.priority==="high"){l.push("BEGIN:VALARM","ACTION:DISPLAY",`DESCRIPTION:Urgent: ${t.text}`,"TRIGGER:-PT16H","END:VALARM");l.push("BEGIN:VALARM","ACTION:DISPLAY",`DESCRIPTION:Due: ${t.text}`,"TRIGGER:PT12H","END:VALARM")}}l.push("END:VEVENT");return l.join("\r\n")}
function dlICS(fn,c){const b=new Blob([c],{type:"text/calendar;charset=utf-8"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=fn;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u)}
function exportTasks(list,name,type){const bodies=list.map(t=>type==="alerts"?genICSAlert(t):genICSEvent(t));const ics=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Orbitask//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH",...bodies,"END:VCALENDAR"].join("\r\n");dlICS(`${name.replace(/[^a-zA-Z0-9]/g,"_")}.ics`,ics)}

// localStorage
const LS={t:"orbitask_tasks",g:"orbitask_groups",b:"orbitask_boards",s:"orbitask_settings",d:"orbitask_dark"};
function loadLS(k,fb){try{const v=localStorage.getItem(k);return v?JSON.parse(v):fb}catch(e){return fb}}
function saveLS(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}

const DB=[{id:"work",name:"Work Projects",icon:"briefcase",color:"#579BFC"},{id:"personal",name:"Personal",icon:"user",color:"#00C875"}];
const DG=[{id:"g1",name:"This Week",color:"#579BFC",board:"work",collapsed:false},{id:"g2",name:"Backlog",color:"#A25DDC",board:"work",collapsed:false},{id:"g3",name:"Daily",color:"#00C875",board:"personal",collapsed:false},{id:"g4",name:"Someday",color:"#FDAB3D",board:"personal",collapsed:true}];
const DT=[
  {id:uid(),text:"Finalize Q2 strategy deck",group:"g1",board:"work",status:"working",priority:"high",note:"Review before Friday",dueDate:todayKey,reminder:null,reminderFired:false,updatedAt:Date.now()-3e5,completedAt:null},
  {id:uid(),text:"Review pull requests",group:"g1",board:"work",status:"todo",priority:"urgent",note:"3 PRs from backend",dueDate:todayKey,reminder:null,reminderFired:false,updatedAt:Date.now()-18e5,completedAt:null},
  {id:uid(),text:"Fix auth token bug",group:"g1",board:"work",status:"stuck",priority:"high",note:"Blocked by rate limit",dueDate:todayKey,reminder:null,reminderFired:false,updatedAt:Date.now()-6e5,completedAt:null},
  {id:uid(),text:"Design system audit",group:"g1",board:"work",status:"review",priority:"medium",note:"Contrast ratios",dueDate:fmtDate(new Date(Date.now()+864e5)),reminder:null,reminderFired:false,updatedAt:Date.now()-864e5,completedAt:null},
  {id:uid(),text:"Deploy staging build",group:"g2",board:"work",status:"todo",priority:"medium",note:"",dueDate:fmtDate(new Date(Date.now()+864e6)),reminder:null,reminderFired:false,updatedAt:Date.now()-432e6,completedAt:null},
  {id:uid(),text:"Morning yoga",group:"g3",board:"personal",status:"done",priority:"low",note:"30 min flow",dueDate:todayKey,reminder:null,reminderFired:false,updatedAt:Date.now()-72e5,completedAt:Date.now()-72e5},
  {id:uid(),text:"Book health checkup",group:"g3",board:"personal",status:"todo",priority:"medium",note:"Dr. Martinez",dueDate:fmtDate(new Date(Date.now()+6048e5)),reminder:null,reminderFired:false,updatedAt:Date.now()-1728e5,completedAt:null},
  {id:uid(),text:"Renew car registration",group:"g3",board:"personal",status:"todo",priority:"high",note:"End of month",dueDate:fmtDate(new Date(Date.now()+12096e5)),reminder:null,reminderFired:false,updatedAt:Date.now()-432e6,completedAt:null},
  {id:uid(),text:"Ship v2.1 hotfix",group:"g1",board:"work",status:"done",priority:"urgent",note:"Critical patch",dueDate:fmtDate(new Date(Date.now()-864e5)),reminder:null,reminderFired:false,updatedAt:Date.now()-864e5,completedAt:Date.now()-864e5},
  {id:uid(),text:"Meal prep",group:"g3",board:"personal",status:"done",priority:"medium",note:"",dueDate:fmtDate(new Date(Date.now()-2592e5)),reminder:null,reminderFired:false,updatedAt:Date.now()-2592e5,completedAt:Date.now()-2592e5},
];

// Icons
const I={
  home:(c)=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  briefcase:(c)=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>,
  user:(c)=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  sun:(c)=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  calWeek:(c)=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  check:(c)=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  alert:(c)=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  star:(c)=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  settings:(c)=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  moon:(c)=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  search:(c)=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  chevL:(c)=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
  menu:(c)=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  grip:(c)=><svg width="12" height="12" viewBox="0 0 24 24" fill={c}><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>,
  plus:(c)=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  layers:(c)=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
  archive:(c)=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>,
  bar:(c)=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  trash:(c)=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>,
  edit:(c)=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  download:(c)=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  calendar:(c)=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  clock:(c)=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  bell:(c)=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
};

function timeAgo(ts){const m=Math.floor((Date.now()-ts)/6e4);if(m<1)return"Now";if(m<60)return m+"m";const h=Math.floor(m/60);if(h<24)return h+"h";const d=Math.floor(h/24);return d<7?d+"d":Math.floor(d/7)+"w"}
function dueCls(ds){if(!ds)return"";const t=new Date();t.setHours(0,0,0,0);const du=new Date(ds+"T00:00:00");du.setHours(0,0,0,0);const d=(du-t)/864e5;if(d<0)return"#E2445C";if(d===0)return"#FDAB3D";if(d<=3)return"#579BFC";return null}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box;}
::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:var(--bd);border-radius:3px}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes scaleIn{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}
@keyframes modalIn{from{opacity:0;transform:scale(0.94) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes slideDrawer{from{transform:translateX(-100%)}to{transform:translateX(0)}}
@keyframes bellShake{0%,100%{transform:rotate(0)}15%{transform:rotate(12deg)}30%{transform:rotate(-12deg)}45%{transform:rotate(6deg)}60%{transform:rotate(-6deg)}}
@keyframes pulseR{0%,100%{box-shadow:0 0 0 0 rgba(226,68,92,0.35)}50%{box-shadow:0 0 0 6px rgba(226,68,92,0)}}
@keyframes checkPop{0%{transform:scale(0)}60%{transform:scale(1.2)}100%{transform:scale(1)}}

.si{display:flex;align-items:center;gap:10px;padding:8px 14px;border-radius:8px;cursor:pointer;transition:all 0.12s;border:none;background:none;width:100%;text-align:left;font-family:inherit;font-size:13px;color:var(--tm);font-weight:500;white-space:nowrap}
.si:hover{background:var(--hv);color:var(--tx)}.si.act{background:var(--abg);color:var(--atx);font-weight:700}
.ss{font-size:10px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:var(--tf);padding:20px 14px 6px;user-select:none}
.tr{display:flex;align-items:stretch;border-bottom:1px solid var(--bd);transition:background 0.1s;min-height:42px}.tr:hover{background:var(--hv)}.tr.dn{opacity:0.4}
.tr.dgt{border-top:2px solid var(--ac)!important}.tr.dgb{border-bottom:2px solid var(--ac)!important}
.tc{display:flex;align-items:center;padding:0 10px;font-size:13px;border-right:1px solid var(--bd);overflow:hidden;flex-shrink:0}.tc:last-child{border-right:none}
.pill{padding:4px 0;border-radius:5px;font-size:11px;font-weight:700;text-align:center;width:100%;cursor:pointer;color:#fff;transition:all 0.12s;border:none;font-family:inherit;letter-spacing:0.2px}.pill:hover{filter:brightness(1.12);transform:scale(1.03)}
.dd{position:fixed;z-index:150;border-radius:10px;padding:5px;min-width:150px;animation:scaleIn 0.15s cubic-bezier(0.16,1,0.3,1);background:var(--ddb);border:1px solid var(--bd);box-shadow:var(--dds)}
.ddi{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;transition:background 0.08s;border:none;background:none;width:100%;text-align:left;font-family:inherit;color:var(--tx)}.ddi:hover{background:var(--hv)}
.gh{display:flex;align-items:center;gap:9px;padding:9px 12px;cursor:pointer;transition:background 0.1s;border-radius:8px;margin-bottom:2px;user-select:none;position:relative}.gh:hover{background:var(--hv)}
.gh-act{display:flex;gap:2px;margin-left:auto;opacity:0;transition:opacity 0.15s}.gh:hover .gh-act{opacity:1}
.gh-btn{background:none;border:none;cursor:pointer;padding:4px;border-radius:5px;display:flex;color:var(--tf);transition:all 0.1s}.gh-btn:hover{background:var(--hv);color:var(--tx)}.gh-btn.danger:hover{color:#E2445C}
.ar{display:flex;align-items:center;gap:7px;padding:7px 14px;cursor:pointer;color:var(--tf);font-size:13px;transition:all 0.1s;border-radius:0 0 8px 8px;margin-bottom:12px}.ar:hover{background:var(--hv);color:var(--tx)}
.chk{width:18px;height:18px;border-radius:50%;border:2px solid var(--bs);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s;flex-shrink:0}.chk:hover{border-color:var(--ac);transform:scale(1.1)}.chk.dn{background:#00C875;border-color:#00C875}.chk.dn svg{animation:checkPop 0.25s cubic-bezier(0.16,1,0.3,1)}
.del-btn{opacity:0;transition:all 0.1s;background:none;border:none;cursor:pointer;color:var(--tf);font-size:16px;border-radius:4px;width:22px;height:22px;display:flex;align-items:center;justify-content:center}.tr:hover .del-btn{opacity:1}.del-btn:hover{color:#E2445C;background:rgba(226,68,92,0.08)}
.drag-h{opacity:0;transition:opacity 0.12s;cursor:grab}.tr:hover .drag-h{opacity:0.4}.drag-h:hover{opacity:1!important}
.mov{position:fixed;inset:0;background:rgba(0,0,0,0.45);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;z-index:300;animation:fadeIn 0.12s}
.mc{animation:modalIn 0.25s cubic-bezier(0.16,1,0.3,1)}
.tog{width:40px;height:22px;border-radius:11px;border:none;cursor:pointer;position:relative;transition:background 0.2s;padding:0}
.togk{width:16px;height:16px;border-radius:50%;background:#fff;position:absolute;top:3px;transition:left 0.2s cubic-bezier(0.16,1,0.3,1);box-shadow:0 1px 3px rgba(0,0,0,0.12)}
.m-card{background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:14px;margin-bottom:8px;transition:all 0.12s}
.m-card:active{transform:scale(0.98)}
@media(max-width:767px){.hide-mobile{display:none!important}}
`;

function useWidth(){const[w,setW]=useState(window.innerWidth);useEffect(()=>{const h=()=>setW(window.innerWidth);window.addEventListener("resize",h);return()=>window.removeEventListener("resize",h)},[]);return w}

export default function App(){
  const width=useWidth();const mob=width<768;
  const[dark,setDark]=useState(()=>loadLS(LS.d,true));
  const[tasks,setTasks]=useState(()=>loadLS(LS.t,DT));
  const[groups,setGroups]=useState(()=>loadLS(LS.g,DG));
  const[boards,setBoards]=useState(()=>loadLS(LS.b,DB));
  const[activeBoard,setActiveBoard]=useState("work");
  const[activeView,setActiveView]=useState("all");
  const[page,setPage]=useState("board");
  const[sideOpen,setSideOpen]=useState(!mob);
  const[showSettings,setShowSettings]=useState(false);
  const[showAdd,setShowAdd]=useState(null);
  const[newText,setNewText]=useState("");
  const[dd,setDd]=useState(null);
  const[editName,setEditName]=useState(null);
  const[editNameVal,setEditNameVal]=useState("");
  const[editGrp,setEditGrp]=useState(null);
  const[editGrpVal,setEditGrpVal]=useState("");
  const[alarmTask,setAlarmTask]=useState(null);
  const[search,setSearch]=useState("");
  const[showReminder,setShowReminder]=useState(null);
  const[reminderVal,setReminderVal]=useState("");
  const[dragId,setDragId]=useState(null);
  const[dragOverId,setDragOverId]=useState(null);
  const[dragPos,setDragPos]=useState(null);
  const[showNewBoard,setShowNewBoard]=useState(false);
  const[newBoardName,setNewBoardName]=useState("");
  const[deleteGrpId,setDeleteGrpId]=useState(null);
  const[moveToGrp,setMoveToGrp]=useState("");
  const[showExport,setShowExport]=useState(null);
  const[toast,setToast]=useState(null);
  const[settings,setSettings]=useState(()=>loadLS(LS.s,{showNotes:true,showUpdated:true,notifications:true}));

  // Persist
  useEffect(()=>{saveLS(LS.t,tasks)},[tasks]);
  useEffect(()=>{saveLS(LS.g,groups)},[groups]);
  useEffect(()=>{saveLS(LS.b,boards)},[boards]);
  useEffect(()=>{saveLS(LS.s,settings)},[settings]);
  useEffect(()=>{saveLS(LS.d,dark)},[dark]);

  // Alarm
  useEffect(()=>{const iv=setInterval(()=>{const n=nowISO();setTasks(prev=>{let fired=null;const up=prev.map(t=>{if(t.reminder&&!t.reminderFired&&t.status!=="done"&&t.reminder<=n){if(!fired)fired=t;return{...t,reminderFired:true}}return t});if(fired&&settings.notifications){playAlarm();setAlarmTask(fired)}return fired?up:prev})},10000);return()=>clearInterval(iv)},[settings.notifications]);
  useEffect(()=>{const h=()=>setDd(null);if(dd)window.addEventListener("click",h);return()=>window.removeEventListener("click",h)},[dd]);

  const v=dark?{
    bg:"#1B1D24",bg2:"#1F2128",bgs:"#161820",hv:"rgba(255,255,255,0.04)",abg:"rgba(87,155,252,0.12)",atx:"#579BFC",
    tx:"#E4E2DE",tm:"#8B8FA0",tf:"#555868",bd:"rgba(255,255,255,0.07)",bs:"rgba(255,255,255,0.18)",ac:"#579BFC",
    ddb:"#262932",dds:"0 8px 28px rgba(0,0,0,0.4)",card:"#252830",
  }:{
    bg:"#F5F6F8",bg2:"#FFFFFF",bgs:"#FFFFFF",hv:"rgba(0,0,0,0.03)",abg:"rgba(0,115,234,0.08)",atx:"#0060D0",
    tx:"#1A1D28",tm:"#5A5E72",tf:"#9CA0B2",bd:"rgba(0,0,0,0.09)",bs:"rgba(0,0,0,0.22)",ac:"#0073EA",
    ddb:"#FFFFFF",dds:"0 8px 28px rgba(0,0,0,0.12)",card:"#FFFFFF",
  };
  const cv={"--bg":v.bg,"--bg2":v.bg2,"--bgs":v.bgs,"--hv":v.hv,"--abg":v.abg,"--atx":v.atx,"--tx":v.tx,"--tm":v.tm,"--tf":v.tf,"--bd":v.bd,"--bs":v.bs,"--ac":v.ac,"--ddb":v.ddb,"--dds":v.dds,"--card":v.card};

  const updateTask=(id,patch)=>{setTasks(p=>p.map(t=>{if(t.id!==id)return t;const m={...t,...patch,updatedAt:Date.now()};if(patch.status==="done"&&t.status!=="done")m.completedAt=Date.now();if(patch.status&&patch.status!=="done"&&t.status==="done")m.completedAt=null;return m}))};
  const removeTask=id=>setTasks(p=>p.filter(t=>t.id!==id));
  const addTask=gid=>{if(!newText.trim())return;setTasks(p=>[...p,{id:uid(),text:newText.trim(),group:gid,board:activeBoard,status:"todo",priority:"none",note:"",dueDate:activeView==="today"?getToday():"",reminder:null,reminderFired:false,updatedAt:Date.now(),completedAt:null}]);setNewText("");setShowAdd(null)};
  const addGroup=()=>{setGroups(p=>[...p,{id:uid(),name:"New Group",color:GC[p.length%GC.length],board:activeBoard,collapsed:false}])};
  const addBoard=()=>{if(!newBoardName.trim())return;const id=uid();const c=GC[boards.length%GC.length];setBoards(p=>[...p,{id,name:newBoardName.trim(),icon:"layers",color:c}]);setGroups(p=>[...p,{id:uid(),name:"Tasks",color:c,board:id,collapsed:false}]);setActiveBoard(id);setPage("board");setNewBoardName("");setShowNewBoard(false)};
  const toggleGroup=gid=>setGroups(p=>p.map(g=>g.id===gid?{...g,collapsed:!g.collapsed}:g));
  const deleteGroup=()=>{if(!deleteGrpId)return;if(moveToGrp==="__delete")setTasks(p=>p.filter(t=>t.group!==deleteGrpId));else if(moveToGrp)setTasks(p=>p.map(t=>t.group===deleteGrpId?{...t,group:moveToGrp}:t));setGroups(p=>p.filter(g=>g.id!==deleteGrpId));setDeleteGrpId(null);setMoveToGrp("")};
  const initDeleteGrp=gid=>{const tc=tasks.filter(t=>t.group===gid&&t.status!=="done");if(!tc.length){setGroups(p=>p.filter(g=>g.id!==gid));setTasks(p=>p.filter(t=>t.group!==gid));return}setDeleteGrpId(gid);setMoveToGrp("")};
  const openDd=(e,tid,field)=>{e.stopPropagation();const r=e.currentTarget.getBoundingClientRect();setDd({taskId:tid,field,x:r.left,y:r.bottom+4})};
  const handleExport=(type,target)=>{if(target==="board"){const uf=tasks.filter(t=>t.board===activeBoard&&t.status!=="done");if(!uf.length){showToast("No unfinished tasks");return}exportTasks(uf,curBoard?.name||"tasks",type);showToast(`Exported ${uf.length} tasks`)}else{const task=tasks.find(t=>t.id===target);if(!task)return;exportTasks([task],task.text,type);showToast(`Exported "${task.text}"`)}setShowExport(null)};
  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(null),3000)};
  const moveTask=(id,dir)=>{setTasks(prev=>{const a=[...prev];const i=a.findIndex(t=>t.id===id);if(i===-1)return prev;const ni=i+dir;if(ni<0||ni>=a.length)return prev;[a[i],a[ni]]=[a[ni],a[i]];return a})};

  // Drag (desktop only)
  const dStart=(e,id)=>{if(mob)return;setDragId(id);e.dataTransfer.effectAllowed="move"};
  const dOver=(e,id)=>{e.preventDefault();if(id===dragId)return;const r=e.currentTarget.getBoundingClientRect();setDragOverId(id);setDragPos(e.clientY<r.top+r.height/2?"top":"bottom")};
  const dDrop=(e,tid)=>{e.preventDefault();if(!dragId||dragId===tid){setDragId(null);setDragOverId(null);return}setTasks(prev=>{const a=[...prev];const fi=a.findIndex(t=>t.id===dragId);const[m]=a.splice(fi,1);const ti=a.findIndex(t=>t.id===tid);m.group=a[ti]?.group||m.group;a.splice(dragPos==="bottom"?ti+1:ti,0,m);return a});setDragId(null);setDragOverId(null);setDragPos(null)};
  const dEnd=()=>{setDragId(null);setDragOverId(null);setDragPos(null)};

  const boardGroups=groups.filter(g=>g.board===activeBoard);
  const getFiltered=gid=>{const today=getToday();let t=tasks.filter(tk=>tk.group===gid&&tk.status!=="done");if(activeView==="today")t=t.filter(tk=>tk.dueDate===today);if(activeView==="week"){const ws=startOfWeek(),we=endOfWeek();t=t.filter(tk=>tk.dueDate>=ws&&tk.dueDate<=we)}if(search){const q=search.toLowerCase();t=t.filter(tk=>tk.text.toLowerCase().includes(q)||tk.note.toLowerCase().includes(q))}return t};
  const completedTasks=useMemo(()=>{const today=getToday();let ct=tasks.filter(t=>t.status==="done"&&t.completedAt&&t.board===activeBoard);ct.sort((a,b)=>b.completedAt-a.completedAt);const bm={};ct.forEach(t=>{const d=new Date(t.completedAt);const mk=`${d.getFullYear()}-${pad(d.getMonth()+1)}`;const dk=fmtDate(d);if(!bm[mk])bm[mk]={label:`${MONTHS[d.getMonth()]} ${d.getFullYear()}`,days:{}};if(!bm[mk].days[dk]){const dd=new Date(dk+"T00:00:00");bm[mk].days[dk]={label:dk===today?"Today":dk===fmtDate(new Date(Date.now()-864e5))?"Yesterday":`${DAYNAMES[dd.getDay()]}, ${MONTHS[dd.getMonth()]} ${dd.getDate()}`,tasks:[]}}bm[mk].days[dk].tasks.push(t)});return bm},[tasks,activeBoard]);
  const boardStats=useMemo(()=>{const today=getToday();const bt=tasks.filter(t=>t.board===activeBoard);const total=bt.length,done=bt.filter(t=>t.status==="done").length;const byStatus=STATUSES.map(s=>({...s,count:bt.filter(t=>t.status===s.id).length}));const byPrio=PRIORITIES.filter(p=>p.id!=="none").map(p=>({...p,count:bt.filter(t=>t.priority===p.id).length}));const overdue=bt.filter(t=>t.status!=="done"&&t.dueDate&&t.dueDate<today).length;return{total,done,pct:total?Math.round(done/total*100):0,byStatus,byPrio,overdue}},[tasks,activeBoard]);
  const curBoard=boards.find(b=>b.id===activeBoard);

  const closeSide=()=>{if(mob)setSideOpen(false)};
  const navTo=(pg,brd,vw)=>{if(pg)setPage(pg);if(brd)setActiveBoard(brd);if(vw)setActiveView(vw);closeSide()};

  const renderReminder=task=>{if(!task.reminder)return null;const f=task.reminderFired&&task.status!=="done";const r=new Date(task.reminder);const lbl=`${r.getMonth()+1}/${r.getDate()} ${r.getHours()>12?r.getHours()-12:r.getHours()||12}:${pad(r.getMinutes())}${r.getHours()>=12?"p":"a"}`;return <span style={{display:"inline-flex",alignItems:"center",gap:3,padding:"2px 6px",borderRadius:4,fontSize:9,fontWeight:700,background:f?"rgba(226,68,92,0.2)":"rgba(226,68,92,0.1)",color:"#E2445C",animation:f?"pulseR 1s ease-in-out infinite":"none"}}><span style={{animation:f?"bellShake 0.5s ease-in-out infinite":"none"}}>{f?"🔔":"⏰"}</span>{lbl}</span>};

  const Pill=({label,color,onClick,small})=><button className="pill" onClick={onClick} style={{background:color,padding:small?"3px 8px":"4px 0",width:small?"auto":"100%",fontSize:small?10:11}}>{label}</button>;

  const modalBg={position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(5px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,animation:"fadeIn 0.12s"};
  const modalCard={background:v.ddb,borderRadius:14,padding:mob?20:26,width:"92%",maxWidth:400,border:`1px solid ${v.bd}`,boxShadow:v.dds,animation:"modalIn 0.25s cubic-bezier(0.16,1,0.3,1)",maxHeight:"90vh",overflowY:"auto"};
  const inputS={width:"100%",padding:"10px 12px",borderRadius:8,border:`1px solid ${v.bd}`,background:v.hv,color:v.tx,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box",colorScheme:dark?"dark":"light"};

  // Sidebar
  const sidebar=(<div style={{display:"flex",flexDirection:"column",height:"100%",background:v.bgs,color:v.tx}}>
    <div style={{padding:"16px 14px 12px",display:"flex",alignItems:"center",gap:9}}>
      <div style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,#579BFC,#0073EA)",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:"#fff",fontSize:13,fontWeight:900}}>O</span></div>
      <span style={{fontSize:16,fontWeight:800,letterSpacing:"-0.3px"}}>Orbitask</span>
      <div style={{flex:1}}/><button onClick={()=>setSideOpen(false)} style={{background:"none",border:"none",color:v.tf,cursor:"pointer",padding:4,display:"flex",borderRadius:6}}>{I.chevL(v.tf)}</button>
    </div>
    <div style={{padding:"2px 10px 6px"}}><div style={{display:"flex",alignItems:"center",gap:7,background:v.hv,border:`1px solid ${v.bd}`,borderRadius:7,padding:"7px 9px"}}>{I.search(v.tf)}<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." style={{background:"none",border:"none",color:v.tx,fontSize:12,outline:"none",width:"100%",fontFamily:"inherit"}}/></div></div>
    <div className="ss">Views</div>
    {[{id:"all",l:"All Tasks",icon:"layers"},{id:"today",l:"Today",icon:"sun"},{id:"week",l:"This Week",icon:"calWeek"}].map(vw=><div key={vw.id} style={{padding:"0 7px"}}><button className={`si ${activeView===vw.id&&page==="board"?"act":""}`} onClick={()=>navTo("board",null,vw.id)}>{I[vw.icon](activeView===vw.id&&page==="board"?v.atx:v.tm)}{vw.l}</button></div>)}
    <div className="ss" style={{display:"flex",justifyContent:"space-between",paddingRight:14}}><span>Boards</span><button onClick={()=>setShowNewBoard(true)} style={{background:"none",border:"none",cursor:"pointer",color:v.tf,display:"flex",padding:0}}>{I.plus(v.tf)}</button></div>
    {boards.map(b=><div key={b.id} style={{padding:"0 7px"}}><button className={`si ${activeBoard===b.id&&page==="board"?"act":""}`} onClick={()=>navTo("board",b.id,"all")}>{I[b.icon]?I[b.icon](activeBoard===b.id&&page==="board"?v.atx:v.tm):<span style={{width:8,height:8,borderRadius:4,background:b.color,flexShrink:0}}/>}{b.name}<span style={{marginLeft:"auto",fontSize:10,color:v.tf}}>{tasks.filter(t=>t.board===b.id&&t.status!=="done").length}</span></button></div>)}
    <div className="ss">Pages</div>
    <div style={{padding:"0 7px"}}><button className={`si ${page==="completed"?"act":""}`} onClick={()=>navTo("completed")}>{I.check(page==="completed"?v.atx:v.tm)}Completed<span style={{marginLeft:"auto",fontSize:10,color:"#00C875",fontWeight:700}}>{tasks.filter(t=>t.status==="done").length}</span></button></div>
    <div style={{padding:"0 7px"}}><button className={`si ${page==="stats"?"act":""}`} onClick={()=>navTo("stats")}>{I.bar(page==="stats"?v.atx:v.tm)}Stats</button></div>
    <div style={{flex:1}}/>
    <div style={{padding:7,borderTop:`1px solid ${v.bd}`}}>
      <button className="si" onClick={()=>{setShowSettings(true);closeSide()}}>{I.settings(v.tm)} Settings</button>
      <button className="si" onClick={()=>setDark(!dark)}>{dark?I.sun(v.tm):I.moon(v.tm)} {dark?"Light Mode":"Dark Mode"}</button>
    </div>
  </div>);

  // Mobile card
  const MCard=({task})=>{const st=STATUSES.find(s=>s.id===task.status)||STATUSES[0];const pr=PRIORITIES.find(p=>p.id===task.priority)||PRIORITIES[4];return(
    <div className="m-card" style={{borderLeft:`4px solid ${st.color}`}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:8}}>
        <div className={`chk ${task.status==="done"?"dn":""}`} onClick={()=>updateTask(task.id,{status:task.status==="done"?"todo":"done"})} style={{marginTop:2}}>{task.status==="done"&&<svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M3 7.5L5.5 10L11 4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:600,marginBottom:4,wordBreak:"break-word"}}>{task.text}</div>
          {task.note&&<div style={{fontSize:12,color:v.tm,marginBottom:6}}>{task.note}</div>}
          <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
            <Pill label={st.label} color={st.color} small onClick={e=>openDd(e,task.id,"status")}/>
            <Pill label={pr.label} color={pr.color} small onClick={e=>openDd(e,task.id,"priority")}/>
            {task.dueDate&&<span style={{fontSize:11,fontWeight:600,color:dueCls(task.dueDate)||v.tm}}>{task.dueDate===getToday()?"Today":task.dueDate}</span>}
            {renderReminder(task)}
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:5,justifyContent:"flex-end",borderTop:`1px solid ${v.bd}`,paddingTop:8}}>
        <button onClick={()=>moveTask(task.id,-1)} style={{background:v.hv,border:`1px solid ${v.bd}`,borderRadius:6,padding:"4px 10px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:v.tm}}>↑</button>
        <button onClick={()=>moveTask(task.id,1)} style={{background:v.hv,border:`1px solid ${v.bd}`,borderRadius:6,padding:"4px 10px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:v.tm}}>↓</button>
        <button onClick={()=>setShowExport({mode:"single",taskId:task.id})} style={{background:v.hv,border:`1px solid ${v.bd}`,borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit",color:v.tm,display:"flex",alignItems:"center"}}>{I.calendar(v.tm)}</button>
        <button onClick={()=>removeTask(task.id)} style={{background:"rgba(226,68,92,0.08)",border:"1px solid rgba(226,68,92,0.15)",borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit",color:"#E2445C"}}>✕</button>
      </div>
    </div>
  )};

  return(
    <div style={{...cv,fontFamily:"'Figtree',sans-serif",background:v.bg,color:v.tx,height:"100vh",display:"flex",overflow:"hidden",transition:"background 0.3s, color 0.3s",fontSize:14}}>
      <style>{CSS}</style>

      {/* Sidebar desktop */}
      {!mob&&sideOpen&&<div style={{width:248,flexShrink:0,borderRight:`1px solid ${v.bd}`,overflow:"auto"}}>{sidebar}</div>}
      {/* Sidebar mobile drawer */}
      {mob&&sideOpen&&<><div onClick={()=>setSideOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:250,animation:"fadeIn 0.15s"}}/><div style={{position:"fixed",left:0,top:0,bottom:0,width:280,zIndex:260,animation:"slideDrawer 0.25s cubic-bezier(0.16,1,0.3,1)",overflow:"auto"}}>{sidebar}</div></>}

      {/* Main */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:v.bg2}}>
        {/* Top bar */}
        <div style={{display:"flex",alignItems:"center",gap:8,padding:mob?"10px 14px":"10px 20px",borderBottom:`1px solid ${v.bd}`,flexShrink:0,flexWrap:"wrap"}}>
          {!sideOpen&&<button onClick={()=>setSideOpen(true)} style={{background:"none",border:`1px solid ${v.bd}`,color:v.tm,cursor:"pointer",width:32,height:32,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{I.menu(v.tm)}</button>}
          <h1 style={{fontSize:mob?15:17,fontWeight:800,letterSpacing:"-0.2px"}}>{page==="board"?curBoard?.name||"Tasks":page==="completed"?"Completed":"Stats"}</h1>
          {page==="board"&&!mob&&<div style={{display:"flex",gap:3,marginLeft:8}}>{["all","today","week"].map(vw=><button key={vw} onClick={()=>setActiveView(vw)} style={{padding:"5px 12px",borderRadius:7,border:`1px solid ${activeView===vw?v.ac:v.bd}`,background:activeView===vw?v.ac:"transparent",color:activeView===vw?"#fff":v.tm,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{vw==="all"?"All":vw==="today"?"Today":"Week"}</button>)}</div>}
          <div style={{flex:1}}/>
          {page==="board"&&<><button onClick={()=>setShowExport({mode:"board"})} style={{display:"flex",alignItems:"center",gap:4,padding:"6px 10px",borderRadius:7,border:`1px solid ${v.bd}`,background:"transparent",color:v.tm,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{I.download(v.tm)} Export</button><button onClick={addGroup} style={{background:v.ac,border:"none",color:"#fff",padding:"6px 10px",borderRadius:7,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Group</button></>}
        </div>

        {/* Mobile view tabs */}
        {mob&&page==="board"&&<div style={{display:"flex",gap:4,padding:"8px 14px",borderBottom:`1px solid ${v.bd}`,overflow:"auto"}}>{["all","today","week"].map(vw=><button key={vw} onClick={()=>setActiveView(vw)} style={{padding:"6px 16px",borderRadius:20,border:`1px solid ${activeView===vw?v.ac:v.bd}`,background:activeView===vw?v.ac:"transparent",color:activeView===vw?"#fff":v.tm,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0}}>{vw==="all"?"All Tasks":vw==="today"?"Today":"This Week"}</button>)}</div>}

        {/* Content */}
        <div style={{flex:1,overflow:"auto",padding:mob?"12px 14px 80px":"12px 20px 80px"}}>

          {/* BOARD */}
          {page==="board"&&boardGroups.map(group=>{const gTasks=getFiltered(group.id);const stats={total:gTasks.length};return(
            <div key={group.id} style={{marginBottom:6}}>
              <div className="gh" onClick={()=>toggleGroup(group.id)}>
                <svg width="11" height="11" viewBox="0 0 12 12" style={{transition:"transform 0.15s",transform:group.collapsed?"rotate(-90deg)":"rotate(0)",flexShrink:0}}><path d="M3 4.5L6 7.5L9 4.5" fill="none" stroke={group.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <div style={{width:3,height:20,borderRadius:2,background:group.color,flexShrink:0}}/>
                {editGrp===group.id?<input value={editGrpVal} onChange={e=>setEditGrpVal(e.target.value)} autoFocus onClick={e=>e.stopPropagation()} onBlur={()=>{if(editGrpVal.trim())setGroups(p=>p.map(g=>g.id===group.id?{...g,name:editGrpVal.trim()}:g));setEditGrp(null)}} onKeyDown={e=>{if(e.key==="Enter")e.target.blur()}} style={{background:"none",border:`1px solid ${v.ac}`,color:v.tx,fontSize:13,fontWeight:800,fontFamily:"inherit",outline:"none",padding:"1px 7px",borderRadius:5,width:140}}/>
                :<span style={{fontSize:13,fontWeight:800,color:group.color}} onDoubleClick={e=>{e.stopPropagation();setEditGrp(group.id);setEditGrpVal(group.name)}}>{group.name}</span>}
                <span style={{fontSize:11,color:v.tf,fontWeight:600}}>{stats.total}</span>
                <div className="gh-act">
                  <button className="gh-btn" title="Rename" onClick={e=>{e.stopPropagation();setEditGrp(group.id);setEditGrpVal(group.name)}}>{I.edit(v.tf)}</button>
                  <button className="gh-btn danger" title="Delete" onClick={e=>{e.stopPropagation();initDeleteGrp(group.id)}}>{I.trash("#E2445C")}</button>
                </div>
              </div>
              {!group.collapsed&&<div style={{borderRadius:"0 0 8px 8px",overflow:"hidden",border:`1px solid ${v.bd}`,borderTop:`3px solid ${group.color}`}}>
                {/* Desktop table header */}
                {!mob&&<div style={{display:"flex",alignItems:"center",borderBottom:`1px solid ${v.bd}`,minHeight:34,background:v.bg2}}>
                  <div style={{width:26}}/><div style={{flex:1,minWidth:180,padding:"0 10px",fontSize:10,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase",color:v.tf,borderRight:`1px solid ${v.bd}`}}>Task</div>
                  <div style={{width:120,textAlign:"center",fontSize:10,fontWeight:700,color:v.tf,padding:"0 8px",borderRight:`1px solid ${v.bd}`}}>Status</div>
                  <div style={{width:100,textAlign:"center",fontSize:10,fontWeight:700,color:v.tf,padding:"0 8px",borderRight:`1px solid ${v.bd}`}}>Due</div>
                  <div style={{width:100,textAlign:"center",fontSize:10,fontWeight:700,color:v.tf,padding:"0 8px",borderRight:`1px solid ${v.bd}`}}>Priority</div>
                  {settings.showNotes&&<div style={{width:160,fontSize:10,fontWeight:700,color:v.tf,padding:"0 8px",borderRight:`1px solid ${v.bd}`}}>Notes</div>}
                  {settings.showUpdated&&<div style={{width:70,textAlign:"center",fontSize:10,fontWeight:700,color:v.tf,borderRight:`1px solid ${v.bd}`}}>Upd</div>}
                  <div style={{width:36}}/>
                </div>}

                {mob?<div style={{padding:8}}>{gTasks.map(t=><MCard key={t.id} task={t}/>)}</div>
                :gTasks.map(task=>{const st=STATUSES.find(s=>s.id===task.status)||STATUSES[0];const pr=PRIORITIES.find(p=>p.id===task.priority)||PRIORITIES[4];return(
                  <div key={task.id} className={`tr ${dragId===task.id?"dn":""} ${dragOverId===task.id&&dragPos==="top"?"dgt":""} ${dragOverId===task.id&&dragPos==="bottom"?"dgb":""}`}
                    draggable onDragStart={e=>dStart(e,task.id)} onDragOver={e=>dOver(e,task.id)} onDragLeave={()=>{setDragOverId(null)}} onDrop={e=>dDrop(e,task.id)} onDragEnd={dEnd}>
                    <div style={{width:26,display:"flex",alignItems:"center",justifyContent:"center"}} className="drag-h">{I.grip(v.tf)}</div>
                    <div className="tc" style={{flex:1,minWidth:180,gap:8,fontWeight:500}}>
                      <div className="chk" onClick={()=>updateTask(task.id,{status:"done"})}/>
                      {editName===task.id?<input value={editNameVal} onChange={e=>setEditNameVal(e.target.value)} autoFocus onBlur={()=>{if(editNameVal.trim())updateTask(task.id,{text:editNameVal.trim()});setEditName(null)}} onKeyDown={e=>{if(e.key==="Enter")e.target.blur();if(e.key==="Escape")setEditName(null)}} style={{background:"none",border:"none",borderBottom:`2px solid ${v.ac}`,color:v.tx,fontSize:13,fontFamily:"inherit",fontWeight:500,outline:"none",width:"100%",padding:"3px 0"}}/>
                      :<span onClick={()=>{setEditName(task.id);setEditNameVal(task.text)}} style={{cursor:"text",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:13}}>{task.text}</span>}
                      {renderReminder(task)}
                    </div>
                    <div className="tc" style={{width:120,justifyContent:"center"}}><Pill label={st.label} color={st.color} onClick={e=>openDd(e,task.id,"status")}/></div>
                    <div className="tc" style={{width:100,justifyContent:"center",fontSize:12,color:dueCls(task.dueDate)||v.tm}}><input type="date" value={task.dueDate} onChange={e=>updateTask(task.id,{dueDate:e.target.value})} style={{background:"none",border:"none",color:"inherit",fontSize:11,fontFamily:"inherit",outline:"none",cursor:"pointer",width:82,colorScheme:dark?"dark":"light"}}/></div>
                    <div className="tc" style={{width:100,justifyContent:"center"}}><Pill label={pr.label} color={pr.color} onClick={e=>openDd(e,task.id,"priority")}/></div>
                    {settings.showNotes&&<div className="tc" style={{width:160}}><input value={task.note} placeholder="Note..." onChange={e=>updateTask(task.id,{note:e.target.value})} style={{background:"none",border:"none",color:v.tm,fontSize:12,fontFamily:"inherit",outline:"none",width:"100%",padding:"3px 0"}}/></div>}
                    {settings.showUpdated&&<div className="tc" style={{width:70,justifyContent:"center",fontSize:11,color:v.tm}}>{timeAgo(task.updatedAt)}</div>}
                    <div className="tc" style={{width:36,justifyContent:"center"}}><button className="del-btn" onClick={()=>removeTask(task.id)}>×</button></div>
                  </div>
                )})}

                {showAdd===group.id?<div style={{display:"flex",alignItems:"center",padding:mob?"8px 12px":"5px 12px 5px 48px",gap:7,borderTop:`1px solid ${v.bd}`}}><input autoFocus value={newText} onChange={e=>setNewText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addTask(group.id);if(e.key==="Escape"){setShowAdd(null);setNewText("")}}} placeholder="Task name, Enter to add..." style={{flex:1,background:"none",border:"none",color:v.tx,fontSize:13,fontFamily:"inherit",outline:"none",padding:"8px 0"}}/><button onClick={()=>{setShowAdd(null);setNewText("")}} style={{background:"none",border:"none",color:v.tf,cursor:"pointer",fontSize:11,fontFamily:"inherit",fontWeight:600}}>Cancel</button></div>
                :<div className="ar" onClick={()=>setShowAdd(group.id)}>{I.plus(v.tf)}<span>Add task</span></div>}
              </div>}
            </div>
          )})}
          {page==="board"&&boardGroups.length===0&&(
            <div style={{textAlign:"center",padding:"60px 20px",color:v.tf}}>
              <div style={{fontSize:28,marginBottom:8,opacity:0.3}}>📋</div>
              <div style={{fontSize:15,fontWeight:600,marginBottom:4}}>No groups on this board yet</div>
              <div style={{fontSize:13,marginBottom:16}}>Create a group to start adding tasks</div>
              <button onClick={addGroup} style={{background:v.ac,border:"none",color:"#fff",padding:"8px 18px",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Create Group</button>
            </div>
          )}

          {/* COMPLETED */}
          {page==="completed"&&<div style={{animation:"fadeIn 0.25s"}}>
            <div style={{display:"flex",gap:4,marginBottom:14,flexWrap:"wrap"}}>{boards.map(b=><button key={b.id} onClick={()=>setActiveBoard(b.id)} style={{padding:"5px 12px",borderRadius:7,border:`1px solid ${activeBoard===b.id?v.ac:v.bd}`,background:activeBoard===b.id?v.ac:"transparent",color:activeBoard===b.id?"#fff":v.tm,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{b.name}</button>)}</div>
            {Object.entries(completedTasks).map(([mk,month])=><div key={mk} style={{marginBottom:20}}>
              <div style={{fontSize:14,fontWeight:800,marginBottom:8,display:"flex",alignItems:"center",gap:8}}><div style={{width:3,height:16,borderRadius:2,background:"#00C875"}}/>{month.label}</div>
              {Object.entries(month.days).map(([dk,day])=><div key={dk} style={{padding:"10px 0",borderBottom:`1px solid ${v.bd}`}}>
                <div style={{fontSize:12,fontWeight:700,marginBottom:6,display:"flex",alignItems:"center",gap:6}}><span style={{background:"rgba(0,200,117,0.1)",color:"#00C875",padding:"2px 8px",borderRadius:4,fontSize:11}}>{day.label}</span><span style={{color:v.tf,fontSize:11}}>{day.tasks.length}</span></div>
                {day.tasks.map(t=>{const pr=PRIORITIES.find(p=>p.id===t.priority)||PRIORITIES[4];return<div key={t.id} className="tr" style={{minHeight:36,borderBottom:`1px solid ${v.bd}`,padding:"6px 10px",gap:8,display:"flex",alignItems:"center",flexWrap:"wrap"}}>
                  <div style={{width:16,height:16,borderRadius:"50%",background:"#00C875",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><svg width="9" height="9" viewBox="0 0 14 14" fill="none"><path d="M3 7.5L5.5 10L11 4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                  <span style={{flex:1,textDecoration:"line-through",opacity:0.6,minWidth:80,fontSize:13}}>{t.text}</span>
                  <span style={{fontSize:9,fontWeight:700,color:pr.color,background:pr.color+"18",padding:"2px 6px",borderRadius:4}}>{pr.label}</span>
                  <button onClick={()=>updateTask(t.id,{status:"todo"})} style={{background:"none",border:`1px solid ${v.bd}`,color:v.tm,cursor:"pointer",padding:"3px 8px",borderRadius:5,fontSize:10,fontWeight:600,fontFamily:"inherit"}}>Restore</button>
                </div>})}
              </div>)}
            </div>)}
            {Object.keys(completedTasks).length===0&&<div style={{textAlign:"center",padding:"50px 20px",color:v.tf}}>
              <div style={{fontSize:28,marginBottom:8,opacity:0.3}}>✓</div>
              <div style={{fontSize:15,fontWeight:600}}>No completed tasks on this board</div>
              <div style={{fontSize:13,marginTop:4}}>Tasks marked as Done will appear here</div>
            </div>}
          </div>}

          {/* STATS */}
          {page==="stats"&&<div style={{animation:"fadeIn 0.25s"}}>
            <div style={{display:"flex",gap:4,marginBottom:16,flexWrap:"wrap"}}>{boards.map(b=><button key={b.id} onClick={()=>setActiveBoard(b.id)} style={{padding:"5px 12px",borderRadius:7,border:`1px solid ${activeBoard===b.id?v.ac:v.bd}`,background:activeBoard===b.id?v.ac:"transparent",color:activeBoard===b.id?"#fff":v.tm,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{b.name}</button>)}</div>
            <div style={{display:"grid",gridTemplateColumns:`repeat(auto-fill,minmax(${mob?120:150}px,1fr))`,gap:10,marginBottom:20}}>
              {[{l:"Total",val:boardStats.total,c:v.tx},{l:"Done",val:boardStats.done,c:"#00C875"},{l:"Progress",val:boardStats.pct+"%",c:v.ac},{l:"Overdue",val:boardStats.overdue,c:boardStats.overdue?"#E2445C":v.tf}].map(s=><div key={s.l} style={{borderRadius:10,padding:"12px 14px",border:`1px solid ${v.bd}`,background:v.bg2}}><div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,color:s.c,marginBottom:4}}>{s.l}</div><div style={{fontSize:24,fontWeight:900,color:s.c}}>{s.val}</div></div>)}
            </div>
            <div style={{fontSize:11,fontWeight:700,color:v.tf,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>By Status</div>
            <div style={{display:"flex",gap:6,marginBottom:20,flexWrap:"wrap"}}>{boardStats.byStatus.map(s=><div key={s.id} style={{borderRadius:8,padding:"10px 14px",border:`1px solid ${v.bd}`,background:v.bg2,minWidth:80}}><div style={{display:"flex",alignItems:"center",gap:5,marginBottom:4}}><div style={{width:8,height:8,borderRadius:3,background:s.color}}/><span style={{fontSize:11,fontWeight:700}}>{s.label}</span></div><div style={{fontSize:20,fontWeight:900}}>{s.count}</div></div>)}</div>
            <div style={{fontSize:11,fontWeight:700,color:v.tf,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>By Priority</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{boardStats.byPrio.map(p=><div key={p.id} style={{borderRadius:8,padding:"10px 14px",border:`1px solid ${v.bd}`,background:v.bg2,minWidth:80}}><div style={{display:"flex",alignItems:"center",gap:5,marginBottom:4}}><div style={{width:8,height:8,borderRadius:3,background:p.color}}/><span style={{fontSize:11,fontWeight:700}}>{p.label}</span></div><div style={{fontSize:20,fontWeight:900}}>{p.count}</div></div>)}</div>
          </div>}
        </div>
      </div>

      {/* Dropdown */}
      {dd&&<div onClick={e=>e.stopPropagation()} className="dd" style={{left:Math.min(dd.x,window.innerWidth-170),top:Math.min(dd.y,window.innerHeight-260)}}>
        {dd.field==="status"&&STATUSES.map(s=><button key={s.id} className="ddi" onClick={()=>{updateTask(dd.taskId,{status:s.id});setDd(null)}}><div style={{width:11,height:11,borderRadius:3,background:s.color}}/>{s.label}</button>)}
        {dd.field==="priority"&&PRIORITIES.map(p=><button key={p.id} className="ddi" onClick={()=>{updateTask(dd.taskId,{priority:p.id});setDd(null)}}><div style={{width:11,height:11,borderRadius:3,background:p.color}}/>{p.label}</button>)}
        <div style={{borderTop:`1px solid ${v.bd}`,marginTop:3,paddingTop:3}}>
          <button className="ddi" onClick={()=>{setShowReminder(dd.taskId);setDd(null)}}>{I.bell(v.tm)} Reminder</button>
          <button className="ddi" onClick={()=>{setShowExport({mode:"single",taskId:dd.taskId});setDd(null)}}>{I.download(v.tm)} Export .ics</button>
        </div>
      </div>}

      {/* Reminder */}
      {showReminder&&<div style={modalBg} onClick={()=>setShowReminder(null)}><div style={modalCard} onClick={e=>e.stopPropagation()}>
        <h3 style={{fontSize:16,fontWeight:800,marginBottom:12,display:"flex",alignItems:"center",gap:8}}>{I.bell(v.ac)} Set Reminder</h3>
        <input type="datetime-local" value={reminderVal} onChange={e=>setReminderVal(e.target.value)} style={inputS}/>
        <div style={{display:"flex",gap:7,marginTop:12}}><button onClick={()=>{if(reminderVal)updateTask(showReminder,{reminder:reminderVal,reminderFired:false});setShowReminder(null);setReminderVal("")}} style={{flex:1,padding:9,borderRadius:8,border:"none",background:v.ac,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Save</button><button onClick={()=>{updateTask(showReminder,{reminder:null,reminderFired:false});setShowReminder(null);setReminderVal("")}} style={{padding:"9px 14px",borderRadius:8,border:`1px solid ${v.bd}`,background:"none",color:v.tm,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Clear</button></div>
      </div></div>}

      {/* Export */}
      {showExport&&<div style={modalBg} onClick={()=>setShowExport(null)}><div style={modalCard} onClick={e=>e.stopPropagation()}>
        <h3 style={{fontSize:16,fontWeight:800,marginBottom:14,display:"flex",alignItems:"center",gap:8}}>{I.calendar(v.ac)} Export to Calendar</h3>
        <p style={{fontSize:12,color:v.tm,marginBottom:12}}>{showExport.mode==="single"?"Export this task":"Export all unfinished tasks"}</p>
        {[{type:"calendar",emoji:"📅",title:"Time-Block Event",desc:"9–10 AM event with alarm"},{type:"alerts",emoji:"🔔",title:"All-Day Alert",desc:"Banner notifications · urgent = 3 alerts"}].map(opt=><button key={opt.type} onClick={()=>handleExport(opt.type,showExport.mode==="single"?showExport.taskId:"board")} className="ddi" style={{padding:"12px",marginBottom:6,border:`1px solid ${v.bd}`,borderRadius:10,gap:12}}>
          <div style={{width:36,height:36,borderRadius:9,background:opt.type==="calendar"?"linear-gradient(135deg,#579BFC,#0073EA)":"linear-gradient(135deg,#FF6259,#E2445C)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:16}}>{opt.emoji}</span></div>
          <div><div style={{fontSize:13,fontWeight:700}}>{opt.title}</div><div style={{fontSize:11,color:v.tm}}>{opt.desc}</div></div>
        </button>)}
        <button onClick={()=>setShowExport(null)} style={{width:"100%",padding:10,borderRadius:8,border:`1px solid ${v.bd}`,background:"none",color:v.tm,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginTop:4}}>Cancel</button>
      </div></div>}

      {/* New Board */}
      {showNewBoard&&<div style={modalBg} onClick={()=>setShowNewBoard(false)}><div style={modalCard} onClick={e=>e.stopPropagation()}>
        <h3 style={{fontSize:16,fontWeight:800,marginBottom:12,display:"flex",alignItems:"center",gap:8}}>{I.layers(v.ac)} New Board</h3>
        <input value={newBoardName} onChange={e=>setNewBoardName(e.target.value)} placeholder="Board name..." autoFocus onKeyDown={e=>{if(e.key==="Enter")addBoard()}} style={inputS}/>
        <div style={{display:"flex",gap:7,marginTop:12}}><button onClick={addBoard} style={{flex:1,padding:9,borderRadius:8,border:"none",background:v.ac,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Create</button><button onClick={()=>{setShowNewBoard(false);setNewBoardName("")}} style={{padding:"9px 14px",borderRadius:8,border:`1px solid ${v.bd}`,background:"none",color:v.tm,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button></div>
      </div></div>}

      {/* Delete Group */}
      {deleteGrpId&&(()=>{const grp=groups.find(g=>g.id===deleteGrpId);const tInG=tasks.filter(t=>t.group===deleteGrpId&&t.status!=="done");const others=groups.filter(g=>g.id!==deleteGrpId&&g.board===grp?.board);return(
        <div style={modalBg} onClick={()=>{setDeleteGrpId(null);setMoveToGrp("")}}><div style={modalCard} onClick={e=>e.stopPropagation()}>
          <h3 style={{fontSize:16,fontWeight:800,marginBottom:4}}>Delete "{grp?.name}"?</h3>
          <p style={{fontSize:12,color:v.tm,marginBottom:14}}>{tInG.length} active task{tInG.length!==1?"s":""}</p>
          <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>Move tasks to:</div>
          {others.map(g=><button key={g.id} onClick={()=>setMoveToGrp(g.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderRadius:8,border:`1px solid ${moveToGrp===g.id?v.ac:v.bd}`,background:moveToGrp===g.id?v.abg:"transparent",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600,color:v.tx,width:"100%",marginBottom:4,textAlign:"left"}}><div style={{width:4,height:14,borderRadius:2,background:g.color}}/>{g.name}{moveToGrp===g.id&&<span style={{marginLeft:"auto",color:v.ac}}>✓</span>}</button>)}
          <button onClick={()=>setMoveToGrp("__delete")} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderRadius:8,border:`1px solid ${moveToGrp==="__delete"?"#E2445C":v.bd}`,background:moveToGrp==="__delete"?"rgba(226,68,92,0.06)":"transparent",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600,color:moveToGrp==="__delete"?"#E2445C":v.tx,width:"100%",marginBottom:12,textAlign:"left"}}>🗑 Delete all tasks{moveToGrp==="__delete"&&<span style={{marginLeft:"auto",color:"#E2445C"}}>✓</span>}</button>
          <div style={{display:"flex",gap:8}}><button onClick={deleteGroup} disabled={!moveToGrp} style={{flex:1,padding:10,borderRadius:8,border:"none",background:moveToGrp?"#E2445C":v.bd,color:moveToGrp?"#fff":v.tf,fontSize:13,fontWeight:700,cursor:moveToGrp?"pointer":"not-allowed",fontFamily:"inherit",opacity:moveToGrp?1:0.5}}>{moveToGrp==="__delete"?"Delete All":"Move & Delete"}</button><button onClick={()=>{setDeleteGrpId(null);setMoveToGrp("")}} style={{padding:"10px 14px",borderRadius:8,border:`1px solid ${v.bd}`,background:"none",color:v.tm,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button></div>
        </div></div>
      )})()}

      {/* Settings */}
      {showSettings&&<div style={modalBg} onClick={()=>setShowSettings(false)}><div style={modalCard} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}><h3 style={{fontSize:17,fontWeight:800,display:"flex",alignItems:"center",gap:8}}>{I.settings(v.tx)} Settings</h3><button onClick={()=>setShowSettings(false)} style={{background:"none",border:"none",color:v.tm,cursor:"pointer",fontSize:18}}>×</button></div>
        {[{l:"Dark Mode",val:dark,fn:()=>setDark(!dark)},{l:"Notes Column",val:settings.showNotes,fn:()=>setSettings(s=>({...s,showNotes:!s.showNotes}))},{l:"Last Updated",val:settings.showUpdated,fn:()=>setSettings(s=>({...s,showUpdated:!s.showUpdated}))},{l:"Alarm Sounds",val:settings.notifications,fn:()=>setSettings(s=>({...s,notifications:!s.notifications}))}].map(s=><div key={s.l} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:`1px solid ${v.bd}`}}><span style={{fontWeight:600,fontSize:13}}>{s.l}</span><button className="tog" style={{background:s.val?v.ac:v.bd}} onClick={s.fn}><div className="togk" style={{left:s.val?21:3}}/></button></div>)}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0"}}><span style={{fontWeight:600,fontSize:13,color:"#E2445C"}}>Reset All Data</span><button onClick={()=>{setTasks(DT);setGroups(DG);setBoards(DB)}} style={{padding:"6px 12px",borderRadius:7,border:"1px solid #E2445C",background:"rgba(226,68,92,0.06)",color:"#E2445C",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Reset</button></div>
      </div></div>}

      {/* Toasts */}
      {toast&&<div style={{position:"fixed",bottom:mob?70:20,left:"50%",transform:"translateX(-50%)",zIndex:500,animation:"fadeUp 0.3s",padding:"10px 18px",borderRadius:10,background:dark?"rgba(28,45,32,0.97)":"rgba(240,255,244,0.98)",border:"1px solid rgba(0,200,117,0.2)",fontSize:13,fontWeight:600,color:"#00C875",boxShadow:"0 4px 20px rgba(0,0,0,0.1)"}}>✅ {toast}</div>}
      {alarmTask&&<div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:500,animation:"fadeUp 0.3s",display:"flex",alignItems:"center",gap:10,padding:"12px 18px",borderRadius:12,maxWidth:mob?340:420,background:dark?"rgba(45,28,32,0.97)":"rgba(255,242,244,0.98)",border:"1px solid rgba(226,68,92,0.2)",boxShadow:"0 8px 28px rgba(226,68,92,0.15)"}}>
        <span style={{fontSize:22,animation:"bellShake 0.5s ease-in-out infinite"}}>🔔</span>
        <div style={{flex:1}}><div style={{fontSize:9,fontWeight:700,color:"#E2445C",letterSpacing:1,textTransform:"uppercase"}}>Reminder</div><div style={{fontSize:13,fontWeight:700}}>{alarmTask.text}</div></div>
        <button onClick={()=>setAlarmTask(null)} style={{background:"#E2445C",border:"none",color:"#fff",padding:"6px 12px",borderRadius:7,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Dismiss</button>
      </div>}
    </div>
  );
}
