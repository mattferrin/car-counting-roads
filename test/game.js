/* Addition Play: connected ten- and one-unit roads, shared Quest presentation. */
(function(root){
  'use strict';
  const params=new URLSearchParams(root.location?.search),rawMax=params.get('max'),requested=Number(rawMax);
  let LIMIT=/^\d+$/.test(rawMax)&&requested>=10&&requested<=100?requested:20;
  const initial=()=>({blue:10,gold:0});
  function canMove(state,kind,n){
    if(![1,10].includes(n))return false;
    if(kind==='entry')return state.blue+state.gold+n<=LIMIT;
    if(kind==='top')return state.blue>=n;
    if(kind==='bottom'||kind==='exit')return state.gold>=n;
    return false;
  }
  function move(state,kind,n){
    if(!canMove(state,kind,n))return state;
    return {blue:state.blue+(kind==='entry'||kind==='bottom'?n:kind==='top'?-n:0),gold:state.gold+(kind==='top'?n:kind==='bottom'||kind==='exit'?-n:0)};
  }
  function layout(state){
    const rows=Math.max(1,Math.ceil(Math.max(state.blue,state.gold)/10));
    return {rows,top:170,unitY:256,height:110+(rows-1)*24,bottom:280+(rows-1)*24};
  }
  function unitPosition(side,index,count,geometry){
    const tens=Math.floor(count/10),row=index<tens*10?Math.floor(index/10):geometry.rows-1;
    return {x:(side==='blue'?73:225)+(index%10+.5)*12.2,y:geometry.unitY+row*24};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={LIMIT,initial,canMove,move,layout,unitPosition};
  if(!root.document)return;
  const doc=root.document,$=id=>doc.getElementById(id),NS='http://www.w3.org/2000/svg';
  LIMIT=[20,50,100].find(n=>n>=LIMIT)||100;
  doc.querySelectorAll('.home-capacity').forEach(element=>root.PlayCapacity.create(element,{value:20,onChange:value=>{
    const card=element.closest('.choose-game');
    card.querySelectorAll('[data-counting="true"],[data-garage="true"]').forEach(a=>{
      a.href=(a.dataset.garage==='true'?'cancellation-garage.html':'index.html')+'?theme='+(a.classList.contains('mermaids')?'mermaids':'cars')+'&max='+value;
    });
  }}));
  if(!params.has('theme')&&!params.has('max')){$('home').hidden=false;return;}
  $('game').hidden=false;
  let theme=params.get('theme')==='mermaids'?'mermaids':'cars',state=initial(),busy=false,generation=0,serial=0,animation=0,capacityControl=null,themeControl=null;
  /* Spoken narration (CountingVoice): the digit being counted glows
   * in the equation and the matching garage caption glows with it.
   * The stored preference lives under 'cp-sound'; stop() silences
   * the current speech without touching it. */
  let soundOn=true;try{soundOn=root.localStorage.getItem('cp-sound')!=='off';}catch(e){}
  function highlightVoice(side,place,count){
    clearVoiceHighlight();
    const numEl=side==='blue'?$('left'):$('right');
    const cls=place==='tens'?'.d-tens':'.d-ones';
    const digit=numEl.querySelector(cls);
    (digit||numEl).classList.add('speaking');
    const caps=doc.querySelectorAll('.garage-caption'),cap=caps[side==='blue'?0:1];
    if(cap)cap.classList.add('speaking');
    const garages=doc.querySelectorAll('#garages > g'),garage=garages[side==='blue'?0:1];
    if(garage&&count>0){
      if(place==='tens'){
        garage.querySelectorAll('.count-band').forEach((b,i)=>{if(i<count)b.classList.add('speaking');});
        garage.querySelectorAll('.parked-unit').forEach((u,i)=>{if(i<count*10)u.classList.add('speaking');});
      }else{
        const band=garage.querySelector('.ones-band');if(band)band.classList.add('speaking');
        const units=garage.querySelectorAll('.parked-unit');
        units.forEach((u,i)=>{if(i>=units.length-count)u.classList.add('speaking');});
      }
    }
  }
  function clearVoiceHighlight(){doc.querySelectorAll('#game .speaking').forEach(n=>n.classList.remove('speaking'));}
  const narrator=root.CountingVoice?root.CountingVoice.createNarrator({root,soundOn,highlight:p=>highlightVoice(p.side,p.place,p.count),clear:clearVoiceHighlight,onSoundChange:(on,retry)=>{if(!on&&retry){const b=$('sound-toggle');if(b){b.textContent='🔇 Tap to retry sound';b.setAttribute('aria-pressed','false');}}}}):null;
  function paintSoundButton(){const b=$('sound-toggle');if(!b)return;const on=narrator?narrator.isOn():soundOn;b.textContent=on?'🔊 Sound on':'🔇 Muted';b.setAttribute('aria-pressed',String(on));}
  $('sound-toggle').addEventListener('click',()=>{const on=narrator?narrator.setSound(!narrator.isOn()):!soundOn;soundOn=on;try{root.localStorage.setItem('cp-sound',on?'on':'off');}catch(e){}paintSoundButton();if(on&&narrator)narrator.preload();});
  doc.addEventListener('visibilitychange',()=>{if(doc.hidden&&narrator)narrator.stop();});
  paintSoundButton();if(narrator&&narrator.isOn())narrator.preload();
  let ids={blue:Array.from({length:10},()=>++serial),gold:[]},currentPositions=new Map();
  const names=()=>theme==='mermaids'?['Teal','Pink','mermaids']:['Blue','Gold','cars'];
  const sym=side=>theme==='mermaids'?'mermaid-'+(side==='blue'?'teal':'pink'):'car-'+(side==='blue'?'blue':'gold');
  const otherSym=side=>theme==='mermaids'?'car-'+(side==='blue'?'blue':'gold'):'mermaid-'+(side==='blue'?'teal':'pink');
  const numberMarkup=n=>String(n).split('').map((digit,i,a)=>'<span class="d-'+(a.length-i>2?'hun':a.length-i===2?'tens':'ones')+'">'+digit+'</span>').join('');
  const svgNumber=n=>String(n).split('').map((digit,i,a)=>'<tspan class="digit-'+(a.length-i>2?'hun':a.length-i===2?'tens':'ones')+'">'+digit+'</tspan>').join('');
  // Every character carries the other theme's twin, hidden, so a drag
  // wipes it in from the finger's side — parked units, route previews
  // and flying sprites all go through here.
  const svgUse=(side,x,y,w=12,h=10)=>'<svg x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" viewBox="'+(theme==='mermaids'?"0 0 460 266":"0 0 44 26")+'" aria-hidden="true"><use href="#'+sym(side)+'"/></svg><svg class="svg-next" x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" viewBox="'+(theme==='mermaids'?"0 0 44 26":"0 0 460 266")+'" aria-hidden="true"><use href="#'+otherSym(side)+'"/></svg>';
  const caption=n=>Math.floor(n/10)+(Math.floor(n/10)===1?' ten':' tens')+' · '+n%10+(n%10===1?' one':' ones');
  const routeDefs=[['top',10],['top',1],['bottom',10],['bottom',1],['entry',10],['entry',1],['exit',10],['exit',1]];
  const routeNodes=[];
  function routeGeometry(kind,n,g){
    const y=g.bottom-4;
    if(kind==='top')return n===10?{d:'M 108 174 V 96 Q 108 66 138 66 H 282 Q 312 66 312 96 V 174',start:{x:108,y:174},end:{x:312,y:174},plate:{x:135,y:39,w:150,h:54}}:{d:'M 170 174 V 150 Q 170 130 190 130 H 230 Q 250 130 250 150 V 174',start:{x:170,y:174},end:{x:250,y:174},plate:{x:178,y:103,w:64,h:54}};
    if(kind==='bottom')return n===10?{d:`M 312 ${y} V ${y+64} Q 312 ${y+94} 282 ${y+94} H 138 Q 108 ${y+94} 108 ${y+64} V ${y}`,start:{x:312,y},end:{x:108,y},plate:{x:135,y:y+67,w:150,h:54}}:{d:`M 250 ${y} V ${y+16} Q 250 ${y+36} 230 ${y+36} H 190 Q 170 ${y+36} 170 ${y+16} V ${y}`,start:{x:250,y},end:{x:170,y},plate:{x:178,y:y+9,w:64,h:54}};
    const port=n===10?g.top+48:g.bottom-20,outer=n===10?102:g.bottom+14;
    if(kind==='entry')return {d:`M 31 ${outer} V ${port+(n===10?-12:12)} Q 31 ${port} 43 ${port} H 70`,start:{x:31,y:outer},end:{x:70,y:port},plate:{x:0,y:n===10?48:outer,w:62,h:54}};
    return {d:`M 350 ${port} H 377 Q 389 ${port} 389 ${port+(n===10?-12:12)} V ${outer}`,start:{x:350,y:port},end:{x:389,y:outer},plate:{x:358,y:n===10?48:outer,w:62,h:54}};
  }
  function buildTracks(){
    $('tracks').replaceChildren();routeNodes.length=0;
    for(const [kind,n]of routeDefs){
      const r=doc.createElementNS(NS,'g');r.classList.add('route');r.dataset.kind=kind;r.dataset.amount=n;
      r.setAttribute('tabindex','0');r.setAttribute('role','button');
      r.innerHTML='<path class="road" pointer-events="none"/><path class="road-next" pointer-events="none"/><path class="edge" pointer-events="none"/><path class="edge-next" pointer-events="none"/><path class="road-hit"/><g class="route-sign" aria-hidden="true"></g>';
      r.addEventListener('click',()=>drive(r));r.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();drive(r);}});
      $('tracks').appendChild(r);routeNodes.push(r);
    }
  }
  function drawRoutes(g){
    const [left,right,thing]=names();
    for(const r of routeNodes){
      const kind=r.dataset.kind,n=Number(r.dataset.amount),geo=routeGeometry(kind,n,g),p=geo.plate;
      for(const path of r.querySelectorAll('path'))path.setAttribute('d',geo.d);
      const action=kind==='entry'?'Add to '+left:kind==='exit'?'Take from '+right:kind==='top'?left+' to '+right:right+' to '+left;
      r.setAttribute('aria-label',action+': '+n+' '+(n===1?thing.slice(0,-1):thing)+' (1 '+(n===10?'ten':'one')+')');
      const label=kind==='entry'?'+'+n+' →':kind==='exit'?'−'+n+' →':n+(kind==='top'?' →':' ←');
      const side=kind==='bottom'||kind==='exit'?'gold':'blue';
      let preview='';
      if(n===1)preview=svgUse(side,p.x+p.w/2-9,p.y+29,18,14);
      else if(p.w>100)for(let i=0;i<10;i++)preview+=svgUse(side,p.x+8+i*13.5,p.y+32,12.5,10);
      else for(let i=0;i<10;i++)preview+=svgUse(side,p.x+5+(i%5)*10.4,p.y+28+Math.floor(i/5)*10.5,10,9);
      r.querySelector('.route-sign').innerHTML='<rect class="route-plate" x="'+p.x+'" y="'+p.y+'" width="'+p.w+'" height="'+p.h+'" rx="13"/><rect class="route-plate-next" x="'+p.x+'" y="'+p.y+'" width="'+p.w+'" height="'+p.h+'" rx="13"/><text class="route-label '+(n===10?'place-ten':'place-one')+'" x="'+(p.x+p.w/2)+'" y="'+(p.y+22)+'">'+label+'</text>'+preview;
      updateRoute(r);
    }
  }
  function updateRoute(r){
    root.PlayControls.update(r,canMove(state,r.dataset.kind,Number(r.dataset.amount)),busy,[r.querySelector('.route-sign')],[r.querySelector('.road-hit')]);
  }
  function render(){
    const g=layout(state),[left,right,thing]=names(),sea=theme==='mermaids';
    $('left').innerHTML=numberMarkup(state.blue);$('right').innerHTML=numberMarkup(state.gold);$('total').innerHTML=numberMarkup(state.blue+state.gold);
    $('map').setAttribute('viewBox','0 0 420 '+(g.bottom+128));$('map').setAttribute('aria-busy',String(busy));
    $('map').setAttribute('aria-label','Eight connected '+(sea?'tunnels':'roads')+': add, move, and take away ten or one');
    drawRoutes(g);$('garages').replaceChildren();currentPositions=new Map();
    for(const [side,x,label]of[['blue',66,left],['gold',218,right]]){
      const garage=doc.createElementNS(NS,'g');garage.setAttribute('role','img');garage.setAttribute('aria-label',state[side]+' '+label.toLowerCase()+' '+thing);
      const fill=sea?'pool-':'garage-', otherFill=sea?'garage-':'pool-';
      let content='<rect class="garage-shell '+side+'" x="'+x+'" y="'+g.top+'" width="136" height="'+g.height+'" rx="20" fill="url(#'+fill+(side==='blue'?'left':'right')+')"/>';
      // The other theme's pool/garage rides along, hidden, so the shell
      // wipes with the drag.
      content+='<rect class="garage-shell-next '+side+'" x="'+x+'" y="'+g.top+'" width="136" height="'+g.height+'" rx="20" fill="url(#'+otherFill+(side==='blue'?'left':'right')+')"/>';
      content+='<circle cx="'+(x+13)+'" cy="'+(g.top+19)+'" r="4" class="side-dot '+side+'"/><text class="garage-label" x="'+(x+22)+'" y="'+(g.top+24)+'">'+label+' '+thing+'</text>';
      content+='<text class="garage-number" x="'+(x+10)+'" y="'+(g.top+56)+'">'+svgNumber(state[side])+'</text><text class="garage-caption" x="'+(x+10)+'" y="'+(g.top+72)+'">'+caption(state[side])+'</text>';
      const tens=Math.floor(state[side]/10);
      for(let row=0;row<tens;row++)content+='<rect class="count-band '+side+'" x="'+(x+5)+'" y="'+(g.unitY-10+row*24)+'" width="126" height="20" rx="7"/><rect class="count-band-next '+side+'" x="'+(x+5)+'" y="'+(g.unitY-10+row*24)+'" width="126" height="20" rx="7"/>';
      const floor=g.unitY-10+(g.rows-1)*24;
      if(state[side]%10)content+='<rect class="ones-band" x="'+(x+5)+'" y="'+floor+'" width="126" height="20" rx="7"/><rect class="ones-band-next" x="'+(x+5)+'" y="'+floor+'" width="126" height="20" rx="7"/>';
      // Scenery is behind the countable units and never a movement target.
      // The other theme's scenery rides along too, so the sand/drive
      // wipes with the drag.
      content+=sea?'<path class="pool-sand" d="M '+(x+8)+' '+(g.bottom-13)+' Q '+(x+44)+' '+(g.bottom-20)+' '+(x+78)+' '+(g.bottom-13)+' T '+(x+128)+' '+(g.bottom-13)+'"/><path class="garage-drive-next" d="M '+(x+68)+' '+(g.bottom-6)+' Q '+(x+100)+' '+(g.bottom-26)+' '+(x+66)+' '+(g.bottom-39)+'"/>':'<path class="garage-drive" d="M '+(x+68)+' '+(g.bottom-6)+' Q '+(x+100)+' '+(g.bottom-26)+' '+(x+66)+' '+(g.bottom-39)+'"/><path class="pool-sand-next" d="M '+(x+8)+' '+(g.bottom-13)+' Q '+(x+44)+' '+(g.bottom-20)+' '+(x+78)+' '+(g.bottom-13)+' T '+(x+128)+' '+(g.bottom-13)+'"/>';
      if(!state[side])content+='<text class="empty-label" x="'+(x+68)+'" y="'+(g.unitY+4)+'" text-anchor="middle">Empty</text>';
      garage.innerHTML=content;
      ids[side].forEach((id,i)=>{
        const p=unitPosition(side,i,state[side],g),obj=doc.createElementNS(NS,'g');obj.classList.add('parked-unit');obj.dataset.unit=id;obj.setAttribute('aria-hidden','true');obj.setAttribute('transform','translate('+p.x+' '+p.y+')');obj.innerHTML=svgUse(side,-5.8,-5.5,11.6,11);garage.appendChild(obj);currentPositions.set(id,p);
      });
      $('garages').appendChild(garage);
    }
    capacityControl?.refresh();
    themeControl?.refresh();
  }
  function finish(next,nextIds,oldPositions,movingSet,token,moveDesc){
    if(token!==generation)return;
    state=next;ids=nextIds;$('traffic').replaceChildren();$('motion-paths').replaceChildren();render();
    const tweens=[];
    for(const obj of doc.querySelectorAll('.parked-unit')){
      const id=Number(obj.dataset.unit),from=oldPositions.get(id),to=currentPositions.get(id);
      if(from&&!movingSet.has(id)&&(from.x!==to.x||from.y!==to.y))tweens.push({obj,from,to});
    }
    const ready=()=>{
      if(token!==generation)return;busy=false;capacityControl?.refresh();themeControl?.refresh();
      routeNodes.forEach(updateRoute);
      $('map').setAttribute('aria-busy','false');
      const [left,right]=names();$('feedback').textContent=left+' '+state.blue+', '+right+' '+state.gold+'. '+(state.blue+state.gold)+' altogether.';
    };
    /* Buttons stay locked until the post-move narration ends: ready()
     * only runs after the narrator finishes (or at once when muted). */
    const narrate=()=>{if(!narrator||!moveDesc){ready();return;}narrator.speakMove(next,moveDesc.kind,moveDesc.amount).then(ready,ready);};
    if(!tweens.length||root.matchMedia('(prefers-reduced-motion: reduce)').matches){narrate();return;}
    const started=performance.now();
    function settle(now){
      if(token!==generation)return;
      const t=Math.min(1,(now-started)/320),ease=1-Math.pow(1-t,3);
      for(const {obj,from,to}of tweens)obj.setAttribute('transform','translate('+(from.x+(to.x-from.x)*ease)+' '+(from.y+(to.y-from.y)*ease)+')');
      if(t<1)animation=root.requestAnimationFrame(settle);else narrate();
    }
    animation=root.requestAnimationFrame(settle);
  }
  function drive(route){
    const kind=route.dataset.kind,n=Number(route.dataset.amount);
    if(busy||!canMove(state,kind,n))return;
    narrator?.unlock?.();
    const next=move(state,kind,n),moveDesc={kind,amount:n},source=kind==='entry'?null:kind==='top'?'blue':'gold',dest=kind==='exit'?null:kind==='top'?'gold':'blue';
    const movingIds=source?(n===10?ids[source].slice(0,n):ids[source].slice(-n)):Array.from({length:n},()=>++serial),movingSet=new Set(movingIds);
    const nextIds={blue:ids.blue.filter(id=>!movingSet.has(id)),gold:ids.gold.filter(id=>!movingSet.has(id))};if(dest)nextIds[dest].push(...movingIds);
    const oldPositions=new Map(currentPositions),token=++generation;busy=true;render();
    if(root.matchMedia('(prefers-reduced-motion: reduce)').matches){finish(next,nextIds,oldPositions,movingSet,token,moveDesc);return;}
    const geo=routeGeometry(kind,n,layout(state)),nextLayout=layout(next),flights=[];
    movingIds.forEach((id,i)=>{
      const from=source?oldPositions.get(id):geo.start;
      const index=dest?nextIds[dest].indexOf(id):0,to=dest?unitPosition(dest,index,next[dest],nextLayout):geo.end;
      const path=doc.createElementNS(NS,'path');
      const middle=geo.d.replace(/^M\s*-?[\d.]+[ ,]+-?[\d.]+/,'');
      path.setAttribute('d','M '+from.x+' '+from.y+' L '+geo.start.x+' '+geo.start.y+middle+' L '+to.x+' '+to.y);$('motion-paths').appendChild(path);
      const sprite=doc.createElementNS(NS,'g');sprite.innerHTML=svgUse(source||dest,-7,-6,14,12);$('traffic').appendChild(sprite);
      const parked=doc.querySelector('[data-unit="'+id+'"]');if(parked)parked.style.visibility='hidden';
      flights.push({sprite,path,length:path.getTotalLength(),delay:i*60});
    });
    const started=performance.now(),duration=1000;
    function frame(now){
      if(token!==generation)return;
      for(const f of flights){
        const raw=(now-started-f.delay)/duration,t=Math.max(0,Math.min(1,raw)),p=f.path.getPointAtLength(t*f.length);
        f.sprite.style.visibility=raw<0?'hidden':'visible';f.sprite.setAttribute('transform','translate('+p.x+' '+p.y+')');
        if(kind==='exit')f.sprite.style.opacity=String(Math.min(1,(1-t)*6));
      }
      if(now-started<duration+(n-1)*60)animation=root.requestAnimationFrame(frame);else finish(next,nextIds,oldPositions,movingSet,token,moveDesc);
    }
    animation=root.requestAnimationFrame(frame);
  }
  function setTheme(value){
    theme=value;doc.body.dataset.theme=theme;
    const title=theme==='mermaids'?"Aliya's Mermaid World":"Ayan's Car World";
    doc.title=title+' · Addition Play';$('world-line').textContent=title+' · Addition Play';
    $('world-line').dataset.next=(theme==='mermaids'?"Ayan's Car World":"Aliya's Mermaid World")+' · Addition Play';
    $('game').querySelector('.equation').setAttribute('aria-label',names()[0]+' plus '+names()[1]+' equals total');
    root.history.replaceState(null,'','?'+new URLSearchParams({theme,max:String(LIMIT)}));
    buildTracks();render();
  }
  async function changeCapacity(next){
    if(busy)return;
    const excess=Math.max(0,state.blue+state.gold-next),removed=new Set([...ids.blue,...ids.gold].sort((a,b)=>b-a).slice(0,excess));
    if(!excess){LIMIT=next;root.history.replaceState(null,'','?'+new URLSearchParams({theme,max:String(LIMIT)}));render();return;}
    busy=true;narrator?.stop();render();
    await root.PlayCapacity.dissolve([...doc.querySelectorAll('.parked-unit')].filter(n=>removed.has(Number(n.dataset.unit))));
    const old=new Map(currentPositions),kept={blue:ids.blue.filter(id=>!removed.has(id)),gold:ids.gold.filter(id=>!removed.has(id))};
    LIMIT=next;root.history.replaceState(null,'','?'+new URLSearchParams({theme,max:String(LIMIT)}));
    finish({blue:kept.blue.length,gold:kept.gold.length},kept,old,new Set(),++generation,null);
  }
  capacityControl=root.PlayCapacity.create($('play-capacity'),{value:LIMIT,isBusy:()=>busy,onChange:changeCapacity});
  themeControl=root.ThemeSwitch.create(doc.querySelector('.theme-switch'),{value:theme,isBusy:()=>busy,onChange:value=>{setTheme(value);}});
  setTheme(theme);
})(typeof window==='undefined'?globalThis:window);
