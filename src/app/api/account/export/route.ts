import { buildExport } from "@/lib/account/export";
import { ApiError, errorResponse, requireUser } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { limitOrThrow } from "@/lib/rate-limit";

/** JSON-Download aller eigenen Daten (auch mit unvollständigem Profil verfügbar). */
export async function GET() {
  try {
    const user = await requireUser();
    await limitOrThrow(`export:${user.id}`, 5, 3600, "Du kannst höchstens 5 Exporte pro Stunde anfordern.");
    const data = await buildExport(user.id);
    if (!data) throw new ApiError("NOT_FOUND", "Konto nicht gefunden");
    await audit(user.id, "account.data_export", { type: "user", id: user.id });
    const date = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="poppsie-daten-${user.username}-${date}.json"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
