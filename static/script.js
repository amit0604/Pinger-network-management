const deviceCardTemplate = document.querySelector('[data-device-template]');
const deviceCardsContainer = document.querySelector('[data-device-cards-container]');
const searchInput = document.querySelector('[data-search]');
const onlineCountElement = document.querySelector('.online-count');
const offlineCountElement = document.querySelector('.offline-count');
const availabilityElement = document.querySelector('.availability');

let devices = [];
let cardsByIp = {};

fetch('/static/devices.json')
    .then(res => res.json())
    .then(data => {
        devices = data.map(device => {
            const card = deviceCardTemplate.content.cloneNode(true).children[0];

            card.querySelector('.title-name').textContent = device.name;
            card.querySelector('.title-ip').textContent = device.ip;
            card.querySelector('.title-type').textContent = device.type;

            deviceCardsContainer.append(card);
            cardsByIp[device.ip] = card;

            return {
                name: device.name.toLowerCase(),
                ip: device.ip.toLowerCase(),
                element: card
            };
        });
    });

// Search
searchInput.addEventListener('input', e => {
    const value = e.target.value.toLowerCase();
    devices.forEach(d => {
        const visible = d.name.includes(value) || d.ip.includes(value);
        d.element.classList.toggle('hide', !visible);
    });
});

function updateHealthStatistics(status) {
    const values = Object.values(status);
    const total = values.length;
    const online = values.filter(v => v).length;
    const offline = total - online;
    const availability = total > 0 ? Math.round((online / total) * 100) : 0;

    onlineCountElement.textContent = `🟢 Online: ${online}`;
    offlineCountElement.textContent = `🔴 Offline: ${offline}`;
    availabilityElement.textContent = `📊 Availability: ${availability}%`;
}

// Poll backend
setInterval(() => {
    fetch('/api/status')
        .then(res => res.json())
        .then(status => {
            updateHealthStatistics(status);
            
            Object.entries(status).forEach(([ip, online]) => {
                const card = cardsByIp[ip];
                if (!card) return;

                card.classList.toggle('online', online);
                card.classList.toggle('offline', !online);
            });
        });
}, 1000);
