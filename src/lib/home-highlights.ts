import type { HomeHighlightColor } from "@/models/HomeHighlight";
import { PUBLIC_IMG } from "@/lib/publicImages";

export type HomeHighlightItemType =
  | "award"
  | "accreditation"
  | "national"
  | "international"
  | "scholarship"
  | "milestone";

export type HomeHighlightIconKey =
  | "trophy"
  | "medal"
  | "shield-check"
  | "globe"
  | "building"
  | "graduation-cap"
  | "star"
  | "target";

export type HomeHighlightItemPayload = {
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  type?: HomeHighlightItemType;
  iconKey?: HomeHighlightIconKey;
  badgeAr?: string;
  badgeEn?: string;
  isActive?: boolean;
  /** Legacy unified fields (kept for backward compatibility). */
  title: string;
  description: string;
  imageUrl: string;
  link?: string;
  order: number;
};

export type HomeHighlightBlockPayload = {
  titleAr: string;
  titleEn: string;
  /** Legacy unified field (kept for backward compatibility). */
  title: string;
  color: HomeHighlightColor;
  /** Column order in strips that render multiple blocks (e.g. participation). */
  sortOrder?: number;
  /** Optional header icon; defaults to Globe for blue and Star for gold on the homepage. */
  headerIconKey?: "globe" | "star";
  items: HomeHighlightItemPayload[];
};

export type HomeHighlightPayload = {
  sectionEnabled?: boolean;
  layoutColumns?: 2 | 3;
  sectionTitleAr: string;
  sectionTitleEn: string;
  sectionSubtitleAr: string;
  sectionSubtitleEn: string;
  /** Legacy unified fields (kept for backward compatibility). */
  sectionTitle: string;
  sectionSubtitle: string;
  blocks: HomeHighlightBlockPayload[];
  /** "إبراز النماذج المتميزة والإنجازات البارزة" — two-column image section on the homepage. */
  participationSectionEnabled?: boolean;
  participationTitleAr?: string;
  participationTitleEn?: string;
  participationSubtitleAr?: string;
  participationSubtitleEn?: string;
  participationBlocks?: HomeHighlightBlockPayload[];
  studentShowcaseTitleAr?: string;
  studentShowcaseTitleEn?: string;
  studentShowcaseSubtitleAr?: string;
  studentShowcaseSubtitleEn?: string;
  studentShowcaseFilters?: {
    id: string;
    labelAr: string;
    labelEn: string;
    sortOrder: number;
    isActive: boolean;
  }[];
  studentShowcaseItems?: {
    id: string;
    titleAr: string;
    titleEn: string;
    descriptionAr: string;
    descriptionEn: string;
    imageUrl: string;
    category: string;
    badgeAr?: string;
    badgeEn?: string;
    sortOrder: number;
    isActive: boolean;
  }[];
};

