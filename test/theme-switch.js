/* Shared two-stop theme control (cars / mermaids): tap, arrow keys, or
 * drag the highlight across with a finger, like the capacity picker.
 * The highlight tint follows the finger: it takes the mermaid tint once
 * the drag crosses the midpoint, so the switch previews where it will land.
 * A tap still works exactly as before; a drag never changes the theme
 * until the finger lifts past the midpoint. */
(function(root){
  'use strict';
  var VALUES=['cars','mermaids'];
  function create(element,options){
    var value=options.value,drag=null,suppressClick=false;
    var buttons=Array.from(element.querySelectorAll('[data-theme]'));
    element.setAttribute('role','radiogroup');
    function refresh(){
      element.style.setProperty('--theme-step',VALUES.indexOf(value));
      element.dataset.preview=value;
      buttons.forEach(function(b){
        var selected=b.dataset.theme===value;
        b.setAttribute('role','radio');b.setAttribute('aria-checked',String(selected));
        b.setAttribute('aria-pressed',String(selected));b.tabIndex=selected?0:-1;
        b.disabled=!!(options.isBusy&&options.isBusy());
      });
    }
    function choose(next){
      if(VALUES.indexOf(next)<0||next===value||(options.isBusy&&options.isBusy()))return;
      var old=value;value=next;refresh();
      function apply(){
        try{var pending=options.onChange(next);if(pending&&pending.catch)pending.catch(function(){value=old;refresh();});}catch(e){value=old;refresh();throw e;}
      }
      // The whole page cross-fades and slides in the direction the toggle
      // travelled: the new theme enters from the side it lives on (cars on
      // the left, mermaids on the right). Browsers without View Transitions
      // — or with reduced motion on — just switch at once, as before.
      var doc=root.document;
      var reduce=!!(root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches);
      if(reduce||!doc||typeof doc.startViewTransition!=='function'){apply();return;}
      var direction=next==='mermaids'?'to-mermaids':'to-cars';
      doc.documentElement.dataset.themeTransition=direction;
      function clear(){if(doc.documentElement.dataset.themeTransition===direction)delete doc.documentElement.dataset.themeTransition;}
      var transition;
      try{transition=doc.startViewTransition(function(){apply();});}
      catch(e){clear();apply();return;}
      if(transition&&transition.finished&&transition.finished.then)transition.finished.then(clear,clear);
      else clear();
    }
    function sync(next){
      if(VALUES.indexOf(next)<0)return;
      value=next;refresh();
    }
    buttons.forEach(function(b){b.addEventListener('click',function(){choose(b.dataset.theme);});});
    element.addEventListener('keydown',function(e){
      var index=VALUES.indexOf(value);
      if(e.key==='ArrowRight'||e.key==='ArrowDown')index=Math.min(1,index+1);
      else if(e.key==='ArrowLeft'||e.key==='ArrowUp')index=Math.max(0,index-1);
      else if(e.key==='Home')index=0;else if(e.key==='End')index=1;else return;
      e.preventDefault();choose(VALUES[index]);buttons[index].focus();
    });
    function positionAt(clientX){
      var r=element.getBoundingClientRect();
      return Math.max(0,Math.min(VALUES.length-1,(clientX-r.left)/r.width*VALUES.length-.5));
    }
    function clearDrag(e){
      if(!drag||drag.id!==e.pointerId)return;
      drag=null;
      element.classList.remove('is-dragging');
      element.style.removeProperty('--theme-preview');
      element.dataset.preview=value;
    }
    element.addEventListener('pointerdown',function(e){
      if(e.button!==0||e.isPrimary===false||drag)return;
      suppressClick=false;
      if(options.isBusy&&options.isBusy())return;
      drag={id:e.pointerId,x:e.clientX,moved:false};
      // Keep receiving moves outside the switch while preserving clicks on the pressed button.
      e.target.setPointerCapture&&e.target.setPointerCapture(e.pointerId);
    });
    element.addEventListener('pointermove',function(e){
      if(!drag||drag.id!==e.pointerId)return;
      if(!drag.moved){
        if(Math.abs(e.clientX-drag.x)<=6)return;
        drag.moved=true;
        element.classList.add('is-dragging');
      }
      var pos=positionAt(e.clientX);
      element.style.setProperty('--theme-preview',pos);
      element.dataset.preview=VALUES[Math.round(pos)];
    });
    element.addEventListener('pointerup',function(e){
      if(!drag||drag.id!==e.pointerId)return;
      var moved=drag.moved;
      clearDrag(e);
      if(!moved)return;
      suppressClick=true;
      choose(VALUES[Math.round(positionAt(e.clientX))]);
    });
    element.addEventListener('pointercancel',clearDrag);
    element.addEventListener('lostpointercapture',clearDrag);
    element.addEventListener('click',function(e){
      if(!suppressClick||e.detail===0)return;
      suppressClick=false;
      e.preventDefault();
      e.stopPropagation();
    },true);
    refresh();return {refresh:refresh,sync:sync,value:function(){return value;}};
  }
  var api={VALUES:VALUES,create:create};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.ThemeSwitch=api;
})(typeof window==='undefined'?globalThis:window);
