/* Shared two-stop theme control (cars / mermaids): tap, arrow keys, or
 * drag the highlight across with a finger, like the capacity picker.
 * The highlight tint follows the finger: it takes the mermaid tint once
 * the drag crosses the midpoint, so the switch previews where it will land.
 * While dragging, the incoming theme's sky also wipes in across the page
 * and the side colours blend by the same progress; letting go past the
 * midpoint commits the theme, letting go before it eases the page back.
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
    /* Finger-driven wipe: while the toggle is dragged, the incoming
     * theme's sky washes in behind the finger — the boundary travels
     * the same direction as the thumb — and the two side colours blend
     * by the same progress, so the page is half one theme and half the
     * other at the halfway point. The cars and mermaids themselves swap
     * only when the drag commits: the game holds one set of objects at
     * a time. Landmark buttons carry the same wipe on their pictures. */
    var THEME_COLORS={cars:{left:[22,104,214],right:[201,138,4]},mermaids:{left:[14,125,140],right:[214,51,132]}};
    function lerpChannel(a,b,t){return Math.round(a+(b-a)*t);}
    function lerpColor(a,b,t){return 'rgb('+lerpChannel(a[0],b[0],t)+', '+lerpChannel(a[1],b[1],t)+', '+lerpChannel(a[2],b[2],t)+')';}
    var blend=null,blendToken=0;
    function setBlend(pos){
      var doc=root.document;if(!doc||!doc.body)return;
      var target=value==='cars'?'mermaids':'cars';
      var t=value==='cars'?pos:1-pos;
      var from=THEME_COLORS[value],to=THEME_COLORS[target];
      doc.body.dataset.blendTarget=target;
      doc.body.style.setProperty('--theme-wipe',pos.toFixed(3));
      doc.body.style.setProperty('--left',lerpColor(from.left,to.left,t));
      doc.body.style.setProperty('--right',lerpColor(from.right,to.right,t));
      blend={target:target,p:pos};
    }
    function clearBlend(){
      var doc=root.document;if(!doc||!doc.body)return;
      delete doc.body.dataset.blendTarget;
      doc.body.style.removeProperty('--theme-wipe');
      doc.body.style.removeProperty('--left');
      doc.body.style.removeProperty('--right');
      blend=null;
    }
    function tweenBlendToRest(){
      if(!blend){clearBlend();return;}
      var rest=value==='cars'?0:1,start=blend.p,token=++blendToken,t0=null;
      if(start===rest){clearBlend();return;}
      if(typeof root.requestAnimationFrame!=='function'){clearBlend();return;}
      function frame(now){
        if(token!==blendToken)return;
        if(t0===null)t0=now;
        var k=Math.min(1,(now-t0)/180);
        var eased=1-Math.pow(1-k,3);
        setBlend(start+(rest-start)*eased);
        if(k<1)root.requestAnimationFrame(frame);
        else clearBlend();
      }
      root.requestAnimationFrame(frame);
    }
    function choose(next){
      if(VALUES.indexOf(next)<0||next===value||(options.isBusy&&options.isBusy()))return;
      blendToken++;clearBlend();
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
      blendToken++; // A new drag takes over from any cancel tween still running.
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
      setBlend(pos);
    });
    element.addEventListener('pointerup',function(e){
      if(!drag||drag.id!==e.pointerId)return;
      var moved=drag.moved;
      var pos=positionAt(e.clientX);
      clearDrag(e);
      if(!moved)return;
      suppressClick=true;
      var target=VALUES[Math.round(pos)];
      if(target!==value)choose(target);
      else tweenBlendToRest();
    });
    element.addEventListener('pointercancel',function(e){clearDrag(e);tweenBlendToRest();});
    element.addEventListener('lostpointercapture',function(e){clearDrag(e);tweenBlendToRest();});
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
