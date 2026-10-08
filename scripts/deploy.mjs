import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createClient,createAccount} from 'genlayer-js';
import {localnet,studionet,testnetBradbury} from 'genlayer-js/chains';
import {TransactionStatus} from 'genlayer-js/types';
const networks={localnet,studionet,testnetBradbury};
const network=process.env.GENLAYER_NETWORK||'studionet';
if(!networks[network])throw new Error('Unsupported network.');
const secret=process.env.GENLAYER_PRIVATE_KEY;
if(!/^0x[0-9a-fA-F]{64}$/.test(secret||''))throw new Error('Set GENLAYER_PRIVATE_KEY in .env to a funded development wallet.');
const client=createClient({chain:networks[network],account:createAccount(secret)});
const manifestPath=new URL('../deployment.json',import.meta.url);
let manifest=existsSync(manifestPath)?JSON.parse(readFileSync(manifestPath,'utf8')):null;
if(manifest?.network!==network&&manifest)throw new Error('Existing deployment belongs to another network. Preserve it before starting another deployment.');
if(!manifest){
  const code=new Uint8Array(readFileSync(new URL('../contracts/pactproof.py',import.meta.url)));
  if(network==='testnetBradbury')throw new Error('First profile deployment and message-producing paths in Studio; this script intentionally has no invented testnet fee preset.');
  const hash=await client.deployContract({code,args:[]});
  manifest={network,hash,submittedAt:new Date().toISOString()};
  writeFileSync(manifestPath,JSON.stringify(manifest,null,2));
  console.log('Deployment submitted:',hash);
}else console.log('Resuming recorded deployment:',manifest.hash);
await client.waitForTransactionReceipt({hash:manifest.hash,status:TransactionStatus.FINALIZED,interval:3000,retries:100});
const [transaction,evmReceipt]=await Promise.all([client.getTransaction({hash:manifest.hash}),client.getTransactionReceipt({hash:manifest.hash})]);
if(transaction.statusName!==TransactionStatus.FINALIZED||Number(transaction.result)!==6||evmReceipt.status!=='success'||!transaction.recipient)
  throw new Error(`Deployment finalized unsuccessfully: ${transaction.statusName} / ${transaction.result} / ${evmReceipt.status}`);
manifest.address=transaction.recipient;manifest.finalizedAt=new Date().toISOString();
writeFileSync(manifestPath,JSON.stringify(manifest,null,2));
console.log('PACTPROOF contract:',manifest.address);
console.log('Set VITE_CONTRACT_ADDRESS='+manifest.address+' in .env and restart the app.');
