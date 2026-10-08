import {createClient} from 'genlayer-js';
import {localnet,studionet,testnetBradbury} from 'genlayer-js/chains';
import {TransactionHashVariant,TransactionStatus,type Hash} from 'genlayer-js/types';
import type {Pending} from './types';

const networks={localnet,studionet,testnetBradbury};
export type NetworkName=keyof typeof networks;
export type Connection={network:NetworkName;address:`0x${string}`};
export const defaultNetwork:NetworkName=(import.meta.env.VITE_GENLAYER_NETWORK in networks?import.meta.env.VITE_GENLAYER_NETWORK:'studionet') as NetworkName;
const savedKey='pactproof-genlayer-connection-v1';
const addressPattern=/^0x[0-9a-fA-F]{40}$/;

export function getConnection():Connection|null {
  try {
    const stored=JSON.parse(localStorage.getItem(savedKey)||'null');
    if(stored&&stored.network in networks&&addressPattern.test(stored.address)) return stored;
  } catch { /* Ignore malformed browser storage. */ }
  const address=import.meta.env.VITE_CONTRACT_ADDRESS;
  return addressPattern.test(address||'')?{network:defaultNetwork,address}:null;
}
function requireConnection():Connection {
  const value=getConnection();
  if(!value) throw new Error('Enter a deployed PACTPROOF contract address to use GenLayer mode.');
  return value;
}
function key({network,address}:Connection){return `pactproof-pending:${network}:${address.toLowerCase()}`;}
export function getPending():Pending|null {const connection=getConnection();if(!connection)return null;try{return JSON.parse(localStorage.getItem(key(connection))||'null');}catch{return null;}}
export function clearPending(){const connection=getConnection();if(connection)localStorage.removeItem(key(connection));}

export async function configureConnection(network:NetworkName,address:string):Promise<Connection>{
  if(!(network in networks))throw new Error('Choose a supported GenLayer network.');
  if(!addressPattern.test(address))throw new Error('Enter a 0x-prefixed, 40-byte contract address.');
  const connection:Connection={network,address:address as `0x${string}`};
  const client=createClient({chain:networks[network]});
  const source=await client.getContractCode(connection.address).catch(error=>{throw new Error(`Contract source lookup failed: ${String(error)}`)});
  if(typeof source!=='string'||!source.includes('class PactProof('))throw new Error('This address does not contain the PACTPROOF Intelligent Contract.');
  const count=await client.readContract({address:connection.address,functionName:'get_count',args:[],transactionHashVariant:TransactionHashVariant.LATEST_FINAL}).catch(error=>{throw new Error(`Finalized grant count read failed: ${String(error)}`)});
  if(typeof count!=='number'&&typeof count!=='bigint')throw new Error('PACTPROOF contract did not return a valid grant count.');
  localStorage.setItem(savedKey,JSON.stringify(connection));
  return connection;
}

