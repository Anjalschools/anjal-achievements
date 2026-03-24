import { Suspense } from "react";
import AchievementFormPage from "@/components/achievements/AchievementFormPage";

const AdminAddAchievementPage = () => {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-text-light">جاري التحميل...</div>
      }
    >
      <AchievementFormPage variant="admin" />
    </Suspense>
  );
};

export default AdminAddAchievementPage;
