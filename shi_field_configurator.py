"""
SHI Public Sector – Field Configurator
© 2025 SHI International Corp
-------------------------------------------------------------------------------
Streamlit tool for AEs to capture datacenter, cybersecurity, networking, and
SaaS/cloud info, then auto-suggest bleeding-edge architectures.
"""

from __future__ import annotations
import json
from datetime import datetime
from typing import Dict, List

import pandas as pd
import streamlit as st

# ── Page config ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="SHI Field Configurator",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.title("🛠️ SHI Public Sector – Field Configurator")

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.header("Customer Basics")
    account_name = st.text_input("Agency / Account Name")
    contact_person = st.text_input("Primary Contact")
    visit_date = st.date_input("Date", datetime.today())
    ae_name = st.text_input("SHI AE Name")
    st.markdown("----")
    st.caption("Data stays local unless you click *Download Assessment*.")

# ──────────────────────────────────────────────────────────────────────────────
# 1. DATACENTER
# ──────────────────────────────────────────────────────────────────────────────
st.markdown("## 1️⃣ Datacenter")

with st.expander("Capture Datacenter Requirements", expanded=False):
    dc_col1, dc_col2 = st.columns(2)

    with dc_col1:
        dc_workload = st.selectbox(
            "Primary Workload Profile",
            [
                "General Purpose",
                "AI / ML",
                "High Performance Compute (HPC)",
                "VDI",
                "Database / OLTP",
            ],
        )
        rack_units = st.number_input("Free Rack Units (U)", min_value=0, step=1)
        power_kw = st.number_input("Available Power (kW)", min_value=0.0, step=0.1)
        redundancy = st.selectbox("Redundancy Target", ["N", "N+1", "2N"])

    with dc_col2:
        storage_tb = st.number_input("Required Capacity (TB)", min_value=1)
        iops = st.selectbox("IOPS Profile", ["<10 K", "10-50 K", "50-100 K", ">100 K"])
        uptime_sla = st.selectbox("Target Uptime SLA", ["99.9 %", "99.99 %", "99.999 %"])

    dc_existing = st.text_area(
        "Current Platforms (Make / Model / Generation)",
        placeholder="e.g. Dell PowerEdge R760xa, HPE Alletra MP …",
    )

# ──────────────────────────────────────────────────────────────────────────────
# 2. CYBERSECURITY
# ──────────────────────────────────────────────────────────────────────────────
st.markdown("## 2️⃣ Cybersecurity")

with st.expander("Capture Security Stack & Compliance", expanded=False):
    sec_frameworks: List[str] = st.multiselect(
        "Compliance / Framework Alignment",
        ["NIST 800-53", "CJIS", "HIPAA", "PCI-DSS", "CMMC 2.0", "IRS Pub 1075"],
    )
    endpoint_count = st.number_input("Protected Endpoints", min_value=0, step=25)
    cloud_presence = st.selectbox("Cloud Footprint", ["None", "Hybrid", "Cloud-First"])
    sec_stack = st.text_area(
        "Current Security Stack (Vendor / Product / Version)",
        placeholder="e.g. Palo Alto PA-400, CrowdStrike Falcon Complete …",
    )

# ──────────────────────────────────────────────────────────────────────────────
# 3. NETWORKING
# ──────────────────────────────────────────────────────────────────────────────
st.markdown("## 3️⃣ Networking")

with st.expander("Capture Networking Environment", expanded=False):
    net_fabric = st.selectbox("Core Fabric Type", ["3-Tier", "Leaf-Spine", "SD-WAN"])
    site_count = st.number_input("Number of Sites", min_value=1)
    wan_bandwidth = st.selectbox(
        "Typical WAN Bandwidth", ["<1 Gbps", "1-10 Gbps", ">10 Gbps"]
    )
    include_wireless = st.checkbox("Assess Wireless Infrastructure?")
    net_hw = st.text_area(
        "Installed Network Hardware (Make / Model)",
        placeholder="e.g. Cisco Catalyst 9300, Arista 7800, Fortinet FG-600F …",
    )

# ──────────────────────────────────────────────────────────────────────────────
# 4. SAAS & CLOUD
# ──────────────────────────────────────────────────────────────────────────────
st.markdown("## 4️⃣ SaaS & Cloud")

with st.expander("Capture SaaS / Cloud Landscape", expanded=False):
    saas_apps = st.text_area(
        "Mission-Critical SaaS Applications",
        placeholder="e.g. ServiceNow, Workday, Tyler Munis …",
    )
    migration_interest = st.radio(
        "Cloud / App Modernisation Interest", ["Yes", "No", "Exploring"]
    )
    budget_band = st.selectbox(
        "Rough Budget Band (HW / Subscriptions)",
        ["<$100 K", "$100-$500 K", "$500 K-$1 M", ">$1 M"],
    )

