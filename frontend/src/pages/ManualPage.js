import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Printer } from "lucide-react";
import { Button } from "../components/ui/button";

// =======================================================================
// USER MANUAL / دليل المستخدم
// Single-page bilingual manual (Arabic + English) styled for screen AND
// for paper/PDF (via window.print). Includes a colored cover, TOC, and
// detailed step-by-step training for every portal in the system.
// =======================================================================

const SECTIONS = [
  { id: "intro", ar: "مقدمة عن النظام", en: "System Overview" },
  { id: "login", ar: "تسجيل الدخول والمستخدمون", en: "Login & Users" },
  { id: "departments", ar: "الإدارات والبوابات", en: "Departments & Portals" },
  { id: "membership", ar: "بوابة العضوية", en: "Membership Portal" },
  { id: "import", ar: "استيراد ملفات Excel", en: "Excel Import" },
  { id: "subscriptions", ar: "بوابة الاشتراكات", en: "Subscriptions Portal" },
  { id: "settlements", ar: "تسويات المستحقات", en: "Dues Settlements" },
  { id: "committees", ar: "مستحقات اللجان", en: "Committees Dues" },
  { id: "aid", ar: "بوابة الإعانات", en: "Aid Portal" },
  { id: "letters", ar: "بوابة الخطابات", en: "Letters Portal" },
  { id: "admin", ar: "صفحة الأدمن", en: "Admin Page" },
  { id: "dedup", ar: "توحيد أسماء اللجان", en: "Committee Name De-dup" },
  { id: "deploy", ar: "التشغيل والتثبيت المحلي", en: "Local Deployment" },
  { id: "faq", ar: "الأسئلة الشائعة وحل المشاكل", en: "FAQ & Troubleshooting" },
];

