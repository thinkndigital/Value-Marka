# Think Digital × Remote Way — Phase 1: Audit & Architecture

> الحالة: **Phase 1 (Research + Audit) + Phase 2 (IA) + تصميم الـ Architecture** — لم يُكتب أي كود للموقع بعد، بحسب القاعدة 66/67.
> كل معلومة غير مؤكدة موسومة بـ `NEEDS SOURCE` أو `NEEDS VERIFY`. لا شيء هنا مُخترع.

---

## 0. قيود البحث (اقرأ هذا أولًا)

| المصدر | ما حدث | الأثر |
|---|---|---|
| `thinkndigital.com` | الوصول المباشر محجوب من بيئة العمل: الـ proxy يرفض الاتصال (`CONNECT 403`) وأداة الجلب تفشل في DNS (`ENOTFOUND`). | لم أستطع قراءة HTML/CSS/الصور/الشعار مباشرة. كل ما في القسم A مأخوذ من **نتائج محركات البحث (فهرسة الصفحات)** — أي ملخصات ومقتطفات، وليس نصًا حرفيًا كاملًا. |
| Remote Way | وصل كملف `remoteway-1.11.0.zip` (الكود المصدري: Express + EJS + CSS + JS). | التحليل في القسم B مبني على **الكود الفعلي** (CSS/JS/templates)، وهو دقيق — لكنه يعكس ما في الكود فقط، وليس بالضرورة موقعًا منشورًا فيه حركة إضافية. |
| Brand assets | لا يوجد شعار أو دليل هوية أو ألوان أو خطوط Think Digital داخل المستودع. | قيم الألوان في القسم E **مؤقتة (PROVISIONAL)** وتحتاج المصدر الحقيقي. |

**المطلوب منك لإغلاق الفجوات:** (1) ملف الشعار (SVG) + أي Brand Guide، (2) تصدير لمحتوى الموقع الحالي (WordPress export / نسخ نصوص الصفحات) أو صلاحية وصول للدومين من البيئة، (3) رابط موقع Remote Way المنشور إن وُجد.

---

## A. Current Website Audit — thinkndigital.com

### A.1 الصفحات المكتشفة (Sitemap الحالي من الفهرسة)

```
thinkndigital.com/
├── /                      Home            (عربي)
├── /about/                About — من نحن  (عربي)
├── /contact/              Contact — تواصل معنا
├── /المقالات/             Articles / Blog
├── /shop/                 المتجر (Shop — منتجات رقمية؛ مفهرس بمنتج نموذجي فقط)
├── /courses/ai/           دورة/تصنيف: الذكاء الاصطناعي
├── /courses/التصميم/      دورة/تصنيف: التصميم
└── /سياسة-الخصوصية/       Privacy Policy (آخر تحديث: نوفمبر 2025)
```

- لم تظهر في الفهرسة صفحات خدمات مستقلة، ولا صفحة FAQ مستقلة، ولا Pricing، ولا Terms، ولا نسخة إنجليزية منفصلة. → `NEEDS VERIFY` من لوحة WordPress.
- نمط العناوين (`Home - Think Digital`) + وجود `/shop/` و`/courses/` يرجّح أن الموقع **WordPress** مع WooCommerce وإضافة LMS. → `NEEDS VERIFY`.

### A.2 المحتوى المؤكد (من مقتطفات الفهرسة)

