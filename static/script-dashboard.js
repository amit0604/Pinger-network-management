/* ================================
   Dashboard Auto Refresh Script
   ================================ */

/* Prevent overlapping fetch cycles */
let dashboardBusy = false;

/* ---------- MAIN REFRESH LOOP ---------- */
function refreshDashboard() {
    if (dashboardBusy) return;
    dashboardBusy = true;

    Promise.all([
        fetch('/api/status').then(r => r.json()),
        fetch('/api/history').then(r => r.json())
    ])
    .then(([status, history]) => {
        updateAvailability(status);
        updateWorstDeviceFromHistory(history);
    })
    .catch(err => {
        console.error('Dashboard refresh failed:', err);
    })
    .finally(() => {
        dashboardBusy = false;
    });
}

/* ---------- AVAILABILITY / UPTIME ---------- */
function updateAvailability(status) {
    const values = Object.values(status);

    const total = values.length;
    const online = values.filter(v => v === true).length;

    const availability = total === 0
        ? 0
        : Math.round((online / total) * 100);

    updateUptimeMeter(availability);
}

function updateUptimeMeter(percent) {
    const circle = document.querySelector('.circle');
    const value = document.getElementById('uptime-value');

    if (!circle || !value) return;

    circle.setAttribute('stroke-dasharray', `${percent}, 100`);
    value.textContent = `${percent}%`;

    if (percent < 50) {
        circle.style.stroke = 'var(--offline)';
    } else if (percent < 80) {
        circle.style.stroke = 'var(--unknown)';
    } else {
        circle.style.stroke = 'var(--online)';
    }
}

/* ---------- WORST DEVICE (FROM HISTORY) ---------- */
function updateWorstDeviceFromHistory(history) {
    const container = document.getElementById('worst-device');
    if (!container) return;

    let worstIp = null;
    let worstUptime = 101;

    Object.entries(history).forEach(([ip, data]) => {
        if (!data || data.samples === 0) return;

        if (data.uptime < worstUptime) {
            worstUptime = data.uptime;
            worstIp = ip;
        }
    });

    if (!worstIp) {
        container.className = 'worst-device ok';
        container.innerHTML = `
            <span class="device-name">No history yet</span>
            <span>—</span>
        `;
        return;
    }

    if (worstUptime === 100) {
        container.className = 'worst-device ok';
        container.innerHTML = `
            <span class="device-name">All devices stable</span>
            <span>100%</span>
        `;
        return;
    }

    container.className = 'worst-device bad';
    container.innerHTML = `
        <span class="device-name">${worstIp}</span>
        <span>${worstUptime}% uptime</span>
    `;
}

/* ---------- INIT ---------- */

/* Initial load */
refreshDashboard();

/* Update every 60 seconds */
setInterval(refreshDashboard, 60 * 1000);
