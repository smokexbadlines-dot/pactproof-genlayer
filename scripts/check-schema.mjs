import {readFileSync} from 'node:fs';
import {createClient} from 'genlayer-js';
import {studionet} from 'genlayer-js/chains';

const code=readFileSync(new URL('../contracts/pactproof.py',import.meta.url),'utf8');
const schema=await createClient({chain:studionet}).getContractSchemaForCode(code);
console.log(JSON.stringify(schema,null,2));
