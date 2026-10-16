import test from 'node:test';
import assert from 'node:assert/strict';
import {priceOrder} from './order.js';
const products=[{id:'a',name:'Notebook',price:149,stock:4}];
test('calculates trusted prices and delivery',()=>{assert.equal(priceOrder([{productId:'a',quantity:2,price:1}],products).total,347);});
test('free delivery at 499 or above',()=>assert.equal(priceOrder([{productId:'a',quantity:4}],products).shipping,0));
test('aggregates duplicates before checking stock',()=>assert.throws(()=>priceOrder([{productId:'a',quantity:3},{productId:'a',quantity:2}],products),/Only 4/));
test('rejects invalid quantities and missing products',()=>{for(const quantity of [0,-1,1.5,100])assert.throws(()=>priceOrder([{productId:'a',quantity}],products));assert.throws(()=>priceOrder([{productId:'missing',quantity:1}],products));assert.throws(()=>priceOrder([],products));});
