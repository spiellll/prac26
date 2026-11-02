import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
// Simulate only the provider transport. This never sends personal data or uses a real key.
const source=readFileSync('lib/ai.ts','utf8').replace("import {env} from 'cloudflare:workers';","const env={OPENAI_API_KEY:'test-only',OPENAI_MODEL:'test-model'};");
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {modelReply}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const original=globalThis.fetch;
try{
 let sent;
 globalThis.fetch=async(url,init)=>{sent={url,...init};return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:' Наблюдение по дневнику. '}]}]})};
 assert.equal(await modelReply('Rules',{profile:{goal:'test'}}),'Наблюдение по дневнику.');
 const body=JSON.parse(sent.body);assert.equal(body.store,false);assert.equal(body.model,'test-model');assert.equal(body.instructions,'Rules');assert.ok(body.input.includes('test'));
 globalThis.fetch=async()=>Response.json({error:'rate limit'},{status:429});await assert.rejects(()=>modelReply('Rules',{}),/ограничении запросов/);
 globalThis.fetch=async()=>Response.json({error:'sensitive provider message'},{status:401});await assert.rejects(()=>modelReply('Rules',{}),/API-ключ/);
 globalThis.fetch=async()=>Response.json({status:'incomplete',output:[{content:[{type:'output_text',text:'truncated'}]}]});await assert.rejects(()=>modelReply('Rules',{}),/Incomplete/);
 globalThis.fetch=async()=>Response.json({status:'completed',output:[]});await assert.rejects(()=>modelReply('Rules',{}),/Incomplete/);
 console.log('AI adapter checks passed with mocked transport: context, no-store, text extraction, rate-limit and incomplete-response handling. No live API call.');
}finally{globalThis.fetch=original}
