"""Predeclared stress tests and descriptive calibration-period importance.
Importance is NOT a fixed model coefficient and never controls policy choice.
"""
from collections import defaultdict
import numpy as np
from scipy.special import expit,logit
from sklearn.metrics import log_loss,mean_gamma_deviance

GROUPS={
'과거 적중·성적':[0,1,2,4,10,11,12,15,18,29,32,33,36,39],
'능력·상대 편성':[3,16,17,30,37,38,48],
'기수·조교사':[5,6,34,35],
'주행·페이스':[40,41,42,43,44,45,47],
'부담중량':[7,14],
'거리·경험':[13,19,22,49],
'휴양·나이':[8,31,50],
'경주 구조·지역':[20,21,23,24,25,26],
'이력·결측 상태':[9,27,28,46,51]}

def robustness(bets,stats):
    net=sum(b['gross']-1 for b in bets);gross=sorted([b['gross'] for b in bets],reverse=True)
    ds=defaultdict(float)
    for b in bets:ds[b['date']]+=b['gross']-1
    daily=sorted(ds.values());tail=daily[:max(1,int(np.ceil(len(daily)*.05)))]
    by=lambda f:{k:stats([b for b in bets if f(b)==k],True) for k in sorted({f(b) for b in bets})}
    return dict(stress_5pct_profit_krw=round(sum(.95*b['gross']-1 for b in bets)*1000),
        stress_10pct_profit_krw=round(sum(.9*b['gross']-1 for b in bets)*1000),
        without_top1_return_profit_krw=round((net-sum(gross[:1]))*1000),
        without_top5_returns_profit_krw=round((net-sum(gross[:5]))*1000),
        worst_5pct_day_mean_krw=float(np.mean(tail)*1000) if tail else 0,
        field_size=by(lambda b:'7두 이하' if b['field_size']<=7 else '8–10두' if b['field_size']<=10 else '11두 이상'),
        half_year=by(lambda b:b['date'][:4]+('H1' if b['date'][4:6]<='06' else 'H2')),
        estimated_payout_band=by(lambda b:'1–2배' if b['dividend']<2 else '2–4배' if b['dividend']<4 else '4배 이상'),
        no_bet_profit_krw=0,definition='Stress multiplies settled gross refunds by 0.95/0.90. Top-return removal sets their refunds to zero while retaining stakes. Date-cluster bootstrap preserves all selections in a date; it is not proof against regime change.')

def influence(clf,reg,X,y,gross,names,a,b,scale):
    rng=np.random.default_rng(20260912);ids=rng.choice(len(X),min(2500,len(X)),replace=False);X=X[ids];y=y[ids];gross=gross[ids];hit=y==1
    def losses(z):
        p=expit(a*logit(np.clip(clf.predict_proba(z)[:,1],1e-6,1-1e-6))+b)
        d=np.maximum(1,reg.predict(z)*scale)
        return np.array([log_loss(y,p),mean_gamma_deviance(gross[hit],d[hit])])
    base=losses(X)
    def measure(cols):
        values=[]
        for _ in range(3):
            z=X.copy();order=rng.permutation(len(z));z[:,cols]=X[order][:,cols];values.append(losses(z)-base)
        return np.mean(values,axis=0).tolist()
    labels=['최근 1년 3위 이내율', '최근 1년 우승률', '동거리 3위 이내율', '상대 레이팅', '최근 성적', '기수 3위 이내율', '조교사 3위 이내율', '상대 부담중량', '직전 출전 후 경과일', '과거 출전 수', '순위 정규화', '성적 추세', '성적 일관성', '거리 변화', '부담중량 변화', '최근 착차', '상대 속도', '과거 상대 레이팅', '기수·말 호흡', '동거리 경험', '출전 두수', '연승 적중 자리 수', '경주 거리', '서울', '부산경남', '제주', '이력 부족 편성', '속도 기록 유무', '착차 기록 유무', '상대 최근 성적', '절대 레이팅', '장기 휴양', '최근 1년 실제 연승률', '동거리 실제 연승률', '기수 실제 연승률', '조교사 실제 연승률', '유사 거리 성적', '레이팅 변화', '등급 변화', '상대 수준 보정 착차', '초반 경쟁력', '종반 순위 상승', '선두 주행 비율', '상대 초반 속도', '상대 종반 속도', '구간 기록 충실도', '위치 기록 충실도', '편성 선행마 비율', '더 강한 경쟁마 비율', '유사 거리 경험', '나이', '동일 개체 이력 유무']
    features=[dict(name=n,label=labels[i],index=i,delta=measure([i])) for i,n in enumerate(names)]
    groups=[dict(name=n,indices=c,delta=measure(c)) for n,c in GROUPS.items()]
    for rows in (features,groups):
        totals=[sum(max(0,r['delta'][k]) for r in rows) for k in (0,1)]
        for r in rows:r['importance_percent']=[100*max(0,r['delta'][k])/totals[k] if totals[k] else 0 for k in (0,1)]
    return dict(period='2025.01–03 보정 구간',sample_horses=len(X),repeats=3,features=features,groups=groups,
        explanation='고정 가중치가 없는 트리 모델. 해당 입력을 섞었을 때 확률 로그손실 / 적중 시 배당 감마손실 증가량. 음수는 원값을 보존하되 비중 계산에서 0 처리. 연관 변수는 중요도가 분산될 수 있고 인과효과가 아님. 보정 자료에서 산출한 설명 지표이며 독립 성능 검증이 아님.',
        explicit_weights=dict(probability_calibration_logit_multiplier=a,probability_calibration_intercept=b,dividend_scale=scale,expected_gross='calibrated_probability × calibrated_conditional_dividend',stake_krw=1000,probability_model_weight=1,dividend_model_weight=1),
        hyperparameters=dict(trees=110,max_leaf_nodes=7,min_samples_leaf=100,learning_rate=.06,l2_regularization=10),
        baseline_losses=base.tolist())
