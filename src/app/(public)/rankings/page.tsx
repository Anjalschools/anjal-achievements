import { redirect } from "next/navigation";

/** Landing/header linked here before dedicated rankings existed — avoid 404. */
export default function RankingsAliasPage() {
  redirect("/hall-of-fame");
}