| العنصر | المحتوى | الثقة |
|---|---|---|
| الاسم | Think Digital / فكر رقمياً | مؤكد |
| التعريف | «فريق من خبراء التسويق الرقمي والتقنية والإنتاج الإبداعي، نعمل على تحويل الأفكار إلى نتائج قابلة للقياس.» | نص مقتبس |
| الرؤية | «أن نكون شريك النجاح الرقمي الأول للشركات الناشئة والمؤسسات الراغبة في النمو.» | نص مقتبس |
| الرسالة | «تقديم حلول رقمية متكاملة تدعم العلامات التجارية في بناء حضور مؤثر وتحقيق نتائج ملموسة.» | نص مقتبس |
| الخدمات (Home) | استراتيجيات التسويق الرقمي · حملات وإعلانات السوشيال ميديا · الهوية البصرية والبراندنج · إنتاج إعلامي يرفع قيمة العلامة · «تصميم مواقع الكترونية و تطبيقات ذكية» | ملخّص + مقتطف |
| SEO | يرد ضمن الخدمات في بعض الملخصات | `NEEDS VERIFY` |
| المنهجية | تبدأ بفهم المشروع وتحليل السوق والمنافسين ← تخطيط ← «فريقنا ينفّذ بإتقان، ويقيس الأداء لحظة بلحظة باستخدام أدوات تحليل متقدمة. نقدّم لك تقارير واضحة، ونستمر في التحسين والتطوير.» (هدف: رفع ROI) | مقتطف |
| قسم الأرقام | عنوانه بمعنى «الأرقام تحكي القصة الأقوى»؛ مؤشرات: نمو نتائج الحملات، ساعات التدريب الرقمي، نسب الرضا في مشاريع الهوية والتصميم. **القيم ظهرت كـ `0 K+` / `1 %`** (عدّادات JS) | القيم = `NEEDS SOURCE` |
| FAQ (سؤال واحد مؤكد) | س: هل الخدمات متاحة في كل الدول؟ ج: «نعم، جميع خدماتنا الرقمية متاحة أونلاين وقابلة للتنفيذ من أي مكان في العالم.» | نص مقتبس |
| التدريب | دورات (AI، التصميم) + ذِكر «آلاف المتدربين» | الأرقام `NEEDS SOURCE` |
| CTA | «احجز استشارة» (حجز استشارة) | ملخّص |
| التواصل | `info@thinkndigital.com` · هاتف `+962 79 918 1518` (أردني) · `privacy@thinkndigital.com` | مؤكد من الفهرسة؛ هل الرقم واتساب؟ `NEEDS VERIFY` |
| Social | توجد روابط في صفحة Contact لكن **لم تُستخرج عناوينها** | `NEEDS SOURCE` |
| الفريق | الفهرسة تذكر «Chiranjit Hazarika — Founder & CEO» في Contact | **مشبوه — على الأغلب نص Demo من القالب. لا يُستخدم.** |
| Clients / Testimonials / Projects / Awards | لم يُعثر على أي منها | `NEEDS SOURCE` — تُخفى الأقسام حتى توفّرها |

### A.3 Brand personality & voice (مستنتج من النصوص المؤكدة)

- **Voice:** عربي فصيح مبسّط، مباشر، بضمير الجمع («نعمل»، «فريقنا»، «نقدّم لك»)، يركّز على **النتائج القابلة للقياس** و**الشراكة**.
- **Positioning الحالي:** وكالة تسويق رقمي متكاملة + تدريب. ذِكر «التقنية» و«تطبيقات ذكية» موجود لكنه ثانوي — وهذا بالضبط ما سنرفعه إلى **Growth + Technology Partner**.
- **Visual language / Colors / Typography / Logo:** غير متاحة من البحث → `NEEDS SOURCE`.

### A.4 KEEP / IMPROVE / REMOVE / ADD

| القرار | العناصر |
|---|---|
| **KEEP** | الاسم الثنائي، الرؤية والرسالة (نصيًا)، الخدمات الست الأساسية، منهجية «نحلل ← نخطط ← ننفذ ← نقيس ونطور»، CTA «احجز استشارة»، الإيميل والهاتف، الـ FAQ المؤكد، المقالات (→ Insights)، سياسة الخصوصية. |
| **IMPROVE** | Hero برسالة positioning أقوى؛ الخدمات من قائمة إلى storytelling؛ قسم الأرقام (يُعرض فقط بقيم حقيقية بدل `0 K+`)؛ Contact من بيانات إلى تجربة (فورم مؤهِّل + حالات)؛ SEO (لا يوجد English، لا Schema ظاهر)؛ هيكل URLs (slugs عربية مشفّرة ← slugs إنجليزية + محتوى عربي). |
| **REMOVE** | محتوى Demo من القالب (الاسم المشبوه، منتج المتجر النموذجي، أرقام `0`). |
| **ADD** | Web Applications، AI & Automation، Integrations، Selected Work، صفحات خدمات مستقلة، نسخة English كاملة، Terms، FAQ page، Prompt Intelligence Tool الداخلي. |
| **DECIDE (سؤال لك)** | **Shop** و**Courses/التدريب**: هما جزء من العرض الحالي، لكن خارج الـ IA المطلوبة. الاقتراح: إبقاؤهما على WordPress الحالي تحت `academy.` / `shop.` subdomain، وربطهما من الـ Footer فقط — أو حذفهما. |

---

## B. Remote Way UX / Motion Audit (من الكود المصدري v1.11.0)

### B.1 ما تم تجاهله بالكامل (قاعدة 6)
Remote Way منصة SaaS لإدارة القوى العاملة. تم استبعاد كل modules التالية من التحليل والتصميم: `talent`, `recruitment`, `payroll`, `attendance`, `workforce`, `employees`, `performance`, `learning`, `onboarding`, صفحات `/jobs`, `/talent`, `/join`, carousels «أحدث الوظائف/اكتشف المواهب»، والـ CRM الداخلي. **صفر features توظيفية ستنتقل.**

