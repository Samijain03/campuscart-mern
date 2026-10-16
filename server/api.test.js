import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import mongoose from 'mongoose';
test('product CRUD and complete checkout/status workflow',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'campuscart-test-'));
 const port=32000+Math.floor(Math.random()*10000);
 const mongoTestUri=process.env.TEST_MONGODB === '1' ? `mongodb://127.0.0.1:27017/campuscart_test_${Date.now()}_${port}` : '';
 const child=spawn(process.execPath,[fileURLToPath(new URL('./index.js',import.meta.url))],{cwd:directory,env:{...process.env,PORT:String(port),MONGODB_URI:mongoTestUri},stdio:['ignore','pipe','pipe']});
 let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
 async function request(route,method='GET',body){const r=await fetch(`http://localhost:${port}/api${route}`,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
 try{
  let ready=false;for(let i=0;i<60;i++){try{await request('/health');ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}
  assert.ok(ready,logs);
  const input={name:'API test notebook',description:'A test notebook description',category:'Stationery',price:300,stock:3};
  const created=await request('/products','POST',input);assert.equal(created.status,201);const id=created.data.id;
  assert.equal((await request('/products/'+id,'PUT',{...input,price:250})).status,200);
  assert.equal((await request('/orders','POST',{customer:{}})).status,400);
  const customer={name:'Demo Student',email:'student@example.com',address:'Room 101, Campus Road, Pune 411001'};
  assert.equal((await request('/orders','POST',{customer,items:[{productId:id,quantity:4}]})).status,400);
  const placed=await request('/orders','POST',{customer,items:[{productId:id,quantity:2,price:1}]});assert.equal(placed.status,201,JSON.stringify(placed.data));assert.equal(placed.data.total,500);assert.equal(placed.data.shipping,0);
  assert.equal((await request('/products/'+id)).data.stock,1);
  assert.equal((await request('/orders/'+placed.data.id,'PATCH',{status:'Delivered'})).status,400);
  assert.equal((await request('/orders/'+placed.data.id,'PATCH',{status:'Shipped'})).data.status,'Shipped');
  assert.equal((await request('/orders/'+placed.data.id,'PATCH',{status:'Delivered'})).data.status,'Delivered');
  assert.equal((await request('/products/'+id,'DELETE')).status,200);
  assert.equal((await request('/products/'+id)).status,404);
  assert.equal((await request('/orders')).data[0].items[0].name,input.name);
  if(mongoTestUri){
    await mongoose.connect(mongoTestUri);
    const stored=await mongoose.connection.db.collection('orders').findOne({id:placed.data.id});
    assert.equal(stored.status,'Delivered');assert.equal(stored.total,500);
    assert.equal(await mongoose.connection.db.collection('products').countDocuments({id}),0);
  }
 }finally{child.kill();if(child.exitCode===null)await new Promise(r=>child.once('exit',r));if(mongoTestUri){if(mongoose.connection.readyState!==1)await mongoose.connect(mongoTestUri);await mongoose.connection.dropDatabase();await mongoose.disconnect();}await rm(directory,{recursive:true,force:true});}
});
