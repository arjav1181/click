export interface ApiFailure {
  error?: { code?: string; message?: string; details?: unknown };
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const payload = (await response.json().catch(() => ({}))) as T & ApiFailure;
  if (!response.ok) {
    throw new ApiClientError(
      payload.error?.message ?? "Something went wrong. Try again.",
      payload.error?.code ?? "request_failed",
      response.status,
      payload.error?.details,
    );
  }
  return payload;
}

export async function patchJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const payload = (await response.json().catch(() => ({}))) as T & ApiFailure;
  if (!response.ok) {
    throw new ApiClientError(
      payload.error?.message ?? "Something went wrong. Try again.",
      payload.error?.code ?? "request_failed",
      response.status,
      payload.error?.details,
    );
  }
  return payload;
}
