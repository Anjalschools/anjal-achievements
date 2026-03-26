import Link from "next/link";
import { listPublishedNews } from "@/lib/public-news-queries";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "الأخبار | منصة تميز الأنجال",
  description: "أخبار المدرسة والإنجازات المعتمدة",
};

type PageProps = {
  searchParams: { page?: string };
};

const NewsIndexPage = async ({ searchParams }: PageProps) => {
  const page = Math.max(1, parseInt(searchParams.page || "1", 10) || 1);
  const { items, total } = await listPublishedNews(page, 12);
  const pages = Math.max(1, Math.ceil(total / 12));

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10" dir="rtl">
      <header className="mb-10 border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-black text-[#071a3d]">الأخبار</h1>
        <p className="mt-2 text-sm text-gray-600">آخر الأخبار والفعاليات المعتمدة على المنصة</p>
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center text-gray-500">
          لا توجد أخبار منشورة حاليًا.
        </div>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2">
          {items.map((n) => (
            <li key={n.slug}>
              <Link
                href={`/news/${n.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:border-primary/30 hover:shadow-md"
              >
                <div className="relative aspect-[16/9] bg-gray-100">
                  {n.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={n.coverImage}
                      alt=""
                      className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-gray-400">بدون صورة</div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <time className="text-xs text-gray-500" dateTime={n.publishedAt}>
                    {new Date(n.publishedAt).toLocaleDateString("ar-SA", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </time>
                  <h2 className="mt-2 line-clamp-2 text-lg font-bold text-[#071a3d] group-hover:text-primary">
                    {n.title}
                  </h2>
                  {n.summary ? (
                    <p className="mt-2 line-clamp-2 text-sm text-gray-600">{n.summary}</p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <nav className="mt-10 flex justify-center gap-2" aria-label="ترقيم الصفحات">
          {page > 1 ? (
            <Link
              href={`/news?page=${page - 1}`}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              السابق
            </Link>
          ) : null}
          <span className="px-4 py-2 text-sm text-gray-600">
            {page} / {pages}
          </span>
          {page < pages ? (
            <Link
              href={`/news?page=${page + 1}`}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              التالي
            </Link>
          ) : null}
        </nav>
      ) : null}
    </main>
  );
};

export default NewsIndexPage;