export const DEFAULT_HOME_HIGHLIGHTS: HomeHighlightPayload = {
  sectionEnabled: true,
  layoutColumns: 3,
  sectionTitleAr: "إنجازات مؤسسية بارزة لمدارس الأنجال الأهلية",
  sectionTitleEn: "Distinguished Institutional Achievements of Al-Anjal Private Schools",
  sectionSubtitleAr:
    "إنجازات راسخة تعكس مكانة مدارس الأنجال في صدارة التميز محلياً وعالمياً. نفتخر بما تحقق، ونواصل بثقة صناعة مستقبل استثنائي لطلابنا.",
  sectionSubtitleEn:
    "Established achievements reflect Al-Anjal Schools’ leadership in excellence locally and globally. We take pride in what has been accomplished and continue confidently shaping an exceptional future for our students.",
  sectionTitle: "إنجازات مؤسسية بارزة لمدارس الأنجال الأهلية",
  sectionSubtitle:
    "إنجازات راسخة تعكس مكانة مدارس الأنجال في صدارة التميز محلياً وعالمياً. نفتخر بما تحقق، ونواصل بثقة صناعة مستقبل استثنائي لطلابنا.",
  blocks: [
    {
      titleAr: "إنجازات وطنية مؤثرة",
      titleEn: "High-impact national achievements",
      title: "إنجازات وطنية مؤثرة",
      color: "gold",
      items: [
        {
          titleAr: "المركز الأول في اختبارات القدرات",
          titleEn: "1st Place in Qudurat Exams",
          descriptionAr: "تحقيق المركز الأول في اختبارات القدرات على مستوى المملكة.",
          descriptionEn: "Achieving first place in Qudurat exams at the Kingdom level.",
          type: "national",
          iconKey: "medal",
          badgeAr: "إنجاز وطني",
          badgeEn: "National",
          isActive: true,
          title: "المركز الأول في اختبارات القدرات",
          description: "تحقيق المركز الأول في اختبارات القدرات على مستوى المملكة.",
          imageUrl: PUBLIC_IMG.achieveWeeklySection,
          order: 1,
        },
        {
          titleAr: "المركز الأول في اختبارات التحصيلي",
          titleEn: "1st Place in Tahsili Exams",
          descriptionAr: "تحقيق المركز الأول في اختبارات التحصيلي على مستوى المملكة.",
          descriptionEn: "Achieving first place in Tahsili exams at the Kingdom level.",
          type: "national",
          iconKey: "trophy",
          badgeAr: "إنجاز وطني",
          badgeEn: "National",
          isActive: true,
          title: "المركز الأول في اختبارات التحصيلي",
          description: "تحقيق المركز الأول في اختبارات التحصيلي على مستوى المملكة.",
          imageUrl: PUBLIC_IMG.achieveFile,
          order: 2,
        },
        {
          titleAr: "24 درع تميز مؤسسي",
          titleEn: "24 Institutional Excellence Shields",
          descriptionAr:
            "الحصول على 24 درع تميز في نتائج التقويم والاعتماد والتصنيف المدرسي على مدى عامين متتاليين.",
          descriptionEn:
            "Receiving 24 excellence shields in evaluation, accreditation, and school classification results over two consecutive years.",
          type: "accreditation",
          iconKey: "shield-check",
          badgeAr: "اعتماد وتميز",
          badgeEn: "Accreditation",
          isActive: true,
          title: "24 درع تميز مؤسسي",
          description:
            "الحصول على 24 درع تميز في نتائج التقويم والاعتماد والتصنيف المدرسي على مدى عامين متتاليين.",
          imageUrl: PUBLIC_IMG.achieveWeeklySection,
          order: 3,
        },
      ],
    },
    {
      titleAr: "إنجازات عالمية واستثمار في التميز",
      titleEn: "Global achievements and excellence investment",
      title: "إنجازات عالمية واستثمار في التميز",
      color: "blue",
      items: [
        {
          titleAr: "جائزة التميز من Cognia",
          titleEn: "Cognia Excellence Award",
          descriptionAr:
            "حصلت مدارس الأنجال الأهلية على جائزة التميز من مؤسسة Cognia الدولية ضمن أفضل 35 مدرسة على مستوى العالم.",
          descriptionEn:
            "Al-Anjal Private Schools received the Excellence Award from Cognia International, ranking among the top 35 schools worldwide.",
          type: "award",
          iconKey: "star",
          badgeAr: "جائزة",
          badgeEn: "Award",
          isActive: true,
          title: "جائزة التميز من Cognia",
          description:
            "حصلت مدارس الأنجال الأهلية على جائزة التميز من مؤسسة Cognia الدولية ضمن أفضل 35 مدرسة على مستوى العالم.",
          imageUrl: PUBLIC_IMG.isef,
          order: 1,
        },
        {
          titleAr: "المركز الأول عالميًا في جائزة الموهوبين",
          titleEn: "1st Place Globally in the Gifted Award",
          descriptionAr:
            "تحقيق المركز الأول عالميًا في جائزة الموهوبين من مؤسسة حمدان بن راشد.",
          descriptionEn:
            "Achieving first place globally in the Gifted Award from the Hamdan bin Rashid Foundation.",
          type: "international",
          iconKey: "globe",
          badgeAr: "إنجاز عالمي",
          badgeEn: "International",
          isActive: true,
          title: "المركز الأول عالميًا في جائزة الموهوبين",
          description: "تحقيق المركز الأول عالميًا في جائزة الموهوبين من مؤسسة حمدان بن راشد.",
          imageUrl: PUBLIC_IMG.saudiFlag,
          order: 2,
        },
        {
          titleAr: "2000+ منحة تعليمية للطلبة الموهوبين",
          titleEn: "2000+ Scholarships for Gifted Students",
          descriptionAr:
            "تقديم أكثر من 2000 منحة تعليمية للطلبة الموهوبين، بقيمة إجمالية تجاوزت 23,000,000 ريال.",
          descriptionEn:
            "Providing more than 2,000 educational scholarships for gifted students, with a total value exceeding SAR 23,000,000.",
          type: "scholarship",
          iconKey: "graduation-cap",
          badgeAr: "منح ومبادرات",
          badgeEn: "Scholarship",
          isActive: true,
          title: "2000+ منحة تعليمية للطلبة الموهوبين",
          description:
            "تقديم أكثر من 2000 منحة تعليمية للطلبة الموهوبين، بقيمة إجمالية تجاوزت 23,000,000 ريال.",
          imageUrl: PUBLIC_IMG.isef,
          order: 3,
        },
      ],
    },
  ],
  studentShowcaseTitleAr: "مشاركات طلاب وطالبات مدارس الأنجال بالمعارض والمسابقات المحلية والعالمية",
  studentShowcaseTitleEn:
    "Al-Anjal Students’ Participations in Local and International Exhibitions and Competitions",
  studentShowcaseSubtitleAr:
    "إنجازات طلاب مدارس الأنجال الأهلية في المحافل المحلية والعالمية",
  studentShowcaseSubtitleEn:
    "Al-Anjal students’ achievements in local and international forums.",
  studentShowcaseFilters: [
    { id: "qudurat", labelAr: "القدرات", labelEn: "Qudurat", sortOrder: 1, isActive: true },
    { id: "tahsili", labelAr: "التحصيلي", labelEn: "Tahsili", sortOrder: 2, isActive: true },
    { id: "hamdan", labelAr: "جائزة حمدان", labelEn: "Hamdan Award", sortOrder: 3, isActive: true },
    { id: "isef", labelAr: "معرض آيسف", labelEn: "ISEF", sortOrder: 4, isActive: true },
    { id: "tisef", labelAr: "معرض تايسف بتايوان", labelEn: "TISEF Taiwan", sortOrder: 5, isActive: true },
    { id: "itex", labelAr: "معرض آيتكس بماليزيا", labelEn: "ITEX Malaysia", sortOrder: 6, isActive: true },
  ],
  studentShowcaseItems: [
    {
      id: "showcase-1",
      titleAr: "مشاركة عالمية في ISEF",
      titleEn: "Global Participation in ISEF",
      descriptionAr: "تمثيل مشرف لطلاب مدارس الأنجال في المحافل الدولية.",
      descriptionEn: "Distinguished representation of Al-Anjal students in global forums.",
      imageUrl: PUBLIC_IMG.isef,
      category: "isef",
      badgeAr: "معرض",
      badgeEn: "Exhibition",
      sortOrder: 1,
      isActive: true,
    },
    {
      id: "showcase-2",
      titleAr: "تمثيل المملكة دوليًا",
      titleEn: "Representing the Kingdom Internationally",
      descriptionAr: "إنجازات طلابية ترفع راية الوطن في المحافل الدولية.",
      descriptionEn: "Student achievements that raise the Kingdom’s flag internationally.",
      imageUrl: PUBLIC_IMG.saudiFlag,
      category: "isef",
      badgeAr: "إنجاز عالمي",
      badgeEn: "Global Achievement",
      sortOrder: 2,
      isActive: true,
    },
  ],
  participationSectionEnabled: true,
  participationTitleAr: "إبراز النماذج المتميزة والإنجازات البارزة",
  participationTitleEn: "Highlighting Outstanding Models and Prominent Achievements",
  participationSubtitleAr: "واجهة مؤسسية تبرز أثر المدرسة في صناعة التميز",
  participationSubtitleEn:
    "An institutional interface that highlights the school's impact in shaping excellence.",
  participationBlocks: [
    {
      titleAr: "الإنجازات العالمية",
      titleEn: "Global achievements",
      title: "الإنجازات العالمية",
      color: "blue",
      sortOrder: 1,
      headerIconKey: "globe",
      items: [
        {
          titleAr: "مشاركة عالمية في ISEF",
          titleEn: "Global participation in ISEF",
          descriptionAr: "تمثيل مشرف لطلاب مدارس الأنجال في المحافل الدولية",
          descriptionEn: "Distinguished representation of Al-Anjal students in international forums.",
          type: "international",
          iconKey: "globe",
          isActive: true,
          title: "مشاركة عالمية في ISEF",
          description: "تمثيل مشرف لطلاب مدارس الأنجال في المحافل الدولية",
          imageUrl: PUBLIC_IMG.isef,
          order: 1,
        },
        {
          titleAr: "تمثيل المملكة دوليًا",
          titleEn: "Representing the Kingdom internationally",
          descriptionAr: "إنجازات طلابية ترفع راية الوطن في المحافل الدولية",
          descriptionEn: "Student achievements that raise the Kingdom’s flag in international forums.",
          type: "international",
          iconKey: "globe",
          isActive: true,
          title: "تمثيل المملكة دوليًا",
          description: "إنجازات طلابية ترفع راية الوطن في المحافل الدولية",
          imageUrl: PUBLIC_IMG.saudiFlag,
          order: 2,
        },
      ],
    },
    {
      titleAr: "الإنجاز الأسبوعي",
      titleEn: "Weekly achievement",
      title: "الإنجاز الأسبوعي",
      color: "gold",
      sortOrder: 2,
      headerIconKey: "star",
      items: [
        {
          titleAr: "قصة إنجاز ملهمة",
          titleEn: "An inspiring achievement story",
          descriptionAr:
            "حصول الطالب/ عبدالله السحيب على الميدالية البرونزية في ملتقى الربيع 2025م المقام بمدينة الرياض تخصص فيزياء للتدريبات على أولمبياد الدولية 2025",
          descriptionEn:
            "Student Abdullah Al-Suhaib earned the bronze medal at the Spring Forum 2025 in Riyadh, specializing in physics training for the 2025 International Olympiad.",
          type: "milestone",
          iconKey: "star",
          isActive: true,
          title: "قصة إنجاز ملهمة",
          description:
            "حصول الطالب/ عبدالله السحيب على الميدالية البرونزية في ملتقى الربيع 2025م المقام بمدينة الرياض تخصص فيزياء للتدريبات على أولمبياد الدولية 2025",
          imageUrl: PUBLIC_IMG.achieveWeeklySection,
          order: 1,
        },
        {
          titleAr: "ملفات إنجاز حديثة",
          titleEn: "Recent achievement files",
          descriptionAr: "إبراز قصص النجاح بأسلوب عرض بصري حديث ومؤثر",
          descriptionEn: "Highlighting success stories through a modern, impactful visual presentation.",
          type: "milestone",
          iconKey: "star",
          isActive: true,
          title: "ملفات إنجاز حديثة",
          description: "إبراز قصص النجاح بأسلوب عرض بصري حديث ومؤثر",
          imageUrl: PUBLIC_IMG.achieveFile,
          order: 2,
        },
      ],
    },
  ],
};