export default function ManualPage() {
  const [lang, setLang] = useState("ar");
  useEffect(() => { document.title = lang === "ar" ? "كتيب الإرشادات" : "User Manual"; }, [lang]);

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="min-h-screen bg-slate-50 text-slate-900" data-testid="manual-page">
      {/* Top toolbar (hidden in print) */}
      <div className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/departments" className="flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-[#0f3a73]" data-testid="manual-back-btn">
            <ArrowRight className="h-4 w-4" /> {lang === "ar" ? "العودة" : "Back"}
          </Link>
          <div className="flex items-center gap-2">
            <Button size="sm" variant={lang === "ar" ? "default" : "outline"} onClick={() => setLang("ar")} data-testid="manual-lang-ar" className={lang === "ar" ? "bg-[#0f3a73]" : ""}>العربية</Button>
            <Button size="sm" variant={lang === "en" ? "default" : "outline"} onClick={() => setLang("en")} data-testid="manual-lang-en" className={lang === "en" ? "bg-[#0f3a73]" : ""}>English</Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => window.print()} data-testid="manual-print-btn">
              <Printer className="h-4 w-4" /> {lang === "ar" ? "طباعة / حفظ PDF" : "Print / Save PDF"}
            </Button>
          </div>
        </div>
      </div>

      <main className="manual-body mx-auto max-w-5xl px-6 py-10 leading-relaxed">
        {/* ===== Cover ===== */}
        <section className="manual-cover relative mb-12 overflow-hidden rounded-3xl border border-[#0f3a73]/20 bg-gradient-to-br from-[#0f3a73] via-[#1a4d8f] to-[#0f3a73] p-12 text-center text-white shadow-2xl" data-testid="manual-cover">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 30% 30%, white 0, transparent 50%), radial-gradient(circle at 70% 70%, white 0, transparent 50%)" }} />
          <div className="relative">
            <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-3xl bg-white/15 backdrop-blur">
              <BookOpen className="h-10 w-10 text-amber-300" />
            </div>
            <h1 className="mb-3 text-4xl font-extrabold tracking-tight">{lang === "ar" ? "كتيب إرشادات المستخدم" : "User Guide & Training Manual"}</h1>
            <h2 className="mb-8 text-xl text-amber-200">{lang === "ar" ? "نظام الأرشيف الإلكتروني — مشروع التكافل الاجتماعي" : "Electronic Archive — Social Solidarity Project"}</h2>
            <div className="mx-auto h-px w-32 bg-amber-300/60" />
            <p className="mt-8 text-sm text-white/80">{lang === "ar" ? "إصدار 2026 — دليل عملي خطوة بخطوة" : "Edition 2026 — Step-by-Step Practical Guide"}</p>
            <p className="mt-2 text-xs text-white/60">{lang === "ar" ? "جميع الحقوق محفوظة — Youssef Abdel Ghane Ahmed" : "© All Rights Reserved — Youssef Abdel Ghane Ahmed"}</p>
          </div>
        </section>

        {/* ===== TOC ===== */}
        <section className="page-break mb-12 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm" data-testid="manual-toc">
          <h2 className="mb-6 border-b-2 border-amber-500 pb-2 text-2xl font-extrabold text-slate-950">{lang === "ar" ? "فهرس المحتويات" : "Table of Contents"}</h2>
          <ol className="grid gap-2 text-base md:grid-cols-2">
            {SECTIONS.map((s, i) => (
              <li key={s.id} className="flex items-baseline gap-2">
                <span className="font-bold tabular-nums text-[#0f3a73]">{String(i + 1).padStart(2, "0")}.</span>
                <a href={`#${s.id}`} className="flex-1 border-b border-dashed border-slate-200 pb-1 text-slate-800 hover:text-[#0f3a73]" data-testid={`toc-${s.id}`}>
                  {lang === "ar" ? s.ar : s.en}
                </a>
              </li>
            ))}
          </ol>
        </section>

        {/* ===== Sections ===== */}
        {lang === "ar" ? <ArabicContent /> : <EnglishContent />}

        <footer className="mt-16 border-t-2 border-slate-200 pt-6 text-center text-xs text-slate-500" data-testid="manual-footer">
          <p>{lang === "ar" ? "نهاية الكتيب — © Youssef Abdel Ghane Ahmed " : "End of Manual — © Youssef Abdel Ghane Ahmed "}{new Date().getFullYear()}</p>
        </footer>
      </main>

      <style>{`
        @page { size: A4 portrait; margin: 16mm 14mm; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .manual-body { max-width: 100% !important; padding: 0 !important; }
          .page-break { page-break-before: always; }
          .manual-cover { page-break-after: always; }
          section, h1, h2, h3 { page-break-inside: avoid; }
          .manual-body * { color: #111827 !important; }
          .manual-cover, .manual-cover * { color: white !important; }
          .manual-cover { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          a { color: #0f3a73 !important; text-decoration: none; }
        }
        .manual-body h2 { font-size: 1.5rem; font-weight: 800; margin-top: 2.5rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid #f59e0b; color: #0f3a73; }
        .manual-body h3 { font-size: 1.15rem; font-weight: 700; margin-top: 1.75rem; margin-bottom: 0.75rem; color: #1e293b; }
        .manual-body p { margin-bottom: 0.75rem; }
        .manual-body ol, .manual-body ul { padding-inline-start: 1.5rem; margin-bottom: 1rem; }
        .manual-body li { margin-bottom: 0.4rem; }
        .manual-body .callout { border-inline-start: 4px solid #0f3a73; background: #eff6ff; padding: 0.75rem 1rem; border-radius: 0.5rem; margin: 1rem 0; }
        .manual-body .warn { border-inline-start: 4px solid #f59e0b; background: #fffbeb; padding: 0.75rem 1rem; border-radius: 0.5rem; margin: 1rem 0; }
        .manual-body code { background: #f1f5f9; padding: 0 0.35rem; border-radius: 0.25rem; font-family: ui-monospace, monospace; font-size: 0.85em; }
      `}</style>
    </div>
  );
}

/* ===========================================================
   Arabic content (RTL)
   =========================================================== */