### B.2 الحقيقة المهمة عن الحركة
كود Remote Way **مقيّد جدًا حركيًا**: لا parallax، لا pinning، لا scroll-driven animation، لا cursor effects، لا page transitions، لا مكتبة animation. كل الحركة:
- `transition: … .15s` على الأزرار/البطاقات/الحقول (لون، border، shadow، `transform` خفيف على بعض البطاقات).
- `transform` لفتح الـ sidebar على الموبايل `.2s`.
- shimmer للـ skeleton، pulse لزر AI — وكلاهما **معطّل تحت `prefers-reduced-motion`**.
- `scrollBy({behavior:'smooth'})` للـ carousel.

→ **الاستنتاج:** ما نأخذه من Remote Way هو **الإيقاع، البنية، والانضباط** — أما الـ scroll storytelling الذي يطلبه الـ brief (sticky, pinning, parallax, reveals) فهو **تصميمنا نحن**، مبني على مبادئ Remote Way (سرعة، وضوح، ألا تعيق الحركة القراءة). إن كان هناك موقع Remote Way منشور بحركة أغنى من الكود، أرسل الرابط لأحدّث هذا القسم.

### B.3 Patterns قابلة للاستخلاص

| # | Pattern في Remote Way | المبدأ المستخلص | إعادة التفسير في Think Digital |
|---|---|---|---|
| 1 | **Sticky nav** شبه شفاف `color-mix(surface 90%)` + `backdrop-filter: blur(10px)` + hairline border، ارتفاع 68px | Navigation حاضرة دائمًا لكن لا تسرق الانتباه | Header ثابت يتقلّص عند الـ scroll، يختفي عند النزول ويعود عند الصعود |
| 2 | **Hero split** `1.05fr / .95fr`، H1 `clamp(36px, 5.2vw, 64px)` وزن 800، `letter-spacing:-.035em`، **كلمة accent ملوّنة** | رسالة قصيرة + كلمة مفتاحية واحدة ملوّنة | Headline بكلمة متحركة/ملوّنة («فكر» → «ابنِ» → «انمُ») |
| 3 | **Hero panel** بلون العلامة الكامل، radius 24px، بداخله «lifecycle chips» (مراحل مع مرحلة مُبرزة) | تلخيص المنتج بصريًا كرحلة | Panel يعرض رحلة «Strategy → Brand → Build → Automate → Grow» كـ chips/مسار متحرك |
| 4 | **RTL-aware typography**: `[dir=rtl] h1 { letter-spacing:0; line-height:1.2 }` و`text-transform:none` | العربية ليست إنجليزية مقلوبة | قاعدة أساسية في الـ type tokens |
| 5 | **Hairline module grid**: `gap:1px` على خلفية border → شبكة بخطوط 1px داخل إطار مستدير | Grid تحريري نظيف بدون ظلال ثقيلة | شبكة الخدمات + hover يملأ الخلية بلون |
| 6 | **CTA band** أسود، radius 24px، عنوان بجزأين (الثاني بلون accent) | لحظة ختامية عالية التباين | CTA نهائي «لديك فكرة؟ / خلينا نبنيها رقميًا.» |
| 7 | **Scroll-snap carousel** مع أزرار prev/next، **يعكس الاتجاه في RTL** (`flip-rtl` + direction) | Horizontal فقط حيث يخدم، ويحترم RTL | Selected Work على الموبايل |
| 8 | **FAQ** بـ `<details>/<summary>` + أيقونة `plus` | Accordion أصلي accessible بدون JS | نفس الأساس + height animation + تدوير الأيقونة |
| 9 | **Sections كبيانات**: `{ id, type, anchor, hidden, data, design: { media, media_pos: top/bottom/start/end/background/panel } }` قابلة لإعادة الترتيب من Admin | المحتوى منفصل عن الـ UI | نفس الفلسفة في `data/*.ts` + جاهزية CMS |
| 10 | **Stats** بـ `dir="ltr"` على الرقم | الأرقام LTR داخل سياق RTL | نفس القاعدة (عند وجود أرقام حقيقية) |
| 11 | **Theme**: light/dark/system مع `data-theme` | — | اختياري؛ Dark section-level بدل theme toggle (قرار تصميمي) |
| 12 | **Reduced motion** محترم في كل animation | Accessibility أولًا | Motion tokens تنهار إلى `0ms` |

### B.4 Mobile UX في Remote Way
- عند `≤860px` تُخفى روابط الـ nav وأزرار ثانوية (`hide-sm`) — **لا يوجد menu بديل في الـ public header** (نقطة ضعف لن ننقلها).
- Grids تنهار 3 → 2 → 1 عند 900/560px؛ Hero ينهار لعمود عند 960px.
- Touch targets: أزرار 38px — **أقل من 44px الموصى بها**؛ سنرفعها إلى 44–48px.

---

## C. Combined Design Direction

