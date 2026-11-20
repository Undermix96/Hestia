class Component extends DCLogic {
  constructor(p){super(p);this.state={hi:null,edits:{},scene:null,ac:{s:'Caldo',c:'Caldo'},tab:1};}
  renderVals(){
    var self=this,st=this.state,sims=ROOMS.map(function(r,i){return sim(i,st);});
    var hi=st.hi,idx=hi!=null?hi:NOWI;
    function Y(v){return 76-(v-15)/9*72;}
    function rowPaths(s,arrT){var p='',f='';for(var i=0;i<NS;i++){var y=Y(s.T[i]).toFixed(1);if(i<=NOWI)p+=(i?'L':'M')+X(i)+' '+y;if(i>=NOWI)f+=(i===NOWI?'M':'L')+X(i)+' '+y;}
      var tg='',open=false,band='',seg=[];for(var q=0;q<=NS;q++){var v=q<NS?arrT[q]:null;if(v!=null){var yy=Y(v).toFixed(1);tg+=(open?'L':'M')+(q/NS*1000).toFixed(1)+' '+yy+'L'+((q+1)/NS*1000).toFixed(1)+' '+yy;open=true;seg.push(q);}else open=false;
        if((v==null||q===NS)&&seg.length){var t1='',b1='';seg.forEach(function(k,ii){t1+=(ii?'L':'M')+(k/NS*1000).toFixed(1)+' '+Y(arrT[k]+0.2).toFixed(1)+'L'+((k+1)/NS*1000).toFixed(1)+' '+Y(arrT[k]+0.2).toFixed(1);});for(var z=seg.length-1;z>=0;z--){var k2=seg[z];b1+='L'+((k2+1)/NS*1000).toFixed(1)+' '+Y(arrT[k2]-0.3).toFixed(1)+'L'+(k2/NS*1000).toFixed(1)+' '+Y(arrT[k2]-0.3).toFixed(1);}band+=t1+b1+'Z';seg=[];}}
      return {past:p,fut:f,tgt:tg,band:band};}
    function strip(arr,kind){return {n:kind==='rad'?'caloriferi':'clima',segs:runs(NS,function(i){return arr[i]+(i<NOWI?'p':'f');}).map(function(q){return {l:(q.s/NS*100).toFixed(3),w:((q.e-q.s)/NS*100).toFixed(3),bg:actBg(arr[q.s]),op:q.s>=NOWI?0.5:1};})};}
    function status(r,s,i){var out=[];if(r.rad){var a=s.ra[i];out.push({t:'caloriferi '+actTxt(a),dot:a==='heat'?C.heat:'#6A767F',shape:'2px',anim:a==='heat'?'pulse':''});}if(r.ac){var b=s.aa[i];out.push({t:'clima '+actTxt(b),dot:b==='heat'?C.heat:b==='cool'?C.cool:'#6A767F',shape:'50%',anim:(b==='heat'||b==='cool')?'pulse':''});}return out;}
    var rows=ROOMS.map(function(r,i){var s=sims[i],tg=[];for(var j=0;j<NS;j++)tg.push(s.rt[j]!=null?s.rt[j]:s.as[j]);var P=rowPaths(s,tg),strips=[];if(r.rad)strips.push(strip(s.ra,'rad'));if(r.ac)strips.push(strip(s.aa,'ac'));
      var tv=tg[idx];return {name:r.name,src:r.src,t:it(s.T[NOWI])+'°',st:status(r,s,NOWI),past:P.past,fut:P.fut,tgt:P.tgt,band:P.band,strips:strips,vt:it(s.T[idx])+'°',vtg:tv!=null?'target '+it(tv)+'°':'nessun target',vst:status(r,s,idx),nodata:false,hasData:true};});
    var bs=sims[4];rows.push({name:'Ripostiglio',src:'caloriferi del bagno',t:'—',st:[{t:'caloriferi '+actTxt(bs.ra[NOWI])+' (con bagno)',dot:bs.ra[NOWI]==='heat'?C.heat:'#6A767F',shape:'2px',anim:''}],past:'',fut:'',tgt:'',band:'',strips:[strip(bs.ra,'rad')],vt:'—',vtg:'nessun sensore',vst:[],nodata:true,hasData:false});
    var ot='',oh='';for(var k=0;k<NS;k++){ot+=(k?'L':'M')+X(k)+' '+(56-OUTM.T[k]/15*50).toFixed(1);oh+=(k?'L':'M')+X(k)+' '+(58-(OUTM.H[k]-50)/50*54).toFixed(1);}
    var heating=[],ranged=[],sum=0;ROOMS.forEach(function(r,i){var s=sims[i],src=[];if(r.rad&&s.ra[NOWI]==='heat')src.push('caloriferi');if(r.ac&&s.aa[NOWI]==='heat')src.push('clima');sum+=s.T[NOWI];if(src.length)heating.push(r.name+' ('+src.join(' + ')+')');else ranged.push(r.name);});
    var lead='In casa ci sono in media '+it(sum/5)+'°.',rest=(heating.length?'Stanno scaldando '+heating.join(', ')+'. ':'Nessun impianto sta scaldando. ')+(ranged.length?'Nel range: '+ranged.join(', ')+'.':'')+' Fuori '+it(OUTM.T[NOWI])+'°, previsti '+it(Math.max.apply(null,OUTM.T.slice(NOWI)))+'° nel pomeriggio.';
    var hv={on:hi!=null,x:hi!=null?((hi+0.5)/NS*100).toFixed(2):0,when:(idx<NOWI?'ore ':idx===NOWI?'adesso · ':'previsione · ')+fh(hAt(idx)),out:it(OUTM.T[idx])+'° · '+Math.round(OUTM.H[idx])+'%',
      move:function(e){var r=e.currentTarget.getBoundingClientRect();var k=Math.max(0,Math.min(NS-1,Math.floor((e.clientX-r.left)/r.width*NS)));if(k!==self.state.hi)self.setState({hi:k});},leave:function(){self.setState({hi:null});}};
    var xl=[0,8,16,24,32,40,47].map(function(i){return i===NOWI?'adesso':fh(hAt(i));});
    var navtabs=[['Casa','home'],['Storico','chart'],['Energia','bolt'],['Moduli','grid']].map(function(tb,i){return {label:tb[0],icon:ICON[tb[1]],cls:i===0?'navon':'',pick:function(){}};});
    return {rows:rows,lead:lead,rest:rest,hv:hv,xl:xl,oTemp:ot,oHum:oh,navtabs:navtabs,outNow:it(OUTM.T[NOWI])+'° · '+Math.round(OUTM.H[NOWI])+'%'};
  }
}
