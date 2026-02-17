# GitHub 업로드 빠른 가이드

아래 명령만 순서대로 실행하면, 현재 코드(예: `mps-playmetrics.html`)를 GitHub에 올릴 수 있습니다.

## 1) 로컬 Git 초기화(처음 한 번만)

```bash
git init
git add .
git commit -m "feat: add MPS PlayMetrics landing page"
```

## 2) GitHub에서 새 저장소 생성

- GitHub → **New repository**
- 저장소 이름 입력 (예: `mps-playmetrics`)
- `README`/`.gitignore` 자동 생성은 끄는 것을 권장

## 3) 원격 저장소 연결 후 push

```bash
git branch -M main
git remote add origin https://github.com/<YOUR_ID>/<REPO_NAME>.git
git push -u origin main
```

## 4) 이후 수정사항 올릴 때

```bash
git add .
git commit -m "chore: update landing page"
git push
```

## 5) 정적 페이지 배포(선택)

GitHub Pages로 바로 배포하려면:

1. 저장소 `Settings` → `Pages`
2. Source: `Deploy from a branch`
3. Branch: `main` / `/root`
4. `mps-playmetrics.html` 파일명을 `index.html`로 바꾸면 루트 URL에서 바로 열립니다.