**الفكرة الحاكمة:** *«نفكر. نصمم. نبني. نربط.»* — Think Digital كـ **Digital Growth + Technology Partner**. كل قسم في الصفحة الرئيسية هو فصل في رحلة العميل من الفكرة إلى نمو قابل للقياس.

| المحور | القرار |
|---|---|
| Brand (من Think Digital) | الاسم، الشعار، الألوان، الصوت، الرؤية، الخدمات — **مصدر وحيد**. |
| Interaction (من Remote Way) | Sticky nav زجاجي، hero split بكلمة accent، panel رحلة، hairline grids، CTA band عالي التباين، carousel RTL-aware، أقسام كبيانات. |
| Motion (تصميمنا، بانضباط Remote Way) | Premium · Controlled · Fast · Purposeful. مدد قصيرة (120–480ms)، حركة `transform/opacity` فقط، scroll storytelling في **3 أماكن فقط**: Services (sticky)، How We Work (scroll-driven steps)، Web Apps (product mock يتجمّع). |
| Layout | Editorial: grid 12 عمود، مساحات بيضاء كبيرة، عناوين كبيرة، hairlines بدل الظلال. |
| Arabic-first | `dir="rtl"` افتراضي، typography عربية مضبوطة (line-height أعلى، بلا letter-spacing سالب)، كل الحركات الأفقية معكوسة منطقيًا (`inset-inline`, `translateX(var(--dir))`). |
| ما نتجنبه | gradients بنفسجية، glassmorphism مفرط، أيقونات 3D stock، أرقام مُخترعة، SaaS template feel، أكثر من حركة واحدة لكل عنصر. |

**Hero headline (اقتراح — للمراجعة):**
- AR: «نفكّر رقميًا. **نبني** ما ينمو.» / Supporting: «فريق من خبراء التسويق الرقمي والتقنية والإنتاج الإبداعي، نحوّل الأفكار إلى نتائج قابلة للقياس.» (النص الثاني مقتبس من الموقع الحالي)
- EN: «We think digital. We **build** what grows.»
- CTA: «ابدأ مشروعك» (primary) · «احجز استشارة» (secondary — موجود حاليًا).

---

## D. Sitemap / Information Architecture (الجديد)

```
/{ar|en}
├── /                                Home
├── /services                        كل الخدمات (3 مجموعات)
│   ├── Growth ─────────────────────
│   │   ├── /services/digital-marketing
│   │   ├── /services/social-media
│   │   └── /services/seo
│   ├── Creative ───────────────────
│   │   ├── /services/branding
│   │   └── /services/media-production
│   └── Technology ─────────────────
│       ├── /services/web-development
│       ├── /services/web-applications     (قالب Tech-oriented)
│       └── /services/ai-automation        (+ Integrations كقسم داخلي)
├── /work                            Selected Work  (+ /work/[slug] عند توفر مشاريع)
├── /about
├── /insights                        (يستبدل /المقالات؛ + /insights/[slug])
├── /faq
├── /contact
├── /privacy
├── /terms                           (جديد — النص NEEDS SOURCE/مراجعة قانونية)
└── /admin/prompts/…                 Prompt Intelligence (محمي، noindex)
```

- اللغة في الـ prefix: `/ar/...` (افتراضي، يُعاد التوجيه إليه من `/`) و`/en/...`. Slugs إنجليزية في اللغتين (أفضل للمشاركة والتحليلات)، مع `hreflang` متبادل.
- **Redirects 301** من الروابط القديمة: `/about/`→`/ar/about`، `/contact/`→`/ar/contact`، `/المقالات/`→`/ar/insights`، `/سياسة-الخصوصية/`→`/ar/privacy`. (`/shop`, `/courses/*` حسب قرارك في A.4.)
- **لا Careers / Jobs / Recruitment** في أي مكان.
- Desktop nav: `Logo · الخدمات (mega menu بالمجموعات الثلاث) · الحلول (Web Apps / AI) · أعمالنا · من نحن · المقالات · تواصل` + Language switcher + CTA.

---

## E. Design Tokens

> الألوان والخطوط **PROVISIONAL** حتى تصل هوية Think Digital. البنية (أسماء الأدوار) نهائية؛ القيم تُستبدل في ملف واحد.

```css
/* styles/tokens/color.css — role-based; brand ramp values = NEEDS SOURCE */
:root {
  --brand-500: /* NEEDS SOURCE: Think Digital primary */;
  --brand-600: /* darker step */;
  --accent-500: /* NEEDS SOURCE: secondary/accent */;
  --ink-950: #0B0D10;  --ink-700: #2A2F36;  --ink-500: #5B636E;  --ink-300: #A9B0B9;
  --paper-0: #FFFFFF;  --paper-50: #F6F7F8; --paper-100: #ECEEF0;
  /* semantic */
  --bg: var(--paper-0); --bg-subtle: var(--paper-50); --bg-inverse: var(--ink-950);
  --fg: var(--ink-950); --fg-muted: var(--ink-500); --fg-inverse: var(--paper-0);
  --border: var(--paper-100); --border-strong: var(--ink-300);
  --primary: var(--brand-500); --primary-fg: /* contrast ≥ 4.5:1 checked */;
  --focus-ring: 0 0 0 3px color-mix(in srgb, var(--brand-500) 45%, transparent);
  --success / --warning / --danger / --info + *-soft
}
```

