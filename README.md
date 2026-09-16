# 사업팀 달력

사업팀 업무 일정을 **월간·주간·일간**으로 보는 달력입니다. 월간·주간은 업체명으로 묶어 보여 줍니다.

**저장소 = 이 GitHub 저장소.** 일정은 `data/events.json` 한 파일에 들어 있고,
달력에서 추가·수정·삭제하면 그 파일이 **커밋으로 바로 저장**됩니다. 누가 언제 무엇을 바꿨는지는 커밋 기록에 남습니다.

| 파일 | 역할 |
|---|---|
| `index.html`, `app.js` | 달력 화면과 동작 |
| `data/events.json` | 일정 데이터 (노션에서 가져온 185건 포함) |
| `config.js` | 저장소 설정 (보통 비워 둬도 됨) |

---

## 1. 배포 (5분, 한 번만)

1. https://github.com/new → 이름 `biz-calendar` → **Public** → **Create repository**
2. **uploading an existing file** → 압축 푼 파일·폴더 전부 끌어다 놓기 → **Commit changes**
   (`index.html`, `app.js`, `config.js`, `.nojekyll`, `README.md`, `data` 폴더)
3. **Settings → Pages** → Branch: `main` / `/(root)` → **Save**
4. 1~2분 뒤 접속: `https://<GitHub 아이디>.github.io/biz-calendar/`

이제 링크만 있으면 누구나 달력을 **볼 수** 있습니다.

## 2. 편집하는 사람 — 편집 키 한 번 넣기

GitHub에 저장하려면 저장소 쓰기 권한 키가 필요합니다. 브라우저마다 **한 번만** 넣으면 됩니다.

1. GitHub 우측 상단 프로필 → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
2. 설정
   - Token name: `biz-calendar`
   - Expiration: 원하는 기간 (예: 1년)
   - Repository access: **Only select repositories** → `biz-calendar`
   - Permissions → Repository permissions → **Contents: Read and write**
3. **Generate token** → `github_pat_...` 복사
4. 달력 화면 아래 **「편집 키 입력」** → 붙여넣기 → 저장
5. 화면 아래가 **「GitHub 저장소와 동기화 · 185건」** 으로 바뀌면 끝

팀원도 편집하려면:
- 저장소 **Settings → Collaborators → Add people** 로 팀원 초대 → 팀원이 자기 계정에서 위 1~4 진행, 또는
- 한 사람이 만든 키를 팀 안에서만 공유 (메신저 공지 등에 올리지 마세요)

## 반영 시간

- **편집 키를 넣은 브라우저**: GitHub에서 바로 읽음 → 저장 즉시 반영, 다른 사람 변경은 1분 안에(창을 다시 보면 즉시) 반영
- **키 없이 보기만 하는 브라우저**: 배포된 파일을 읽음 → 저장 후 **1~2분 뒤** 새로고침하면 반영
- 두 사람이 동시에 저장해도 최신본을 받아 다시 합쳐 저장하므로 서로 덮어쓰지 않습니다.

## 알아둘 점

- **Public 저장소라 `data/events.json`(일정 내용)은 인터넷에 공개**됩니다. 업체명·일정이 외부에 보이면 곤란하면 알려 주세요 → 일정 파일만 Private 저장소로 분리하는 설정(`config.js`)으로 바꿀 수 있습니다(이 경우 보는 사람도 키 필요).
- 키는 각자 브라우저에만 저장되고 저장소에는 올라가지 않습니다. **키를 코드나 `config.js`에 적지 마세요** (GitHub가 자동 폐기합니다).
- 잘못 지웠으면: 저장소 **Commits** 에서 해당 커밋을 열어 이전 `data/events.json` 내용을 복원하면 됩니다.

## 단축키

`←` `→` 이전/다음 · `t` 오늘 · `m` `w` `d` 월간/주간/일간 · `n` 새 일정
