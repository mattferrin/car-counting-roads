/* Car Counting Roads: the connected-road starter, refined for touch. */
(function (root) {
  'use strict';
  const params = new URLSearchParams(root.location?.search);
  const mermaids = params.get('theme') === 'mermaids';
  const theme = mermaids ? {icon:'🧜‍♀️', single:'mermaid', plural:'mermaids', route:'tunnel', home:'pool'} : {icon:'🚗', single:'car', plural:'cars', route:'road', home:'garage'};
  const rawMax = new URLSearchParams(root.location?.search).get('max');
  const requested = Number(rawMax);
  const LIMIT = /^\d+$/.test(rawMax) && requested >= 10 && requested <= 100 ? requested : 20;
  const initial = () => ({ blue: 5, gold: 5 });
  function canMove(state, kind, n) {
    if (![1, 5, 10].includes(n)) return false;
    if (kind === 'entry') return state.blue + state.gold + n <= LIMIT;
    if (kind === 'top') return state.blue >= n;
    if (kind === 'bottom' || kind === 'exit') return state.gold >= n;
    return false;
  }
  function move(state, kind, n) {
    if (!canMove(state, kind, n)) return state;
    return {
      blue: state.blue + (kind === 'entry' || kind === 'bottom' ? n : kind === 'top' ? -n : 0),
      gold: state.gold + (kind === 'top' ? n : kind === 'bottom' || kind === 'exit' ? -n : 0),
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { LIMIT, initial, canMove, move };
  if (!root.document) return;
  const $ = id => document.getElementById(id);
  if (!params.has('theme') && !params.has('max')) {
    $('home').hidden = false;
    $('game').hidden = true;
    document.title = 'Ayan & Aliya’s Counting Worlds';
    return;
  }
  document.body.classList.toggle('underwater', mermaids);
  document.querySelector('h1:not(#home h1)').textContent = mermaids ? 'Aliya’s Mermaid Game' : 'Ayan’s Car Game';
  document.title = mermaids ? 'Aliya’s Mermaid Game' : 'Ayan’s Car Game';
  $('mode-label').textContent = `Count up to ${LIMIT}`;
  document.querySelector('#game .eyebrow').textContent = mermaids ? 'A little swim. A little math.' : 'A little drive. A little math.';
  if (mermaids) {
    // Translate presentation only; state, routes, and arithmetic stay shared.
    const translate = text => text.replaceAll('🚗', theme.icon).replace(/cars/g, 'mermaids').replace(/Cars/g, 'Mermaids').replace(/car\b/g, 'mermaid').replace(/roads/g, 'tunnels').replace(/ROADS/g, 'TUNNELS').replace(/road/g, 'tunnel').replace(/garages/g, 'pools').replace(/garage/g, 'pool');
    const walker = document.createTreeWalker($('game'), 4);
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => node.textContent = translate(node.textContent));
    $('game').querySelectorAll('[aria-label]').forEach(node => node.setAttribute('aria-label', translate(node.getAttribute('aria-label'))));
    for (const name of ['blue','gold']) $(name + '-building').setAttribute('rx', '24');
    $('map').insertAdjacentHTML('afterbegin', `<defs><linearGradient id="ocean" x2="0" y2="1"><stop stop-color="#c8f5f5"/><stop offset="1" stop-color="#5dbbd4"/></linearGradient><pattern id="bubbles" width="70" height="90" patternUnits="userSpaceOnUse"><circle cx="22" cy="30" r="6" fill="none" stroke="#fff" opacity=".45"/><circle cx="48" cy="66" r="3" fill="#fff" opacity=".4"/><path d="M0 85 Q18 72 35 85 T70 85" fill="none" stroke="#fff" opacity=".22"/></pattern></defs><rect width="420" height="1200" fill="url(#ocean)"/><rect width="420" height="1200" fill="url(#bubbles)"/><g fill="none" stroke="#268d80" stroke-width="5" stroke-linecap="round" opacity=".55"><path d="M25 235 Q5 212 24 190 M25 235 Q45 211 30 205 M395 235 Q375 210 392 186 M395 235 Q410 215 405 205"/></g>`);
  }
  const NS = 'http://www.w3.org/2000/svg';
  const routes = Array.from(document.querySelectorAll('.route'));
  let state = initial(), busy = false, animation = 0, generation = 0;
  let extraHeight = 0;
  $('capacity').textContent = LIMIT;
  function render() {
    const rows = Math.ceil(Math.max(state.blue, state.gold) / 5);
    extraHeight = Math.max(0, rows - 4) * 23;
    for (const name of ['blue', 'gold']) $(name + '-building').setAttribute('height', 174 + extraHeight);
    $('map').setAttribute('viewBox', '0 0 420 ' + (622 + extraHeight));
    for (const road of routes.filter(r => r.dataset.kind === 'bottom').concat($('lower-title'))) {
      road.setAttribute('transform', 'translate(0 ' + extraHeight + ')');
    }
    for (const [name, x] of [['blue', 102], ['gold', 244]]) {
      $(name + '-num').textContent = state[name];
      $(name + '-cars').replaceChildren();
      $(name + '-empty').style.display = state[name] === 0 ? 'block' : 'none';
      $(name + '-empty').removeAttribute('hidden');
      for (let slot = 0; slot < state[name]; slot++) {
        const car = document.createElementNS(NS, 'text');
        car.setAttribute('x', x + (slot % 5) * 18.5);
        car.setAttribute('y', 327 + Math.floor(slot / 5) * 23);
        car.setAttribute('class', 'garage-car');
        car.textContent = theme.icon;
        $(name + '-cars').appendChild(car);
      }
    }
    $('left').textContent = state.blue;
    $('right').textContent = state.gold;
    $('total').textContent = state.blue + state.gold;
    for (const r of routes) {
      r.setAttribute('aria-disabled', String(busy || !canMove(state, r.dataset.kind, Number(r.dataset.amount))));
    }
    $('map').setAttribute('aria-busy', String(busy));
  }
  function drive(route) {
    const kind = route.dataset.kind, n = Number(route.dataset.amount);
    if (busy || !canMove(state, kind, n)) return;
    const next = move(state, kind, n);
    const sameTotal = kind === 'top' || kind === 'bottom';
    const plural = n === 1 ? theme.single : theme.plural;
    const message = sameTotal
      ? `${n} ${plural} moved to ${kind === 'top' ? 'Gold' : 'Blue'}. Still ${next.blue + next.gold} altogether!`
      : `${n} ${plural} ${kind === 'entry' ? 'came in' : 'went out'}. Now ${next.blue + next.gold} altogether!`;
    const finish = () => {
      state = next;
      busy = false;
      $('traffic').replaceChildren();
      $('feedback').textContent = message;
      render();
    };
    if (root.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
    busy = true;
    render();
    $('feedback').textContent = `${n} ${plural} ${kind === 'exit' ? 'leaving' : `on the ${theme.route}`}…`;
    const path = route.querySelector('.road');
    const length = path.getTotalLength();
    const token = ++generation;
    const cars = Array.from({ length: n }, () => {
      const car = document.createElementNS(NS, 'text');
      car.textContent = theme.icon;
      car.setAttribute('class', 'moving-car');
      $('traffic').appendChild(car);
      return car;
    });
    const started = performance.now();
    const duration = 750, stagger = n > 1 ? 65 : 0;
    function frame(now) {
      if (token !== generation) return;
      cars.forEach((car, i) => {
        const progress = (now - started - i * stagger) / duration;
        car.style.visibility = progress < 0 || progress > 1 ? 'hidden' : 'visible';
        const p = path.getPointAtLength(Math.max(0, Math.min(1, progress)) * length);
        car.setAttribute('x', p.x);
        car.setAttribute('y', p.y + (kind === 'bottom' ? extraHeight : 0));
      });
      if (now - started >= duration + (n - 1) * stagger) finish();
      else animation = requestAnimationFrame(frame);
    }
    animation = requestAnimationFrame(frame);
  }
  for (const route of routes) {
    route.addEventListener('click', () => drive(route));
    route.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); drive(route); }
    });
  }
  $('reset').addEventListener('click', () => {
    ++generation;
    cancelAnimationFrame(animation);
    busy = false;
    state = initial();
    $('traffic').replaceChildren();
    $('feedback').textContent = `Back to 5 Blue + 5 Gold = 10. Choose a ${theme.route}!`;
    render();
  });
  render();
})(typeof window === 'undefined' ? globalThis : window);
