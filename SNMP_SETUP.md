# SNMP Poller Setup

## Overview
The pinger application now includes an SNMP poller that automatically queries online devices for metrics like uptime, interface statistics, and errors.

## Installation
Dependencies have been installed:
- **System**: `net-snmp` (via Homebrew)
- **Python**: `easysnmp` package

## How It Works

### SNMP Poller Thread
- Runs in the background every 30 seconds
- Queries only devices currently marked as **online**
- Collects metrics:
  - System uptime
  - System description
  - Interface names
  - Interface statistics (in/out octets, errors)

### Configuration
Each device can have an optional `snmp_community` field:
- **Default**: `public` (standard SNMP community string)
- **Custom**: Set per-device via the "Add/Edit Device" modal
- Stored in `devices.json` alongside device configuration

### API Endpoint
- **Route**: `/api/snmp`
- **Returns**: Array of recent SNMP log entries (max 500)
- **Format**:
```json
[
  {
    "ts": 1707323412.5,
    "msg": "SNMP: Device description",
    "data": {
      "ip": "192.168.1.1",
      "timestamp": "2025-02-07 14:30:12",
      "uptime": "123456 ticks",
      "description": "Cisco IOS Software...",
      "interfaces": [
        {
          "name": "FastEthernet0/0",
          "in_octets": 1234567,
          "out_octets": 7654321,
          "in_errors": 0,
          "out_errors": 0
        }
      ]
    }
  }
]
```

### WebSocket Events
SNMP data is pushed to connected clients via Socket.IO:
- **Event**: `snmp_log`
- **Payload**: Log entry object (same format as above)

### Dashboard Integration
The "SNMP Logs" panel displays:
- Latest SNMP queries (up to 50 displayed)
- Device descriptions and timestamps
- Auto-updates via WebSocket when new data arrives

## Troubleshooting

### SNMP Queries Fail
- Ensure device has SNMP enabled
- Verify correct community string (default: `public`)
- Check device firewall allows UDP port 161
- Try manual SNMP query: `snmpget -v2c -c public <IP> 1.3.6.1.2.1.1.3.0`

### No SNMP Logs Appearing
- Check that devices are marked as "online"
- SNMP poller only queries online devices
- Wait 30+ seconds for first poll cycle
- Check browser console for errors

### Disable SNMP
If you don't need SNMP, the poller gracefully handles missing dependencies:
- Simply don't install `easysnmp` package
- Poller will be skipped automatically
- Application runs normally without SNMP

## Adding SNMP Community Override
1. Click "Add Device" or right-click to "Edit"
2. Fill in device details
3. Set "SNMP Community" field (or leave blank for "public")
4. Save device

That's it! The poller will use this community string for SNMP queries.
