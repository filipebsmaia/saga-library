const API_BASE = `${process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3100"}/v1`;

export async function apiFetch<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url.toString());

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}
