/* Shared three-stop capacity control and quiet excess-object dissolve. */
(function(root){
  'use strict';
  const VALUES=[20,50,100];
  function create(element,options){
    let value=options.value,drag=null,suppressClick=false;
    const buttons=Array.from(element.querySelectorAll('[data-max]'));
    element.setAttribute('role','radiogroup');
    function refresh(){
      element.style.setProperty('--capacity-step',VALUES.indexOf(value));
      buttons.forEach(b=>{
        const selected=Number(b.dataset.max)===value;
        b.setAttribute('role','radio');b.setAttribute('aria-checked',String(selected));
        b.setAttribute('aria-pressed',String(selected));b.tabIndex=selected?0:-1;
        b.disabled=!!options.isBusy?.();
      });
    }
    function choose(next){
      if(!VALUES.includes(next)||next===value||options.isBusy?.())return;
      const old=value;value=next;refresh();
      try{const pending=options.onChange(next);if(pending?.catch)pending.catch(()=>{value=old;refresh();});}catch(e){value=old;refresh();throw e;}
    }
    buttons.forEach(b=>b.addEventListener('click',()=>choose(Number(b.dataset.max))));
    element.addEventListener('keydown',e=>{
      let index=VALUES.indexOf(value);
      if(e.key==='ArrowRight'||e.key==='ArrowDown')index=Math.min(2,index+1);
      else if(e.key==='ArrowLeft'||e.key==='ArrowUp')index=Math.max(0,index-1);
      else if(e.key==='Home')index=0;else if(e.key==='End')index=2;else return;
      e.preventDefault();choose(VALUES[index]);buttons[index].focus();
    });
    element.addEventListener('pointerdown',e=>{if(options.isBusy?.()||e.button!==0)return;drag={id:e.pointerId,x:e.clientX,moved:false};});
    element.addEventListener('pointermove',e=>{
      if(!drag||drag.id!==e.pointerId)return;
      if(Math.abs(e.clientX-drag.x)>6){drag.moved=true;try{element.setPointerCapture(e.pointerId);}catch(err){}}
    });
    element.addEventListener('pointerup',e=>{
      if(!drag||drag.id!==e.pointerId)return;const moved=drag.moved;drag=null;if(!moved)return;
      const r=element.getBoundingClientRect(),index=Math.max(0,Math.min(2,Math.floor((e.clientX-r.left)/r.width*3)));
      suppressClick=true;choose(VALUES[index]);e.preventDefault();root.setTimeout(()=>{suppressClick=false;},0);
    });
    element.addEventListener('pointercancel',()=>{drag=null;});
    element.addEventListener('click',e=>{if(suppressClick){suppressClick=false;e.preventDefault();e.stopImmediatePropagation();}},true);
    refresh();return {refresh,value:()=>value};
  }
  function dissolve(nodes){
    if(!nodes.length||root.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return Promise.resolve();
    const NS='http://www.w3.org/2000/svg';
    nodes.forEach(node=>{
      const smoke=root.document.createElementNS(NS,'g');smoke.classList.add('capacity-smoke');
      smoke.innerHTML='<circle cx="-5" cy="0" r="4"/><circle cx="2" cy="-3" r="5"/><circle cx="6" cy="1" r="3"/>';
      const embers=root.document.createElementNS(NS,'g');embers.classList.add('capacity-embers');
      embers.innerHTML='<circle cx="-4" cy="3" r="2.5"/><circle cx="4" cy="1" r="2"/>';
      node.append(embers,smoke);node.classList.add('capacity-burning');
    });
    return new Promise(resolve=>{
      let done=false;const last=nodes[nodes.length-1];
      const finish=()=>{if(done)return;done=true;root.clearTimeout(timer);last.removeEventListener('animationend',ended);resolve();};
      const ended=e=>{if(e.target===last&&e.animationName==='capacity-burn')finish();};
      const timer=root.setTimeout(finish,720);last.addEventListener('animationend',ended);
    });
  }
  const api={VALUES,create,dissolve};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.PlayCapacity=api;
})(typeof window==='undefined'?globalThis:window);
