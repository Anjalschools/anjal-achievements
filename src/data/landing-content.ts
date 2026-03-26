import type {
  Achievement,
  Category,
  Recognition,
  Ranking,
  QuickAction,
} from "@/types/landing";

export const platformName = {
  ar: "منصة تميز الأنجال",
  en: "AL Anjal Achievements Platform",
  tagline: "إنجازات تصنع المستقبل",
};

export const platformDescription =
  "منصة رقمية احترافية لتوثيق وتصنيف وإبراز إنجازات طلاب مدارس الأنجال الأهلية، محليًا ووطنيًا وعالميًا، وفق معايير واضحة، وتصنيفات عادلة، وتجربة عرض حديثة تليق بصناعة التميز.";

export const platformMission =
  "نؤمن في مدارس الأنجال الأهلية أن الإنجاز الحقيقي لا يُقاس فقط بالمشاركة، بل بالأثر، والتميز، والاستمرارية، وصناعة الفرص المستقبلية. ومن هنا جاءت منصة تميز الأنجال لتكون الواجهة الرقمية التي توثق النجاحات، وتعرض النماذج الملهمة، وتبرز قيمة الطالب وإنجازه بصورة مؤسسية حديثة.";

export const heroContent = {
  title: "منصة تميز الأنجال",
  subtitle: "إنجازات تصنع المستقبل",
  description:
    "بوابة احترافية لعرض وتوثيق وتصنيف إنجازات طلاب مدارس الأنجال الأهلية، مع تجربة رقمية حديثة تجمع بين الفخر المؤسسي، والهوية التعليمية، وروح المنافسة الراقية.",
  primaryCTA: "استكشف الإنجازات",
  secondaryCTA: "عرض لوحة التميز",
};

export const topAchievements: Achievement[] = [
  {
    id: "1",
    title: "المركز الأول في اختبارات القدرات",
    description: "تحقيق المركز الأول على مستوى المملكة العربية السعودية",
    category: "academic",
    level: "national",
  },
  {
    id: "2",
    title: "المركز الأول في اختبارات التحصيلي",
    description: "تحقيق المركز الأول على مستوى المملكة العربية السعودية",
    category: "academic",
    level: "national",
  },
  {
    id: "3",
    title: "جائزة الموهوبين العالمية",
    description:
      "تحقيق المركز الأول عالميًا في جائزة الموهوبين من مؤسسة حمدان بن راشد",
    category: "academic",
    level: "international",
  },
  {
    id: "4",
    title: "24 درع تميز",
    description:
      "الحصول على 24 درع تميز في نتائج التقويم والاعتماد والتصنيف المدرسي على مدى عامين متتاليين",
    category: "institutional",
    level: "national",
  },
  {
    id: "5",
    title: "2000+ منحة تعليمية",
    description:
      "تقديم أكثر من 2000 منحة تعليمية للطلبة الموهوبين بقيمة إجمالية تجاوزت 23,000,000 ريال",
    category: "institutional",
    level: "national",
  },
];

export const competitions: Recognition[] = [
  { id: "1", name: "معرض آيسف", type: "competition" },
  { id: "2", name: "معرض تايسف بتايوان", type: "competition" },
  { id: "3", name: "معرض آيتكس بماليزيا", type: "competition" },
  { id: "4", name: "معرض جنيف الدولي للاختراعات", type: "competition" },
  { id: "5", name: "معرض ITEX للاختراعات والابتكارات التقنية", type: "competition" },
  { id: "6", name: "الأولمبياد العالمي للروبوت WRO", type: "competition" },
  { id: "7", name: "FIRST LEGO League", type: "competition" },
  { id: "8", name: "مسابقة رواد الأمن السيبراني", type: "competition" },
];

export const recognitions: Recognition[] = [
  { id: "r1", name: "القدرات", type: "test" },
  { id: "r2", name: "التحصيلي", type: "test" },
  { id: "r3", name: "جائزة حمدان", type: "award" },
  ...competitions,
];

export type ParticipationCategoryKey =
  | "all"
  | "national_achievement"
  | "global_achievement"
  | "exhibition"
  | "competition";