| فئة | Tokens |
|---|---|
| **Typography** | `--font-ar` (مقترح: IBM Plex Sans Arabic أو Alexandria — `NEEDS SOURCE` من الهوية)، `--font-en` (مقترح: Inter Tight/Manrope). Fluid scale: `--text-display: clamp(2.5rem, 6vw, 5.5rem)`، `--text-h1: clamp(2.25rem,4.5vw,4rem)`، `--text-h2: clamp(1.75rem,3vw,2.75rem)`، `--text-h3: 1.5rem`، `--text-body-lg: 1.125rem`، `--text-body: 1rem`، `--text-sm: .875rem`، `--text-xs: .75rem`. `--leading-tight-en:1.05` / `--leading-tight-ar:1.25`، `--tracking-display-en:-.035em` / `--tracking-display-ar:0`. |
| **Spacing** | 4px base: `0,1,2,3,4,5,6,8,10,12,16,20,24,32` (×4px) — يطابق Tailwind الافتراضي. Section rhythm: `--section-y: clamp(4rem, 10vw, 9rem)`. |
| **Grid / Container** | 12 col، `--gutter: clamp(1rem, 3vw, 2rem)`، `--container: 1280px`، `--container-wide: 1440px`، `--container-prose: 72ch`، side padding موبايل 16px (320px → 288px محتوى). |
| **Radius** | `--radius-xs:6px` (inputs) · `--radius-sm:10px` · `--radius-md:16px` (cards) · `--radius-lg:24px` (panels/CTA band، من Remote Way) · `--radius-pill:999px` (buttons). |
| **Shadows** | قليلة: `--shadow-sm`, `--shadow-md`, `--shadow-overlay` (للـ modals/menus فقط). الفصل البصري بالـ hairlines أولًا. |
| **Z-index** | `--z-base:0 · --z-sticky:30 · --z-header:40 · --z-overlay:60 · --z-modal:70 · --z-toast:80` |
| **Breakpoints** | `sm 480 · md 768 · lg 1024 · xl 1280 · 2xl 1440` + اختبار 320/375/390/430/1920. |
| **Touch** | `--hit-min: 44px` (كل الأزرار/الروابط التفاعلية على الموبايل). |

التنفيذ: Tailwind v4 `@theme` يقرأ هذه الـ CSS variables (مثل نمط `src/app/globals.css` الحالي) — مصدر واحد للـ tokens يخدم الموقع والـ Dashboard.

---

## F. Component Architecture

```
src/
├── app/[locale]/(site)/…            صفحات الموقع (Server Components افتراضيًا)
├── app/[locale]/admin/prompts/…     Prompt Intelligence (محمي)
├── app/api/contact/route.ts         (أو Server Action) → submitContactForm()
├── components/
│   ├── ui/          Button, IconButton, Link, Input, Textarea, Select, Checkbox, Field (label+hint+error),
│   │                Badge, Tag, Card, Tooltip, Modal/Dialog, Accordion, Tabs, Toast, Skeleton, EmptyState
│   ├── navigation/  SiteHeader, MegaMenu, MobileMenu, LanguageSwitcher, SkipLink, Breadcrumbs, SiteFooter, SocialLinks
│   ├── sections/    Hero, TrustBar, ServicesExplorer, ServicesStory, WebAppsShowcase, ProcessScroll,
│   │                SelectedWork, CreativeShowcase, MarketingSection, AutomationSection, Testimonials,
│   │                FaqSection, CtaBand, SectionHeader, StatList (يُعرض فقط مع بيانات حقيقية)
│   ├── services/    ServiceCard, ServiceHero, ProblemSolution, DeliverablesList, UseCaseGrid, IntegrationCloud
│   ├── portfolio/   ProjectCard, ProjectMedia, ProjectMeta
│   ├── forms/       ContactForm, FormStatus (loading/success/error, aria-live)
│   ├── motion/      Reveal, Stagger, SplitText, Parallax, StickyScene, Marquee, MotionConfig (reduced-motion)
│   └── prompts/     (Dashboard) StatCard, PromptTable, FilterBar, SearchBox, PromptDetail, DiffView, NewBadge, ChangeCard
├── lib/
│   ├── animations/  presets.ts (variants) + tokens.ts
│   ├── seo/         metadata.ts (buildMetadata), jsonld.ts (Organization, Service, FAQPage, BreadcrumbList)
│   ├── integrations/email/  EmailProvider interface + resend.ts / sendgrid.ts / smtp.ts adapters
│   ├── prompts/     adapters/, analysis/, diff.ts, search.ts   (server-only)
│   └── utils/
├── data/            site.ts, navigation.ts, services.ts, projects.ts, testimonials.ts, faq.ts, social.ts
├── messages/        ar.json, en.json  (UI strings فقط — المحتوى في data/)
└── styles/tokens/   color.css, type.css, space.css, motion.css  → globals.css
```

