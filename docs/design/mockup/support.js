(function(){
  var comp,root,tpl=[];
  window.DCLogic=class{constructor(p){this.props=p||{};this.state={};}setState(o){Object.assign(this.state,o);schedule();}forceUpdate(){schedule();}};
  var pending=false;function schedule(){if(pending)return;pending=true;setTimeout(function(){pending=false;render();},0);}
  function get(p,s){p=p.trim();if(p==='true')return true;if(p==='false')return false;if(/^-?\d+(\.\d+)?$/.test(p))return +p;var v=s;var parts=p.split('.');for(var i=0;i<parts.length;i++){if(v==null)return undefined;v=v[parts[i]];}return v;}
  function interp(str,s){var m=str.match(/^\s*\{\{([^}]+)\}\}\s*$/);if(m)return get(m[1],s);return str.replace(/\{\{([^}]+)\}\}/g,function(a,p){var v=get(p,s);return v==null?'':v;});}
  function build(n,s,out){
    if(n.nodeType===3){out.appendChild(document.createTextNode(interp(n.nodeValue,s)));return;}
    if(n.nodeType!==1)return;
    var tag=n.localName;
    if(tag==='sc-for'){var list=interp(n.getAttribute('list'),s)||[],as=n.getAttribute('as');list.forEach(function(it,i){var c=Object.create(s);c[as]=it;c.$index=i;n.childNodes.forEach(function(k){build(k,c,out);});});return;}
    if(tag==='sc-if'){if(interp(n.getAttribute('value'),s))n.childNodes.forEach(function(k){build(k,s,out);});return;}
    var el=document.createElementNS(n.namespaceURI,n.localName);
    for(var i=0;i<n.attributes.length;i++){var a=n.attributes[i],nm=a.name;
      if(nm.indexOf('on')===0&&a.value.indexOf('{{')>=0){var fn=interp(a.value,s);if(typeof fn==='function')el.addEventListener(nm.slice(2),fn);continue;}
      if(nm.indexOf('hint-')===0)continue;
      var v=interp(a.value,s);if(v===false||v==null)continue;if(v===true)v='';el.setAttribute(nm,v);}
    n.childNodes.forEach(function(k){build(k,s,el);});out.appendChild(el);}
  function render(){var vals=comp.renderVals();root.innerHTML='';tpl.forEach(function(k){build(k,vals,root);});}
  document.addEventListener('DOMContentLoaded',function(){
    var x=document.querySelector('x-dc'),h=x.querySelector('helmet');
    if(h){Array.from(h.children).forEach(function(c){document.head.appendChild(c);});h.remove();}
    tpl=Array.from(x.childNodes);root=document.createElement('div');x.replaceWith(root);
    var code=document.querySelector('script[data-dc-script]').textContent;
    var C=new Function(code+'\nreturn Component;')();comp=new C({});if(comp.componentDidMount)comp.componentDidMount();render();window.__ready=true;});
})();
