const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'meal.json');

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

function addDays(d, days) {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

// bash %u: Mon=1 Sun=7, JS getDay(): Sun=0 Sat=6
function getSchoolYesterday(kst) {
  const dow = kst.getDay(); // 0=Sun, 6=Sat
  if (dow === 1) return addDays(kst, -3); // Mon → Fri
  if (dow === 0) return addDays(kst, -2); // Sun → Fri
  return addDays(kst, -1);
}

function getSchoolTomorrow(kst) {
  const tomorrow = addDays(kst, 1);
  const tomorrowDow = tomorrow.getDay();
  if (tomorrowDow === 6) return addDays(kst, 3); // Sat → Mon
  if (tomorrowDow === 0) return addDays(kst, 2); // Sun → Mon
  return tomorrow;
}

async function fetchMenus(dateStr) {
  try {
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&pIndex=1&pSize=1&MMEAL_SC_CODE=2&ATPT_OFCDC_SC_CODE=J10&SD_SCHUL_CODE=7692182&MLSV_YMD=${dateStr}`;

    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(tid);

    const data = await res.json();
    const ddish = data?.mealServiceDietInfo?.[1]?.row?.[0]?.DDISH_NM;

    if (!ddish) return null;

    // Remove allergen codes and split by <br/>
    const menus = ddish
      .replace(/\([0-9.]*[0-9]\)/g, '')
      .split('<br/>')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    return menus;
  } catch (e) {
    console.error(`[meal] Failed to fetch menus for ${dateStr}: ${e.message}`);
    return null;
  }
}

async function fetchMeal() {
  const kst = getKST();
  const today = formatDate(kst);
  const yesterday = formatDate(getSchoolYesterday(kst));
  const tomorrow = formatDate(getSchoolTomorrow(kst));

  console.log(`[meal] Fetching: yesterday=${yesterday}, today=${today}, tomorrow=${tomorrow}`);

  const [yesterdayMenus, todayMenus, tomorrowMenus] = await Promise.all([
    fetchMenus(yesterday),
    fetchMenus(today),
    fetchMenus(tomorrow),
  ]);

  const kstNow = getKST();
  const updatedAt = `${kstNow.getFullYear()}-${pad2(kstNow.getMonth() + 1)}-${pad2(kstNow.getDate())}T${pad2(kstNow.getHours())}:${pad2(kstNow.getMinutes())}:${pad2(kstNow.getSeconds())}+09:00`;

  const result = {
    yesterday: { date: yesterday, menus: yesterdayMenus },
    today: { date: today, menus: todayMenus },
    tomorrow: { date: tomorrow, menus: tomorrowMenus },
    updatedAt,
  };

  fs.writeFileSync(DATA_PATH, JSON.stringify(result));
  console.log(`[meal] Updated: ${updatedAt}`);
}

module.exports = { fetchMeal };
