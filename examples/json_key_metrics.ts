import { terp } from "../mod.ts";
import metrics from "./data/metrics.json" with { type: "json" };

type Scope = Record<string, unknown>;

const reports = metrics.accounts.map((account) => {
  const scope: Scope = { ...account };

  for (const [name, keys] of Object.entries(metrics.rollups)) {
    scope[name] = evaluate_number(sum_expression(keys), scope);
  }

  for (const [name, expression] of Object.entries(metrics.derived)) {
    scope[name] = terp(expression, scope);
  }

  return {
    account: account.name,
    gross_revenue: scope.gross_revenue,
    operating_cost: scope.operating_cost,
    net: scope.net,
    margin: scope.margin,
    healthy: scope.healthy,
  };
});

console.log("json-key-metrics", reports);

function sum_expression(keys: readonly string[]): string {
  return keys.map(named_placeholder).join(" + ");
}

function named_placeholder(key: string): string {
  if (!/^[A-Za-z_$][\w$]*$/.test(key)) {
    throw new TypeError("JSON key `" + key + "` is not a valid placeholder");
  }

  return "?" + key;
}

function evaluate_number(expression: string, scope: Scope): number {
  const value = terp(expression, scope);

  if (typeof value !== "number") {
    throw new TypeError(
      "expression `" + expression + "` did not return number",
    );
  }

  return value;
}
