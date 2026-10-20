import { safeFileName } from "./storage";

// RFC 5987 so names with non-ASCII characters still download intact.
export function contentDisposition(
  fileName: string,
  disposition: "inline" | "attachment" = "attachment",
) {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export function pdfResponse(bytes: Uint8Array, title: string) {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition(safeFileName(`${title}.pdf`, "document"), "inline"),
      "Cache-Control": "private, no-store",
    },
  });
}
