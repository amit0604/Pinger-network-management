# networkMonitor.py
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from loadDevicesData import load_devices
from pingService import ping_ip

PING_INTERVAL = 3 # seconds
MAX_WORKERS = 65 # 64 devices + 1 for safety; adjust as needed based on expected device count and system capabilities

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
        prev_status = {}
        with _lock:
            prev_status = dict(_device_status)

        results = {}

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            future_map = {
                executor.submit(ping_ip, d["ip"]): d["ip"]
                for d in devices
            }

            for future in as_completed(future_map):
                ip = future_map[future]
                try:
                    latency = future.result()
                except Exception:
                    latency = None

                online = latency is not None
                prev_last = prev_status.get(ip, {}).get('last_seen') if prev_status else None
                last_seen = time.time() if online else prev_last

                results[ip] = {
                    'online': online,
                    'latency': latency,
                    'last_seen': last_seen
                }

        with _lock:
            _device_status = results

        time.sleep(PING_INTERVAL)

def start_monitor():
    t = threading.Thread(target=monitor_loop, daemon=True)
    t.start()
