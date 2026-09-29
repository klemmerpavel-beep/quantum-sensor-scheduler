
(function(){
"use strict";
/* ---------- formatting ---------- */
const nf0=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0});
const nf1=new Intl.NumberFormat('ru-RU',{minimumFractionDigits:1,maximumFractionDigits:1});
const nf2=new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2});
const f0=v=>nf0.format(v), f1=v=>nf1.format(v), f2=v=>nf2.format(v);
const trim=s=>s.replace(/,0$/,'');
const fK=v=>v>=1e6?trim(f1(v/1e6))+' млн':v>=1e4?f0(v/1e3)+' тыс.':v>=1e3?trim(f1(v/1e3))+' тыс.':f0(v);
const sgn=v=>(v>0?'+':v<0?'−':'')+f0(Math.abs(v));

/* ---------- svg helpers ---------- */
const NS='http://www.w3.org/2000/svg';
function S(tag,attrs,parent){const e=document.createElementNS(NS,tag);if(attrs)for(const k in attrs)e.setAttribute(k,attrs[k]);if(parent)parent.appendChild(e);return e;}
function T(parent,x,y,str,cls,anchor){const t=S('text',{x:x,y:y,class:cls||'t2'},parent);if(anchor)t.setAttribute('text-anchor',anchor);t.textContent=str;return t;}
const mctx=document.createElement('canvas').getContext('2d');
function tw(s,px,wt){mctx.font=(wt||400)+' '+(px||12)+'px "Golos Text", system-ui, sans-serif';return mctx.measureText(s).width;}
function svgFor(root,w,h,label){root.replaceChildren();return S('svg',{width:w,height:h,viewBox:'0 0 '+w+' '+h,role:'img','aria-label':label||''},root);}
function hbarPath(x0,x1,y,h,r){
  const w=Math.abs(x1-x0); if(w<0.5) return '';
  r=Math.min(r==null?4:r,w,h/2);
  if(x1>=x0) return 'M'+x0+','+y+'H'+(x1-r)+'Q'+x1+','+y+' '+x1+','+(y+r)+'V'+(y+h-r)+'Q'+x1+','+(y+h)+' '+(x1-r)+','+(y+h)+'H'+x0+'Z';
  return 'M'+x0+','+y+'H'+(x1+r)+'Q'+x1+','+y+' '+x1+','+(y+r)+'V'+(y+h-r)+'Q'+x1+','+(y+h)+' '+(x1+r)+','+(y+h)+'H'+x0+'Z';
}
const px=v=>Math.round(v)+.5;

/* ---------- tooltip ---------- */
const tip=document.getElementById('tip');
function place(x,y){const w=tip.offsetWidth,h=tip.offsetHeight;let L=x+14,Tp=y-h-12;if(L+w>innerWidth-8)L=Math.max(8,x-w-14);if(Tp<8)Tp=y+18;tip.style.left=L+'px';tip.style.top=Tp+'px';}
function hide(){tip.hidden=true;}
function bindTip(node,title,rows){
  node.setAttribute('tabindex','0');
  node.setAttribute('class',(node.getAttribute('class')||'')+' hit');
  node.setAttribute('aria-label',title+': '+rows.map(r=>r.l+' '+r.v).join('; '));
  function show(x,y){
    tip.replaceChildren();
    const h=document.createElement('div');h.className='tt';h.textContent=title;tip.appendChild(h);
    rows.forEach(r=>{const d=document.createElement('div');d.className='tr';
      if(r.k){const k=document.createElement('i');k.className='tk';k.style.background='var('+r.k+')';d.appendChild(k);}
      const b=document.createElement('b');b.textContent=r.v;const s=document.createElement('span');s.textContent=r.l;d.append(b,s);tip.appendChild(d);});
    tip.hidden=false;place(x,y);
  }
  node.addEventListener('pointerenter',e=>show(e.clientX,e.clientY));
  node.addEventListener('pointermove',e=>place(e.clientX,e.clientY));
  node.addEventListener('pointerleave',hide);
  node.addEventListener('focus',()=>{const r=node.getBoundingClientRect();show(r.left+r.width/2,r.top+8);});
  node.addEventListener('blur',hide);
}
addEventListener('scroll',hide,{passive:true});

