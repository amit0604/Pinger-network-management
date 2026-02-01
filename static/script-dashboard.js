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
        updateWorstDevice(status);
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

function updateWorstDevice(status) {
    const container = document.getElementById('worst-device');

    const offlineDevices = Object.entries(status)
        .filter(([_, online]) => online === false)
        .map(([ip]) => ip)
        .sort(); // deterministic

    if (offlineDevices.length === 0) {
        container.className = 'worst-device ok';
        container.innerHTML = `<span class="device-name">All devices online</span>`;
        return;
    }

    const worstIp = offlineDevices[0];

    container.className = 'worst-device bad';
    container.innerHTML = `
        <span class="device-name">${worstIp}</span>
        <span>OFFLINE</span>
    `;
}