/* Counting Play: connected ten- and one-unit roads, shared Quest presentation. */
(function(root){
  'use strict';
  const params=new URLSearchParams(root.location?.search),rawMax=params.get('max'),requested=Number(rawMax);
  const LIMIT=/^\d+$/.test(rawMax)&&requested>=10&&requested<=100?requested:20;
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
    const rows=Math.max(2,Math.floor(Math.max(state.blue,state.gold)/10)+1);
    return {rows,height:180+(rows-2)*24,bottom:390+(rows-2)*24};
  }
  function unitPosition(side,index,count,geometry){
    const tens=Math.floor(count/10),row=index<tens*10?Math.floor(index/10):geometry.rows-1;
    return {x:(side==='blue'?73:225)+(index%10+.5)*12.2,y:296+row*24};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={LIMIT,initial,canMove,move,layout,unitPosition};
  if(!root.document)return;
  const doc=root.document,$=id=>doc.getElementById(id),NS='http://www.w3.org/2000/svg';
  doc.querySelectorAll('[data-max]').forEach(button=>button.addEventListener('click',()=>{
    doc.querySelectorAll('[data-max]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    doc.querySelectorAll('[data-counting="true"]').forEach(a=>{a.href='index.html?theme='+(a.classList.contains('mermaids')?'mermaids':'cars')+'&max='+button.dataset.max;});
  }));
  if(!params.has('theme')&&!params.has('max')){$('home').hidden=false;return;}
  $('game').hidden=false;
  let theme=params.get('theme')==='mermaids'?'mermaids':'cars',state=initial(),busy=false,generation=0,serial=0,animation=0;
  let ids={blue:Array.from({length:10},()=>++serial),gold:[]},currentPositions=new Map();
  const names=()=>theme==='mermaids'?['Teal','Pink','mermaids']:['Blue','Gold','cars'];
  const sym=side=>theme==='mermaids'?'mermaid-'+(side==='blue'?'teal':'pink'):'car-'+(side==='blue'?'blue':'gold');
  const numberMarkup=n=>String(n).split('').map((digit,i,a)=>'<span class="d-'+(a.length-i>2?'hun':a.length-i===2?'tens':'ones')+'">'+digit+'</span>').join('');
  const svgNumber=n=>String(n).split('').map((digit,i,a)=>'<tspan class="digit-'+(a.length-i>2?'hun':a.length-i===2?'tens':'ones')+'">'+digit+'</tspan>').join('');
  const svgUse=(side,x,y,w=12,h=10)=>'<svg x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" viewBox="0 0 44 '+(theme==='mermaids'?30:26)+'" aria-hidden="true"><use href="#'+sym(side)+'"/></svg>';
  const caption=n=>Math.floor(n/10)+(Math.floor(n/10)===1?' ten':' tens')+' · '+n%10+(n%10===1?' one':' ones');
  const routeDefs=[['top',10],['top',1],['bottom',10],['bottom',1],['entry',10],['entry',1],['exit',10],['exit',1]];
  const routeNodes=[];
  function routeGeometry(kind,n,g){
    const y=g.bottom-4;
    if(kind==='top')return n===10?{d:'M 108 214 V 84 Q 108 54 138 54 H 282 Q 312 54 312 84 V 214',start:{x:108,y:214},end:{x:312,y:214},plate:{x:135,y:27,w:150,h:54}}:{d:'M 170 214 V 152 Q 170 128 194 128 H 226 Q 250 128 250 152 V 214',start:{x:170,y:214},end:{x:250,y:214},plate:{x:178,y:101,w:64,h:54}};
    if(kind==='bottom')return n===10?{d:`M 312 ${y} V ${y+94} Q 312 ${y+124} 282 ${y+124} H 138 Q 108 ${y+124} 108 ${y+94} V ${y}`,start:{x:312,y},end:{x:108,y},plate:{x:135,y:y+97,w:150,h:54}}:{d:`M 250 ${y} V ${y+34} Q 250 ${y+58} 226 ${y+58} H 194 Q 170 ${y+58} 170 ${y+34} V ${y}`,start:{x:250,y},end:{x:170,y},plate:{x:178,y:y+31,w:64,h:54}};
    const laneY=n===10?258:342;
    return kind==='entry'?{d:`M -18 ${laneY} H 70`,start:{x:-18,y:laneY},end:{x:70,y:laneY},plate:{x:0,y:laneY-27,w:62,h:54}}:{d:`M 350 ${laneY} H 438`,start:{x:350,y:laneY},end:{x:438,y:laneY},plate:{x:358,y:laneY-27,w:62,h:54}};
  }
  function buildTracks(){
    $('tracks').replaceChildren();routeNodes.length=0;
    for(const [kind,n]of routeDefs){
      const r=doc.createElementNS(NS,'g');r.classList.add('route');r.dataset.kind=kind;r.dataset.amount=n;
      r.setAttribute('tabindex','0');r.setAttribute('role','button');
      r.innerHTML='<path class="road"/><path class="edge"/><path class="road-hit"/><g class="route-sign" aria-hidden="true"></g>';
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
      r.querySelector('.route-sign').innerHTML='<rect class="route-plate" x="'+p.x+'" y="'+p.y+'" width="'+p.w+'" height="'+p.h+'" rx="13"/><text class="route-label '+(n===10?'place-ten':'place-one')+'" x="'+(p.x+p.w/2)+'" y="'+(p.y+22)+'">'+label+'</text>'+preview;
      r.setAttribute('aria-disabled',String(busy||!canMove(state,kind,n)));
    }
  }
  function render(){
    const g=layout(state),[left,right,thing]=names(),sea=theme==='mermaids';
    $('left').innerHTML=numberMarkup(state.blue);$('right').innerHTML=numberMarkup(state.gold);$('total').innerHTML=numberMarkup(state.blue+state.gold);
    $('map').setAttribute('viewBox','0 0 420 '+(g.bottom+158));$('map').setAttribute('aria-busy',String(busy));
    $('map').setAttribute('aria-label','Eight connected '+(sea?'tunnels':'roads')+': add, move, and take away ten or one');
    drawRoutes(g);$('garages').replaceChildren();currentPositions=new Map();
    for(const [side,x,label]of[['blue',66,left],['gold',218,right]]){
      const garage=doc.createElementNS(NS,'g');garage.setAttribute('role','img');garage.setAttribute('aria-label',state[side]+' '+label.toLowerCase()+' '+thing);
      const fill=sea?'pool-':'garage-';
      let content='<rect class="garage-shell '+side+'" x="'+x+'" y="210" width="136" height="'+g.height+'" rx="20" fill="url(#'+fill+(side==='blue'?'left':'right')+')"/>';
      content+='<circle cx="'+(x+13)+'" cy="229" r="4" class="side-dot '+side+'"/><text class="garage-label" x="'+(x+22)+'" y="234">'+label+' '+thing+'</text>';
      content+='<text class="garage-number" x="'+(x+10)+'" y="266">'+svgNumber(state[side])+'</text><text class="garage-caption" x="'+(x+10)+'" y="282">'+caption(state[side])+'</text>';
      const tens=Math.floor(state[side]/10);
      for(let row=0;row<tens;row++)content+='<rect class="count-band '+side+'" x="'+(x+5)+'" y="'+(286+row*24)+'" width="126" height="20" rx="7"/>';
      const floor=286+(g.rows-1)*24;
      content+='<rect class="ones-band" x="'+(x+5)+'" y="'+floor+'" width="126" height="20" rx="7"/>';
      // Scenery is behind the countable units and never a movement target.
      content+=sea?'<path class="pool-sand" d="M '+(x+8)+' '+(g.bottom-13)+' Q '+(x+44)+' '+(g.bottom-20)+' '+(x+78)+' '+(g.bottom-13)+' T '+(x+128)+' '+(g.bottom-13)+'"/>':'<path class="garage-drive" d="M '+(x+68)+' '+(g.bottom-6)+' Q '+(x+100)+' '+(g.bottom-26)+' '+(x+66)+' '+(g.bottom-39)+'"/>';
      if(!state[side])content+='<text class="empty-label" x="'+(x+68)+'" y="300" text-anchor="middle">Empty</text>';
      garage.innerHTML=content;
      ids[side].forEach((id,i)=>{
        const p=unitPosition(side,i,state[side],g),obj=doc.createElementNS(NS,'g');obj.classList.add('parked-unit');obj.dataset.unit=id;obj.setAttribute('aria-hidden','true');obj.setAttribute('transform','translate('+p.x+' '+p.y+')');obj.innerHTML=svgUse(side,-5.8,-5.5,11.6,11);garage.appendChild(obj);currentPositions.set(id,p);
      });
      $('garages').appendChild(garage);
    }
    doc.querySelectorAll('.theme-pill').forEach(b=>{b.disabled=busy;b.setAttribute('aria-pressed',String(b.dataset.theme===theme));});
  }
  function finish(next,nextIds,oldPositions,movingSet,token){
    if(token!==generation)return;
    state=next;ids=nextIds;$('traffic').replaceChildren();$('motion-paths').replaceChildren();render();
    const tweens=[];
    for(const obj of doc.querySelectorAll('.parked-unit')){
      const id=Number(obj.dataset.unit),from=oldPositions.get(id),to=currentPositions.get(id);
      if(from&&!movingSet.has(id)&&(from.x!==to.x||from.y!==to.y))tweens.push({obj,from,to});
    }
    const ready=()=>{
      if(token!==generation)return;busy=false;
      routeNodes.forEach(r=>r.setAttribute('aria-disabled',String(!canMove(state,r.dataset.kind,Number(r.dataset.amount)))));
      doc.querySelectorAll('.theme-pill').forEach(b=>{b.disabled=false;});$('map').setAttribute('aria-busy','false');
      const [left,right]=names();$('feedback').textContent=left+' '+state.blue+', '+right+' '+state.gold+'. '+(state.blue+state.gold)+' altogether.';
    };
    if(!tweens.length||root.matchMedia('(prefers-reduced-motion: reduce)').matches){ready();return;}
    const started=performance.now();
    function settle(now){
      if(token!==generation)return;
      const t=Math.min(1,(now-started)/320),ease=1-Math.pow(1-t,3);
      for(const {obj,from,to}of tweens)obj.setAttribute('transform','translate('+(from.x+(to.x-from.x)*ease)+' '+(from.y+(to.y-from.y)*ease)+')');
      if(t<1)animation=root.requestAnimationFrame(settle);else ready();
    }
    animation=root.requestAnimationFrame(settle);
  }
  function drive(route){
    const kind=route.dataset.kind,n=Number(route.dataset.amount);
    if(busy||!canMove(state,kind,n))return;
    const next=move(state,kind,n),source=kind==='entry'?null:kind==='top'?'blue':'gold',dest=kind==='exit'?null:kind==='top'?'gold':'blue';
    const movingIds=source?(n===10?ids[source].slice(0,n):ids[source].slice(-n)):Array.from({length:n},()=>++serial),movingSet=new Set(movingIds);
    const nextIds={blue:ids.blue.filter(id=>!movingSet.has(id)),gold:ids.gold.filter(id=>!movingSet.has(id))};if(dest)nextIds[dest].push(...movingIds);
    const oldPositions=new Map(currentPositions),token=++generation;busy=true;render();
    if(root.matchMedia('(prefers-reduced-motion: reduce)').matches){finish(next,nextIds,oldPositions,movingSet,token);return;}
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
      if(now-started<duration+(n-1)*60)animation=root.requestAnimationFrame(frame);else finish(next,nextIds,oldPositions,movingSet,token);
    }
    animation=root.requestAnimationFrame(frame);
  }
  function setTheme(value){
    theme=value;doc.body.dataset.theme=theme;
    const title=theme==='mermaids'?"Aliya's Mermaid World":"Ayan's Car World";
    doc.title=title+' · Counting Play';$('world-line').textContent=title+' · Counting Play';
    $('game').querySelector('.equation').setAttribute('aria-label',names()[0]+' plus '+names()[1]+' equals total');
    const nextLimit=LIMIT<50?50:LIMIT<100?100:20;$('bigger-world').textContent='Try '+nextLimit;$('bigger-world').href='?theme='+theme+'&max='+nextLimit;
    root.history.replaceState(null,'','?'+new URLSearchParams({theme,max:String(LIMIT)}));
    buildTracks();render();
  }
  doc.querySelectorAll('.theme-pill').forEach(b=>b.addEventListener('click',()=>{if(!busy)setTheme(b.dataset.theme);}));
  $('reset').addEventListener('click',()=>{++generation;root.cancelAnimationFrame(animation);busy=false;state=initial();ids={blue:Array.from({length:10},()=>++serial),gold:[]};$('traffic').replaceChildren();$('motion-paths').replaceChildren();render();$('feedback').textContent='Reset. Ten on the left, zero on the right.';});
  $('capacity').textContent=LIMIT;setTheme(theme);
})(typeof window==='undefined'?globalThis:window);
