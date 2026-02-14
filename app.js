// --- Buffers ---
const last5 = [];
const last50 = [];

// --- State ---
let soc = 80;              // %
let capacityKWh = 85;      // kWh utile
let odometer = 0;          // km (simulation)

// Helpers
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

function avg(arr, fallback) {
  if (!arr.length) return fallback;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

function percentile(arr, p, fallback) {
  if (!arr.length) return fallback;
  const sorted = [...arr].sort((a,b)=>a-b);
  const idx = Math.floor(p * (sorted.length - 1));
  return sorted[idx];
}

function whPerKmToKWhPer100(whPerKm) {
  return (whPerKm * 100) / 1000;
}

// Simule une conso (Wh/km) à partir de la vitesse
function simulatedWhPerKm(speedKmH) {
  // Courbe simple: plus rapide = moins efficient
  // 50 km/h ~ 160 Wh/km ; 100 ~ 185 ; 120 ~ 220
  if (speedKmH < 60) return 160;
  if (speedKmH < 110) return 185;
  return 220;
}

function pushBuffer(buf, limit, val) {
  if (buf.length >= limit) buf.shift();
  buf.push(val);
}

function rangesFromConsumption(socPercent, capKWh, whPerKm) {
  const kWhRemaining = (socPercent / 100) * capKWh;
  if (whPerKm <= 0) return 0;
  return Math.round((kWhRemaining * 1000) / whPerKm);
}

function render() {
  const normalWhKm = avg(last5, 180);
  const maxWhKm    = percentile(last50, 0.20, normalWhKm);
  const minWhKm    = percentile(last50, 0.80, normalWhKm);

  const normalKm = rangesFromConsumption(soc, capacityKWh, normalWhKm);
  const maxKm    = rangesFromConsumption(soc, capacityKWh, maxWhKm);
  const minKm    = rangesFromConsumption(soc, capacityKWh, minWhKm);

  document.getElementById('normalKm').textContent = `${normalKm} km`;
  document.getElementById('maxKm').textContent    = `${maxKm} km`;
  document.getElementById('minKm').textContent    = `${minKm} km`;
  document.getElementById('kwh100').textContent   = `${whPerKmToKWhPer100(normalWhKm).toFixed(1)} kWh/100`;
  document.getElementById('soc').textContent      = `${soc.toFixed(0)} %`;
}

// UI wiring
const socSlider = document.getElementById('socSlider');
const capInput = document.getElementById('capInput');
const speedSlider = document.getElementById('speedSlider');
const stepBtn = document.getElementById('stepBtn');
const resetBtn = document.getElementById('resetBtn');

socSlider.addEventListener('input', () => {
  soc = Number(socSlider.value);
  render();
});

capInput.addEventListener('input', () => {
  capacityKWh = clamp(Number(capInput.value || 85), 10, 200);
  render();
});

// Simule +1 km : on calcule Wh/km selon vitesse, puis on fait baisser SoC
stepBtn.addEventListener('click', () => {
  const speed = Number(speedSlider.value);
  const whPerKm = simulatedWhPerKm(speed);

  // Energie consommée sur 1 km :
  const kWhUsed = whPerKm / 1000;           // kWh
  const socDrop = (kWhUsed / capacityKWh) * 100;

  soc = clamp(soc - socDrop, 0, 100);
  odometer += 1;

  pushBuffer(last5, 5, whPerKm);
  pushBuffer(last50, 50, whPerKm);

  render();
});

resetBtn.addEventListener('click', () => {
  last5.length = 0;
  last50.length = 0;
  render();
});

// Register SW (offline)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(()=>{});
}

// Init
render();
