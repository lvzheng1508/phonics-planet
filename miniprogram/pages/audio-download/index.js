const bundle = require('../../services/audio-bundle-service');
const labels = {idle:'准备好声音，随时开始学',downloading:'正在下载音频',verifying:'正在校验音频包',extracting:'正在安装到本地',ready:'全部音频已就绪',error:'暂时没有安装成功'};
Page({
  data:{status:'idle',heading:labels.idle,progress:0,count:0,total:0,size:'',busy:false,ready:false,error:'',checking:true},
  onLoad(){this.alive=true;this.off=bundle.subscribe(s=>{if(this.alive)this.setData({...s,heading:labels[s.status],busy:['downloading','verifying','extracting'].includes(s.status),size:(s.bytes/1000000).toFixed(2)});});},
  async onShow(){
    try{await bundle.inspect();}catch(error){if(this.alive)this.setData({error:'本地音频检查失败，请重试'});}
    finally{if(this.alive)this.setData({checking:false});}
  },
  async download(){if(this.data.busy||this.data.checking)return;try{await bundle.install();}catch(_){}},
  cancel(){bundle.cancel();},
  done(){if(getCurrentPages().length>1)wx.navigateBack();else wx.reLaunch({url:'/pages/home/index'});},
  logs(){wx.navigateTo({url:'/pages/logs/index'});},
  onUnload(){this.alive=false;if(this.off)this.off();bundle.cancel();}
});