/* ---------- generic horizontal bar ---------- */
function hbar(root,o){
  const W=Math.floor(root.clientWidth); if(!W) return;
  const narrow=W<(o.narrowAt||380);
  const rows=o.rows, base=o.base==null?o.min:o.base;
  const labW=narrow?0:Math.min(Math.max.apply(null,rows.map(r=>tw(r.l,12.5,500)))+14,W*0.42);
  const valW=Math.max.apply(null,rows.map(r=>tw(o.vf(r),12,600)))+10;
  const barH=o.barH||14, rowH=(o.rowH||30)+(narrow?16:0);
  const top=o.ref!=null?20:4, axisH=o.ticks?20:4;
  const H=top+rows.length*rowH+axisH;
  const x0=labW, x1=W-valW-(o.valCol?4:0);
  const sx=v=>x0+(v-o.min)/(o.max-o.min)*(x1-x0);
  const svg=svgFor(root,W,H,o.aria);
  const yEnd=top+rows.length*rowH;
  if(o.ticks) o.ticks.forEach(t=>{const x=px(sx(t));S('line',{x1:x,x2:x,y1:top-2,y2:yEnd,class:'l-grid'},svg);T(svg,x,H-5,o.tf?o.tf(t):f0(t),'t3','middle');});
  const bx=px(sx(base));S('line',{x1:bx,x2:bx,y1:top-2,y2:yEnd,class:'l-axis'},svg);
  if(o.ref!=null){const x=px(sx(o.ref));S('line',{x1:x,x2:x,y1:top-8,y2:yEnd,class:'l-ref'},svg);T(svg,x+4,top-8,o.refLabel,'t3');}
  rows.forEach((r,i)=>{
    const y=top+i*rowH, lab=narrow?16:0, by=y+lab+(rowH-lab-barH)/2;
    const g=S('g',null,svg);
    if(narrow) T(g,0,y+13,r.l,'t1 halo'); else T(g,x0-10,by+barH/2+4,r.l,'t1','end');
    const xb=sx(base), xe=sx(r.v);
    const d=hbarPath(xb,xe,by,barH,4);
    if(d) S('path',{d:d,class:'mark '+(r.cls||'f-acc')},g);
    else S('rect',{x:xb-1,y:by,width:2,height:barH,class:'mark '+(r.cls||'f-acc')},g);
    if(o.valCol) T(g,W,by+barH/2+4,o.vf(r),'tv','end');
    else T(g,Math.max(xe,xb)+6,by+barH/2+4,o.vf(r),'tv','start');
    S('rect',{x:0,y:y,width:W,height:rowH,class:'hitbox'},g);
    bindTip(g,r.tt||r.l,r.tip||[{v:o.vf(r),l:''}]);
  });
}

/* ---------- 1. ratio chart ---------- */
function drawIndex(root){
  const R=[
    {l:'Зрители',a:9974,b:277443,fa:f0,fb:f0},
    {l:'Просмотры Reels',a:15000,b:375000,fa:fK,fb:fK},
    {l:'Просмотры, всего',a:16751,b:376977,fa:f0,fb:f0},
    {l:'Взаимодействия',a:223,b:4980,fa:f0,fb:v=>'≈'+f0(v)},
    {l:'Вовлечённость',a:223/16751*100,b:4980/376977*100,fa:v=>f2(v)+'%',fb:v=>f2(v)+'%'},
    {l:'Просмотры постов',a:1600,b:1100,fa:fK,fb:fK}
  ].map(r=>{const v=r.b/r.a;return {l:r.l,v:v,cls:v>1.05?'f-pos':v<0.95?'f-neg':'f-flat',
    tip:[{v:r.fb(r.b),l:'06.08–06.09'},{v:r.fa(r.a),l:'06.07–06.08'},{v:'×'+f1(v),l:'кратность'}]};});
  hbar(root,{rows:R,min:0,max:30,ticks:[0,10,20,30],tf:t=>'×'+t,ref:1,refLabel:'×1',
    vf:r=>'×'+f1(r.v),barH:14,rowH:30,narrowAt:300,aria:'Кратность изменения показателей: зрители ×27,8; Reels ×25; просмотры ×22,5; взаимодействия ×22,3; вовлечённость ×1,0; посты ×0,7'});
}

