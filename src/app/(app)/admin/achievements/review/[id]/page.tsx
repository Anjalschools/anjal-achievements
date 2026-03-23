import AdminAchievementReviewDetailScreen from "@/components/admin/AdminAchievementReviewDetailScreen";

type PageProps = {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
};

const AdminAchievementReviewDetailRoutePage = ({ params, searchParams }: PageProps) => {
  const raw = searchParams.returnTo;
  const returnTo = typeof raw === "string" ? raw : undefined;
  return <AdminAchievementReviewDetailScreen achievementId={params.id} returnTo={returnTo} />;
};

export default AdminAchievementReviewDetailRoutePage;
