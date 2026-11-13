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

const speechClear = (p,r) => p.x + p.width <= r.left || p.x >= r.right || p.y + p.height <= r.top || p.y >= r.bottom;
test('viewport overlays use the nearest free edge or corner around the visible chrome', () => {
  const view = { x: 12, y: 28, w: 420, h: 650 }, size = { w: 112, h: 112 };
  const header = { left: 12, right: 432, top: 0, bottom: 88 };
  const toolbar = { left: 110, right: 425, top: 96, bottom: 168 };
  const dock = { left: 60, right: 410, top: 606, bottom: 666 };
  const chrome = [header, toolbar, dock];
  const clipped = E.freePosition({ x: 84, y: 80 }, size, view, chrome);
  assert.equal(clipped.x, 84);
  assert.equal(clipped.y, 178);
  const preferred = { x: 73, y: 310 };
  assert.equal(E.freePosition(preferred, size, view, chrome).y, preferred.y);
  const aboveDock = E.freePosition({ x: 230, y: 570 }, size, view, chrome);
  assert.equal(aboveDock.y, dock.top - size.h - 10);
  assert.equal(E.freePosition(preferred, size, view, [
    { left: 0, right: 480, top: 0, bottom: 700 },
  ]), null);
});
test('speech cards avoid toolbar overlap and remain in the visible viewport at every edge',()=>{
 const view={x:0,y:0,w:570,h:700},bar={left:0,right:557,top:82,bottom:140},header={left:0,right:570,top:0,bottom:70};
 for(const anchor of [{left:230,right:374,top:150,bottom:294},{left:12,right:156,top:12,bottom:156},{left:414,right:558,top:544,bottom:688},{left:12,right:124,top:540,bottom:652}]){
  const spot=E.speechSpot(anchor,{w:240,h:88},view,[header,bar]);assert.ok(spot);assert.ok(speechClear(spot,bar));assert.ok(speechClear(spot,header));assert.ok(speechClear(spot,anchor));assert.ok(spot.x>=12&&spot.x+spot.width<=558);assert.ok(spot.y>=12&&spot.y+spot.height<=688);
 }
 const greeting=E.speechSpot({left:230,right:374,top:150,bottom:294},{w:240,h:88},view,[header,bar]);assert.ok(greeting.y>=304,'The greeting moves below Momo when the toolbar occupies the space above him.');
});
test('speech cards resize long messages and account for a keyboard-shifted visual viewport',()=>{
 const view={x:15,y:40,w:375,h:260},anchor={left:200,right:312,top:70,bottom:182},header={left:0,right:500,top:0,bottom:64};
 const spot=E.speechSpot(anchor,{w:240,h:240},view,[header]);assert.ok(spot);assert.ok(spot.height<240);assert.ok(speechClear(spot,anchor));assert.ok(speechClear(spot,header));assert.ok(spot.x>=27&&spot.x+spot.width<=378);assert.ok(spot.y>=52&&spot.y+spot.height<=288);
 assert.equal(E.speechSpot(anchor,{w:240,h:100},view,[{left:0,right:500,top:0,bottom:500}]),null);
});

test('speech cards use diagonal free space beside desktop navigation before shortening a message',()=>{
 const view={x:0,y:0,w:1100,h:750},anchor={left:230,right:374,top:150,bottom:294},chrome=[{left:0,right:1100,top:0,bottom:62},{left:0,right:220,top:80,bottom:750},{left:240,right:1088,top:83,bottom:223}];const spot=E.speechSpot(anchor,{w:240,h:70},view,chrome);assert.ok(spot);assert.equal(spot.height,70);assert.ok(chrome.every(r=>speechClear(spot,r)));assert.ok(speechClear(spot,anchor));
});
