export type Currency = "KRW" | "USD";

export type Money = Readonly<{
  amount: number;
  currency: Currency;
}>;

export function isPositiveMoney(money: Money): boolean {
  return Number.isFinite(money.amount) && money.amount > 0;
}
