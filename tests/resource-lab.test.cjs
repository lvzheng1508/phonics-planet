const {test}=require('node:test');
const assert=require('node:assert/strict');
test('resource test page stops audio on hide and reports download errors', async()=>{
  let page;global.Page=p=>{page=p;};
  require('../miniprogram/pages/resource-test/index');
  assert.equal(typeof page.onHide,'function');
  const instance={...page,data:{...page.data},setData(value){Object.assign(this.data,value);}};
  instance.onLoad({id:"word_was"});
  assert.equal(instance.data.items[0].id,"word_was");
  assert.equal(instance.data.items[0].selected,true);
  assert.ok(instance.data.items[0].note.includes("AI"));
  assert.ok(instance.data.items.some(a=>a.id==="probe_i_mp3"));
  instance.onHide();
  assert.equal(instance.data.state,'idle');
  assert.ok(instance.data.items.length>0);
  await instance.download({currentTarget:{dataset:{id:'missing'}}});
  assert.ok(instance.data.message);
  instance.onUnload();
});
