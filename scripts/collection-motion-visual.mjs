// Local fixture only; no production data or authentication.
import {chromium} from '/Users/raulculsan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.goto('http://127.0.0.1:5186/#sobres');
 await page.locator('#packPreviewButton').click();
 await page.waitForFunction(()=>document.getElementById('packPreviewDialog').dataset.motionState==='playing');
 await page.screenshot({path:'/private/tmp/bb-pack-opening-playing.png'});
 await page.waitForFunction(()=>document.getElementById('packPreviewDialog').dataset.motionState==='ready');
 await page.screenshot({path:'/private/tmp/bb-pack-opening-ready.png'});
 assert.ok(await page.locator('#packPreviewMotion svg image').count()>=3);
 await page.locator('#packPreviewClose').click();
 await page.locator('.collection-card-tile').first().click();
 await page.waitForSelector('#collectionCardFoil svg');
 const box=await page.locator('#collectionCardTilt').boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
 await page.mouse.move(box.x+box.width*.92,box.y+box.height*.4,{steps:12});
 await page.screenshot({path:'/private/tmp/bb-card-touch.png'});await page.mouse.up();
 assert.equal(await page.locator('#collectionCardFlip').getAttribute('aria-pressed'),'true');
 await page.waitForTimeout(450);await page.screenshot({path:'/private/tmp/bb-card-reverse.png'});
 await page.locator('#collectionCardClose').click();
 assert.equal(await page.locator('#collectionCardFoil svg').count(),0);
 const variants=[];
 for(const [name,effect] of [['LUCA DE TENA','special'],['BOROX','legendary']]) {
  await page.locator('.collection-card-tile').filter({hasText:name}).click();
  await page.waitForSelector('#collectionCardFoil svg');
  const bounds=await page.locator('#collectionCardTilt').boundingBox();
  await page.mouse.move(bounds.x+bounds.width*.5,bounds.y+bounds.height*.5);await page.mouse.down();
  await page.mouse.move(bounds.x+bounds.width*.66,bounds.y+bounds.height*.46,{steps:8});
  await page.screenshot({path:`/private/tmp/bb-card-${effect}-foil.png`});
  const svg=await page.locator('#collectionCardFoil').innerHTML();
  assert.ok(requests.some(url=>url.includes(`card-touch-${effect}.json`)));
  assert.ok(await page.locator('#collectionCardFoil svg path').count()>0);
  variants.push(svg);await page.mouse.up();
  assert.equal(await page.locator('#collectionCardFlip').getAttribute('aria-pressed'),'false');
  await page.locator('#collectionCardFlip').click();
  assert.equal(await page.locator('#collectionCardFlip').getAttribute('aria-pressed'),'true');
  await page.locator('#collectionCardClose').click();
  assert.equal(await page.locator('#collectionCardFoil svg').count(),0);
 }
 assert.notEqual(variants[0],variants[1]);
 console.log(JSON.stringify({errors,cardGesture:'passed',pack:'completed',viewport:'390x844'}));
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
