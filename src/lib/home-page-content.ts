export type HomePageContentPayload = {
  visionAr: string;
  visionEn: string;
  missionAr: string;
  missionEn: string;
  ceremonyTitleAr: string;
  ceremonyTitleEn: string;
  ceremonySubtitleAr: string;
  ceremonySubtitleEn: string;
  ceremonyDescriptionAr: string;
  ceremonyDescriptionEn: string;
  ceremonyInvitationIntroAr: string;
  ceremonyInvitationIntroEn: string;
  ceremonyInvitationDateAr: string;
  ceremonyInvitationDateEn: string;
  ceremonyInvitationVenueAr: string;
  ceremonyInvitationVenueEn: string;
  ceremonyInvitationProgramAr: string;
  ceremonyInvitationProgramEn: string;
  ceremonyRecognitionItemsAr: string[];
  ceremonyRecognitionItemsEn: string[];
  ceremonyInvitationAwardsAr: string;
  ceremonyInvitationAwardsEn: string;
  ceremonyInvitationClosingAr: string;
  ceremonyInvitationClosingEn: string;
};

export const DEFAULT_HOME_PAGE_CONTENT: HomePageContentPayload = {
  visionAr:
    "إبراز تميز طلاب مدارس الأنجال وتوثيق إنجازاتهم في منصة تربوية حديثة تدعم التنافس الإيجابي والتميز الأكاديمي والمهاري.",
  visionEn:
    "Highlighting Al-Anjal students' excellence and documenting their achievements through a modern educational platform that promotes positive competition and academic and skill excellence.",
  missionAr:
    "توفير بيئة رقمية موثوقة لتسجيل الإنجازات المعتمدة، وتحفيز الطلاب على المشاركة، وتعزيز فرص التكريم والظهور المشرف محليًا وعالميًا.",
  missionEn:
    "Providing a trusted digital environment to document approved achievements, motivate student participation, and enhance opportunities for recognition and distinguished presence locally and globally.",
  ceremonyTitleAr: "حفل تكريم الطلاب والطالبات المحققين أعلى الإنجازات",
  ceremonyTitleEn: "Student Achievement Ceremony",
  ceremonySubtitleAr:
    "تدعو مدارس الأنجال الأهلية جميع الطلاب والطالبات إلى رفع إنجازاتهم في المنصة استعدادًا لحفل التكريم.",
  ceremonySubtitleEn:
    "Al-Anjal Private Schools invites all students to submit their achievements on the platform in preparation for the ceremony.",
  ceremonyDescriptionAr:
    "تدعو مدارس الأنجال الأهلية طلابها إلى رفع إنجازاتهم في المنصة استعدادًا لحفل تكريم الإنجازات الطلابية.",
  ceremonyDescriptionEn:
    "Al-Anjal Private Schools invites students to upload their achievements in preparation for the student achievement ceremony.",
  ceremonyInvitationIntroAr: "سيقام حفل التكريم يوم",
  ceremonyInvitationIntroEn: "The ceremony will be held on",
  ceremonyInvitationDateAr: "الأربعاء 3 / 6 / 2026م",
  ceremonyInvitationDateEn: "Wednesday, 3 / 6 / 2026",
  ceremonyInvitationVenueAr: "على مسرح مدارس الأنجال.",
  ceremonyInvitationVenueEn: "at Al-Anjal Schools Theater.",
  ceremonyInvitationProgramAr:
    "ويشمل التكريم: الطلاب المحققين لإنجازات على مستوى المملكة، وعلى مستوى العالم، والحاصلين على 99٪ إلى 100٪ في اختبار القدرات، والمشاركين في مسابقات محلية وعالمية.",
  ceremonyInvitationProgramEn:
    "Recognition includes students with achievements at national and international levels, students scoring 99% to 100% in aptitude tests, and participants in local and global competitions.",
  ceremonyRecognitionItemsAr: [
    "الطلاب المحققين لإنجازات على مستوى المملكة",
    "الطلاب المحققين لإنجازات على مستوى العالم",
    "الطلاب الحاصلين على 99% إلى 100% في اختبار القدرات",
    "الطلاب المشاركين في مسابقات على مستوى المملكة أو على مستوى العالم",
  ],
  ceremonyRecognitionItemsEn: [
    "Students with achievements at the Kingdom level",
    "Students with achievements at the international level",
    "Students scoring 99% to 100% in aptitude tests",
    "Students participating in competitions at the Kingdom or international level",
  ],
  ceremonyInvitationAwardsAr:
    "كما سيتم تقديم 3 جوائز قيمة للطلاب المحققين تنوعًا في الإنجازات والحاصلين على أعلى النقاط.",
  ceremonyInvitationAwardsEn:
    "Three valuable awards will also be presented to students with diverse achievements and top scores.",
  ceremonyInvitationClosingAr: "نرحب بكم في حفل يليق بإنجازات أبنائنا وبناتنا.",
  ceremonyInvitationClosingEn:
    "We look forward to welcoming you to a ceremony worthy of our students' achievements.",
};

