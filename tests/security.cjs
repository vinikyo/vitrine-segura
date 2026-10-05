const ts=require('typescript');const fs=require('fs');const assert=require('node:assert/strict');const {DatabaseSync}=require('node:sqlite');const {webcrypto}=require('node:crypto');global.crypto=webcrypto;
const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync('drizzle/0000_nostalgic_ironclad.sql','utf8').replaceAll('--> statement-breakpoint',''));
let user={userId:'alice',displayName:'Alice',email:'alice@example.invalid'};
function prepare(sql){let args=[];return {bind(...a){args=a;return this},async first(){return sqlite.prepare(sql).get(...args)||null},async all(){return {results:sqlite.prepare(sql).all(...args)}},async run(){const r=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}}}}}
const db={prepare,async batch(s){sqlite.exec('BEGIN');try{const result=[];for(const v of s)result.push(await v.run());sqlite.exec('COMMIT');return result}catch(e){sqlite.exec('ROLLBACK');throw e}}};
function compile(file){return ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText}
const cat={exports:{}};new Function('require','module','exports',compile('lib/catalog.ts'))(require,cat,cat.exports);
const m={exports:{}};new Function('require','module','exports',compile('app/api/store/route.ts'))(n=>n==='cloudflare:workers'?{env:{DB:db,DATA_KEY:'ab'.repeat(32)}}:n.includes('chatgpt-auth')?{getChatGPTUser:async()=>user}:n.includes('catalog')?cat.exports:require(n),m,m.exports);
const post=(b,origin='https://vitrine.test')=>m.exports.POST(new Request('https://vitrine.test/api/store',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Vitrine-Request':'1'},body:JSON.stringify(b)}));
(async()=>{
user=null;assert.equal((await m.exports.GET()).status,401);user={userId:'alice',displayName:'Alice',email:'alice@example.invalid'};
assert.equal((await post({action:'profile'},'https://evil.test')).status,403);
assert.equal((await post({action:'profile',data:{name:'Bad'}})).status,400);
const profile={name:'Pessoa Fictícia',cpf:'12345678900',phone:'11999999999',address:'Rua Fictícia, 10, Cidade Teste',cep:'12345678',card:'4242'};
assert.equal((await post({action:'profile',data:profile})).status,200);assert.ok(!sqlite.prepare('SELECT data FROM profiles').get().data.includes(profile.cpf));
const product={name:'Produto teste',description:'Descrição de produto teste',category:'Setup',price:10000,stock:1};assert.equal((await post({action:'product',data:product})).status,200);const id=sqlite.prepare('SELECT id FROM products').get().id;
user={userId:'bob',displayName:'Bob',email:'bob@example.invalid'};assert.equal((await post({action:'delete-product',id})).status,404);const bob=await (await m.exports.GET()).json();assert.equal(bob.profile,null);assert.equal(bob.orders.length,0);
await post({action:'profile',data:profile});const nonce=crypto.randomUUID();const order={action:'checkout',nonce,items:[{id,qty:1}],price:1};assert.equal((await post(order)).status,200);assert.equal(sqlite.prepare('SELECT total FROM orders').get().total,11990);assert.equal(sqlite.prepare('SELECT stock FROM products').get().stock,0);
assert.equal((await post(order)).status,200);assert.equal(sqlite.prepare('SELECT count(*) n FROM orders').get().n,1);assert.equal((await post({...order,nonce:crypto.randomUUID()})).status,409);
const oid=sqlite.prepare('SELECT id FROM orders').get().id;assert.equal((await post({action:'status',id:oid})).status,400);user={userId:'alice',displayName:'Alice',email:'alice@example.invalid'};assert.equal((await post({action:'status',id:oid})).status,200);
for(let i=0;i<40;i++)await post({action:'delete-profile'});assert.equal((await post({action:'delete-profile'})).status,429);
console.log('PASS: authentication, CSRF, validation, encryption, ownership, server prices, stock, idempotency, delivery permissions, rate limit');
})().catch(e=>{console.error(e);process.exit(1)});
