import { AlertCandidate, AlertRuleContext } from "./types";
import { healthRules } from "./health";
import { operationsRules } from "./operations";
import { planningRules } from "./planning";
import { businessRules } from "./business";

const ALERT_RULES = [
  ...operationsRules,
  ...healthRules,
  ...planningRules,
  ...businessRules,
];

export function evaluateAlertRules(ctx: AlertRuleContext): AlertCandidate[] {
  return ALERT_RULES.flatMap((rule) => rule(ctx));
}

