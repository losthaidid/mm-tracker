import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
const window = {};
runInNewContext(readFileSync(new URL('../momo-behaviour-engine.js', import.meta.url), 'utf8'), { window });
const E = window.WorkHubMomoBehaviourEngine;

test('soccer physics stays at foot contact on kick boundaries, counts exactly and recovers awkward flights', () => {
  for (const count of [1, 2, 5, 50]) {
    for (let kick = 0; kick < count; kick++) {
      const start = E.soccer(kick * 650, count), middle = E.soccer(kick * 650 + 325, count);
      assert.equal(start.kicks, kick); assert.equal(start.hop, 0); assert.equal(start.contact, true);
      assert.ok(middle.hop < -50); assert.equal(middle.kicks, kick);
      assert.equal(middle.contact, false); assert.ok(Math.abs(start.sway) <= 13);
      assert.equal(start.side, kick % 2 ? 'right' : 'left');
    }
    const end = E.soccer(count * 650, count), later = E.soccer(999999, count);
    assert.equal(end.kicks, count); assert.equal(end.hop, 0); assert.equal(end.contact, false);
    assert.equal(later.kicks, count); assert.equal(later.hop, 0);
  }
  assert.equal(E.soccer(4 * 650 + 50, 6).awkward, true);
  assert.equal(E.soccer(5 * 650 + 50, 6).awkward, false);
});

test('chase and tug phases include noticing, recovery and elastic release with bounded motion', () => {
  assert.equal(E.chase(100).stage, 'notice'); assert.equal(E.chase(1200).stage, 'approach');
  assert.equal(E.chase(5000).stage, 'chase'); assert.equal(E.chase(10000).stage, 'recover');
  assert.equal(E.tug(100).stage, 'check'); assert.equal(E.tug(2000).stage, 'tug');
  assert.equal(E.tug(4500).stage, 'release'); assert.equal(E.tug(6000).stretch, 0);
  const points = [{x:12,y:12},{x:300,y:400},{x:50,y:30}];
  for(let i=0;i<=100;i++) { const p=E.path(points,i/100); assert.ok(p.x>=12&&p.x<=300);assert.ok(p.y>=12&&p.y<=400); }
});

test('work-area resting places fit a phone viewport and avoid the controls being used', () => {
  const view={x:15,y:20,w:375,h:600},size=112,control={left:210,top:250,right:380,bottom:450};
  const target=E.clearSpot({x:220,y:260},size,view,[control]);
  assert.ok(target);assert.equal(E.overlaps(target,size,control),false);
  assert.ok(target.x>=27&&target.x+size<=378);assert.ok(target.y>=32&&target.y+size<=608);
  assert.equal(E.clearSpot({x:20,y:20},size,view,[{left:0,top:0,right:999,bottom:999}]),null);
  assert.equal(Object.keys(E.FRIENDS).length,17);
  assert.equal(E.FRIENDS.rabbit.role,'rival');assert.equal(E.FRIENDS.squirrel.role,'gift');assert.equal(E.FRIENDS.cat.role,'seat');
});
