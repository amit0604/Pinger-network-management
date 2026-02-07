# networkMonitor.py
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from loadDevicesData import load_devices
from pingService import ping_ip
from collections import deque
import math
import json

# SNMP imports (optional)
try:
    from pysnmp.hlapi import *
    SNMP_AVAILABLE = True
except ImportError:
    SNMP_AVAILABLE = False


PING_INTERVAL = 1 # seconds (live updates)
MAX_WORKERS = 50

# History settings
HISTORY_SIZE = 120  # keep last 120 samples per device
FLAP_WINDOW = 20    # number of recent samples to inspect for flapping
FLAP_THRESHOLD = 4  # transitions threshold to flag flapping

_device_status = {}
_device_history = {}  # ip -> deque of samples {ts, latency, online}
_alerts = deque(maxlen=200)
_flapping_state = {}
_emitter = None
_lock = threading.Lock()

# SNMP logs (populated if an SNMP poller is added)
_snmp_logs = deque(maxlen=500)

# append events (alerts/snmp) to persistent log file
def _write_event_log(entry):
    try:
        with open('events.log', 'a') as f:
            f.write(json.dumps(entry) + '\n')
    except Exception:
        pass

def get_snmp_logs():
    with _lock:
        return list(_snmp_logs)

def add_snmp_log(entry):
    with _lock:
        _snmp_logs.appendleft(entry)
        # emit to subscribers
        # persist to file
        try:
            _write_event_log({'type': 'snmp_log', 'ts': entry.get('ts', time.time()), 'entry': entry})
        except Exception:
            pass
        if _emitter:
            try:
                _emitter('snmp_log', entry)
            except Exception:
                pass

def get_status():
    with _lock:
        return dict(_device_status)

def get_history():
    with _lock:
        # return lists (convert deques)
        return {ip: list(deque_) for ip, deque_ in _device_history.items()}

def get_alerts():
    with _lock:
        return list(_alerts)

def register_emitter(fn):
    """Register a callable `fn(event_name, payload)` used to push events (e.g., socketio.emit)."""
    global _emitter
    _emitter = fn

def query_snmp_device(ip, community='public', timeout=2, retries=1):
    """Query SNMP metrics from a device using pysnmp. Returns dict or None on failure."""
    if not SNMP_AVAILABLE:
        return None
    
    try:
        # Query system info OIDs
        errorIndication, errorStatus, errorIndex, varBinds = next(
            getCmd(SnmpEngine(),
                   CommunityData(community, mpModel=1),
                   UdpTransportTarget((ip, 161), timeout=timeout, retries=retries),
                   ContextData(),
                   ObjectType(ObjectIdentity('SNMPv2-MIB', 'sysUpTime', 0)),
                   ObjectType(ObjectIdentity('SNMPv2-MIB', 'sysDescr', 0)))
        )
        
        if errorIndication:
            return None
        
        sys_uptime = None
        sys_descr = None
        
        for varBind in varBinds:
            oid, val = varBind
            if '1.3.6.1.2.1.1.3' in str(oid):
                sys_uptime = str(val)
            elif '1.3.6.1.2.1.1.1' in str(oid):
                sys_descr = str(val)
        
        result = {
            'ip': ip,
            'ts': time.time(),
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
            'uptime': sys_uptime or 'N/A',
            'description': sys_descr or 'N/A',
            'interfaces': []
        }
        
        # Query interface names
        try:
            ifNames = {}
            for errorIndication, errorStatus, errorIndex, varBinds in bulkCmd(
                SnmpEngine(),
                CommunityData(community, mpModel=1),
                UdpTransportTarget((ip, 161), timeout=timeout, retries=retries),
                ContextData(),
                0, 10,
                ObjectType(ObjectIdentity('SNMPv2-MIB', 'ifName'))
            ):
                if errorIndication:
                    break
                for varBind in varBinds:
                    oid, val = varBind
                    oid_str = str(oid)
                    if_index = oid_str.split('.')[-1]
                    ifNames[if_index] = str(val)
            
            # Query stats for each interface (limit to 5)
            count = 0
            for if_index in sorted(ifNames.keys())[:5]:
                errorIndication, errorStatus, errorIndex, varBinds = next(
                    getCmd(SnmpEngine(),
                           CommunityData(community, mpModel=1),
                           UdpTransportTarget((ip, 161), timeout=timeout, retries=retries),
                           ContextData(),
                           ObjectType(ObjectIdentity('SNMPv2-MIB', 'ifInOctets', if_index)),
                           ObjectType(ObjectIdentity('SNMPv2-MIB', 'ifOutOctets', if_index)),
                           ObjectType(ObjectIdentity('SNMPv2-MIB', 'ifInErrors', if_index)),
                           ObjectType(ObjectIdentity('SNMPv2-MIB', 'ifOutErrors', if_index)))
                )
                
                if not errorIndication:
                    in_octets = 0
                    out_octets = 0
                    in_errors = 0
                    out_errors = 0
                    
                    for varBind in varBinds:
                        oid, val = varBind
                        oid_str = str(oid)
                        try:
                            val_int = int(val)
                            if 'ifInOctets' in oid_str:
                                in_octets = val_int
                            elif 'ifOutOctets' in oid_str:
                                out_octets = val_int
                            elif 'ifInErrors' in oid_str:
                                in_errors = val_int
                            elif 'ifOutErrors' in oid_str:
                                out_errors = val_int
                        except (ValueError, TypeError):
                            pass
                    
                    result['interfaces'].append({
                        'name': ifNames.get(if_index, f'Interface {if_index}'),
                        'in_octets': in_octets,
                        'out_octets': out_octets,
                        'in_errors': in_errors,
                        'out_errors': out_errors,
                    })
        except Exception as e:
            result['interfaces_error'] = str(e)
        
        return result
    except Exception as e:
        return None

