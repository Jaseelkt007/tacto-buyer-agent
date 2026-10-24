import { redirect } from "next/navigation";
import { runsData } from "@/lib/runs";

// /live opens the latest run of P01; every run has its own /live/<session>.
export default function Page() {
  const p01 = runsData.runs.filter((r) => r.case_id === "case:P01");
  const run = p01.filter((r) => r.note.startsWith("engine v")).at(-1) ?? p01.at(-1) ?? runsData.runs.at(-1);
  redirect(run ? `/live/${run.session_id}` : "/negotiations");
}
