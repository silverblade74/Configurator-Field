# app.py ───────────────────────────────────────────────────────────────────────
"""
SHI Public Sector – Field Configurator  (simplified)
  • Modern tab-based Streamlit UI
  • YAML-driven recommendation engine
  • No authentication, no local database
  • Multi-format export (JSON, Excel, PDF, PPTX) in a single ZIP
"""

from __future__ import annotations
import io, json, yaml, zipfile
from datetime import datetime
from pathlib import Path
from typing import Dict, List

import pandas as pd
import streamlit as st

# helper exports (keep export_utils.py in repo)
from export_utils import to_excel_bytes, to_pdf_bytes, to_pptx_bytes

# ── Streamlit page setup ────────────────────────────────────────────────────
st.set_page_config(page_title="SHI Field Configurator",
                   page_icon="🛠️", layout="wide")

st.markdown(
    """
    <style>
      .block-container {padding-top:1rem; padding-bottom:4rem;}
      footer {visibility:hidden;}
      #sticky-cta {position:fixed; bottom:1.5rem; right:2rem; z-index:999;}
    </style>
    """,
    unsafe_allow_html=True,
)

st.title("🛠️ SHI Public Sector – Field Configurator")

# ── Load editable rules file ────────────────────────────────────────────────
RULES: Dict = yaml.safe_load(Path("rules.yaml").read_text())

# ── Sidebar – basic info + progress indicator ──────────────────────────────
with st.sidebar:
    account_name   = st.text_input("Agency / Account Name")
    contact_person = st.text_input("Primary Contact")
    ae_name        = st.text_input("SHI AE Name")
    visit_date     = st.date_input("Date", datetime.today())
    progress_bar   = st.progress(0)
    prog_txt       = st.markdown("**Progress:** 0 %")
    st.caption("Data remains local unless you click *Download Assessment*.")

# ── Session-state container for form inputs ────────────────────────────────
if "fs" not in st.session_state:
    st.session_state.fs = {}
fs = st.session_state.fs
fs.update({"account_name": account_name,
           "contact_person": contact_person,
           "ae_name": ae_name,
           "visit_date": str(visit_date)})

# ── Helper: calculate progress -- required fields filled? ──────────────────
REQ_KEYS = {
    "account_name", "contact_person", "ae_name",
    "dc_workload", "rack_units", "power_kw",
    "storage_tb", "iops", "cooling_type",
    "rack_density_kw", "endpoint_count",
    "net_fabric", "site_count", "saas_apps",
}
def pct_complete(data: Dict) -> int:
    return int(sum(bool(data.get(k)) for k in REQ_KEYS) / len(REQ_KEYS) * 100)

# ── Tabbed UI ───────────────────────────────────────────────────────────────
t_dc, t_pc, t_sec, t_net, t_cloud = st.tabs(
    ["🏢 Datacenter", "❄️ Power & Cooling", "🔐 Security",
     "🌐 Networking", "☁️ SaaS & Cloud"])

# Datacenter tab
with t_dc:
    st.subheader("🏢 Datacenter")
    c1, c2 = st.columns(2)
    with c1:
        fs["dc_workload"] = st.selectbox(
            "Primary Workload Profile",
            ["General Purpose", "AI / ML", "High Performance Compute (HPC)",
             "VDI", "Database / OLTP"])
        fs["rack_units"] = st.number_input("Free Rack Units (U)", min_value=0, step=1)
        fs["power_kw"]   = st.number_input("Available Power (kW)", min_value=0.0, step=0.1)
        fs["redundancy"] = st.selectbox("IT Load Redundancy", ["N", "N+1", "2N"])
    with c2:
        fs["storage_tb"] = st.number_input("Required Capacity (TB)", min_value=1)
        fs["iops"]       = st.selectbox("IOPS Profile",
                                        ["<10 K", "10-50 K", "50-100 K", ">100 K"])
        fs["uptime_sla"] = st.selectbox("Target Uptime SLA",
                                        ["99.9 %", "99.99 %", "99.999 %"])
    fs["dc_existing"] = st.text_area("Current Platforms (Make / Model)", "")

