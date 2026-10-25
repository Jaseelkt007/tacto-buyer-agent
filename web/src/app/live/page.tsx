import { redirect } from "next/navigation";
import { v19 } from "@/lib/v19";

export default function Page() {
  const featured = v19.sessions.find((s) => s.case_id === "P01");
  redirect(featured ? `/live/${featured.id}` : "/negotiations");
}