# ──────────────────────────────────────────────────────────────────────────────
# Recommendation engine
# ──────────────────────────────────────────────────────────────────────────────
def build_recommendations() -> Dict[str, str]:
    rec: Dict[str, str] = {}

    # Datacenter
    if dc_workload == "AI / ML":
        rec["Datacenter"] = (
            "🔹 Plan for NVIDIA GB200 NVL72 or upcoming Blackwell Ultra DGX, "
            "backed by Dell PowerStore Prime QLC or HPE Alletra MP NVMe arrays."
        )
    elif dc_workload == "High Performance Compute (HPC)":
        rec["Datacenter"] = (
            "🔹 Deploy HPE Cray EX with Slingshot-11 fabric and liquid-cooled Grace-Blackwell blades."
        )
    elif dc_workload == "Database / OLTP":
        rec["Datacenter"] = (
            "🔹 Combine Pure Storage FlashArray//XL with AMD EPYC Genoa-X servers "
            "for massive L3 cache and sub-100 µs latency."
        )
    elif dc_workload == "VDI":
        rec["Datacenter"] = (
            "🔹 Use Nutanix Cloud Platform on Dell VxRail D-Series nodes with NVIDIA L40S GPUs "
            "for AI-assisted VDI."
        )
    else:
        rec["Datacenter"] = (
            "🔹 Standardise on Cisco UCS X-Series with UCS AI Director for composable rack-scale IT."
        )

    # Cybersecurity
    if "CJIS" in sec_frameworks:
        rec["Cybersecurity"] = (
            "🔹 Implement Cisco Hypershield micro-segmentation plus FIPS-140-3 YubiKey 5C NFC tokens."
        )
    else:
        rec["Cybersecurity"] = (
            "🔹 Adopt CrowdStrike Falcon Complete XDR 3.0 (Charlotte AI) with Zscaler AI-powered SSE."
        )

    # Networking
    if net_fabric == "Leaf-Spine":
        rec["Networking"] = (
            "🔹 Build an 800 G fabric on Cisco Nexus 9800 (Silicon One Q200) or Arista 7800; "
            "automate intent with Juniper Apstra 5.x."
        )
    elif net_fabric == "SD-WAN":
        rec["Networking"] = "🔹 Versa Unified SASE edge plus Wi-Fi 7 Mist AP45 campus access points."
    else:
        rec["Networking"] = (
            "🔹 Refresh core with Juniper QFX5700 or Aruba CX 10300, "
            "managed by Aruba Fabric Composer & AI-Ops."
        )

    # SaaS & Cloud
    if migration_interest == "Yes":
        rec["SaaS & Cloud"] = (
            "🔹 Migrate priority workloads to Azure Gov Fabric AI via SHI One Landing-Zone Accelerator; "
            "use AWS Bedrock RAG blueprints for sovereign GenAI."
        )
    elif migration_interest == "Exploring":
        rec["SaaS & Cloud"] = (
            "🔹 Run an SHI AI-Readiness & FinOps workshop to benchmark cloud TCO vs. on-prem Grace-Blackwell."
        )

    return rec


# ── Run button ────────────────────────────────────────────────────────────────
if st.button("🚀 Generate Recommendations"):
    recs = build_recommendations()

    st.subheader("Preliminary Recommendations")
    st.json(recs, expanded=False)

    record = {
        "Agency": account_name,
        "Contact": contact_person,
        "Date": str(visit_date),
        "AE": ae_name,
        "Capture": {
            "Datacenter": {
                "Workload": dc_workload,
                "Rack Units": rack_units,
                "Power kW": power_kw,
                "Redundancy": redundancy,
                "Storage TB": storage_tb,
                "IOPS": iops,
                "SLA": uptime_sla,
                "Existing": dc_existing,
            },
            "Cybersecurity": {
                "Frameworks": sec_frameworks,
                "Endpoints": endpoint_count,
                "Cloud": cloud_presence,
                "Stack": sec_stack,
            },
            "Networking": {
                "Fabric": net_fabric,
                "Sites": site_count,
                "WAN": wan_bandwidth,
                "Wireless": include_wireless,
                "Existing HW": net_hw,
            },
            "SaaS & Cloud": {
                "Apps": saas_apps,
                "Migration": migration_interest,
                "Budget": budget_band,
            },
        },
        "Recommendations": recs,
    }

    json_payload = json.dumps(record, indent=2)
    st.download_button(
        "💾 Download Assessment (JSON)",
        data=json_payload,
        file_name=f"{(account_name or 'assessment').replace(' ', '_')}.json",
        mime="application/json",
    )
