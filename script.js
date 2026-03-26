// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initSmartInputs();
    renderDatabase();
    renderTrends();
});

Chart.defaults.color = '#a0a0a0';
Chart.defaults.borderColor = 'rgba(255,255,255,0.05)';
Chart.defaults.font.family = 'Inter';

let xaiChartObj = null;

// --- Navigation Logic ---
function navigateTo(pageId) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    
    const targetNav = document.querySelector(`.nav-item[data-page="${pageId}"]`);
    if(targetNav) targetNav.classList.add('active');
    
    const targetPage = document.getElementById(pageId);
    if(targetPage) targetPage.classList.add('active');
}

function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            navigateTo(item.dataset.page);
        });
    });
}

// --- Smart Inputs Logic ---
const thresholds = {
    HR: { min: 60, max: 100, critMin: 50, critMax: 120 },
    O2Sat: { min: 95, max: 100, critMin: 90, critMax: 100 },
    Temp: { min: 36.5, max: 37.5, critMin: 35.0, critMax: 38.5 },
    SBP: { min: 90, max: 120, critMin: 80, critMax: 140 },
    MAP: { min: 70, max: 100, critMin: 60, critMax: 110 },
    DBP: { min: 60, max: 80, critMin: 50, critMax: 90 },
    Resp: { min: 12, max: 20, critMin: 8, critMax: 24 }
};

function initSmartInputs() {
    document.querySelectorAll('.input-group input').forEach(input => {
        input.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            const dot = document.getElementById(`dot-${e.target.id.toLowerCase()}`);
            if (dot) {
                dot.className = 'status-dot';
                if (!isNaN(val)) {
                    let status = 'status-green';
                    const t = thresholds[e.target.id];
                    if (t) {
                        if (val < t.critMin || val > t.critMax) status = 'status-red';
                        else if (val < t.min || val > t.max) status = 'status-yellow';
                    }
                    dot.classList.add(status);
                }
            }
        });
    });
}

// --- Live Analysis Fetch & Render ---
function switchState(state) {
    document.querySelectorAll('.results-container .state-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`${state}-state`).classList.add('active');
}

document.getElementById('prediction-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    switchState('loading');
    
    const payload = {};
    ['HR','O2Sat','Temp','SBP','MAP','DBP','Resp','Age'].forEach(id => {
        payload[id] = parseFloat(document.getElementById(id).value) || 0;
    });

    try {
        const response = await fetch('/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        
        if(data.error) throw new Error(data.error);

        // Reset gauge
        const gauge = document.getElementById('gauge-bar');
        gauge.style.strokeDashoffset = '440';
        
        switchState('results');
        // Dynamically shift UI Colors based on clinical levels
        const resultsContainer = document.getElementById('results-state');
        resultsContainer.className = 'state-panel results-layout active';
        if (data.level === 'High') {
            resultsContainer.classList.add('theme-high');
        } else if (data.level === 'Moderate') {
            resultsContainer.classList.add('theme-med');
        } else {
            resultsContainer.classList.add('theme-low');
        }

        // Render Values
        setTimeout(() => {
            const circ = 440;
            const offset = circ - (circ * data.risk) / 100;
            gauge.style.strokeDashoffset = offset;
            
            document.getElementById('risk-score').textContent = `${data.risk}%`;
            document.getElementById('risk-level').textContent = data.level;
            document.getElementById('clinical-rec').textContent = data.recommendation;
            
            renderXAIChart(data.drivers, data.level);
        }, 100);

    } catch (err) {
        console.error(err);
        alert("Server error. Make sure app.py is running!");
        switchState('empty');
    }
});

function renderXAIChart(drivers, level) {
    const ctx = document.getElementById('xaiChart').getContext('2d');
    let color = '#00ff88';
    if(level === 'High') color = '#ff1100';
    else if(level === 'Moderate') color = '#ffaa00';

    if (xaiChartObj) xaiChartObj.destroy();
    xaiChartObj = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: drivers.map(d => d.name),
            datasets: [{
                data: drivers.map(d => d.value),
                backgroundColor: color,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: { x: { display: false, max: 100 }, y: { grid: { display: false } } }
        }
    });
}

// --- Page 2: Patient DB (Mock Data) ---
function renderDatabase() {
    const tbody = document.getElementById('patient-tbody');
    const mockData = [
        { name: "Arun Kumar", id: "#1001", age: 54, score: 85, status: "High" },
        { name: "Sara Smith", id: "#1002", age: 34, score: 12, status: "Low" },
        { name: "John Doe", id: "#1003", age: 67, score: 45, status: "Moderate" },
        { name: "Priya", id: "#9921", age: 45, score: "-", status: "Pending" }
    ];

    mockData.forEach(p => {
        let badgeClass = 'badge-low';
        if (p.status === 'High') badgeClass = 'badge-high';
        else if (p.status === 'Moderate') badgeClass = 'badge-med';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${p.name}</strong></td>
            <td>${p.id}</td>
            <td>${p.age}</td>
            <td>${p.score}%</td>
            <td><span class="badge ${badgeClass}">${p.status}</span></td>
            <td><button class="btn-sm" onclick="navigateTo('page-trends')"><i class="fa-solid fa-chart-line"></i> View</button></td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('patient-search').addEventListener('keyup', (e) => {
        const val = e.target.value.toLowerCase();
        const rows = tbody.querySelectorAll('tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(val) ? '' : 'none';
        });
    });
}

// --- Page 3: Clinical Trends (Mock Data) ---
function renderTrends() {
    const labels = Array.from({length: 24}, (_, i) => `-${24-i}h`);
    
    // Heart Rate Trend
    new Chart(document.getElementById('trendHR'), {
        type: 'line',
        data: {
            labels,
            datasets: [{ label: 'HR (bpm)', data: labels.map(() => 70 + Math.random()*20), borderColor: '#ff1100', tension: 0.4 }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // BP Trend
    new Chart(document.getElementById('trendBP'), {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: 'Systolic', data: labels.map(() => 110 + Math.random()*30), borderColor: '#bc13fe', tension: 0.4 },
                { label: 'Diastolic', data: labels.map(() => 70 + Math.random()*20), borderColor: '#00f3ff', tension: 0.4 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // O2 Saturation
    new Chart(document.getElementById('trendO2'), {
        type: 'line',
        data: {
            labels,
            datasets: [{ label: 'SpO2 (%)', data: labels.map(() => 94 + Math.random()*6), borderColor: '#00ff88', tension: 0.4, fill: true, backgroundColor: 'rgba(0,255,136,0.1)' }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 85, max: 100 } } }
    });

    // Temperature Trend
    new Chart(document.getElementById('trendTemp'), {
        type: 'line',
        data: {
            labels,
            datasets: [{ label: 'Temp (°C)', data: labels.map(() => 36.5 + Math.random()*2), borderColor: '#ffaa00', tension: 0.4 }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // MAP Trend
    new Chart(document.getElementById('trendMAP'), {
        type: 'line',
        data: {
            labels,
            datasets: [{ label: 'MAP (mmHg)', data: labels.map(() => 80 + Math.random()*20), borderColor: '#bc13fe', tension: 0.4 }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Respiration Trend
    new Chart(document.getElementById('trendResp'), {
        type: 'line',
        data: {
            labels,
            datasets: [{ label: 'Resp (breaths/min)', data: labels.map(() => 14 + Math.random()*8), borderColor: '#00f3ff', tension: 0.4, fill: true, backgroundColor: 'rgba(0,243,255,0.1)' }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}