const normalizeRecognitionItemValue = (value: string): string =>
  value
    .replace(/^[\s\u2022*•\-–—]+/, "")
    .replace(/\s+/g, " ")
    .trim();

export const normalizeRecognitionItems = (input: string | string[] | undefined): string[] => {
  if (Array.isArray(input)) {
    return input.map((item) => normalizeRecognitionItemValue(String(item || ""))).filter(Boolean);
  }
  if (typeof input !== "string") return [];
  const cleaned = input.trim();
  if (!cleaned) return [];

  const byLine = cleaned
    .split(/\r?\n/)
    .map((line) => normalizeRecognitionItemValue(line))
    .filter(Boolean);
  if (byLine.length >= 2) return byLine;

  const byBullets = cleaned
    .split(/[•*]/)
    .map((item) => normalizeRecognitionItemValue(item))
    .filter(Boolean);
  if (byBullets.length >= 2) return byBullets;

  const byDashes = cleaned
    .split(/\s[-–—]\s/g)
    .map((item) => normalizeRecognitionItemValue(item))
    .filter(Boolean);
  if (byDashes.length >= 2) return byDashes;

  const byComma = cleaned
    .split(/[،,]/)
    .map((item) => normalizeRecognitionItemValue(item))
    .filter(Boolean);
  return byComma.length >= 2 ? byComma : [normalizeRecognitionItemValue(cleaned)].filter(Boolean);
};