/* ---------- 2. net followers ---------- */
function drawNet(root){
  const R=[
    {l:'06.07–06.08',v:-16,p:'−0,4%',cls:'f-neg'},
    {l:'06.08–06.09',v:69,p:'+1,6%',cls:'f-pos'}
  ].map(r=>Object.assign(r,{tip:[{v:sgn(r.v),l:'подписчиков'},{v:r.p,l:'к базе на начало периода'}]}));
  hbar(root,{rows:R,min:-20,max:80,base:0,ticks:[-20,0,20,40,60,80],tf:t=>t<0?'−'+Math.abs(t):String(t),
    vf:r=>sgn(r.v)+' · '+r.p,valCol:true,barH:16,rowH:36,narrowAt:340,
    aria:'Чистый прирост подписчиков: 06.07–06.08 минус 16; 06.08–06.09 плюс 69'});
}

/* ---------- 3. per-1000 pairs ---------- */
function drawPairs(root){
  const rows=[
    {l:'Отправки',a:2400/330,b:157/71,s:'развл. ×3,3',aa:'2,4 тыс.',ba:'157'},
    {l:'Лайки',a:1500/330,b:462/71,s:'эксп. ×1,4',aa:'1,5 тыс.',ba:'462'},
    {l:'Комментарии',a:12/330,b:64/71,s:'эксп. ×24,8',aa:'12',ba:'64'},
    {l:'Репосты',a:19/330,b:16/71,s:'эксп. ×3,9',aa:'19',ba:'16'},
    {l:'Подписки',a:null,b:138/71,s:'только эксп.',aa:'немного',ba:'138+'}
  ];
  const W=Math.floor(root.clientWidth); if(!W) return;
  const narrow=W<300;
  const fv=v=>v==null?'н/д':(v<0.1?f2(v):f1(v));
  const labW=narrow?0:Math.min(Math.max.apply(null,rows.map(r=>Math.max(tw(r.l,12.5,500),tw(r.s,11))))+14,W*0.4);
  const valW=Math.max.apply(null,rows.map(r=>Math.max(tw(fv(r.a),12,600),tw(fv(r.b),12,600))))+10;
  const barH=10,gap=2,pairH=barH*2+gap,lab=narrow?30:0,rowH=lab+Math.max(pairH,32)+10;
  const H=rows.length*rowH;
  const x0=labW,x1=W-valW;
  const svg=svgFor(root,W,H,'Действия на 1000 просмотров: развлекательный ролик против экспертного');
  S('line',{x1:px(x0),x2:px(x0),y1:0,y2:H-6,class:'l-axis'},svg);
  rows.forEach((r,i)=>{
    const y=i*rowH, by=y+lab+(rowH-lab-pairH)/2-2;
    const g=S('g',null,svg);
    if(narrow){T(g,0,y+13,r.l,'t1');T(g,0,y+27,r.s,'t3');}
    else{T(g,x0-10,by+pairH/2-1,r.l,'t1','end');T(g,x0-10,by+pairH/2+13,r.s,'t3','end');}
    const m=Math.max(r.a||0,r.b);
    const sx=v=>x0+v/m*(x1-x0);
    if(r.a==null){T(g,x0+6,by+barH-1,'немного · н/д','t3');}
    else{S('path',{d:hbarPath(x0,sx(r.a),by,barH,4),class:'mark f-ent'},g);T(g,sx(r.a)+6,by+barH-1,fv(r.a),'tv');}
    S('path',{d:hbarPath(x0,sx(r.b),by+barH+gap,barH,4),class:'mark f-exp'},g);
    T(g,sx(r.b)+6,by+barH*2+gap-1,fv(r.b),'tv');
    S('rect',{x:0,y:y,width:W,height:rowH,class:'hitbox'},g);
    bindTip(g,r.l+' на 1 000 просмотров',[
      {v:fv(r.a),l:'развлекательный (всего '+r.aa+')',k:'--s-ent'},
      {v:fv(r.b),l:'экспертный (всего '+r.ba+')',k:'--s-exp'}]);
  });
}

