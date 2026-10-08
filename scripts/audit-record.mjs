import {createClient} from 'genlayer-js';
import {studionet,localnet,testnetBradbury} from 'genlayer-js/chains';
import {TransactionHashVariant} from 'genlayer-js/types';
import {createHash} from 'node:crypto';

const networks={studionet,localnet,testnetBradbury};
const [network='studionet',address,recordId]=process.argv.slice(2);
if(!(network in networks))throw new Error('Choose studionet, localnet, or testnetBradbury.');
if(!/^0x[0-9a-fA-F]{40}$/.test(address||''))throw new Error('Supply a contract address.');
if(!/^\d+:\d+$/.test(recordId||''))throw new Error('Supply a record ID like 2:1.');
const client=createClient({chain:networks[network]});
const raw=await client.readContract({address,functionName:'get_record',args:[recordId],transactionHashVariant:TransactionHashVariant.LATEST_FINAL});
const record=JSON.parse(raw);
const sort=(v)=>Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;
const canonical=JSON.stringify(sort(record.windows));
const recomputed=createHash('sha256').update(canonical,'utf8').digest('hex');
console.log(JSON.stringify({network,address,recordId,hashMatches:recomputed===record.evidence_window_hash,recomputedEvidenceWindowHash:recomputed,record},null,2));
