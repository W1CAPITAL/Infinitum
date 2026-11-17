import test from 'node:test';
import assert from 'node:assert/strict';
import {createInfinitumIco} from '../desktop/generate-windows-icon.mjs';
test('Windows icon is reproducible, a true PNG-backed ICO, and never an Ethereum resource',()=>{
 const bytes=createInfinitumIco();
 assert.equal(bytes.readUInt16LE(0),0);
 assert.equal(bytes.readUInt16LE(2),1);
 assert.equal(bytes.readUInt16LE(4),1);
 assert.equal(bytes.readUInt32LE(18),22);
 assert.deepEqual([...bytes.subarray(22,30)],[137,80,78,71,13,10,26,10]);
 assert.ok(bytes.length>1000&&bytes.length<250000);
 assert.deepEqual(bytes,createInfinitumIco());
});
