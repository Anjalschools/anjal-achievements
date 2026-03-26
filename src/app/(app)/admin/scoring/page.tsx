"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_SCORING_CONFIG, type ScoringConfig } from "@/constants/default-scoring";
import {
  SCORING_SECTIONS,
  scoringFieldLabelAr,
  scoringSectionForPath,
  sortPathsInSection,
  type ScoringSectionId,
} from "@/lib/scoring-settings-ui";

type NumberLeaf = {
  path: string;
  value: number;
};

const flattenNumberLeaves = (obj: Record<string, unknown>, parent = ""): NumberLeaf[] => {
  const rows: NumberLeaf[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = parent ? `${parent}.${key}` : key;
    if (typeof value === "number") {
      rows.push({ path, value });
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      rows.push(...flattenNumberLeaves(value as Record<string, unknown>, path));
    }
  }
  return rows;
};

const setNestedNumber = (config: ScoringConfig, path: string, num: number): ScoringConfig => {
  const keys = path.split(".");
  const next = structuredClone(config) as Record<string, unknown>;
  let cur: Record<string, unknown> = next;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const k = keys[i];
    cur[k] = { ...(cur[k] as Record<string, unknown>) };
    cur = cur[k] as Record<string, unknown>;
  }
  cur[keys[keys.length - 1]] = num;
  return next as ScoringConfig;
};

const groupFieldsBySection = (leaves: NumberLeaf[]) => {
  const map = new Map<ScoringSectionId, NumberLeaf[]>();
  for (const leaf of leaves) {
    const sid = scoringSectionForPath(leaf.path);
    const list = map.get(sid) || [];
    list.push(leaf);
    map.set(sid, list);
  }
  for (const [sid, list] of map.entries()) {
    const paths = sortPathsInSection(
      list.map((x) => x.path),
      sid
    );
    const byPath = new Map(list.map((x) => [x.path, x]));
    map.set(
      sid,
      paths.map((p) => byPath.get(p)!).filter(Boolean)
    );
  }
  return map;
};

export default function AdminScoringPage() {
  const [form, setForm] = useState<ScoringConfig>(DEFAULT_SCORING_CONFIG);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const res = await fetch("/api/admin/scoring", { cache: "no-store" });
        const data = await res.json();
        if (!mounted) return;
        if (data?.ok && data?.config) {
          setForm(data.config as ScoringConfig);
        }
      } catch {
        if (mounted) setMessage("تعذر تحميل إعدادات النقاط، تم استخدام القيم الافتراضية.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);

  const leaves = useMemo(() => flattenNumberLeaves(form as unknown as Record<string, unknown>), [form]);
  const grouped = useMemo(() => groupFieldsBySection(leaves), [leaves]);

  const previewBlocks = useMemo(() => {
    const Ln = form.levelMultipliers.national;
    const Pn = form.participation.national;
    const bonus = form.typeBonus;
    const team = form.teamResultMultiplier;
    const ex1 = Math.round(Pn * Ln + bonus);
    const ex2 = Math.round(Pn * Ln * team + bonus);
    const ex3 = Math.round(form.medal.gold.national * Ln + bonus);
    const ex4 = Math.round(form.rank.first.national * Ln + bonus);
    return [
      {
        title: "مشاركة فقط — مستوى المملكة (فردي)",
        formula: `${Pn} × ${Ln} + ${bonus}`,
        result: ex1,
      },
      {
        title: "مشاركة فقط — مستوى المملكة (ضمن فريق)",
        formula: `${Pn} × ${Ln} × ${team} + ${bonus}`,
        result: ex2,
      },
      {
        title: "ميدالية ذهبية — مستوى المملكة",
        formula: `${form.medal.gold.national} × ${Ln} + ${bonus}`,
        result: ex3,
      },
      {
        title: "المركز الأول — مستوى المملكة",
        formula: `${form.rank.first.national} × ${Ln} + ${bonus}`,
        result: ex4,
      },
    ];
  }, [form]);

  const handleNumberChange = (path: string, raw: string) => {
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return;
    setForm((prev) => setNestedNumber(prev, path, parsed));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/scoring", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: form }),
      });
      const data = await res.json();
      if (!data?.ok) {
        setMessage(data?.error || "تعذر حفظ الإعدادات.");
        return;
      }
      setForm(data.config as ScoringConfig);
      setMessage("تم حفظ إعدادات النقاط بنجاح.");
    } catch {
      setMessage("حدث خطأ غير متوقع أثناء الحفظ.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/scoring", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetToDefault: true }),
      });
      const data = await res.json();
      if (!data?.ok) {
        setMessage(data?.error || "تعذر إعادة التعيين.");
        return;
      }
      setForm(data.config as ScoringConfig);
      setMessage("تمت إعادة القيم الافتراضية.");
    } catch {
      setMessage("حدث خطأ غير متوقع أثناء إعادة التعيين.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="space-y-6" dir="rtl">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">إعدادات النقاط</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          تُستخدم هذه الإعدادات لتحديد كيفية احتساب نقاط إنجازات الطلاب.
        </p>
      </div>

      <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-4 shadow-sm ring-1 ring-amber-100">
        <h2 className="text-sm font-bold text-amber-950">معاينة احتساب (أمثلة رقمية)</h2>
        <p className="mt-1 text-xs leading-relaxed text-amber-900/90">
          أمثلة باستخدام القيم الحالية في النموذج ومستوى «المملكة»: النقاط الأساسية × مضاعف المستوى (+ مكافأة النوع)،
          ومعامل الفريق عند المشاركة الجماعية. قد يطبّق محرك المنصة قواعد إضافية حسب نوع الإنجاز.
        </p>
        <ul className="mt-3 space-y-2 text-sm text-amber-950">
          {previewBlocks.map((row) => (
            <li
              key={row.title}
              className="rounded-lg border border-amber-200/60 bg-white/80 px-3 py-2.5"
            >
              <div className="font-medium text-slate-800">{row.title}</div>
              <div className="mt-1 font-mono text-xs text-slate-600" dir="ltr">
                {row.formula} = <span className="font-bold text-primary">{row.result}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-bold text-slate-900">إعدادات نظام النقاط</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              إعادة القيم الافتراضية
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? "جاري الحفظ…" : "حفظ الإعدادات"}
            </button>
          </div>
        </div>

        {loading ? <p className="text-sm text-slate-500">جاري التحميل…</p> : null}

        <div className="space-y-10">
          {SCORING_SECTIONS.map((section) => {
            const fields = grouped.get(section.id) || [];
            if (fields.length === 0) return null;
            return (
              <section key={section.id} className="border-t border-slate-100 pt-8 first:border-t-0 first:pt-0">
                <h3 className="text-sm font-bold text-slate-900">{section.title}</h3>
                <p className="mt-2 max-w-3xl text-xs leading-relaxed text-slate-600">{section.hint}</p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {fields.map((field) => (
                    <div key={field.path} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                      <label className="block space-y-1.5">
                        <span className="block text-sm font-semibold text-slate-800">
                          {scoringFieldLabelAr(field.path)}
                        </span>
                        <input
                          type="number"
                          step="any"
                          value={Number.isFinite(field.value) ? field.value : 0}
                          onChange={(e) => handleNumberChange(field.path, e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          dir="ltr"
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {message ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
          {message}
        </div>
      ) : null}
    </main>
  );
}
