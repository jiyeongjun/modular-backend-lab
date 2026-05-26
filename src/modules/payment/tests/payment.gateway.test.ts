import { describe, expect, it } from "vitest";
import { createTossPaymentsGateway, type PaymentGatewayFetch } from "../infra/index.js";

describe("toss payments gateway", () => {
  it("confirms payment with basic auth and an idempotency key", async () => {
    const captured: { input: string | null; init: RequestInit | null } = {
      input: null,
      init: null,
    };
    const fetchFn: PaymentGatewayFetch = async (input, init) => {
      captured.input = input;
      captured.init = init;

      return new Response(
        JSON.stringify({
          paymentKey: "payment-key-1",
          orderId: "order-1",
          status: "DONE",
          totalAmount: 10_000,
          currency: "KRW",
          method: "CARD",
          approvedAt: "2026-01-01T00:00:00+09:00",
          receipt: { url: "https://receipt.example" },
        }),
        { status: 200 },
      );
    };
    const gateway = createTossPaymentsGateway({
      secretKey: "test_sk_123",
      baseUrl: "https://api.tosspayments.com",
      fetchFn,
    });

    const result = await gateway.confirmPayment({
      paymentKey: "payment-key-1",
      orderId: "order-1",
      amount: { amount: 10_000, currency: "KRW" },
      idempotencyKey: "confirm-1",
    });

    if (captured.input === null || captured.init === null) {
      throw new Error("expected fetch to be called");
    }
    const headers = new Headers(captured.init.headers);

    expect(result.ok).toBe(true);
    expect(captured.input).toBe("https://api.tosspayments.com/v1/payments/confirm");
    expect(headers.get("authorization")).toBe("Basic dGVzdF9za18xMjM6");
    expect(headers.get("idempotency-key")).toBe("confirm-1");
    expect(captured.init.method).toBe("POST");
  });

  it("maps Toss error responses to gateway rejections", async () => {
    const fetchFn: PaymentGatewayFetch = async () =>
      new Response(
        JSON.stringify({
          code: "NOT_FOUND_PAYMENT",
          message: "Payment was not found",
        }),
        { status: 404 },
      );
    const gateway = createTossPaymentsGateway({
      secretKey: "test_sk_123",
      baseUrl: "https://api.tosspayments.com",
      fetchFn,
    });

    const result = await gateway.confirmPayment({
      paymentKey: "payment-key-1",
      orderId: "order-1",
      amount: { amount: 10_000, currency: "KRW" },
      idempotencyKey: "confirm-1",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        type: "PaymentGatewayRejected",
        provider: "TOSS_PAYMENTS",
        code: "NOT_FOUND_PAYMENT",
        message: "Payment was not found",
        statusCode: 404,
        retryable: false,
      },
    });
  });
});