قواعد: Server Components افتراضيًا؛ `"use client"` فقط للمكوّنات التفاعلية (menu, accordion, form, motion wrappers). لا Component مكرر — صفحات الخدمات كلها `ServicePageTemplate` واحد يأخذ `service` من `data/services.ts` مع `variant: 'standard' | 'technology'`.

---

## G. Animation Architecture

```css
/* styles/tokens/motion.css */
:root {
  --duration-instant: 80ms;  --duration-fast: 160ms;  --duration-normal: 280ms;
  --duration-slow: 480ms;    --duration-slower: 720ms;
  --ease-standard:   cubic-bezier(.2, 0, 0, 1);
  --ease-emphasized: cubic-bezier(.3, 0, 0, 1.0);
  --ease-enter:      cubic-bezier(0, 0, .2, 1);
  --ease-exit:       cubic-bezier(.4, 0, 1, 1);
  --stagger: 60ms;  --reveal-distance: 24px;
  --dir: 1;                               /* LTR */
}
[dir="rtl"] { --dir: -1; }               /* كل حركة أفقية = calc(var(--dir) * X) */
@media (prefers-reduced-motion: reduce) {
  :root { --duration-fast:0ms; --duration-normal:0ms; --duration-slow:0ms; --duration-slower:0ms; --reveal-distance:0px; }
}
```

| Preset | الاستخدام | التقنية |
|---|---|---|
| `fade`, `fadeUp`, `fadeDown`, `scale` | دخول العناصر | CSS + `IntersectionObserver` (مكوّن `<Reveal>`)، أو `animation-timeline: view()` حيث مدعوم |
| `slide` (RTL-aware) | menus، panels | `translateX(calc(var(--dir) * …))` |
| `reveal` (clip-path) | صور المشاريع، hero media | `clip-path: inset()` |
| `stagger` / `splitText` | عناوين الـ Hero (كلمات، **ليس حروف** — العربية متصلة) | per-word spans + `--i` × `--stagger` |
| `parallax` | Hero/Creative فقط، ≤ 8% إزاحة؛ **معطّل < 768px** | scroll-linked transform (rAF واحد مشترك) |
| `stickyScene` | Services Story + How We Work | `position: sticky` + progress (0→1) |
| `marquee` | Trust logos (عند توفرها) | CSS keyframes، يتوقف عند hover/focus/reduced-motion |

**المكتبة:** `motion` (Framer Motion) **فقط** للمكوّنات التي تحتاج layout/presence animations (MobileMenu، Accordion height، ServicesExplorer)، تُحمّل عبر client components صغيرة. البقية CSS خالص. الهدف: JS للحركة < ~35KB gz، و`transform/opacity` فقط (60fps).

**قواعد:** حركة واحدة لكل عنصر · لا حركة تؤخر قراءة النص أكثر من 480ms · Mobile: لا parallax، لا horizontal scroll-jacking، reveals أقصر.

---

## H. Content Model (CMS-ready)

```ts
type Locale = 'ar' | 'en';
type L10n<T = string> = Record<Locale, T>;
type Sourced<T> = { value: T; source: string /* URL أو 'client-provided' */ } | { value: null; todo: 'NEEDS SOURCE' };

interface Service {
  slug: string; group: 'growth' | 'creative' | 'technology'; order: number;
  variant: 'standard' | 'technology';
  title: L10n; short: L10n; icon: string;
  hero: { headline: L10n; lead: L10n };
  problem: L10n; solution: L10n;
  features: { title: L10n; text: L10n }[];
  process?: ProcessStep[]; benefits: L10n[]; deliverables: L10n[];
  useCases?: { title: L10n; text: L10n }[];       // technology variant
  integrations?: string[]; security?: L10n[];     // technology variant
  faq: FaqItem[]; relatedWork: string[] /* project slugs */;
  seo: { title: L10n; description: L10n };
}
interface Project  { slug; client: Sourced<string>; industry: L10n; services: string[]; summary: L10n;
                     result?: Sourced<L10n>; media: Media[]; published: boolean }
interface Testimonial { quote: L10n; author: Sourced<string>; role?: L10n; company?: string; published: boolean }
interface FaqItem  { q: L10n; a: L10n; category?: string; source: string }
interface Stat     { label: L10n; value: Sourced<string> }   // يُخفى القسم إذا أي value = null
interface SiteConfig { name: L10n; email; phone: Sourced<string>; whatsapp: Sourced<string>;
                       social: { network: string; url: string }[] /* حقيقية فقط */ }
```

