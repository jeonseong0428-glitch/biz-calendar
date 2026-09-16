(function(){
  "use strict";
  var $ = function(id){ return document.getElementById(id); };
  var DOW = ["월","화","수","목","금","토","일"];
  var STL = {todo:"예정", doing:"진행 중", done:"완료"};
  var NEXT = {todo:"doing", doing:"done", done:"todo"};

  // ---- 상태
  var S = { view:"month", cursor: ymd(new Date()), company:"", stage:"", hideDone:false, events:[], ready:false, store:null, editing:null };
  try {
    var saved = JSON.parse(localStorage.getItem("bizcal.prefs")||"null");
    if (saved){ if (/^(month|week|day)$/.test(saved.view)) S.view = saved.view; S.company = saved.company||""; S.stage = saved.stage||""; S.hideDone = !!saved.hideDone; }
  } catch(e){}
  function savePrefs(){ try{ localStorage.setItem("bizcal.prefs", JSON.stringify({view:S.view, company:S.company, stage:S.stage, hideDone:S.hideDone})); }catch(e){} }

  // ---- 날짜 도구
  function pad(n){ return (n<10?"0":"")+n; }
  function ymd(d){ return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); }
  function parse(s){ var p=s.split("-"); return new Date(+p[0], +p[1]-1, +p[2]); }
  function addDays(s,n){ var d=parse(s); d.setDate(d.getDate()+n); return ymd(d); }
  function mondayOf(s){ var d=parse(s); var w=(d.getDay()+6)%7; d.setDate(d.getDate()-w); return ymd(d); }
  function dowIdx(s){ return (parse(s).getDay()+6)%7; }
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

  function visible(){
    return S.events.filter(function(e){
      if (S.company && e.company !== S.company) return false;
      if (S.stage && stageOf(e) !== S.stage) return false;
      if (S.hideDone && e.status === "done") return false;
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
    if (S.view==="month") renderMonth(); else if (S.view==="week") renderWeek(); else renderDay();
  }

  function sortMonth(a,b){ var o={doing:0,todo:1,done:2}; return o[a.status]-o[b.status] || (b.urgent?1:0)-(a.urgent?1:0) || stageOf(a).localeCompare(stageOf(b)) || a.company.localeCompare(b.company,"ko"); }
  function legendHTML(){
    return '<div class="legend" role="group" aria-label="사업 단계로 거르기">'+STAGES.map(function(x){
      return '<button type="button" class="lg'+(S.stage===x.k?' on':'')+'" data-stage="'+x.k+'" aria-pressed="'+(S.stage===x.k)+'"><b class="sb"'+stageStyle(x.k)+'>'+(x.k==="0"?"·":x.k)+'</b>'+x.n+'</button>';
    }).join("")+(S.stage?'<button type="button" class="lg clr" data-stage="">전체 보기</button>':'')+'</div>';
  }
  function renderMonth(){
    var c = parse(S.cursor), y=c.getFullYear(), m=c.getMonth();
    $("period").innerHTML = (m+1)+"월<small>"+y+"</small>";
    var first = ymd(new Date(y,m,1)), start = mondayOf(first);
    var last = new Date(y,m+1,0), end = addDays(mondayOf(ymd(last)),6);
    var map = byDate(visible()), t = todayStr();
    var h = legendHTML()+'<section class="month" aria-label="월간 달력"><div class="dow">'+DOW.map(function(d){return "<div>"+d+"</div>";}).join("")+'</div><div class="grid">';
    for (var d=start; d<=end; d=addDays(d,1)){
      var inM = parse(d).getMonth()===m, wd = dowIdx(d)>=5;
      var list = (map[d]||[]).slice().sort(sortMonth);
      var max = window.innerWidth<640 ? 5 : 8;
      h += '<div class="cell'+(inM?'':' out')+(wd?' weekend':'')+(d===t?' today':'')+'" data-day="'+d+'" role="button" tabindex="0" aria-label="'+md(d)+' 일정 '+list.length+'건">'+
        '<div class="dn"><b>'+(+d.slice(8))+'</b></div>'+
        list.slice(0,max).map(function(e){
          var k = stageOf(e);
          return '<span class="ev'+(e.status==="done"?' done':'')+(isLate(e)?' late':'')+(e.urgent&&e.status!=="done"?' urgent':'')+'"'+stageStyle(k)+' title="'+esc(STAGE[k].n+" · "+e.company+" · "+e.title)+'">'+
            '<span class="eh"><b class="sb">'+(k==="0"?"·":k)+'</b><span class="co">'+esc(e.company)+'</span></span><span class="ti">'+esc(e.title)+'</span></span>';
        }).join("")+
        (list.length>max?'<span class="more">+'+(list.length-max)+'건</span>':'')+'</div>';
    }
    $("view").innerHTML = h+'</div></section>';
  }

  function renderWeek(){
    var s = mondayOf(S.cursor), e = addDays(s,6), t = todayStr();
    var sy = s.slice(0,4);
    $("period").innerHTML = md(s)+" – "+md(e)+"<small>"+sy+"</small>";
    var map = byDate(visible()), h = '<section class="week" aria-label="주간 달력">';
    for (var i=0;i<7;i++){
      var d = addDays(s,i), list = map[d]||[], groups = groupCompany(list);
      h += '<div class="day'+(i>=5?' weekend':'')+(d===t?' today':'')+'">'+
        '<button type="button" class="dayh" data-day="'+d+'"><span class="d">'+(+d.slice(8))+'</span><span class="w">'+DOW[i]+'</span><span class="n">'+(list.length?list.length+'건':'')+'</span></button>'+
        '<div class="daybody">'+(groups.length? groups.map(function(g){
          return '<div class="grp">'+chipHTML(g,'data-day="'+d+'"')+g.items.map(function(ev){
            return '<button type="button" class="it'+(ev.status==="done"?' done':'')+(isLate(ev)?' late':'')+(ev.urgent?' urgent':'')+'" data-id="'+esc(ev.id)+'">'+badge(ev)+esc(ev.title)+'</button>';
          }).join("")+'</div>';
        }).join("") : '<span class="empty">일정 없음</span>')+'</div></div>';
    }
    $("view").innerHTML = h+'</section>';
  }

  function rowHTML(ev, showDate){
    return '<div class="row'+(ev.status==="done"?' done':'')+(isLate(ev)?' late':'')+'">'+
      '<button type="button" class="st" data-toggle="'+esc(ev.id)+'" data-s="'+ev.status+'" title="눌러서 상태 바꾸기">'+STL[ev.status]+'</button>'+
      '<div class="rt"><div class="t">'+badge(ev)+(ev.urgent&&ev.status!=="done"?'<span class="tag u">긴급</span>':'')+(showDate?'<span class="tag p">'+md(ev.date)+'</span>':'')+esc(ev.title)+'</div>'+
      ((ev.start||ev.note)?'<div class="m">'+(ev.start?'기간 '+md(ev.start)+' – '+md(ev.date)+(ev.note?' · ':''):'')+esc(ev.note||"")+'</div>':'')+'</div>'+
      '<button type="button" class="edit" data-id="'+esc(ev.id)+'">수정</button></div>';
  }
  function groupsHTML(list, showDate){
    return groupCompany(list).map(function(g){
      return '<div class="cgroup"><div class="ch"><span class="dot" style="--h:'+hue(g.company)+'"></span>'+esc(g.company)+'</div>'+g.items.map(function(ev){ return rowHTML(ev, showDate); }).join("")+'</div>';
    }).join("");
  }

  function renderDay(){
    var d = S.cursor, t = todayStr(), i = dowIdx(d);
    $("period").innerHTML = md(d)+" ("+DOW[i]+")<small>"+d.slice(0,4)+"</small>";
    var vis = visible();
    var list = vis.filter(function(e){ return e.date===d; });
    var span = vis.filter(function(e){ return e.start && e.start<=d && e.date>d && e.status!=="done"; });
    var lateList = S.events.filter(function(e){ return isLate(e) && (!S.company || e.company===S.company); }).sort(function(a,b){ return a.date<b.date?-1:1; });
    var undated = vis.filter(function(e){ return !e.date; });
    var h = '<section class="dayview"><div>'+
      '<div class="panel"><h2>'+(d===t?'오늘':md(d))+' 일정 <span class="n">'+list.length+'</span><span class="hint">상태 버튼을 누르면 예정 → 진행 중 → 완료</span></h2>'+
      (list.length? groupsHTML(list,false) : '<p class="none">이 날짜에 잡힌 일정이 없습니다. 오른쪽 위 「+ 일정」으로 추가하세요.</p>')+'</div>'+
      (span.length?'<div class="panel" style="margin-top:12px"><h2>기간 중인 일 <span class="n">'+span.length+'</span></h2>'+groupsHTML(span,true)+'</div>':'')+
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

  function fillCompanies(){
    var set = {}; S.events.forEach(function(e){ if(e.company) set[e.company]=1; });
    var names = Object.keys(set).sort(function(a,b){ return a.localeCompare(b,"ko"); });
    $("company").innerHTML = '<option value="">전체 업체</option>'+names.map(function(n){ return '<option value="'+esc(n)+'">'+esc(n)+'</option>'; }).join("");
    if (S.company && !set[S.company]) S.company = "";
    $("companyList").innerHTML = names.map(function(n){ return '<option value="'+esc(n)+'"></option>'; }).join("");
  }

  // ---- 이동
  function move(dir){
    if (S.view==="month"){ var c=parse(S.cursor); S.cursor = ymd(new Date(c.getFullYear(), c.getMonth()+dir, 1)); }
    else S.cursor = addDays(S.cursor, S.view==="week"?7*dir:dir);
    render();
  }
  function openDay(d){ S.view="day"; S.cursor=d; savePrefs(); render(); window.scrollTo({top:0}); }

  $("prev").onclick = function(){ move(-1); };
  $("next").onclick = function(){ move(1); };
  $("today").onclick = function(){ S.cursor = todayStr(); render(); };
  document.querySelectorAll(".seg button").forEach(function(b){ b.onclick = function(){ S.view=b.dataset.view; savePrefs(); render(); }; });
  $("company").onchange = function(){ S.company=this.value; savePrefs(); render(); };
  $("hideDone").onchange = function(){ S.hideDone=this.checked; savePrefs(); render(); };
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
    else if (ev.key==="t") { S.cursor=todayStr(); render(); }
    else if (ev.key==="m"||ev.key==="w"||ev.key==="d") { S.view={m:"month",w:"week",d:"day"}[ev.key]; savePrefs(); render(); }
    else if (ev.key==="n") openForm(null);
  });
  var rt; window.addEventListener("resize", function(){ clearTimeout(rt); rt=setTimeout(function(){ if(S.view==="month") render(); }, 150); });

  function find(id){ return S.events.filter(function(e){ return e.id===id; })[0]||null; }

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
    if (!S.store){ showBanner("저장소에 연결되지 않아 지금은 추가·수정할 수 없습니다. 새로고침해 보세요."); return; }
    S.editing = e ? e.id : null;
    $("dlgTitle").textContent = e ? "일정 수정" : "일정 추가";
    $("fDate").value = e ? (e.date||"") : S.cursor;
    $("fStart").value = e && e.start ? e.start : "";
    $("fCompany").value = e ? e.company : (S.company||"");
    $("fTitle").value = e ? e.title : "";
    $("fNote").value = e ? (e.note||"") : "";
    $("fStage").value = e && STAGE[e.stage] ? e.stage : "";
    stageHint();
    $("fUrgent").checked = !!(e && e.urgent);
    var st = e ? e.status : "todo";
    document.querySelectorAll('input[name="fStatus"]').forEach(function(r){ r.checked = r.value===st; });
    $("fDel").hidden = !e; $("fErr").textContent = "";
    $("dlg").showModal();
    setTimeout(function(){ (e ? $("fTitle") : ($("fCompany").value ? $("fTitle") : $("fCompany"))).focus(); }, 0);
  }
  $("fCancel").onclick = function(){ $("dlg").close(); };
  function stageHint(){ var g = STAGE[guessStage($("fTitle").value)]; $("fStageAuto").textContent = "자동 (제목 보고 판단: "+g.n+")"; }
  $("fTitle").addEventListener("input", stageHint);
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
    $("fSave").disabled = true;
    write(id, function(){ return S.store.save(id, body); }).then(function(){
      $("fSave").disabled = false; $("dlg").close();
      if (!S.editing){ S.cursor = date; }
    }).catch(function(e){ $("fSave").disabled = false; writeError(e); $("dlg").close(); });
  });
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
  var POLL_MS = 20000;

  function newId(){ return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function norm(o){
    return {
      id:String(o.id), title:String(o.title||""), company:String(o.company||"공통"), date:String(o.date||""), start:o.start?String(o.start):"",
      status: STL[o.status]?o.status:"todo", urgent:o.urgent===true||String(o.urgent).toUpperCase()==="TRUE", note:String(o.note||""),
      source:o.source||"", notionId:o.notionId||"", stage:STAGE[String(o.stage||"")]?String(o.stage):"", updatedAt:o.updatedAt||""
    };
  }

  function SheetStore(url){
    var map = {}, listener = null, pending = 0, lastOk = null;
    function emit(){ listener && listener(Object.keys(map).map(function(k){ return norm(map[k]); })); }
    function fetchAll(){
      return fetch(url + (url.indexOf("?")<0?"?":"&") + "t=" + Date.now(), {cache:"no-store", redirect:"follow"})
        .then(function(res){ if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
        .then(function(body){
          if (!body.ok) throw new Error(body.error || "불러오기 실패");
          if (pending) return;
          map = {}; body.rows.forEach(function(o){ if (o.id) map[o.id] = o; });
          lastOk = new Date(); emit();
        });
    }
    function send(op, id, data){
      pending++;
      return fetch(url, { method:"POST", redirect:"follow", headers:{"Content-Type":"text/plain;charset=utf-8"},
                          body: JSON.stringify({op:op, id:id, data:data||{}}) })
        .then(function(res){ if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
        .then(function(body){ if (!body.ok) throw new Error(body.error || "저장 실패"); })
        .then(function(){ pending--; lastOk = new Date(); return fetchAll().catch(function(){}); },
              function(e){ pending--; fetchAll().catch(function(){}); throw e; });
    }
    return {
      lastOk: function(){ return lastOk; },
      start: function(onData){
        listener = onData;
        document.addEventListener("visibilitychange", function(){ if (!document.hidden) fetchAll().catch(function(){}); });
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
  function onData(list){ S.events = list; S.ready = true; fillCompanies(); render(); updateSync(); }
  function updateSync(){
    if (!S.store) return;
    var t = S.store.lastOk();
    setSync("팀원과 공유 중 · " + S.events.length + "건" + (t ? " · " + pad2(t.getHours()) + ":" + pad2(t.getMinutes()) + " 동기화" : ""), true);
  }

  if (!CFG.apiUrl){
    setSync("저장 서버 주소(config.js)가 비어 있어 보기만 가능합니다"); $("add").disabled = true;
    fetch("data/events.json", {cache:"no-store"}).then(function(r){ return r.json(); }).then(function(list){ S.events = list.map(norm); fillCompanies(); render(); });
    return;
  }
  S.store = SheetStore(CFG.apiUrl);
  S.store.start(onData).then(updateSync).catch(function(e){
    setSync("일정을 불러오지 못했습니다 — 잠시 뒤 새로고침해 주세요");
    if (window.console) console.error(e);
  });
})();
