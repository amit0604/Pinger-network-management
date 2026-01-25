# networkMonitor.py
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from loadDevicesData import load_devices
from pingService import ping_ip

PING_INTERVAL = 5
MAX_WORKERS = 50

_device_status = {}
_lock = threading.Lock()

def get_status():
    with _lock:
        return dict(_device_status)

def monitor_loop():
    global _device_status

    while True:
        devices = load_devices()
        if not devices:
            time.sleep(PING_INTERVAL)
            continue

        results = {}

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            future_map = {
                executor.submit(ping_ip, d["ip"]): d["ip"]
                for d in devices
            }

            for future in as_completed(future_map):
                ip = future_map[future]
                try:
                    results[ip] = future.result()
                except Exception:
                    results[ip] = False

        with _lock:
            _device_status = results

        time.sleep(PING_INTERVAL)

def start_monitor():
    t = threading.Thread(target=monitor_loop, daemon=True)
    t.start()
