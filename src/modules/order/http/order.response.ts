import type { Result } from "../../../shared/result/index.js";
import type { PayOrderUseCaseError } from "../application/index.js";
import type { Order } from "../domain/index.js";

export type HttpResponseShape = Readonly<{
  status: 200 | 404 | 409;
  body: unknown;
}>;

export function serializeOrder(order: Order): Record<string, unknown> {
  return {
    id: order.id,
    status: order.status,
    totalAmount: order.totalAmount,
    paidAt: order.paidAt?.toISOString() ?? null,
    version: order.version,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

export function mapPayOrderResult(result: Result<Order, PayOrderUseCaseError>): HttpResponseShape {
  if (result.ok) {
    return {
      status: 200,
      body: {
        data: serializeOrder(result.value),
      },
    };
  }

  if (result.error.type === "OrderNotFound") {
    return {
      status: 404,
      body: {
        error: result.error,
      },
    };
  }

  return {
    status: 409,
    body: {
      error: result.error,
    },
  };
}
