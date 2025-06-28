# validate_rules.py – Final Version with Autofix Suggestions
import yaml
from pathlib import Path
from typing import Dict

REQUIRED_KEYS = {"recommend", "reason", "score"}
VALID_TOP_SECTIONS = {"datacenter", "power_cooling", "cybersecurity", "networking", "saas_cloud", "opportunities"}
DEFAULT_VALUES = {
    "score": 1,
    "tags": [],
    "tradeoffs": "",
    "source": ""
}

def validate_rule(rule: Dict, idx: int, domain: str) -> list:
    errors = []
    for key in REQUIRED_KEYS:
        if key not in rule:
            fix = DEFAULT_VALUES.get(key, "?")
            errors.append(f"[{domain}] Rule #{idx+1} missing key: '{key}'  → Suggest: {key}: {fix}")
    if "score" in rule and not isinstance(rule["score"], int):
        errors.append(f"[{domain}] Rule #{idx+1} score must be an integer")
    if "tags" in rule and not isinstance(rule.get("tags", []), list):
        errors.append(f"[{domain}] Rule #{idx+1} tags must be a list")
    if "when" in rule and not isinstance(rule.get("when", {}), dict):
        errors.append(f"[{domain}] Rule #{idx+1} when must be a dictionary")
    return errors


def validate_file(file_path: str):
    rules = yaml.safe_load(Path(file_path).read_text())
    errors = []
    for domain, rule_list in rules.items():
        if domain not in VALID_TOP_SECTIONS:
            errors.append(f"Unknown section: {domain}")
            continue
        for idx, rule in enumerate(rule_list):
            errors.extend(validate_rule(rule, idx, domain))

    if errors:
        print("\n❌ Validation FAILED:")
        for err in errors:
            print("   -", err)
    else:
        print("✅ All rules valid. Ready to publish.")

if __name__ == "__main__":
    import sys
    file = sys.argv[1] if len(sys.argv) > 1 else "rule_authoring_template.yaml"
    validate_file(file)
