import json
import os

def load_devices():
    try:
        base_directory = os.path.dirname(os.path.abspath(__file__))
        devices_file_path = os.path.join(base_directory, 'static', 'devices.json')
        
        with open(devices_file_path, 'r') as devices_file:
            devices = json.load(devices_file)

        print("Devices imported successfully.")
        return devices

    except FileNotFoundError:
        print("Error: 'devices.json' file not found.")
    except json.JSONDecodeError:
        print("Error: Failed to decode JSON from 'devices.json'.")
