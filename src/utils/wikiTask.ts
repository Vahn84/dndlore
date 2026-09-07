import Api from "../Api";

export async function wikiTask<T>(operation: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${Api.getBaseUrl()}/sync/wiki/${operation}`, {
    method: "POST", signal,
    headers: { "Content-Type": "application/json", Accept: "text/event-stream", Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || `Wiki HTTP ${response.status}`);
  if (!response.body) throw new Error("Wiki returned no stream");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: T | undefined;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > 32 * 1024 * 1024) throw new Error("Wiki response exceeded size limit");
      let end;
      while ((end = buffer.indexOf("\n\n")) >= 0) {
        const event = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        const name = event.match(/^event: (.+)$/m)?.[1];
        const data = event.match(/^data: (.+)$/m)?.[1];
        if (!data) continue;
        const parsed = JSON.parse(data);
        if (name === "error") throw new Error(parsed.error || parsed.message || "Wiki operation failed");
        if (name === "result") result = parsed;
      }
    }
    if (result === undefined) throw new Error("Connection ended before completion. Check wiki state before retrying an apply.");
    return result;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
