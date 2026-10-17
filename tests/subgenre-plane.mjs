import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {learnSubgenres,projectSubgenres,qualitativeText,qualitativeAxes} from '../public/mood/subgenres.js';
import {creditMetadata,peopleGraph,graphLayout} from '../public/mood/analytics.js';
const {UMAP}=createRequire(import.meta.url)('../public/mood/vendor/umap-js-1.4.0.min.js');
const movies=[],embeddings={},axes=Object.fromEntries(qualitativeAxes.map(([id],i)=>[id,Array.from({length:384},(_,j)=>j===i?1:0)]));
for(let group=0;group<3;group++)for(let i=0;i<8;i++){const id=group*8+i+1;movies.push({id,title:'Fixture '+id,overview:'Meaningful test description',keywords:[['urban isolation','ritual','family'][group]],genre:'Drama'});embeddings[id]=Array.from({length:384},(_,j)=>j===group?1:j===i+40?.025:0);}
movies.push({id:25,title:'Between worlds',overview:'Bridge'});embeddings[25]=Array.from({length:384},(_,j)=>j===0||j===1?.707:0);
movies.push({id:26,title:'Different world',overview:'Unrelated film'});embeddings[26]=Array.from({length:384},(_,j)=>j===100?1:0);
const profile=learnSubgenres(movies,embeddings,axes);
assert.equal(profile.version,3);assert.ok(profile.clusters.length>=3);
const assigned=profile.clusters.flatMap(c=>c.memberIds);assert.equal(new Set(assigned).size,assigned.length);
assert.equal(profile.memberships.length,movies.length);assert.equal(profile.memberships.find(m=>m.id===26).primaryClusterId,null);
assert.equal(profile.memberships.find(m=>m.id===25).status,'bridge');
for(const m of profile.memberships){if(m.affinities.length)assert.ok(Math.abs(m.affinities.reduce((s,a)=>s+a.weight,0)-1)<1e-8);assert.ok(m.affinities.length<=3);}
const projected=await projectSubgenres(profile,movies,embeddings,UMAP);
assert.equal(projected.projection.length,movies.length);assert.ok(projected.projection.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1));
assert.ok(projected.projection.find(p=>p.id===26),'Unassigned films must remain visible on the plane');
const repeated=await projectSubgenres(learnSubgenres(movies,embeddings,axes),movies,embeddings,UMAP);assert.deepEqual(repeated.projection,projected.projection,'Stable seeded UMAP');
assert.ok(qualitativeText(movies[0]).includes('urban isolation'));
const meta=creditMetadata({credits:{cast:[{id:1,name:'Actor'}],crew:[{id:2,name:'Director Writer',job:'Director'},{id:2,name:'Director Writer',job:'Screenplay'}]},genres:[{name:'Drama'}],keywords:{keywords:[{name:'isolation'}]}});
const film={id:1,title:'One',year:2000,overview:'isolation',genre:'Drama',...meta};const graph=peopleGraph([film],[{id:1,title:'One',year:2000,rating:4}],{roles:['Actor','Director','Writer'],showMovies:true,minFilms:1});
for(const mode of ['network','timeline','emotion'])assert.ok(graphLayout(graph,mode).nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)));
console.log('PASS: distinct semantic communities, bridge affinity, unassigned visibility, normalized soft membership, deterministic UMAP, people layouts');
