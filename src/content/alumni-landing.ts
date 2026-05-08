/**
 * Public alumni landing (Phase 1): copy + mock metrics.
 * Replace with API-driven data in a later phase without changing route structure.
 */

export type AlumniLocale = "ar" | "en";

export type AlumniStatCard = { key: string; value: string; labelAr: string; labelEn: string };

export type AlumniFeatured = {
  id: string;
  initials: string;
  nameAr: string;
  nameEn: string;
  year: number;
  universityAr: string;
  universityEn: string;
  roleAr: string;
  roleEn: string;
  /** Tailwind gradient classes for avatar ring */
  accent: string;
};

export type AlumniStory = {
  id: string;
  titleAr: string;
  titleEn: string;
  summaryAr: string;
  summaryEn: string;
  orgAr: string;
  orgEn: string;
};

export type AlumniUniversity = { id: string; nameAr: string; nameEn: string; abbr: string };

export type AlumniField = { id: string; labelAr: string; labelEn: string; icon: "med" | "eng" | "cyber" | "ai" | "law" | "biz" };

export const getAlumniMockStats = (): AlumniStatCard[] => [
  { key: "grads", value: "1,200+", labelAr: "خريج مسجّل", labelEn: "Registered alumni" },
  { key: "uni", value: "85+", labelAr: "جامعة حول العالم", labelEn: "Universities worldwide" },
  { key: "intl", value: "320+", labelAr: "مبتعث ومبتعثة", labelEn: "Scholars abroad" },
  { key: "co", value: "140+", labelAr: "شركة عالمية", labelEn: "Global employers" },
  { key: "intern", value: "90+", labelAr: "فرص تدريب سنويًا", labelEn: "Annual internships" },
];

export const getAlumniFeaturedMock = (): AlumniFeatured[] => [
  {
    id: "1",
    initials: "ن",
    nameAr: "نورة العتيبي",
    nameEn: "Noura Al-Otaibi",
    year: 2022,
    universityAr: "جامعة الملك فهد للبترول والمعادن",
    universityEn: "KFUPM",
    roleAr: "مهندسة برمجيات — أرامكو",
    roleEn: "Software Engineer — Aramco",
    accent: "from-amber-500 to-orange-600",
  },
  {
    id: "2",
    initials: "س",
    nameAr: "سعد الدوسري",
    nameEn: "Saad Al-Dossary",
    year: 2021,
    universityAr: "جامعة الملك عبدالله للعلوم والتقنية",
    universityEn: "KAUST",
    roleAr: "باحث في الذكاء الاصطناعي",
    roleEn: "AI Researcher",
    accent: "from-sky-500 to-indigo-600",
  },
  {
    id: "3",
    initials: "ل",
    nameAr: "لمى الشهري",
    nameEn: "Lama Al-Shehri",
    year: 2023,
    universityAr: "جامعة ستانفورد",
    universityEn: "Stanford University",
    roleAr: "طبيبة مقيمة",
    roleEn: "Resident Physician",
    accent: "from-emerald-500 to-teal-600",
  },
];

export const getAlumniStoriesMock = (): AlumniStory[] => [
  {
    id: "s1",
    titleAr: "من فصل الأنجال إلى مختبرات كاوست",
    titleEn: "From Anjal classrooms to KAUST labs",
    summaryAr: "رحلة بحثية بدأت بشغف العلوم في المدرسة واكتملت بمنح دولية ونشر علمي.",
    summaryEn: "A research journey that began with school-day curiosity and grew into grants and publications.",
    orgAr: "KAUST — علوم الحاسب",
    orgEn: "KAUST — Computer Science",
  },
  {
    id: "s2",
    titleAr: "قيادة مشاريع في وادي السيليكون",
    titleEn: "Leading projects in Silicon Valley",
    summaryAr: "خريجة دوليّة تجمع بين هندسة الأنظمة ورؤية المنتج في شركات عالمية.",
    summaryEn: "An international graduate blending systems engineering with product vision at global firms.",
    orgAr: "شركة تقنية — الولايات المتحدة",
    orgEn: "Technology company — USA",
  },
];

export const getAlumniUniversitiesMock = (): AlumniUniversity[] => [
  { id: "u1", nameAr: "جامعة الملك فهد للبترول والمعادن", nameEn: "King Fahd University of Petroleum & Minerals", abbr: "KFUPM" },
  { id: "u2", nameAr: "جامعة الملك عبدالله للعلوم والتقنية", nameEn: "King Abdullah University of Science and Technology", abbr: "KAUST" },
  { id: "u3", nameAr: "جامعة الملك سعود", nameEn: "King Saud University", abbr: "KSU" },
  { id: "u4", nameAr: "معهد ماساتشوستس للتقنية", nameEn: "Massachusetts Institute of Technology", abbr: "MIT" },
  { id: "u5", nameAr: "جامعة هارفارد", nameEn: "Harvard University", abbr: "Harvard" },
  { id: "u6", nameAr: "جامعة الملك عبدالعزيز", nameEn: "King Abdulaziz University", abbr: "KAU" },
];

