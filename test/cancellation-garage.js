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
  let capacityControl=null,themeControl=null;
  const specs=[['entry',10],['entry',1],['down',10],['down',1],['up',10],['up',1],['exit',10],['exit',1]];
  const names=()=>theme==='cars'?['Blue','Gold','cars']:['Teal','Pink','mermaids'];
  const symbol=side=>theme==='cars'?'car-'+side:'mermaid-'+(side==='blue'?'teal':'pink');
  const el=(tag,attrs={})=>{const n=doc.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
  const caption=n=>Math.floor(n/10)+(Math.floor(n/10)===1?' ten':' tens')+' · '+n%10+(n%10===1?' one':' ones');
  const markup=n=>String(n).split('').map((v,i,a)=>'<span class="d-'+(a.length-i>2?'hun':a.length-i===2?'tens':'ones')+'">'+v+'</span>').join('');
  const reduced=()=>root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function routeGeometry(kind,n,g=E.geometry(state)){
    const c=g.center,left=kind==='up'||(['entry','exit'].includes(kind)&&n===10);
    const x=left?48:432;let y,d;
    if(kind==='entry'){
      y=34;d=left?`M48 ${y} V${c-162} Q48 ${c-144} 66 ${c-144} H106`:`M432 ${y} V${c-162} Q432 ${c-144} 414 ${c-144} H374`;
    }else if(kind==='exit'){
      y=g.bottom-34;d=left?`M106 ${c+144} H66 Q48 ${c+144} 48 ${c+162} V${y}`:`M374 ${c+144} H414 Q432 ${c+144} 432 ${c+162} V${y}`;
    }else if(kind==='down'&&n===10){
      y=c-82;d=`M374 ${y} H454 Q472 ${y} 472 ${y+12} V${c+70} Q472 ${c+82} 454 ${c+82} H374`;
    }else if(kind==='down'){
      y=c+26;d=`M374 ${c-24} H414 Q432 ${c-24} 432 ${c-6} V${c+6} Q432 ${c+24} 414 ${c+24} H374`;
    }else if(n===10){
      y=c+82;d=`M106 ${y} H26 Q8 ${y} 8 ${y-12} V${c-70} Q8 ${c-82} 26 ${c-82} H106`;
    }else{
      y=c-26;d=`M106 ${c+24} H66 Q48 ${c+24} 48 ${c+6} V${c-6} Q48 ${c-24} 66 ${c-24} H106`;
    }
    return {x,y,d};
  }
  function buttonUnits(side,n,cx,cy){
    return Array.from({length:n},(_,i)=>{
      const w=n===1?32:11,h=n===1?23:9;
      const x=n===1?cx-16:cx-27.5+(i%5)*11;
      const y=n===1?cy-22:cy-23+Math.floor(i/5)*12;
      return `<svg class="route-unit" x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${theme==='mermaids'?'0 0 460 266':'0 0 44 26'}"><use href="#${symbol(side)}"/></svg>`;
    }).join('');
  }
  function build(){
    const g=E.geometry(state),[blue,gold,things]=names();
    doc.querySelector('.equation').setAttribute('aria-label',blue+' minus '+gold+' equals difference');
    doc.body.dataset.theme=theme;$('world-line').textContent=(theme==='cars'?"Ayan's Car World":"Aliya's Mermaid World")+' · Subtraction Play';
    themeControl?.refresh();
    $('garage-map').setAttribute('viewBox',`0 0 480 ${g.height}`);
    $('scenery').innerHTML=`<path d="M104 48 Q240 20 376 48" fill="none" stroke="#fff7cf" stroke-width="5" opacity=".6"/><path d="M104 ${g.bottom} Q240 ${g.bottom+28} 376 ${g.bottom}" fill="none" stroke="#80bba1" stroke-width="6" opacity=".5"/>`;
    $('shells').replaceChildren();
    for(const side of ['blue','gold']){
      const top=side==='blue'?g.top:g.center+1,header=side==='blue'?g.top+20:g.bottom-9;
      $('shells').append(el('rect',{x:104,y:top,width:272,height:(side==='blue'?g.blueHeight:g.goldHeight)-1,rx:18,id:'shell-'+side,class:'garage-shell '+side}));
      const label=el('text',{x:116,y:header,class:'garage-label',id:'label-'+side});label.textContent=(side==='blue'?blue+' +':gold+' −')+' '+things;$('shells').append(label);
      const num=el('text',{x:364,y:header+1,'text-anchor':'end',class:'garage-number',id:'num-'+side,fill:side==='blue'?'var(--left)':'var(--right)'});$('shells').append(num);
      const cap=el('text',{x:116,y:side==='blue'?header+17:header-19,class:'garage-caption',id:'cap-'+side});$('shells').append(cap);
    }
    $('shells').append(el('path',{d:`M106 ${g.center} H374`,class:'garage-midline',id:'zero-axis'}));
    // A quiet zero-axis, with the actual cars mirrored above and below.
    $('roads').replaceChildren();$('controls').replaceChildren();routes.length=0;
    specs.forEach(([kind,n],i)=>{
      const geo=routeGeometry(kind,n);
      const source=kind==='up'||kind==='exit'?'gold':'blue';
      const path=el('path',{d:geo.d,'pointer-events':'none',class:'garage-road',id:'road-'+i}),edge=el('path',{d:geo.d,'pointer-events':'none',class:'garage-edge'});$('roads').append(path,edge);
      const button=el('g',{class:'garage-route',role:'button',tabindex:'0','data-kind':kind,'data-amount':n,'data-route':i});
      const action=kind==='entry'?'+'+n+' ↓':kind==='exit'?'−'+n+' ↓':(kind==='up'?'↑ ':'↓ ')+n;
      button.innerHTML=`<rect class="route-target" x="-34" y="-34" width="68" height="68" rx="17"/><rect class="route-plate" x="-31" y="-31" width="62" height="62" rx="16"/><g aria-hidden="true">${buttonUnits(source,n,0,0)}</g><text class="route-action" x="0" y="24">${action}</text>`;
      button.setAttribute('transform',`translate(${geo.x} ${geo.y})`);
      const label=kind==='entry'?'Add to '+blue:kind==='exit'?'Take away from '+gold:kind==='up'?gold+' to '+blue:blue+' to '+gold;
      button.setAttribute('aria-label',label+', '+n+' '+(n===1?things.slice(0,-1):things));
      const route={button,path,edge,kind,n,geo,index:i};routes.push(route);
      const hit=el('path',{d:geo.d,class:'garage-road-hit','aria-hidden':'true'});hit.addEventListener('click',()=>drive(route));route.hit=hit;$('roads').append(hit);
      button.addEventListener('click',()=>drive(route));button.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();drive(route);}});
      $('controls').append(button);
    });
  }
  function paintGeometry(g){
    $('garage-map').setAttribute('viewBox',`0 0 480 ${g.height}`);
    $('scenery').innerHTML=`<path d="M104 ${g.top+5} Q240 ${g.top-2} 376 ${g.top+5}" fill="none" stroke="#fff7cf" stroke-width="5" opacity=".6"/><path d="M104 ${g.bottom-4} Q240 ${g.bottom+2} 376 ${g.bottom-4}" fill="none" stroke="#80bba1" stroke-width="6" opacity=".5"/>`;
    for(const side of ['blue','gold']){
      const top=side==='blue'?g.top:g.center+1,header=side==='blue'?g.top+20:g.bottom-9;
      $('shell-'+side).setAttribute('y',top);$('shell-'+side).setAttribute('height',(side==='blue'?g.blueHeight:g.goldHeight)-1);
      $('label-'+side).setAttribute('y',header);$('num-'+side).setAttribute('y',header+1);$('cap-'+side).setAttribute('y',side==='blue'?header+17:header-19);
    }
    $('zero-axis').setAttribute('d',`M106 ${g.center} H374`);
    routes.forEach(r=>{
      const geo=routeGeometry(r.kind,r.n,g);r.geo=geo;
      for(const path of [r.path,r.edge,r.hit])path.setAttribute('d',geo.d);
      r.button.setAttribute('transform',`translate(${geo.x} ${geo.y})`);
    });
  }
  function syncCounts(){
    $('left').innerHTML=markup(state.blue);$('right').innerHTML=markup(state.gold);
    const diff=state.blue-state.gold;$('total').textContent=diff<0?'−'+Math.abs(diff):String(diff);$('total').classList.toggle('negative',diff<0);
    const [blue,gold]=names(),pairs=Math.min(state.blue,state.gold);
    $('garage-map').setAttribute('aria-label',`${blue} ${state.blue} minus ${gold} ${state.gold} equals ${diff}. ${pairs} pairs cancel.`);
    for(const side of ['blue','gold']){$('num-'+side).textContent=state[side];$('cap-'+side).textContent=caption(state[side]);}
    updateControls();
  }
  function updateControls(){routes.forEach(r=>root.PlayControls.update(r.button,E.canMove(state,r.kind,r.n),busy,[r.button],[r.hit]));$('garage-map').setAttribute('aria-busy',String(busy));capacityControl?.refresh();themeControl?.refresh();}
  function unitNode(id,side){
    let n=nodes.get(id);if(!n){n=el('g',{'data-id':id});n.append(el('rect',{x:-11,y:-9,width:22,height:18,rx:5,class:'unit-halo'}));const icon=el('svg',{x:-10,y:-7,width:20,height:14,viewBox:theme==='mermaids'?'0 0 460 266':'0 0 44 26'});icon.append(el('use'));n.append(icon);nodes.set(id,n);$('units').append(n);}
    n.querySelector('use').setAttribute('href','#'+symbol(side));n.dataset.side=side;return n;
  }
  function put(n,p){n.setAttribute('transform',`translate(${p.x} ${p.y})`);}
  function targets(){const result=new Map();for(const side of ['blue','gold'])ids[side].forEach((id,i)=>{const p=E.position(state,side,i);result.set(id,p);const n=unitNode(id,side);n.setAttribute('class','garage-unit '+side+' '+(p.paired?'paired':'excess'));n.dataset.index=i;});return result;}
  function drawPairs(){
    $('pairs').replaceChildren();const count=Math.min(state.blue,state.gold),g=E.geometry(state);
    for(let i=0;i<Math.min(count,10);i++){
      const a=E.position(state,'blue',i),b=E.position(state,'gold',i);
      $('pairs').append(el('path',{d:`M${a.x} ${a.y+8} V${b.y-8}`,class:'pair-link'}),el('path',{d:`M${a.x-3} ${g.center} h6 M${a.x} ${g.center-3} v6`,class:'pair-spark'}));
    }
  }
  function render(){paintGeometry(E.geometry(state));const t=targets();t.forEach((p,id)=>{put(nodes.get(id),p);positions.set(id,p);});for(const [id,n]of nodes)if(!t.has(id)){n.remove();nodes.delete(id);positions.delete(id);}syncCounts();drawPairs();}
  const lerp=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  const ease=t=>t*t*(3-2*t);
  function animate(route,moving,oldPositions,before){
    const target=targets(),fromG=E.geometry(before),toG=E.geometry(state);
    const flight=reduced()||!route?0:850,stagger=reduced()?0:80,duration=flight+Math.max(0,moving.length-1)*stagger,settle=reduced()?0:route?460:360,total=duration+settle;
    $('pairs').replaceChildren();
    return new Promise(resolve=>{
      let began;
      function frame(now){
        if(began===undefined)began=now;
        const elapsed=now-began,progress=total?ease(Math.min(1,elapsed/total)):1,g={};
        Object.keys(toG).forEach(k=>{g[k]=fromG[k]+(toG[k]-fromG[k])*progress;});paintGeometry(g);
        const length=route?route.path.getTotalLength():0,start=route?route.path.getPointAtLength(0):null,end=route?route.path.getPointAtLength(length):null;
        for(const [id,n]of nodes){
          const dest=target.has(id)?E.position(state,n.dataset.side,Number(n.dataset.index),g):null,from=oldPositions.get(id)||start;
          if(moving.includes(id)){
            const local=flight?Math.max(0,Math.min(1,(elapsed-moving.indexOf(id)*stagger)/flight)):1;let p;
            if(local<.16)p=lerp(from,start,local/.16);
            else if(local<.80){const q=route.path.getPointAtLength(length*(local-.16)/.64);p={x:q.x,y:q.y};}
            else p=lerp(end,dest||{x:end.x,y:end.y+20},(local-.80)/.20);
            put(n,p);if(!dest)n.style.opacity=String(1-local);
          }else if(dest)put(n,lerp(from,target.get(id),progress));
        }
        if(elapsed<total){root.requestAnimationFrame(frame);return;}
        render();resolve();
      }
      root.requestAnimationFrame(frame);
    });
  }
  function burst(route,pairedBefore){
    const g=E.geometry(state),pairs=Math.min(state.blue,state.gold),host=$('effects');host.replaceChildren();
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
      await animate(route,moving,old,before);burst(route,Math.min(before.blue,before.gold));
      const [blue,gold]=names();$('feedback').textContent=`${blue} ${state.blue} minus ${gold} ${state.gold} equals ${state.blue-state.gold}.`;
    }finally{busy=false;updateControls();}
  }
  function updateURL(){const u=new URL(root.location.href);u.searchParams.set('theme',theme);u.searchParams.set('max',max);u.searchParams.delete('a');u.searchParams.delete('b');root.history.replaceState(null,'',u);}
  async function changeCapacity(next){
    const before={...state},old=new Map(positions),removed=[];
    const kept={blue:ids.blue.slice(0,next),gold:ids.gold.slice(0,next)};
    for(const side of ['blue','gold'])ids[side].slice(next).forEach(id=>removed.push(nodes.get(id)));
    if(!removed.length){max=next;state={...state,max};render();updateURL();return;}
    busy=true;updateControls();
    try{
      await root.PlayCapacity.dissolve(removed);
      max=next;ids=kept;state={blue:ids.blue.length,gold:ids.gold.length,max};
      await animate(null,[],old,before);updateURL();
      $('feedback').textContent='Limit '+max+'. '+names()[0]+' '+state.blue+', '+names()[1]+' '+state.gold+'.';
    }finally{busy=false;updateControls();}
  }
  capacityControl=root.PlayCapacity.create($('play-capacity'),{value:max,isBusy:()=>busy,onChange:changeCapacity});
  themeControl=root.ThemeSwitch.create(doc.querySelector('.theme-switch'),{value:theme,isBusy:()=>busy,onChange:value=>{theme=value;build();render();updateURL();}});
  build();render();
  // Read-only state receipt for regression tests and troubleshooting.
  root.CancellationGarageView={snapshot:()=>({...state,difference:state.blue-state.gold,busy,theme})};
})(window);
