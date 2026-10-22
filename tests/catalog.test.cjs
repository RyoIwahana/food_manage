const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const crypto=require('node:crypto');
const code=fs.readFileSync('dist/catalog.js','utf8')+'\n'+fs.readFileSync('dist/app.js','utf8');
function boot(saved,storage){
 const memory=storage||new Map(saved?[['kitchen-stock-v1',JSON.stringify(saved)]]:[]),elements=new Map();
 const element=s=>{if(!elements.has(s))elements.set(s,{style:{},classList:{toggle(){}},addEventListener(){},showModal(){},close(){},innerHTML:'',textContent:''});return elements.get(s)};
 const ctx=vm.createContext({document:{querySelector:element,querySelectorAll:()=>[]},localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},alert(){},setTimeout(){},clearTimeout(){},window:{},crypto,FormData:class{constructor(f){return new Map(Object.entries(f))}}});
 vm.runInContext(code,ctx);
 return {ctx,memory,element,run:s=>vm.runInContext(s,ctx),submit:values=>element('#form').onsubmit({preventDefault(){},target:values})};
}
test('101 unique items, user-confirmed ice cream and lid, unknown stock is not zero',()=>{
 const b=boot();assert.equal(b.run('activeItems().length'),101);assert.equal(b.run('new Set(ORDER_CATALOG.map(i=>i.id)).size'),101);assert.equal(b.run('low().length'),0);
 assert.equal(b.run("ORDER_CATALOG.find(i=>i.name==='ミニ雪見だいふく（白）').min"),6);assert.equal(b.run("ORDER_CATALOG.find(i=>i.name==='ミニ雪見だいふく（白）').unit"),'箱');
 assert.equal(b.run("ORDER_CATALOG.filter(i=>i.name==='カップ専用蓋').length"),1);assert.equal(b.run('activeItems().every(i=>i.stock===null&&i.price===null)'),true);
});
test('migration preserves old quantities, custom entries, orders and history; repeated reload is idempotent',()=>{
 const old={items:[{id:'i0',name:'トマト',stock:7,min:5,price:123,unit:'kg',supplier:'旧',category:'野菜'},{id:'custom',name:'自分の商品',stock:3,min:2,price:100,unit:'本',supplier:'自分',category:'独自'}],orders:[{id:'old-order',status:'発注済み',lines:[{id:'i0',qty:2,price:123}]}],history:[{name:'過去の履歴'}]};
 const b=boot(old);assert.equal(b.run('activeItems().length'),102);assert.equal(b.run('db.items[0].stock'),7);assert.equal(b.run('db.items[0].archived'),true);assert.equal(b.run('db.orders[0].id'),'old-order');assert.equal(b.run('db.history.length'),1);assert.equal(b.memory.get('kitchen-stock-v1-before-catalog'),JSON.stringify(old));
 const again=boot(null,b.memory);assert.equal(again.run('db.items.length'),103);assert.equal(again.run('db.items[1].archived'),undefined);
});
test('first stocktake, target-based replenishment, receive once, persistence',()=>{
 const b=boot();b.run("var item=db.items.find(i=>i.name==='ミニ雪見だいふく（白）');moveModal(item.id)");b.submit({qty:'2',type:'棚卸（実数に修正）',note:'テスト'});assert.equal(b.run('item.stock'),2);assert.equal(b.run('low().length'),1);assert.equal(b.run('db.history[0].qty'),null);
 b.run('orderModal(true)');assert.match(b.element('#fields').innerHTML,/value="4"/);const id=b.run('item.id');b.submit({[id]:'4'});assert.equal(b.run('db.orders[0].lines[0].qty'),4);assert.equal(b.run('orderTotal(db.orders[0])'),'金額未確定（単価未設定）');
 b.run('orderModal(true)');assert.match(b.element('#fields').innerHTML,/value="0"/);
 b.run('receive(db.orders[0].id)');b.submit({});assert.equal(b.run('item.stock'),6);assert.equal(b.run('low().length'),0);b.run('receive(db.orders[0].id)');assert.equal(b.run('item.stock'),6);
 const again=boot(null,b.memory);assert.equal(again.run("db.items.find(i=>i.name==='ミニ雪見だいふく（白）').stock"),6);
});
test('unknown stock cannot be received or consumed as zero; overdraw is rejected',()=>{
 const b=boot();b.run('var item=db.items[0];moveModal(item.id)');b.submit({qty:'1',type:'出庫（使用）',note:''});assert.equal(b.run('item.stock'),null);
 b.run("db.orders.push({id:'test',supplier:'リクエ',status:'発注済み',lines:[{id:item.id,name:item.name,qty:1,price:null}]});receive('test')");assert.equal(b.run('db.orders[0].status'),'発注済み');assert.match(b.element('#toast').textContent,/棚卸/);
 b.run('moveModal(item.id)');b.submit({qty:'1',type:'棚卸（実数に修正）',note:''});b.run('moveModal(item.id)');b.submit({qty:'2',type:'出庫（使用）',note:''});assert.equal(b.run('item.stock'),1);
});
