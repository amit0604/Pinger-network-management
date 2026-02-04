from flask import Flask, render_template, jsonify
from loadDevicesData import load_devices
from networkMonitor import PING_INTERVAL, start_monitor, get_status
from pingHistoryRecorder import get_history_summary, get_worst_device

app = Flask(__name__)

# Start background monitor
start_monitor()

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
    devices = load_devices()
    return render_template('dashboard.html', devices=devices)

@app.route('/api/status')
def api_status():
    return jsonify(get_status())

@app.route('/api/history')
def api_history():
    return jsonify(get_history_summary())

@app.route('/api/worst-device')
def api_worst_device():
    ip, uptime = get_worst_device()
    return jsonify({
        "ip": ip,
        "uptime": uptime
    })


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', use_reloader=False)
