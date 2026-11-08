'use strict';
const assert=require('node:assert/strict');
// Shared navigation contract; consumed by both Quest UI/map/render suites.
function assertNavigation(d){
 const nav=d.querySelector('footer nav[aria-label="Game navigation"]');
 assert(nav,'game navigation is available in the footer');
 const home=nav.querySelector('a[href="index.html"]');
 assert(home&&home.textContent.trim()==='All games','home link returns to the local chooser');
 assert.equal(d.querySelectorAll('a.footer-home').length,1);
 assert.equal(d.querySelector('.game-nav'),null);
}
module.exports={assertNavigation};
