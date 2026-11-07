/* Counting Play: shared arithmetic and the same two counting worlds as the Quests. */
(function (root) {
  'use strict';
  const params = new URLSearchParams(root.location?.search);
  const rawMax = params.get('max');
  const requested = Number(rawMax);
  const LIMIT = /^\d+$/.test(rawMax) && requested >= 10 && requested <= 100 ? requested : 20;
  const initial = () => ({ blue: 10, gold: 0 });
  function canMove(state, kind, n) {
    if (![1, 10].includes(n)) return false;
    if (kind === 'entry') return state.blue + state.gold + n <= LIMIT;
    if (kind === 'top') return state.blue >= n;
    if (kind === 'bottom' || kind === 'exit') return state.gold >= n;
    return false;
  }
  function move(state, kind, n) {
    if (!canMove(state, kind, n)) return state;
    return {
      blue: state.blue + (kind === 'entry' || kind === 'bottom' ? n : kind === 'top' ? -n : 0),
      gold: state.gold + (kind === 'top' ? n : kind === 'bottom' || kind === 'exit' ? -n : 0),
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { LIMIT, initial, canMove, move };
  if (!root.document) return;
  const doc = root.document;
  const $ = id => doc.getElementById(id);
  if (!params.has('theme') && !params.has('max')) {
    $('home').hidden = false;
    return;
  }
  $('game').hidden = false;
  let theme = params.get('theme') === 'mermaids' ? 'mermaids' : 'cars';
  let state = initial(), busy = false, generation = 0, serial = 0;
  let ids = { blue: Array.from({ length: 10 }, () => ++serial), gold: [] };
  const animations = new Set();
  const names = () => theme === 'mermaids' ? ['Teal', 'Pink', 'mermaids'] : ['Blue', 'Gold', 'cars'];
  const symbol = side => theme === 'mermaids' ? 'mermaid-' + (side === 'blue' ? 'teal' : 'pink') : 'car-' + (side === 'blue' ? 'blue' : 'gold');
  const artwork = side => '<svg viewBox="0 0 44 ' + (theme === 'mermaids' ? '30' : '26') + '" aria-hidden="true"><use href="#' + symbol(side) + '"></use></svg>';
  const numberMarkup = n => String(n).split('').map((digit,i,all) => '<span class="d-' + (all.length-i>2?'hun':all.length-i===2?'tens':'ones') + '">' + digit + '</span>').join('');
  const placeCaption = n => '<span class="t">' + Math.floor(n / 10) + (Math.floor(n / 10) === 1 ? ' ten' : ' tens') + '</span> · <span class="o">' + n % 10 + (n % 10 === 1 ? ' one' : ' ones') + '</span>';
  const actions = [['entry',10],['entry',1],['exit',10],['exit',1],['top',10],['top',1],['bottom',10],['bottom',1]];
  const scene = () => theme === 'mermaids'
    ? '<svg viewBox="0 0 162 220" preserveAspectRatio="none" aria-hidden="true"><g stroke="#d9bd7a" stroke-width="2" fill="none" opacity=".7"><path d="M0 190Q40 182 81 190T162 190M0 202Q40 194 81 202T162 202M0 214Q40 206 81 214T162 214"/></g><g fill="#fff" opacity=".7"><circle cx="25" cy="56" r="3"/><circle cx="140" cy="80" r="4"/><circle cx="122" cy="38" r="2"/></g><path d="m28 126 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#ffb3c8"/><path d="m132 150 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#ffbe72"/></svg>'
    : '<svg viewBox="0 0 162 220" preserveAspectRatio="none" aria-hidden="true"><path d="M55 220Q125 175 78 140T105 75T78 0" fill="none" stroke="#e7d5a3" stroke-width="18"/><path d="M55 220Q125 175 78 140T105 75T78 0" fill="none" stroke="#fff2c3" stroke-width="2" stroke-dasharray="4 8"/><g fill="#83b982"><ellipse cx="22" cy="90" rx="4" ry="2"/><ellipse cx="135" cy="139" rx="4" ry="2"/></g><g fill="#f3abc0"><ellipse cx="29" cy="170" rx="4" ry="2"/><ellipse cx="139" cy="48" rx="4" ry="2"/></g></svg>';
  function buildActions() {
    $('outside-actions').replaceChildren(); $('transfer-actions').replaceChildren();
    const [left, right, thing] = names();
    for (const [kind, n] of actions) {
      const button = doc.createElement('button');
      button.type = 'button'; button.className = 'landmark free-action ' + (n === 10 ? 'place-ten' : 'place-one');
      button.dataset.kind = kind; button.dataset.amount = n;
      const label = kind === 'entry' ? 'Add to ' + left : kind === 'exit' ? 'Take from ' + right : kind === 'top' ? left + ' → ' + right : right + ' → ' + left;
      const operation = kind === 'entry' ? '+' : kind === 'exit' ? '−' : kind === 'top' ? '→' : '←';
      button.innerHTML = '<span class="free-amount" aria-hidden="true">' + (kind === 'entry' || kind === 'exit' ? operation + n : n + operation) + '</span><span class="free-place" aria-hidden="true">1 ' + (n === 10 ? 'ten' : 'one') + '</span><span class="name" aria-hidden="true">' + label + '</span>';
      button.setAttribute('aria-label', label + ': ' + n + ' ' + (n === 1 ? thing.slice(0,-1) : thing) + ' (1 ' + (n === 10 ? 'ten' : 'one') + ')');
      button.addEventListener('click', () => drive(button));
      (kind === 'entry' || kind === 'exit' ? $('outside-actions') : $('transfer-actions')).appendChild(button);
    }
  }
  function animate(el, frames, options) {
    const a = el.animate(frames, options); animations.add(a);
    a.finished.catch(() => {}).finally(() => animations.delete(a));
    return a;
  }
  function render(positions) {
    const [left, right, thing] = names();
    const rows = Math.max(2, Math.floor(Math.max(state.blue, state.gold) / 10) + 1);
    $('left').innerHTML = numberMarkup(state.blue); $('right').innerHTML = numberMarkup(state.gold); $('total').innerHTML = numberMarkup(state.blue + state.gold);
    for (const [side, label] of [['blue',left],['gold',right]]) {
      $(side + '-label').textContent = label + ' ' + thing;
      $(side + '-num').innerHTML = numberMarkup(state[side]); $(side + '-cap').innerHTML = placeCaption(state[side]);
      const pool = $(side + '-pool');
      const rowHeight = Math.max(20, pool.clientWidth / 10 * 30 / 44 + 8);
      pool.style.gridTemplateRows = 'repeat(' + rows + ', ' + rowHeight + 'px)';
      pool.setAttribute('aria-label', state[side] + ' ' + label.toLowerCase() + ' ' + thing);
      pool.innerHTML = '<div class="free-scenery">' + scene() + '</div>';
      const tens = Math.floor(state[side] / 10);
      for (let r = 0; r < tens; r++) {
        const band = doc.createElement('div'); band.className = 'free-band'; band.style.gridRow = r + 1; pool.appendChild(band);
      }
      const ground = doc.createElement('div'); ground.className = 'free-ground'; ground.style.gridRow = rows; pool.appendChild(ground);
      ids[side].forEach((id, i) => {
        const obj = doc.createElement('span'); obj.className = 'free-unit'; obj.dataset.unit = id;
        obj.style.gridColumn = i % 10 + 1; obj.style.gridRow = i < tens * 10 ? Math.floor(i / 10) + 1 : rows;
        obj.innerHTML = artwork(side); pool.appendChild(obj);
        const old = positions?.get(id);
        if (old && !root.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          const rect = obj.getBoundingClientRect();
          animate(obj, [{transform:'translate('+(old.x-rect.x)+'px,'+(old.y-rect.y)+'px)'},{transform:'translate(0,0)'}], {duration:350,easing:'ease-out'});
        }
      });
      if (!state[side]) {
        const empty = doc.createElement('span'); empty.className = 'free-empty'; empty.textContent = 'Empty'; empty.style.gridRow = 1; pool.appendChild(empty);
      }
    }
    doc.querySelectorAll('.free-action').forEach(b => { b.disabled = busy || !canMove(state,b.dataset.kind,Number(b.dataset.amount)); });
    doc.querySelectorAll('.theme-pill').forEach(b => { b.disabled = busy; b.setAttribute('aria-pressed',String(b.dataset.theme === theme)); });
    $('game').setAttribute('aria-busy',String(busy));
  }
  async function drive(button) {
    const kind = button.dataset.kind, n = Number(button.dataset.amount);
    if (busy || !canMove(state,kind,n)) return;
    const next = move(state,kind,n);
    const token = ++generation; busy = true;
    const source = kind === 'entry' ? null : kind === 'top' ? 'blue' : 'gold';
    const dest = kind === 'exit' ? null : kind === 'top' ? 'gold' : 'blue';
    const movingIds = source ? (n === 10 ? ids[source].slice(0,n) : ids[source].slice(-n)) : Array.from({length:n},()=>++serial);
    const movingSet = new Set(movingIds);
    const positions = new Map([...doc.querySelectorAll('.free-unit')].filter(e=>!movingSet.has(Number(e.dataset.unit))).map(e=>[Number(e.dataset.unit),e.getBoundingClientRect()]));
    doc.querySelectorAll('.free-action,.theme-pill').forEach(b=>{b.disabled=true;});
    $('game').setAttribute('aria-busy','true');
    const reduced = root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ghosts = [];
    if (!reduced) {
      const target = button.getBoundingClientRect(); const tx=target.x+target.width/2, ty=target.y+target.height/2;
      const destination = dest ? $(dest+'-pool').getBoundingClientRect() : target;
      const cellWidth = (dest ? destination.width : $(source+'-pool').clientWidth)/10;
      movingIds.forEach((id,i)=>{
        const original = source ? doc.querySelector('[data-unit="'+id+'"]') : null;
        const r = original?.getBoundingClientRect();
        const width = r?.width || cellWidth, height = r?.height || Math.max(20,width*30/44+8);
        const x = r ? r.x : tx-width/2+(i%5-2)*width*.65;
        const y = r ? r.y : ty-height/2+Math.floor(i/5)*height*.65;
        const slot = dest ? ids[dest].length+i : 0;
        const newRows = Math.max(2,Math.floor(Math.max(next.blue,next.gold)/10)+1);
        const destRow = dest && slot < Math.floor(next[dest]/10)*10 ? Math.floor(slot/10) : newRows-1;
        const rowHeight = Math.max(20,destination.width/10*30/44+8);
        const endX = dest ? destination.x+(slot%10)*cellWidth : tx-width/2+(i%5-2)*width*.65;
        const endY = dest ? destination.y+destRow*(rowHeight+4) : ty-height/2+Math.floor(i/5)*height*.65;
        const ghost=doc.createElement('span'); ghost.className='free-flyer';ghost.innerHTML=artwork(source||dest);
        Object.assign(ghost.style,{left:x+'px',top:y+'px',width:width+'px',height:height+'px'});
        doc.body.appendChild(ghost);ghosts.push(ghost); if(original)original.style.visibility='hidden';
        const orbit = kind==='top'||kind==='bottom';
        const sx=x+width/2, sy=y+height/2, ex=endX+width/2, ey=endY+height/2;
        const rx=target.width*.58, ry=target.height*.58;
        const d=orbit
          ? `M${sx} ${sy} C${sx} ${sy+35} ${tx-rx} ${ty-ry} ${tx} ${ty-ry} C${tx+rx*.56} ${ty-ry} ${tx+rx} ${ty-ry*.56} ${tx+rx} ${ty} C${tx+rx} ${ty+ry*.56} ${tx+rx*.56} ${ty+ry} ${tx} ${ty+ry} C${tx-rx*.56} ${ty+ry} ${tx-rx} ${ty+ry*.56} ${tx-rx} ${ty} C${tx-rx} ${ty-ry*.56} ${tx-rx*.56} ${ty-ry} ${tx} ${ty-ry} C${tx+rx} ${ty-ry} ${ex} ${ey+35} ${ex} ${ey}`
          : `M${sx} ${sy} C${sx} ${(sy+ey)/2} ${ex} ${(sy+ey)/2} ${ex} ${ey}`;
        Object.assign(ghost.style,{left:'0px',top:'0px',offsetPath:'path("'+d+'")',offsetRotate:'0deg',offsetAnchor:'center'});
        animate(ghost,[{offsetDistance:'0%',opacity:1},{offsetDistance:'100%',opacity:kind==='exit'?0:1}],{duration:orbit?1400:700,delay:i*28,easing:'ease-in-out',fill:'forwards'});
      });
      await Promise.all([...animations].map(a=>a.finished.catch(()=>{})));
    }
    ghosts.forEach(g=>g.remove()); if(token!==generation)return;
    if(source)ids[source]=ids[source].filter(id=>!movingSet.has(id));
    if(dest)ids[dest].push(...movingIds);
    state=next;busy=false;render(positions);
    const [left,right,thing]=names();
    $('feedback').textContent = n+' '+(n===1?thing.slice(0,-1):thing)+' '+(kind==='entry'?'added':kind==='exit'?'taken away':'moved')+'. '+left+' '+state.blue+', '+right+' '+state.gold+'. '+(state.blue+state.gold)+' altogether.';
  }
  function setTheme(value) {
    theme=value;doc.body.dataset.theme=theme;
    const title=theme==='mermaids'?"Aliya's Mermaid World":"Ayan's Car World";
    doc.title=title+' · Counting Play';$('world-line').textContent=title+' · Counting Play';
    doc.querySelector('.equation').setAttribute('aria-label',names()[0]+' plus '+names()[1]+' equals total');
    const nextLimit=LIMIT<50?50:LIMIT<100?100:20;
    $('bigger-world').textContent='Try '+nextLimit;
    $('bigger-world').href='?theme='+theme+'&max='+nextLimit;
    const query=new URLSearchParams({theme,max:String(LIMIT)});root.history.replaceState(null,'','?'+query);
    buildActions();render();
  }
  doc.querySelectorAll('.theme-pill').forEach(b=>b.addEventListener('click',()=>{if(!busy)setTheme(b.dataset.theme);}));
  $('reset').addEventListener('click',()=>{
    ++generation;animations.forEach(a=>a.cancel());animations.clear();
    doc.querySelectorAll('.free-flyer').forEach(e=>e.remove());
    state=initial();ids={blue:Array.from({length:10},()=>++serial),gold:[]};busy=false;render();
    $('feedback').textContent='Reset. Ten on the left, zero on the right.';
  });
  let resizeFrame;
  root.addEventListener('resize',()=>{root.cancelAnimationFrame(resizeFrame);resizeFrame=root.requestAnimationFrame(()=>{if(!busy)render();});});
  $('capacity').textContent=LIMIT;setTheme(theme);
})(typeof window === 'undefined' ? globalThis : window);
