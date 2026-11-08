/* Play control policy. Consumers supply mathematical validity; busy moves
 * retain the last settled visibility until animation/narration finishes. */
(function(root){
  'use strict';
  const visibility=new WeakMap();
  function update(control,valid,busy,visuals,hits){
    if(!busy||!visibility.has(control))visibility.set(control,valid);
    const shown=visibility.get(control),enabled=shown&&!busy;
    control.setAttribute('aria-disabled',String(!enabled));
    control.setAttribute('aria-hidden',String(!shown));
    control.setAttribute('tabindex',enabled?'0':'-1');
    control.style.pointerEvents=enabled?'':'none';
    visuals.forEach(node=>{node.style.display=shown?'':'none';});
    hits.forEach(node=>{node.style.display=shown?'':'none';node.style.pointerEvents=enabled?'':'none';});
  }
  root.PlayControls={update};
})(typeof window==='undefined'?globalThis:window);