def snmp_poller_loop(interval=30):
    """Background thread: poll SNMP metrics from online devices."""
    if not SNMP_AVAILABLE:
        return
    
    while True:
        time.sleep(interval)
        devices = load_devices()
        
        with _lock:
            # Only query devices that are currently online
            online_ips = [ip for ip, s in _device_status.items() if s and s.get('online')]
        
        for ip in online_ips:
            # Find device config for SNMP community string
            device = next((d for d in devices if d['ip'] == ip), None)
            if not device:
                continue
            
            community = device.get('snmp_community', 'public')
            
            snmp_data = query_snmp_device(ip, community=community, timeout=2, retries=1)
            if snmp_data:
                # Log the SNMP data
                log_entry = {
                    'ts': snmp_data['ts'],
                    'msg': f"SNMP: {snmp_data['description'][:50] if snmp_data['description'] != 'N/A' else ip}",
                    'data': snmp_data
                }
                add_snmp_log(log_entry)

def monitor_loop():
    global _device_status

    while True:
        devices = load_devices()
        if not devices:
            time.sleep(PING_INTERVAL)
            continue
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

                # push to history
                with _lock:
                    dq = _device_history.get(ip)
                    if dq is None:
                        dq = deque(maxlen=HISTORY_SIZE)
                        _device_history[ip] = dq
                    dq.append({
                        'ts': time.time(),
                        'latency': latency,
                        'online': online
                    })

                    # simple flapping detection on the recent window
                    samples = list(dq)[-FLAP_WINDOW:]
                    # count transitions between consecutive online states
                    transitions = 0
                    last_state = None
                    for s in samples:
                        st = bool(s.get('online'))
                        if last_state is None:
                            last_state = st
                            continue
                        if st != last_state:
                            transitions += 1
                            last_state = st

                    was_flapping = _flapping_state.get(ip, False)
                    now_flapping = transitions >= FLAP_THRESHOLD
                    _flapping_state[ip] = now_flapping
                    if now_flapping and not was_flapping:
                        alert = {'type': 'flapping', 'ip': ip, 'ts': time.time(), 'transitions': transitions}
                        _alerts.appendleft(alert)
                        try:
                            _write_event_log({'type': 'alert', 'ts': alert['ts'], 'alert': alert})
                        except Exception:
                            pass
                        if _emitter:
                            try:
                                _emitter('alert', alert)
                            except Exception:
                                pass

        with _lock:
            _device_status = results

        # detect online/offline transitions compared to previous snapshot and emit server-side alerts
        try:
            for ip, cur in results.items():
                prev_online = None
                if prev_status and ip in prev_status:
                    prev_online = bool(prev_status[ip].get('online'))
                # Only emit when we have a previous known state and it changed
                if prev_online is not None and prev_online != bool(cur.get('online')):
                    event_type = 'online' if cur.get('online') else 'offline'
                    alert = {
                        'type': event_type,
                        'ip': ip,
                        'ts': time.time(),
                        'msg': f"Device {ip} went {event_type}"
                    }
                    _alerts.appendleft(alert)
                    try:
                        _write_event_log({'type': 'alert', 'ts': alert['ts'], 'alert': alert})
                    except Exception:
                        pass
                    if _emitter:
                        try:
                            _emitter('alert', alert)
                        except Exception:
                            pass
        except Exception:
            pass

        # emit status update to subscribers
        if _emitter:
            try:
                _emitter('status_update', results)
                # also optionally send history snapshot
                # _emitter('history_update', get_history())
            except Exception:
                pass

        time.sleep(PING_INTERVAL)

def start_monitor():
    t = threading.Thread(target=monitor_loop, daemon=True)
    t.start()
    
    # Start SNMP poller if available
    if SNMP_AVAILABLE:
        snmp_thread = threading.Thread(target=snmp_poller_loop, kwargs={'interval': 30}, daemon=True)
        snmp_thread.start()