- طبقة `lib/content/` بواجهة `ContentRepository` (`getServices(locale)`, `getProjects()`…) — التطبيق الأول يقرأ من `data/*.ts`، لاحقًا adapter لـ Sanity/Strapi/WordPress بدون لمس الـ UI.
- **قاعدة البناء:** أي `Sourced` بقيمة `null` لا يُعرض للزائر أبدًا، ويظهر في تقرير build/dev كتحذير `NEEDS SOURCE`.

---

## I. Prompt Collector / Prompt Intelligence Architecture

### I.1 المسار والحماية
`/[locale]/admin/prompts` — `Overview · Sources · Changes · Prompts · Categories · Versions · Settings`. محمي بجلسة مدير (server-side)، `noindex`، كل المفاتيح في env على الخادم فقط (`server-only`).

### I.2 Data model (Postgres + Prisma)

```
Prompt          id, slug, title, categoryId, sourceId?, sourceUrl?, description, whyItWorks,
                expectedOutput, variables(JSON: name/description/example), tags[], status(draft|active|archived),
                currentVersionId, createdAt, updatedAt, isNew (computed: createdAt > now-14d)
PromptVersion   id, promptId, version(int), body, changelog, improvementReason, authorId, createdAt
                → Diff يُحسب عند العرض بين أي نسختين (line diff)
PromptRelation  promptId, relatedPromptId
Attachment      id, promptId, kind(screenshot|reference), url, caption
Category        id, slug, name(L10n)   — seed: UI, UX, Motion, Development, React, Next.js, Tailwind, Branding,
                Copywriting, SEO, Marketing, AI, Claude, ChatGPT, Images, Research, Architecture, QA,
                Accessibility, Performance
Source          id, kind(website|github|notion|gdocs|rss|sitemap|manual|extension|api), url, label,
                schedule?, lastFetchedAt, status
Snapshot        id, sourceId, fetchedAt, contentHash, extracted(JSON: pages, sections, nav, ctas, images, components)
Change          id, sourceId, fromSnapshotId, toSnapshotId, type(new_page|new_section|new_service|text|cta|
                component|animation|image|nav_item|feature), title, previous, next, whyItMatters,
                uxImpact, designImpact, suggestedImplementation, suggestedPrompt, status(new|reviewed|dismissed),
                detectedAt
GeneratedPack   id, changeId, description, uxExplanation, designExplanation, technicalIdea,
                claudePrompt, cursorPrompt, developerTask, qaChecklist(JSON)
```

> ملاحظة: Value Marka يستخدم Postgres + Prisma أصلًا؛ إن بُني الموقع في مشروع منفصل، نختار SQLite/Postgres حسب الاستضافة (سؤال في القسم K).

### I.3 Pipeline

```
SourceAdapter.fetch(source) ─► Snapshot (normalized + hash)
        │ (hash unchanged → stop)
        ▼
detectChanges(prev, next)          ← deterministic structural diff (pages/headings/nav/CTAs/images/sections)
        ▼
AnalysisProvider (optional AI)      analyzeContent · extractDesignPatterns · extractPrompts ·
        │                           generateExplanation · generateImplementationPrompt
        ▼
Change records (+ GeneratedPack)  ─► Dashboard «NEW — New Section / New Page / …»
```

```ts
interface SourceAdapter { kind: SourceKind; fetch(src: Source): Promise<RawSnapshot>; }
// تُبنى فعليًا في Phase 9: ManualAdapter, WebsiteAdapter (fetch + HTML parse), SitemapAdapter, RSSAdapter.
// GitHubAdapter / NotionAdapter / GoogleDocsAdapter: interfaces + "not configured" state فقط — لا integrations وهمية.
interface AnalysisProvider { analyzeContent(); extractDesignPatterns(); extractPrompts();
                             generateExplanation(change); generateImplementationPrompt(change); }
// NullAnalysisProvider (بدون AI: يملأ الحقول بقوالب من الـ diff) + ClaudeAnalysisProvider (server-side، ANTHROPIC_API_KEY).
```

- **Search:** Postgres full-text (`tsvector` لـ title/description/body/tags، مع `simple` config ليعمل للعربية) + filters (category, source, tag, status, date range, technology/component عبر tags). Debounced، URL-synced filters.
- **States:** كل شاشة لها Loading/Empty/Error/Success؛ fetch المصادر يعمل كـ background job (لا يحجب الطلب).
- **أمان:** WebsiteAdapter يمنع SSRF (رفض IPs خاصة/localhost، timeouts، حد حجم)، يحترم robots.txt.