const asTrimmed = (v: unknown, max = 4000): string => {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length > max ? s.slice(0, max) : s;
};

const LEGACY_IMAGE_MAP: Record<string, string> = {
  "/images/anjal-isef.webp": PUBLIC_IMG.isef,
  "/images/anjal-saudi-flag.webp": PUBLIC_IMG.saudiFlag,
  "/images/anjal-achievement-file.webp": PUBLIC_IMG.achieveFile,
  "/images/anjal-achievement-weekly.webp": PUBLIC_IMG.achieveWeeklySection,
};

const mapLegacyImagePath = (src: string): string => {
  const key = src.trim().toLowerCase();
  return LEGACY_IMAGE_MAP[key] || src;
};

const sanitizeImageUrl = (raw: unknown): string => {
  const s = mapLegacyImagePath(asTrimmed(raw, 2_000_000));
  if (!s) return "";
  // Supported (safe) image sources:
  // - Local under /images/*
  // - Local root files (e.g. /ISEF.jpg, /Achive_file.jpg)
  // - Data URI image
  // - External http/https
  if (/^\/images\//i.test(s)) return s;
  if (/^\/[a-z0-9_.-][^?#]*$/i.test(s)) return s;
  if (/^data:image\//i.test(s)) return s;
  if (/^https?:\/\//i.test(s)) return s;
  return "";
};

const toOrder = (v: unknown, fallback: number): number => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").trim());
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
};

const normalizeItem = (raw: unknown, idx: number): HomeHighlightItemPayload | null => {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const titleAr = asTrimmed(o.titleAr, 300);
  const titleEn = asTrimmed(o.titleEn, 300);
  const descriptionAr = asTrimmed(o.descriptionAr, 4000);
  const descriptionEn = asTrimmed(o.descriptionEn, 4000);
  const legacyTitle = asTrimmed(o.title, 300);
  const legacyDescription = asTrimmed(o.description, 4000);

  const finalTitleAr = titleAr || legacyTitle || titleEn;
  const finalTitleEn = titleEn || legacyTitle || titleAr;
  const finalDescAr = descriptionAr || legacyDescription || descriptionEn;
  const finalDescEn = descriptionEn || legacyDescription || descriptionAr;
  const typeRaw = asTrimmed(o.type, 60);
  const iconKeyRaw = asTrimmed(o.iconKey, 60);
  const type: HomeHighlightItemType | undefined =
    typeRaw === "award" ||
    typeRaw === "accreditation" ||
    typeRaw === "national" ||
    typeRaw === "international" ||
    typeRaw === "scholarship" ||
    typeRaw === "milestone"
      ? typeRaw
      : undefined;
  const iconKey: HomeHighlightIconKey | undefined =
    iconKeyRaw === "trophy" ||
    iconKeyRaw === "medal" ||
    iconKeyRaw === "shield-check" ||
    iconKeyRaw === "globe" ||
    iconKeyRaw === "building" ||
    iconKeyRaw === "graduation-cap" ||
    iconKeyRaw === "star" ||
    iconKeyRaw === "target"
      ? iconKeyRaw
      : undefined;
  const badgeAr = asTrimmed(o.badgeAr, 120);
  const badgeEn = asTrimmed(o.badgeEn, 120);
  const isActive = typeof o.isActive === "boolean" ? o.isActive : true;

  // Keep long Base64 payloads and only allow safe image schemes/paths.
  const imageUrl = sanitizeImageUrl(o.imageUrl) || PUBLIC_IMG.achieveFile;
  const link = asTrimmed(o.link, 4000);
  const order = toOrder(o.sortOrder ?? o.order, idx + 1);
  if (!finalTitleAr || !finalDescAr) return null;
  return {
    titleAr: finalTitleAr,
    titleEn: finalTitleEn,
    descriptionAr: finalDescAr,
    descriptionEn: finalDescEn,
    type,
    iconKey,
    badgeAr: badgeAr || undefined,
    badgeEn: badgeEn || undefined,
    isActive,
    // Keep legacy unified fields populated for older renderers.
    title: finalTitleAr,
    description: finalDescAr,
    imageUrl,
    link: link || undefined,
    order,
  };
};

const normalizeBlock = (raw: unknown, blockIdx: number): HomeHighlightBlockPayload | null => {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const titleAr = asTrimmed(o.titleAr, 300);
  const titleEn = asTrimmed(o.titleEn, 300);
  const legacyTitle = asTrimmed(o.title, 300);
  const finalTitleAr = titleAr || legacyTitle || titleEn;
  const finalTitleEn = titleEn || legacyTitle || titleAr;
  const color = o.color === "gold" ? "gold" : o.color === "blue" ? "blue" : null;
  const headerIconRaw = asTrimmed(o.headerIconKey, 20);
  const headerIconKey: "globe" | "star" | undefined =
    headerIconRaw === "globe" || headerIconRaw === "star" ? headerIconRaw : undefined;
  const itemsRaw = Array.isArray(o.items) ? o.items : [];
  const items = itemsRaw
    .map((r, idx) => normalizeItem(r, idx))
    .filter(Boolean) as HomeHighlightItemPayload[];
  items.sort((a, b) => a.order - b.order);
  if (!finalTitleAr || !color || items.length === 0) return null;
  const sortOrder = toOrder(o.sortOrder, blockIdx + 1);
  return {
    titleAr: finalTitleAr,
    titleEn: finalTitleEn,
    // Keep legacy unified field populated for older renderers.
    title: finalTitleAr,
    color,
    sortOrder,
    headerIconKey,
    items,
  };
};

export const normalizeHomeHighlightPayload = (raw: unknown): HomeHighlightPayload => {
  if (!raw || typeof raw !== "object") return DEFAULT_HOME_HIGHLIGHTS;
  const o = raw as Record<string, unknown>;
  const sectionTitleAr = asTrimmed(o.sectionTitleAr, 500);
  const sectionTitleEn = asTrimmed(o.sectionTitleEn, 500);
  const sectionSubtitleAr = asTrimmed(o.sectionSubtitleAr, 2000);
  const sectionSubtitleEn = asTrimmed(o.sectionSubtitleEn, 2000);
  const legacySectionTitle = asTrimmed(o.sectionTitle, 500);
  const legacySectionSubtitle = asTrimmed(o.sectionSubtitle, 2000);
  const finalSectionTitleAr =
    sectionTitleAr || legacySectionTitle || sectionTitleEn || DEFAULT_HOME_HIGHLIGHTS.sectionTitleAr;
  const finalSectionTitleEn =
    sectionTitleEn || legacySectionTitle || sectionTitleAr || DEFAULT_HOME_HIGHLIGHTS.sectionTitleEn;
  const finalSectionSubtitleAr =
    sectionSubtitleAr ||
    legacySectionSubtitle ||
    sectionSubtitleEn ||
    DEFAULT_HOME_HIGHLIGHTS.sectionSubtitleAr;
  const finalSectionSubtitleEn =
    sectionSubtitleEn ||
    legacySectionSubtitle ||
    sectionSubtitleAr ||
    DEFAULT_HOME_HIGHLIGHTS.sectionSubtitleEn;
  const sectionEnabled = typeof o.sectionEnabled === "boolean" ? o.sectionEnabled : true;
  const layoutColumns = o.layoutColumns === 2 || o.layoutColumns === 3 ? o.layoutColumns : 3;
  const blocksRaw = Array.isArray(o.blocks) ? o.blocks : [];
  const blocks = blocksRaw
    .map((b, idx) => normalizeBlock(b, idx))
    .filter(Boolean) as HomeHighlightBlockPayload[];
  blocks.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const participationSectionEnabled =
    typeof o.participationSectionEnabled === "boolean"
      ? o.participationSectionEnabled
      : DEFAULT_HOME_HIGHLIGHTS.participationSectionEnabled !== false;
  const participationBlocksRaw = Array.isArray(o.participationBlocks) ? o.participationBlocks : [];
  const participationBlocks = participationBlocksRaw
    .map((b, idx) => normalizeBlock(b, idx))
    .filter(Boolean) as HomeHighlightBlockPayload[];
  participationBlocks.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const filtersRaw = Array.isArray(o.studentShowcaseFilters) ? o.studentShowcaseFilters : [];
  const itemsRaw = Array.isArray(o.studentShowcaseItems) ? o.studentShowcaseItems : [];
  const studentShowcaseFilters =
    filtersRaw
      .map((v, idx) => {
        if (!v || typeof v !== "object") return null;
        const x = v as Record<string, unknown>;
        const id = asTrimmed(x.id, 120) || `filter-${idx + 1}`;
        const labelAr = asTrimmed(x.labelAr, 200);
        const labelEn = asTrimmed(x.labelEn, 200);
        const sortOrder = toOrder(x.sortOrder, idx + 1);
        const isActive = typeof x.isActive === "boolean" ? x.isActive : true;
        if (!labelAr && !labelEn) return null;
        return { id, labelAr: labelAr || labelEn, labelEn: labelEn || labelAr, sortOrder, isActive };
      })
      .filter(Boolean) as HomeHighlightPayload["studentShowcaseFilters"] || [];
  const studentShowcaseItems =
    itemsRaw
      .map((v, idx) => {
        if (!v || typeof v !== "object") return null;
        const x = v as Record<string, unknown>;
        const id = asTrimmed(x.id, 120) || `item-${idx + 1}`;
        const titleAr = asTrimmed(x.titleAr, 300) || asTrimmed(x.title, 300);
        const titleEn = asTrimmed(x.titleEn, 300) || asTrimmed(x.title, 300);
        const descriptionAr = asTrimmed(x.descriptionAr, 4000) || asTrimmed(x.description, 4000);
        const descriptionEn = asTrimmed(x.descriptionEn, 4000) || asTrimmed(x.description, 4000);
        const imageUrl = sanitizeImageUrl(x.imageUrl) || PUBLIC_IMG.achieveFile;
        const category = asTrimmed(x.category, 120) || "general";
        const badgeAr = asTrimmed(x.badgeAr, 120);
        const badgeEn = asTrimmed(x.badgeEn, 120);
        const sortOrder = toOrder(x.sortOrder, idx + 1);
        const isActive = typeof x.isActive === "boolean" ? x.isActive : true;
        if (!titleAr && !titleEn) return null;
        if (!descriptionAr && !descriptionEn) return null;
        return {
          id,
          titleAr: titleAr || titleEn,
          titleEn: titleEn || titleAr,
          descriptionAr: descriptionAr || descriptionEn,
          descriptionEn: descriptionEn || descriptionAr,
          imageUrl,
          category,
          badgeAr: badgeAr || undefined,
          badgeEn: badgeEn || undefined,
          sortOrder,
          isActive,
        };
      })
      .filter(Boolean) as HomeHighlightPayload["studentShowcaseItems"] || [];
  studentShowcaseFilters.sort((a, b) => a.sortOrder - b.sortOrder);
  studentShowcaseItems.sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    sectionTitleAr: finalSectionTitleAr,
    sectionTitleEn: finalSectionTitleEn,
    sectionSubtitleAr: finalSectionSubtitleAr,
    sectionSubtitleEn: finalSectionSubtitleEn,
    sectionEnabled,
    layoutColumns,
    // Keep legacy unified fields populated for older renderers.
    sectionTitle: finalSectionTitleAr,
    sectionSubtitle: finalSectionSubtitleAr,
    blocks: blocks.length > 0 ? blocks : DEFAULT_HOME_HIGHLIGHTS.blocks,
    participationSectionEnabled,
    participationTitleAr:
      asTrimmed(o.participationTitleAr, 500) ||
      DEFAULT_HOME_HIGHLIGHTS.participationTitleAr ||
      "",
    participationTitleEn:
      asTrimmed(o.participationTitleEn, 500) ||
      DEFAULT_HOME_HIGHLIGHTS.participationTitleEn ||
      "",
    participationSubtitleAr:
      asTrimmed(o.participationSubtitleAr, 2000) ||
      DEFAULT_HOME_HIGHLIGHTS.participationSubtitleAr ||
      "",
    participationSubtitleEn:
      asTrimmed(o.participationSubtitleEn, 2000) ||
      DEFAULT_HOME_HIGHLIGHTS.participationSubtitleEn ||
      "",
    participationBlocks:
      participationBlocks.length > 0
        ? participationBlocks
        : DEFAULT_HOME_HIGHLIGHTS.participationBlocks || [],
    studentShowcaseTitleAr:
      asTrimmed(o.studentShowcaseTitleAr, 500) || DEFAULT_HOME_HIGHLIGHTS.studentShowcaseTitleAr,
    studentShowcaseTitleEn:
      asTrimmed(o.studentShowcaseTitleEn, 500) || DEFAULT_HOME_HIGHLIGHTS.studentShowcaseTitleEn,
    studentShowcaseSubtitleAr:
      asTrimmed(o.studentShowcaseSubtitleAr, 2000) || DEFAULT_HOME_HIGHLIGHTS.studentShowcaseSubtitleAr,
    studentShowcaseSubtitleEn:
      asTrimmed(o.studentShowcaseSubtitleEn, 2000) || DEFAULT_HOME_HIGHLIGHTS.studentShowcaseSubtitleEn,
    studentShowcaseFilters:
      studentShowcaseFilters.length > 0 ? studentShowcaseFilters : DEFAULT_HOME_HIGHLIGHTS.studentShowcaseFilters,
    studentShowcaseItems:
      studentShowcaseItems.length > 0 ? studentShowcaseItems : DEFAULT_HOME_HIGHLIGHTS.studentShowcaseItems,
  };
};

