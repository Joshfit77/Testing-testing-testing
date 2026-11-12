import { redirect } from "next/navigation";

/** Faith reminders now live with every other reminder in Profile → Notifications. Old links land on its Faith part. */
export default function FaithRemindersPage() {
  redirect("/profile/notifications#faith");
}