function ArabicContent() {
  return (
    <>
      <section id="intro" className="page-break" data-testid="sec-intro">
        <h2>1. مقدمة عن النظام</h2>
        <p><strong>نظام الأرشيف الإلكتروني</strong> هو منصّة متكاملة لإدارة بيانات أعضاء مشروع التكافل الاجتماعي وعملياته المالية. يقدّم النظام:</p>
        <ul>
          <li>إدارة شاملة لبيانات الأعضاء (إضافة، تعديل، حذف، استيراد دفعي عبر Excel).</li>
          <li>تسجيل الاشتراكات والتسويات وضمان عدم تكرار أرقام الدفع.</li>
          <li>توليد خطابات المطالبة الموجّهة للجان النقابية تلقائياً.</li>
          <li>متابعة الإعانات المعلقة والمصروفة مع ربطها بالعضو.</li>
          <li>تقارير وإحصائيات لحظية (إجمالي، نشط، معاش، متوفي، إلخ).</li>
          <li>طباعة A4 احترافية لكل مستندات النظام.</li>
        </ul>
        <div className="callout"><strong>الهدف:</strong> توفير حلّ مكتبي بصيف محلي (LAN) لا يحتاج إنترنت بعد التثبيت.</div>
      </section>

      <section id="login" className="page-break" data-testid="sec-login">
        <h2>2. تسجيل الدخول والمستخدمون</h2>
        <h3>2.1 الحساب الافتراضي</h3>
        <p>تم إنشاء حساب مدير افتراضي عند أول تشغيل للنظام. للحصول على بيانات الدخول الأولية، يرجى التواصل مع الدعم الفني أو مراجعة دليل التثبيت المحلي لديك. <strong>يُنصح بشدة تغيير كلمة المرور فور أول تسجيل دخول.</strong></p>
        <h3>2.2 إنشاء مستخدمين جدد</h3>
        <ol>
          <li>سجّل دخول كـ <code>admin</code>.</li>
          <li>اذهب إلى <strong>صفحة الأدمن</strong> ← <strong>إدارة المستخدمين</strong>.</li>
          <li>اضغط زر <strong>"إضافة مستخدم"</strong>.</li>
          <li>املأ: الاسم، اسم المستخدم، كلمة المرور، الدور (super_admin / admin / user)، البوابات المسموح بها.</li>
          <li>اضغط <strong>حفظ</strong>.</li>
        </ol>
        <h3>2.3 الأدوار والصلاحيات</h3>
        <ul>
          <li><strong>super_admin</strong>: صلاحيات كاملة + رؤية بصمة المبرمج.</li>
          <li><strong>admin</strong>: إدارة الأعضاء + المستخدمين + التصحيح الجماعي.</li>
          <li><strong>user</strong>: يقتصر على البوابات المسموح بها له.</li>
        </ul>
      </section>

      <section id="departments" className="page-break" data-testid="sec-departments">
        <h2>3. الإدارات والبوابات</h2>
        <p>بعد تسجيل الدخول تظهر شاشة <strong>الإدارات</strong>. اختر إدارة (مثال: مشروع التكافل الاجتماعي) للدخول إلى لوحة المشروع. لوحة المشروع تحتوي على بوابات:</p>
        <ul>
          <li>بوابة العضوية</li>
          <li>بوابة الاشتراكات</li>
          <li>بوابة الإعانات (معلقة + مصروفة + تقرير)</li>
          <li>بوابة الخطابات والمراسلات</li>
          <li>بوابة المالية (الاشتراكات + التسويات + مستحقات اللجان)</li>
          <li>أرشيف الفئات</li>
        </ul>
      </section>

      <section id="membership" className="page-break" data-testid="sec-membership">
        <h2>4. بوابة العضوية</h2>
        <h3>4.1 إضافة عضو يدوياً</h3>
        <ol>
          <li>اضغط زر <strong>"إضافة عضو جديد"</strong>.</li>
          <li>املأ الحقول: الاسم الرباعي، الرقم القومي، رقم العضوية، المحافظة، اللجنة، تاريخ الميلاد، تاريخ الاشتراك، العنوان، الهاتف.</li>
          <li>اختر الحالة (فعال / متوفي / استقالة / إسقاط / عجز).</li>
          <li>اضغط <strong>"حفظ العضو"</strong>.</li>
        </ol>
        <h3>4.2 أزرار الإجراء في كل صف</h3>
        <ul>
          <li><strong>معاينة</strong>: عرض استمارة بحث الحالة A4.</li>
          <li><strong>طباعة</strong>: فتح نسخة قابلة للطباعة فوراً.</li>
          <li><strong>تعديل</strong>: تعديل بيانات العضو في نفس النموذج.</li>
          <li><strong>حذف</strong> (للأدمن): حذف نهائي بعد تأكيد.</li>
        </ul>
        <h3>4.3 الفلاتر</h3>
        <ul>
          <li><strong>المحافظة</strong>: تصفية بمحافظة محددة.</li>
          <li><strong>اللجنة</strong>: تظهر فقط لجان المحافظة المختارة.</li>
          <li><strong>الحالة</strong>: شاملة المعاش افتراضياً.</li>
          <li><strong>اكتشاف البيانات الناقصة</strong>: أعضاء بدون محافظة أو لجنة.</li>
          <li><strong>إلغاء التصفية</strong>: مسح كل الفلاتر دفعة واحدة.</li>
        </ul>
        <h3>4.4 مسح كافة الأعضاء (للأدمن فقط)</h3>
        <div className="warn"><strong>تنبيه:</strong> هذه عملية لا يمكن التراجع عنها. يجب كتابة كلمة <code>DELETE</code> للتأكيد.</div>
      </section>

      <section id="import" className="page-break" data-testid="sec-import">
        <h2>5. استيراد ملفات Excel</h2>
        <ol>
          <li>اضغط <strong>"تحميل قالب Excel"</strong> لتنزيل قالب فارغ بالأعمدة المطلوبة.</li>
          <li>املأ الملف. الحقول الإلزامية فقط: <strong>الاسم</strong> + <strong>المحافظة</strong> + <strong>اللجنة النقابية</strong>.</li>
          <li>اضغط <strong>"استيراد Excel"</strong> واختر الملف.</li>
          <li>انتظر — قد يستغرق ملف كبير (~6000 سطر) حوالي دقيقة. ستظهر رسالة منبثقة "جاري التنفيذ".</li>
          <li>عند الانتهاء: <strong>تم الاستيراد: X جديد، Y محدث، Z متخطى</strong>.</li>
        </ol>
        <div className="callout"><strong>قاعدة عدم التكرار:</strong> الاسم الرباعي داخل نفس (المحافظة + اللجنة) لا يتكرر. أرقام العضوية والرقم القومي يمكن أن تتكرر.</div>
      </section>

      <section id="subscriptions" className="page-break" data-testid="sec-subscriptions">
        <h2>6. بوابة الاشتراكات</h2>
        <h3>6.1 تسجيل اشتراك جديد</h3>
        <ol>
          <li>اضغط <strong>"إضافة سجل اشتراك"</strong>.</li>
          <li>املأ: رقم الإذن، المبلغ، المحافظة، اللجنة، طريقة الدفع (دفع إلكتروني / شيك).</li>
          <li>عند اختيار دفع إلكتروني: أدخل <strong>مرجع الدفع</strong>. النظام يتحقق فوراً من عدم تكراره.</li>
          <li>اضغط <strong>"حفظ وإضافة آخر"</strong> لإدخال متتالي، أو <strong>"حفظ وإغلاق"</strong> للسجل الأخير.</li>
        </ol>
        <h3>6.2 الترتيب التلقائي</h3>
        <p>الجدول يُرتَّب تلقائياً بحسب رقم الإذن تصاعدياً.</p>
        <h3>6.3 أزرار الإجراء</h3>
        <ul>
          <li><strong>عرض</strong>: نافذة بكل التفاصيل.</li>
          <li><strong>تعديل</strong>: تحرير السجل.</li>
          <li><strong>طباعة</strong>: بيان A4 احترافي.</li>
          <li><strong>حذف</strong>: حذف السجل بعد تأكيد.</li>
        </ul>
      </section>

      <section id="settlements" className="page-break" data-testid="sec-settlements">
        <h2>7. تسويات المستحقات</h2>
        <p>صفحة <strong>"تسويات المستحقات"</strong> مخصصة لتسجيل دفعات مستحقات اللجان كاملة. تعمل بنفس آلية الاشتراكات لكن مع تعليم تلقائي للسجل بـ <code>is_dues_settlement=true</code>.</p>
      </section>

      <section id="committees" className="page-break" data-testid="sec-committees">
        <h2>8. مستحقات واستحقاقات اللجان</h2>
        <p>عرض جدولي بكل لجنة والمستحقات المتراكمة عليها.</p>
        <h3>8.1 إضافة "مستحقات سابقة"</h3>
        <ol>
          <li>اضغط <strong>"مستحقات سابقة"</strong>.</li>
          <li>اختر المحافظة + اللجنة + الفترة + المبلغ.</li>
          <li>اضغط <strong>"إضافة"</strong>. سيظهر المبلغ في عمود "مستحقات سابقة" داخل الجدول الرئيسي.</li>
        </ol>
        <h3>8.2 طباعة تقرير وتصدير Excel</h3>
        <ul>
          <li><strong>طباعة تقرير اللجان</strong>: تقرير A4 لكل اللجان النشطة.</li>
          <li><strong>تصدير Excel</strong>: ملف Excel جاهز للأرشفة.</li>
        </ul>
      </section>

      <section id="aid" className="page-break" data-testid="sec-aid">
        <h2>9. بوابة الإعانات</h2>
        <h3>9.1 الإعانات المعلقة</h3>
        <p>تُنشأ تلقائياً عند تغيير حالة العضو إلى <strong>متوفي</strong> أو <strong>عجز</strong>. تعرض هنا حتى يتم اعتمادها.</p>
        <h3>9.2 الإعانات المصروفة</h3>
        <p>السجلات اللي تم اعتماد صرفها — مع تاريخ ومبلغ ورقم الشيك.</p>
        <h3>9.3 تقرير الإعانات</h3>
        <p>تقرير شامل بالمصروف والمعلق، قابل للتصفية بالمحافظة ونوع الإعانة.</p>
      </section>

      <section id="letters" className="page-break" data-testid="sec-letters">
        <h2>10. بوابة الخطابات والمراسلات</h2>
        <ol>
          <li>اختر <strong>المحافظة</strong>.</li>
          <li>اختر <strong>اللجان</strong> (يمكن تحديد الكل أو إلغاء التحديد).</li>
          <li>اختر <strong>نوع الخطاب</strong> (مطالبة، تذكير، إلخ).</li>
          <li>اضغط <strong>"توليد الخطاب"</strong> → يُولَّد خطاب A4 لكل لجنة محددة.</li>
        </ol>
      </section>

      <section id="admin" className="page-break" data-testid="sec-admin">
        <h2>11. صفحة الأدمن</h2>
        <ul>
          <li><strong>الإدارات</strong>: إضافة، تعديل، تفعيل/إيقاف الإدارات.</li>
          <li><strong>جدول سن المعاش</strong>: تعديل قانون المعاش المصري (تاريخ بدء + السن).</li>
          <li><strong>إدارة المستخدمين</strong>: زر منفصل للوصول.</li>
          <li><strong>توحيد أسماء اللجان</strong> (انظر القسم التالي).</li>
          <li><strong>بصمة المبرمج</strong>: ظاهرة لـ super_admin فقط.</li>
        </ul>
      </section>

      <section id="dedup" className="page-break" data-testid="sec-dedup">
        <h2>12. توحيد أسماء اللجان المتشابهة</h2>
        <ol>
          <li>من <strong>صفحة الأدمن</strong> اضغط <strong>"فحص الأسماء"</strong>.</li>
          <li>اختر الإدارة + ضبط حساسية التشابه (80% افتراضي).</li>
          <li>سيظهر لك مجموعات اللجان المتشابهة (مع عدد الأعضاء في كل اسم).</li>
          <li>لكل مجموعة: <strong>عدّل</strong> الاسم الصحيح + ☑️ <strong>أزل تحديد</strong> أي اسم لا تريد دمجه.</li>
          <li>اضغط <strong>"تخطي"</strong> لإلغاء مجموعة بالكامل (False Positive).</li>
          <li>اضغط <strong>"تطبيق التصحيح"</strong>. سيتم تحديث جميع أعضاء الأسماء البديلة إلى الاسم الصحيح.</li>
        </ol>
        <div className="warn"><strong>نصيحة:</strong> دائماً راجع المقترحات بدقة. الـ AI يحدد المتشابهات اعتماداً على نسبة الحروف، وقد يُخطئ في حالات مثل "إسنا" vs "قنا".</div>
      </section>

      <section id="deploy" className="page-break" data-testid="sec-deploy">
        <h2>13. التشغيل والتثبيت المحلي</h2>
        <h3>13.1 التثبيت الأول</h3>
        <ol>
          <li>افتح <strong>PowerShell كمسؤول</strong>.</li>
          <li>نفّذ: <code>iwr -useb https://[backend-url]/api/installer/install.ps1 | iex</code></li>
          <li>السكريبت يثبّت Python + MongoDB + Tesseract + النظام تلقائياً.</li>
          <li>يفتح المتصفح على <code>http://localhost:5599</code>.</li>
        </ol>
        <h3>13.2 الوصول من أجهزة الشبكة</h3>
        <ol>
          <li>على الجهاز السيرفر: شغّل <code>ipconfig</code> واحصل على IPv4 (مثل <code>192.168.0.10</code>).</li>
          <li>على باقي الأجهزة: افتح <code>http://192.168.0.10:5599</code>.</li>
          <li><strong>لا حاجة للإنترنت</strong> — يكفي وجود الأجهزة على نفس الشبكة.</li>
        </ol>
        <h3>13.3 التحديث</h3>
        <p>أعد تنفيذ نفس أمر التثبيت في PowerShell. السكريبت يحفظ بياناتك (storage + .env) ويستبدل الكود فقط.</p>
      </section>

      <section id="faq" className="page-break" data-testid="sec-faq">
        <h2>14. الأسئلة الشائعة وحل المشاكل</h2>
        <h3>س1: ظهرت رسالة "جلسة غير صالحة" بعد التحديث.</h3>
        <p>ج: سجّل خروج وادخل من جديد. الـ token القديم لم يعد صالحاً.</p>
        <h3>س2: لا تظهر بياناتي بعد الاستيراد.</h3>
        <p>ج: تأكد أن الملف يحتوي على عمود "الاسم" بالحد الأدنى. راجع تقرير "تم الاستيراد" لمعرفة كم سطر تم تخطّيه.</p>
        <h3>س3: البرنامج بطيء.</h3>
        <p>ج: تأكد من ضبط <strong>عدد العناصر بالصفحة</strong> على 50 (وليس 200). فلاتر نشطة كثيرة قد تبطئ كذلك.</p>
        <h3>س4: لا يمكنني الوصول من جهاز آخر.</h3>
        <p>ج: تأكد من فتح المنفذ 5599 في Firewall على السيرفر، وأن الجهازين على نفس الشبكة.</p>
        <h3>س5: نسيت كلمة المرور.</h3>
        <p>ج: من حساب super_admin ادخل لـ إدارة المستخدمين وأعد تعيين كلمة مرور المستخدم.</p>
      </section>
    </>
  );
}

