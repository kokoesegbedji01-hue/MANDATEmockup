
(function(){
  const ids=['uwEbitda','uwDebt','uwGrowth','uwVol','uwRate','uwThreshold'];
  function num(id,fallback){const el=document.getElementById(id);const v=el?Number(el.value):fallback;return Number.isFinite(v)?v:fallback}
  function fmtMoney(v){return '$'+v.toFixed(1)+'M'}
  function drawHistogram(values,thresholdEbitda){
    const canvas=document.getElementById('uwHistogram');if(!canvas)return;
    const rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1,w=Math.max(320,rect.width||600),h=170;
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);canvas.style.height=h+'px';
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const left=34,right=12,top=10,bottom=27,plotW=w-left-right,plotH=h-top-bottom;
    const min=Math.max(0,Math.min(...values)*.94),max=Math.max(...values)*1.04,range=(max-min)||1,bins=24,counts=Array(bins).fill(0);
    values.forEach(v=>{let b=Math.floor((v-min)/range*bins);b=Math.max(0,Math.min(bins-1,b));counts[b]++});const peak=Math.max(...counts,1);
    ctx.strokeStyle='#e7ece7';ctx.lineWidth=1;ctx.fillStyle='#7a867e';ctx.font='10px Inter, sans-serif';
    for(let j=0;j<3;j++){let y=top+plotH*j/2;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke()}
    const bw=plotW/bins;counts.forEach((c,i)=>{let bh=c/peak*(plotH-4);ctx.fillStyle='#9cb9a4';ctx.fillRect(left+i*bw+1,top+plotH-bh,Math.max(1,bw-2),bh)});
    ctx.fillStyle='#7a867e';ctx.textAlign='center';ctx.fillText('$'+min.toFixed(0)+'M',left,h-7);ctx.fillText('$'+((min+max)/2).toFixed(0)+'M',left+plotW/2,h-7);ctx.fillText('$'+max.toFixed(0)+'M',w-right,h-7);
    if(thresholdEbitda>=min&&thresholdEbitda<=max){let x=left+(thresholdEbitda-min)/range*plotW;ctx.strokeStyle='#a14c43';ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,top+plotH);ctx.stroke();ctx.setLineDash([])}
  }
  function run(){
    const ebitda=Math.max(.1,num('uwEbitda',12)),debt=Math.max(0,num('uwDebt',48)),growth=num('uwGrowth',6)/100,vol=Math.max(.01,num('uwVol',18)/100),rate=Math.max(0,num('uwRate',9)/100),threshold=Math.max(.1,num('uwThreshold',5));
    const leverage=debt/ebitda,coverage=rate===0?Infinity:ebitda/(debt*rate||.00001);
    // Deterministic seeded pseudo-random stream makes the same assumptions reproducible across refreshes.
    let seed=2166136261;[ebitda,debt,growth,vol,rate,threshold].forEach(v=>{seed^=Math.round(v*10000);seed=Math.imul(seed,16777619)});
    function rand(){seed=(Math.imul(1664525,seed)+1013904223)>>>0;return (seed+1)/4294967297}
    function normal(){const u=Math.max(rand(),1e-9),v=rand();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
    const paths=[];for(let i=0;i<5000;i++){let z=normal();let outcome=ebitda*Math.exp(Math.log(Math.max(.01,1+growth))-.5*vol*vol+vol*z);paths.push(outcome)}
    paths.sort((a,b)=>a-b);const p05=paths[Math.floor(.05*(paths.length-1))],p50=paths[Math.floor(.5*(paths.length-1))],breach=paths.filter(v=>debt/v>threshold).length/paths.length;
    const els={uwCurrentLev:leverage.toFixed(1)+'×',uwCoverage:rate===0?'N/M':(coverage===Infinity?'N/M':coverage.toFixed(1)+'×'),uwP05:fmtMoney(p05),uwBreach:(breach*100).toFixed(1)+'%'};
    Object.entries(els).forEach(([id,val])=>{const el=document.getElementById(id);if(el)el.textContent=val});
    const label=document.getElementById('uwScenarioLabel');if(label)label.textContent='Median EBITDA '+fmtMoney(p50);
    drawHistogram(paths,debt/threshold);
  }
  window.runUnderwritingSensitivity=run;
  Object.entries({uwEbitda:v=>'$'+Number(v).toFixed(0)+'M',uwDebt:v=>'$'+Number(v).toFixed(0)+'M',uwGrowth:v=>Number(v)+'%',uwVol:v=>Number(v)+'%',uwRate:v=>Number(v)+'%',uwThreshold:v=>Number(v).toFixed(2).replace(/0$/,'')+'×'}).forEach(([id,fmt])=>{const el=document.getElementById(id),out=document.getElementById(id+'Value');if(el&&out)out.textContent=fmt(el.value)});
  const formats={uwEbitda:v=>'$'+Number(v).toFixed(0)+'M',uwDebt:v=>'$'+Number(v).toFixed(0)+'M',uwGrowth:v=>Number(v)+'%',uwVol:v=>Number(v)+'%',uwRate:v=>Number(v)+'%',uwThreshold:v=>Number(v).toFixed(2).replace(/0$/,'')+'×'};
  ids.forEach(id=>{const el=document.getElementById(id);if(el){const update=()=>{const out=document.getElementById(id+'Value');if(out&&formats[id])out.textContent=formats[id](el.value);run()};el.addEventListener('input',update);el.addEventListener('change',update);}});
  window.addEventListener('resize',()=>{if(document.getElementById('uwHistogram'))run()});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
})();
