import { Link } from "@/i18n/navigation";
import { getActiveAnnouncement } from "@/server/services/cms";

export async function AnnouncementBar({ locale }: { locale: string }) {
  const announcement = await getActiveAnnouncement(locale);
  if (!announcement) return null;

  const body = (
    <p className="vm-container py-2 text-center text-sm font-medium text-white">
      {announcement.text}
    </p>
  );

  return (
    <div className="bg-navy-600">
      {announcement.link ? <Link href={announcement.link}>{body}</Link> : body}
    </div>
  );
}
