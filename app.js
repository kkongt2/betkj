'use strict';
const $=id=>document.getElementById(id),venues={seoul:'서울',busan:'부산경남',jeju:'제주'};
const state={venue:'seoul',date:null,round:null,doc:null,model:null,report:null};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=(x,d=1)=>Number.isFinite(x)?`${(x*100).toFixed(d)}%`:'—';
const money=(n,sign=false)=>Number.isFinite(n)?`${sign&&n>0?'+':''}${Math.round(n).toLocaleString('ko-KR')}원`:'—';
const colored=x=>x>=0?'positive':'negative';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()).replace(/-/g,'');
const dateLabel=s=>`${Number(s.slice(4,6))}.${Number(s.slice(6,8))} (${new Intl.DateTimeFormat('ko-KR',{weekday:'short',timeZone:'Asia/Seoul'}).format(new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T12:00:00+09:00`))})`;
const key=c=>c.numbers.join('-');
function chart(items){
  if(!items.length)return '';
  const vals=[0,...items.map(x=>x.profit_units*1000)],lo=Math.min(...vals),hi=Math.max(...vals),span=hi-lo||1;
  const y=v=>112-(v-lo)/span*100,x=i=>10+i/(vals.length-1)*780;
  const points=vals.map((v,i)=>`${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return `<svg class="chart" viewBox="0 0 800 130" role="img" aria-label="분리 평가 기간의 일별 누적 세전 손익"><line x1="10" y1="${y(0)}" x2="790" y2="${y(0)}" stroke="#cdd7cc" stroke-dasharray="4 5"/><polyline points="${points}" fill="none" stroke="${vals.at(-1)>=0?'#327557':'#aa5346'}" stroke-width="2.5" vector-effect="non-scaling-stroke"/><circle cx="790" cy="${y(vals.at(-1))}" r="4" fill="#327557"/></svg>`;
}
function evidence(){
  const r=state.report,e=r.evaluation,s=r.selection,b=r.baseline,u=r.robustness,w=state.weights;
  $('verified').textContent=r.approved?'분리 평가 기준 통과':'흑자 검증 불충분';$('verified').className=`pill ${r.approved?'':'warning'}`;
  $('metrics').innerHTML=`<div class="metric"><span>누적 세전 손익</span><strong class="${colored(e.profit_krw)}">${money(e.profit_krw,true)}</strong></div><div class="metric"><span>수익률 · ROI</span><strong class="${colored(e.roi)}">${pct(e.roi,2)}</strong></div><div class="metric"><span>일별 최대 낙폭</span><strong>${money(e.daily_max_drawdown_krw)}</strong></div>`;
  $('chart').innerHTML=chart(e.curve);
  $('evaluation-note').textContent=`2026.01.01–09.10 · ${e.bets.toLocaleString()}회 × 1,000원 · 총 베팅 ${money(e.stake_krw)}. 과거 재계산이며 실제 사전 예측 실적이 아닙니다.`;
  const table=(head,rows)=>`<div class="table-scroll"><table><thead><tr>${head.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(x=>`<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  $('validation').innerHTML=`<p>조건 선택 구간(2025.04–12): ${s.bets}회, ${money(s.profit_krw,true)} (${pct(s.roi,2)}).<br>2026 평가 적중률 ${pct(e.hit_rate)} · 적중 시 평균 배당 ${e.mean_hit_dividend?.toFixed(2)??'—'}배 · 최장 연속 손실 ${e.max_losing_days}경기일.</p>`+table(['평가 월','횟수','순손익','ROI'],e.months.map(m=>[`${m.month.slice(0,4)}.${m.month.slice(4)}`,m.bets,money(m.profit_krw,true),pct(m.roi)]))+`<p>비교 기준: 매 경주 확률 1위 말에 1,000원씩 베팅하면 ${b.bets}회, ${money(b.profit_krw,true)} (${pct(b.roi,2)}). 횟수와 총 투입금이 다릅니다. 베팅하지 않는 기준의 손익은 0원입니다.</p><p>2026년은 이번 조건 선택에서 제외했지만 이전 모델 연구에서 사용된 기간입니다. 완전히 새로운 독립 표본으로 볼 수 없습니다.</p>`;
  $('robust').innerHTML=`<p>보수적 순손익 <strong class="${colored(u.conservative_profit_krw)}">${money(u.conservative_profit_krw,true)}</strong><br>아래 네 가지 검사 결과 중 가장 낮은 순손익입니다. 임의의 평균 가중치로 약점을 상쇄하지 않습니다. 미래 손실의 보장된 하한은 아닙니다.</p>`+table(['검사','결과'],[
    ['날짜 단위 재표집 95% ROI 구간',`${pct(e.roi_95ci[0],2)} ~ ${pct(e.roi_95ci[1],2)}`],
    ['확정 환급액 10% 감소',money(u.stress_10pct_profit_krw,true)],
    ['환급액 상위 5건을 0원 처리',money(u.without_top5_returns_profit_krw,true)],
    ['최고 수익일 제외',money(e.without_best_day_profit_krw,true)],
    ['추가 검사 · 환급액 5% 감소',money(u.stress_5pct_profit_krw,true)],
    ['최악 5% 경기일의 평균 손익',money(u.worst_5pct_day_mean_krw,true)]
  ])+`<h3>지역·편성별 확인</h3>`+table(['구분','횟수','순손익','ROI'],[...Object.entries(r.by_venue).map(([v,z])=>[venues[v],z.bets,money(z.profit_krw,true),pct(z.roi)]),...Object.entries(u.field_size).map(([v,z])=>[v,z.bets,money(z.profit_krw,true),pct(z.roi)])])+`<h3>시기·예상 배당대별 확인</h3>`+table(['구분','횟수','순손익','ROI'],[...Object.entries(u.half_year),...Object.entries(u.estimated_payout_band)].map(([v,z])=>[v,z.bets,money(z.profit_krw,true),pct(z.roi)]))+`<p>확률 품질: Brier ${r.calibration_audit.brier.toFixed(4)} · 로그손실 ${r.calibration_audit.log_loss.toFixed(4)} (둘 다 낮을수록 좋음). 소표본 하위 집단의 수익은 불확실하며, 전체 평균이 모든 지역에서의 수익을 뜻하지 않습니다.</p>`;
  $('policy').textContent=`예상 기대수익률 ${pct(r.policy.min_edge,0)} 이상 · 예상 배당 ${r.policy.min_dividend}배 이상 중 경주당 상위 ${r.policy.max_per_race}마리. 144개 조건을 비교했습니다. ${r.approved?'사전에 고정한 분리 평가 기준을 통과했습니다.':'현재 장기 흑자 검증을 통과하지 못해 베팅 추천은 보류합니다. 표시되는 말은 연구 후보입니다.'}`;
  $('method').innerHTML=`<p>공식 보고서 1,620개 · 경주 이력 ${r.counts.history_races.toLocaleString()}건 · 연승 배당 확인 ${r.counts.payout_races.toLocaleString()}건. 분석 대상 ${r.counts.used_races.toLocaleString()}경주 / ${r.counts.horses.toLocaleString()}개 출전 기록.</p><p>2021년: 과거 이력 축적<br>2022–2024년: 모델 학습 ${r.counts.fit_races.toLocaleString()}경주<br>2025.01–03: 확률·배당 보정 ${r.counts.calibration_races}경주<br>2025.04–12: 조건 선택 ${r.counts.selection_races.toLocaleString()}경주<br>2026.01–09.10: 최종 분리 평가 ${r.counts.evaluation_races.toLocaleString()}경주</p><p>목표함수는 <strong>모든 선택의 (확정 환급 배당 − 1) × 1,000원 합계</strong>입니다. 미적중 배당은 0입니다. 적중률이나 ROI만 최대화하지 않습니다. Gamma·Poisson 배당 모델 2개 × 기대수익 문턱 8개 × 경주당 선택 수 3개 × 예상 배당 하한 3개 = 144개 조건을 비교합니다.</p><p>조건 선택 기간의 앞·뒤 구간(4–7월, 8–12월)이 각각 50회 이상·흑자이고 최고 수익일을 빼도 흑자인 조건 중 총 순이익이 가장 큰 것을 고릅니다. 전체 선택 기간은 200회·60일 이상이어야 합니다. 안정 조건이 없으면 표본이 충분한 최고 순손익 후보를 연구용으로만 유지합니다. 이후 2026 결과를 보고 조건을 다시 조정하지 않습니다.</p><p>추천 승인에는 선택 기간 안정성, 평가 200회·60일 이상, 날짜 재표집 2,500회의 95% ROI 하한 양수, 최고 수익일 제외 후 흑자, 환급액 10% 감소 및 상위 5건 환급 제거 후 흑자가 모두 필요합니다.</p><p>입력은 경기일 이전 정보만 사용합니다. 실제 연승 당첨 마번과 배당이 일치하는 경주만 정산하며 결측·불명확한 경주는 제외합니다. 실시간 배당 수집은 하지 않습니다. 확정 배당은 학습 목표·정산에만 쓰고 후보 선택에는 모델 예상 배당을 씁니다.</p><p>공식 배당에 반영된 공제율을 이중 차감하지 않습니다. 개인별 적중금 세금·입장 비용은 포함하지 않은 세전 손익입니다. 같은 경주의 선택들은 상관될 수 있어 날짜 단위로 묶어 재표집합니다. 일별 낙폭은 장중 최대 손실을 포함하지 않습니다. 144개 조건 안의 비교이며 모든 가능한 전략의 최적해는 아닙니다.</p>`;
  $('weights').innerHTML=`<p>${esc(w.explanation)}</p>`+table(['요소 묶음','확률 모델 영향 비중','배당 모델 영향 비중'],w.groups.map(g=>[esc(g.name),`${g.importance_percent[0].toFixed(1)}%`,`${g.importance_percent[1].toFixed(1)}%`]))+`<p>측정: ${esc(w.period)} 중 ${w.sample_horses}개 출전 기록 · 입력 교란 ${w.repeats}회 평균. 두 열은 각각 합계 100%로 정규화한 설명 지표이며 예측식을 직접 곱하는 가중치가 아닙니다.</p><h3>실제로 적용한 계수</h3><p>확률: sigmoid(${w.explicit_weights.probability_calibration_logit_multiplier.toFixed(5)} × logit(원확률) + ${w.explicit_weights.probability_calibration_intercept.toFixed(5)})<br>배당: max(1, 원배당 × ${w.explicit_weights.dividend_scale.toFixed(5)})<br>기대수익: 보정 확률¹ × 보정 배당¹ − 1<br>각 트리의 학습률 0.06 · 110개 트리 · 최대 잎 7개 · 최소 잎 표본 100 · L2 규제 10.</p><details><summary>52개 입력 요소와 영향 비중 모두 보기</summary>`+table(['입력 요소','확률','배당'],w.features.map(g=>[esc(g.label||g.name),`${g.importance_percent[0].toFixed(2)}%`,`${g.importance_percent[1].toFixed(2)}%`]))+`</details><p><a href="data/weights.json">원본 영향도·계수</a> · <a href="data/frozen-policy.json">144개 조건 비교</a> · <a href="data/backtest.json">전체 평가 수치</a> · <a href="data/model.json">전체 트리 계수</a></p>`;
}
function button(label,value,selected,action){const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-pressed',String(value===selected));b.addEventListener('click',()=>action(value));return b;}
function selectors(){
  const all=state.doc.races.filter(r=>r.venue===state.venue),dates=[...new Set(all.map(r=>r.date))].sort();
  if(!dates.includes(state.date))state.date=dates.includes(today())?today():dates.find(d=>d>today())||dates.at(-1);
  const races=all.filter(r=>r.date===state.date).sort((a,b)=>a.race_no-b.race_no);
  if(!races.some(r=>r.race_no===state.round))state.round=races[0]?.race_no;
  $('venues').replaceChildren(...Object.entries(venues).map(([v,name])=>button(name,v,state.venue,x=>{state.venue=x;selectors();})));
  $('dates').replaceChildren(...dates.map(d=>button(dateLabel(d),d,state.date,x=>{state.date=x;state.round=null;selectors();})));
  $('rounds').replaceChildren(...races.map(r=>button(`${r.race_no}R`,r.race_no,state.round,x=>{state.round=x;selectors();})));
  renderRace(races.find(r=>r.race_no===state.round));
}
function candidate(c,i,preferred){
  return `<article class="candidate ${preferred?'preferred':''}"><div class="candidate-top"><div><p class="rank">${preferred?'조건 충족 · ':''}${state.model.approved?'후보':'연구 후보'} ${i+1}</p><div class="numbers"><span class="horse-number">${c.numbers[0]}</span></div><p class="names">${c.names.map(esc).join(' · ')}</p></div><div class="edge"><span>추정 기대수익률</span><strong class="${colored(c.edge)}">${c.edge>0?'+':''}${pct(c.edge)}</strong></div></div><div class="candidate-stats"><div><span>추정 적중확률</span><strong>${pct(c.prob)}</strong></div><div><span>예상 배당 · 모델 추정</span><strong>${c.dividend.toFixed(2)}배</strong></div><div><span>손익분기 배당 · 1/p</span><strong>${c.break_even.toFixed(2)}배</strong></div></div></article>`;
}
function renderRace(r){
  const age=(Date.now()-Date.parse(state.doc.updated_at))/60000,fresh=Number.isFinite(age)&&age>=-5&&age<=30;
  $('freshness').textContent=`데이터 갱신: ${new Date(state.doc.updated_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} (한국시간)${fresh?'':' · 갱신 필요'}`;
  if(!r){$('race-content').innerHTML='<div class="empty">이 지역에서 확인된 경주 일정이 없습니다.</div>';return;}
  const d=r.date,start=/^\d{2}:\d{2}$/.test(r.start_time||'')?Date.parse(`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}T${r.start_time}:00+09:00`):NaN;
  const ended=r.historical_view||r.date<today()||Number.isFinite(start)&&Date.now()>=start;
  let html=`<div class="race-heading"><div><h3>${esc(venues[r.venue])} ${r.race_no}경주</h3><p>${esc(r.grade||'')} · ${r.distance}m · ${r.horses.length}두 · ${esc(r.start_time||'시각 미확인')}</p></div><span class="pill">${ended?'출발 시각 경과':'예정 경주'}</span></div>`;
  if(ended){
    const result=r.official_result,pp=result?.place;
    html+=`<div class="notice">지난 경주의 예측은 경주일 이전 이력으로 재계산한 연구 후보입니다. 실제 사전예측 기록이 아니며, 확정 결과·배당은 예측 계산에 사용하지 않습니다.</div>`;
    if(pp?.status==='confirmed'&&Array.isArray(pp.payouts))html+=`<div class="panel"><h2>연승 실제 결과</h2><table><thead><tr><th>적중 선택</th><th>확정 배당</th></tr></thead><tbody>${pp.payouts.map(p=>`<tr><td>${p.numbers.map(esc).join(' — ')}</td><td>${Number(p.odds).toFixed(1)}배</td></tr>`).join('')}</tbody></table></div>`;
    else html+=`<div class="empty">${pp?.status==='refund'?'연승 환불 경주입니다.':'공식 연승 결과가 아직 확인되지 않았습니다.'}</div>`;
  }else{
    const cs=PLACE.predict(r,state.model),chosen=PLACE.selection(cs,state.model),keys=new Set(chosen.map(key));
    const recommend=state.model.approved&&fresh&&Number.isFinite(start);
    html+=`<div class="notice">${!fresh?'데이터가 오래되었습니다. 갱신 후 판단해 주세요. ':''}${recommend?(chosen.length?'검증 기준을 통과한 조건의 선택입니다.':'현재 연구 조건을 충족하는 선택이 없습니다.'):state.model.approved?'경주 시각·데이터 상태 확인이 필요해 추천을 보류합니다.':'장기 흑자 검증이 부족해 베팅 추천을 보류합니다. 연구 후보를 기대수익 순으로 표시합니다.'} 예상 배당은 실제 시세와 다를 수 있습니다.</div>`;
  }
  const cs=PLACE.predict(r,state.model),keys=new Set(PLACE.selection(cs,state.model).map(key));
  if(ended)html+='<h3>예측 선택 · 과거 데이터 재계산</h3>';
  if(cs.length){
    html+=`<div class="candidate-grid">${cs.slice(0,2).map((c,i)=>candidate(c,i,keys.has(key(c)))).join('')}</div>`;
    if(cs.length>2)html+=`<details class="list-more"><summary>나머지 ${cs.length-2}개 선택 보기</summary>${cs.slice(2).map((c,i)=>candidate(c,i+2,keys.has(key(c)))).join('')}</details>`;
  }else html+='<div class="empty">경주 이력이 부족하거나 오래되어 추정치를 표시할 수 없습니다.</div>';
  $('race-content').innerHTML=html;
}
async function json(path){const r=await fetch(`${path}?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw Error(`${path} 불러오기 실패`);return r.json();}
async function load(){
  $('refresh').disabled=true;
  try{
    const [doc,model,report,weights]=await Promise.all([json('data/latest.json'),json('data/model.json'),json('data/backtest.json'),json('data/weights.json')]);
    if(!Array.isArray(doc.races)||!doc.updated_at||report.schema!==1||model.schema!==1||model.approved!==report.approved||JSON.stringify(model.policy)!==JSON.stringify(report.policy))throw Error('데이터·모델 버전이 맞지 않습니다.');
    Object.assign(state,{doc,model,report,weights});evidence();selectors();
  }catch(e){$('race-content').innerHTML=`<div class="empty">${esc(e.message)}<br>잠시 후 새로고침해 주세요.</div>`;$('freshness').textContent='데이터를 새로 확인하지 못했습니다.';}
  finally{$('refresh').disabled=false;}
}
$('refresh').addEventListener('click',load);setInterval(()=>{if(state.doc)selectors();},60000);load();
