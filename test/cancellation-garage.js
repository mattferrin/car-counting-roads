/* Subtraction Play: independent test game, silent free play with shared Quest art. */
(function(root){
  'use strict';
  const E=root.CancellationGarage,doc=root.document,$=id=>doc.getElementById(id),NS='http://www.w3.org/2000/svg';
  const params=new URLSearchParams(root.location.search);
  let theme=params.get('theme')==='mermaids'?'mermaids':'cars',max=E.capacity(params.get('max'));
  function startCount(key,fallback){const raw=params.get(key);return raw!==null&&/^\d+$/.test(raw)&&Number(raw)<=max?Number(raw):fallback;}
  let state={blue:startCount('a',10),gold:startCount('b',0),max},serial=0,busy=false;
  let ids={blue:Array.from({length:state.blue},()=>++serial),gold:Array.from({length:state.gold},()=>++serial)};
  const nodes=new Map(),positions=new Map(),routes=[];
  const specs=[['entry',10],['entry',1],['down',10],['down',1],['up',10],['up',1],['exit',10],['exit',1]];
  const names=()=>theme==='cars'?['Blue','Gold','cars']:['Teal','Pink','mermaids'];
  const symbol=side=>theme==='cars'?'car-'+side:'mermaid-'+(side==='blue'?'teal':'pink');
  const el=(tag,attrs={})=>{const n=doc.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
  const caption=n=>Math.floor(n/10)+(Math.floor(n/10)===1?' ten':' tens')+' · '+n%10+(n%10===1?' one':' ones');
  const markup=n=>String(n).split('').map((v,i,a)=>'<span class="d-'+(a.length-i>2?'hun':a.length-i===2?'tens':'ones')+'">'+v+'</span>').join('');
  const reduced=()=>root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function routeGeometry(kind,n){
    const g=E.geometry(max),c=g.center;
    const left=kind==='up'||(['entry','exit'].includes(kind)&&n===10);
    let x=left?48:432,y,d;
    // Entry descends to the boundary; exits descend away from it.
    // Transfers stay in compact nested U lanes beside the zero axis.
    if(kind==='entry'){
      y=34;d=left?`M48 ${y} V${c-134} Q48 ${c-116} 66 ${c-116} H106`:`M432 ${y} V${c-134} Q432 ${c-116} 414 ${c-116} H374`;
    }else if(kind==='exit'){
      y=g.bottom+38;d=left?`M106 ${c+116} H66 Q48 ${c+116} 48 ${c+134} V${y}`:`M374 ${c+116} H414 Q432 ${c+116} 432 ${c+134} V${y}`;
    }else if(kind==='down'&&n===10){
      y=c-80;d=`M374 ${y} H454 Q472 ${y} 472 ${y+18} V${c+62} Q472 ${c+80} 454 ${c+80} H374`;
    }else if(kind==='down'){
      y=c+12;d=`M374 ${c-34} H414 Q432 ${c-34} 432 ${c-16} V${c+16} Q432 ${c+34} 414 ${c+34} H374`;
    }else if(n===10){
      y=c+80;d=`M106 ${y} H26 Q8 ${y} 8 ${y-18} V${c-62} Q8 ${c-80} 26 ${c-80} H106`;
    }else{
      y=c-12;d=`M106 ${c+34} H66 Q48 ${c+34} 48 ${c+16} V${c-16} Q48 ${c-34} 66 ${c-34} H106`;
    }
    return {x,y,d};
  }
  function buttonUnits(side,n,cx,cy){
    return Array.from({length:n},(_,i)=>{
      const w=n===1?32:11,h=n===1?23:9;
      const x=n===1?cx-16:cx-27.5+(i%5)*11;
      const y=n===1?cy-22:cy-23+Math.floor(i/5)*12;
      return `<svg class="route-unit" x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 44 30"><use href="#${symbol(side)}"/></svg>`;
    }).join('');
  }
  function build(){
    const g=E.geometry(max),[blue,gold,things]=names();
    doc.querySelector('.equation').setAttribute('aria-label',blue+' minus '+gold+' equals difference');
    doc.body.dataset.theme=theme;$('world-line').textContent=(theme==='cars'?"Ayan's Car World":"Aliya's Mermaid World")+' · Subtraction Play';
    doc.querySelectorAll('.theme-pill').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.theme===theme)));
    $('garage-map').setAttribute('viewBox',`0 0 480 ${g.height}`);
    $('scenery').innerHTML=`<path d="M104 48 Q240 20 376 48" fill="none" stroke="#fff7cf" stroke-width="5" opacity=".6"/><path d="M104 ${g.bottom} Q240 ${g.bottom+28} 376 ${g.bottom}" fill="none" stroke="#80bba1" stroke-width="6" opacity=".5"/>`;
    $('shells').replaceChildren();
    for(const side of ['blue','gold']){
      const top=side==='blue'?g.top:g.center+1,header=side==='blue'?g.top+20:g.bottom-9;
      $('shells').append(el('rect',{x:104,y:top,width:272,height:g.half-1,rx:18,class:'garage-shell '+side}));
      const label=el('text',{x:116,y:header,class:'garage-label'});label.textContent=(side==='blue'?blue+' +':gold+' −')+' '+things;$('shells').append(label);
      const num=el('text',{x:364,y:header+1,'text-anchor':'end',class:'garage-number',id:'num-'+side,fill:side==='blue'?'var(--left)':'var(--right)'});$('shells').append(num);
      const cap=el('text',{x:116,y:side==='blue'?header+17:header-19,class:'garage-caption',id:'cap-'+side});$('shells').append(cap);
    }
    $('shells').append(el('path',{d:`M106 ${g.center} H374`,class:'garage-midline'}));
    // A quiet zero-axis, with the actual cars mirrored above and below.
    $('roads').replaceChildren();$('controls').replaceChildren();routes.length=0;
    specs.forEach(([kind,n],i)=>{
      const geo=routeGeometry(kind,n);
      const source=kind==='up'||kind==='exit'?'gold':'blue';
      const path=el('path',{d:geo.d,class:'garage-road',id:'road-'+i});$('roads').append(path,el('path',{d:geo.d,class:'garage-edge'}));
      const button=el('g',{class:'garage-route',role:'button',tabindex:'0','data-kind':kind,'data-amount':n,'data-route':i});
      const action=kind==='entry'?'+'+n+' ↓':kind==='exit'?'−'+n+' ↓':(kind==='up'?'↑ ':'↓ ')+n;
      button.innerHTML=`<rect class="route-target" x="${geo.x-34}" y="${geo.y-34}" width="68" height="68" rx="17"/><rect class="route-plate" x="${geo.x-31}" y="${geo.y-31}" width="62" height="62" rx="16"/><g aria-hidden="true">${buttonUnits(source,n,geo.x,geo.y)}</g><text class="route-action" x="${geo.x}" y="${geo.y+24}">${action}</text>`;
      const label=kind==='entry'?'Add to '+blue:kind==='exit'?'Take away from '+gold:kind==='up'?gold+' to '+blue:blue+' to '+gold;
      button.setAttribute('aria-label',label+', '+n+' '+(n===1?things.slice(0,-1):things));
      const route={button,path,kind,n,geo,index:i};routes.push(route);
      const hit=el('path',{d:geo.d,class:'garage-road-hit','aria-hidden':'true'});hit.addEventListener('click',()=>drive(route));$('roads').append(hit);
      button.addEventListener('click',()=>drive(route));button.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();drive(route);}});
      $('controls').append(button);
    });
  }
  function syncCounts(){
    $('left').innerHTML=markup(state.blue);$('right').innerHTML=markup(state.gold);
    const diff=state.blue-state.gold;$('total').textContent=diff<0?'−'+Math.abs(diff):String(diff);$('total').classList.toggle('negative',diff<0);
    const [blue,gold]=names(),pairs=Math.min(state.blue,state.gold);
    $('pair-summary').textContent=pairs+' '+(pairs===1?'pair':'pairs')+' = 0 · '+(diff===0?'Nothing left over':Math.abs(diff)+' '+(diff>0?blue.toLowerCase()+' left over ↑':gold.toLowerCase()+' left over ↓'));
    $('garage-map').setAttribute('aria-label',`${blue} ${state.blue} minus ${gold} ${state.gold} equals ${diff}. ${pairs} pairs cancel.`);
    for(const side of ['blue','gold']){$('num-'+side).textContent=state[side];$('cap-'+side).textContent=caption(state[side]);}
    updateControls();
  }
  function updateControls(){routes.forEach(r=>r.button.setAttribute('aria-disabled',String(busy||!E.canMove(state,r.kind,r.n))));doc.querySelectorAll('.theme-pill').forEach(b=>b.disabled=busy);$('garage-map').setAttribute('aria-busy',String(busy));}
  function unitNode(id,side){
    let n=nodes.get(id);if(!n){n=el('g',{'data-id':id});n.append(el('rect',{x:-11,y:-9,width:22,height:18,rx:5,class:'unit-halo'}));const icon=el('svg',{x:-10,y:-7,width:20,height:14,viewBox:'0 0 44 30'});icon.append(el('use'));n.append(icon);nodes.set(id,n);$('units').append(n);}
    n.querySelector('use').setAttribute('href','#'+symbol(side));n.dataset.side=side;return n;
  }
  function put(n,p){n.setAttribute('transform',`translate(${p.x} ${p.y})`);}
  function targets(){const result=new Map();for(const side of ['blue','gold'])ids[side].forEach((id,i)=>{const p=E.position(state,side,i);result.set(id,p);const n=unitNode(id,side);n.setAttribute('class','garage-unit '+side+' '+(p.paired?'paired':'excess'));n.dataset.index=i;});return result;}
  function drawPairs(){
    $('pairs').replaceChildren();const count=Math.min(state.blue,state.gold),g=E.geometry(max);
    for(let i=0;i<Math.min(count,10);i++){
      const a=E.position(state,'blue',i),b=E.position(state,'gold',i);
      $('pairs').append(el('path',{d:`M${a.x} ${a.y+8} V${b.y-8}`,class:'pair-link'}),el('path',{d:`M${a.x-3} ${g.center} h6 M${a.x} ${g.center-3} v6`,class:'pair-spark'}));
    }
  }
  function render(){const t=targets();t.forEach((p,id)=>{put(nodes.get(id),p);positions.set(id,p);});for(const [id,n]of nodes)if(!t.has(id)){n.remove();nodes.delete(id);positions.delete(id);}syncCounts();drawPairs();}
  const lerp=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  const ease=t=>t*t*(3-2*t);
  function animate(route,moving,oldPositions){
    const target=targets(),length=route.path.getTotalLength(),start=route.path.getPointAtLength(0),end=route.path.getPointAtLength(length);
    const flight=reduced()?0:850,stagger=reduced()?0:80,duration=flight+Math.max(0,moving.length-1)*stagger,settle=reduced()?0:460;
    $('pairs').replaceChildren();
    return new Promise(resolve=>{
      let began;
      function frame(now){
        if(began===undefined)began=now;
        const elapsed=now-began,t=duration?Math.min(1,elapsed/duration):1,s=settle?ease(Math.max(0,Math.min(1,(elapsed-duration)/settle))):1;
        for(const [id,n]of nodes){
          const dest=target.get(id),from=oldPositions.get(id)||start;
          if(moving.includes(id)){
            const local=flight?Math.max(0,Math.min(1,(elapsed-moving.indexOf(id)*stagger)/flight)):1;
            const travel=local;let p;
            // Each real object follows the connected road, then slides into its own slot.
            if(travel<.16)p=lerp(from,start,travel/.16);
            else if(travel<.80){const q=route.path.getPointAtLength(length*(travel-.16)/.64);p={x:q.x,y:q.y};}
            else p=lerp(end,dest||{x:end.x+20,y:end.y},(travel-.80)/.20);
            put(n,p);
            if(!dest)n.style.opacity=String(1-local);
          }else if(dest)put(n,lerp(from,dest,s));
        }
        if(elapsed<duration+settle){root.requestAnimationFrame(frame);return;}
        render();resolve();
      }
      root.requestAnimationFrame(frame);
    });
  }
  function burst(route,pairedBefore){
    const g=E.geometry(max),pairs=Math.min(state.blue,state.gold),host=$('effects');host.replaceChildren();
    if(pairs===pairedBefore||reduced())return;
    const group=el('g',{class:'garage-flash'});
    for(let i=0;i<Math.min(10,Math.abs(pairs-pairedBefore));i++){const x=136+i*22+(i>=5?8:0);group.append(el('circle',{cx:x,cy:g.center,r:5,fill:'#ffe58b'}));}
    host.append(group);group.addEventListener('animationend',()=>group.remove(),{once:true});
  }
  async function drive(route){
    if(busy||!E.canMove(state,route.kind,route.n))return;
    busy=true;updateControls();
    const before={...state},old=new Map(positions),source=route.kind==='up'||route.kind==='exit'?'gold':'blue',dest=route.kind==='up'?'blue':'gold';
    let moving;
    if(route.kind==='entry'){moving=Array.from({length:route.n},()=>++serial);ids.blue.push(...moving);moving.forEach(id=>{unitNode(id,'blue');old.set(id,{x:route.geo.x,y:route.geo.y-20});});}
    else{moving=ids[source].splice(-route.n);if(route.kind!=='exit')ids[dest].push(...moving);}
    state=E.move(state,route.kind,route.n);
    try{
      await animate(route,moving,old);burst(route,Math.min(before.blue,before.gold));
      const [blue,gold]=names();$('feedback').textContent=`${blue} ${state.blue} minus ${gold} ${state.gold} equals ${state.blue-state.gold}.`;
    }finally{busy=false;updateControls();}
  }
  function updateURL(){const u=new URL(root.location.href);u.searchParams.set('theme',theme);u.searchParams.set('max',max);u.searchParams.delete('a');u.searchParams.delete('b');root.history.replaceState(null,'',u);}
  doc.querySelectorAll('.theme-pill').forEach(b=>b.addEventListener('click',()=>{if(busy)return;theme=b.dataset.theme;build();render();updateURL();}));
  build();render();
  // Read-only state receipt for regression tests and troubleshooting.
  root.CancellationGarageView={snapshot:()=>({...state,difference:state.blue-state.gold,busy,theme})};
})(window);
