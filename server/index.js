require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const { fetchWeather } = require('./fetchers/weather');
const { fetchMeal } = require('./fetchers/meal');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

// CORS: Allow configured origins (comma-separated) or all (*)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').trim();

app.use((req, res, next) => {
  if (ALLOWED_ORIGINS === '*') {
    res.header('Access-Control-Allow-Origin', '*');
  } else {
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.split(',').map(s => s.trim()).includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    }
  }
  res.header('Access-Control-Allow-Methods', 'GET');
  next();
});

// Serve data files with no-cache headers
app.get('/weather.json', (req, res) => {
  const filePath = path.join(DATA_DIR, 'weather.json');
  if (fs.existsSync(filePath)) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'weather data not available' });
  }
});

app.get('/meal.json', (req, res) => {
  const filePath = path.join(DATA_DIR, 'meal.json');
  if (fs.existsSync(filePath)) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'meal data not available' });
  }
});

// Health check
app.get('/health', (req, res) => {
  let weatherAge = null;
  let mealAge = null;

  try {
    const wStat = fs.statSync(path.join(DATA_DIR, 'weather.json'));
    weatherAge = Math.round((Date.now() - wStat.mtimeMs) / 60000);
  } catch {}

  try {
    const mStat = fs.statSync(path.join(DATA_DIR, 'meal.json'));
    mealAge = Math.round((Date.now() - mStat.mtimeMs) / 60000);
  } catch {}

  const healthy = weatherAge !== null && weatherAge < 120; // weather updated within 2 hours
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'stale',
    weatherAgeMin: weatherAge,
    mealAgeMin: mealAge,
    uptime: Math.round(process.uptime()),
  });
});

// Schedule: weather every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log(`[cron] Weather fetch at ${new Date().toISOString()}`);
  try { await fetchWeather(); }
  catch (e) { console.error(`[cron] Weather error: ${e.message}`); }
});

// Schedule: meal at 00:00 and 06:00 KST (= 15:00 and 21:00 UTC)
cron.schedule('0 15,21 * * *', async () => {
  console.log(`[cron] Meal fetch at ${new Date().toISOString()}`);
  try { await fetchMeal(); }
  catch (e) { console.error(`[cron] Meal error: ${e.message}`); }
}, { timezone: 'UTC' });

// Initial fetch on startup
async function init() {
  console.log('[init] Starting initial data fetch...');

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  try { await fetchWeather(); }
  catch (e) { console.error(`[init] Weather error: ${e.message}`); }

  try { await fetchMeal(); }
  catch (e) { console.error(`[init] Meal error: ${e.message}`); }

  console.log('[init] Initial fetch complete');
}

app.listen(PORT, () => {
  console.log(`[server] Listening on port ${PORT}`);
  init();
});
