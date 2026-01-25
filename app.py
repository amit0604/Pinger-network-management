from flask import Flask, render_template, jsonify
from loadDevicesData import load_devices
from networkMonitor import start_monitor, get_status

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

@app.route('/api/status')
def api_status():
    return jsonify(get_status())


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')
