import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { seedProducts } from './seed.js';
import { priceOrder } from './order.js';

const app = express();
app.use(express.json({limit:'100kb'}));
const productSchema = new mongoose.Schema({id:{type:String,unique:true},name:String,category:String,description:String,price:{type:Number,min:0},stock:{type:Number,min:0},icon:String,color:String,tag:String});
const orderSchema = new mongoose.Schema({id:{type:String,unique:true},customer:{name:String,email:String,address:String},items:[{productId:String,name:String,price:Number,quantity:Number}],subtotal:Number,shipping:Number,total:Number,status:String,createdAt:String});
const Product = mongoose.model('Product', productSchema), Order = mongoose.model('Order', orderSchema);
const mongo = Boolean(process.env.MONGODB_URI);
let state;
if (mongo) {
  await mongoose.connect(process.env.MONGODB_URI);
  if (await Product.countDocuments() === 0) await Product.insertMany(seedProducts);
  // Keep BSON IDs as strings so rollback snapshots stay valid Mongoose input.
  state = JSON.parse(JSON.stringify({products:await Product.find().lean(), orders:await Order.find().lean()}));
} else {
  await mkdir('data',{recursive:true});
  try {state = JSON.parse(await readFile('data/store.json','utf8'));} catch (err) {if(err.code !== 'ENOENT') throw err; state={products:structuredClone(seedProducts),orders:[]};}
}
async function persist() {
  if(mongo) {
    // All writes are serialized below. This PoC runs as one server instance.
    await Product.bulkWrite(state.products.map(p=>({replaceOne:{filter:{id:p.id},replacement:p,upsert:true}})));
    await Product.deleteMany({id:{$nin:state.products.map(p=>p.id)}});
    if(state.orders.length) await Order.bulkWrite(state.orders.map(o=>({replaceOne:{filter:{id:o.id},replacement:o,upsert:true}})));
  } else {await writeFile('data/store.tmp',JSON.stringify(state,null,2)); await rename('data/store.tmp','data/store.json');}
}
let queue=Promise.resolve();
function mutate(fn) {return (req,res,next)=>{const task=queue.then(async()=>{const previous=structuredClone(state);try{const result=await fn(req);await persist();res.status(req.method==='POST'?201:200).json(result);}catch(error){state=previous;throw error;}}); queue=task.catch(()=>{});task.catch(next);};}
function fail(message,status=400){const e=new Error(message);e.status=status;throw e;}
app.get('/api/health',(req,res)=>res.json({ok:true,storage:mongo?'MongoDB':'Local demo storage',demoAdmin:true}));
app.get('/api/products',(req,res)=>res.json(state.products));
app.get('/api/products/:id',(req,res)=>{const p=state.products.find(p=>p.id===req.params.id);if(!p)return res.status(404).json({message:'Product not found.'});res.json(p);});
function productInput(body) {
  const {name,category,description,price,stock}=body;
  if(typeof name!=='string'||!name.trim()||name.length>100)fail('Enter a product name (up to 100 characters).');
  if(!['Stationery','Bags & Accessories','Lifestyle','Lab Essentials'].includes(category))fail('Choose a valid category.');
  if(typeof description!=='string'||!description.trim()||description.length>2000)fail('Enter a description (up to 2000 characters).');
  if(typeof price!=='number'||!Number.isFinite(price)||price<1||price>100000||!Number.isInteger(price))fail('Price must be a whole rupee amount between 1 and 100000.');
  if(!Number.isInteger(stock)||stock<0||stock>10000)fail('Stock must be between 0 and 10000.');
  return {name:name.trim(),category,description:description.trim(),price,stock};
}
app.post('/api/products',mutate(req=>{const p={...productInput(req.body),id:randomUUID(),icon:'notebook',color:'#dce3ce',tag:'NEW ARRIVAL'};state.products.push(p);return p;}));
app.put('/api/products/:id',mutate(req=>{const p=state.products.find(p=>p.id===req.params.id);if(!p)fail('Product not found.',404);Object.assign(p,productInput(req.body));return p;}));
app.delete('/api/products/:id',mutate(req=>{if(!state.products.some(p=>p.id===req.params.id))fail('Product not found.',404);state.products=state.products.filter(p=>p.id!==req.params.id);return {ok:true};}));
app.get('/api/orders',(req,res)=>res.json([...state.orders].reverse()));
app.post('/api/orders',mutate(req=>{
  const c=req.body.customer;
  if(!c||typeof c.name!=='string'||c.name.trim().length<2||c.name.length>100||typeof c.email!=='string'||c.email.length>150||!/^\S+@\S+\.\S+$/.test(c.email)||typeof c.address!=='string'||c.address.trim().length<10||c.address.length>500)fail('Enter your name, a valid email, and a delivery address of at least 10 characters.');
  const totals=priceOrder(req.body.items,state.products);
  const order={id:randomUUID(),customer:{name:c.name.trim(),email:c.email.trim().toLowerCase(),address:c.address.trim()},...totals,status:'Placed',createdAt:new Date().toISOString()};
  for(const line of totals.items)state.products.find(p=>p.id===line.productId).stock-=line.quantity;
  state.orders.push(order);return order;
}));
app.patch('/api/orders/:id',mutate(req=>{const o=state.orders.find(o=>o.id===req.params.id);if(!o)fail('Order not found.',404);const statuses=['Placed','Shipped','Delivered'];if(statuses.indexOf(req.body.status)!==statuses.indexOf(o.status)+1)fail('Orders must move from Placed to Shipped to Delivered.');o.status=req.body.status;return o;}));
app.use('/api',(req,res)=>res.status(404).json({message:'API route not found.'}));
app.use(express.static(path.resolve('dist')));
app.get('/{*path}',(req,res)=>res.sendFile(path.resolve('dist/index.html')));
app.use((err,req,res,next)=>{console.error(err.message);res.status(err.status||400).json({message:err.message||'Something went wrong.'});});
app.listen(process.env.PORT||3001,()=>console.log(`CampusCart API: http://localhost:${process.env.PORT||3001} (${mongo?'MongoDB':'local demo storage'})`));
