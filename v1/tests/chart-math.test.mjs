import test from 'node:test';
import assert from 'node:assert/strict';
import { niceStep, niceTicks, priceExtent, xOfIndex, indexOfX, yOfPrice, priceOfY, clampView, zoomAround, timeTicks, nearestIndex, hexA, axisTimeLabel } from '../src/ui/charts/chart-math.js';

test('nice ticks are round numbers inside the range', () => {
  const { ticks, step } = niceTicks(3987.3, 4041.9, 6); assert.equal(step, 10); assert.deepEqual(ticks.slice(0, 2), [3990, 4000]); assert.ok(ticks.every((t) => t >= 3987.3 && t <= 4041.9));
  assert.equal(niceStep(0), 1); assert.equal(niceStep(0.0006, 6), 0.0001);
});
test('price extent pads and includes extra levels', () => {
  const c = [{ h: 10, l: 8 }, { h: 12, l: 9 }]; const e = priceExtent(c, 0, 1); assert.ok(e.lo < 8 && e.hi > 12);
  assert.ok(priceExtent(c, 0, 1, [20]).hi > 20); assert.deepEqual(priceExtent([], 0, 0), { lo: 0, hi: 1 });
});
test('coordinate transforms round-trip', () => {
  for (const i of [0, 5, 40]) assert.equal(indexOfX(xOfIndex(i, 3.2, 7, 10), 3.2, 7, 10), i);
  assert.ok(Math.abs(priceOfY(yOfPrice(101.5, 100, 110, 6, 200), 100, 110, 6, 200) - 101.5) < 1e-9);
});
test('view clamping keeps data reachable and zoom keeps the anchor fixed', () => {
  assert.equal(clampView(1e9, 100, 50, 8), 58); assert.equal(clampView(-1e9, 100, 50, 8), -30);
  const z = zoomAround(20, 8, 300, 0, 1.5); assert.ok(Math.abs((300 / z.barW + z.viewStart) - (300 / 8 + 20)) < 1e-9);
  assert.equal(zoomAround(0, 40, 100, 0, 5).barW, 44);
});
test('time ticks are spaced and labelled', () => {
  const c = Array.from({ length: 200 }, (_, i) => ({ t: 1760000000 + i * 900 })); const t = timeTicks(c, 0, 199, 'M15', 600, 200, 84);
  assert.ok(t.length > 2 && t.length < 12); for (let k = 1; k < t.length; k++) assert.ok(t[k].i > t[k - 1].i);
  assert.match(axisTimeLabel(1760000000, 'M15', null), /^\d\d:\d\d$/); assert.match(axisTimeLabel(1760000000, 'H4', null), /^\d\d-\d\d$/);
});
test('nearestIndex and hexA', () => { assert.equal(nearestIndex([1, 5, 9], 4), 1); assert.equal(nearestIndex([1, 5, 9], 100), 2); assert.equal(hexA('#ff0000', 0.5), 'rgba(255,0,0,0.5)'); });
