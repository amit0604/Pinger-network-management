import subprocess
import platform

def ping_ip(ip_address):
    """
    Pings an IP address and returns True if reachable, False otherwise.
    """
    # Determine the correct command line argument for count
    param = '-n' if platform.system().lower() == 'windows' else '-c'
    command = ['ping', param, '1', ip_address] # Ping 1 time

    try:
        # Run the command, capture output, and check the return code
        result = subprocess.run(command, capture_output=True, text=True, timeout=5)
        # Exit code 0 means success
        if result.returncode == 0:
            return True
        else:
            return False
    except subprocess.TimeoutExpired:
        print(f"Ping to {ip_address} timed out.")
        return False
    except Exception as e:
        print(f"An error occurred: {e}")
        return False