/* ---------- 4. ladder (log dot plot) ---------- */
const TYPE={exp:{c:'f-exp',n:'экспертный',k:'--s-exp'},ent:{c:'f-ent',n:'развлекательный',k:'--s-ent'},oth:{c:'f-oth',n:'тип не указан',k:'--s-other'},rev:{c:'f-oth',n:'обзорный',k:'--s-other'}};
function drawLadder(root){
  const rows=[
    {l:'«Чтобы не оказаться „тем самым“…»',g:'плитка',v:330000,t:'ent'},
    {l:'«Цена услуг за квадратный метр»',v:71000,t:'exp'},
    {l:'«Видео носит исключительно…»',g:'Андрей в кадре',v:3100,t:'oth'},
    {l:'«Если у вас есть квартира…»',g:'Андрей в кадре',v:2300,t:'oth'},
    {l:'«Лестница за 1 000 000 ₽»',g:'Андрей в кадре',v:1800,t:'oth'},
    {l:'«Маньяк уже не так страшен…»',g:'проба',v:1700,t:'ent'},
    {l:'«Делимся с вами…»',g:'проба',v:1600,t:'rev'},
    {l:'«Вопрос-ответ»',g:'с основателем',v:1500,t:'exp'},
    {l:'«Если кратко — всё на нас…»',g:'проба',v:546,t:'exp'},
    {l:'«На объекте нужен?…»',g:'проба',v:501,t:'ent'},
    {l:'«Один из тех случаев…»',g:'проба',v:486,t:'exp'},
    {l:'«Сколько стоит ремонт?…»',g:'проба',v:467,t:'exp'},
    {l:'«Сэкономить клиенту миллион»',g:'≈',v:460,t:'oth'}
  ];
  const W=Math.floor(root.clientWidth); if(!W) return;
  const narrow=W<560;
  const lw=r=>tw(r.l,12.5,500)+(r.g?tw('  '+r.g,11):0);
  const labW=narrow?0:Math.min(Math.max.apply(null,rows.map(lw))+16,W*0.5);
  const rowH=narrow?40:26, top=22, axisH=22;
  const H=top+rows.length*rowH+axisH;
  const x0=labW+8, x1=W-60;
  const lg=Math.log10, sx=v=>x0+(lg(v)-2)/(lg(5e5)-2)*(x1-x0);
  const svg=svgFor(root,W,H,'Просмотры роликов на логарифмической шкале');
  const yEnd=top+rows.length*rowH;
  S('rect',{x:sx(300),y:top-4,width:sx(600)-sx(300),height:yEnd-top+4,class:'f-band'},svg);
  T(svg,(sx(300)+sx(600))/2,top-8,'база 300–600','t3','middle');
  [[100,'100'],[1e3,'1 тыс.'],[1e4,'10 тыс.'],[1e5,'100 тыс.']].forEach(t=>{
    const x=px(sx(t[0]));S('line',{x1:x,x2:x,y1:top-4,y2:yEnd,class:'l-grid'},svg);T(svg,x,H-5,t[1],'t3','middle');});
  rows.forEach((r,i)=>{
    const y=top+i*rowH, cy=narrow?y+rowH-11:y+rowH/2;
    const g=S('g',null,svg);
    S('line',{x1:x0,x2:x1,y1:px(cy),y2:px(cy),class:'l-grid'},g);
    const tt=S('text',{x:narrow?0:x0-12,y:narrow?y+13:cy+4,class:'t1'},g);
    if(!narrow) tt.setAttribute('text-anchor','end');
    const a=S('tspan',null,tt);a.textContent=r.l;
    if(r.g&&r.g!=='≈'){const b=S('tspan',{class:'t3'},tt);b.textContent='  '+r.g;}
    const cx=sx(r.v);
    S('circle',{cx:cx,cy:cy,r:5,class:'mark ring '+TYPE[r.t].c},g);
    T(g,cx+10,cy+4,(r.g==='≈'?'≈':'')+fK(r.v),'tv');
    S('rect',{x:0,y:y,width:W,height:rowH,class:'hitbox'},g);
    bindTip(g,r.l,[{v:(r.g==='≈'?'≈':'')+f0(r.v),l:'просмотров',k:TYPE[r.t].k},{v:TYPE[r.t].n,l:r.g&&r.g!=='≈'?r.g:''}]);
  });
}

