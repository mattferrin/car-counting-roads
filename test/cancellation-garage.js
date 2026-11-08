/* Cancellation Garage: independent test game, shared Quest art and narrator. */
(function(root){
  'use strict';
  const E=root.CancellationGarage,doc=root.document,$=id=>doc.getElementById(id),NS='http://www.w3.org/2000/svg';
  const params=new URLSearchParams(root.location.search);
  let theme=params.get('theme')==='mermaids'?'mermaids':'cars',max=E.capacity(params.get('max'));
  function startCount(key,fallback){const raw=params.get(key);return raw!==null&&/^\d+$/.test(raw)&&Number(raw)<=max?Number(raw):fallback;}
  let state={blue:startCount('a',10),gold:startCount('b',0),max},serial=0,busy=false;
  let ids={blue:Array.from({length:state.blue},()=>++serial),gold:Array.from({length:state.gold},()=>++serial)};
  const nodes=new Map(),positions=new Map(),routes=[];
  const THEMES={cars:[['castle','Castle'],['tree','Magic Tree'],['hill','Sunny Hill'],['track','Race Track'],['volcano','Volcano'],['wash','Car Wash'],['station','Gas Station'],['bridge','Bridge']],mermaids:[['palace','Palace'],['whirlpool','Whirlpool'],['turtle','Turtle Rock'],['cove','Dolphin Cove'],['reef','Coral Reef'],['shell','Giant Shell'],['wreck','Shipwreck'],['chest','Treasure Chest']]};
  const specs=[['entry',10,'left',0],['entry',1,'left',1],['down',10,'right',0],['down',1,'right',1],['up',10,'left',2],['up',1,'left',3],['exit',10,'right',2],['exit',1,'right',3]];
  const names=()=>theme==='cars'?['Blue','Gold','cars']:['Teal','Pink','mermaids'];
  const symbol=side=>theme==='cars'?'car-'+side:'mermaid-'+(side==='blue'?'teal':'pink');
  const el=(tag,attrs={})=>{const n=doc.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
  const caption=n=>Math.floor(n/10)+(Math.floor(n/10)===1?' ten':' tens')+' · '+n%10+(n%10===1?' one':' ones');
  const markup=n=>String(n).split('').map((v,i,a)=>'<span class="d-'+(a.length-i>2?'hun':a.length-i===2?'tens':'ones')+'">'+v+'</span>').join('');
  const reduced=()=>root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let soundOn=true;try{soundOn=root.localStorage.getItem('cp-sound')!=='off';}catch(e){}
  function clearHighlight(){doc.querySelectorAll('.cancellation-garage .speaking').forEach(n=>n.classList.remove('speaking'));}
  function highlight(item){
    clearHighlight();const num=$(item.side==='blue'?'left':'right'),digit=num.querySelector(item.place==='tens'?'.d-tens':'.d-ones');
    (digit||num).classList.add('speaking');$('cap-'+item.side).classList.add('speaking');$('num-'+item.side).classList.add('speaking');
    const count=state[item.side],tens=Math.floor(count/10)*10;
    ids[item.side].forEach((id,i)=>{if(item.place==='tens'?i<tens:i>=tens)nodes.get(id)?.classList.add('speaking');});
  }
  const narrator=root.CountingVoice.createNarrator({root,soundOn,highlight,clear:clearHighlight,onSoundChange:()=>paintSound(true)});
  function paintSound(retry=false){const b=$('sound-toggle'),on=narrator.isOn();b.textContent=retry?'🔇 Tap to retry sound':on?'🔊 Sound on':'🔇 Muted';b.setAttribute('aria-pressed',String(on));}
  $('sound-toggle').addEventListener('click',()=>{narrator.setSound(!narrator.isOn());try{root.localStorage.setItem('cp-sound',narrator.isOn()?'on':'off');}catch(e){}paintSound();if(narrator.isOn())narrator.preload();});
  doc.addEventListener('visibilitychange',()=>{if(doc.hidden)narrator.stop();});
  function routeGeometry(kind,n,side,slot){
    const g=E.geometry(max),left=side==='left';
    let x=left?40:380,y,d;
    // Two nested U roads per side. The outer lane ends beyond the inner
    // lane at both ends, so connectors never cross. Entry/exit sit outside
    // the U roads. Buttons stay on their own road, above every hit area.
    if(kind==='entry'){
      y=g.top+(n===10?4:76);
      d=n===10?`M24 ${y} H58 Q86 ${y} 86 ${y+28} V${g.top+48}`:`M24 ${y} H86`;
    }else if(kind==='exit'){
      y=g.bottom+(n===10?-60:12);
      d=n===10?`M334 ${y} H404`:`M334 ${g.bottom-12} H348 Q360 ${g.bottom-12} 360 ${g.bottom} Q360 ${y} 372 ${y} H404`;
    }else if(kind==='down'&&n===10){
      y=g.top+48;
      d=`M334 ${y} H394 Q412 ${y} 412 ${y+18} V${g.center+76} Q412 ${g.center+94} 394 ${g.center+94} H334`;
    }else if(kind==='down'){
      x=380;y=g.center;
      d=`M334 ${y-38} H362 Q380 ${y-38} 380 ${y-20} V${y+20} Q380 ${y+38} 362 ${y+38} H334`;
    }else if(n===10){
      y=g.center+94;
      d=`M86 ${y} H26 Q8 ${y} 8 ${y-18} V${g.top+66} Q8 ${g.top+48} 26 ${g.top+48} H86`;
    }else{
      x=40;y=g.center;
      d=`M86 ${y+38} H58 Q40 ${y+38} 40 ${y+20} V${y-20} Q40 ${y-38} 58 ${y-38} H86`;
    }
    return {x,y,d};
  }
  function build(){
    const g=E.geometry(max),[blue,gold,things]=names();
    doc.querySelector('.equation').setAttribute('aria-label',blue+' minus '+gold+' equals difference');
    doc.body.dataset.theme=theme;$('world-line').textContent=(theme==='cars'?"Ayan's Car World":"Aliya's Mermaid World")+' · Cancellation Garage';
    doc.querySelectorAll('.theme-pill').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.theme===theme)));
    doc.querySelector('.garage-intro').textContent='Pairs cancel. '+blue+' rises. '+gold+' falls.';
    $('garage-map').setAttribute('viewBox',`0 0 420 ${g.height}`);
    $('scenery').innerHTML=`<path d="M82 54 Q150 18 334 54" fill="none" stroke="#fff7cf" stroke-width="5" opacity=".6"/><path d="M82 ${g.bottom} Q180 ${g.bottom+38} 334 ${g.bottom}" fill="none" stroke="#80bba1" stroke-width="6" opacity=".5"/>`;
    $('shells').replaceChildren();
    for(const side of ['blue','gold']){
      const top=side==='blue'?g.top:g.center+1,header=side==='blue'?g.top+20:g.bottom-9;
      $('shells').append(el('rect',{x:84,y:top,width:252,height:g.half-1,rx:18,class:'garage-shell '+side}));
      const label=el('text',{x:94,y:header,class:'garage-label'});label.textContent=(side==='blue'?blue+' +':gold+' −')+' '+things;$('shells').append(label);
      const num=el('text',{x:324,y:header+1,'text-anchor':'end',class:'garage-number',id:'num-'+side,fill:side==='blue'?'var(--left)':'var(--right)'});$('shells').append(num);
      const cap=el('text',{x:94,y:side==='blue'?header+17:header-19,class:'garage-caption',id:'cap-'+side});$('shells').append(cap);
    }
    $('shells').append(el('path',{d:`M86 ${g.center} H334`,class:'garage-midline'}));
    // A quiet zero-axis, with the actual cars mirrored above and below.
    $('roads').replaceChildren();$('controls').replaceChildren();routes.length=0;
    specs.forEach(([kind,n,side,slot],i)=>{
      const geo=routeGeometry(kind,n,side,slot),[art,name]=THEMES[theme][i];
      const path=el('path',{d:geo.d,class:'garage-road',id:'road-'+i});$('roads').append(path,el('path',{d:geo.d,class:'garage-edge'}));
      const button=el('g',{class:'garage-route',role:'button',tabindex:'0','data-kind':kind,'data-amount':n,'data-route':i});
      const action=kind==='entry'?'+'+n:kind==='exit'?'−'+n:(kind==='up'?'↑':'↓')+n;
      button.innerHTML=`<circle cx="${geo.x}" cy="${geo.y}" r="30" fill="transparent"/><circle class="landmark-disc" cx="${geo.x}" cy="${geo.y}" r="24"/><image class="route-art" href="art/landmarks/${art}.png" x="${geo.x-10}" y="${geo.y-20}" width="20" height="20"/><text class="route-action" x="${geo.x}" y="${geo.y+12}">${action}</text><text class="route-name" x="${geo.x}" y="${geo.y+21}">${name}</text>`;
      const label=kind==='entry'?'Add to '+blue:kind==='exit'?'Take away from '+gold:kind==='up'?gold+' to '+blue:blue+' to '+gold;
      button.setAttribute('aria-label',name+': '+label+', '+n+' '+(n===1?things.slice(0,-1):things));
      const route={button,path,kind,n,geo,index:i};routes.push(route);
      const hit=el('path',{d:geo.d,class:'garage-road-hit','aria-hidden':'true'});hit.addEventListener('click',()=>drive(route));$('roads').append(hit);
      button.addEventListener('click',()=>drive(route));button.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();drive(route);}});
      $('controls').append(button);
    });
    $('capacity').value=String(max);
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
  function updateControls(){routes.forEach(r=>r.button.setAttribute('aria-disabled',String(busy||!E.canMove(state,r.kind,r.n))));$('clear').disabled=busy;$('capacity').disabled=busy;doc.querySelectorAll('.theme-pill').forEach(b=>b.disabled=busy);$('garage-map').setAttribute('aria-busy',String(busy));}
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
    for(let i=0;i<Math.min(10,Math.abs(pairs-pairedBefore));i++){const x=106+i*22+(i>=5?8:0);group.append(el('circle',{cx:x,cy:g.center,r:5,fill:'#ffe58b'}));}
    host.append(group);group.addEventListener('animationend',()=>group.remove(),{once:true});
  }
  async function drive(route){
    if(busy||!E.canMove(state,route.kind,route.n))return;
    busy=true;updateControls();narrator.preload();
    const before={...state},old=new Map(positions),source=route.kind==='up'||route.kind==='exit'?'gold':'blue',dest=route.kind==='up'?'blue':'gold';
    let moving;
    if(route.kind==='entry'){moving=Array.from({length:route.n},()=>++serial);ids.blue.push(...moving);moving.forEach(id=>{unitNode(id,'blue');old.set(id,{x:4,y:route.geo.y});});}
    else{moving=ids[source].splice(-route.n);if(route.kind!=='exit')ids[dest].push(...moving);}
    state=E.move(state,route.kind,route.n);
    try{
      await animate(route,moving,old);burst(route,Math.min(before.blue,before.gold));
      const [blue,gold]=names();$('feedback').textContent=`${blue} ${state.blue} minus ${gold} ${state.gold} equals ${state.blue-state.gold}.`;
      await narrator.speakMove(state,route.kind==='up'||route.kind==='down'?'transfer':route.kind,route.n);
    }finally{busy=false;clearHighlight();updateControls();}
  }
  function updateURL(){const u=new URL(root.location.href);u.searchParams.set('theme',theme);u.searchParams.set('max',max);u.searchParams.delete('a');u.searchParams.delete('b');root.history.replaceState(null,'',u);}
  doc.querySelectorAll('.theme-pill').forEach(b=>b.addEventListener('click',()=>{if(busy)return;narrator.stop();theme=b.dataset.theme;build();render();updateURL();}));
  $('clear').addEventListener('click',()=>{if(busy)return;narrator.stop();state={blue:0,gold:0,max};ids={blue:[],gold:[]};render();$('feedback').textContent='Both garages are empty. Zero minus zero equals zero.';updateURL();});
  $('capacity').addEventListener('change',()=>{
    if(busy)return;const next=E.capacity($('capacity').value);
    if(state.blue>next||state.gold>next){$('capacity').value=String(max);$('feedback').textContent='Move cars out before choosing a smaller garage.';return;}
    max=next;state={...state,max};build();render();updateURL();
  });
  build();render();paintSound();
  // Read-only state receipt for regression tests and troubleshooting.
  root.CancellationGarageView={snapshot:()=>({...state,difference:state.blue-state.gold,busy,theme})};
})(window);
