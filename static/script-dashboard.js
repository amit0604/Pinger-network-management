fetch('/api/status')
    .then(res => res.json())
    .then(status => {
        const values = Object.values(status);

        const total = values.length;
        const online = values.filter(v => v === true).length;

        const availability = total === 0
            ? 0
            : Math.round((online / total) * 100);

        updateUptimeMeter(availability);
    });

function updateUptimeMeter(percent) {
    const circle = document.querySelector('.circle');
    const value = document.getElementById('uptime-value');

    circle.setAttribute('stroke-dasharray', `${percent}, 100`);
    value.textContent = `${percent}%`;

    if (percent < 50) {
        circle.style.stroke = 'var(--offline)';
    } else if (percent < 80) {
        circle.style.stroke = '#f1c40f';
    } else {
        circle.style.stroke = 'var(--online)';
    }
}

fetch('/api/history')
    .then(res => res.json())
    .then(history => {
        updateWorstDeviceFromHistory(history);
    });

function updateWorstDeviceFromHistory(history) {
    const container = document.getElementById('worst-device');

    let worstIp = null;
    let worstUptime = 101;

    Object.entries(history).forEach(([ip, data]) => {
        if (data.minutes === 0) return;

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
