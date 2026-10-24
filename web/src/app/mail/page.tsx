import type { Metadata } from "next";
import { Mailbox } from "@/components/Mailbox";
import { buildMails, data } from "@/lib/inbox";

export const metadata: Metadata = { title: "Mail · ProcuDeal" };

export default function Page() {
  return <Mailbox mails={buildMails(data.cases)} syncedAt={data.synced_at} />;
}
