(function(){
  "use strict";
  var $ = function(id){ return document.getElementById(id); };
  var DOW = ["일","월","화","수","목","금","토"];   // 주 시작 = 일요일 (인덱스 = getDay())
  var STL = {todo:"예정", doing:"진행 중", done:"완료"};
  var NEXT = {todo:"doing", doing:"done", done:"todo"};

  // ---- 사업 구분 (업체 단위) — 2026년 사업 / 이전 사업 / 확인 필요. 「공통」은 늘 보임
  var YEARS = [{k:"2026", n:"2026년 사업"}, {k:"이전", n:"이전 사업"}, {k:"확인", n:"확인 필요"}];
  var YEAR_KEYS = {"2026":1, "이전":1, "확인":1};
  var YEAR_LABEL = {"2026":"2026년 사업", "이전":"이전 사업", "확인":"확인 필요"};
  var DEFAULT_YEAR = {
    "다소니푸드":"2026", "엠에스푸드":"2026", "원스팜":"2026", "제이엠미트":"2026",
    "아침엔글로벌":"2026", "아침앤글로벌":"2026", "찬스푸드클럽":"2026", "코삿":"2026",
    "어니스트밀크":"확인"
  };
  function coKey(name){ return String(name||"").replace(/\s+/g,"").replace(/^(주식회사|\(주\)|㈜)|(주식회사|\(주\)|㈜)$/g,""); }
  function isCommon(name){ return coKey(name)==="공통"; }
  function yearOfCompany(name){
    var k = coKey(name);
    if (S.yearSet[k]) return S.yearSet[k].year;
    return DEFAULT_YEAR[k] || "이전";
  }

  // ---- 상태
  var S = { view:"month", cursor: ymd(new Date()), company:"", stage:"", year:"", q:"", hideDone:false, dev:true, events:[], devEvents:[], devInfo:null, yearSet:{}, ready:false, store:null, editing:null };
  try {
    var saved = JSON.parse(localStorage.getItem("bizcal.prefs")||"null");
    if (saved){ if (/^(month|week|day|plan|span|done|list)$/.test(saved.view)) S.view = saved.view; if (saved.dev===false) S.dev = false; S.company = saved.company||""; S.stage = saved.stage||""; S.year = YEAR_KEYS[saved.year] ? saved.year : ""; S.hideDone = !!saved.hideDone; }
  } catch(e){}
  function savePrefs(){ try{ localStorage.setItem("bizcal.prefs", JSON.stringify({view:S.view, company:S.company, stage:S.stage, year:S.year, hideDone:S.hideDone, dev:S.dev})); }catch(e){} }

  // ---- 날짜 도구
  function pad(n){ return (n<10?"0":"")+n; }
  function ymd(d){ return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); }
  function parse(s){ var p=s.split("-"); return new Date(+p[0], +p[1]-1, +p[2]); }
  function addDays(s,n){ var d=parse(s); d.setDate(d.getDate()+n); return ymd(d); }
  function weekStartOf(s){ var d=parse(s); d.setDate(d.getDate()-d.getDay()); return ymd(d); }   // 그 주의 일요일
  function dowIdx(s){ return parse(s).getDay(); }                    // 0=일 … 6=토, DOW 인덱스와 같음
  function isWeekendDay(s){ var g=parse(s).getDay(); return g===0 || g===6; }   // 칸 위치와 무관하게 토·일
  function md(s){ var p=s.split("-"); return (+p[1])+"/"+(+p[2]); }
  function todayStr(){ return ymd(new Date()); }

  function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); }
  function hue(name){ var h=0; for (var i=0;i<name.length;i++) h=(h*31+name.charCodeAt(i))>>>0; return [210,150,28,340,262,188,96,8,300,50,232,124][h%12]; }

  // ---- 보기용 데이터
  // ---- 사업 단계
  var STAGES = [
    {k:"1", n:"사업신청", h:212}, {k:"2", n:"선정평가", h:262}, {k:"3", n:"사업협약", h:188},
    {k:"4", n:"착수보고", h:150}, {k:"5", n:"사업수행", h:100}, {k:"6", n:"사업비집행", h:42},
    {k:"7", n:"중간점검", h:22},  {k:"8", n:"완료점검", h:330}, {k:"9", n:"정산·감리", h:0},
    {k:"0", n:"기타", h:-1}
  ];
  var STAGE = {}; STAGES.forEach(function(x){ STAGE[x.k]=x; });
  var STAGE_WORDS = [
    ["9", ["감리","정산","회계","원가","하자보증"]],
    ["8", ["완료점검","완료보고","최종점검","최종완료","사업완료","최종 완료"]],
    ["7", ["중간점검","중간보고"]],
    ["6", ["집행","입금","부담금","지원금","임치","세금계산서","선금","잔금"]],
    ["4", ["착수"]],
    ["3", ["협약"]],
    ["2", ["평가","발표자료","실사","선정"]],
    ["1", ["사업신청","사업계획서","신청서"]],
    ["5", ["센서","H/W","HW","네트워크","와이파이","K-HACCP","케이해썹","설치","입고","DATA","데이터","교육","수행","설비","인력","세팅","셋팅","사업기간","일지","발주","공사"]]
  ];
  function guessStage(title){
    var t = String(title||""), best = "0", pos = 1e9;
    if (t.indexOf("감리")>=0 && t.indexOf("감리 전")<0) return "9";
    STAGE_WORDS.forEach(function(r){ r[1].forEach(function(w){ var i = t.indexOf(w); if (i>=0 && i<pos){ pos=i; best=r[0]; } }); });
    return best;
  }
  function stageOf(e){ return STAGE[e.stage] ? e.stage : guessStage(e.title); }
  function stageStyle(k){ var h = STAGE[k].h; return h<0 ? ' data-g="1"' : ' style="--sh:'+h+'"'; }
  function badge(e){ var k = stageOf(e); return '<b class="sb"'+stageStyle(k)+' title="'+STAGE[k].n+'">'+(k==="0"?"·":k)+'</b>'; }

  var DEV = "개발팀";
  function isDev(e){ return e && e.source === "dev"; }
  function allEvents(){ return S.dev ? S.events.concat(S.devEvents) : S.events; }
  function hit(e){
    var q = S.q.trim().toLowerCase(); if (!q) return true;
    return (e.company+" "+e.title+" "+(e.note||"")).toLowerCase().indexOf(q) >= 0;
  }
  function visible(keepDone){
    return allEvents().filter(function(e){
      if (!hit(e)) return false;
      if (S.company && e.company !== S.company) return false;
      if (S.year && !isCommon(e.company) && !isDev(e) && yearOfCompany(e.company) !== S.year) return false;
      if (S.stage && stageOf(e) !== S.stage) return false;
      if (S.hideDone && !keepDone && e.status === "done") return false;
      return true;
    });
  }
  function byDate(list){ var m={}; list.forEach(function(e){ if(!e.date) return; (m[e.date]=m[e.date]||[]).push(e); }); return m; }
  function groupCompany(list){
    var m={}, order=[];
    list.forEach(function(e){ if(!m[e.company]){ m[e.company]=[]; order.push(e.company); } m[e.company].push(e); });
    order.sort(function(a,b){ return late(m[b])-late(m[a]) || urgentOpen(m[b])-urgentOpen(m[a]) || a.localeCompare(b,"ko"); });
    return order.map(function(c){ return {company:c, items:m[c].slice().sort(sortItem)}; });
  }
  function sortItem(a,b){ var o={doing:0,todo:1,done:2}; return o[a.status]-o[b.status] || (b.urgent?1:0)-(a.urgent?1:0) || a.title.localeCompare(b.title,"ko"); }
  function isLate(e){ return e.status!=="done" && e.date && e.date < todayStr(); }
  function late(items){ return items.some(isLate)?1:0; }
  function urgentOpen(items){ return items.some(function(e){ return e.urgent && e.status!=="done"; })?1:0; }

  function chipHTML(g, attrs){
    var all = g.items.every(function(e){ return e.status==="done"; });
    return '<span class="chip'+(all?' alldone':'')+(urgentOpen(g.items)?' urgent':'')+'" style="--h:'+hue(g.company)+'" '+(attrs||'')+' title="'+esc(g.company+" "+g.items.length+"건")+'">'+
      (late(g.items)?'<i class="late" aria-label="밀림"></i>':'')+'<span class="nm">'+esc(g.company)+'</span>'+(g.items.length>1?'<span class="ct">'+g.items.length+'</span>':'')+'</span>';
  }

  // ---- 렌더
  function render(){
    document.querySelectorAll(".seg button").forEach(function(b){ b.setAttribute("aria-pressed", String(b.dataset.view===S.view)); });
    $("company").value = S.company; $("hideDone").checked = S.hideDone;
    document.querySelectorAll("#yearSeg button").forEach(function(b){ b.setAttribute("aria-pressed", String((b.dataset.year||"")===S.year)); });
    var unsure = companyNames().filter(function(n){ return !isCommon(n) && yearOfCompany(n)==="확인"; }).length;
    var ub = document.querySelector('#yearSeg [data-year="확인"]'); ub.hidden = !unsure && S.year!=="확인"; ub.querySelector("span").textContent = unsure;
    $("q").value = S.q;
    var noNav = S.view==="span" || S.view==="done" || S.view==="list";   // 기간 중인 일·완료는 오늘 기준 목록이라 이전/다음 없음
    $("prev").style.visibility = $("next").style.visibility = noNav ? "hidden" : "";
    var dv = $("devToggle"); if (dv){ dv.checked = S.dev; dv.parentNode.hidden = !S.devEvents.length; }
    if (S.view==="month") renderMonth(); else if (S.view==="week") renderWeek(); else if (S.view==="plan") renderPlan();
    else if (S.view==="span") renderSpan(); else if (S.view==="done") renderDone(); else if (S.view==="list") renderList(); else renderDay();
  }

  function sortMonth(a,b){ var o={doing:0,todo:1,done:2}, mk={start:1, mid:2};
    // 방금 넣은 일정 → 우리 팀 일정 → 개발팀 일정 순서로 (칸이 넘쳐도 우리 것이 먼저 보이게)
    return (b.id===S.flash?1:0)-(a.id===S.flash?1:0) || (mk[a._mark]||0)-(mk[b._mark]||0) || (isDev(a)?1:0)-(isDev(b)?1:0) || o[a.status]-o[b.status] || (b.urgent?1:0)-(a.urgent?1:0) || stageOf(a).localeCompare(stageOf(b)) || a.company.localeCompare(b.company,"ko"); }
  function legendHTML(){
    return '<div class="legend" role="group" aria-label="사업 단계로 거르기">'+STAGES.map(function(x){
      return '<button type="button" class="lg'+(S.stage===x.k?' on':'')+'" data-stage="'+x.k+'" aria-pressed="'+(S.stage===x.k)+'"><b class="sb"'+stageStyle(x.k)+'>'+(x.k==="0"?"·":x.k)+'</b>'+x.n+'</button>';
    }).join("")+(S.stage?'<button type="button" class="lg clr" data-stage="">전체 보기</button>':'')+'</div>';
  }
  function renderMonth(){
    var c = parse(S.cursor), y=c.getFullYear(), m=c.getMonth();
    $("period").innerHTML = (m+1)+"월<small>"+y+"</small>";
    var first = ymd(new Date(y,m,1)), start = weekStartOf(first);
    var last = new Date(y,m+1,0), end = addDays(weekStartOf(ymd(last)),6);
    var vis = visible(), map = byDate(vis), t = todayStr();
    vis.forEach(function(e){   // 기간 일정은 시작일부터 마감 전날까지 매일 칸에도 보여 준다
      if (!isSpan(e)) return;
      var from = e.start > start ? e.start : start;
      for (var x = from; x < e.date && x <= end; x = addDays(x,1)){
        (map[x] = map[x] || []).push(Object.assign({}, e, {_mark: x===e.start ? "start" : "mid"}));
      }
    });
    var h = legendHTML()+'<section class="month" aria-label="월간 달력"><div class="dow">'+DOW.map(function(d){return "<div>"+d+"</div>";}).join("")+'</div><div class="grid">';
    for (var d=start; d<=end; d=addDays(d,1)){
      var inM = parse(d).getMonth()===m, wd = isWeekendDay(d);
      var list = (map[d]||[]).slice().sort(sortMonth);
      var max = window.innerWidth<640 ? 5 : 8;
      h += '<div class="cell'+(inM?'':' out')+(wd?' weekend':'')+(d===t?' today':'')+'" data-day="'+d+'" role="button" tabindex="0" aria-label="'+md(d)+' 일정 '+list.length+'건">'+
        '<div class="dn"><b>'+(+d.slice(8))+'</b></div>'+
        list.slice(0,max).map(function(e){
          var k = stageOf(e);
          var span = e.start && e.date && e.start < e.date;
          var rg = span ? '<span class="rg">'+md(e.start)+' → '+md(e.date)+'</span>' : '';
          return '<span class="ev'+(e.status==="done"?' done':'')+(isLate(e)&&!e._mark?' late':'')+(e.urgent&&e.status!=="done"?' urgent':'')+(e._mark?' begin':'')+(isDev(e)?' dev':'')+(e.id===S.flash?' flash':'')+'"'+stageStyle(k)+' title="'+esc(STAGE[k].n+" · "+e.company+" · "+e.title+(span?" ("+md(e.start)+"~"+md(e.date)+")":""))+'">'+
            '<span class="eh"><b class="sb">'+(e._mark==="start"?"▶":e._mark==="mid"?"…":(k==="0"?"·":k))+'</b><span class="co">'+esc(e.company)+'</span></span><span class="ti">'+(e._mark==="start"?'<b class="mk">시작</b> ':e._mark==="mid"?'<b class="mk">기간 중</b> ':'')+esc(e.title)+'</span>'+rg+'</span>';
        }).join("")+
        (list.length>max?'<span class="more">+'+(list.length-max)+'건</span>':'')+'</div>';
    }
    $("view").innerHTML = h+'</div></section>';
  }

  function renderWeek(){
    var s = weekStartOf(S.cursor), e = addDays(s,6), t = todayStr();
    var sy = s.slice(0,4);
    $("period").innerHTML = md(s)+" – "+md(e)+"<small>"+sy+"</small>";
    var vis = visible(), h = '<section class="week" aria-label="주간 달력">';
    for (var i=0;i<7;i++){
      var d = addDays(s,i);
      var list = vis.filter(function(x){ return x.date===d || (isSpan(x) && x.start<=d && x.date>d); });
      var groups = groupCompany(list);
      h += '<div class="day'+((i===0||i===6)?' weekend':'')+(d===t?' today':'')+'">'+
        '<button type="button" class="dayh" data-day="'+d+'"><span class="d">'+(+d.slice(8))+'</span><span class="w">'+DOW[i]+'</span><span class="n">'+(list.length?list.length+'건':'')+'</span></button>'+
        '<div class="daybody">'+(groups.length? groups.map(function(g){
          return '<div class="grp">'+chipHTML(g,'data-day="'+d+'"')+g.items.map(function(ev){
            var sp = isSpan(ev) && ev.date!==d ? (ev.start===d ? '<b class="mk">시작</b> ' : '<b class="mk">기간 중</b> ') : (isSpan(ev) ? '<b class="mk e">마감</b> ' : '');
            return '<button type="button" class="it'+(ev.status==="done"?' done':'')+(isLate(ev)&&ev.date===d?' late':'')+(ev.urgent?' urgent':'')+(isSpan(ev)&&ev.date!==d?' mid':'')+'" data-id="'+esc(ev.id)+'" title="'+esc(ev.company+" · "+ev.title+(isSpan(ev)?" ("+md(ev.start)+"~"+md(ev.date)+")":""))+'">'+badge(ev)+sp+esc(ev.title)+'</button>';
          }).join("")+'</div>';
        }).join("") : '<span class="empty">일정 없음</span>')+'</div></div>';
    }
    $("view").innerHTML = h+'</section>';
  }

  function isSpan(e){ return !!(e.start && e.date && e.start < e.date); }
  // day 를 주면 기간 일정에 「오늘 시작」「오늘 마감」 표시, extra 는 제목 앞 꼬리표(HTML)
  function rowHTML(ev, showDate, day, extra){
    var dt = (day && isSpan(ev)) ? (ev.start===day ? '<span class="tag s">'+(day===todayStr()?'오늘 ':'')+'시작</span>' : ev.date===day ? '<span class="tag e">'+(day===todayStr()?'오늘 ':'')+'마감</span>' :
             (ev.start<day && ev.date>day) ? '<span class="tag s">기간 중 · 마감까지 '+Math.round((parse(ev.date)-parse(day))/864e5)+'일</span>' : '') : '';
    return '<div class="row'+(ev.status==="done"?' done':'')+(isLate(ev)?' late':'')+'">'+
      '<button type="button" class="st" data-toggle="'+esc(ev.id)+'" data-s="'+ev.status+'" title="눌러서 상태 바꾸기">'+STL[ev.status]+'</button>'+
      '<div class="rt"><div class="t">'+badge(ev)+(ev.urgent&&ev.status!=="done"?'<span class="tag u">긴급</span>':'')+dt+(extra||'')+(showDate?'<span class="tag p">'+md(ev.date)+'</span>':'')+esc(ev.title)+'</div>'+
      ((ev.start||ev.note)?'<div class="m">'+(ev.start?'기간 '+md(ev.start)+' – '+md(ev.date)+(ev.note?' · ':''):'')+esc(ev.note||"")+'</div>':'')+'</div>'+
      '<button type="button" class="edit" data-id="'+esc(ev.id)+'">수정</button></div>';
  }
  function groupsHTML(list, showDate, day, extraFn, groups){
    return (groups || groupCompany(list)).map(function(g){
      return '<div class="cgroup"><div class="ch"><span class="dot" style="--h:'+hue(g.company)+'"></span>'+esc(g.company)+(g.items.length>1?' <span class="cn">'+g.items.length+'</span>':'')+'</div>'+g.items.map(function(ev){ return rowHTML(ev, showDate, day, extraFn && extraFn(ev)); }).join("")+'</div>';
    }).join("");
  }

  function renderDay(){
    var d = S.cursor, t = todayStr(), i = dowIdx(d);
    $("period").innerHTML = md(d)+" ("+DOW[i]+")<small>"+d.slice(0,4)+"</small>";
    var vis = visible();
    // 오늘 일정 = 이날 마감 + 기간 일정 중 이날이 시작일~마감일 사이에 드는 것
    var list = vis.filter(function(e){ return e.date===d || (isSpan(e) && e.start<=d && e.date>=d); });
    // 기간 중인 일 = 시작일~마감일 사이(시작일·마감일 당일 포함), 미완료
    var span = vis.filter(function(e){ return isSpan(e) && e.start<=d && e.date>=d && e.status!=="done"; });
    var lateList = allEvents().filter(function(e){ return isLate(e) && hit(e) && (!S.company || e.company===S.company) && (!S.year || isCommon(e.company) || isDev(e) || yearOfCompany(e.company)===S.year); }).sort(function(a,b){ return a.date<b.date?-1:1; });
    var undated = vis.filter(function(e){ return !e.date; });
    var h = '<section class="dayview"><div>'+
      '<div class="panel"><h2>'+(d===t?'오늘':md(d))+' 일정 <span class="n">'+list.length+'</span><span class="hint">상태 버튼을 누르면 예정 → 진행 중 → 완료</span></h2>'+
      (list.length? groupsHTML(list,false,d) : '<p class="none">이 날짜에 잡힌 일정이 없습니다. 오른쪽 위 「+ 일정」으로 추가하세요.</p>')+'</div>'+
      (span.length?'<div class="panel" style="margin-top:12px"><h2>기간 중인 일 <span class="n">'+span.length+'</span></h2>'+groupsHTML(span,true,d)+'</div>':'')+
      '</div><aside class="side">'+
      '<div class="panel"><h2>밀린 일 <span class="n">'+lateList.length+'</span></h2>'+(lateList.length?'<div class="minilist">'+lateList.slice(0,40).map(function(e){
        return '<button type="button" data-id="'+esc(e.id)+'"><span class="dot" style="--h:'+hue(e.company)+'"></span><span class="nm">'+esc(e.company)+' · '+esc(e.title)+'</span><span class="dd">'+md(e.date)+'</span></button>';
      }).join("")+(lateList.length>40?'<p class="none">외 '+(lateList.length-40)+'건</p>':'')+'</div>':'<p class="none">마감이 지난 미완료 일정이 없습니다.</p>')+'</div>'+
      (undated.length?'<div class="panel"><h2>날짜 미정 <span class="n">'+undated.length+'</span></h2><div class="minilist">'+undated.map(function(e){
        return '<button type="button" data-id="'+esc(e.id)+'"><span class="dot" style="--h:'+hue(e.company)+'"></span><span class="nm">'+esc(e.company)+' · '+esc(e.title)+'</span></button>';
      }).join("")+'</div></div>':'')+
      '</aside></section>';
    $("view").innerHTML = h;
  }

  // =====================================================================
  //  일정설계 — 업체마다 카드 하나. 시작일·마감일과 남은 날짜를 한눈에
  // =====================================================================
  function dday(e){
    if (!e.date) return "";
    var t = todayStr();
    if (e.status === "done") return "완료";
    if (e.date < t) return "D+" + Math.round((parse(t)-parse(e.date))/864e5) + " 밀림";
    if (e.date === t) return "오늘";
    return "D-" + Math.round((parse(e.date)-parse(t))/864e5);
  }
  function planCard(g){
    var items = g.items.slice().sort(function(a,b){
      return (a.status==="done"?1:0)-(b.status==="done"?1:0) || (a.date||"9999").localeCompare(b.date||"9999") || stageOf(a).localeCompare(stageOf(b));
    });
    var open = items.filter(function(e){ return e.status!=="done"; });
    var doneN = items.length - open.length;
    var yk = isDev(items[0]) ? "" : (isCommon(g.company) ? "" : yearOfCompany(g.company));
    var next = open.filter(function(e){ return e.date; })[0];
    return '<article class="card'+(late(items)?' late':'')+'" style="--h:'+hue(g.company)+'">'+
      '<header><span class="dot"></span><h3>'+esc(g.company)+'</h3>'+
        (yk?'<span class="yb">'+YEAR_LABEL[yk]+'</span>':'')+(isDev(items[0])?'<span class="yb dev">개발팀</span>':'')+
        '<span class="n">'+open.length+'건</span></header>'+
      (next?'<p class="nx">다음 <b>'+esc(next.title)+'</b> · '+md(next.date)+' <span class="dd">'+dday(next)+'</span></p>':'<p class="nx none">남은 일정 없음</p>')+
      '<ul class="tl">'+items.slice(0,10).map(function(e){
        var k = stageOf(e), span = e.start && e.date && e.start < e.date;
        return '<li class="'+(e.status==="done"?'done ':'')+(isLate(e)?'late ':'')+'" data-id="'+esc(e.id)+'" tabindex="0">'+
          '<b class="sb"'+stageStyle(k)+' title="'+STAGE[k].n+'">'+(k==="0"?"·":k)+'</b>'+
          '<span class="t">'+esc(e.title)+'</span>'+
          '<span class="p">'+(e.date ? (span ? md(e.start)+" → "+md(e.date) : md(e.date)) : "날짜 미정")+'</span>'+
          '<span class="s s-'+e.status+'">'+(e.status==="done"?"완료":dday(e))+'</span></li>';
      }).join("")+'</ul>'+
      (items.length>10?'<p class="more">외 '+(items.length-10)+'건</p>':'')+
      (doneN?'<p class="dn">완료 '+doneN+'건</p>':'')+'</article>';
  }
  function renderPlan(){
    var vis = visible();
    var from = S.cursor.slice(0,7);
    $("period").innerHTML = "일정설계<small>"+S.events.length+"+"+(S.dev?S.devEvents.length:0)+"건</small>";
    var groups = groupCompany(vis);
    groups.sort(function(a,b){
      var ao = a.items.filter(function(e){ return e.status!=="done"; }), bo = b.items.filter(function(e){ return e.status!=="done"; });
      return late(b.items)-late(a.items) || bo.length-ao.length || a.company.localeCompare(b.company,"ko");
    });
    $("view").innerHTML = legendHTML()+'<section class="cards" aria-label="업체별 일정 카드">'+
      (groups.length ? groups.map(planCard).join("") : '<p class="none">조건에 맞는 일정이 없습니다.</p>')+'</section>';
  }

  // =====================================================================
  //  기간 중인 일 — 시작일·마감일이 있는 일정만. 오늘 기준
  // =====================================================================
  function ddTag(e){ var x = dday(e); return x ? '<span class="tag'+(/밀림/.test(x)?' u':(x==="오늘"||/^D-[0-3]$/.test(x))?' e':' p')+'">'+x+'</span>' : ''; }
  function groupsByDate(list, key, desc){
    var m = {}, order = [];
    list.forEach(function(e){ if (!m[e.company]){ m[e.company] = []; order.push(e.company); } m[e.company].push(e); });
    var cmp = function(a,b){ var x=(a[key]||""), y=(b[key]||""); return desc ? y.localeCompare(x) : x.localeCompare(y); };
    var gs = order.map(function(c){ return {company:c, items:m[c].slice().sort(function(a,b){ return cmp(a,b) || a.title.localeCompare(b.title,"ko"); })}; });
    gs.sort(function(a,b){ return cmp(a.items[0], b.items[0]) || a.company.localeCompare(b.company,"ko"); });
    return gs;
  }
  function renderSpan(){
    var t = todayStr();
    var all = visible().filter(function(e){ return isSpan(e) && e.status!=="done"; });
    var now  = all.filter(function(e){ return e.start<=t && e.date>=t; });
    var soon = all.filter(function(e){ return e.start>t; });
    var over = all.filter(function(e){ return e.date<t; });
    $("period").innerHTML = "기간 중인 일<small>"+md(t)+" 기준 "+now.length+"건</small>";
    var tagNow = function(e){ if (e.date===t) return ''; var x = dday(e); return /밀림/.test(x) ? ddTag(e) : '<span class="tag'+(/^D-[0-3]$/.test(x)?' e':' p')+'">마감 '+x+'</span>'; };
    var tagSoon = function(e){ return '<span class="tag p">D-'+Math.round((parse(e.start)-parse(t))/864e5)+' 시작</span>'; };
    var sec = function(title, hint, list, groups, fn){
      return '<div class="panel spanp"><h2>'+title+' <span class="n">'+list.length+'</span><span class="hint">'+hint+'</span></h2>'+
        (list.length ? groupsHTML(list, false, t, fn, groups) : '<p class="none">해당 일정이 없습니다.</p>')+'</div>';
    };
    $("view").innerHTML = legendHTML()+'<section class="listview">'+
      sec("지금 기간 중", "오늘이 시작일~마감일 사이 · 마감 가까운 순", now, groupsByDate(now,"date"), tagNow)+
      sec("시작 전", "시작일 가까운 순", soon, groupsByDate(soon,"start"), tagSoon)+
      (over.length ? sec("기간 지남 · 미완료", "마감일이 지났는데 완료 안 됨", over, groupsByDate(over,"date"), tagNow) : '')+
      '</section>';
  }

  // =====================================================================
  //  완료 — 완료된 일정만, 업체별 (최근 마감일 순). 「완료 숨기기」와 상관없이 보임
  // =====================================================================
  function renderDone(){
    var list = visible(true).filter(function(e){ return e.status==="done"; });
    var groups = groupsByDate(list, "date", true);
    $("period").innerHTML = "완료<small>"+list.length+"건</small>";
    $("view").innerHTML = legendHTML()+'<section class="listview">'+
      '<div class="panel"><h2>완료된 일정 <span class="n">'+list.length+'</span><span class="hint">업체별 · 최근 마감일 순 · 「완료」를 누르면 예정으로 되돌림</span></h2>'+
      (list.length ? groupsHTML(list, true, null, null, groups) : '<p class="none">완료된 일정이 없습니다. 일정의 상태 버튼을 눌러 「완료」로 바꾸면 여기에 모입니다.</p>')+
      '</div></section>';
  }

  // =====================================================================
  //  스케줄 리스트 — 날짜별 할 일 목록, 체크하면 완료
  //  기간 일정은 오늘이 기간 안이면 「오늘」에, 아니면 마감일에 한 번만 보인다
  // =====================================================================
  var KDOW = DOW;
  function listKey(e, t){
    if (!e.date) return "none";
    if (e.status!=="done" && e.date < t) return "late";
    if (isSpan(e) && e.start<=t && e.date>=t) return t;
    return e.date;
  }
  function checkRow(e, t){
    var dev = isDev(e), done = e.status==="done", span = isSpan(e);
    var tags = (e.urgent&&!done?'<span class="tag u">긴급</span>':'')+
      (span ? '<span class="tag s">기간 '+md(e.start)+'–'+md(e.date)+'</span>' : '')+
      (!done && e.date ? ddTag(e) : '');
    return '<li class="ck'+(done?' done':'')+(isLate(e)?' late':'')+'">'+
      '<label class="cb"><input type="checkbox" data-check="'+esc(e.id)+'"'+(done?' checked':'')+(dev?' disabled title="개발팀 일정은 읽기 전용"':'')+' aria-label="'+esc(e.company+" "+e.title)+' 완료"></label>'+
      '<div class="ckb" data-id="'+esc(e.id)+'" role="button" tabindex="0">'+
        '<div class="ckt">'+badge(e)+esc(e.title)+'</div>'+
        '<div class="ckm"><span class="dot" style="--h:'+hue(e.company)+'"></span>'+esc(e.company)+tags+(e.note?'<span class="nt">'+esc(e.note)+'</span>':'')+'</div>'+
      '</div></li>';
  }
  function renderList(){
    var t = todayStr(), tm = addDays(t,1);
    var vis = visible().filter(function(e){ return !(e.status==="done" && e.date && e.date < t); });   // 지난 완료 일은 「완료」 탭에서
    var m = {};
    vis.forEach(function(e){ var k = listKey(e, t); (m[k] = m[k] || []).push(e); });
    var keys = Object.keys(m).filter(function(k){ return k!=="late" && k!=="none"; }).sort();
    var order = (m.late?["late"]:[]).concat(keys).concat(m.none?["none"]:[]);
    var openN = vis.filter(function(e){ return e.status!=="done"; }).length;
    $("period").innerHTML = "스케줄 리스트<small>남은 일 "+openN+"건</small>";
    var sortL = function(a,b){ var o={doing:0,todo:1,done:2}; return o[a.status]-o[b.status] || (b.urgent?1:0)-(a.urgent?1:0) || a.company.localeCompare(b.company,"ko") || a.title.localeCompare(b.title,"ko"); };
    var head = function(k){
      if (k==="late") return '<span class="lh late">밀린 일</span>';
      if (k==="none") return '<span class="lh">날짜 미정</span>';
      var lbl = k===t ? '오늘' : k===tm ? '내일' : '';
      return '<span class="lh'+(k===t?' today':'')+'">'+(lbl?lbl+' · ':'')+md(k)+' ('+KDOW[dowIdx(k)]+')</span>';
    };
    var h = '<section class="listview checklist">';
    if (!order.length) h += '<div class="panel"><p class="none">조건에 맞는 일정이 없습니다.</p></div>';
    order.forEach(function(k){
      var items = m[k].slice().sort(sortL);
      var left = items.filter(function(e){ return e.status!=="done"; }).length;
      h += '<div class="panel"><h2>'+head(k)+' <span class="n">'+left+(left!==items.length?' / '+items.length:'')+'</span>'+(k===t?'<span class="hint">기간 중인 일도 포함 · 체크하면 완료</span>':'')+'</h2>'+
        '<ul class="cklist">'+items.map(function(e){ return checkRow(e, t); }).join("")+'</ul></div>';
    });
    $("view").innerHTML = h+'</section>';
  }
  function setStatus(id, s){
    var e = find(id); if (!e || !S.store || isDev(e)) return;
    e.status = s; render();
    write(id, function(){ return S.store.patch(id, {status:s, updatedAt:new Date().toISOString()}); }).catch(writeError);
  }
  $("view").addEventListener("change", function(ev){
    var c = ev.target.closest && ev.target.closest("[data-check]"); if (!c) return;
    var e = find(c.getAttribute("data-check"));
    if (!S.store){ c.checked = !c.checked; showBanner("저장소에 연결되지 않아 지금은 바꿀 수 없습니다. 새로고침해 보세요."); return; }
    setStatus(c.getAttribute("data-check"), c.checked ? "done" : "todo");
    if (e) showBanner(c.checked ? "「"+e.title+"」 완료로 바꿨습니다." : "「"+e.title+"」 다시 예정으로 돌렸습니다.", true);
  });

  function companyNames(){
    var set = {}; allEvents().forEach(function(e){ if(e.company) set[e.company]=1; });
    return Object.keys(set).sort(function(a,b){ return a.localeCompare(b,"ko"); });
  }
  function fillCompanies(){
    var names = companyNames(), set = {}; names.forEach(function(n){ set[n]=1; });
    var opt = function(n){ return '<option value="'+esc(n)+'">'+esc(n)+'</option>'; };
    var common = names.filter(function(n){ return isCommon(n) || n === DEV; });
    $("company").innerHTML = '<option value="">전체 업체</option>'+common.map(opt).join("")+
      YEARS.map(function(y){
        if (S.year && S.year !== y.k) return "";
        var ns = names.filter(function(n){ return !isCommon(n) && n !== DEV && yearOfCompany(n)===y.k; });
        return ns.length ? '<optgroup label="'+y.n+'">'+ns.map(opt).join("")+'</optgroup>' : "";
      }).join("");
    if (S.company && (!set[S.company] || (S.year && !isCommon(S.company) && S.company !== DEV && yearOfCompany(S.company)!==S.year))) S.company = "";
    $("companyList").innerHTML = names.map(function(n){ return '<option value="'+esc(n)+'"></option>'; }).join("");
  }

  // ---- 이동
  function move(dir){
    if (S.view==="plan" || S.view==="span" || S.view==="done" || S.view==="list") return;
    if (S.view==="month"){ var c=parse(S.cursor); S.cursor = ymd(new Date(c.getFullYear(), c.getMonth()+dir, 1)); }
    else S.cursor = addDays(S.cursor, S.view==="week"?7*dir:dir);
    render();
  }
  function openDay(d){ S.view="day"; S.cursor=d; savePrefs(); render(); window.scrollTo({top:0}); }

  $("prev").onclick = function(){ move(-1); };
  $("next").onclick = function(){ move(1); };
  // 「오늘」: 어느 화면에서 누르든 오늘 하루(일간)만 보여 준다
  function goToday(){
    S.view = "day"; S.cursor = todayStr(); savePrefs(); render();
    window.scrollTo({top: 0, behavior: "smooth"});
  }
  $("today").onclick = goToday;
  document.querySelectorAll(".seg button").forEach(function(b){ b.onclick = function(){ S.view=b.dataset.view; savePrefs(); render(); }; });
  $("company").onchange = function(){ S.company=this.value; savePrefs(); render(); };
  document.querySelectorAll("#yearSeg button").forEach(function(b){ b.onclick = function(){
    var k = b.dataset.year||""; S.year = k; savePrefs(); fillCompanies(); render();
  }; });
  $("yearMgr").onclick = function(){ openYearDialog(); };
  $("hideDone").onchange = function(){ S.hideDone=this.checked; savePrefs(); render(); };
  var qt; $("q").addEventListener("input", function(){ var v=this.value; clearTimeout(qt); qt=setTimeout(function(){ S.q=v; render(); }, 180); });
  $("q").addEventListener("search", function(){ S.q=this.value; render(); });
  $("devToggle").onchange = function(){ S.dev=this.checked; savePrefs(); fillCompanies(); render(); };
  $("add").onclick = function(){ openForm(null); };

  $("view").addEventListener("click", function(ev){
    var t = ev.target;
    var lg = t.closest("[data-stage]"); if (lg){ var k = lg.getAttribute("data-stage"); S.stage = (S.stage===k? "" : k); savePrefs(); render(); return; }
    var tg = t.closest("[data-toggle]"); if (tg){ toggleStatus(tg.getAttribute("data-toggle")); return; }
    var it = t.closest("[data-id]"); if (it){ openForm(find(it.getAttribute("data-id"))); return; }
    var dy = t.closest("[data-day]"); if (dy){ openDay(dy.getAttribute("data-day")); }
  });
  $("view").addEventListener("keydown", function(ev){
    if ((ev.key==="Enter"||ev.key===" ") && ev.target.classList.contains("cell")){ ev.preventDefault(); openDay(ev.target.getAttribute("data-day")); }
  });
  document.addEventListener("keydown", function(ev){
    if ($("dlg").open || /INPUT|SELECT|TEXTAREA/.test((ev.target.tagName||""))) return;
    if (ev.metaKey||ev.ctrlKey||ev.altKey) return;
    if (ev.key==="ArrowLeft") move(-1);
    else if (ev.key==="ArrowRight") move(1);
    else if (ev.key==="t") goToday();
    else if (ev.key==="m"||ev.key==="w"||ev.key==="d") { S.view={m:"month",w:"week",d:"day"}[ev.key]; savePrefs(); render(); }
    else if (ev.key==="n") openForm(null);
  });
  var rt; window.addEventListener("resize", function(){ clearTimeout(rt); rt=setTimeout(function(){ if(S.view==="month") render(); }, 150); });

  function find(id){ return allEvents().filter(function(e){ return e.id===id; })[0]||null; }

  // ---- 쓰기 (문서마다 한 번에 하나씩)
  var queues = {};
  function write(id, fn){
    var prev = queues[id] || Promise.resolve();
    var next = prev.then(fn, fn);
    queues[id] = next.catch(function(){});
    return next;
  }
  function writeError(e){
    var msg = (e && /Failed to fetch|NetworkError/i.test(e.message||"")) ? "인터넷 연결을 확인한 뒤 다시 시도하세요." :
              "저장하지 못했습니다. 잠시 뒤 다시 시도하세요." + (e && e.message ? " ("+e.message+")" : "");
    showBanner(msg);
  }
  function toggleStatus(id){
    var e = find(id); if (!e || !S.store) return;
    var s = NEXT[e.status];
    e.status = s; render();   // 바로 반영, 저장 결과는 실시간으로 다시 들어옴
    write(id, function(){ return S.store.patch(id, {status:s, updatedAt:new Date().toISOString()}); }).catch(writeError);
  }

  // ---- 입력 창
  function openForm(e){
    if (isDev(e)){ showBanner("개발팀 일정은 읽기 전용입니다. 개발팀 업무보드에서 바뀝니다."+(e.note?" — "+e.note:"")); return; }
    if (!S.store){ showBanner("저장소에 연결되지 않아 지금은 추가·수정할 수 없습니다. 새로고침해 보세요."); return; }
    S.editing = e ? e.id : null;
    $("dlgTitle").textContent = e ? "일정 수정" : "일정 추가";
    $("fDate").value = e ? (e.date||"") : S.cursor;
    $("fStart").value = e && e.start ? e.start : "";
    $("fCompany").value = e ? e.company : (S.company||"");
    $("fTitle").value = e ? e.title : "";
    $("fNote").value = e ? (e.note||"") : "";
    $("fStage").value = e && STAGE[e.stage] ? e.stage : "";
    yearHint();
    stageHint();
    $("fUrgent").checked = !!(e && e.urgent);
    var st = e ? e.status : "todo";
    document.querySelectorAll('input[name="fStatus"]').forEach(function(r){ r.checked = r.value===st; });
    $("fDel").hidden = !e; $("fErr").textContent = ""; closeCoList();
    $("dlg").showModal();
    setTimeout(function(){ (e ? $("fTitle") : ($("fCompany").value ? $("fTitle") : $("fCompany"))).focus(); }, 0);
  }
  $("fCancel").onclick = function(){ $("dlg").close(); };
  function stageHint(){ var g = STAGE[guessStage($("fTitle").value)]; $("fStageAuto").textContent = "자동 (제목 보고 판단: "+g.n+")"; }
  $("fTitle").addEventListener("input", stageHint);
  // 업체 이름을 적으면 그 업체의 사업 구분을 보여 준다. 처음 보는 업체는 2026년 사업으로 둔다
  function knownCompany(name){ var k = coKey(name); return !!S.yearSet[k] || !!DEFAULT_YEAR[k] || companyNames().some(function(n){ return coKey(n)===k; }); }
  function yearHint(){
    var name = $("fCompany").value.trim();
    $("fYearRow").hidden = !name || isCommon(name);
    if (!name || isCommon(name)) return;
    $("fYear").value = knownCompany(name) ? yearOfCompany(name) : "2026";
    $("fYearNote").textContent = knownCompany(name) ? "바꾸면 이 업체의 모든 일정에 적용됩니다" : "새 업체 — 저장하면 이 구분으로 등록됩니다";
  }
  $("fCompany").addEventListener("input", yearHint);
  $("fCompany").addEventListener("change", yearHint);

  // ---- 업체 고르기 목록: 브라우저 기본 자동완성 대신 입력 창 아래에 직접 펼친다
  var coActive = -1;
  function coOptions(){ return Array.prototype.slice.call($("fCoList").querySelectorAll("button[data-co]")); }
  function renderCoList(){
    var raw = $("fCompany").value.trim(), q = coKey(raw).toLowerCase();
    var cnt = {}; S.events.forEach(function(e){ cnt[e.company]=(cnt[e.company]||0)+1; });
    var names = companyNames().filter(function(n){ return !q || coKey(n).toLowerCase().indexOf(q) >= 0; });
    var btn = function(n){ return '<button type="button" role="option" data-co="'+esc(n)+'"><span class="dot" style="--h:'+hue(n)+'"></span>'+esc(n)+'<small>'+(cnt[n]||0)+'건</small></button>'; };
    var h = "";
    var common = names.filter(function(n){ return isCommon(n) || n === DEV; });
    if (common.length) h += common.map(btn).join("");
    YEARS.forEach(function(y){
      var ns = names.filter(function(n){ return !isCommon(n) && n !== DEV && yearOfCompany(n)===y.k; });
      if (ns.length) h += '<div class="cg">'+y.n+'</div>'+ns.map(btn).join("");
    });
    var exact = companyNames().some(function(n){ return coKey(n)===coKey(raw); });
    if (raw && !exact) h += '<div class="cg">새 업체</div><button type="button" role="option" class="new" data-co="'+esc(raw)+'">「'+esc(raw)+'」 새 업체로 추가</button>';
    if (!h) h = '<p class="none">업체가 없습니다. 이름을 적어 주세요.</p>';
    $("fCoList").innerHTML = h;
    coActive = -1;
  }
  function openCoList(){ renderCoList(); $("fCoList").hidden = false; $("fCompany").setAttribute("aria-expanded","true"); }
  function closeCoList(){ $("fCoList").hidden = true; $("fCompany").setAttribute("aria-expanded","false"); coActive = -1; }
  function pickCompany(name){
    $("fCompany").value = name; closeCoList(); yearHint();
    $("fTitle").focus();
  }
  function markActive(){
    var opts = coOptions();
    opts.forEach(function(b, i){ b.classList.toggle("on", i===coActive); });
    if (opts[coActive]) opts[coActive].scrollIntoView({block:"nearest"});
  }
  $("fCompany").addEventListener("focus", openCoList);
  $("fCompany").addEventListener("click", function(){ if ($("fCoList").hidden) openCoList(); });
  $("fCompany").addEventListener("input", openCoList);
  $("fCompany").addEventListener("blur", function(){ setTimeout(function(){ if (document.activeElement !== $("fCompany")) closeCoList(); }, 150); });
  $("fCompany").addEventListener("keydown", function(ev){
    var opts = coOptions();
    if (ev.key === "ArrowDown"){ ev.preventDefault(); if ($("fCoList").hidden) openCoList(); opts = coOptions(); coActive = Math.min(opts.length-1, coActive+1); markActive(); }
    else if (ev.key === "ArrowUp"){ ev.preventDefault(); coActive = Math.max(0, coActive-1); markActive(); }
    else if (ev.key === "Enter" && !$("fCoList").hidden && opts[coActive]){ ev.preventDefault(); pickCompany(opts[coActive].getAttribute("data-co")); }
    else if (ev.key === "Escape" && !$("fCoList").hidden){ ev.preventDefault(); ev.stopPropagation(); closeCoList(); }
  });
  $("fCoList").addEventListener("mousedown", function(ev){ ev.preventDefault(); });
  $("fCoList").addEventListener("click", function(ev){ var b = ev.target.closest("[data-co]"); if (b) pickCompany(b.getAttribute("data-co")); });
  $("fCoToggle").addEventListener("mousedown", function(ev){ ev.preventDefault(); });
  $("fCoToggle").addEventListener("click", function(){ if ($("fCoList").hidden){ $("fCompany").focus(); openCoList(); } else closeCoList(); });
  function setCompanyYear(name, year){
    var k = coKey(name); if (!k || isCommon(name) || !YEAR_KEYS[year] || !S.store) return Promise.resolve();
    if (S.yearSet[k] ? S.yearSet[k].year===year : (DEFAULT_YEAR[k]||"이전")===year && knownCompany(name)) return Promise.resolve();
    var id = S.yearSet[k] ? S.yearSet[k].id : "cfg-year-" + Array.from(new TextEncoder().encode(k)).map(function(b){ return b.toString(16); }).join("");
    S.yearSet[k] = {id:id, year:year};
    fillCompanies(); render();
    return write(id, function(){ return S.store.save(id, {
      title:"[설정] 사업 구분", company:name, date:"", status:"todo", urgent:false, note:year, source:"setting", updatedAt:new Date().toISOString()
    }); });
  }

  // ---- 사업 구분 관리 창
  function openYearDialog(){
    if (!S.store){ showBanner("저장소에 연결되지 않아 지금은 바꿀 수 없습니다. 새로고침해 보세요."); return; }
    renderYearList(); $("yDlg").showModal();
  }
  function renderYearList(){
    var names = companyNames().filter(function(n){ return !isCommon(n); });
    var cnt = {}; S.events.forEach(function(e){ cnt[e.company]=(cnt[e.company]||0)+1; });
    $("yList").innerHTML = YEARS.map(function(y){
      var ns = names.filter(function(n){ return yearOfCompany(n)===y.k; });
      return '<div class="ygrp"><h4>'+y.n+' <span>'+ns.length+'곳</span></h4>'+(ns.length? ns.map(function(n){
        return '<div class="yrow"><span class="dot" style="--h:'+hue(n)+'"></span><span class="yn">'+esc(n)+' <small>'+cnt[n]+'건</small></span>'+
          '<span class="yseg" role="group" aria-label="'+esc(n)+' 사업 구분">'+YEARS.map(function(o){
            return '<button type="button" data-co="'+esc(n)+'" data-y="'+o.k+'" aria-pressed="'+(o.k===y.k)+'">'+(o.k==="2026"?"2026년":o.k==="이전"?"이전":"확인 필요")+'</button>';
          }).join("")+'</span></div>';
      }).join("") : '<p class="none">없음</p>')+'</div>';
    }).join("");
  }
  $("yList").addEventListener("click", function(ev){
    var b = ev.target.closest("[data-y]"); if (!b) return;
    setCompanyYear(b.getAttribute("data-co"), b.getAttribute("data-y")).catch(writeError);
    renderYearList();
  });
  $("yClose").onclick = function(){ $("yDlg").close(); };
  $("form").addEventListener("submit", function(ev){
    ev.preventDefault();
    var date = $("fDate").value, start = $("fStart").value, company = $("fCompany").value.trim(), title = $("fTitle").value.trim();
    if (!company){ $("fErr").textContent = "업체를 적어 주세요. 업체가 없는 일은 「공통」으로 적습니다."; $("fCompany").focus(); return; }
    if (!title){ $("fErr").textContent = "할 일을 적어 주세요."; $("fTitle").focus(); return; }
    if (!date){ $("fErr").textContent = "날짜를 골라 주세요."; $("fDate").focus(); return; }
    if (start && start > date){ $("fErr").textContent = "시작일이 마감 날짜보다 늦습니다."; $("fStart").focus(); return; }
    var old = S.editing ? find(S.editing) : null;
    var body = {
      title:title, company:company, date:date, status:(document.querySelector('input[name="fStatus"]:checked')||{}).value||"todo",
      urgent:$("fUrgent").checked, note:$("fNote").value.trim(), stage:$("fStage").value, updatedAt:new Date().toISOString(),
      source: old && old.source ? old.source : "manual"
    };
    if (start && start !== date) body.start = start;
    if (old && old.notionId) body.notionId = old.notionId;
    var id = S.editing || newId();
    var isNew = !S.editing;
    if (!isCommon(company) && !$("fYearRow").hidden) setCompanyYear(company, $("fYear").value).catch(writeError);
    // 화면에는 바로 반영하고 창을 닫는다. 시트 저장은 뒤에서 이어서 한다.
    var saving = write(id, function(){ return S.store.save(id, body); });
    $("dlg").close();
    if (isNew) S.cursor = date;
    revealEvent(Object.assign({id:id}, body));
    setSync("저장 중…", true);
    saving.then(function(){ showBanner("저장했습니다 · 팀원 달력에도 곧 보입니다", true); updateSync(); })
          .catch(function(e){ writeError(e); updateSync(); });
  });
  // 새로 넣은 일정이 필터에 가려지면 가리는 필터를 풀어 준다
  function revealEvent(e){
    var why = [];
    S.flash = e.id; clearTimeout(revealEvent.t); revealEvent.t = setTimeout(function(){ S.flash = null; render(); }, 6000);
    if (S.q && !hit(e)){ S.q = ""; if ($("q")) $("q").value = ""; why.push("검색"); }
    if (S.company && e.company !== S.company){ S.company = ""; why.push("업체"); }
    if (S.year && !isCommon(e.company) && yearOfCompany(e.company) !== S.year){ S.year = ""; why.push("사업 구분"); }
    if (S.stage && stageOf(e) !== S.stage){ S.stage = ""; why.push("단계"); }
    if (S.hideDone && e.status === "done"){ S.hideDone = false; why.push("완료 숨기기"); }
    savePrefs(); fillCompanies(); render();
    if (why.length) setTimeout(function(){ showBanner(why.join("·") + " 필터 때문에 안 보여서 필터를 풀었습니다.", true); }, 50);
  }
  $("fDel").onclick = function(){
    var id = S.editing; if (!id) return;
    var e = find(id);
    if (!confirm("「"+(e?e.company+" · "+e.title:"이 일정")+"」을 지울까요?"+(S.store&&S.store.shared?" 모든 팀원 달력에서 사라집니다.":""))) return;
    write(id, function(){ return S.store.remove(id); }).then(function(){ $("dlg").close(); }).catch(function(e){ writeError(e); $("dlg").close(); });
  };

  function showBanner(msg, ok){ var b=$("banner"); b.textContent=msg; b.classList.toggle("ok", !!ok); b.hidden=false; clearTimeout(showBanner.t); showBanner.t=setTimeout(function(){ b.hidden=true; }, 6000); }
  function setSync(text, live){ var s=$("sync"); s.classList.toggle("live", !!live); s.querySelector("span").textContent=text; }

  // =====================================================================
  //  저장소 — 구글 시트 (Apps Script 웹 앱). 링크만 있으면 누구나 보기·추가·수정
  // =====================================================================
  var CFG = window.BIZCAL_CONFIG || {};
  var POLL_MS = 4000;
  var CACHE_KEY = "bizcal.cache.v1";

  function newId(){ return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function norm(o){
    return {
      id:String(o.id), title:String(o.title||""), company:String(o.company||"공통"), date:String(o.date||""), start:o.start?String(o.start):"",
      status: STL[o.status]?o.status:"todo", urgent:o.urgent===true||String(o.urgent).toUpperCase()==="TRUE", note:String(o.note||""),
      source:o.source||"", notionId:o.notionId||"", stage:STAGE[String(o.stage||"")]?String(o.stage):"", updatedAt:o.updatedAt||""
    };
  }

  function SheetStore(url){
    var map = {}, listener = null, pending = 0, lastOk = null, gen = 0;
    function emit(){ listener && listener(Object.keys(map).map(function(k){ return norm(map[k]); })); }
    function fetchAll(){
      var g = gen;   // 받아 오는 사이에 저장이 있었으면 이 결과는 버린다(방금 넣은 일정이 사라지지 않게)
      return fetch(url + (url.indexOf("?")<0?"?":"&") + "t=" + Date.now(), {cache:"no-store", redirect:"follow"})
        .then(function(res){ if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
        .then(function(body){
          if (!body.ok) throw new Error(body.error || "불러오기 실패");
          if (pending || g !== gen) return;
          map = {}; body.rows.forEach(function(o){ if (o.id) map[o.id] = o; });
          try { localStorage.setItem(CACHE_KEY, JSON.stringify(body.rows)); } catch(e){}
          lastOk = new Date(); emit();
        });
    }
    function send(op, id, data){
      pending++; gen++;
      return fetch(url, { method:"POST", redirect:"follow", headers:{"Content-Type":"text/plain;charset=utf-8"},
                          body: JSON.stringify({op:op, id:id, data:data||{}}) })
        .then(function(res){ if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
        .then(function(body){ if (!body.ok) throw new Error(body.error || "저장 실패"); })
        .then(function(){ pending--; lastOk = new Date(); return fetchAll().catch(function(){}); },
              function(e){ pending--; fetchAll().catch(function(){}); throw e; });
    }
    return {
      lastOk: function(){ return lastOk; },
      start: function(onData, cached){
        listener = onData;
        if (cached && cached.length){ cached.forEach(function(o){ if (o && o.id) map[o.id] = o; }); emit(); setSync("최신 일정 불러오는 중…", true); }
        document.addEventListener("visibilitychange", function(){ if (!document.hidden) fetchAll().catch(function(){}); });
        window.addEventListener("focus", function(){ if (!pending) fetchAll().catch(function(){}); });
        window.addEventListener("online", function(){ fetchAll().catch(function(){}); });
        setInterval(function(){ if (!document.hidden && !pending) fetchAll().catch(function(){}); }, POLL_MS);
        return fetchAll();
      },
      save: function(id, body){ map[id] = Object.assign({id:id}, body); emit(); return send("save", id, body); },
      patch: function(id, fields){ if (map[id]) Object.assign(map[id], fields); emit(); return send("patch", id, fields); },
      remove: function(id){ delete map[id]; emit(); return send("remove", id); },
      reload: function(){ fetchAll().catch(function(){}); }
    };
  }

  // ---- 시작: 먼저 빈 달력을 그리고, 시트를 읽어 채운다
  render();
  function pad2(n){ return (n<10?"0":"")+n; }
  function onData(list){
    var ev = [], ys = {};
    list.forEach(function(o){
      if (o.source === "setting"){ var k = coKey(o.company); if (k && YEAR_KEYS[o.note]) ys[k] = {id:o.id, year:o.note}; }
      else ev.push(o);
    });
    S.events = ev; S.yearSet = ys; S.ready = true; fillCompanies(); render(); updateSync();
    if ($("yDlg").open) renderYearList();
  }
  $("sync").title = "눌러서 지금 새로고침";
  $("sync").style.cursor = "pointer";
  $("sync").addEventListener("click", function(){ if (S.store){ setSync("새로고침 중…", true); S.store.reload(); } });
  function updateSync(){
    if (!S.store) return;
    var t = S.store.lastOk();
    setSync("팀원과 공유 중 · " + S.events.length + "건" + (t ? " · " + pad2(t.getHours()) + ":" + pad2(t.getMinutes()) + " 동기화" : ""), true);
  }

  // ---- 개발팀 일정(사본) 불러오기: data/dev-schedule.json 이 있으면 읽기 전용으로 합친다
  var DEV_STATUS = {"대기":"todo", "진행중":"doing", "보류":"todo", "완료":"done"};
  function loadDev(){
    return fetch("data/dev-schedule.json?t=" + Date.now(), {cache:"no-store"})
      .then(function(r){ if (!r.ok) throw new Error("no dev file"); return r.json(); })
      .then(function(body){
        var list = body["일정"] || [];
        S.devInfo = { 생성: body["생성"] || "", 건수: list.length, 정본: body["정본"] || "" };
        S.devEvents = list.map(function(o, i){
          var due = o["기한"] || o["완료"] || "";
          var st = DEV_STATUS[o["상태"]] || "todo";
          var note = [o["담당"] ? "담당 " + o["담당"] : "", o["진행률"] ? o["진행률"] + "%" : "", o["메모"] || ""].filter(Boolean).join(" · ");
          return { id:"dev-" + (o["번호"] || i), title:String(o["제목"]||""), company:DEV, date:String(due), start:o["시작"] && o["시작"] !== due ? String(o["시작"]) : "",
                   status:st, urgent:o["우선순위"]==="urgent", note:note, source:"dev", notionId:"", stage:"", updatedAt:body["생성"]||"" };
        }).filter(function(e){ return e.title && e.date; });
        fillCompanies(); render();
      })
      .catch(function(){ S.devEvents = []; });
  }
  loadDev();

  // =====================================================================
  //  알람 — 평일 09:00 「금일 일정을 확인해주세요」, 18:00 「익일 일정을 추가해주세요」
  //  달력을 열어 둔 동안(다른 탭에 있어도) 하루 한 번씩 뜬다
  // =====================================================================
  var ALARM_KEY = "bizcal.alarm.";
  function alarmSeen(k){ try { return localStorage.getItem(ALARM_KEY + todayStr() + "." + k) === "1"; } catch(e){ return false; } }
  function markAlarm(k){ try { localStorage.setItem(ALARM_KEY + todayStr() + "." + k, "1"); } catch(e){} }
  function nextWorkday(){ var d = addDays(todayStr(), 1); while (isWeekendDay(d)) d = addDays(d, 1); return d; }
  function ourEvents(){ return S.events.filter(function(e){ return e.status !== "done"; }); }
  function alarmInfo(k){
    var t = todayStr();
    if (k === "am"){
      var today = ourEvents().filter(function(e){ return e.date === t; });
      var late = ourEvents().filter(isLate);
      return { title:"금일 일정을 확인해주세요", sub:md(t)+" ("+DOW[dowIdx(t)]+") · 오늘 마감 "+today.length+"건 · 밀린 일 "+late.length+"건",
               list: late.concat(today).slice(0,6), go:"오늘 일정 보기", date:t };
    }
    var n = nextWorkday(), nx = ourEvents().filter(function(e){ return e.date === n; });
    return { title:"익일 일정을 추가해주세요", sub:"오늘 한 일을 완료로 바꾸고, "+md(n)+" ("+DOW[dowIdx(n)]+") 일정을 넣어 주세요 · 지금 "+nx.length+"건",
             list: nx.slice(0,6), go:"+ "+md(n)+" 일정 추가", date:n };
  }
  function showAlarm(k){
    var a = alarmInfo(k), d = $("alarm");
    $("alarmTitle").textContent = a.title;
    $("alarmSub").textContent = a.sub;
    $("alarmList").innerHTML = a.list.length ? a.list.map(function(e){
      return '<li><span class="dot" style="--h:'+hue(e.company)+'"></span><b>'+esc(e.company)+'</b> '+esc(e.title)+(isLate(e)?' <span class="lt">'+md(e.date)+' 밀림</span>':'')+'</li>';
    }).join("") : '<li class="none">'+(k==="am"?"오늘 마감인 일정이 없습니다.":"아직 들어간 일정이 없습니다.")+'</li>';
    $("alarmGo").textContent = a.go;
    $("alarmGo").onclick = function(){
      d.close();
      if (k === "am"){ goToday(); }
      else { S.cursor = a.date; render(); openForm(null); $("fDate").value = a.date; }
    };
    $("alarmLater").onclick = function(){ d.close(); };
    d.dataset.kind = k;
    if (!d.open) d.showModal();
    markAlarm(k);
    try {
      if (window.Notification && Notification.permission === "granted" && document.hidden){
        var no = new Notification("사업팀 달력 — " + a.title, { body: a.sub, tag: "bizcal-" + k });
        no.onclick = function(){ window.focus(); no.close(); };
      }
    } catch(e){}
  }
  function checkAlarm(){
    if (!S.ready || $("dlg").open || $("alarm").open || $("yDlg").open) return;
    var now = new Date(), g = now.getDay(), hm = now.getHours() * 60 + now.getMinutes();
    if (g === 0 || g === 6) return;                          // 주말은 쉼
    if (hm >= 18*60 && !alarmSeen("pm")) showAlarm("pm");
    else if (hm >= 9*60 && hm < 18*60 && !alarmSeen("am")) showAlarm("am");
  }
  setInterval(checkAlarm, 30000);
  setTimeout(checkAlarm, 4000);
  function bellLabel(){
    var b = $("bellBtn"); if (!b) return;
    var on = window.Notification && Notification.permission === "granted";
    b.textContent = on ? "알림 켜짐" : "알림 켜기";
    b.classList.toggle("on", !!on);
  }
  $("bellBtn").onclick = function(){
    if (window.Notification && Notification.permission === "default"){
      Notification.requestPermission().then(function(){ bellLabel(); showBanner("평일 09:00·18:00에 알림이 뜹니다. 달력 탭을 열어 두세요.", true); });
    } else {
      showAlarm(new Date().getHours() >= 18 ? "pm" : "am");
    }
  };
  bellLabel();

  if (!CFG.apiUrl){
    setSync("저장 서버 주소(config.js)가 비어 있어 보기만 가능합니다"); $("add").disabled = true;
    fetch("data/events.json", {cache:"no-store"}).then(function(r){ return r.json(); }).then(function(list){ S.events = list.map(norm); fillCompanies(); render(); });
    return;
  }
  S.store = SheetStore(CFG.apiUrl);
  // 지난번에 받아 둔 목록을 먼저 바로 보여 주고, 최신 목록은 뒤에서 받아 바꾼다
  var cachedRows = null;
  try { cachedRows = JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch(e){}
  S.store.start(onData, cachedRows).then(updateSync).catch(function(e){
    setSync("일정을 불러오지 못했습니다 — 잠시 뒤 새로고침해 주세요");
    if (window.console) console.error(e);
  });
})();
