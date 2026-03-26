import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedNewsBySlug } from "@/lib/public-news-queries";
import { getBaseUrl } from "@/lib/get-base-url";
import NewsShareBar from "@/components/public/NewsShareBar";
import type { Metadata } from "next";

type PageProps = {
  params: { slug: string };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const data = await getPublishedNewsBySlug(params.slug);
  if (!data) return { title: "خبر غير موجود" };
  return {
    title: `${data.detail.title} | الأخبار`,
    description: data.detail.summary || data.detail.title,
  };
}

const NewsDetailPage = async ({ params }: PageProps) => {
  const data = await getPublishedNewsBySlug(params.slug);
  if (!data) notFound();

  const { detail, related } = data;
  const base = getBaseUrl();
  const canonical = `${base}/news/${detail.slug}`;

  return (
    <article className="mx-auto w-full max-w-3xl flex-1 px-4 py-10" dir="rtl">
      <Link href="/news" className="text-sm font-semibold text-primary hover:underline">
        ← العودة إلى الأخبار
      </Link>

      <header className="mt-6">
        <time className="text-sm text-gray-500" dateTime={detail.publishedAt}>
          {new Date(detail.publishedAt).toLocaleDateString("ar-SA", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </time>
        <h1 className="mt-2 text-3xl font-black leading-tight text-[#071a3d]">{detail.title}</h1>
        {detail.subtitle ? <p className="mt-2 text-lg text-gray-700">{detail.subtitle}</p> : null}
      </header>

      {detail.coverImage ? (
        <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-2xl bg-gray-100 shadow-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={detail.coverImage} alt="" className="h-full w-full object-cover" />
        </div>
      ) : null}

      <div className="prose prose-neutral mt-8 max-w-none whitespace-pre-wrap text-base leading-relaxed text-gray-800">
        {detail.websiteBody || detail.summary || ""}
      </div>

      {detail.hashtags.length > 0 ? (
        <ul className="mt-6 flex flex-wrap gap-2">
          {detail.hashtags.map((h) => (
            <li
              key={h}
              className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
            >
              #{h.replace(/^#/, "")}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-8">
        <NewsShareBar url={canonical} title={detail.title} isAr />
      </div>

      {related.length > 0 ? (
        <section className="mt-14 border-t border-gray-200 pt-10">
          <h2 className="text-xl font-black text-[#071a3d]">أخبار ذات صلة</h2>
          <ul className="mt-4 space-y-3">
            {related.map((r) => (
              <li key={r.slug}>
                <Link href={`/news/${r.slug}`} className="font-semibold text-primary hover:underline">
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
};

export default NewsDetailPage;
