# SHI Field Configurator 🛠️
Streamlit application for SHI International **Public-Sector Account Executives**  
to capture customer requirements (datacenter, power & cooling, cybersecurity,  
networking, SaaS / cloud) and auto-generate **cutting-edge vendor recommendations**.

---

## ✨ Features
| Capability | Details |
|------------|---------|
| **Tabbed modern UI** | Clean, emoji-coded tabs; progress indicator in sidebar. |
| **YAML rules engine** | Non-developers can tweak `rules.yaml` to change the logic—no code edits. |
| **One-click export** | Generates a ZIP with JSON, Excel, PDF & PowerPoint summaries. |
| **Runs anywhere** | Works on Replit, Streamlit Community Cloud, Docker, or bare Python. |
| **SHI branding** | Light theme with SHI red (`#DC1E35`) as primary colour. |

---

## 🏃‍♂️ Quick Start (local)

```bash
# clone and enter the repo
git clone https://github.com/<you>/Configurator-Field.git
cd Configurator-Field

# optional: use a virtual env
python -m venv .venv && source .venv/bin/activate

# install deps
pip install -r requirements.txt

# run
streamlit run shi_field_configurator.py
