import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {z} from 'zod';
import {catalog} from '../../../lib/catalog';
export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}});
async function crypt(value:string,owner:string,decode=false){
 const hex=(env as unknown as {DATA_KEY:string}).DATA_KEY;if(!hex)throw Error('key');
 const key=await crypto.subtle.importKey('raw',new Uint8Array(hex.match(/../g)!.map(v=>parseInt(v,16))),{name:'AES-GCM'},false,['encrypt','decrypt']);
 if(decode){const b=Uint8Array.from(atob(value),c=>c.charCodeAt(0));return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:b.slice(0,12),additionalData:new TextEncoder().encode(owner)},key,b.slice(12)));}
 const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(owner)},key,new TextEncoder().encode(value)));return btoa(String.fromCharCode(...iv,...encrypted));
}
const profileSchema=z.object({name:z.string().trim().min(3).max(100),cpf:z.string().regex(/^\d{11}$/),phone:z.string().regex(/^\d{10,11}$/),address:z.string().trim().min(10).max(250),cep:z.string().regex(/^\d{8}$/),card:z.enum(['4242','4444'])}).strict();
const productSchema=z.object({name:z.string().trim().min(3).max(80),description:z.string().trim().min(10).max(500),category:z.enum(['Áudio','Setup','Lifestyle']),price:z.number().int().min(100).max(10000000),stock:z.number().int().min(0).max(10000)}).strict();
export async function GET(){try{const user=await getChatGPTUser();if(!user)return response({error:'Entre para continuar.'},401);const db=env.DB!;const p=await db.prepare('SELECT data FROM profiles WHERE owner=?').bind(user.userId).first<{data:string}>();const rows=await db.prepare('SELECT * FROM products WHERE active=1 OR owner=?').bind(user.userId).all();const o=await db.prepare('SELECT id,buyer,seller,product,quantity,total,status,delivery,created FROM orders WHERE buyer=? OR seller=? ORDER BY created DESC LIMIT 100').bind(user.userId,user.userId).all();return response({user:{id:user.userId,name:user.displayName},products:[...catalog,...rows.results],profile:p?JSON.parse(await crypt(p.data,user.userId,true)):null,orders:await Promise.all(o.results.map(async (row:any)=>{const info=JSON.parse(await crypt(row.delivery,row.buyer,true));const {delivery,...order}=row;return {...order,deliveryAddress:info.address,deliveryCep:info.cep,recipient:info.name};}))});}catch{return response({error:'Não foi possível carregar os dados.'},503)}}
export async function POST(req:Request){try{
 const user=await getChatGPTUser();if(!user)return response({error:'Sessão necessária.'},401);
 if(req.headers.get('origin')!==new URL(req.url).origin||req.headers.get('x-vitrine-request')!=='1')return response({error:'Origem não autorizada.'},403);
 if(!req.headers.get('content-type')?.startsWith('application/json'))return response({error:'Formato inválido.'},415);
 const raw=await req.text();if(raw.length>10000)return response({error:'Requisição muito grande.'},413);
 const db=env.DB!;const bucket=user.userId+':'+Math.floor(Date.now()/60000);const rate=await db.prepare('INSERT INTO limits(id,count) VALUES(?,1) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count').bind(bucket).first<{count:number}>();if(rate!.count>40)return response({error:'Muitas tentativas. Aguarde um minuto.'},429);
 const b=JSON.parse(raw);const owner=user.userId;
 if(b.action==='profile'){const data=profileSchema.parse(b.data);await db.prepare('INSERT INTO profiles(owner,data) VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET data=excluded.data').bind(owner,await crypt(JSON.stringify(data),owner)).run();return response({ok:true});}
 if(b.action==='delete-profile'){await db.prepare('DELETE FROM profiles WHERE owner=?').bind(owner).run();return response({ok:true});}
 if(b.action==='product'){const p=productSchema.parse(b.data);if(b.id){const r=await db.prepare('UPDATE products SET name=?,description=?,category=?,price=?,stock=? WHERE id=? AND owner=?').bind(p.name,p.description,p.category,p.price,p.stock,z.string().uuid().parse(b.id),owner).run();if(!r.meta.changes)return response({error:'Produto não encontrado.'},404);}else await db.prepare('INSERT INTO products(id,owner,name,description,category,price,stock) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),owner,p.name,p.description,p.category,p.price,p.stock).run();return response({ok:true});}
 if(b.action==='delete-product'){const r=await db.prepare('UPDATE products SET active=0 WHERE id=? AND owner=?').bind(z.string().uuid().parse(b.id),owner).run();if(!r.meta.changes)return response({error:'Produto não encontrado.'},404);return response({ok:true});}
 if(b.action==='checkout'){
 const items=z.array(z.object({id:z.string().max(60),qty:z.number().int().min(1).max(10)}).strict()).min(1).max(20).parse(b.items);if(new Set(items.map(i=>i.id)).size!==items.length)return response({error:'Itens duplicados.'},400);
 const nonce=z.string().uuid().parse(b.nonce);const existing=await db.prepare('SELECT id FROM orders WHERE nonce LIKE ? AND buyer=?').bind(nonce+':%',owner).first();if(existing)return response({ok:true});
 const p=await db.prepare('SELECT data FROM profiles WHERE owner=?').bind(owner).first<{data:string}>();if(!p)return response({error:'Cadastre seus dados de entrega primeiro.'},400);
 const statements=[];for(const item of items){const product=catalog.find(x=>x.id===item.id)||await db.prepare('SELECT * FROM products WHERE id=? AND active=1').bind(item.id).first<any>();if(!product||product.stock<item.qty)return response({error:'Estoque insuficiente.'},409);
 // A failed NOT NULL insertion rolls back the entire D1 batch if concurrent checkout depleted stock.
 statements.push(db.prepare(`INSERT INTO orders(id,buyer,seller,product,quantity,total,status,delivery,created,nonce) VALUES(?,?,?,CASE WHEN ?='demo' OR EXISTS(SELECT 1 FROM products WHERE id=? AND active=1 AND stock>=?) THEN ? ELSE NULL END,?,?,?,?,?,?)`).bind(crypto.randomUUID(),owner,product.owner,product.owner,item.id,item.qty,product.name,item.qty,product.price*item.qty+1990,'Confirmado',p.data,new Date().toISOString(),nonce+':'+item.id));
 if(product.owner!=='demo')statements.push(db.prepare('UPDATE products SET stock=stock-? WHERE id=?').bind(item.qty,item.id));}
 await db.batch(statements);return response({ok:true});}
 if(b.action==='status'){const id=z.string().uuid().parse(b.id);const current=await db.prepare('SELECT status FROM orders WHERE id=? AND seller=?').bind(id,owner).first<{status:string}>();const flow=['Confirmado','Em preparação','Em transporte','Entregue'];if(!current||flow.indexOf(current.status)>2)return response({error:'Transição indisponível.'},400);await db.prepare('UPDATE orders SET status=? WHERE id=? AND seller=? AND status=?').bind(flow[flow.indexOf(current.status)+1],id,owner,current.status).run();return response({ok:true});}
 return response({error:'Operação desconhecida.'},400);
 }catch(e){if(e instanceof z.ZodError)return response({error:'Revise os campos informados.'},400);return response({error:'Não foi possível concluir. Atualize e tente novamente.'},400)}}
