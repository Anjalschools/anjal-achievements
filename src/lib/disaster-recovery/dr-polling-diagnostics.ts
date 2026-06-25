export type DrPollingResponseLog = {
  status: number;
  contentType: string | null;
  contentLength: string | null;
  url: string;
};

export type DrPolling502HeadersLog = {
  status: number;
  server: string | null;
  cfRay: string | null;
  xRenderRouting: string | null;
  contentType: string | null;
  contentLength: string | null;
  date: string | null;
};

export const logDrPollingResponse = (input: DrPollingResponseLog): void => {
  console.info("[DR] POLLING_RESPONSE", input);
};

export const logDrPollingHtmlResponse = (input: {
  status: number;
  preview: string;
}): void => {
  console.info("[DR] POLLING_HTML_RESPONSE", input);
};

export const logDrPolling502Headers = (input: DrPolling502HeadersLog): void => {
  console.warn("[DR] POLLING_502_HEADERS", input);
};

export const readDrPollingResponseBody = async (
  response: Response,
  url: string
): Promise<string> => {
  const contentType = response.headers.get("content-type");
  const contentLength = response.headers.get("content-length");

  logDrPollingResponse({
    status: response.status,
    contentType,
    contentLength,
    url,
  });

  if (response.status === 502) {
    logDrPolling502Headers({
      status: response.status,
      server: response.headers.get("server"),
      cfRay: response.headers.get("cf-ray"),
      xRenderRouting: response.headers.get("x-render-routing"),
      contentType,
      contentLength,
      date: response.headers.get("date"),
    });
  }

  const text = await response.text();

  const looksLikeHtml =
    (contentType?.includes("text/html") ?? false) || text.trimStart().startsWith("<!");
  if (looksLikeHtml) {
    logDrPollingHtmlResponse({
      status: response.status,
      preview: text.slice(0, 300),
    });
  }

  return text;
};
