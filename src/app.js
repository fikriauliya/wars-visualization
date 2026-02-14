import { wars } from './data.js';
import Chart from 'chart.js/auto';
import './styles.css';

// State
let currentTab = 'timeline';
let filters = { region: 'all', scale: 'all', era: 'all' };
let charts = {};

// Utils
const fmt = n => {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return n.toString();
};

const yearStr = y => y < 0 ? `${Math.abs(y)} BCE` : `${y} CE`;

const getEra = (start) => {
  if (start < 0) return 'Ancient';
  if (start < 500) return 'Ancient';
  if (start < 1500) return 'Medieval';
  if (start < 1800) return 'Early Modern';
  if (start < 1900) return '19th Century';
  if (start < 2000) return '20th Century';
  return '21st Century';
};

const getRegions = () => [...new Set(wars.flatMap(w => w.region.split('/')))].sort();

function getFiltered() {
  return wars.filter(w => {
    if (filters.scale !== 'all' && w.scale !== filters.scale) return false;
    if (filters.region !== 'all' && !w.region.includes(filters.region)) return false;
    if (filters.era !== 'all' && getEra(w.start) !== filters.era) return false;
    return true;
  });
}

// Init
function init() {
  renderStats();
  setupFilters();
  setupTabs();
  renderCurrentTab();
}

function renderStats() {
  const totalCasualties = wars.reduce((s, w) => s + w.casualties, 0);
  const majorCount = wars.filter(w => w.scale === 'major').length;
  document.getElementById('stat-total').textContent = wars.length;
  document.getElementById('stat-casualties').textContent = fmt(totalCasualties);
  document.getElementById('stat-major').textContent = majorCount;
  document.getElementById('stat-span').textContent = `${yearStr(Math.min(...wars.map(w => w.start)))} — Now`;
}

function setupFilters() {
  const regionSel = document.getElementById('filter-region');
  getRegions().forEach(r => {
    const o = document.createElement('option');
    o.value = r; o.textContent = r;
    regionSel.appendChild(o);
  });

  document.querySelectorAll('.filters select').forEach(sel => {
    sel.addEventListener('change', () => {
      filters.region = document.getElementById('filter-region').value;
      filters.scale = document.getElementById('filter-scale').value;
      filters.era = document.getElementById('filter-era').value;
      renderCurrentTab();
    });
  });
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      document.getElementById(`section-${currentTab}`).classList.add('active');
      renderCurrentTab();
    });
  });
}

function renderCurrentTab() {
  const data = getFiltered();
  if (currentTab === 'timeline') renderTimeline(data);
  else if (currentTab === 'casualties') renderCasualties(data);
  else if (currentTab === 'frequency') renderFrequency(data);
  else if (currentTab === 'list') renderList(data);
}

// Timeline
function renderTimeline(data) {
  if (charts.timeline) charts.timeline.destroy();
  const sorted = [...data].sort((a, b) => a.start - b.start);
  const canvas = document.getElementById('chart-timeline');
  
  charts.timeline = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: sorted.map(w => w.name),
      datasets: [{
        label: 'Duration',
        data: sorted.map(w => [w.start, w.end || w.start + 1]),
        backgroundColor: sorted.map(w => w.scale === 'major' ? 'rgba(239,68,68,0.7)' : 'rgba(245,158,11,0.5)'),
        borderColor: sorted.map(w => w.scale === 'major' ? '#ef4444' : '#f59e0b'),
        borderWidth: 1,
        borderRadius: 3,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const w = sorted[ctx.dataIndex];
              return [
                `${yearStr(w.start)} — ${yearStr(w.end)}`,
                `Casualties: ${fmt(w.casualties)}`,
                `${w.belligerents}`,
                `Type: ${w.type}`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: 'Year', color: '#8888a0' },
          ticks: { color: '#8888a0', callback: v => yearStr(v) },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        y: {
          ticks: { color: '#e8e8f0', font: { size: 10 } },
          grid: { display: false }
        }
      }
    }
  });
}

