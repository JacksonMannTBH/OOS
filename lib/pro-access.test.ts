import assert from 'node:assert/strict';
import { test } from 'node:test';

test('Pro access fails closed and never gates stop, finish, or saved rides', async () => {
  Object.defineProperty(globalThis, 'CapacitorCustomPlatform', { configurable:true, value:{ name:'ios' } });
  const events: string[] = [];
  const storage = new Map<string,string>();
  Object.defineProperty(globalThis, 'window', { configurable:true, value:{
    dispatchEvent: (event:Event) => { events.push(event.type); return true; },
    localStorage: { getItem:(key:string)=>storage.get(key)??null, setItem:(key:string,value:string)=>storage.set(key,value), removeItem:(key:string)=>storage.delete(key) },
  } });
  const { registerPlugin } = await import('@capacitor/core');
  const nativeCalls:string[] = [];
  let pro = false;
  let elite = false;
  let fails = false;
  let outcome:'cancelled'|'pending'|undefined;
  const status = () => ({ ready:true, pro, elite, development:true, testingPlan:'store', displayPrice:'$4.00', productAvailable:true, expiresAt:null });
  registerPlugin('OOSPro',{ios:{
    status:async()=> { if (fails) throw new Error('Unavailable'); return status(); },
    purchase:async()=> ({...status(),outcome}),
    restore:async()=>status(),
    setTestingPlan:async({plan}:{plan:string})=> { pro=plan==='pro'||plan==='elite'; elite=plan==='elite'; return status(); },
  }});
  registerPlugin('Preferences',{ios:{ get:async({key}:{key:string})=>({value:storage.get(key)??null}), set:async({key,value}:{key:string,value:string})=>{storage.set(key,value);}, remove:async({key}:{key:string})=>{storage.delete(key);} }});
  registerPlugin('OOSRideRecorder',{ios:{
    status:async()=>({supported:true,active:null,rides:[{id:'saved'}]}),
    start:async()=> { nativeCalls.push('startRide'); return {active:null}; },
    finish:async()=> { nativeCalls.push('finishRide'); return {ride:{id:'saved'}}; },
  }});
  registerPlugin('OOSLiveTracking',{ios:{
    start:async()=> {nativeCalls.push('startLive');return {};},
    stop:async()=> {nativeCalls.push('stopLive');},
  }});
  const access = await import('./pro-access');
  const { initializeDevicePreferences } = await import('./device-preferences');
  await initializeDevicePreferences();
  const rides = await import('./ride-recording');
  const live = await import('./live-tracking');
  assert.equal(access.proSnapshot().enabled,true);
  assert.equal(access.proSnapshot().pro,false);
  assert.equal(await access.requirePro('ride'),false);
  assert.equal(await access.requirePro('nationwide'),false);
  assert(events.includes('oos:pro-requested'));
  await assert.rejects(rides.startRideRecording(),/OOS Pro/);
  await assert.rejects(live.startLiveTracking(),/OOS Pro/);
  assert.equal(nativeCalls.length,0);
  await rides.finishRideRecording('saved');
  await live.stopLiveTracking();
  assert.equal((await rides.getRideRecorderStatus()).rides[0]?.id,'saved');
  assert.deepEqual(nativeCalls,['finishRide','stopLive']);
  await access.setProTestingPlan('pro');
  assert.equal(await access.requirePro('paths'),true);
  assert.equal(await access.requirePro('nationwide'),true);
  assert.equal(await access.requirePro('elite'),false);
  await rides.startRideRecording();
  assert(nativeCalls.includes('startRide'));
  const beforeElite = events.filter(event => event === 'oos:pro-tier-changed').length;
  await access.setProTestingPlan('elite');
  assert.equal(access.proSnapshot().elite,true);
  assert.equal(await access.requirePro("elite"),true);
  assert.equal(await access.requirePro('notifications'),true);
  assert.equal(await access.requirePro('nationwide'),true);
  assert(events.filter(event => event === 'oos:pro-tier-changed').length > beforeElite);
  await access.setProTestingPlan('pro');
  assert.equal(access.proSnapshot().elite,false);
  assert.equal(access.proSnapshot().pro,true);
  await access.setProTestingPlan('free');
  assert.equal(await access.requirePro('notifications'),false);
  assert(events.includes('oos:pro-tier-changed'));
  for (const pending of ['cancelled','pending'] as const) {
    outcome = pending;
    assert.equal(await access.purchasePro(),pending);
    assert.equal(access.proSnapshot().pro,false);
  }
  pro = true;
  await access.restorePro();
  assert.equal(access.proSnapshot().pro,true);
  fails = true;
  await assert.rejects(rides.startRideRecording(),/Unavailable/);
  // Stop and finish remain callable even if entitlement verification fails.
  await live.stopLiveTracking();
  await rides.finishRideRecording('saved');
});
