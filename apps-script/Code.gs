// 사업팀 달력 — 구글 시트 저장 서버 (Apps Script 웹 앱)
// 배포: 배포 → 새 배포 → 유형 "웹 앱" → 실행 사용자 "나" → 액세스 권한 "모든 사용자"
const SEED_URL = 'https://jeonseong0428-glitch.github.io/biz-calendar/data/events.json';
const COLS = ['id', 'title', 'company', 'date', 'start', 'status', 'urgent', 'note', 'source', 'notionId', 'updatedAt'];

function ss_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SHEET_ID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) {} }
  const ss = SpreadsheetApp.create('사업팀 달력 데이터');
  props.setProperty('SHEET_ID', ss.getId());
  return ss;
}

function setup() {
  const sh = sheet_();
  seedIfEmpty_(sh);
  Logger.log('시트: ' + sh.getParent().getUrl() + ' / 일정 ' + (sh.getLastRow() - 1) + '건');
}

function sheet_() {
  const ss = ss_();
  let sh = ss.getSheetByName('events');
  if (!sh) { sh = ss.getSheets()[0]; sh.setName('events'); }
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, COLS.length).setValues([COLS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function toRow_(o) {
  return COLS.map(function (c) {
    if (c === 'urgent') return o.urgent ? 'TRUE' : '';
    return o[c] == null ? '' : String(o[c]);
  });
}

function readAll_(sh) {
  const last = sh.getLastRow();
  if (last < 2) return [];
  const values = sh.getRange(2, 1, last - 1, COLS.length).getDisplayValues();
  return values.filter(function (r) { return r[0] !== ''; }).map(function (r) {
    const o = {};
    COLS.forEach(function (c, i) { o[c] = r[i]; });
    o.urgent = String(o.urgent).toUpperCase() === 'TRUE';
    return o;
  });
}

function seedIfEmpty_(sh) {
  if (sh.getLastRow() > 1) return;
  const list = JSON.parse(UrlFetchApp.fetch(SEED_URL).getContentText());
  if (!list.length) return;
  sh.getRange(2, 1, list.length, COLS.length).setNumberFormat('@').setValues(list.map(toRow_));
}

function rowOf_(sh, id) {
  if (sh.getLastRow() < 2) return 0;
  const hit = sh.getRange(2, 1, sh.getLastRow() - 1, 1).createTextFinder(id).matchEntireCell(true).findNext();
  return hit ? hit.getRow() : 0;
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet_();
    seedIfEmpty_(sh);
    return out_({ ok: true, rows: readAll_(sh) });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet_();
    const req = JSON.parse(e.postData.contents);
    const id = String(req.id || '');
    if (!id) return out_({ ok: false, error: 'id가 없습니다' });
    const r = rowOf_(sh, id);
    if (req.op === 'save') {
      const o = Object.assign({}, req.data, { id: id });
      const target = r || sh.getLastRow() + 1;
      sh.getRange(target, 1, 1, COLS.length).setNumberFormat('@').setValues([toRow_(o)]);
    } else if (req.op === 'patch') {
      if (r) {
        Object.keys(req.data || {}).forEach(function (k) {
          const i = COLS.indexOf(k);
          if (i < 0 || k === 'id') return;
          const v = k === 'urgent' ? (req.data[k] ? 'TRUE' : '') : (req.data[k] == null ? '' : String(req.data[k]));
          sh.getRange(r, i + 1).setNumberFormat('@').setValue(v);
        });
      }
    } else if (req.op === 'remove') {
      if (r) sh.deleteRow(r);
    } else {
      return out_({ ok: false, error: '알 수 없는 요청' });
    }
    return out_({ ok: true });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