// Casualties
function renderCasualties(data) {
  if (charts.casualties) charts.casualties.destroy();
  if (charts.casualtiesTop) charts.casualtiesTop.destroy();

  const sorted = [...data].sort((a, b) => b.casualties - a.casualties).slice(0, 25);
  
  charts.casualties = new Chart(document.getElementById('chart-casualties'), {
    type: 'bar',
    data: {
      labels: sorted.map(w => w.name),
      datasets: [{
        label: 'Estimated Casualties',
        data: sorted.map(w => w.casualties),
        backgroundColor: sorted.map(w => {
          if (w.casualties > 10e6) return 'rgba(239,68,68,0.8)';
          if (w.casualties > 1e6) return 'rgba(249,115,22,0.7)';
          if (w.casualties > 100e3) return 'rgba(245,158,11,0.6)';
          return 'rgba(99,102,241,0.5)';
        }),
        borderRadius: 4,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${fmt(sorted[ctx.dataIndex].casualties)} casualties`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#8888a0', callback: v => fmt(v) },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        y: {
          ticks: { color: '#e8e8f0', font: { size: 10 } },
          grid: { display: false }
        }
      }
    }
  });

  // Bubble chart: duration vs casualties
  charts.casualtiesTop = new Chart(document.getElementById('chart-bubble'), {
    type: 'bubble',
    data: {
      datasets: [{
        label: 'Wars',
        data: data.filter(w => w.start > 0).map(w => ({
          x: w.start,
          y: w.casualties,
          r: Math.max(3, Math.sqrt(w.casualties / 50000)),
          war: w
        })),
        backgroundColor: data.filter(w => w.start > 0).map(w => w.scale === 'major' ? 'rgba(239,68,68,0.5)' : 'rgba(99,102,241,0.4)'),
        borderColor: data.filter(w => w.start > 0).map(w => w.scale === 'major' ? '#ef4444' : '#6366f1'),
        borderWidth: 1,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const w = ctx.raw.war;
              return [`${w.name}`, `${yearStr(w.start)}–${yearStr(w.end)}`, `${fmt(w.casualties)} casualties`];
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Year', color: '#8888a0' },
          ticks: { color: '#8888a0' },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        y: {
          title: { display: true, text: 'Casualties', color: '#8888a0' },
          ticks: { color: '#8888a0', callback: v => fmt(v) },
          grid: { color: 'rgba(255,255,255,0.05)' },
          type: 'logarithmic'
        }
      }
    }
  });
}

// Frequency
function renderFrequency(data) {
  if (charts.freqCentury) charts.freqCentury.destroy();
  if (charts.freqType) charts.freqType.destroy();

  // Wars per century
  const centuries = {};
  data.forEach(w => {
    const c = w.start < 0 ? `${Math.ceil(Math.abs(w.start) / 100)} BCE` : `${Math.ceil(w.start / 100)}`;
    centuries[c] = (centuries[c] || 0) + 1;
  });

  // Better: group into meaningful periods
  const periods = {};
  const periodOrder = ['Ancient (<500 BCE)', '500 BCE–0', '0–500 CE', '500–1000', '1000–1500', '1500–1600', '1600–1700', '1700–1800', '1800–1850', '1850–1900', '1900–1950', '1950–2000', '2000–2025'];
  const getPeriod = (y) => {
    if (y < -500) return 'Ancient (<500 BCE)';
    if (y < 0) return '500 BCE–0';
    if (y < 500) return '0–500 CE';
    if (y < 1000) return '500–1000';
    if (y < 1500) return '1000–1500';
    if (y < 1600) return '1500–1600';
    if (y < 1700) return '1600–1700';
    if (y < 1800) return '1700–1800';
    if (y < 1850) return '1800–1850';
    if (y < 1900) return '1850–1900';
    if (y < 1950) return '1900–1950';
    if (y < 2000) return '1950–2000';
    return '2000–2025';
  };
  data.forEach(w => {
    const p = getPeriod(w.start);
    periods[p] = (periods[p] || 0) + 1;
  });

  charts.freqCentury = new Chart(document.getElementById('chart-frequency'), {
    type: 'bar',
    data: {
      labels: periodOrder.filter(p => periods[p]),
      datasets: [{
        label: 'Number of Wars',
        data: periodOrder.filter(p => periods[p]).map(p => periods[p]),
        backgroundColor: 'rgba(99,102,241,0.6)',
        borderColor: '#6366f1',
        borderWidth: 1,
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8888a0', maxRotation: 45 }, grid: { display: false } },
        y: { ticks: { color: '#8888a0' }, grid: { color: 'rgba(255,255,255,0.05)' }, title: { display: true, text: 'Count', color: '#8888a0' } }
      }
    }
  });

  // By type
  const types = {};
  data.forEach(w => {
    w.type.split('/').forEach(t => {
      types[t.trim()] = (types[t.trim()] || 0) + 1;
    });
  });
  const typeEntries = Object.entries(types).sort((a, b) => b[1] - a[1]);
  const typeColors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#14b8a6'];

  charts.freqType = new Chart(document.getElementById('chart-type'), {
    type: 'doughnut',
    data: {
      labels: typeEntries.map(e => e[0]),
      datasets: [{
        data: typeEntries.map(e => e[1]),
        backgroundColor: typeEntries.map((_, i) => typeColors[i % typeColors.length] + 'aa'),
        borderColor: typeEntries.map((_, i) => typeColors[i % typeColors.length]),
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: '#e8e8f0', padding: 12, font: { size: 12 } } }
      }
    }
  });
}

// List
function renderList(data) {
  const container = document.getElementById('war-list');
  const sorted = [...data].sort((a, b) => a.start - b.start);
  container.innerHTML = sorted.map(w => `
    <div class="war-card">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:0.4rem">
        <div class="war-name">${w.name}</div>
        <span class="badge ${w.scale}">${w.scale}</span>
      </div>
      <div class="war-meta">
        <span>📅 ${yearStr(w.start)} — ${yearStr(w.end)}</span>
        <span>💀 ${fmt(w.casualties)}</span>
        <span>🌍 ${w.region}</span>
      </div>
      <div class="war-meta" style="margin-top:0.3rem">
        <span>⚔️ ${w.belligerents}</span>
      </div>
      <div class="war-meta" style="margin-top:0.3rem">
        <span>🏷️ ${w.type}</span>
      </div>
    </div>
  `).join('');
}

document.addEventListener('DOMContentLoaded', init);
