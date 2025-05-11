import requests
import time
import os
import json

# === CONFIGURAZIONE ===
LOKI_URL = os.getenv("LOKI_URL", "http://localhost:3100")
QUERY = os.getenv("LOKI_QUERY", '{namespace="tetragon"} |= "process_exec" |~ "/bin/(sh|bash)" |~ "express"')
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")
CHECK_INTERVAL = int(os.getenv("CHECK_INTERVAL", "10"))
SEEN_FILE = "/tmp/seen_exec_ids.json"

# === WHITELIST: (namespace, pod_prefix, container)
IGNORED_EXECUTIONS = [
    ("monitoring", "update-whitelist", "patcher"),
    ("monitoring", "update-whitelist", "resolver"),
    ("monitoring", "lokipy", "lokipy-bot"),
]

# === GESTIONE STATO ===
def load_seen():
    try:
        with open(SEEN_FILE, "r") as f:
            return set(json.load(f))
    except Exception:
        return set()

def save_seen(seen):
    with open(SEEN_FILE, "w") as f:
        json.dump(list(seen), f)

seen_exec_ids = load_seen()

# === TELEGRAM ===
def send_telegram_message(text):
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        print("Telegram non configurato.")
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    data = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": text,
        "parse_mode": "Markdown"
    }
    try:
        r = requests.post(url, json=data)
        r.raise_for_status()
    except requests.RequestException as e:
        print("Errore Telegram:", e)

# === LOKI POLLING ===
def poll_loki():
    params = {
        "query": QUERY,
        "limit": 20
    }
    try:
        r = requests.get(f"{LOKI_URL}/loki/api/v1/query", params=params)
        r.raise_for_status()
        result = r.json()["data"]["result"]
    except Exception as e:
        print("Errore Loki:", e)
        return []

    new_logs = []
    for stream in result:
        for _, line_json in stream["values"]:
            try:
                log = json.loads(line_json)
                proc_exec = log.get("process_exec", {})
                process = proc_exec.get("process", {})
                parent = proc_exec.get("parent", {})

                exec_id = process.get("exec_id")
                if not exec_id or exec_id in seen_exec_ids:
                    continue
                seen_exec_ids.add(exec_id)

                binary = process.get("binary", "N/A")
                arguments = parent.get("arguments", "")
                command_line = f"{binary} {arguments}".strip()

                pid = process.get("pid", "N/A")
                uid = process.get("uid", "N/A")
                timestamp = log.get("time", "N/A")
                node = log.get("node_name", "N/A")

                pod_info = process.get("pod", {})
                pod_name = pod_info.get("name", "N/A")
                namespace = pod_info.get("namespace", "N/A")
                container = pod_info.get("container", {}).get("name", "N/A")
                image = pod_info.get("container", {}).get("image", {}).get("name", "N/A")

                # === WHITELIST CHECK ===
                pod_prefix = pod_name.split("-")[0] if pod_name != "N/A" else ""
                if (namespace, pod_prefix, container) in IGNORED_EXECUTIONS:
                    continue

                message = (
                    f"⚠️ *Esecuzione sospetta rilevata*\n"
                    f"*Namespace:* `{namespace}`\n"
                    f"*Pod:* `{pod_name}` | *Container:* `{container}`\n"
                    f"*UID:* `{uid}` | *PID:* `{pid}`\n"
                    f"*Comando:* `{command_line}`\n"
                    f"*Image:* `{image}`\n"
                    f"*Exec ID:* `{exec_id}`\n"
                    f"*Nodo:* `{node}`\n"
                    f"*Timestamp:* `{timestamp}`"
                )

                new_logs.append((exec_id, message))
            except Exception as e:
                print("Errore parsing log:", e)
    return new_logs

# === MAIN LOOP ===
print("🔍 Init Loki monitoring...")
while True:
    try:
        new_logs = poll_loki()
        for exec_id, message in new_logs:
            send_telegram_message(message)
            print(f"Alert sent for exec_id: {exec_id}")
        if new_logs:
            save_seen(seen_exec_ids)
    except Exception as e:
        print("Error:", e)

    time.sleep(CHECK_INTERVAL)
