import { getActivePopup } from "@/server/services/cms";
import { getCurrentUser } from "@/server/auth/dal";
import { PopupOverlay } from "@/components/PopupOverlay";

export async function SitePopup({ locale }: { locale: string }) {
  const user = await getCurrentUser();
  const popup = await getActivePopup(locale, Boolean(user));
  if (!popup) return null;

  return <PopupOverlay popup={popup} />;
}
