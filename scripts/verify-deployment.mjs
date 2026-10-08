import {createClient} from 'genlayer-js';
import {studionet,localnet,testnetBradbury} from 'genlayer-js/chains';
import {TransactionHashVariant,TransactionStatus} from 'genlayer-js/types';

const networks={studionet,localnet,testnetBradbury};
const network=process.argv[2]||'studionet';
const address=process.argv[3];
const hash=process.argv[4];
if(!(network in networks))throw new Error('Choose studionet, localnet, or testnetBradbury.');
if(!/^0x[0-9a-fA-F]{40}$/.test(address||''))throw new Error('Supply a contract address.');
if(hash&&!/^0x[0-9a-fA-F]{64}$/.test(hash))throw new Error('Transaction ID must be a 32-byte hex value.');

const client=createClient({chain:networks[network]});
const count=await client.readContract({address,functionName:'get_count',args:[]});
const report={network,chainId:networks[network].id,address,grantCount:count};
try {
  report.finalizedGrantCount=await client.readContract({address,functionName:'get_count',args:[],transactionHashVariant:TransactionHashVariant.LATEST_FINAL});
} catch(error){report.finalizedReadError=String(error?.shortMessage||error?.message||error);}
try {
  const source=await client.getContractCode(address);
  report.source={bytes:source.length,pactProofClass:source.includes('class PactProof(')};
} catch(error){report.sourceError=String(error?.shortMessage||error?.message||error);}
if(hash){
  const transaction=await client.getTransaction({hash});
  report.deployment={hash,status:transaction.statusName,consensusResult:transaction.resultName,
    executionResult:transaction.txExecutionResultName,recipient:transaction.recipient,
    rawResult:transaction.result,rawExecutionResult:transaction.txExecutionResult};
  report.deploymentConfirmed=transaction.statusName===TransactionStatus.FINALIZED&&
    transaction.recipient?.toLowerCase()===address.toLowerCase()&&
    report.source?.pactProofClass===true;
}
console.log(JSON.stringify(report,(_,v)=>typeof v==='bigint'?v.toString():v,2));