---

## J. Implementation Roadmap

| Phase | المخرجات | معيار الإنجاز |
|---|---|---|
| **1–2** ✅ (هذا المستند) | Audit, IA, architecture | موافقتك + إجابات القسم K |
| **3** Design System | tokens (CSS vars → Tailwind `@theme`)، fonts عبر `next/font`، `components/ui/*`، صفحة `/style-guide` | كل primitive بحالات hover/focus/disabled/error، RTL+LTR، AA contrast |
| **4** Motion System | `motion.css`، `<Reveal>`, `<Stagger>`, `<SplitText>`, `<StickyScene>`, `<Parallax>`، reduced-motion | demo في style-guide، 60fps، صفر حركة تحت reduce |
| **5** Landing Page | Header/MobileMenu/Footer + 12 قسمًا (Hero → Contact CTA)، الأقسام بلا بيانات حقيقية مخفية | Lighthouse ≥ 95 perf/a11y/SEO على الموبايل |
| **6** Service Pages | `ServicePageTemplate` (standard + technology)، 8 صفحات + `/services` | محتوى من `data/services.ts`، Service + FAQ schema |
| **7** Work | `/work` + `ProjectCard` + حالة «قريبًا» حتى توفر مشاريع حقيقية | لا مشاريع مُخترعة |
| **8** Contact + Integrations | `submitContactForm()` (Zod، honeypot + time-trap + rate limit)، `EmailProvider` (Resend/SendGrid/SMTP عبر env)، Social links حقيقية | كل الحالات + aria-live + اختبارات |
| **9** Prompt Intelligence | Schema + CRUD + versions/diff + search/filters + Sources/Snapshots/Changes + Manual/Website/Sitemap/RSS adapters + Null/Claude analysis | اختبارات للـ diff والـ adapters، لا أسرار في الـ client bundle |
| **10** SEO/A11y/Perf | metadata لكل صفحة، hreflang، sitemap/robots، JSON-LD، redirects 301، AVIF/WebP | تدقيق axe + Lighthouse |
| **11** QA + Polish | قائمة QA في القاعدة 65 على 9 مقاسات | صفر console/hydration/TS errors |

---

## K. قرارات أحتاجها منك قبل Phase 3

1. **مكان المشروع:** هذا المستودع (`value-marka`) هو **منصة Marketplace مختلفة** (Value Marka: Prisma, Stripe, sellers…). بناء موقع Think Digital داخله يخلط منتجين. الخيارات:
   - (أ) **مستودع جديد مستقل** `think-digital-web` — *موصى به*؛ نفس الـ stack (Next.js 16 + Tailwind v4 + next-intl) مع نقل الأنماط الجيدة الموجودة هنا.
   - (ب) تطبيق مستقل داخل هذا المستودع تحت `apps/think-digital/`.
   - (ج) استبدال Value Marka بالكامل في هذا المستودع (غير موصى به).
2. **Brand assets:** الشعار (SVG)، الألوان، الخطوط — أو أؤكد اقتراحًا مؤقتًا؟
3. **Shop + Courses/التدريب:** إبقاء على WordPress (subdomain) / دمج كقسم «Academy» / حذف؟
4. **المحتوى الحقيقي الناقص:** روابط Social، هل الرقم واتساب، أرقام قسم «الأرقام تحكي»، العملاء، المشاريع، الشهادات، أسئلة FAQ الكاملة.
5. **Remote Way:** هل يوجد موقع منشور (رابط) بحركة أغنى من الكود المرفق؟
6. **Email provider** المفضّل (Resend / SendGrid / SMTP) و**الاستضافة** (Value Marka يستهدف Google Cloud Run — نفس الشيء؟).

---

### Sources (فهرسة البحث المستخدمة في القسم A)
- https://thinkndigital.com/
- https://thinkndigital.com/about/
- https://thinkndigital.com/contact/
- https://thinkndigital.com/shop/
- https://thinkndigital.com/courses/ai/
- https://thinkndigital.com/courses/%D8%A7%D9%84%D8%AA%D8%B5%D9%85%D9%8A%D9%85/
- https://thinkndigital.com/%D8%A7%D9%84%D9%85%D9%82%D8%A7%D9%84%D8%A7%D8%AA/
- https://thinkndigital.com/%D8%B3%D9%8A%D8%A7%D8%B3%D8%A9-%D8%A7%D9%84%D8%AE%D8%B5%D9%88%D8%B5%D9%8A%D8%A9/
- Remote Way: `remoteway-1.11.0.zip` — `public/css/app.css`, `public/js/app.js`, `src/views/layouts/public.ejs`, `src/views/partials/site/*.ejs`, `src/modules/site/content.service.js`
