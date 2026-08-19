import "server-only";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser, type CurrentUser } from "./dal";

/** Redirects to /login when signed out; otherwise returns the user. */
export async function requireUser(locale: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/login", locale });
    throw new Error("unreachable");
  }
  return user;
}
