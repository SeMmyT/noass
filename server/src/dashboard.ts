export const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>NOASS Dashboard</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0a0a0f;--card:#14141f;--border:#1e1e2e;--text:#c8c8d8;
  --dim:#666680;--accent:#7c5cbf;--green:#2dd4a0;--yellow:#e8b931;
  --red:#e85555;--blue:#5599e8;--orange:#e89040;
}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  background:var(--bg);color:var(--text);font-size:14px;
  -webkit-tap-highlight-color:transparent;padding-bottom:env(safe-area-inset-bottom);
  height:100vh;overflow:hidden;display:flex;flex-direction:column}

/* ── Topbar ── */
.topbar{position:sticky;top:0;z-index:10;background:var(--bg);
  border-bottom:1px solid var(--border);padding:8px 12px;flex-shrink:0}
.topbar-row{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.topbar h1{font-size:15px;font-weight:600;color:var(--dim);letter-spacing:.5px;flex:1}
.conn{display:inline-block;width:7px;height:7px;border-radius:50%;margin-left:6px;vertical-align:middle}
.conn.ok{background:var(--green)}.conn.err{background:var(--red)}
.view-btn{background:var(--card);border:1px solid var(--border);color:var(--dim);
  padding:4px 10px;border-radius:4px;font-size:11px;cursor:pointer;font-family:inherit}
.view-btn.active{color:var(--accent);border-color:var(--accent)}
.view-btn:hover{border-color:var(--accent)}
.broadcast{display:flex;gap:6px}
.broadcast input{flex:1;background:var(--card);border:1px solid var(--border);
  color:var(--text);padding:8px 10px;border-radius:8px;font-size:14px;outline:none}
.broadcast input:focus{border-color:var(--accent)}
.broadcast button{background:var(--accent);color:#fff;border:none;
  padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer}
.broadcast button:active{opacity:.7}

/* ── Main container ── */
#main{flex:1;overflow-y:auto;padding:8px}

/* ── Cards view ── */
.card{background:var(--card);border:1px solid var(--border);border-radius:10px;
  margin-bottom:8px;overflow:hidden;transition:border-color .15s}
.card.awaiting_input{border-color:var(--yellow)}
.card.error{border-color:var(--red)}
.card-head{padding:10px 12px;cursor:pointer;display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.badge{display:inline-block;padding:2px 7px;border-radius:4px;
  font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.3px}
.badge.idle{background:#1a1a2e;color:var(--dim)}
.badge.thinking{background:#1a1a3a;color:var(--blue)}
.badge.tool_call{background:#1a2a1a;color:var(--green)}
.badge.awaiting_input{background:#2a2a1a;color:var(--yellow)}
.badge.error{background:#2a1a1a;color:var(--red)}
.badge.complete{background:#1a1a1a;color:var(--dim)}
.sname{font-weight:600;font-size:13px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ctx{font-size:11px;color:var(--dim);white-space:nowrap}
.ctx .pct{color:var(--text);font-weight:600}
.ctx .cost{color:var(--green)}
.expand-btn{background:none;border:none;color:var(--dim);cursor:pointer;font-size:16px;padding:0 4px}
.expand-btn:hover{color:var(--accent)}
.meta{padding:0 12px 6px;font-size:12px;color:var(--dim);display:flex;flex-wrap:wrap;gap:4px 12px}
.meta .tool{color:var(--green)}.meta .cwd{color:var(--dim);font-family:monospace;font-size:11px}
.detail{display:none;border-top:1px solid var(--border);padding:8px 12px}
.card.open .detail{display:block}
.detail pre{font-size:11px;color:var(--dim);white-space:pre-wrap;word-break:break-all;
  max-height:140px;overflow-y:auto;margin-bottom:8px;line-height:1.4}
.input-row{display:flex;gap:6px}
.input-row input{flex:1;background:var(--bg);border:1px solid var(--border);
  color:var(--text);padding:6px 8px;border-radius:6px;font-size:13px;outline:none}
.input-row input:focus{border-color:var(--accent)}
.input-row button{background:var(--accent);color:#fff;border:none;
  padding:6px 12px;border-radius:6px;font-size:12px;cursor:pointer}
.qa-row{display:flex;gap:4px;margin-bottom:6px;flex-wrap:wrap}
.qa{background:#1a1a2e;color:var(--yellow);border:1px solid var(--border);
  padding:4px 10px;border-radius:4px;font-size:11px;cursor:pointer;font-family:monospace}
.qa:hover{background:#252540;border-color:var(--yellow)}
.subagents{padding:2px 0 4px;display:flex;flex-wrap:wrap;gap:4px}
.sa{font-size:10px;background:#1a1a2e;color:var(--blue);padding:2px 6px;border-radius:3px}
.empty{text-align:center;color:var(--dim);padding:40px 20px;font-size:15px}

/* ── Fullscreen view ── */
.fullscreen{display:flex;flex-direction:column;height:100%}
.fs-header{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border);flex-shrink:0;flex-wrap:wrap}
.fs-back{background:none;border:none;color:var(--dim);cursor:pointer;font-size:18px;padding:4px 8px}
.fs-back:hover{color:var(--text)}
.fs-title{font-weight:600;font-size:14px;flex:1}
.fs-meta{font-size:11px;color:var(--dim)}
.fs-log{flex:1;overflow-y:auto;padding:12px;font-family:'JetBrains Mono','Fira Code',monospace;font-size:12px;line-height:1.5}
.fs-log .entry{padding:2px 0;border-bottom:1px solid #111118}
.fs-log .entry-time{color:var(--dim);margin-right:8px}
.fs-log .entry-event{color:var(--blue)}
.fs-log .entry-tool{color:var(--green)}
.fs-log .entry-detail{color:var(--text)}
.fs-log .entry.error .entry-event{color:var(--red)}
.fs-log .entry.awaiting .entry-event{color:var(--yellow)}
.fs-log .entry.tool-evt{display:none}
.fs-log.show-tools .entry.tool-evt{display:block}
.filter-toggle{font-size:10px;color:var(--dim);display:flex;align-items:center;gap:4px;cursor:pointer}
.filter-toggle input{accent-color:var(--accent)}
.fs-tabs{display:flex;gap:4px;margin-left:auto}
.fs-tab{background:var(--card);border:1px solid var(--border);color:var(--dim);
  padding:3px 10px;border-radius:4px;font-size:10px;cursor:pointer;font-family:inherit}
.fs-tab.active{color:var(--accent);border-color:var(--accent)}
.fs-tab:hover{border-color:var(--accent)}

/* ── Conversation thread ── */
.conv-thread{flex:1;overflow-y:auto;padding:12px;display:none;flex-direction:column;gap:8px}
.conv-thread.active{display:flex}
.fs-log.active{display:block}
.fs-log{display:none}
.conv-msg{max-width:85%;padding:8px 12px;border-radius:8px;font-size:12px;line-height:1.5;word-break:break-word;white-space:pre-wrap}
.conv-msg.user{align-self:flex-end;background:var(--accent);color:#fff;border-bottom-right-radius:2px}
.conv-msg.assistant{align-self:flex-start;background:var(--card);border:1px solid var(--border);border-bottom-left-radius:2px}
.conv-msg.notification{align-self:center;background:#2a2a1a;color:var(--yellow);font-size:11px;font-style:italic;max-width:95%}
.conv-msg .conv-time{font-size:9px;opacity:.5;margin-top:4px;display:block}
.conv-empty{text-align:center;color:var(--dim);padding:40px;font-size:13px}
.fs-input{flex-shrink:0;padding:8px 12px;border-top:1px solid var(--border);background:var(--bg)}

/* ── Grid view ── */
.grid-view{display:grid;height:100%;gap:4px;padding:4px;overflow:hidden}
.grid-2x2{grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr minmax(120px,auto)}
.grid-cell{background:var(--card);border:1px solid var(--border);border-radius:6px;
  display:flex;flex-direction:column;overflow:hidden;min-height:0}
.grid-cell.awaiting_input{border-color:var(--yellow)}
.grid-cell.error{border-color:var(--red)}
.grid-cell.span-full{grid-column:1/-1}
.gc-header{padding:6px 8px;display:flex;align-items:center;gap:6px;border-bottom:1px solid var(--border);flex-shrink:0;cursor:pointer}
.gc-header .badge{font-size:9px;padding:1px 5px}
.gc-header .sname{font-size:11px;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gc-header .ctx{font-size:10px}
.gc-log{flex:1;overflow-y:auto;padding:4px 8px;font-family:monospace;font-size:10px;line-height:1.4;color:var(--dim)}
.gc-input{flex-shrink:0;padding:4px 6px;border-top:1px solid var(--border)}
.gc-input .qa-row{margin-bottom:4px}
.gc-input .qa{font-size:9px;padding:2px 6px}
.gc-input .input-row input{font-size:11px;padding:4px 6px}
.gc-input .input-row button{font-size:10px;padding:4px 8px}

@media(min-width:600px){
  #main.cards-view{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:8px;align-content:start}
}
</style>
</head>
<body>
<div class="topbar">
  <div class="topbar-row">
    <h1>NOASS <span id="conn" class="conn err"></span></h1>
    <span id="count" class="ctx"></span>
    <button class="view-btn active" data-view="cards">Cards</button>
    <button class="view-btn" data-view="grid">Grid</button>
  </div>
  <div class="broadcast">
    <input id="bc-input" placeholder="broadcast to all sessions..." autocomplete="off">
    <button id="bc-btn">Send</button>
  </div>
</div>
<div id="main" class="cards-view"></div>
<script>
let lastMsg = null;
let currentView = 'cards';
let focusedSession = null;
let showToolCalls = false;
const TOOL_EVENTS = new Set(['PreToolUse','PostToolUse','PostToolUseFailure']);
const eventLog = {}; // session_id -> [{ts, event, tool, detail}]
const container = document.getElementById('main');
const connDot = document.getElementById('conn');
const countEl = document.getElementById('count');

function esc(s){const d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}

function statusColor(s){
  return{idle:'idle',thinking:'thinking',tool_call:'tool_call',
    awaiting_input:'awaiting_input',error:'error',complete:'complete'}[s]||'idle';
}

function shortCwd(p){
  if(!p)return'';
  return p.replace(/^\\/home\\/[^/]+/,'~').split('/').slice(-2).join('/');
}

function fmtTime(ts){return new Date(ts).toLocaleTimeString('en',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'})}

// ── Data ──

function accumulateLog(msg){
  for(const entry of (msg.log||[])){
    const sid = findSessionByName(entry.name, msg);
    if(!sid) continue;
    if(!eventLog[sid]) eventLog[sid]=[];
    const log = eventLog[sid];
    // Dedup by timestamp+event
    if(log.length && log[log.length-1].timestamp===entry.timestamp && log[log.length-1].event===entry.event) continue;
    log.push(entry);
    if(log.length>200) log.splice(0, log.length-200);
  }
}

function findSessionByName(name, msg){
  const p = msg.panes.find(p=>p.name===name);
  return p ? p.session_id : null;
}

// ── API ──

function sendInput(sessionId, text){
  if(!text||!text.trim()) return;
  fetch('/session/'+encodeURIComponent(sessionId)+'/input',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({text:text.trim()})
  }).then(r=>{
    if(r.ok) showToast('Sent "'+text.trim().slice(0,20)+'" → '+sessionId.slice(0,8));
    else showToast('Failed to send', true);
  }).catch(()=>showToast('Failed to send', true));
}

function sendBroadcast(){
  const inp=document.getElementById('bc-input');
  const text=inp.value.trim();
  if(!text)return;
  fetch('/broadcast',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})})
    .then(r=>{if(r.ok) showToast('Broadcast "'+text.slice(0,20)+'" → all sessions');})
    .catch(()=>showToast('Broadcast failed', true));
  inp.value='';
}

function showToast(msg, isError){
  const t=document.createElement('div');
  t.style.cssText='position:fixed;bottom:60px;left:50%;transform:translateX(-50%);background:'+(isError?'var(--red)':'var(--green)')+';color:#000;padding:6px 16px;border-radius:6px;font-size:12px;font-weight:600;z-index:100;opacity:0;transition:opacity .2s';
  t.textContent=msg;
  document.body.appendChild(t);
  requestAnimationFrame(()=>t.style.opacity='1');
  setTimeout(()=>{t.style.opacity='0';setTimeout(()=>t.remove(),300);},2000);
}

// ── Cards View ──

function renderCards(msg){
  container.className='cards-view';
  // Clean up non-card elements (orphaned fullscreen/grid divs)
  for(const child of [...container.children]){
    if(!child.id?.startsWith('c-') && !child.classList.contains('empty')) child.remove();
  }
  // Update existing or create new
  const seen = new Set();
  for(const p of msg.panes){
    seen.add('c-'+p.session_id);
    let el = document.getElementById('c-'+p.session_id);
    if(!el){
      el = document.createElement('div');
      el.id = 'c-'+p.session_id;
      el.className = 'card';
      el.innerHTML = \`
        <div class="card-head">
          <span class="badge"></span>
          <span class="sname"></span>
          <span class="ctx"></span>
          <button class="expand-btn" title="Fullscreen">&#x26F6;</button>
        </div>
        <div class="meta"></div>
        <div class="detail">
          <div class="qa-row">
            <button class="qa" data-cmd="y">y</button>
            <button class="qa" data-cmd="continue">continue</button>
            <button class="qa" data-cmd="1">1</button>
            <button class="qa" data-cmd="skip">skip</button>
          </div>
          <pre class="output"></pre>
          <div class="input-row">
            <input placeholder="send to this session..." autocomplete="off">
            <button>Send</button>
          </div>
        </div>\`;
      el.querySelector('.card-head').addEventListener('click',(e)=>{
        if(e.target.closest('.expand-btn')) return;
        el.classList.toggle('open');
      });
      const sid = p.session_id;
      el.querySelector('.expand-btn').addEventListener('click',()=>openFullscreen(sid));
      el.querySelector('.detail .input-row button').addEventListener('click',function(){
        const inp=el.querySelector('.detail input');
        sendInput(sid,inp.value);inp.value='';
      });
      el.querySelector('.detail input').addEventListener('keydown',function(e){
        if(e.key==='Enter'){sendInput(sid,this.value);this.value='';}
      });
      el.querySelectorAll('.qa').forEach(btn=>{
        btn.addEventListener('click',()=>sendInput(sid,btn.dataset.cmd));
      });
      container.appendChild(el);
    }
    updateCard(el, p);
  }
  // Remove stale cards
  for(const child of [...container.children]){
    if(child.id && child.id.startsWith('c-') && !seen.has(child.id)) child.remove();
  }
}

function updateCard(el, p){
  const st = p.status||'idle';
  const wasOpen = el.classList.contains('open');
  el.className = 'card' + (wasOpen?' open':'');
  if(st==='awaiting_input') el.classList.add('awaiting_input');
  if(st==='error') el.classList.add('error');

  el.querySelector('.badge').className='badge '+statusColor(st);
  el.querySelector('.badge').textContent=st.replace(/_/g,' ');
  el.querySelector('.sname').textContent=p.name;

  let ctxHtml='';
  if(p.ctx_pct)ctxHtml+=\`<span class="pct">\${Math.round(p.ctx_pct)}%</span> ctx \`;
  if(p.cost_usd!=null)ctxHtml+=\`<span class="cost">$\${p.cost_usd.toFixed(2)}</span>\`;
  el.querySelector('.ctx').innerHTML=ctxHtml;

  let metaHtml='';
  if(p.last)metaHtml+=\`<span class="tool">\${esc(p.last.slice(0,80))}</span>\`;
  if(p.cwd)metaHtml+=\`<span class="cwd">\${shortCwd(p.cwd)}</span>\`;
  if(p.sub_agents&&p.sub_agents.length){
    metaHtml+='<div class="subagents">'+p.sub_agents.map(a=>
      \`<span class="sa">\${esc(a.name||a.agent_type)}</span>\`).join('')+'</div>';
  }
  el.querySelector('.meta').innerHTML=metaHtml;

  // Append to log
  const pre = el.querySelector('.output');
  const log = eventLog[p.session_id]||[];
  const last5 = log.slice(-5);
  pre.textContent = last5.map(e=>\`[\${fmtTime(e.timestamp)}] \${e.event} \${e.detail||''}\`).join('\\n');

  if(st==='awaiting_input' && !wasOpen) el.classList.add('open');
}

// ── Fullscreen View ──

function openFullscreen(sessionId){
  focusedSession = sessionId;
  currentView = 'fullscreen';
  setActiveViewBtn(null);
  render();
}

function renderFullscreen(msg){
  const p = msg.panes.find(p=>p.session_id===focusedSession);
  if(!p){currentView='cards';focusedSession=null;setActiveViewBtn('cards');render();return;}

  // Only rebuild if not already showing this session's fullscreen
  if(container.querySelector('.fullscreen') && container.dataset.fsSid===focusedSession){
    // Just update header + append new log entries
    updateFullscreenLive(container.querySelector('.fullscreen'), p, msg);
    return;
  }

  container.className='';
  container.innerHTML='';
  container.dataset.fsSid=focusedSession;

  const fs = document.createElement('div');
  fs.className='fullscreen';

  const st = p.status||'idle';
  const log = eventLog[focusedSession]||[];

  fs.innerHTML=\`
    <div class="fs-header">
      <button class="fs-back">&larr;</button>
      <span class="badge \${statusColor(st)}">\${st.replace(/_/g,' ')}</span>
      <span class="fs-title">\${esc(p.name)}</span>
      <span class="fs-meta">\${p.ctx_pct?Math.round(p.ctx_pct)+'% ctx':''} \${p.cost_usd!=null?'$'+p.cost_usd.toFixed(2):''} \${p.model||''}</span>
      <label class="filter-toggle"><input type="checkbox" id="show-tools" \${showToolCalls?'checked':''}> Tools</label>
      <div class="fs-tabs">
        <button class="fs-tab active" data-tab="chat">Chat</button>
        <button class="fs-tab" data-tab="log">Log</button>
      </div>
    </div>
    <div class="conv-thread active"></div>
    <div class="fs-log\${showToolCalls?' show-tools':''}"></div>
    <div class="fs-input">
      <div class="qa-row">
        <button class="qa" data-cmd="y">y</button>
        <button class="qa" data-cmd="continue">continue</button>
        <button class="qa" data-cmd="1">1</button>
        <button class="qa" data-cmd="skip">skip</button>
        <button class="qa" data-cmd="yes">yes</button>
        <button class="qa" data-cmd="no">no</button>
      </div>
      <div class="input-row">
        <input placeholder="send to \${esc(p.name)}..." autocomplete="off">
        <button>Send</button>
      </div>
    </div>\`;

  const logEl = fs.querySelector('.fs-log');
  for(const e of log){
    const isToolEvt = TOOL_EVENTS.has(e.event);
    const cls = e.event==='PostToolUseFailure'?'error':
                (e.event==='Stop'||e.event==='Notification'||e.event==='PermissionRequest')?'awaiting':'';
    const div = document.createElement('div');
    div.className='entry'+(cls?' '+cls:'')+(isToolEvt?' tool-evt':'');
    div.innerHTML=\`<span class="entry-time">\${fmtTime(e.timestamp)}</span><span class="entry-event">\${esc(e.event)}</span> <span class="entry-detail">\${esc(e.detail||'')}</span>\`;
    logEl.appendChild(div);
  }
  logEl.scrollTop = logEl.scrollHeight;

  // Render conversation thread
  const convEl = fs.querySelector('.conv-thread');
  const conv = p.conversation || [];
  if(conv.length){
    for(const c of conv){
      const div = document.createElement('div');
      div.className='conv-msg '+c.role;
      div.innerHTML=esc(c.text)+\`<span class="conv-time">\${fmtTime(c.timestamp)}</span>\`;
      convEl.appendChild(div);
    }
    convEl.scrollTop=convEl.scrollHeight;
  } else {
    convEl.innerHTML='<div class="conv-empty">No conversation yet — waiting for prompts and responses...</div>';
  }

  // Tab switching
  fs.querySelectorAll('.fs-tab').forEach(tab=>{
    tab.addEventListener('click',()=>{
      fs.querySelectorAll('.fs-tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      const isChat = tab.dataset.tab==='chat';
      convEl.classList.toggle('active',isChat);
      logEl.classList.toggle('active',!isChat);
    });
  });

  fs.querySelector('#show-tools').addEventListener('change',function(){
    showToolCalls=this.checked;
    logEl.classList.toggle('show-tools',showToolCalls);
  });
  fs.querySelector('.fs-back').addEventListener('click',()=>{
    focusedSession=null;currentView='cards';setActiveViewBtn('cards');render();
  });
  const sid = focusedSession;
  fs.querySelector('.fs-input .input-row button').addEventListener('click',function(){
    const inp=fs.querySelector('.fs-input input');
    sendInput(sid,inp.value);inp.value='';
  });
  fs.querySelector('.fs-input input').addEventListener('keydown',function(e){
    if(e.key==='Enter'){sendInput(sid,this.value);this.value='';}
  });
  fs.querySelectorAll('.qa').forEach(btn=>{
    btn.addEventListener('click',()=>sendInput(sid,btn.dataset.cmd));
  });

  container.appendChild(fs);
}

function updateFullscreenLive(fs, p, msg){
  const st = p.status||'idle';
  const badgeEl = fs.querySelector('.badge');
  badgeEl.className='badge '+statusColor(st);
  badgeEl.textContent=st.replace(/_/g,' ');

  const metaEl = fs.querySelector('.fs-meta');
  metaEl.textContent=\`\${p.ctx_pct?Math.round(p.ctx_pct)+'% ctx':''} \${p.cost_usd!=null?'$'+p.cost_usd.toFixed(2):''} \${p.model||''}\`;

  // Append only new log entries
  const logEl = fs.querySelector('.fs-log');
  const log = eventLog[focusedSession]||[];
  const rendered = logEl.children.length;
  for(let i=rendered;i<log.length;i++){
    const e = log[i];
    const isToolEvt = TOOL_EVENTS.has(e.event);
    const cls = e.event==='PostToolUseFailure'?'error':
                (e.event==='Stop'||e.event==='Notification'||e.event==='PermissionRequest')?'awaiting':'';
    const div = document.createElement('div');
    div.className='entry'+(cls?' '+cls:'')+(isToolEvt?' tool-evt':'');
    div.innerHTML=\`<span class="entry-time">\${fmtTime(e.timestamp)}</span><span class="entry-event">\${esc(e.event)}</span> <span class="entry-detail">\${esc(e.detail||'')}</span>\`;
    logEl.appendChild(div);
  }
  // Auto-scroll if near bottom
  if(logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight < 100){
    logEl.scrollTop = logEl.scrollHeight;
  }

  // Append new conversation entries
  const convEl = fs.querySelector('.conv-thread');
  if(convEl){
    const pane = lastMsg?.panes.find(p=>p.session_id===focusedSession);
    const conv = pane?.conversation || [];
    const rendered = convEl.querySelectorAll('.conv-msg').length;
    for(let i=rendered;i<conv.length;i++){
      const c = conv[i];
      const div = document.createElement('div');
      div.className='conv-msg '+c.role;
      div.innerHTML=esc(c.text)+\`<span class="conv-time">\${fmtTime(c.timestamp)}</span>\`;
      convEl.appendChild(div);
      // Remove empty placeholder
      const empty=convEl.querySelector('.conv-empty');
      if(empty) empty.remove();
    }
    if(convEl.scrollHeight - convEl.scrollTop - convEl.clientHeight < 100){
      convEl.scrollTop=convEl.scrollHeight;
    }
  }
}

// ── Grid View ──

function renderGrid(msg){
  container.className='grid-view grid-2x2';
  container.innerHTML='';

  const alive = msg.panes.filter(p=>p.status!=='complete');
  const sorted = [...alive].sort((a,b)=>{
    const pri = s=>s==='awaiting_input'?0:s==='error'?1:s==='tool_call'?2:s==='thinking'?3:4;
    return pri(a.status)-pri(b.status);
  });

  const show = sorted.slice(0, 5);
  show.forEach((p, i)=>{
    const cell = document.createElement('div');
    const st = p.status||'idle';
    cell.className = 'grid-cell'+(i>=4?' span-full':'')+(st==='awaiting_input'?' awaiting_input':'')+(st==='error'?' error':'');
    const log = (eventLog[p.session_id]||[]).slice(-15);
    const sid = p.session_id;

    cell.innerHTML=\`
      <div class="gc-header">
        <span class="badge \${statusColor(st)}">\${st.replace(/_/g,' ')}</span>
        <span class="sname">\${esc(p.name)}</span>
        <span class="ctx">\${p.ctx_pct?Math.round(p.ctx_pct)+'%':''} \${p.cost_usd!=null?'$'+p.cost_usd.toFixed(2):''}</span>
      </div>
      <div class="gc-log">\${log.map(e=>\`<div>\${fmtTime(e.timestamp)} \${esc(e.event)} \${esc((e.detail||'').slice(0,60))}</div>\`).join('')}</div>
      <div class="gc-input">
        <div class="qa-row">
          <button class="qa" data-cmd="y">y</button>
          <button class="qa" data-cmd="continue">cont</button>
          <button class="qa" data-cmd="1">1</button>
          <button class="qa" data-cmd="skip">skip</button>
        </div>
        <div class="input-row">
          <input placeholder="\${esc(p.name)}..." autocomplete="off">
          <button>Send</button>
        </div>
      </div>\`;

    cell.querySelector('.gc-header').addEventListener('click',()=>openFullscreen(sid));
    cell.querySelector('.gc-input .input-row button').addEventListener('click',function(){
      const inp=cell.querySelector('.gc-input input');
      sendInput(sid,inp.value);inp.value='';
    });
    cell.querySelector('.gc-input input').addEventListener('keydown',function(e){
      if(e.key==='Enter'){sendInput(sid,this.value);this.value='';}
    });
    cell.querySelectorAll('.qa').forEach(btn=>{
      btn.addEventListener('click',()=>sendInput(sid,btn.dataset.cmd));
    });

    const logEl = cell.querySelector('.gc-log');
    logEl.scrollTop = logEl.scrollHeight;

    container.appendChild(cell);
  });

  if(!show.length) container.innerHTML='<div class="empty">No active sessions</div>';
}

// ── View switching ──

function render(){
  if(!lastMsg) return;
  accumulateLog(lastMsg);
  countEl.textContent=\`\${lastMsg.stats.alive}/\${lastMsg.stats.total_panes} active\`;

  if(currentView==='fullscreen') renderFullscreen(lastMsg);
  else if(currentView==='grid') renderGrid(lastMsg);
  else renderCards(lastMsg);
}

function setActiveViewBtn(view){
  document.querySelectorAll('.view-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.view===view);
  });
}

document.querySelectorAll('.view-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    currentView=btn.dataset.view;
    focusedSession=null;
    setActiveViewBtn(currentView);
    render();
  });
});

document.getElementById('bc-btn').addEventListener('click',sendBroadcast);
document.getElementById('bc-input').addEventListener('keydown',e=>{if(e.key==='Enter')sendBroadcast();});

// ── Keyboard shortcuts ──
document.addEventListener('keydown',e=>{
  if(document.activeElement.tagName==='INPUT') return;
  if(e.key==='Escape'&&currentView==='fullscreen'){
    focusedSession=null;currentView='cards';setActiveViewBtn('cards');render();
  }
  if(e.key==='1') setView('cards');
  if(e.key==='2') setView('grid');
});
function setView(v){currentView=v;focusedSession=null;setActiveViewBtn(v);render();}

// ── WebSocket ──

function connectWS(){
  const proto=location.protocol==='https:'?'wss':'ws';
  const ws=new WebSocket(\`\${proto}://\${location.host}\`);
  ws.onopen=()=>{connDot.className='conn ok';};
  ws.onmessage=(e)=>{
    try{
      const msg=JSON.parse(e.data);
      if(msg.type==='state'){
        lastMsg=msg;
        render();
      }
    }catch{}
  };
  ws.onclose=()=>{connDot.className='conn err';setTimeout(connectWS,3000);};
  ws.onerror=()=>ws.close();
}

connectWS();
container.innerHTML='<div class="empty">No sessions yet — waiting for hooks...</div>';
</script>
</body>
</html>`;
