# GitHub 업로드 가이드 (복붙용)

Gemini에서 만든 HTML 파일을 **빠르게 GitHub에 올리는 방법**입니다.

---

## 0) 파일 이름 정리 (권장)

GitHub Pages로 바로 배포하려면 메인 파일명을 `index.html`로 두는 게 가장 편합니다.

```bash
mv mps-playmetrics.html index.html
```

> 이미 `index.html`이 있으면 이름 충돌 확인 후 진행하세요.

---

## 1) 로컬 저장소가 이미 있는 경우 (지금 상황에 보통 해당)

### 1-1. 변경사항 저장
```bash
git add .
git commit -m "feat: add PlayMetrics landing page"
```

### 1-2. 원격 저장소 연결 확인
```bash
git remote -v
```

- `origin`이 없으면 아래 실행:
```bash
git remote add origin https://github.com/<YOUR_ID>/<REPO_NAME>.git
```

### 1-3. main 브랜치로 푸시
```bash
git branch -M main
git push -u origin main
```

---

## 2) 로컬 저장소가 없는 경우 (처음 시작)

```bash
git init
git add .
git commit -m "feat: initial commit"
git branch -M main
git remote add origin https://github.com/<YOUR_ID>/<REPO_NAME>.git
git push -u origin main
```

---

## 3) GitHub Pages로 배포 (선택)

1. GitHub 저장소 → **Settings** → **Pages**
2. **Source**: `Deploy from a branch`
3. **Branch**: `main` + `/ (root)` 선택
4. 저장 후 1~3분 대기
5. 배포 URL 접속: `https://<YOUR_ID>.github.io/<REPO_NAME>/`

---

## 4) 이후 수정할 때 루틴

```bash
git add .
git commit -m "chore: update landing page"
git push
```

---

## 5) 자주 막히는 포인트

- **403 에러**: GitHub 비밀번호 인증이 아니라 **Personal Access Token(PAT)** 필요.
- **remote 이미 존재**: `git remote set-url origin <URL>`로 변경.
- **브랜치 이름 불일치**: `git branch -M main` 후 재푸시.
- **Pages 화면이 안 뜸**: 메인 파일이 `index.html`인지 확인.
