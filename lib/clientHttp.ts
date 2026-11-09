export async function readJsonResponse<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function responseMessage(body: unknown, fallback: string) {
  if (!body || typeof body !== "object") return fallback;
  const value = body as { error?: { message?: unknown }; message?: unknown };
  if (typeof value.error?.message === "string" && value.error.message.trim()) return value.error.message;
  if (typeof value.message === "string" && value.message.trim()) return value.message;
  return fallback;
}