export const buildHomePageContentFromSource = (source: unknown): HomePageContentPayload => {
  const root = (source && typeof source === "object" ? source : {}) as Record<string, unknown>;
  const newData = (root.homePageContent &&
  typeof root.homePageContent === "object"
    ? root.homePageContent
    : {}) as Record<string, unknown>;
  const legacy = (root.homeCeremonySection &&
  typeof root.homeCeremonySection === "object"
    ? root.homeCeremonySection
    : {}) as Record<string, unknown>;

  const pick = (key: keyof HomePageContentPayload): string => {
    const v = newData[key];
    return typeof v === "string" ? v : "";
  };
  const pickRecognitionItems = (key: "ceremonyRecognitionItemsAr" | "ceremonyRecognitionItemsEn"): string[] => {
    const v = newData[key];
    if (Array.isArray(v) || typeof v === "string") return normalizeRecognitionItems(v as string | string[]);
    return [];
  };

  const recognitionItemsArPrimary = pickRecognitionItems("ceremonyRecognitionItemsAr");
  const recognitionItemsEnPrimary = pickRecognitionItems("ceremonyRecognitionItemsEn");
  const legacyRecognitionItemsAr = normalizeRecognitionItems(pick("ceremonyInvitationProgramAr"));
  const legacyRecognitionItemsEn = normalizeRecognitionItems(pick("ceremonyInvitationProgramEn"));

  return {
    visionAr: pick("visionAr") || DEFAULT_HOME_PAGE_CONTENT.visionAr,
    visionEn: pick("visionEn") || DEFAULT_HOME_PAGE_CONTENT.visionEn,
    missionAr: pick("missionAr") || DEFAULT_HOME_PAGE_CONTENT.missionAr,
    missionEn: pick("missionEn") || DEFAULT_HOME_PAGE_CONTENT.missionEn,
    ceremonyTitleAr:
      pick("ceremonyTitleAr") ||
      (typeof legacy.titleAr === "string" ? legacy.titleAr : "") ||
      DEFAULT_HOME_PAGE_CONTENT.ceremonyTitleAr,
    ceremonyTitleEn:
      pick("ceremonyTitleEn") ||
      (typeof legacy.titleEn === "string" ? legacy.titleEn : "") ||
      DEFAULT_HOME_PAGE_CONTENT.ceremonyTitleEn,
    ceremonySubtitleAr:
      pick("ceremonySubtitleAr") ||
      (typeof legacy.subtitleAr === "string" ? legacy.subtitleAr : "") ||
      DEFAULT_HOME_PAGE_CONTENT.ceremonySubtitleAr,
    ceremonySubtitleEn:
      pick("ceremonySubtitleEn") ||
      (typeof legacy.subtitleEn === "string" ? legacy.subtitleEn : "") ||
      DEFAULT_HOME_PAGE_CONTENT.ceremonySubtitleEn,
    ceremonyDescriptionAr:
      pick("ceremonyDescriptionAr") ||
      (typeof legacy.descriptionAr === "string" ? legacy.descriptionAr : "") ||
      DEFAULT_HOME_PAGE_CONTENT.ceremonyDescriptionAr,
    ceremonyDescriptionEn:
      pick("ceremonyDescriptionEn") ||
      (typeof legacy.descriptionEn === "string" ? legacy.descriptionEn : "") ||
      DEFAULT_HOME_PAGE_CONTENT.ceremonyDescriptionEn,
    ceremonyInvitationIntroAr: pick("ceremonyInvitationIntroAr") || DEFAULT_HOME_PAGE_CONTENT.ceremonyInvitationIntroAr,
    ceremonyInvitationIntroEn: pick("ceremonyInvitationIntroEn") || DEFAULT_HOME_PAGE_CONTENT.ceremonyInvitationIntroEn,
    ceremonyInvitationDateAr: pick("ceremonyInvitationDateAr") || DEFAULT_HOME_PAGE_CONTENT.ceremonyInvitationDateAr,
    ceremonyInvitationDateEn: pick("ceremonyInvitationDateEn") || DEFAULT_HOME_PAGE_CONTENT.ceremonyInvitationDateEn,
    ceremonyInvitationVenueAr: pick("ceremonyInvitationVenueAr") || DEFAULT_HOME_PAGE_CONTENT.ceremonyInvitationVenueAr,
    ceremonyInvitationVenueEn: pick("ceremonyInvitationVenueEn") || DEFAULT_HOME_PAGE_CONTENT.ceremonyInvitationVenueEn,
    ceremonyInvitationProgramAr: pick("ceremonyInvitationProgramAr") || DEFAULT_HOME_PAGE_CONTENT.ceremonyInvitationProgramAr,
    ceremonyInvitationProgramEn: pick("ceremonyInvitationProgramEn") || DEFAULT_HOME_PAGE_CONTENT.ceremonyInvitationProgramEn,
    ceremonyRecognitionItemsAr:
      recognitionItemsArPrimary.length > 0
        ? recognitionItemsArPrimary
        : legacyRecognitionItemsAr.length > 0
          ? legacyRecognitionItemsAr
          : DEFAULT_HOME_PAGE_CONTENT.ceremonyRecognitionItemsAr,
    ceremonyRecognitionItemsEn:
      recognitionItemsEnPrimary.length > 0
        ? recognitionItemsEnPrimary
        : legacyRecognitionItemsEn.length > 0
          ? legacyRecognitionItemsEn
          : DEFAULT_HOME_PAGE_CONTENT.ceremonyRecognitionItemsEn,
    ceremonyInvitationAwardsAr:
      pick("ceremonyInvitationAwardsAr") ||
      (typeof legacy.invitationTextAr === "string" ? legacy.invitationTextAr : "") ||
      DEFAULT_HOME_PAGE_CONTENT.ceremonyInvitationAwardsAr,
    ceremonyInvitationAwardsEn:
      pick("ceremonyInvitationAwardsEn") ||
      (typeof legacy.invitationTextEn === "string" ? legacy.invitationTextEn : "") ||
      DEFAULT_HOME_PAGE_CONTENT.ceremonyInvitationAwardsEn,
    ceremonyInvitationClosingAr:
      pick("ceremonyInvitationClosingAr") || DEFAULT_HOME_PAGE_CONTENT.ceremonyInvitationClosingAr,
    ceremonyInvitationClosingEn:
      pick("ceremonyInvitationClosingEn") || DEFAULT_HOME_PAGE_CONTENT.ceremonyInvitationClosingEn,
  };
};

