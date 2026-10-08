import {beforeEach,describe,expect,it,vi} from 'vitest';

const sdk=vi.hoisted(()=>({getCode:vi.fn(),readContract:vi.fn(),connect:vi.fn(),writeContract:vi.fn(),waitForTransactionReceipt:vi.fn(),getTransaction:vi.fn(),getTransactionReceipt:vi.fn()}));
vi.mock('genlayer-js',()=>({createClient:()=>({getContractCode:sdk.getCode,readContract:sdk.readContract,connect:sdk.connect,writeContract:sdk.writeContract,waitForTransactionReceipt:sdk.waitForTransactionReceipt,getTransaction:sdk.getTransaction,getTransactionReceipt:sdk.getTransactionReceipt})}));
import {configureConnection,connectWallet,getConnection,read,resumePending,write} from '../src/chain';

const address='0x1234567890123456789012345678901234567890';
const storage=new Map<string,string>();
beforeEach(()=>{
  storage.clear();sdk.getCode.mockReset();sdk.readContract.mockReset();sdk.connect.mockReset();sdk.writeContract.mockReset();sdk.waitForTransactionReceipt.mockReset();sdk.getTransaction.mockReset();sdk.getTransactionReceipt.mockReset();
  vi.stubEnv('VITE_CONTRACT_ADDRESS','');
  vi.stubGlobal('localStorage',{getItem:(key:string)=>storage.get(key)||null,setItem:(key:string,value:string)=>storage.set(key,value),removeItem:(key:string)=>storage.delete(key)});
});

describe('live contract connection',()=>{
  it('saves a connection only after deployed source and finalized grant read succeed',async()=>{
    sdk.getCode.mockResolvedValue('class PactProof(gl.Contract):\n    pass');
    sdk.readContract.mockResolvedValueOnce(0);
    await expect(configureConnection('studionet',address)).resolves.toEqual({network:'studionet',address});
    expect(getConnection()).toEqual({network:'studionet',address});
    expect(sdk.getCode).toHaveBeenCalledWith(address);
  });
  it('rejects an unrelated contract without saving it',async()=>{
    sdk.getCode.mockResolvedValue('class OtherContract(gl.Contract): pass');
    await expect(configureConnection('studionet',address)).rejects.toThrow('does not contain');
    expect(getConnection()).toBeNull();
  });
  it('preserves credit wei as a decimal string',async()=>{
    sdk.getCode.mockResolvedValue('class PactProof(gl.Contract): pass');
    sdk.readContract.mockResolvedValueOnce(0).mockResolvedValueOnce('1000000000000000001');
    await configureConnection('studionet',address);
    await expect(read<string>('get_credit',[address])).resolves.toBe('1000000000000000001');
  });
  it('connects an injected MetaMask account before any contract is deployed',async()=>{
    const request=vi.fn().mockResolvedValue([address]);
    vi.stubGlobal('window',Object.assign(new EventTarget(),{ethereum:{isMetaMask:true,request}}));
    await expect(connectWallet(null)).resolves.toBe(address);
    expect(request).toHaveBeenCalledWith({method:'eth_requestAccounts'});
    expect(getConnection()).toBeNull();
  });
  it('prefers an announced MetaMask provider over another injected wallet',async()=>{
    const genericRequest=vi.fn().mockResolvedValue([]);
    const metaMaskRequest=vi.fn().mockResolvedValue([address]);
    const browser=Object.assign(new EventTarget(),{ethereum:{request:genericRequest}});
    browser.addEventListener('eip6963:requestProvider',()=>{
      const announcement=Object.assign(new Event('eip6963:announceProvider'),{detail:{info:{name:'MetaMask',rdns:'io.metamask'},provider:{request:metaMaskRequest}}});
      browser.dispatchEvent(announcement);
    });
    vi.stubGlobal('window',browser);
    await expect(connectWallet(null)).resolves.toBe(address);
    expect(metaMaskRequest).toHaveBeenCalledWith({method:'eth_requestAccounts'});
    expect(genericRequest).not.toHaveBeenCalled();
  });
  it('submits a stable-SDK write and waits for successful finalization',async()=>{
    sdk.getCode.mockResolvedValue('class PactProof(gl.Contract): pass');
    sdk.readContract.mockResolvedValue(0);
    await configureConnection('studionet',address);
    const request=vi.fn().mockResolvedValue([address]);
    vi.stubGlobal('window',Object.assign(new EventTarget(),{ethereum:{isMetaMask:true,request}}));
    await connectWallet(null);
    const hash='0x'+'ab'.repeat(32);
    sdk.writeContract.mockResolvedValue(hash);
    sdk.waitForTransactionReceipt.mockResolvedValue({status:7,result:6});
    sdk.getTransaction.mockResolvedValue({statusName:'FINALIZED',result:6});
    sdk.getTransactionReceipt.mockResolvedValue({status:'success'});
    const status:string[]=[];
    await write(address,'create_grant',['{}'],10n,message=>status.push(message));
    expect(sdk.connect).toHaveBeenCalledWith('studionet');
    expect(sdk.writeContract).toHaveBeenCalledWith({address,functionName:'create_grant',args:['{}'],value:10n});
    expect(sdk.waitForTransactionReceipt).toHaveBeenCalledWith({hash,status:'FINALIZED',interval:3000,retries:100});
    expect(sdk.getTransaction).toHaveBeenCalledWith({hash});
    expect(sdk.getTransactionReceipt).toHaveBeenCalledWith({hash});
    expect(status.at(-1)).toBe('Finalized successfully.');
  });
  it('rejects a finalized write when consensus did not agree',async()=>{
    sdk.getCode.mockResolvedValue('class PactProof(gl.Contract): pass');
    sdk.readContract.mockResolvedValue(0);
    await configureConnection('studionet',address);
    const hash='0x'+'cd'.repeat(32);
    storage.set(`pactproof-pending:studionet:${address.toLowerCase()}`,JSON.stringify({hash}));
    sdk.waitForTransactionReceipt.mockResolvedValue({status:7,result:7});
    sdk.getTransaction.mockResolvedValue({statusName:'FINALIZED',result:7});
    sdk.getTransactionReceipt.mockResolvedValue({status:'success'});
    await expect(resumePending(()=>{})).rejects.toThrow('without successful execution');
  });
});
