from flask import Flask, render_template, jsonify, request
from devicesMethods import add_device, load_devices_raw, remove_device, update_device
from loadDevicesData import load_devices
from networkMonitor import PING_INTERVAL, start_monitor, get_status, register_emitter, get_history, get_alerts, get_snmp_logs
from flask_socketio import SocketIO
import json
import time

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins='*')

# register emitter so networkMonitor can push updates
def _emitter(event, payload):
    try:
        socketio.emit(event, payload, namespace='/')
    except Exception:
        pass

register_emitter(_emitter)
# Start background monitor after emitter is registered
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


@app.route('/dashboard')
def dashboard():
    # Dashboard is rendered client-side using the existing APIs
    return render_template('dashboard.html')

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

    # emit server-side alert and log (include device details)
    alert = {
        'type': 'device_added',
        'ip': device.get('ip'),
        'ts': time.time(),
        'msg': f"Device added: name={device.get('name')}, ip={device.get('ip')}, type={device.get('type')}, group={device.get('group')}",
        'device': device
    }
    try:
        socketio.emit('alert', alert)
    except Exception:
        pass
    try:
        with open('events.log', 'a') as f:
            f.write(json.dumps({'type': 'device_event', 'ts': alert['ts'], 'event': alert}) + "\n")
    except Exception:
        pass

    return jsonify({"status": "success", "message": "Device added successfully"}), 201

@app.route('/api/devices/<ip>', methods=['DELETE'])
def api_remove_device(ip):
    # capture device info before removal
    devices_all = load_devices_raw()
    device_info = next((d for d in devices_all if d.get('ip') == ip), None)
    remove_device(ip)
    alert = {
        'type': 'device_removed',
        'ip': ip,
        'ts': time.time(),
        'msg': f"Device removed: name={device_info.get('name') if device_info else ''}, ip={ip}",
        'device': device_info
    }
    try:
        socketio.emit('alert', alert)
    except Exception:
        pass
    try:
        with open('events.log', 'a') as f:
            f.write(json.dumps({'type': 'device_event', 'ts': alert['ts'], 'event': alert}) + "\n")
    except Exception:
        pass
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

    # include details of update
    alert = {
        'type': 'device_updated',
        'ip': ip,
        'ts': time.time(),
        'msg': f"Device updated: ip={ip}, changes={updated}",
        'changes': updated
    }
    try:
        socketio.emit('alert', alert)
    except Exception:
        pass
    try:
        with open('events.log', 'a') as f:
            f.write(json.dumps({'type': 'device_event', 'ts': alert['ts'], 'event': alert}) + "\n")
    except Exception:
        pass

    return jsonify({"status": "ok"})

@app.route('/api/status')
def api_status():
    return jsonify(get_status())


@app.route('/api/status/history')
def api_status_history():
    return jsonify(get_history())


@app.route('/api/alerts')
def api_alerts():
    return jsonify(get_alerts())


@app.route('/api/snmp')
def api_snmp():
    return jsonify(get_snmp_logs())



if __name__ == '__main__':
    # use SocketIO runner to support websocket connections
    socketio.run(app, debug=True, host='0.0.0.0', use_reloader=False)
