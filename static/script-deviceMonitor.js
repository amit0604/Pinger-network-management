const deviceCardTemplate = document.querySelector('[data-device-template]');
const deviceCardsContainer = document.querySelector('[data-device-cards-container]');
const searchInput = document.querySelector('[data-search]');
const onlineCountElement = document.querySelector('.online-count');
const offlineCountElement = document.querySelector('.offline-count');
const availabilityElement = document.querySelector('.availability');
const onlineListElement = document.querySelector('.online-list');
const offlineListElement = document.querySelector('.offline-list');

// Modal elements
const addDeviceBtn = document.getElementById('add-device-btn');
const deviceModal = document.getElementById('device-modal');
const saveDeviceBtn = document.getElementById('save-device');
const cancelDeviceBtn = document.getElementById('cancel-device');
const inputName = document.getElementById('dev-name');
const inputIp = document.getElementById('dev-ip');
const inputType = document.getElementById('dev-type');
const inputModel = document.getElementById('dev-model');
const inputGroup = document.getElementById('dev-group');

let devices = [];
let cardsByIp = {};
let devicesByIp = {};
let editingIp = null;
const contextMenu = document.getElementById('card-context-menu');
const contextEdit = document.getElementById('context-edit');
const contextRemove = document.getElementById('context-remove');

loadDevices();

function loadDevices() {
    return fetch('/api/devices')
        .then(res => res.json())
        .then(data => {
            deviceCardsContainer.innerHTML = '';
            cardsByIp = {};
            devicesByIp = {};
            devices = [];

            data.forEach(device => {
                const card = deviceCardTemplate.content.cloneNode(true).children[0];

                card.querySelector('.title-name').textContent = device.name;
                card.querySelector('.title-ip').textContent = device.ip;
                card.querySelector('.title-type').textContent = device.type;

                    deviceCardsContainer.append(card);
                    // attach ip to element for context menu
                    card.dataset.ip = device.ip;
                    cardsByIp[device.ip] = card;
                    devicesByIp[device.ip] = device;

                    devices.push({
                        name: device.name.toLowerCase(),
                        ip: device.ip.toLowerCase(),
                        element: card
                    });

                    // right-click context menu on card
                    card.addEventListener('contextmenu', (ev) => {
                        ev.preventDefault();
                        showContextMenu(ev.pageX, ev.pageY, device.ip);
                    });
            });
        });
}


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
    const onlineList = [];
    const offline = total - online;
    const offlineList = [];
    const availability = total > 0 ? Math.round((online / total) * 100) : 0;

    Object.entries(status).forEach(([ip, isOnline]) => {
        if (isOnline) onlineList.push(ip);
        else offlineList.push(ip);
    });

    // Update online/offline lists
    onlineListElement.innerHTML = '';
    onlineList.forEach(ip => {
        const div = document.createElement('div');
        div.textContent = ip;
        onlineListElement.appendChild(div);
    });

    offlineListElement.innerHTML = '';
    offlineList.forEach(ip => {
        const div = document.createElement('div');
        div.textContent = ip;
        offlineListElement.appendChild(div);
    });

    // Update counts   

    onlineCountElement.textContent = `🟢 Online: ${online}`;
    offlineCountElement.textContent = `🔴 Offline: ${offline}`;
    availabilityElement.textContent = `📊 Availability: ${availability}%`;
}

function addDevice(device) {
    return fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(device)
    }).then(async res => {
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.message || 'Failed to add device');
        }
        await loadDevices();
        return res.json();
    });
}

function removeDevice(ip) {
    return fetch(`/api/devices/${ip}`, {
        method: 'DELETE'
    }).then(async res => {
        await loadDevices();
        return res;
    });
}

function updateDevice(originalIp, updatedFields) {
    return fetch(`/api/devices/${originalIp}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields)
    }).then(async res => {
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.message || 'Failed to update device');
        }
        await loadDevices();
        return res.json();
    });
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

                // simple online/offline label (backend provides boolean status)
                const latencyElement = card.querySelector('.latency');
                if (latencyElement) {
                    latencyElement.textContent = online ? 'Online' : 'Offline';
                }
            });
        });

}, 1000);

// Modal helpers
function openModal() {
    deviceModal.classList.remove('hidden');
}

function closeModal() {
    deviceModal.classList.add('hidden');
    // clear inputs
    inputName.value = '';
    inputIp.value = '';
    inputType.value = '';
    inputModel.value = '';
    inputGroup.value = '';
}

addDeviceBtn.addEventListener('click', () => {
    editingIp = null;
    document.getElementById('modal-title').textContent = 'Add Device';
    openModal();
});

cancelDeviceBtn.addEventListener('click', () => {
    closeModal();
});

saveDeviceBtn.addEventListener('click', async () => {
    const name = inputName.value.trim();
    const ip = inputIp.value.trim();
    const type = inputType.value.trim();
    const model = inputModel.value.trim();
    const group = inputGroup.value.trim();

    if (!name || !ip) {
        alert('Please provide both name and IP address.');
        return;
    }

    const device = { name, ip, type, model, group };

    try {
        if (editingIp) {
            await updateDevice(editingIp, device);
        } else {
            await addDevice(device);
        }
        editingIp = null;
        document.getElementById('modal-title').textContent = 'Add Device';
        closeModal();
    } catch (err) {
        alert(err.message || 'Error saving device');
    }
});

// Context menu helpers
function showContextMenu(x, y, ip) {
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
    contextMenu.classList.remove('hidden');
    contextMenu.dataset.targetIp = ip;
}

function hideContextMenu() {
    contextMenu.classList.add('hidden');
    delete contextMenu.dataset.targetIp;
}

// Click handlers for context menu
contextEdit.addEventListener('click', () => {
    const ip = contextMenu.dataset.targetIp;
    if (!ip) return hideContextMenu();
    const device = devicesByIp[ip];
    if (!device) return hideContextMenu();

    // prefill modal and open for editing
    editingIp = ip;
    document.getElementById('modal-title').textContent = 'Edit Device';
    inputName.value = device.name || '';
    inputIp.value = device.ip || '';
    inputType.value = device.type || '';
    inputModel.value = device.model || '';
    inputGroup.value = device.group || '';
    hideContextMenu();
    openModal();
});

contextRemove.addEventListener('click', async () => {
    const ip = contextMenu.dataset.targetIp;
    if (!ip) return hideContextMenu();
    if (!confirm(`Remove device ${ip}?`)) return hideContextMenu();
    try {
        await removeDevice(ip);
    } catch (err) {
        alert(err.message || 'Failed to remove device');
    } finally {
        hideContextMenu();
    }
});

// Hide menu on click elsewhere or escape
document.addEventListener('click', (e) => {
    if (!contextMenu.classList.contains('hidden')) {
        // if click outside menu, hide
        if (!contextMenu.contains(e.target)) hideContextMenu();
    }
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideContextMenu();
});