/* ---------- 5. trials (range dots) ---------- */
function drawTrials(root){
  const rows=[
    {l:'«Маньяк уже не так страшен…»',t:'ent',v:[1700,258],r:'×6,6'},
    {l:'«Если кратко — всё на нас…»',t:'exp',v:[546,137,114],r:'×4,8'},
    {l:'«Один из тех случаев…»',t:'exp',v:[486,178],r:'×2,7',n:'с отзывом клиента'},
    {l:'«На объекте нужен?…»',t:'ent',v:[501,298,195],r:'×2,6'},
    {l:'«Делимся с вами…»',t:'rev',v:[1600,832],r:'×1,9'},
    {l:'«Сколько стоит ремонт?…»',t:'exp',v:[467,13,0],r:'—',n:'аномалия'}
  ];
  const W=Math.floor(root.clientWidth); if(!W) return;
  const narrow=W<560;
  const sub=r=>'версии: '+r.v.map(f0).join(' / ')+(r.n?' · '+r.n:'');
  const labW=narrow?0:Math.min(Math.max.apply(null,rows.map(r=>Math.max(tw(r.l,12.5,500),tw(sub(r),11))))+16,W*0.48);
  const rowH=narrow?54:40, top=22, axisH=22, rW=46;
  const H=top+rows.length*rowH+axisH;
  const x0=labW+10, x1=W-rW-8;
  const sx=v=>x0+v/1800*(x1-x0);
  const svg=svgFor(root,W,H,'Просмотры версий пробных публикаций');
  const yEnd=top+rows.length*rowH;
  S('rect',{x:sx(300),y:top-4,width:sx(600)-sx(300),height:yEnd-top+4,class:'f-band'},svg);
  T(svg,(sx(300)+sx(600))/2,top-8,'база 300–600','t3','middle');
  [0,500,1000,1500].forEach(t=>{const x=px(sx(t));S('line',{x1:x,x2:x,y1:top-4,y2:yEnd,class:t===0?'l-axis':'l-grid'},svg);T(svg,x,H-5,f0(t),'t3','middle');});
  T(svg,W,top-8,'лучш./худш.','t3','end');
  rows.forEach((r,i)=>{
    const y=top+i*rowH, cy=narrow?y+rowH-13:y+rowH/2;
    const g=S('g',null,svg);
    if(narrow){T(g,0,y+13,r.l,'t1');T(g,0,y+27,sub(r),'t3');}
    else{T(g,x0-14,cy-2,r.l,'t1','end');T(g,x0-14,cy+12,sub(r),'t3','end');}
    const mn=Math.min.apply(null,r.v),mx=Math.max.apply(null,r.v);
    S('line',{x1:sx(mn),x2:sx(mx),y1:cy,y2:cy,class:'l-range'},g);
    r.v.slice().sort((a,b)=>a-b).forEach(v=>S('circle',{cx:sx(v),cy:cy,r:5,class:'mark ring '+TYPE[r.t].c},g));
    T(g,W,cy+4,r.r,'tv','end');
    S('rect',{x:0,y:y,width:W,height:rowH,class:'hitbox'},g);
    bindTip(g,r.l,r.v.map((v,j)=>({v:f0(v),l:'версия '+(j+1),k:TYPE[r.t].k})).concat([{v:r.r,l:'лучшая / худшая'}]));
  });
}

