import {createClient} from 'genlayer-js';
import {studionet,localnet,testnetBradbury} from 'genlayer-js/chains';

const networks={studionet,localnet,testnetBradbury};
const [network='studionet',...hashes]=process.argv.slice(2);
if(!(network in networks))throw new Error('Choose studionet, localnet, or testnetBradbury.');
if(!hashes.length||hashes.some(hash=>!/^0x[0-9a-fA-F]{64}$/.test(hash)))throw new Error('Supply one or more transaction IDs.');
const client=createClient({chain:networks[network]});
const gasPrice=await client.getGasPrice();
const transactions=[];
for(const hash of hashes){
  const tx=await client.getTransaction({hash});
  const receipt=await client.getTransactionReceipt({hash}).catch(error=>({receiptError:String(error)}));
  const consensusReceipt=await client.waitForTransactionReceipt({hash,status:'FINALIZED',retries:0});
  const compact=(x)=>Object.fromEntries(['status','statusName','result','resultName','txExecutionResult','txExecutionResultName','gasUsed','gasPrice','effectiveGasPrice','fee','value','from','from_address','to','recipient','contractAddress','contract_address','blockNumber','block_number'].filter(k=>x?.[k]!==undefined).map(k=>[k,x[k]]));
  transactions.push({hash,transaction:compact(tx),consensusReceipt:compact(consensusReceipt),receipt:compact(receipt),receiptError:receipt.receiptError});
}
console.log(JSON.stringify({network,chainId:networks[network].id,sampledEvmGasPriceWei:gasPrice,transactions},(_,v)=>typeof v==='bigint'?v.toString():v,2));
