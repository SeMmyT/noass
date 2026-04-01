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
  -webkit-tap-highlight-color:transparent;padding-bottom:env(safe-area-inset-bottom)}
.topbar{position:sticky;top:0;z-index:10;background:var(--bg);
  border-bottom:1px solid var(--border);padding:8px 12px}
.topbar h1{font-size:15px;font-weight:600;color:var(--dim);letter-spacing:.5px;margin-bottom:6px}
.broadcast{display:flex;gap:6px}
.broadcast input{flex:1;background:var(--card);border:1px solid var(--border);
  color:var(--text);padding:8px 10px;border-radius:8px;font-size:14px;outline:none}
.broadcast input:focus{border-color:var(--accent)}
.broadcast button{background:var(--accent);color:#fff;border:none;
  padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer}
.broadcast button:active{opacity:.7}
.conn{display:inline-block;width:7px;height:7px;border-radius:50%;margin-left:6px;vertical-align:middle}
.conn.ok{background:var(--green)}.conn.err{background:var(--red)}
#cards{padding:8px}
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
.meta{padding:0 12px 6px;font-size:12px;color:var(--dim);display:flex;flex-wrap:wrap;gap:4px 12px}
.meta .tool{color:var(--green)}.meta .cwd{color:var(--dim);font-family:monospace;font-size:11px}
.meta .msg{color:var(--text);width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.detail{display:none;border-top:1px solid var(--border);padding:8px 12px}
.card.open .detail{display:block}
.detail pre{font-size:11px;color:var(--dim);white-space:pre-wrap;word-break:break-all;
  max-height:140px;overflow-y:auto;margin-bottom:8px;line-height:1.4}
.detail .input-row{display:flex;gap:6px}
.detail .input-row input{flex:1;background:var(--bg);border:1px solid var(--border);
  color:var(--text);padding:6px 8px;border-radius:6px;font-size:13px;outline:none}
.detail .input-row input:focus{border-color:var(--accent)}
.detail .input-row button{background:var(--accent);color:#fff;border:none;
  padding:6px 12px;border-radius:6px;font-size:12px;cursor:pointer}
.detail .qa-row{display:flex;gap:4px;margin-bottom:6px}
.detail .qa{background:#1a1a2e;color:var(--yellow);border:1px solid var(--border);
  padding:4px 10px;border-radius:4px;font-size:11px;cursor:pointer;font-family:monospace}
.detail .qa:hover{background:#252540;border-color:var(--yellow)}
.subagents{padding:2px 0 4px;display:flex;flex-wrap:wrap;gap:4px}
.sa{font-size:10px;background:#1a1a2e;color:var(--blue);padding:2px 6px;border-radius:3px}
.empty{text-align:center;color:var(--dim);padding:40px 20px;font-size:15px}
.ago{font-size:10px;color:var(--dim)}
@media(min-width:600px){
  #cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:8px}
  .card{margin-bottom:0}
}
</style>
</head>
<body>
<div class="topbar">
  <h1>NOASS <span id="conn" class="conn err"></span>
    <span id="count" class="ctx" style="float:right"></span></h1>
  <div class="broadcast">
    <input id="bc-input" placeholder="broadcast to all sessions..." autocomplete="off">
    <button id="bc-btn">Send</button>
  </div>
</div>
<div id="cards"></div>
<script>
const panes={};
const container=document.getElementById('cards');
const connDot=document.getElementById('conn');
const countEl=document.getElementById('count');
let ws=null;

function statusColor(s){
  return{idle:'idle',thinking:'thinking',tool_call:'tool_call',
    awaiting_input:'awaiting_input',error:'error',complete:'complete'}[s]||'idle';
}

function ago(ts){
  if(!ts)return'';
  const d=Date.now()-new Date(ts).getTime();
  if(d<60000)return Math.floor(d/1000)+'s ago';
  if(d<3600000)return Math.floor(d/60000)+'m ago';
  return Math.floor(d/3600000)+'h ago';
}

function shortCwd(p){
  if(!p)return'';
  const h=p.replace(/^\\/home\\/[^/]+/,'~');
  const parts=h.split('/');
  return parts.length>3?'.../'+ parts.slice(-2).join('/'):h;
}

function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML;}

function renderCard(p){
  const id='p-'+p.idx;
  let el=document.getElementById(id);
  const isNew=!el;
  if(isNew){
    el=document.createElement('div');
    el.id=id;
    el.className='card';
    el.innerHTML=\`
      <div class="card-head">
        <span class="badge"></span>
        <span class="sname"></span>
        <span class="ctx"></span>
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
    el.querySelector('.card-head').addEventListener('click',()=>el.classList.toggle('open'));
    el.querySelector('.detail .input-row button').addEventListener('click',function(){
      const inp=el.querySelector('.detail input');
      sendInput(p.name,inp.value);inp.value='';
    });
    el.querySelector('.detail input').addEventListener('keydown',function(e){
      if(e.key==='Enter'){sendInput(p.name,this.value);this.value='';}
    });
    el.querySelectorAll('.qa').forEach(btn=>{
      btn.addEventListener('click',()=>sendInput(p.name,btn.dataset.cmd));
    });
    container.appendChild(el);
  }

  const st=p.status||'idle';
  el.className='card'+(el.classList.contains('open')?' open':'');
  if(st==='awaiting_input')el.classList.add('awaiting_input');
  if(st==='error')el.classList.add('error');

  el.querySelector('.badge').className='badge '+statusColor(st);
  el.querySelector('.badge').textContent=st.replace(/_/g,' ');
  el.querySelector('.sname').textContent=p.name;

  let ctxHtml='';
  if(p.ctx_pct)ctxHtml+=\`<span class="pct">\${Math.round(p.ctx_pct)}%</span> ctx \`;
  if(p.cost_usd!=null)ctxHtml+=\`<span class="cost">$\${p.cost_usd.toFixed(2)}</span>\`;
  el.querySelector('.ctx').innerHTML=ctxHtml;

  let metaHtml='';
  if(p.last)metaHtml+=\`<span class="tool">\${esc(p.last)}</span>\`;
  if(p.cwd)metaHtml+=\`<span class="cwd">\${shortCwd(p.cwd)}</span>\`;
  if(p.sub_agents&&p.sub_agents.length){
    metaHtml+='<div class="subagents">'+p.sub_agents.map(a=>
      \`<span class="sa">\${esc(a.name||a.agent_type)}</span>\`).join('')+'</div>';
  }
  el.querySelector('.meta').innerHTML=metaHtml;

  if(st==='awaiting_input'&&!el.classList.contains('open')){
    el.classList.add('open');
  }
}

function updateCount(msg){
  countEl.textContent=\`\${msg.stats.alive}/\${msg.stats.total_panes} active\`;
}

function sendInput(name,text){
  if(!text||!text.trim())return;
  fetch(\`/session/\${name}/input\`,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({text:text.trim()})
  });
}

function sendBroadcast(){
  const inp=document.getElementById('bc-input');
  const text=inp.value.trim();
  if(!text)return;
  fetch('/broadcast',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({text})
  });
  inp.value='';
}

document.getElementById('bc-btn').addEventListener('click',sendBroadcast);
document.getElementById('bc-input').addEventListener('keydown',e=>{
  if(e.key==='Enter')sendBroadcast();
});

function connectWS(){
  const proto=location.protocol==='https:'?'wss':'ws';
  ws=new WebSocket(\`\${proto}://\${location.host}\`);
  ws.onopen=()=>{connDot.className='conn ok';};
  ws.onmessage=(e)=>{
    try{
      const msg=JSON.parse(e.data);
      if(msg.type==='state'){
        container.innerHTML='';
        for(const p of msg.panes)renderCard(p);
        updateCount(msg);
      }
    }catch{}
  };
  ws.onclose=()=>{
    connDot.className='conn err';
    setTimeout(connectWS,3000);
  };
  ws.onerror=()=>ws.close();
}

connectWS();
container.innerHTML='<div class="empty">No sessions yet — waiting for hooks...</div>';
</script>
</body>
</html>`;
