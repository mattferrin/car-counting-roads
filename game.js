/* Car Counting Roads: the connected-road starter, refined for touch. */
(function (root) {
  'use strict';
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
        car.textContent = '🚗';
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
    const plural = n === 1 ? 'car' : 'cars';
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
    $('feedback').textContent = `${n} ${plural} ${kind === 'exit' ? 'leaving' : 'on the road'}…`;
    const path = route.querySelector('.road');
    const length = path.getTotalLength();
    const token = ++generation;
    const cars = Array.from({ length: n }, () => {
      const car = document.createElementNS(NS, 'text');
      car.textContent = '🚗';
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
    $('feedback').textContent = 'Back to 5 Blue + 5 Gold = 10. Choose a road!';
    render();
  });
  render();
})(typeof window === 'undefined' ? globalThis : window);

