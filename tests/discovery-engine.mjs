import assert from 'node:assert/strict';
import{catalog}from'../public/mood/catalog.js';import{rank,cluster,movieKey,importRatings}from'../public/mood/engine.js';
const ratings=importRatings('Date,Name,Year,Rating\n2026-01-01,"The Thing",1982,4.5\n2026-02-01,"The Thing",1982,5\n2026-02-02,"Synecdoche, New York",2008,5');
assert.equal(ratings.length,2);assert.equal(ratings[0].rating,5);
const dream=rank(catalog,{query:'Dreamlike cities',blend:0});assert(['Mulholland Drive','Inland Empire','Inception','PlayTime'].includes(dream[0].title));
assert(!rank(catalog,{ratings}).some(m=>m.title==='The Thing'));
assert(rank(catalog,{query:'isolated but no horror'}).every(m=>m.genre!=='Horror'));
const clusters=cluster(catalog,{},6);const keys=clusters.flatMap(c=>c.members.map(movieKey));assert.equal(keys.length,catalog.length);assert.equal(new Set(keys).size,catalog.length);assert(clusters.every(c=>Number.isFinite(c.cohesion)));
console.log('Discovery regression checks passed.');
