import {createClient} from 'genlayer-js';
import {studionet,localnet,testnetBradbury} from 'genlayer-js/chains';
import {TransactionHashVariant} from 'genlayer-js/types';

const networks={studionet,localnet,testnetBradbury};
const network=process.argv[2]||'studionet';
const address=process.argv[3];
if(!(network in networks))throw new Error('Choose studionet, localnet, or testnetBradbury.');
if(!/^0x[0-9a-fA-F]{40}$/.test(address||''))throw new Error('Supply a contract address.');

const client=createClient({chain:networks[network]});
const call=(functionName,args=[])=>client.readContract({address,functionName,args,transactionHashVariant:TransactionHashVariant.LATEST_FINAL});
const count=Number(await call('get_count'));
const grants=[];
for(let offset=0;offset<count;offset+=50)grants.push(...JSON.parse(await call('list_grants',[offset,50])));
const addresses=[...new Set(grants.flatMap(g=>[g.creator,g.builder]))];
const credits={};
for(const who of addresses)credits[who]=BigInt(await call('get_credit',[who]));
const locked=grants.filter(g=>g.state!=='CLOSED').reduce((sum,g)=>sum+BigInt(g.reward_wei),0n);
const credited=Object.values(credits).reduce((sum,n)=>sum+n,0n);
const balance=await client.getBalance({address});
const accountBalances={};
for(const who of addresses)accountBalances[who]=await client.getBalance({address:who});
const report={network,address,grantCount:count,grants:grants.map(g=>({id:g.id,state:g.state,rewardWei:g.reward_wei,outcome:g.outcome,payoutWei:g.payout_wei,refundWei:g.refund_wei,creator:g.creator,builder:g.builder,latestRecord:g.latest_record})),lockedWei:locked,creditsWei:Object.fromEntries(Object.entries(credits)),totalCreditsWei:credited,contractBalanceWei:balance,accountBalancesWei:accountBalances,escrowCovered:balance>=locked+credited};
console.log(JSON.stringify(report,(_,v)=>typeof v==='bigint'?v.toString():v,2));
