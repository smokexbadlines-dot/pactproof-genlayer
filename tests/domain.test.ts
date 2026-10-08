import {describe,it,expect} from 'vitest';
import {derive,parseGen,validateEvidence,validateTerms,canonical,DEMO_BUILDER} from '../src/domain';
import type {Criterion,Row,Terms} from '../src/types';
const criteria:Criterion[]=[{id:'a',text:'Publish a complete source implementation.',weight_bps:6500,evidence_type:'SOURCE_CODE'},{id:'b',text:'Publish a complete installation guide.',weight_bps:3500,evidence_type:'DOCUMENTATION'}];
const rows=(a:Row['status'],b:Row['status']):Row[]=>[{id:'a',status:a,reason:'r',citations:[]},{id:'b',status:b,reason:'r',citations:[]}];
describe('payment and input boundaries',()=>{
 it('parses native currency without floating point loss',()=>{expect(parseGen('1.000000000000000001')).toBe(1000000000000000001n);expect(()=>parseGen('1e3')).toThrow();expect(()=>parseGen('0')).toThrow();expect(()=>parseGen('0.0000000000000000001')).toThrow();});
 it('holds all funds when any criterion is inconclusive',()=>{expect(derive(criteria,rows('MET','INCONCLUSIVE'))).toEqual({outcome:'INCONCLUSIVE',earned_bps:0});});
 it('derives weighted partial payment deterministically',()=>{expect(derive(criteria,rows('MET','NOT_MET'))).toEqual({outcome:'PARTIALLY_MET',earned_bps:6500});expect(101n*6500n/10000n).toBe(65n);});
 it('rejects swapped or missing results',()=>{expect(()=>derive(criteria,rows('MET','MET').reverse())).toThrow();expect(()=>derive(criteria,[])).toThrow();});
 it('requires exact payment weights',()=>{const t:Terms={title:'A grant',description:'A useful developer deliverable.',builder:DEMO_BUILDER,deadline:Math.floor(Date.now()/1000)+86400,criteria};expect(()=>validateTerms(t)).not.toThrow();expect(()=>validateTerms({...t,criteria:[{...criteria[0],weight_bps:9999}]})).toThrow();});
 it('rejects private hosts and evidence type mismatches',()=>{const e=[{id:'e1',url:'https://raw.githubusercontent.com/a/b/commit/file',sha256:'a'.repeat(64),type:'SOURCE_CODE' as const,criterion_ids:['a']}];expect(()=>validateEvidence(e,criteria.slice(0,1))).not.toThrow();expect(()=>validateEvidence([{...e[0],url:'https://127.0.0.1/file'}],criteria.slice(0,1))).toThrow();expect(()=>validateEvidence(e,criteria)).toThrow();expect(()=>validateEvidence([{...e[0],url:'https://raw.githubusercontent.com@localhost/file'}],criteria.slice(0,1))).toThrow();});
 it('canonicalizes key order without altering array order',()=>{expect(canonical({b:[2,1],a:1})).toBe('{"a":1,"b":[2,1]}');});
});