# Power & Cooling tab
with t_pc:
    st.subheader("❄️ Power & Cooling")
    fs["cooling_type"] = st.selectbox(
        "Primary Cooling Strategy",
        ["Air-Cooled (CRAC/CRAH)", "Rear-Door Heat Exchanger (RDHx)",
         "Liquid (Direct-to-Chip)", "Immersion"])
    fs["rack_density_kw"] = st.number_input("Rack Density (kW per rack)", 1.0, step=0.5)
    fs["facility_capacity_kw"] = st.number_input("Facility Capacity (kW)", 1.0, step=1.0)
    fs["genset_redundancy"] = st.selectbox("Generator / UPS Redundancy",
                                           ["N", "N+1", "2N", "2N+1"])

# Security tab
with t_sec:
    st.subheader("🔐 Cybersecurity")
    fs["sec_frameworks"] = st.multiselect(
        "Compliance / Framework Alignment",
        ["NIST 800-53", "CJIS", "HIPAA", "PCI-DSS", "CMMC 2.0", "IRS Pub 1075"])
    fs["endpoint_count"] = st.number_input("Protected Endpoints", 0, step=25)
    fs["cloud_presence"] = st.selectbox("Cloud Footprint", ["None", "Hybrid", "Cloud-First"])
    fs["sec_stack"] = st.text_area("Current Security Stack", "")

# Networking tab
with t_net:
    st.subheader("🌐 Networking")
    fs["net_fabric"] = st.selectbox("Core Fabric Architecture",
                                    ["3-Tier", "Leaf-Spine", "SD-WAN"])
    fs["site_count"] = st.number_input("Number of Sites", 1)
    fs["wan_bandwidth"] = st.selectbox("Typical WAN Bandwidth",
                                       ["<1 Gbps", "1-10 Gbps", ">10 Gbps"])
    fs["include_wireless"] = st.checkbox("Assess Wireless Infrastructure?")
    fs["net_hw"] = st.text_area("Installed Network Hardware", "")

# SaaS & Cloud tab
with t_cloud:
    st.subheader("☁️ SaaS & Cloud")
    fs["saas_apps"] = st.text_area("Mission-Critical SaaS Apps", "")
    fs["migration_interest"] = st.radio("Cloud / App Modernisation Interest",
                                        ["Yes", "No", "Exploring"])
    fs["budget_band"] = st.selectbox("Rough Budget Band",
                                     ["<$100 K", "$100-$500 K",
                                      "$500 K-$1 M", ">$1 M"])

# ── Update progress in sidebar ─────────────────────────────────────────────
progress = pct_complete(fs)
progress_bar.progress(progress / 100)
prog_txt.markdown(f"**Progress:** {progress} %")

# ── YAML-driven recommendation engine ──────────────────────────────────────
def build_recs(data: Dict, rules: Dict) -> Dict[str, str]:
    out: Dict[str, str] = {}
    for section, rule_list in rules.items():
        for rule in rule_list:
            cond: Dict = rule["when"]
            # simple equality / >= match
            def cond_ok(k, v):
                if isinstance(v, str) and v.startswith(">="):
                    return float(data.get(k, 0)) >= float(v[2:])
                return str(data.get(k)) == str(v)
            if all(cond_ok(k, v) for k, v in cond.items()):
                out[section.replace("_", " ").title()] = rule["recommend"].format(**data)
                break
    return out

# ── CTA & export -----------------------------------------------------------
st.markdown('<div id="sticky-cta"></div>', unsafe_allow_html=True)

if st.button("🚀 Generate Recommendations", type="primary"):
    recs = build_recs(fs, RULES)
    st.header("📑 Preliminary Recommendations")
    st.json(recs, expanded=False)

    bundle = {
        "Metadata": {k: fs[k] for k in
                     ("account_name", "contact_person", "ae_name", "visit_date")},
        "Capture": fs,
        "Recommendations": recs,
        "Timestamp": str(datetime.utcnow()),
    }

    zbuf = io.BytesIO()
    with zipfile.ZipFile(zbuf, "w") as z:
        z.writestr("assessment.json", json.dumps(bundle, indent=2))
        z.writestr("assessment.xlsx", to_excel_bytes(bundle))
        z.writestr("assessment.pdf",  to_pdf_bytes(bundle))
        z.writestr("assessment.pptx", to_pptx_bytes(bundle))

    st.download_button("💾 Download ZIP bundle",
                       data=zbuf.getvalue(),
                       file_name="shi_assessment_bundle.zip",
                       mime="application/zip")