/* ===========================================================
   English content (LTR)
   =========================================================== */
function EnglishContent() {
  return (
    <>
      <section id="intro" className="page-break" data-testid="sec-intro-en">
        <h2>1. System Overview</h2>
        <p><strong>Electronic Archive</strong> is an integrated platform for managing the Social Solidarity Project's members and financial operations. Features:</p>
        <ul>
          <li>Full member CRUD with Excel batch import.</li>
          <li>Subscription & dues-settlement tracking with duplicate-payment-reference protection.</li>
          <li>Automated committee dues calculation & invoice letters.</li>
          <li>Aid lifecycle tracking (pending → disbursed).</li>
          <li>Real-time analytics dashboards.</li>
          <li>Professional A4 printing for every document.</li>
        </ul>
        <div className="callout"><strong>Goal:</strong> A self-hosted LAN solution that needs no internet after install.</div>
      </section>

      <section id="login" className="page-break" data-testid="sec-login-en">
        <h2>2. Login & Users</h2>
        <h3>2.1 Default Account</h3>
        <p>A default administrator account was created at first startup. For initial credentials, please contact your local administrator or refer to your local installation guide. <strong>It is strongly recommended to change the password upon first login.</strong></p>
        <h3>2.2 Create a New User</h3>
        <ol>
          <li>Login as <code>admin</code>.</li>
          <li>Open <strong>Admin Page</strong> → <strong>User Management</strong>.</li>
          <li>Click <strong>"Add User"</strong>.</li>
          <li>Fill: full name, username, password, role (super_admin / admin / user), allowed portals.</li>
          <li>Click <strong>Save</strong>.</li>
        </ol>
        <h3>2.3 Roles</h3>
        <ul>
          <li><strong>super_admin</strong>: full access incl. programmer credits page.</li>
          <li><strong>admin</strong>: manage members + users + bulk corrections.</li>
          <li><strong>user</strong>: limited to allowed portals.</li>
        </ul>
      </section>

      <section id="departments" className="page-break" data-testid="sec-departments-en">
        <h2>3. Departments & Portals</h2>
        <p>After login, the <strong>Departments</strong> screen lists active departments. Pick one (e.g. Social Solidarity Project) to enter the project dashboard, which contains:</p>
        <ul>
          <li>Membership Portal</li>
          <li>Subscriptions Portal</li>
          <li>Aid Portal (Pending / Disbursed / Reports)</li>
          <li>Letters Portal</li>
          <li>Financial Portal (Subscriptions / Settlements / Committee Dues)</li>
          <li>Category Archive</li>
        </ul>
      </section>

      <section id="membership" className="page-break" data-testid="sec-membership-en">
        <h2>4. Membership Portal</h2>
        <h3>4.1 Add a Member Manually</h3>
        <ol>
          <li>Click <strong>"Add New Member"</strong>.</li>
          <li>Fill the fields: full name, national ID, membership number, governorate, committee, birth date, subscription date, address, phone.</li>
          <li>Choose status (Active / Deceased / Resigned / Dropped / Disabled).</li>
          <li>Click <strong>"Save Member"</strong>.</li>
        </ol>
        <h3>4.2 Per-Row Actions</h3>
        <ul>
          <li><strong>View</strong>: open the A4 case-study form.</li>
          <li><strong>Print</strong>: open a print-ready version.</li>
          <li><strong>Edit</strong>: modify member data in the same dialog.</li>
          <li><strong>Delete</strong> (admin only): permanently delete after confirmation.</li>
        </ul>
        <h3>4.3 Filters</h3>
        <ul>
          <li><strong>Governorate</strong>: filter by selected governorate.</li>
          <li><strong>Committee</strong>: only shows committees of the selected governorate.</li>
          <li><strong>Status</strong>: includes "Retirement" by default.</li>
          <li><strong>Missing Data Detection</strong>: members with no governorate or committee.</li>
          <li><strong>Clear Filters</strong>: resets all filters in one click.</li>
        </ul>
        <h3>4.4 Delete All Members (Admin only)</h3>
        <div className="warn"><strong>Warning:</strong> Irreversible. Requires typing the word <code>DELETE</code>.</div>
      </section>

      <section id="import" className="page-break" data-testid="sec-import-en">
        <h2>5. Excel Import</h2>
        <ol>
          <li>Click <strong>"Download Excel Template"</strong>.</li>
          <li>Fill the file. Mandatory columns: <strong>Name</strong> + <strong>Governorate</strong> + <strong>Committee</strong>.</li>
          <li>Click <strong>"Import Excel"</strong> and pick the file.</li>
          <li>Wait — a 6,000-row file may take about a minute. A "Processing..." toast appears.</li>
          <li>On completion: <strong>Imported: X created, Y updated, Z skipped</strong>.</li>
        </ol>
        <div className="callout"><strong>Dedup Rule:</strong> Full name within the same (governorate + committee) must be unique. National ID & membership number may repeat.</div>
      </section>

      <section id="subscriptions" className="page-break" data-testid="sec-subscriptions-en">
        <h2>6. Subscriptions Portal</h2>
        <h3>6.1 Add a Subscription</h3>
        <ol>
          <li>Click <strong>"Add Subscription"</strong>.</li>
          <li>Fill: permit number, amount, governorate, committee, payment method (electronic / cheque).</li>
          <li>For electronic payments: enter the <strong>payment reference</strong>. The system instantly verifies it is unique.</li>
          <li>Click <strong>"Save & Add Another"</strong> for back-to-back entry, or <strong>"Save & Close"</strong> for the last record.</li>
        </ol>
        <h3>6.2 Auto-Sort</h3>
        <p>Records are automatically sorted by permit number ascending.</p>
        <h3>6.3 Row Actions</h3>
        <ul>
          <li><strong>View</strong>: full details dialog.</li>
          <li><strong>Edit</strong>: edit the record.</li>
          <li><strong>Print</strong>: professional A4 voucher.</li>
          <li><strong>Delete</strong>: permanent delete after confirmation.</li>
        </ul>
      </section>

      <section id="settlements" className="page-break" data-testid="sec-settlements-en">
        <h2>7. Dues Settlements</h2>
        <p>The <strong>Settlements</strong> page is used to record committee-wide dues payments. It behaves like the Subscriptions page but auto-marks records with <code>is_dues_settlement=true</code>.</p>
      </section>

      <section id="committees" className="page-break" data-testid="sec-committees-en">
        <h2>8. Committees Dues & Liabilities</h2>
        <p>A table view showing every committee with its accrued dues.</p>
        <h3>8.1 Add Prior Arrears</h3>
        <ol>
          <li>Click <strong>"Prior Arrears"</strong>.</li>
          <li>Select governorate + committee + period + amount.</li>
          <li>Click <strong>"Add"</strong>. The amount appears in the "Prior Arrears" column of the main table.</li>
        </ol>
        <h3>8.2 Print & Excel Export</h3>
        <ul>
          <li><strong>Print Committees Report</strong>: A4 report for all active committees.</li>
          <li><strong>Excel Export</strong>: Excel file ready for archiving.</li>
        </ul>
      </section>

      <section id="aid" className="page-break" data-testid="sec-aid-en">
        <h2>9. Aid Portal</h2>
        <h3>9.1 Pending Aids</h3>
        <p>Auto-created when a member's status changes to <strong>Deceased</strong> or <strong>Disabled</strong>. Listed here until approved.</p>
        <h3>9.2 Disbursed Aids</h3>
        <p>Records whose disbursement has been approved — with date, amount, and cheque number.</p>
        <h3>9.3 Aid Reports</h3>
        <p>Comprehensive report of disbursed & pending aids, filterable by governorate and aid type.</p>
      </section>

      <section id="letters" className="page-break" data-testid="sec-letters-en">
        <h2>10. Letters Portal</h2>
        <ol>
          <li>Select <strong>governorate</strong>.</li>
          <li>Select <strong>committees</strong> (Select-All / Clear-All available).</li>
          <li>Pick the <strong>letter type</strong> (claim, reminder, etc.).</li>
          <li>Click <strong>"Generate Letter"</strong> → an A4 letter is generated for each selected committee.</li>
        </ol>
      </section>

      <section id="admin" className="page-break" data-testid="sec-admin-en">
        <h2>11. Admin Page</h2>
        <ul>
          <li><strong>Departments</strong>: add, edit, enable/disable departments.</li>
          <li><strong>Retirement Schedule</strong>: edit the Egyptian retirement law (effective date + age).</li>
          <li><strong>User Management</strong>: separate access button.</li>
          <li><strong>Committee Name De-dup</strong> (next section).</li>
          <li><strong>Programmer Credits</strong>: visible to super_admin only.</li>
        </ul>
      </section>

      <section id="dedup" className="page-break" data-testid="sec-dedup-en">
        <h2>12. Committee Name De-duplication</h2>
        <ol>
          <li>On the <strong>Admin Page</strong> click <strong>"Scan Names"</strong>.</li>
          <li>Pick department + similarity threshold (80% default).</li>
          <li>The system shows clusters of similar committee names (with member counts).</li>
          <li>For each cluster: <strong>edit</strong> the canonical name + ☑️ <strong>uncheck</strong> any variant you don't want merged.</li>
          <li>Click <strong>"Skip"</strong> to dismiss an entire cluster (false positive).</li>
          <li>Click <strong>"Apply Correction"</strong>. All members under the variant names will be updated to the canonical.</li>
        </ol>
        <div className="warn"><strong>Tip:</strong> Always review suggestions carefully. The AI matches by character ratio and may err in cases like "Esna" vs "Qena".</div>
      </section>

      <section id="deploy" className="page-break" data-testid="sec-deploy-en">
        <h2>13. Local Deployment</h2>
        <h3>13.1 First-Time Install</h3>
        <ol>
          <li>Open <strong>PowerShell as Administrator</strong>.</li>
          <li>Run: <code>iwr -useb https://[backend-url]/api/installer/install.ps1 | iex</code></li>
          <li>The script auto-installs Python + MongoDB + Tesseract + the app.</li>
          <li>The browser opens on <code>http://localhost:5599</code>.</li>
        </ol>
        <h3>13.2 LAN Access</h3>
        <ol>
          <li>On the server: run <code>ipconfig</code> and note the IPv4 address (e.g. <code>192.168.0.10</code>).</li>
          <li>On other machines: open <code>http://192.168.0.10:5599</code>.</li>
          <li><strong>No internet required</strong> — just the same local network.</li>
        </ol>
        <h3>13.3 Updates</h3>
        <p>Re-run the same install command in PowerShell. The script preserves your data (storage + .env) and replaces code only.</p>
      </section>

      <section id="faq" className="page-break" data-testid="sec-faq-en">
        <h2>14. FAQ & Troubleshooting</h2>
        <h3>Q1: "Invalid session" after updating.</h3>
        <p>A: Log out and log back in. The old token is no longer valid.</p>
        <h3>Q2: My data doesn't appear after import.</h3>
        <p>A: Make sure the file has at least a "Name" column. Check the "Imported: ..." toast to see how many rows were skipped.</p>
        <h3>Q3: The app is slow.</h3>
        <p>A: Set the <strong>page size</strong> to 50 (not 200). Too many active filters can also slow things down.</p>
        <h3>Q4: I can't access from another machine.</h3>
        <p>A: Make sure port 5599 is open in the server's firewall, and both machines are on the same LAN.</p>
        <h3>Q5: I forgot my password.</h3>
        <p>A: Login as super_admin, go to User Management, and reset the user's password.</p>
      </section>
    </>
  );
}
