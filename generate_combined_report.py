import os
import json
import pandas as pd
from pathlib import Path
import html
from typing import Dict

# === FILES PATH ===
files: Dict[str, str] = {
    "Trivy Express": "./trivy_report_express.json",
    "Trivy Keycloak": "./trivy_report_keycloak.json",
    "ESLint": "./eslint_report.json",
    "NodeJSScan": "./nodejsscan_report.json",
    "Kubescape": "./kubescape_report.html",
    "ZAP DAST": "./zap_report.html"
}

# === PARSER JSON FUNCTIONS ===
def parse_trivy(file_path):
    with open(file_path, encoding="utf-8") as f:
        data = json.load(f)
    rows = []
    for result in data.get("Results", []):
        for vuln in result.get("Vulnerabilities", []):
            rows.append({
                "Target": result.get("Target"),
                "Pkg": vuln.get("PkgName"),
                "Installed": vuln.get("InstalledVersion"),
                "Fixed": vuln.get("FixedVersion"),
                "Severity": vuln.get("Severity"),
                "ID": vuln.get("VulnerabilityID"),
                "Title": vuln.get("Title"),
                "URL": vuln.get("PrimaryURL")
            })
    return pd.DataFrame(rows) if rows else pd.DataFrame([{"Message": "No vulnerabilities found"}])

def parse_eslint(file_path):
    with open(file_path, encoding="utf-8") as f:
        data = json.load(f)
    rows = []
    for file in data:
        for msg in file.get("messages", []):
            rows.append({
                "File": Path(file["filePath"]).name,
                "Line": msg.get("line"),
                "Rule": msg.get("ruleId"),
                "Severity": msg.get("severity"),
                "Message": msg.get("message")
            })
    return pd.DataFrame(rows) if rows else pd.DataFrame([{"Message": "No ESLint issues found"}])

def parse_nodejsscan(file_path):
    with open(file_path, encoding="utf-8") as f:
        data = json.load(f)
    rows = []
    for category, issues in data.get("sec_issues", {}).items():
        for issue in issues:
            rows.append({
                "Category": category,
                "Title": issue.get("title"),
                "Description": issue.get("description"),
                "File": issue.get("filename"),
                "Line": issue.get("line"),
                "Tag": issue.get("tag")
            })
    for category, issues in data.get("missing_sec_header", {}).items():
        for issue in issues:
            rows.append({
                "Category": category,
                "Title": issue.get("title"),
                "Description": issue.get("description"),
                "File": "-",
                "Line": "-",
                "Tag": issue.get("tag")
            })
    return pd.DataFrame(rows) if rows else pd.DataFrame([{"Message": "No NodeJSScan issues found"}])

# === BUILD TABS ===
tabs = {}
for name, path in files.items():
    if name in ["Kubescape", "ZAP DAST"]:
        continue  # handled separately
    if os.path.exists(path):
        try:
            if "Trivy" in name:
                tabs[name] = parse_trivy(path)
            elif name == "ESLint":
                tabs[name] = parse_eslint(path)
            elif name == "NodeJSScan":
                tabs[name] = parse_nodejsscan(path)
        except Exception as e:
            tabs[name] = pd.DataFrame([{"Error": f"Failed to parse {name}: {str(e)}"}])
    else:
        tabs[name] = pd.DataFrame([{"Info": f"{name} report not generated in this pipeline."}])

# === HTML TEMPLATE START ===
html_output = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Security Reports Dashboard</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; background: #f4f4f4; margin: 0; padding: 0; height: 100vh; }
    h1 { text-align: center; }
    .main { display: flex; height: 100%; flex-direction: column; }
    .tabs { display: flex; flex-wrap: wrap; margin-bottom: 20px; border-bottom: 2px solid #ccc; }
    .tab-btn {
      padding: 10px 20px;
      cursor: pointer;
      border: none;
      background: #e0e0e0;
      margin-right: 5px;
      font-weight: bold;
    }
    .tab-btn.active { background: #ffffff; border-bottom: 2px solid #fff; }
    .tab-content { display: none; padding: 20px; background: #ffffff; border: 1px solid #ccc; border-top: none; height: 100%; }
    .tab-content.active { display: block; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
    th { background: #f9f9f9; }
    tr:nth-child(even) { background: #f2f2f2; }
    .Severity-Critical { background-color: #f8d7da; }
    .Severity-High     { background-color: #fff3cd; }
    .Severity-Medium   { background-color: #d1ecf1; }
    .Severity-Low      { background-color: #e2e3e5; }
  </style>
</head>
<body>
  <div class="main">
  <h1>Security Scan Reports</h1>
  <div class="tabs">
"""

# === CREATE TAB BUTTONS ===
all_tab_names = list(tabs.keys()) + ["Kubescape", "ZAP DAST"]
for i, tab in enumerate(all_tab_names):
    active = 'active' if i == 0 else ''
    html_output += f'<button class="tab-btn {active}" onclick="showTab({i})">{tab}</button>'
html_output += '</div>'

# === CREATE TAB CONTENT FOR DATAFRAME REPORTS ===
for i, (tab, df) in enumerate(tabs.items()):
    active = 'active' if i == 0 else ''
    df_html = df.to_html(index=False, escape=False)
    if "Severity" in df.columns:
        for sev in ["Critical", "High", "Medium", "Low"]:
            df_html = df_html.replace(f'<td>{sev}</td>', f'<td class="Severity-{sev}">{sev}</td>')
    html_output += f'<div class="tab-content {active}" id="tab{i}">{df_html}</div>'

# === HANDLE HTML-BASED REPORTS ===
html_report_tabs = ["Kubescape", "ZAP DAST"]
for tab_name in html_report_tabs:
    index = all_tab_names.index(tab_name)
    file_path = files[tab_name]
    if os.path.exists(file_path):
        with open(file_path, encoding="utf-8") as f:
            raw_html = f.read()
        escaped_html = html.escape(raw_html)
        html_output += f'''
<div class="tab-content" id="tab{index}">
  <iframe srcdoc="{escaped_html}" width="100%" height="100%" style="border:none;"></iframe>
</div>
'''
    else:
        html_output += f'''
<div class="tab-content" id="tab{index}">
  <p>No {tab_name} report generated in this pipeline.</p>
</div>
'''

# === JAVASCRIPT FOR TABS ===
html_output += """
<script>
  function showTab(index) {
    const tabs = document.querySelectorAll(".tab-btn");
    const contents = document.querySelectorAll(".tab-content");
    tabs.forEach((tab, i) => {
      tab.classList.toggle("active", i === index);
      contents[i].classList.toggle("active", i === index);
    });
  }
</script>
</div>
</body>
</html>
"""

# === SAVE ===
with open("combined_report.html", "w", encoding="utf-8") as f:
    f.write(html_output)

print("Generated Report: combined_report.html")
