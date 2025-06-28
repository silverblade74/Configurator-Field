# rule_builder_ui.py – Final Version
import streamlit as st
import yaml
from pathlib import Path

st.set_page_config(page_title="📐 Rule Builder UI", page_icon="📘", layout="wide")
st.title("📐 SHI YAML Rule Authoring Assistant")
st.caption("Compose structured rules with `when`, `recommend`, `tags`, and more.")

# Select the domain section to add rule to
domain = st.selectbox("📂 Domain Section", [
    "datacenter", "power_cooling", "cybersecurity", "networking", "saas_cloud", "opportunities"])

with st.form("rule_form"):
    when_text = st.text_area("🧩 Match Conditions (YAML format)", "dc_workload: AI / ML\ngpu_required: Yes")
    recommend = st.text_area("📑 Recommendation Markdown",
        "Deploy **NVIDIA GB200** for high-performance AI training clusters.")
    reason = st.text_input("💡 Reason for recommendation", "AI workload with GPU requirement")
    tradeoffs = st.text_input("⚖️ Tradeoff Notes (optional)", "Higher power and cooling demand")
    tags = st.text_input("🔖 Tags (comma-separated)", "AI,GPU")
    score = st.slider("📊 Rule Score (priority)", 1, 5, 4)
    source = st.text_input("📚 Source Reference", "Dell AI Guide 2024")
    submitted = st.form_submit_button("➕ Add Rule")

if submitted:
    try:
        rule = {
            "when": yaml.safe_load(when_text),
            "recommend": recommend,
            "reason": reason,
            "tradeoffs": tradeoffs,
            "tags": [t.strip() for t in tags.split(",") if t.strip()],
            "score": score,
            "source": source
        }
        if "rules" not in st.session_state:
            st.session_state.rules = {}
        if domain not in st.session_state.rules:
            st.session_state.rules[domain] = []
        st.session_state.rules[domain].append(rule)
        st.success(f"✅ Rule added under `{domain}`")
    except Exception as e:
        st.error(f"❌ YAML Error in 'when': {e}")

if "rules" in st.session_state and st.session_state.rules:
    st.subheader("📦 Current Rules")
    st.code(yaml.dump(st.session_state.rules, sort_keys=False), language="yaml")
    st.download_button("📥 Download YAML",
        data=yaml.dump(st.session_state.rules, sort_keys=False),
        file_name="new_rules.yaml", mime="text/yaml")
