from flask import Flask, render_template, jsonify, request
from devicesMethods import add_device, load_devices_raw, remove_device, update_device
from loadDevicesData import load_devices
from networkMonitor import PING_INTERVAL, start_monitor, get_status

app = Flask(__name__)

# Start background monitor
start_monitor()

# Flask routes
@app.route('/')
def index():
    devices = load_devices()
    return render_template('index.html', devices=devices)

@app.route('/switch-monitor')
def switch_monitor():
    devices = load_devices()
    return render_template('switch-monitor.html', devices=devices)

# API routes for device management
@app.route('/api/devices', methods=['GET'])
def api_get_devices():
    return jsonify(load_devices_raw())

@app.route('/api/devices', methods=['POST'])
def api_add_device():
    device = request.get_json()
    if not device:
        return jsonify({"status": "error", "message": "Invalid JSON payload"}), 400

    try:
        add_device(device)
    except ValueError as e:
        return jsonify({"status": "error", "message": str(e)}), 400

    return jsonify({"status": "success", "message": "Device added successfully"}), 201

@app.route('/api/devices/<ip>', methods=['DELETE'])
def api_remove_device(ip):
    remove_device(ip)
    return jsonify({"status": "ok"})


@app.route('/api/devices/<ip>', methods=['PUT'])
def api_update_device(ip):
    updated = request.get_json()
    if not updated:
        return jsonify({"status": "error", "message": "Invalid JSON payload"}), 400

    try:
        update_device(ip, updated)
    except ValueError as e:
        return jsonify({"status": "error", "message": str(e)}), 404

    return jsonify({"status": "ok"})

@app.route('/api/status')
def api_status():
    return jsonify(get_status())



if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', use_reloader=False)
