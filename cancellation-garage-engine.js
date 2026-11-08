/* Each garage has its own capacity. Every a,b in 0..max is reachable. */
(function(root){
  'use strict';
  function capacity(raw){return /^(20|50|100)$/.test(String(raw))?Number(raw):20;}
  function valid(s){return s&&[20,50,100].includes(s.max)&&Number.isInteger(s.blue)&&Number.isInteger(s.gold)&&s.blue>=0&&s.gold>=0&&s.blue<=s.max&&s.gold<=s.max;}
  function canMove(s,kind,n){
    if(!valid(s)||![1,10].includes(n))return false;
    if(kind==='entry')return s.blue+n<=s.max;
    if(kind==='exit')return s.gold>=n;
    if(kind==='up')return s.gold>=n&&s.blue+n<=s.max;
    if(kind==='down')return s.blue>=n&&s.gold+n<=s.max;
    return false;
  }
  function move(s,kind,n){if(!canMove(s,kind,n))return s;return {...s,blue:s.blue+(kind==='entry'||kind==='up'?n:kind==='down'?-n:0),gold:s.gold+(kind==='down'?n:kind==='exit'||kind==='up'?-n:0)};}
  function geometry(s){
    const matched=Math.min(s.blue,s.gold),rows=n=>Math.ceil(n/10),m=rows(matched);
    // Leave room for entry/exit bends and two clearly separated transfer loops.
    const half=count=>Math.max(230,58+22*(m+rows(count-matched))+(matched&&count>matched?24:0));
    const top=2,blueHeight=half(s.blue),goldHeight=half(s.gold),center=top+blueHeight,bottom=center+goldHeight;
    return {top,blueHeight,goldHeight,center,bottom,height:bottom+2};
  }
  function position(s,side,index,g=geometry(s)){
    const matched=Math.min(s.blue,s.gold),paired=index<matched;
    const slot=paired?index:index-matched,col=slot%10,row=Math.floor(slot/10),x=136+col*22+(col>=5?8:0);
    const y=paired?g.center+(side==='blue'?-1:1)*(17+row*22):side==='blue'?g.top+60+row*22:g.bottom-60-row*22;
    return {x,y,paired};
  }
  const api={capacity,valid,canMove,move,geometry,position};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.CancellationGarage=api;
})(typeof window==='undefined'?globalThis:window);