export type ParticipationFilter = {
  id: ParticipationCategoryKey;
  labelAr: string;
  labelEn: string;
};

export type ParticipationHighlight = {
  id: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  image: string;
  category: Exclude<ParticipationCategoryKey, "all">;
  badgeAr: string;
  badgeEn: string;
  iconKey: "trophy" | "medal" | "globe" | "award" | "star" | "school";
};

export const participationFilters: ParticipationFilter[] = [
  { id: "all", labelAr: "الكل", labelEn: "All" },
  { id: "national_achievement", labelAr: "إنجاز وطني", labelEn: "National Achievement" },
  { id: "global_achievement", labelAr: "إنجاز عالمي", labelEn: "Global Achievement" },
  { id: "exhibition", labelAr: "معرض", labelEn: "Exhibition" },
  { id: "competition", labelAr: "مسابقة", labelEn: "Competition" },
];

export const participationHighlights: ParticipationHighlight[] = [
  {
    id: "p1",
    titleAr: "المركز الأول في اختبارات القدرات",
    titleEn: "1st Place in Qudurat Exams",
    descriptionAr: "تحقيق المركز الأول في اختبارات القدرات على مستوى المملكة.",
    descriptionEn: "Achieving first place in Qudurat exams at the Kingdom level.",
    image: "/Achive_st.jpg",
    category: "national_achievement",
    badgeAr: "إنجاز وطني",
    badgeEn: "National Achievement",
    iconKey: "medal",
  },
  {
    id: "p2",
    titleAr: "المركز الأول في اختبارات التحصيلي",
    titleEn: "1st Place in Tahsili Exams",
    descriptionAr: "تحقيق المركز الأول في اختبارات التحصيلي على مستوى المملكة.",
    descriptionEn: "Achieving first place in Tahsili exams at the Kingdom level.",
    image: "/Achive_file.jpg",
    category: "national_achievement",
    badgeAr: "إنجاز وطني",
    badgeEn: "National Achievement",
    iconKey: "trophy",
  },
  {
    id: "p3",
    titleAr: "مشاركة عالمية في معرض آيسف",
    titleEn: "Global Participation in ISEF",
    descriptionAr: "تمثيل مشرف لطلاب مدارس الأنجال في معرض آيسف الدولي.",
    descriptionEn: "Distinguished representation of Al-Anjal students at the international ISEF fair.",
    image: "/ISEF.jpg",
    category: "exhibition",
    badgeAr: "معرض",
    badgeEn: "Exhibition",
    iconKey: "globe",
  },
  {
    id: "p4",
    titleAr: "المركز الأول عالميًا في جائزة الموهوبين",
    titleEn: "1st Place Globally in the Gifted Award",
    descriptionAr: "تحقيق المركز الأول عالميًا في جائزة الموهوبين من مؤسسة حمدان بن راشد.",
    descriptionEn: "Achieving first place globally in the Gifted Award from the Hamdan bin Rashid Foundation.",
    image: "/saudi_flag.jpg",
    category: "global_achievement",
    badgeAr: "إنجاز عالمي",
    badgeEn: "Global Achievement",
    iconKey: "award",
  },
  {
    id: "p5",
    titleAr: "مشاركة متميزة في تايسف - تايوان",
    titleEn: "Outstanding Participation in TISEF - Taiwan",
    descriptionAr: "مشاركة طلاب مدارس الأنجال في تايسف بتايوان ضمن مشاريع نوعية.",
    descriptionEn: "Al-Anjal students participated in TISEF Taiwan with high-quality projects.",
    image: "/ISEF.jpg",
    category: "competition",
    badgeAr: "مسابقة",
    badgeEn: "Competition",
    iconKey: "star",
  },
  {
    id: "p6",
    titleAr: "مشاركة في إيتكس - ماليزيا",
    titleEn: "Participation in ITEX - Malaysia",
    descriptionAr: "عرض ابتكارات طلابية في معرض إيتكس الدولي بماليزيا.",
    descriptionEn: "Showcasing student innovations at the international ITEX exhibition in Malaysia.",
    image: "/Achive_file.jpg",
    category: "exhibition",
    badgeAr: "معرض",
    badgeEn: "Exhibition",
    iconKey: "school",
  },
];

