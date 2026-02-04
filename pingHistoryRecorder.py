from collections import defaultdict, deque
from time import time,sleep
import threading

from networkMonitor import PING_INTERVAL, get_status

# ================================
# Configuration
# ================================
# Store historical data
HISTORY_WINDOW_MINUTES = 60  # last 1 hour
MAX_SAMPLES = (HISTORY_WINDOW_MINUTES * 60) // PING_INTERVAL

# ================================
# Shared history store
# ================================    
device_history = defaultdict(lambda: deque(maxlen=MAX_SAMPLES))

def history_recorder():
    sleep(PING_INTERVAL * 2)  # initial delay
    while True:
        status = get_status() or {}
        record_history(status)
        sleep(5)

def record_history(status):
    now = time()
    # print("Recording history", status)
    for ip in status.keys():
        history = device_history[ip]
        is_online = status[ip]
        history.append({
            "ts": now,
            "online": 1 if is_online else 0,
            "total": 1
        })

    # cleanup
    cutoff = now - HISTORY_WINDOW_MINUTES * 60
    for ip in list(device_history.keys()):
        while device_history[ip] and device_history[ip][0]["ts"] < cutoff:
            device_history[ip].popleft()

# ================================
# Public helpers (used by Flask)
# ================================
def get_history_summary():
    result = {}

    for ip, records in device_history.items():
        total = sum(r["total"] for r in records)
        online = sum(r["online"] for r in records)

        if total == 0:
            continue

        result[ip] = {
            "uptime": round((online / total) * 100, 1),
            "samples": total
        }

    return result


def get_worst_device():
    worst_ip = None
    worst_uptime = 101

    for ip, records in device_history.items():
        total = sum(r["total"] for r in records)
        online = sum(r["online"] for r in records)

        if total == 0:
            continue

        uptime = (online / total) * 100
        if uptime < worst_uptime:
            worst_uptime = uptime
            worst_ip = ip

    return worst_ip, round(worst_uptime, 1) if worst_ip else None

# ================================
# Start background thread
# ================================
threading.Thread(target=history_recorder, daemon=True).start()