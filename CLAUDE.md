# CLAUDE.md

## 프로젝트 개요

두 자녀(최윤우-초등학교, 류준-유치원)의 등하교/등하원 픽업 스케줄 웹 앱.
가족이 매일 사용하는 앱으로, 안정성과 단순함이 최우선.

## 아키텍처

- **프론트엔드**: 단일 `index.html` (순수 HTML/CSS/JS, 프레임워크 없음)
- **호스팅**: GitHub Pages (HTTPS)
- **데이터 서버**: Synology NAS Docker (Node.js Express)
  - 도메인: `ryuryu.synology.me`
  - 날씨/미세먼지: 5분마다 fetch (KMA API + data.go.kr)
  - 급식: 하루 2회 fetch (NEIS API)
- **GitHub Actions**: 비활성화됨 (NAS로 마이그레이션 완료)

## 핵심 파일

| 파일 | 역할 |
|------|------|
| `index.html` | 전체 앱 (CSS+HTML+JS, ~1300줄) |
| `manifest.json` | PWA 매니페스트 |
| `sw.js` | 최소 Service Worker |
| `server/index.js` | NAS Express 서버 + cron 스케줄러 |
| `server/fetchers/weather.js` | KMA 날씨 + 미세먼지 fetch 로직 |
| `server/fetchers/meal.js` | NEIS 급식 fetch 로직 |

## 데이터 구조

- **스케줄**: `index.html` 내 `DATA` 객체에 하드코딩 (학기별 수동 업데이트)
- **날씨**: `weather.json` — `{temp, min, max, sky, pty, pm10, pm25, updatedAt}`
- **급식**: `meal.json` — `{yesterday, today, tomorrow}` 각 `{date, menus[]}`

## 코딩 컨벤션

- 빌드 도구/번들러 없음. 단일 파일 구조 유지
- CSS 변수(custom properties) 기반 디자인 시스템 (shadcn/zinc)
- 라이트/다크 모드: `.dark` 클래스로 전환
- 한국어 주석 사용

## 변경 시 주의사항

- `DATA` 객체 수정 시 양쪽 자녀 스케줄 모두 확인
- NAS fetch URL: `https://ryuryu.synology.me/weather.json`, `meal.json`
- CORS: NAS 서버의 `ALLOWED_ORIGINS` 환경변수와 일치해야 함
- GitHub Actions workflow는 `if: false`로 비활성화 상태 — 재활성화 시 `if: false` 제거
- 같은 WiFi에서 DDNS 접근 불가 (NAT Hairpinning) — 로컬 테스트 시 NAS 내부 IP 사용

## 테스트 방법

```bash
# 로컬 서버
python3 -m http.server 8080

# NAS 연동 테스트 (같은 네트워크)
curl http://192.168.219.100:3000/health
curl http://192.168.219.100:3000/weather.json

# NAS 연동 테스트 (외부)
curl https://ryuryu.synology.me/weather.json
```

## API 키

- `KMA_API_KEY`: 기상청 API (apihub.kma.go.kr)
- `AIR_API_KEY`: 미세먼지 API (data.go.kr)
- 저장 위치: NAS `.env` 파일 (git 미포함)
