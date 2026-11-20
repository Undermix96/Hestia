function rng(seed){var s=seed;return function(){s=(s*16807)%2147483647;return (s-1)/2147483646;};}
function pad(n){return (n<10?'0':'')+n;}
function it(v){return v.toFixed(1).replace('.',',');}
function hx(c){return [1,3,5].map(function(i){return parseInt(c.slice(i,i+2),16);});}
function mix(a,b,t){t=Math.max(0,Math.min(1,t));var pa=hx(a),pb=hx(b);return 'rgb('+pa.map(function(v,i){return Math.round(v+(pb[i]-v)*t);}).join(',')+')';}
var NS,NOWI,PAST,FUT,START,OUTM,RANGE;
function hAt(i){return (((START+i*0.5)%24)+24)%24;}
function dAt(i){return Math.floor((START+i*0.5)/24);}
function fh(h){h=(h+24)%24;var m=Math.round((h%1)*60);return pad(Math.floor(h))+':'+pad(m);}
function setRange(r){if(r===RANGE)return;RANGE=r;if(r==='7g'){PAST=336;FUT=24;}else if(r==='split'){PAST=24;FUT=24;}else{PAST=48;FUT=4;}NS=PAST+FUT;NOWI=PAST;START=8.5-PAST*0.5;
  var g=rng(77),T=[],H=[];for(var i=0;i<NS;i++){var h=hAt(i),d=dAt(i);var t=6.5+(d<0?-d*0.3:0)+4.4*Math.sin((h-9)/24*2*Math.PI)+(i<NOWI?(g()-0.5)*0.6:0);T.push(t);H.push(Math.min(97,90-(t-3)*2.3+(i<NOWI?(g()-0.5)*4:0)));}OUTM={T:T,H:H};}
var ROOMS=[
  {name:'Soggiorno',src:'caloriferi + climatizzatore',rad:[[0,18.5],[6,21],[23,18.5]],ac:[[6,8.75,21.5],[16,22,21.5]],hum:47,seed:3,loss:0.032,acKey:'s',kw:0.8},
  {name:'Corridoio',src:'solo climatizzatore',ac:[[6,9,20.5],[16,23,20.5]],hum:49,seed:5,loss:0.03,acKey:'c',kw:0.5},
  {name:'Camera',src:'solo caloriferi',rad:[[0,17.5],[6,20],[8,18],[21,19.5],[23,17.5]],hum:51,seed:13,loss:0.028},
  {name:'Cameretta',src:'solo caloriferi',rad:[[0,18.5],[6,20.5],[8.5,19],[19,20],[23,18.5]],hum:50,seed:17,loss:0.028},
  {name:'Bagno',src:'caloriferi, insieme al ripostiglio',rad:[[0,19],[6,23],[9,20],[18,23],[22,19]],hum:60,seed:19,loss:0.036,bath:true}
];
function entryRad(list,h){var k=list.length-1;for(var i=0;i<list.length;i++)if(h>=list[i][0])k=i;return k;}
function entryAc(list,h){for(var i=0;i<list.length;i++)if(h>=list[i][0]&&h<list[i][1])return i;return -1;}
function sim(ri,st){var r=ROOMS[ri],g=rng(r.seed*13+1),T=null,rh=false,ah=false,o={T:[],H:[],rt:[],re:[],ra:[],as:[],ae:[],aa:[]},mode=r.acKey?st.ac[r.acKey]:null,ed=st.edits||{};
  for(var k=-96;k<NS;k++){var i=Math.max(0,k),h=hAt(k),fut=k>=NOWI,to=OUTM.T[i];
    var re=r.rad?entryRad(r.rad,h):-1,rt=r.rad?r.rad[re][1]:null,ae=r.ac?entryAc(r.ac,h):-1,as=(r.ac&&ae>=0&&mode!=='Spento')?r.ac[ae][2]:null;
    if(fut){var d1=ed[ri+':rad:'+re],d2=ed[ri+':ac:'+ae];if(rt!=null&&d1)rt+=d1;if(as!=null&&d2)as+=d2;}
    if(T==null)T=(rt||as||20);
    if(rt!=null){if(T<rt-0.3)rh=true;else if(T>rt+0.2)rh=false;}else rh=false;
    var a='off';if(as!=null){if(mode==='Freddo')a=T>as+0.3?'cool':'idle';else if(mode==='Deumid')a='dry';else{if(T<as-0.3)ah=true;else if(T>as+0.2)ah=false;a=ah?'heat':'idle';}}else ah=false;
    T+=(rh?0.42:0)+(a==='heat'?0.38:0)-(a==='cool'?0.35:0)+(fut?0:(g()-0.5)*0.05)-(T-(to*0.35+12))*r.loss;
    var hu=r.hum+2*Math.sin((h-4)/24*2*Math.PI)+(fut?0:(g()-0.5)*1.5);if(r.bath){if(h>=7.5&&h<8.5)hu+=14-(h-7.5)*6;if(h>=20&&h<21)hu+=10-(h-20)*6;}if(a==='heat')hu-=1.5;if(a==='dry')hu-=5;
    if(k>=0){o.T.push(T);o.H.push(hu);o.rt.push(rt);o.re.push(re);o.ra.push(rt==null?null:(rh?'heat':'idle'));o.as.push(as);o.ae.push(ae);o.aa.push(r.ac?a:null);}}
  return o;}
var C={heat:'#FF8A4C',cool:'#4FB3FF',dry:'#59D3B4',idle:'repeating-linear-gradient(135deg,#46525B 0 3px,#2A333A 3px 6px)',muted:'#98A3AB',tLo:'#3A5A8C',tHi:'#C2622E',ac:'#2E4A66'};
function actTxt(s){return s==='heat'?'scalda':s==='cool'?'raffredda':s==='idle'?'standby':s==='dry'?'deumidifica':'spento';}
function actBg(s){return s==='heat'?C.heat:s==='cool'?C.cool:s==='idle'?C.idle:s==='dry'?C.dry:'transparent';}
function actCol(s){return s==='heat'?C.heat:s==='cool'?C.cool:s==='dry'?C.dry:C.muted;}
function runs(n,key){var out=[],cur=null,s0=0;for(var i=0;i<=n;i++){var v=i<n?key(i):'__end';if(v!==cur){if(cur!==null)out.push({v:cur,s:s0,e:i});cur=v;s0=i;}}return out;}
function X(i){return ((i+0.5)/NS*1000).toFixed(1);}
var ICON={home:'M3 11l9-7 9 7v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z',all:'M4 5h16M4 10h16M4 15h16M4 20h16',bolt:'M13 2 4 14h7l-1 8 9-12h-7z',grid:'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'};
var DNAME=['dom','lun','mar','mer','gio','ven','sab'];
function dayLabel(d){var dt=new Date(2026,10,20+d);return DNAME[dt.getDay()]+' '+dt.getDate();}
