import json
import threading

DEVICES_FILE = "static/devices.json"
_lock = threading.Lock()


def load_devices_raw():
    with open(DEVICES_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_devices(devices):
    with open(DEVICES_FILE, "w", encoding="utf-8") as f:
        json.dump(devices, f, indent=2, ensure_ascii=False)


def add_device(device):
    with _lock:
        devices = load_devices_raw()

        # prevent duplicates
        if any(d["ip"] == device["ip"] for d in devices):
            raise ValueError("Device with this IP already exists")

        devices.append(device)
        save_devices(devices)


def remove_device(ip):
    with _lock:
        devices = load_devices_raw()
        new_devices = [d for d in devices if d["ip"] != ip]

        if len(new_devices) == len(devices):
            raise ValueError("Device not found")

        save_devices(new_devices)


def update_device(ip, updated_fields):
    with _lock:
        devices = load_devices_raw()
        found = False

        for d in devices:
            if d["ip"] == ip:
                d.update(updated_fields)
                found = True
                break

        if not found:
            raise ValueError("Device not found")

        save_devices(devices)