/* ---------- 6. audience ---------- */
function drawGeo(root){
  const R=[
    {l:'Новая Усмань',v:14.8,cls:'f-acc'},
    {l:'Воронеж',v:13.1,cls:'f-acc'},
    {l:'Чита',v:8.4,cls:'f-oth'},
    {l:'Волжский',v:4.9,cls:'f-oth'},
    {l:'Москва',v:2.9,cls:'f-oth'},
    {l:'Прочие',v:55.9,cls:'f-oth'}
  ].map(r=>Object.assign(r,{tip:[{v:f1(r.v)+'%',l:'≈'+f0(r.v/100*4404)+' подписчиков'}]}));
  hbar(root,{rows:R,min:0,max:60,ticks:[0,20,40,60],tf:t=>t+'%',vf:r=>f1(r.v)+'%',barH:12,rowH:26,narrowAt:280,aria:'География подписчиков'});
}
function drawAge(root){
  const R=[
    {l:'25–34 года',v:44.3,cls:'f-acc'},
    {l:'35–44 года',v:33.5,cls:'f-acc'},
    {l:'Прочие группы',v:22.2,cls:'f-oth'}
  ].map(r=>Object.assign(r,{tip:[{v:f1(r.v)+'%',l:'≈'+f0(r.v/100*4404)+' подписчиков'}]}));
  hbar(root,{rows:R,min:0,max:50,ticks:[0,25,50],tf:t=>t+'%',vf:r=>f1(r.v)+'%',barH:12,rowH:28,narrowAt:280,aria:'Возраст подписчиков'});
}
function drawHours(root){
  const W=Math.floor(root.clientWidth); if(!W) return;
  const top=30,cellH=26,H=top+cellH+22;
  const cw=W/24;
  const svg=svgFor(root,W,H,'Активность аудитории по часам МСК: основная 9–21, пик 18–21');
  for(let i=0;i<24;i++){
    const cls=i>=18&&i<21?'f-hi':(i>=9&&i<21?'f-lo':'f-off');
    const lvl=i>=18&&i<21?'пик':(i>=9&&i<21?'основная':'низкая');
    const g=S('g',null,svg);
    S('rect',{x:i*cw+1,y:top,width:Math.max(cw-2,1),height:cellH,rx:2,class:'mark '+cls},g);
    S('rect',{x:i*cw,y:top-2,width:cw,height:cellH+4,class:'hitbox'},g);
    const hh=n=>String(n).padStart(2,'0')+':00';
    bindTip(g,hh(i)+'–'+hh(i+1)+' МСК',[{v:lvl,l:'активность'}].concat(i>=12&&i<15?[{v:hh(i+6)+'–'+hh(i+7),l:'по времени Читы'}]:[]));
  }
  for(let i=0;i<=24;i+=3){T(svg,i===0?0:i===24?W:i*cw,H-4,String(i).padStart(2,'0'),'t3',i===0?'start':i===24?'end':'middle');}
  function brk(a,b,label){const xa=a*cw+1,xb=b*cw-1,y=top-7;S('path',{d:'M'+xa+','+(y+4)+'V'+y+'H'+xb+'V'+(y+4),class:'l-brk'},svg);T(svg,(xa+xb)/2,y-5,label,'t3','middle');}
  brk(12,15,'вечер Читы');
  brk(18,21,'пик');
}

/* ---------- render & resize ---------- */
const charts=[['c-index',drawIndex],['c-net',drawNet],['c-pairs',drawPairs],['c-ladder',drawLadder],['c-trials',drawTrials],['c-geo',drawGeo],['c-age',drawAge],['c-hours',drawHours]]
  .map(p=>({el:document.getElementById(p[0]),fn:p[1],w:0})).filter(c=>c.el);
function render(force){charts.forEach(c=>{const w=Math.floor(c.el.clientWidth);if(force||w!==c.w){c.w=w;try{c.fn(c.el);}catch(e){console.error(e);}}});}
render(true);
let raf=0;
if('ResizeObserver' in window){const ro=new ResizeObserver(()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>render(false));});charts.forEach(c=>ro.observe(c.el));}
else addEventListener('resize',()=>render(false));
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>render(true));
})();
