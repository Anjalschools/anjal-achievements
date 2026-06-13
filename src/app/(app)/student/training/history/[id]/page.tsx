import { redirect } from "next/navigation";

type PageProps = { params: { id: string } };

/** Alias route — spec path `/student/training/history/[id]` → feedback page. */
const StudentTrainingHistoryAliasPage = ({ params }: PageProps) => {
  redirect(`/summer-training/history/${encodeURIComponent(String(params.id || ""))}`);
};

export default StudentTrainingHistoryAliasPage;
