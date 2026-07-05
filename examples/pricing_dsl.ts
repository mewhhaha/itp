import { interpreter, number_operator, number_unary_operator } from "../mod.ts";

const pricing = interpreter({
  plus: number_operator(6, "left", (left, right) => left + right),
  minus: number_operator(6, "left", (left, right) => left - right),
  times: number_operator(7, "left", (left, right) => left * right),
  over: number_operator(7, "left", (left, right) => left / right),
  pct: number_unary_operator(8, (value) => value / 100),
});

const quote = {
  base: 5_000,
  seats: 12,
  seat_price: 75,
  discount: 10,
};

const monthly_expression =
  "(?base plus ?seats times ?seat_price) times (1 minus pct ?discount)";
const seat_share_expression =
  "?seats times ?seat_price over (?base plus ?seats times ?seat_price)";

const monthly = pricing(monthly_expression, quote);
const seat_share = pricing(seat_share_expression, quote);

console.log("pricing", {
  monthly,
  seat_share,
});
