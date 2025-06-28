# recommendation_engine.py (Final Version)
from typing import Dict, Any, List

class RecommendationEngine:
    def __init__(self, rules: Dict[str, list]):
        self.rules = rules

    def _match(self, field_val: Any, cond_val: Any) -> bool:
        if isinstance(cond_val, str):
            if cond_val.startswith(">="):
                try: return float(field_val) >= float(cond_val[2:])
                except: return False
            if cond_val.startswith("!="):
                return str(field_val) != cond_val[2:]
            if cond_val.startswith("<"):
                try: return float(field_val) < float(cond_val[1:])
                except: return False
            if cond_val.startswith("in:"):
                return str(field_val) in cond_val[3:].split(",")
            if cond_val.startswith("notin:"):
                return str(field_val) not in cond_val[6:].split(",")
        if isinstance(field_val, list):
            return cond_val in field_val
        return str(field_val) == str(cond_val)

    def evaluate(self, inputs: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
        results = {}
        for section, rules in self.rules.items():
            matches = []
            for rule in rules:
                cond = rule.get("when", {})
                if all(self._match(inputs.get(k), v) for k, v in cond.items()):
                    matches.append({
                        "recommend": rule["recommend"].format(**inputs),
                        "reason": rule.get("reason", "Matched conditions"),
                        "score": rule.get("score", 1),
                        "tags": rule.get("tags", []),
                        "source": rule.get("source", ""),
                        "tradeoffs": rule.get("tradeoffs", "")
                    })
            if matches:
                results[section.replace("_", " ").title()] = matches
        return results
