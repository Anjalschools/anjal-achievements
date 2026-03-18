# منصة تميز الأنجال (AL Anjal Achievements Platform)

منصة رقمية احترافية لتوثيق وتصنيف وإبراز إنجازات طلاب مدارس الأنجال الأهلية.

## المميزات

- واجهة مستخدم حديثة ومتجاوبة بالكامل
- تصميم مستوحى من أفضل المنصات التعليمية
- دعم كامل للغة العربية مع RTL
- هوية بصرية احترافية (Navy Blue + Gold)
- مكونات قابلة لإعادة الاستخدام

## التقنيات المستخدمة

- **Next.js 14** - App Router
- **TypeScript** - للكتابة الآمنة
- **Tailwind CSS** - للتصميم
- **Next Image** - لتحسين الصور

## البنية

```
src/
├── app/
│   ├── layout.tsx          # Layout الرئيسي
│   ├── page.tsx             # الصفحة الرئيسية
│   └── globals.css          # الأنماط العامة
├── components/
│   └── landing/             # مكونات الصفحة الرئيسية
│       ├── TopUtilityBar.tsx
│       ├── MainHeader.tsx
│       ├── HeroSection.tsx
│       ├── QuickActionTiles.tsx
│       ├── RecognitionStrip.tsx
│       ├── TrendingAchievements.tsx
│       ├── CategoryChips.tsx
│       ├── FeaturedShowcase.tsx
│       ├── RankingsGrid.tsx
│       ├── InstitutionalSection.tsx
│       └── SiteFooter.tsx
├── data/
│   └── landing-content.ts   # البيانات الثابتة
└── types/
    └── landing.ts           # أنواع TypeScript
```

## التثبيت والتشغيل

```bash
# تثبيت المتطلبات
npm install

# تشغيل المشروع في وضع التطوير
npm run dev

# بناء المشروع للإنتاج
npm run build

# تشغيل المشروع بعد البناء
npm start
```

## الصور المطلوبة

يجب إضافة الصور التالية في مجلد `public/placeholders/`:

- `trophy-hero.jpg` - كأس ذهبي كبير
- `medal-gold.jpg` - ميدالية ذهبية
- `medal-silver.jpg` - ميدالية فضية
- `medal-bronze.jpg` - ميدالية برونزية

راجع `public/placeholders/README.md` للتفاصيل.

## الأقسام الرئيسية

1. **Top Utility Bar** - شريط روابط سريعة
2. **Main Header** - الهيدر الرئيسي مع البحث
3. **Hero Section** - القسم البطولي
4. **Quick Action Tiles** - إجراءات سريعة
5. **Recognition Strip** - شريط المسابقات
6. **Trending Achievements** - أبرز الإنجازات
7. **Category Chips** - مجالات الإنجاز
8. **Featured Showcase** - عرض مميز
9. **Rankings Grid** - التصنيفات
10. **Institutional Section** - معلومات مؤسسية
11. **Site Footer** - الفوتر الكبير

## التطوير المستقبلي

- إضافة نظام المصادقة
- ربط قاعدة البيانات
- إضافة صفحات تفصيلية
- دعم اللغة الإنجليزية
- نظام البحث المتقدم

## الترخيص

جميع الحقوق محفوظة © 2024 منصة تميز الأنجال