export const categories: Category[] = [
  { id: "scientific", name: "العلمي" },
  { id: "religious", name: "الديني" },
  { id: "sports", name: "الرياضي" },
  { id: "artistic", name: "الفني" },
  { id: "musical", name: "الموسيقي" },
  { id: "tech", name: "الحاسب والتقنية والذكاء الاصطناعي" },
  { id: "cultural", name: "الثقافي" },
  { id: "social", name: "الاجتماعي والتطوعي" },
  { id: "research", name: "البحث العلمي" },
  { id: "language", name: "اللغة والاتصال" },
  { id: "excellence", name: "التميز والجوائز" },
];

export const quickActions: QuickAction[] = [
  {
    id: "1",
    title: "ارفع إنجازًا",
    description: "سجّل إنجازك الجديد وشاركه مع المجتمع التعليمي",
    href: "/submit",
  },
  {
    id: "2",
    title: "استكشف لوحة التميز",
    description: "اطّلع على أبرز الإنجازات والطلاب المتميزين",
    href: "/hall-of-fame",
  },
  {
    id: "3",
    title: "اعرض أفضل الطلاب",
    description: "تصفح التصنيفات والترتيبات حسب الفئات والمستويات",
    href: "/rankings",
  },
];

export const trendingAchievements = {
  top: {
    title: "الأكثر تميزًا",
    achievements: [
      {
        id: "t1",
        title: "جائزة حمدان العالمية",
        category: "academic",
      },
      {
        id: "t2",
        title: "معرض جنيف للاختراعات",
        category: "scientific",
      },
    ],
  },
  weekly: {
    title: "الواجهة الأسبوعية",
    achievements: [
      {
        id: "w1",
        title: "إنجاز الأسبوع",
        category: "tech",
      },
      {
        id: "w2",
        title: "طلاب متميزون",
        category: "academic",
      },
    ],
  },
  global: {
    title: "الإنجازات العالمية",
    achievements: [
      {
        id: "g1",
        title: "تمثيل المملكة دوليًا",
        category: "international",
      },
      {
        id: "g2",
        title: "جوائز عالمية",
        category: "awards",
      },
    ],
  },
};

export const rankings: Ranking[] = [
  {
    id: "r1",
    title: "أفضل 10 طلاب – الثانوي",
    level: "high",
    students: ["طالب 1", "طالب 2", "طالب 3"],
  },
  {
    id: "r2",
    title: "أفضل 10 طلاب – المتوسط",
    level: "middle",
    students: ["طالب 1", "طالب 2", "طالب 3"],
  },
  {
    id: "r3",
    title: "أفضل 10 طلاب – الابتدائي",
    level: "elementary",
    students: ["طالب 1", "طالب 2", "طالب 3"],
  },
  {
    id: "r4",
    title: "أفضل مدرسة",
    level: "school",
    school: "مدرسة الأنجال الأهلية",
  },
  {
    id: "r5",
    title: "أفضل إنجاز عالمي",
    level: "achievement",
    achievement: "جائزة حمدان بن راشد العالمية",
  },
];

export const footerLinks = {
  about: {
    title: "عن المنصة",
    links: [
      { name: "من نحن", href: "/about" },
      { name: "رسالتنا", href: "/mission" },
      { name: "رؤيتنا", href: "/vision" },
      { name: "اتصل بنا", href: "/contact" },
    ],
  },
  categories: {
    title: "التصنيفات",
    links: categories.map((cat) => ({
      name: cat.name,
      href: `/categories/${cat.id}`,
    })),
  },
  achievements: {
    title: "الإنجازات",
    links: [
      { name: "جميع الإنجازات", href: "/achievements" },
      { name: "لوحة التميز", href: "/hall-of-fame" },
      { name: "التصنيفات", href: "/rankings" },
      { name: "المسابقات", href: "/competitions" },
    ],
  },
  support: {
    title: "الدعم",
    links: [
      { name: "مركز المساعدة", href: "/help" },
      { name: "الأسئلة الشائعة", href: "/faq" },
      { name: "دليل الاستخدام", href: "/guide" },
      { name: "الإبلاغ عن مشكلة", href: "/report" },
    ],
  },
};
