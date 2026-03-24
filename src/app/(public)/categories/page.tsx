import { redirect } from "next/navigation";

/** Landing/header linked here before dedicated categories listing existed — avoid 404. */
export default function CategoriesAliasPage() {
  redirect("/achievements");
}
