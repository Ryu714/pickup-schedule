# 등하교/등하원 시간표

두 자녀(최윤우, 류준)의 일일 등하교·등하원 시간표를 한눈에 확인할 수 있는 모바일 웹 애플리케이션입니다.

## 주요 기능

- **함께보기** — 두 자녀의 일정을 나란히 비교 (사이드 바이 사이드 레이아웃)
- **요일별 조회** — 월~금 요일 탭, 오늘 요일 자동 선택, 좌우 스와이프 전환
- **현재 시간 인디케이터** — 빨간 선 + 펄스 도트로 현재 시각 표시
- **다음 일정 강조** — 다가올 가장 가까운 카드에 amber glow + 상대 시간("N분 후") 표시
- **진행 중 표시** — 현재 수업 중인 활동 카드에 green glow 표시
- **지난 일정 디밍** — 이미 지난 시간의 카드 자동 흐리게 처리
- **다크 모드** — shadcn/zinc 스타일, 해/달 토글로 수동 전환 (localStorage 유지)
- **날씨 위젯** — KMA(기상청) API 기반 현재 기온 + 최고/최저 + 하늘상태 아이콘
- **미세먼지** — PM10/PM2.5 실시간 등급 표시
- **급식 정보** — NEIS API 기반 학교 급식 메뉴 표시
- **학원별 보더 색상** — 같은 학원의 등원-하원 카드를 보더 색상으로 그룹핑
- **반응형** — 모바일 최적화 (420px, 360px 브레이크포인트, safe area 지원)
- **PWA** — 홈 화면에 앱으로 추가 가능 (manifest.json + Service Worker)
- **자정 자동 새로고침** — 날짜 변경 시 자동으로 페이지 갱신

## 아키텍처

```
[사용자 브라우저]
    ├── index.html ← GitHub Pages (HTTPS)
    └── weather.json, meal.json ← Synology NAS API (HTTPS, DDNS)
```

- **프론트엔드**: GitHub Pages에서 정적 호스팅
- **데이터 서버**: Synology NAS Docker 컨테이너 (Node.js)
  - 날씨/미세먼지: 5분마다 KMA API + 미세먼지 API fetch
  - 급식: 하루 2회 NEIS API fetch
- **캐싱**: localStorage (날씨 10분 TTL, 급식 무기한)
- **Fallback**: NAS 다운 시 localStorage 캐시 데이터 표시

## 기술 스택

- **프론트엔드**: HTML5 · CSS3 · Vanilla JavaScript (단일 `index.html`)
- **데이터 서버**: Node.js 20 + Express + node-cron (Docker)
- **API**: KMA 기상청, data.go.kr 미세먼지, NEIS 급식
- **호스팅**: GitHub Pages + Synology NAS

## 프로젝트 구조

```
pickup-schedule/
├── index.html              # 메인 앱 (HTML/CSS/JS 단일 파일)
├── manifest.json           # PWA 매니페스트
├── sw.js                   # Service Worker (최소 구현)
├── weather.json            # 날씨 데이터 (레거시, NAS로 이전)
├── meal.json               # 급식 데이터 (레거시, NAS로 이전)
├── .github/workflows/
│   ├── weather.yml          # 날씨 업데이트 (비활성화)
│   └── meal.yml             # 급식 업데이트 (비활성화)
└── server/                  # NAS 서버 코드
    ├── index.js             # Express 서버 + 스케줄러
    ├── package.json
    ├── Dockerfile
    ├── docker-compose.yml
    ├── .env.example
    └── fetchers/
        ├── weather.js       # 날씨/미세먼지 fetcher
        └── meal.js          # 급식 fetcher
```

## 실행 방법

### 프론트엔드 (로컬 테스트)

```bash
python3 -m http.server 8080
# http://localhost:8080/index.html
```

### NAS 서버 (Docker)

```bash
cd server
cp .env.example .env
# .env에 KMA_API_KEY, AIR_API_KEY 입력
docker-compose up -d
```

## NAS 배포 가이드

1. `server/` 디렉토리를 NAS에 복사
2. `.env` 파일 생성 (API 키 입력)
3. `docker-compose up -d` 실행
4. Synology DDNS + 역방향 프록시 설정 (HTTPS)
5. `curl http://localhost:3000/health` 로 동작 확인
