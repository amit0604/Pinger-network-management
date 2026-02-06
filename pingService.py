import subprocess
import platform
import re

def ping_ip(ip_address):
    """
    Pings an IP address and returns the latency in milliseconds (float) on success,
    or None if unreachable or on error.
    """
    param = '-n' if platform.system().lower() == 'windows' else '-c'
    command = ['ping', param, '1', ip_address]

    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=2)
        if result.returncode != 0:
            return None

        out = result.stdout + result.stderr
        # Try to extract 'time=XX ms' pattern
        m = re.search(r'time[=<]?\s*([0-9]+\.?[0-9]*)\s*ms', out)
        if m:
            try:
                return float(m.group(1))
            except Exception:
                return None

        # On some systems output may be different; if no match, still consider reachable
        return 0.0
    except subprocess.TimeoutExpired:
        return None
    except Exception:
        return None

