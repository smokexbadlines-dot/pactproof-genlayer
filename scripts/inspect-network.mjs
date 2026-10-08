import {createClient} from 'genlayer-js';
import {studionet,localnet,testnetBradbury} from 'genlayer-js/chains';

const networks={studionet,localnet,testnetBradbury};
const network=process.argv[2]||'studionet';
if(!(network in networks))throw new Error('Choose studionet, localnet, or testnetBradbury.');

const client=createClient({chain:networks[network]});
const blockNumber=await client.getBlockNumber();
const gasPrice=await client.getGasPrice();
console.log(JSON.stringify({network,chainId:networks[network].id,blockNumber,evmGasPriceWei:gasPrice},(_,value)=>typeof value==='bigint'?value.toString():value,2));

const hash=process.argv[3];
if(hash){
  if(!/^0x[0-9a-fA-F]{64}$/.test(hash))throw new Error('Transaction ID must be a 32-byte hex value.');
  const transaction=await client.getTransaction({hash});
  console.log(JSON.stringify({transaction},(_,value)=>typeof value==='bigint'?value.toString():value,2));
}