export const getAlumniFieldsMock = (): AlumniField[] => [
  { id: "f1", labelAr: "الطب", labelEn: "Medicine", icon: "med" },
  { id: "f2", labelAr: "الهندسة", labelEn: "Engineering", icon: "eng" },
  { id: "f3", labelAr: "الأمن السيبراني", labelEn: "Cybersecurity", icon: "cyber" },
  { id: "f4", labelAr: "الذكاء الاصطناعي", labelEn: "Artificial Intelligence", icon: "ai" },
  { id: "f5", labelAr: "القانون", labelEn: "Law", icon: "law" },
  { id: "f6", labelAr: "ريادة الأعمال", labelEn: "Entrepreneurship", icon: "biz" },
];

export const getAlumniHeroCopy = (locale: AlumniLocale) =>
  locale === "ar"
    ? {
        title: "مجتمع خريجي الأنجال",
        subtitle: "من الأنجال… إلى الجامعات والقيادة والتميّز",
        description:
          "منصة تربط خريجي مدارس الأنجال ببعضهم وبمدرستهم، وتوثّق رحلتهم الأكاديمية والمهنية، وتبني مجتمعًا داعمًا للأجيال القادمة.",
        ctaJoin: "انضم إلى مجتمع الخريجين",
        ctaStories: "قصص النجاح",
        ctaProud: "خريجون نفتخر بهم",
      }
    : {
        title: "Al-Anjal Alumni Community",
        subtitle: "From Anjal… to universities, leadership, and distinction",
        description:
          "A platform that connects Anjal graduates with one another and with their school, documents their academic and professional journeys, and builds a supportive community for the next generation.",
        ctaJoin: "Join the alumni community",
        ctaStories: "Success stories",
        ctaProud: "Alumni we celebrate",
      };

export const getAlumniSectionTitles = (locale: AlumniLocale) =>
  locale === "ar"
    ? {
        stats: "أرقام تعكس مسيرة الخريجين",
        featured: "خريجون نفتخر بهم",
        stories: "قصص النجاح",
        universities: "جامعات يختارها خريجونا",
        fields: "مجالات مهنية يتألق فيها أبناؤنا",
        cooperation: "كيف يساهم الخريجون؟",
        joinTitle: "كن جزءًا من مجتمع خريجي الأنجال",
        joinBody:
          "سجّل اهتمامك للبقاء على اطلاع بفعاليات التواصل، وفرص الإرشاد، ولقاءات الخريجين — دون أي تغيير على حسابك الحالي كطالب.",
        joinButton: "تواصل معنا للانضمام",
        cooperationIntro: "نؤمن بأن خبرة الخريجين استثمار في الطلاب الحاليين.",
      }
    : {
        stats: "Figures that reflect our alumni journey",
        featured: "Alumni we celebrate",
        stories: "Success stories",
        universities: "Universities our graduates choose",
        fields: "Professional fields where our alumni excel",
        cooperation: "How alumni contribute",
        joinTitle: "Be part of the Anjal alumni community",
        joinBody:
          "Register your interest for networking events, mentoring opportunities, and alumni gatherings — with no change to your current student account.",
        joinButton: "Contact us to join",
        cooperationIntro: "We believe alumni experience is an investment in today’s students.",
      };

export const getAlumniCooperationItems = (locale: AlumniLocale) =>
  locale === "ar"
    ? [
        { title: "التدريب", body: "فتح أبواب التدريب التعاوني والصيفي للطلاب." },
        { title: "الإرشاد", body: "جلسات إرشاد أكاديمي ومهني من تجربة حقيقية." },
        { title: "الفرص الوظيفية", body: "تعريف الطلاب بمسارات التوظيف والقطاعات." },
        { title: "التحكيم", body: "دعم المسابقات والمعارض بخبرة الخريجين." },
        { title: "دعم الفعاليات", body: "المشاركة في اليوم المفتوح والحفل واللقاءات." },
      ]
    : [
        { title: "Internships", body: "Co-op and summer pathways for current students." },
        { title: "Mentoring", body: "Academic and career guidance from lived experience." },
        { title: "Careers", body: "Helping students understand hiring landscapes." },
        { title: "Judging", body: "Supporting competitions and showcases." },
        { title: "Events", body: "Open days, ceremonies, and reunions." },
      ];
