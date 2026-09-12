(function(root){
  'use strict';
  const cols=[...Array(20).keys(),27,28,29,30,31,...Array.from({length:15},(_,i)=>32+i),48,49,50,51];
  const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
  const sigmoid=z=>1/(1+Math.exp(-z));
  function estimate(m,x){
    if(!m||m.width!==x.length||!Number.isFinite(m.bias)||!Array.isArray(m.trees))throw Error('모델 형식 오류');
    let z=m.bias;
    for(const tree of m.trees){
      let n=0,steps=0;
      while(tree[n]&&!tree[n][0]){
        if(++steps>tree.length)throw Error('모델 순환 오류');
        const r=tree[n];n=x[r[1]]<=r[2]?r[3]:r[4];
      }
      if(!tree[n]||!Number.isFinite(tree[n][5]))throw Error('모델 노드 오류');
      z+=tree[n][5];
    }
    const value=m.link==='exp'?Math.exp(z):sigmoid(z);
    if(!Number.isFinite(value))throw Error('모델 계산 오류');
    return value;
  }
  function predict(race,model){
    if(model?.market!=='place'||model?.schema!==1||model.feature_version!=='7.0-race-pace'||!Number.isFinite(model.dividend_scale)||model.dividend_scale<=0)throw Error('모델 버전 오류');
    if(race.feature_version_v7!==model.feature_version)return [];
    if(!/^\d{8}$/.test(race.history_through_v7||'')||race.history_through_v7>=race.date)return [];
    const day=s=>Date.parse(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T00:00:00Z`);
    if((day(race.date)-day(race.history_through_v7))/86400000>7)return [];
    const horses=[...(race.horses||[])].sort((a,b)=>a.number-b.number),X=horses.map(h=>h.features_v7),n=horses.length;
    if(n<3||n>16||new Set(horses.map(h=>h.number)).size!==n||horses.some(h=>!Number.isInteger(h.number)||h.number<1||h.number>20))return [];
    if(X.some(x=>!Array.isArray(x)||x.length!==52||x.some(v=>!Number.isFinite(v))||Math.abs(x[20]-n/20)>1e-7))return [];
    const out=[];
    for(let i=0;i<n;i++){
      const f=X[i],raw=Math.max(1e-6,Math.min(1-1e-6,estimate(model.classifier,f)));
      const p=sigmoid(model.calibrator.a*Math.log(raw/(1-raw))+model.calibrator.b);
      const d=Math.max(1,estimate(model.dividend,f)*model.dividend_scale);
      if(!Number.isFinite(p)||p<=0||p>=1)throw Error('확률 계산 오류');
      out.push({numbers:[horses[i].number],names:[horses[i].name],prob:p,dividend:d,edge:p*d-1,break_even:1/p});
    }
    return out.sort((a,b)=>b.edge-a.edge||a.numbers[0]-b.numbers[0]);
  }
  function selection(candidates,model){return candidates.filter(c=>c.edge>=model.policy.min_edge&&c.dividend>=model.policy.min_dividend).slice(0,model.policy.max_per_race);}
  const api={predict,selection,estimate};if(typeof module!=='undefined')module.exports=api;else root.PLACE=api;
})(globalThis);
