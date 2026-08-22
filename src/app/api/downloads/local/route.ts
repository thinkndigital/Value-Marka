import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import { verifyLocalDownloadToken, resolvePrivateFilePath } from "@/server/storage/local";

/**
 * The local-dev counterpart to a GCS signed URL: possession of a valid,
 * unexpired token (minted by LocalStorageProvider.getSignedDownloadUrl) is
 * the only check here, exactly like a real signed URL — the entitlement
 * check already happened when the token was minted (see
 * getDownloadUrlForOrderItem). Never reachable in production — see
 * storage/index.ts, which refuses local-disk storage outside dev.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  const payload = await verifyLocalDownloadToken(token);
  if (!payload) {
    return NextResponse.json({ error: "This download link is invalid or has expired." }, { status: 403 });
  }

  const path = resolvePrivateFilePath(payload.key);
  let buffer: Buffer;
  try {
    buffer = await readFile(path);
  } catch {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${payload.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "no-store",
    },
  });
}
