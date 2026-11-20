function yT(v){return 252-(v-14)/11*244;}function yH(v){return 252-(v-30)/50*244;}function yO(v){return 74-v/15*68;}function yOH(v){return 76-(v-50)/50*72;}
function nextChange(r,ri,st){var h=8.6,best=null,ed=st.edits||{};function cand(t,label){var d=(t-h+24)%24;if(d>0&&(best==null||d<best.d))best={d:d,t:t,label:label};}
  if(r.rad)r.rad.forEach(function(e,k){cand(e[0],'il target dei caloriferi passa a '+it(e[1]+(ed[ri+':rad:'+k]||0))+'°');});
  if(r.ac&&st.ac[r.acKey]!=='Spento')r.ac.forEach(function(e,k){cand(e[0],'il climatizzatore si accende a '+it(e[2]+(ed[ri+':ac:'+k]||0))+'°');cand(e[1],'il climatizzatore si spegne');});
  return best;}
class Component extends DCLogic {
  constructor(p){super(p);this.state={room:0,hi:null,edits:{},sel:null,range:'24h',ac:{s:'Caldo',c:'Caldo'},tab:0};}
  renderVals(){
    var self=this,st=this.state;
    setRange('24h');var es=[0,1].map(function(k){return sim(k,st);});var kwh=0,kwNow=0;[0,1].forEach(function(k){var s=es[k];for(var z=0;z<NOWI;z++){var a=s.aa[z];kwh+=(a==='heat'||a==='cool')?ROOMS[k].kw*0.5:a==='idle'?0.02:0;}var a2=s.aa[NOWI];kwNow+=(a2==='heat'||a2==='cool')?ROOMS[k].kw:a2==='idle'?0.04:0;});
    var energy={now:it(kwNow),day:it(kwh),eur:it(kwh*0.28)};
    setRange(st.range);
    var sims=ROOMS.map(function(r,i){return sim(i,st);}),ri=st.room,R=ROOMS[ri],S=sims[ri],is7=st.range==='7g';
    var past='',fut='',hl='',ot='',oh='';for(var i=0;i<NS;i++){var y=yT(S.T[i]).toFixed(1);if(i<=NOWI)past+=(i?'L':'M')+X(i)+' '+y;if(i>=NOWI)fut+=(i===NOWI?'M':'L')+X(i)+' '+y;hl+=(i?'L':'M')+X(i)+' '+yH(S.H[i]).toFixed(1);ot+=(i?'L':'M')+X(i)+' '+yO(OUTM.T[i]).toFixed(1);oh+=(i?'L':'M')+X(i)+' '+yOH(OUTM.H[i]).toFixed(1);}
    var tg=[];for(var j=0;j<NS;j++)tg.push(S.rt[j]!=null?S.rt[j]:S.as[j]);
    var tgt='',open=false,band='',seg=[];for(var q=0;q<=NS;q++){var v=q<NS?tg[q]:null;if(v!=null){var yy=yT(v).toFixed(1);tgt+=(open?'L':'M')+(q/NS*1000).toFixed(1)+' '+yy+'L'+((q+1)/NS*1000).toFixed(1)+' '+yy;open=true;seg.push(q);}else open=false;
      if((v==null||q===NS)&&seg.length){var t1='',b1='';seg.forEach(function(k,ii){t1+=(ii?'L':'M')+(k/NS*1000).toFixed(1)+' '+yT(tg[k]+0.2).toFixed(1)+'L'+((k+1)/NS*1000).toFixed(1)+' '+yT(tg[k]+0.2).toFixed(1);});for(var z=seg.length-1;z>=0;z--){var k2=seg[z];b1+='L'+((k2+1)/NS*1000).toFixed(1)+' '+yT(tg[k2]-0.3).toFixed(1)+'L'+(k2/NS*1000).toFixed(1)+' '+yT(tg[k2]-0.3).toFixed(1);}band+=t1+b1+'Z';seg=[];}}
    var minW=is7?2.2:6;
    function progLane(kind){var arrE=kind==='rad'?S.re:S.ae,arrV=kind==='rad'?S.rt:S.as;
      return runs(NS,function(i){return arrE[i]+'|'+(arrV[i]==null?'x':arrV[i].toFixed(2));}).map(function(q){var e=arrE[q.s],val=arrV[q.s],key=ri+':'+kind+':'+e,selOn=st.sel&&st.sel.key===key,edited=!!st.edits[key]&&q.e>NOWI,canEdit=e>=0&&q.e>NOWI;
        var w=(q.e-q.s)/NS*100;return {l:(q.s/NS*100).toFixed(3),w:w.toFixed(3),bg:val==null?'transparent':(kind==='rad'?mix(C.tLo,C.tHi,(val-17)/6):C.ac),t:val==null?'':(w>minW?it(val)+'°':''),ring:selOn?'0 0 0 2px #0E1215, 0 0 0 4px #EEF2F4':(edited?'inset 0 0 0 2px #151A1E':'none'),z:selOn?3:1,cur:canEdit?'pointer':'default',
          label:(kind==='rad'?'Caloriferi ':'Climatizzatore ')+(val==null?'non programmato':it(val)+'°')+(canEdit?' · modifica':' (passato)'),
          pick:canEdit?function(){self.setState({sel:{key:key,kind:kind,e:e,ri:ri}});}:function(){}};});}
    function actLane(kind){var arr=kind==='rad'?S.ra:S.aa;return runs(NS,function(i){return arr[i]+(i<NOWI?'p':'f');}).map(function(q){return {l:(q.s/NS*100).toFixed(3),w:((q.e-q.s)/NS*100).toFixed(3),bg:actBg(arr[q.s]),op:q.s>=NOWI?0.5:1};});}
    var lanes=[];if(R.rad)lanes.push({n:'Caloriferi',prog:progLane('rad'),act:actLane('rad')});if(R.ac)lanes.push({n:'Climatizzatore',prog:progLane('ac'),act:actLane('ac')});
    var hi=st.hi!=null&&st.hi<NS?st.hi:null,idx=hi!=null?hi:NOWI,units=[];
    if(R.rad)units.push({n:'Caloriferi',p:'target '+it(S.rt[idx])+'°',a:actTxt(S.ra[idx]),c:actCol(S.ra[idx])});
    if(R.ac)units.push({n:'Climatizzatore',p:S.as[idx]!=null?'set '+it(S.as[idx])+'°':'non programmato',a:actTxt(S.aa[idx]),c:actCol(S.aa[idx])});
    var nowX=((NOWI+0.5)/NS*100).toFixed(2),xl=[{t:'adesso',l:nowX,c:'#FF8A4C'}];
    for(var k3=0;k3<NS;k3++){var hh=hAt(k3),pos=(k3+0.5)/NS*100;if(Math.abs(pos-nowX)<5)continue;if(is7){if(hh===0)xl.push({t:dayLabel(dAt(k3)),l:(k3/NS*100).toFixed(2),c:'#98A3AB'});}else if(hh%4===0)xl.push({t:fh(hh),l:pos.toFixed(2),c:'#98A3AB'});}
    var g={past:past,fut:fut,humLine:hl,humArea:hl+'L'+X(NS-1)+' 260L'+X(0)+' 260Z',tgt:tgt,band:band,oTemp:ot,oHum:oh,oHumArea:oh+'L'+X(NS-1)+' 80L'+X(0)+' 80Z',lanes:lanes,xl:xl,nowX:nowX,
      yT:[24,22,20,18,16].map(function(v){return {v:v,top:(yT(v)/260*100).toFixed(2)};}),
      hasHover:hi!=null,hx:hi!=null?((hi+0.5)/NS*100).toFixed(2):0,hy:yT(S.T[idx]),shift:hi!=null&&(hi+0.5)/NS>0.6?'calc(-100% - 14px)':'14px',
      tip:{when:(idx<NOWI?(is7?dayLabel(dAt(idx))+' · ':'ore '):idx===NOWI?'adesso · ':'previsione · ')+fh(hAt(idx)),t:it(S.T[idx])+'°',h:Math.round(S.H[idx])+'%',units:units,o:it(OUTM.T[idx])+'°',oh:Math.round(OUTM.H[idx])+'%'},
      move:function(e){var r=e.currentTarget.getBoundingClientRect();var k=Math.max(0,Math.min(NS-1,Math.floor((e.clientX-r.left)/r.width*NS)));if(k!==self.state.hi)self.setState({hi:k});},leave:function(){self.setState({hi:null});}};
    var ranges=[['24h','24 ore'],['7g','7 giorni']].map(function(r){return {label:r[1],cls:st.range===r[0]?'segon':'',pick:function(){self.setState({range:r[0],hi:null});}};});
    var nc=nextChange(R,ri,st),parts=[],tn=S.T[NOWI];
    parts.push(R.name+' è a '+it(tn)+'°.');
    if(R.rad){var ra=S.ra[NOWI],rt=S.rt[NOWI];parts.push(ra==='heat'?'I caloriferi stanno scaldando verso '+it(rt)+'°'+(tn>rt+0.2?', tra poco vanno in standby.':'.'):(tn>rt+0.2?'I caloriferi sono fermi: la stanza è sopra il target di '+it(rt)+'°.':'I caloriferi sono in standby: '+it(tn)+'° è dentro il range '+it(rt-0.3)+'–'+it(rt+0.2)+'°.'));}
    if(R.ac){var aa=S.aa[NOWI],as=S.as[NOWI];parts.push(as==null?'Il climatizzatore non è programmato adesso.':(aa==='heat'?'Il climatizzatore scalda verso '+it(as)+'°.':aa==='cool'?'Il climatizzatore raffredda verso '+it(as)+'°.':'Il climatizzatore è acceso ma in standby, set '+it(as)+'°.'));}
    if(nc)parts.push('Alle '+fh(nc.t)+' '+nc.label+'.');
    var hero={lead:parts[0],rest:parts.slice(1).join(' '),fc:'Umidità '+Math.round(S.H[NOWI])+'% · fuori '+it(OUTM.T[NOWI])+'° e '+Math.round(OUTM.H[NOWI])+'%.'};
    var tabs=ROOMS.map(function(r,i){var s=sims[i],stl=[];function one(kind,a){var on=a==='heat'||a==='cool';stl.push({t:(kind==='rad'?'caloriferi ':'clima ')+actTxt(a),dot:a==='heat'?C.heat:a==='cool'?C.cool:'#6A767F',shape:kind==='rad'?'2px':'50%',anim:on?'pulse':''});}
      if(r.rad)one('rad',s.ra[NOWI]);if(r.ac)one('ac',s.aa[NOWI]);return {name:r.name,t:it(s.T[NOWI]),st:stl,cls:st.room===i?'tabon':'',pressed:st.room===i?'true':'false',pick:function(){self.setState({room:i,sel:null,hi:null});}};});
    var ed={show:false};if(st.sel&&st.sel.ri===ri){var sl=st.sel,base,from,to;if(sl.kind==='rad'){var L2=R.rad;base=L2[sl.e][1];from=L2[sl.e][0];to=L2[(sl.e+1)%L2.length][0];}else{base=R.ac[sl.e][2];from=R.ac[sl.e][0];to=R.ac[sl.e][1];}
      var d=st.edits[sl.key]||0;function bump(x){var e2=Object.assign({},self.state.edits);var nv=Math.max(-4,Math.min(4,(e2[sl.key]||0)+x));if(nv===0)delete e2[sl.key];else e2[sl.key]=nv;self.setState({edits:e2});}
      ed={show:true,title:(sl.kind==='rad'?'Caloriferi':'Climatizzatore')+' · fascia '+fh(from)+'–'+fh(to),val:it(base+d)+'°',note:d?('programma '+it(base)+'° · modificato '+(d>0?'+':'')+it(d)+'° da adesso in poi'):'la modifica vale da adesso in poi; il passato resta com’è',inc:function(){bump(0.5);},dec:function(){bump(-0.5);},reset:function(){var e2=Object.assign({},self.state.edits);delete e2[sl.key];self.setState({edits:e2});},close:function(){self.setState({sel:null});}};}
    var DAYS=['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
    var week=DAYS.map(function(dn,di){var wk=di>=5,segs=[],acs=[];
      if(R.rad){R.rad.forEach(function(e,k){var s0=e[0],s1=k<R.rad.length-1?R.rad[k+1][0]:24;if(wk&&e[0]===6)s0=7.5;if(wk&&k<R.rad.length-1&&R.rad[k+1][0]===6)s1=7.5;segs.push({l:(s0/24*100).toFixed(2),w:((s1-s0)/24*100).toFixed(2),bg:mix(C.tLo,C.tHi,(e[1]-17)/6),t:(s1-s0)>=3?it(e[1]):''});});}
      if(R.ac)R.ac.forEach(function(e){var s0=wk&&e[0]===6?7.5:e[0];acs.push({l:(s0/24*100).toFixed(2),w:((e[1]-s0)/24*100).toFixed(2)});});
      return {d:dn,fw:di===4?'800':'500',segs:segs,acs:acs,hasRad:!!R.rad,hasAc:!!R.ac};});
    var modes=R.ac?['Caldo','Freddo','Deumid','Spento'].map(function(x){return {l:x==='Deumid'?'Deumidifica':x,cls:st.ac[R.acKey]===x?'mchipon':'',pick:function(){var m=Object.assign({},self.state.ac);m[R.acKey]=x;self.setState({ac:m});}};}):[];
    return {g:g,ranges:ranges,hero:hero,tabs:tabs,ed:ed,energy:energy,week:week,modes:modes,hasAc:!!R.ac,roomName:R.name,src:R.src,outNow:it(OUTM.T[NOWI])+'° · '+Math.round(OUTM.H[NOWI])+'%'};
  }
}