type Provider={request:(arg:{method:string;params?:unknown[]})=>Promise<unknown>;isMetaMask?:boolean;on?:(event:string,callback:()=>void)=>void;removeListener?:(event:string,callback:()=>void)=>void};
type AnnouncedProvider={info?:{name?:string;rdns?:string};provider?:Provider};
let activeProvider:Provider|null=null;
function isMetaMask(detail:AnnouncedProvider){return detail.provider?.isMetaMask===true||detail.info?.rdns==='io.metamask'||detail.info?.name==='MetaMask';}
function injectedProviders():Provider[]{
  const ethereum=(window as unknown as {ethereum?:Provider&{providers?:Provider[]}}).ethereum;
  return ethereum?.providers?.length?ethereum.providers:ethereum?[ethereum]:[];
}
async function walletProvider(forceDiscovery=false):Promise<Provider>{
  if(activeProvider&&!forceDiscovery)return activeProvider;
  const announced:AnnouncedProvider[]=[];
  const onAnnounce=(event:Event)=>{const detail=(event as CustomEvent<AnnouncedProvider>).detail;if(detail?.provider?.request)announced.push(detail);};
  window.addEventListener('eip6963:announceProvider',onAnnounce);
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  await new Promise(resolve=>setTimeout(resolve,200));
  window.removeEventListener('eip6963:announceProvider',onAnnounce);
  const provider=announced.find(isMetaMask)?.provider||injectedProviders().find(p=>p.isMetaMask)||announced[0]?.provider||injectedProviders()[0];
  if(!provider)throw new Error('MetaMask was not detected on this page. Finish its setup or unlock it in this Chrome profile, allow it on this site, then reload PACTPROOF.');
  activeProvider=provider;
  return provider;
}
export function subscribeWalletChanges(callback:()=>void){
  const provider=activeProvider;
  provider?.on?.('accountsChanged',callback);provider?.on?.('chainChanged',callback);
  return ()=>{provider?.removeListener?.('accountsChanged',callback);provider?.removeListener?.('chainChanged',callback);};
}
export async function connectWallet(_connection:Connection|null=getConnection()):Promise<`0x${string}`> {
  const provider=await walletProvider(true);
  const accounts=await provider.request({method:'eth_requestAccounts'}) as `0x${string}`[];
  if(!accounts[0])throw new Error('No wallet account available.');
  return accounts[0];
}
export async function read<T>(functionName:string,args:(string|number)[]=[]):Promise<T> {
  const {network,address}=requireConnection();
  const reader=createClient({chain:networks[network]});
  const value=await reader.readContract({address,functionName,args,transactionHashVariant:TransactionHashVariant.LATEST_FINAL});
  // Amount views return decimal strings: never JSON.parse them into lossy JS numbers.
  return (typeof value==='string'&&['get_grant','list_grants','get_record'].includes(functionName)?JSON.parse(value):value) as T;
}
export async function resumePending(onStatus:(message:string)=>void){
  const connection=requireConnection(),pending=getPending();if(!pending)return;
  onStatus('Waiting for GenLayer finality · '+pending.hash);
  const reader=createClient({chain:networks[connection.network]});
  const hash=pending.hash as Hash;
  await reader.waitForTransactionReceipt({hash,status:TransactionStatus.FINALIZED,interval:3000,retries:100});
  const [transaction,evmReceipt]=await Promise.all([reader.getTransaction({hash}),reader.getTransactionReceipt({hash})]);
  clearPending();
  // The stable Studionet SDK omits txExecutionResultName from its simplified receipt.
  // A successful live write has FINALIZED + MAJORITY_AGREE (6) and an EVM success receipt.
  if(transaction.statusName!==TransactionStatus.FINALIZED||Number(transaction.result)!==6||evmReceipt.status!=='success')
    throw new Error(`Transaction finalized without successful execution: ${transaction.statusName} / ${transaction.result} / ${evmReceipt.status}`);
  onStatus('Finalized successfully.');
}
export async function write(account:`0x${string}`,functionName:string,args:(string|number)[],value:bigint,onStatus:(message:string)=>void){
  const connection=requireConnection();
  if(getPending())throw new Error('Resume the pending transaction before submitting another action.');
  const provider=await walletProvider();
  const accounts=await provider.request({method:'eth_accounts'}) as string[];
  if(accounts[0]?.toLowerCase()!==account.toLowerCase())throw new Error('Wallet account changed. Reconnect before signing.');
  const client=createClient({chain:networks[connection.network],account,provider});
  onStatus('Prepare the GenLayer network and wallet in MetaMask.');
  await client.connect(connection.network);
  const call={address:connection.address,functionName,args,value};
  onStatus('Confirm this transaction in your wallet.');
  const hash=await client.writeContract(call);
  localStorage.setItem(key(connection),JSON.stringify({hash,method:functionName,submittedAt:Date.now(),network:connection.network,contract:connection.address,account}));
  await resumePending(onStatus);
}
export async function appeal(account:`0x${string}`,hash:`0x${string}`){
  const {network}=requireConnection();
  const provider=await walletProvider();
  const client=createClient({chain:networks[network],account,provider});await client.connect(network);
  if(!await client.canAppeal({txId:hash}))throw new Error('This transaction is not currently appealable.');
  const charge=await client.getMinAppealBond({txId:hash});
  return client.appealTransaction({txId:hash,value:charge});
}
