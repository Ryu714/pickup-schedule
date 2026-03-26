const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'weather.json');

function getKST() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + 9 * 60 * 60000);
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function pad2(n) { return String(n).padStart(2, '0'); }

async function fetchWithRetry(url, retries = 2, delays = [5000, 15000]) {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(tid);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i < retries) {
        console.log(`[weather] Retry ${i + 1}/${retries} after error: ${e.message}`);
        await new Promise(r => setTimeout(r, delays[i]));
      } else {
        throw e;
      }
    }
  }
}

function readPrevious() {
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  } catch { return {}; }
}

async function fetchWeather() {
  const kst = getKST();
  const hour = kst.getHours();
  const minute = kst.getMinutes();

  // base_time: KMA ultra-short forecast publishes at :45, base_time = XX:30
  let baseDate, baseHour;
  if (minute >= 45) {
    baseDate = formatDate(kst);
    baseHour = pad2(hour);
  } else {
    const prev = new Date(kst.getTime() - 3600000);
    baseDate = formatDate(prev);
    baseHour = pad2(prev.getHours());
  }
  const ultraBaseTime = baseHour + '30';

  const KMA_KEY = process.env.KMA_API_KEY;
  const AIR_KEY = process.env.AIR_API_KEY;
  const NX = 64, NY = 123;

  const prev = readPrevious();
  let temp = null, sky = prev.sky || 1, pty = prev.pty || 0;
  let min = prev.min, max = prev.max;

  // 1. Ultra short-term forecast (T1H, SKY, PTY)
  try {
    const url = `https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getUltraSrtFcst?pageNo=1&numOfRows=60&dataType=JSON&base_date=${baseDate}&base_time=${ultraBaseTime}&nx=${NX}&ny=${NY}&authKey=${KMA_KEY}`;
    console.log(`[weather] Fetching ultra forecast: ${baseDate} ${ultraBaseTime}`);
    const data = await fetchWithRetry(url);
    const items = data?.response?.body?.items?.item || [];

    const t1h = items.find(i => i.category === 'T1H');
    const skyItem = items.find(i => i.category === 'SKY');
    const ptyItem = items.find(i => i.category === 'PTY');

    if (t1h) temp = parseFloat(t1h.fcstValue);
    if (skyItem) sky = parseInt(skyItem.fcstValue);
    if (ptyItem) pty = parseInt(ptyItem.fcstValue);

    console.log(`[weather] T1H=${temp}, SKY=${sky}, PTY=${pty}`);
  } catch (e) {
    console.error(`[weather] Ultra forecast failed: ${e.message}`);
  }

  if (temp === null) {
    console.log('[weather] No temperature, skipping update');
    return;
  }

  // 2. Village forecast for TMN/TMX
  const todayStr = formatDate(kst);
  const vilagBaseTimes = [23, 20, 17, 14, 11, 8, 5, 2];

  for (const vt of vilagBaseTimes) {
    if (hour < vt) continue;
    if (min !== undefined && min !== null && max !== undefined && max !== null) break;

    try {
      const vtStr = pad2(vt) + '00';
      console.log(`[weather] Trying vilag base_time: ${vtStr}`);
      const url = `https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getVilageFcst?pageNo=1&numOfRows=800&dataType=JSON&base_date=${todayStr}&base_time=${vtStr}&nx=${NX}&ny=${NY}&authKey=${KMA_KEY}`;
      const data = await fetchWithRetry(url);
      const items = data?.response?.body?.items?.item || [];

      if (min === undefined || min === null) {
        const tmn = items.find(i => i.category === 'TMN' && i.fcstDate === todayStr);
        if (tmn) min = parseFloat(tmn.fcstValue);
      }
      if (max === undefined || max === null) {
        const tmx = items.find(i => i.category === 'TMX' && i.fcstDate === todayStr);
        if (tmx) max = parseFloat(tmx.fcstValue);
      }
    } catch (e) {
      console.log(`[weather] Vilag ${vt}00 failed: ${e.message}`);
    }
  }

  // Fallback to previous values
  if (min === undefined || min === null) min = prev.min || 0;
  if (max === undefined || max === null) max = prev.max || 0;

  // Round to integers
  temp = Math.round(temp);
  min = Math.round(min);
  max = Math.round(max);

  // Correct range
  if (temp < min) min = temp;
  if (temp > max) max = temp;

  // 3. Air quality
  let pm10 = prev.pm10 || null;
  let pm25 = prev.pm25 || null;

  try {
    const station = encodeURIComponent('경안동');
    const url = `https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty?serviceKey=${encodeURIComponent(AIR_KEY)}&stationName=${station}&dataTerm=DAILY&pageNo=1&numOfRows=1&returnType=json&ver=1.0`;
    const data = await fetchWithRetry(url);
    const item = data?.response?.body?.items?.[0];

    if (item) {
      const v10 = item.pm10Value;
      const v25 = item.pm25Value;
      if (v10 && v10 !== '-') pm10 = parseInt(v10);
      if (v25 && v25 !== '-') pm25 = parseInt(v25);
    }
    console.log(`[weather] PM10=${pm10}, PM25=${pm25}`);
  } catch (e) {
    console.error(`[weather] Air quality failed: ${e.message}`);
  }

  const kstNow = getKST();
  const updatedAt = `${kstNow.getFullYear()}-${pad2(kstNow.getMonth() + 1)}-${pad2(kstNow.getDate())}T${pad2(kstNow.getHours())}:${pad2(kstNow.getMinutes())}:${pad2(kstNow.getSeconds())}+09:00`;

  const result = { temp, min, max, sky, pty, pm10, pm25, updatedAt };

  fs.writeFileSync(DATA_PATH, JSON.stringify(result));
  console.log(`[weather] Updated: ${JSON.stringify(result)}`);
}

module.exports = { fetchWeather };
