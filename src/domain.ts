import type { Criterion, Evidence, Row, Terms } from './types';
export const HOSTS=['raw.githubusercontent.com','arweave.net','ipfs.io'];
export const DEMO_BUILDER='0x2222222222222222222222222222222222222222';
export const DEMO_CREATOR='0x1111111111111111111111111111111111111111';
export function parseGen(value:string):bigint {
  if(!/^\d+(\.\d{1,18})?$/.test(value)) throw new Error('Enter a GEN amount with at most 18 decimal places.');
  const [whole, fraction='']=value.split('.');
  const wei=BigInt(whole)*10n**18n+BigInt(fraction.padEnd(18,'0'));
  if(wei<=0n) throw new Error('Reward must be greater than zero.');
  if(wei>=2n**256n) throw new Error('Reward exceeds the supported amount.');
  return wei;
}
export function formatGen(value:string):string {
  const amount=BigInt(value); const whole=amount/10n**18n;
  const fraction=(amount%10n**18n).toString().padStart(18,'0').slice(0,6).replace(/0+$/,'');
  return whole.toLocaleString('en-US')+(fraction?'.'+fraction:'');
}
export const short=(s:string)=>s.length>18?s.slice(0,8)+'…'+s.slice(-6):s;
export function derive(criteria:Criterion[],rows:Row[]) {
  if(rows.length!==criteria.length||rows.some((r,i)=>r.id!==criteria[i].id||!['MET','NOT_MET','INCONCLUSIVE'].includes(r.status))) throw new Error('Invalid criterion results.');
  if(rows.some(r=>r.status==='INCONCLUSIVE')) return {outcome:'INCONCLUSIVE' as const,earned_bps:0};
  const earned_bps=criteria.reduce((sum,c,i)=>sum+(rows[i].status==='MET'?c.weight_bps:0),0);
  return {outcome:earned_bps===10000?'MET' as const:earned_bps===0?'NOT_MET' as const:'PARTIALLY_MET' as const,earned_bps};
}
export function validateTerms(t:Terms) {
  if(t.title.trim().length<3||t.title.length>120) throw new Error('Title must contain 3–120 characters.');
  if(t.description.length<10||t.description.length>2000) throw new Error('Describe the deliverable in 10–2,000 characters.');
  if(!/^0x[0-9a-fA-F]{40}$/.test(t.builder)||/^0x0{40}$/.test(t.builder)) throw new Error('Enter a valid builder wallet address.');
  const now=Math.floor(Date.now()/1000);
  if(!Number.isInteger(t.deadline)||t.deadline<=now||t.deadline>now+366*86400) throw new Error('Choose a deadline within the next year.');
  if(t.criteria.length<1||t.criteria.length>8) throw new Error('Use 1–8 criteria.');
  if(new Set(t.criteria.map(c=>c.id)).size!==t.criteria.length) throw new Error('Criterion IDs must be unique.');
  if(t.criteria.some(c=>c.text.length<10||c.text.length>1200||!Number.isInteger(c.weight_bps)||c.weight_bps<=0||!['SOURCE_CODE','DOCUMENTATION','TEST_REPORT'].includes(c.evidence_type))) throw new Error('Each criterion needs text, an evidence type, and a positive weight.');
  if(t.criteria.reduce((s,c)=>s+c.weight_bps,0)!==10000) throw new Error('Criterion weights must total exactly 100%.');
}
export function validateEvidence(items:Evidence[],criteria:Criterion[]) {
  if(items.length<1||items.length>6) throw new Error('Submit 1–6 evidence files.');
  if(new Set(items.map(e=>e.id)).size!==items.length) throw new Error('Evidence IDs must be unique.');
  for(const e of items) {
    const url=new URL(e.url);
    if(url.protocol!=='https:'||!HOSTS.includes(url.hostname)||url.username||url.password||url.hash||(url.port&&url.port!=='443')) throw new Error('Use a public HTTPS file on raw.githubusercontent.com, arweave.net, or ipfs.io.');
    if(!/^[a-f0-9]{64}$/.test(e.sha256)) throw new Error('Every file requires a lowercase SHA-256 hash.');
    if(!e.criterion_ids.length||new Set(e.criterion_ids).size!==e.criterion_ids.length||e.criterion_ids.some(id=>!criteria.some(c=>c.id===id))) throw new Error('Assign evidence to valid criteria.');
  }
  if(criteria.some(c=>!items.some(e=>e.type===c.evidence_type&&e.criterion_ids.includes(c.id)))) throw new Error('Each criterion needs evidence of its registered type.');
}
export function canonical(value:unknown):string {
  if(Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object') return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';
  return JSON.stringify(value);
}
export async function sha256Bytes(bytes:Uint8Array):Promise<string> {
  const copy=new Uint8Array(bytes); const hash=await crypto.subtle.digest('SHA-256',copy);
  return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export const hashObject=(value:unknown)=>sha256Bytes(new TextEncoder().encode(canonical(value)));
