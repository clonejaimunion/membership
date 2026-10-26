"""HTML renderer for committee letters (Phase A refactor — extracted from server.py)."""
from typing import Any, Dict, List


LETTER_FOOTER_EMAIL = "gtuwa@gtuwa.org.eg"
# Use HTML entity for @ to avoid Cloudflare email obfuscation
LETTER_FOOTER_EMAIL_HTML = "gtuwa&#64;gtuwa.org.eg"
LETTER_FOOTER_TEXT = (
    "197 boursaid St., El-Saida Zainab - Cairo - P.O.26 "
    "Tel.: (202) 23652157 - (202) 23652158 - (202) 23652159 "
    f"Fax: (202) 23643630 - E-mail: {LETTER_FOOTER_EMAIL_HTML}"
)


def render_letters_html(dept_name: str, letters: List[Dict[str, Any]], year_label: str, issue_date: str) -> str:
    def fmt(n):
        return f"{float(n or 0):,.2f}".replace(",", "٬")
    pages = []
    for L in letters:
        pages.append(f"""
        <article class="sheet">
          <header class="letter-header">
            <div class="org">
              <h1>النقابة العامة</h1>
              <h2>للعاملين بالزراعة والري والصيد واستصلاح الأراضي</h2>
              <h2 class="project-line">مشروع التكافل الاجتماعي</h2>
              <h3>بجمهورية مصر العربية</h3>
            </div>
            <div class="org-en">
              <h1>The General Trade Union</h1>
              <h3>of Workers in Agriculture</h3>
              <h4>ARAB REPUBLIC OF EGYPT</h4>
            </div>
          </header>
          <div class="issued">
            <span>القاهرة في: <strong>{issue_date}</strong></span>
          </div>

          <p class="recipient"><strong>السيد الأستاذ / رئيس اللجنة النقابية للعاملين:</strong></p>
          <p class="committee"><strong>{L['union_committee']} - بمحافظة {L['governorate']}</strong></p>

          <p class="salutation">تحية طيبة وبعد،،،</p>
          <p class="intro">بعد المراجعة والاطلاع لموقف لجنتكم النقابية {f"عن عام <strong>{year_label}</strong>" if year_label else f"عن الفترة من <strong>{L['from_month']}</strong> إلى <strong>{L['to_month']}</strong>"} وجدنا الآتي:</p>

          <ol class="points">
            <li>حجم العضوية (<strong>{L['membership_size']}</strong>)</li>
            <li>يوجد فرق مستحقات تقدّر بمبلغ وقدره (<strong>{fmt(L['owed_amount'])} جنيه</strong>)</li>
            <li>يُرجى إرسال كشف مفسر بما تم دفعه وتحصيله ضمن حسابنا من <strong>{L['from_month']}</strong> إلى <strong>{L['to_month']}</strong>، ويذكر به المبلغ — رقم أمر الدفع — تاريخ الاستحقاق — البنك المحصل طرفه ومختوم بختم اللجنة.</li>
            <li>يُرجى إرسال كشف بالأسماء الحالية طرفكم المشتركة بمشروع التكافل لتحديث البيانات، على أن يكون الكشف موقعاً من أمين الصندوق ورئيس اللجنة ومختوماً بختم اللجنة.</li>
            <li>القيمة المقررة للاشتراك الشهري للعضو <strong>{int(L['monthly_rate'])} جنيهات شهرياً</strong>.</li>
            <li>رقم الدفع الإلكتروني الحالي بمشروع التكافل هو <strong>0217056246482060000</strong> طرف بنك التنمية الصناعية بالقاهرة - فرع الجلاء، باسم النقابة العامة للزراعة والري - مشروع التكافل الاجتماعي.</li>
          </ol>

          <p class="urgent">يُرجى مراجعة وإرسال البيانات أعلاه خلال خمسة عشر يوماً من تاريخ استلامكم للخطاب للأهمية القصوى.</p>
          <p class="closing">وتفضّلوا بقبول فائق الاحترام،،،</p>

          <div class="signatures">
            <div class="sig">
              <span>أمين صندوق النقابة العامة</span>
              <span>للعاملين بالزراعة والري واستصلاح الأراضي</span>
              <div class="line"></div>
              <span class="name">أ/ سامي محمد رزق</span>
            </div>
            <div class="sig">
              <span>رئيس النقابة العامة للعاملين</span>
              <span>بالزراعة والري والصيد واستصلاح الأراضي</span>
              <span>الأمين العام لاتحاد نقابات عمال مصر</span>
              <div class="line"></div>
              <span class="name">أ/ عيد عبدالفتاح مرسال</span>
            </div>
          </div>

          <footer class="letter-footer">{LETTER_FOOTER_TEXT}</footer>
        </article>
        """)
    return f"""<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
<title>خطابات اللجان - {dept_name}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  @page {{ size: A4; margin: 0; }}
  * {{ box-sizing: border-box; }}
  body {{ font-family:'Cairo','Tahoma',sans-serif; margin:0; padding:0; background:#f1f5f9; color:#111; font-size:16px; line-height:2.2; }}
  .actions {{ position:fixed; top:8px; left:8px; z-index:50; }}
  .actions button {{ background:#0f3a73; color:#fff; border:0; border-radius:6px; padding:8px 12px; font-weight:700; cursor:pointer; font-family: inherit; }}
  @media print {{ body {{ background:#fff; padding:0; }} .actions {{ display:none; }} }}
  .sheet {{
    width: 210mm; height: 297mm; background:#fff; margin: 0 auto 8px;
    padding: 4mm 6mm; box-shadow: 0 8px 18px -10px rgba(15,58,115,0.25);
    page-break-after: always; page-break-inside: avoid; display:flex; flex-direction:column; overflow:hidden;
  }}
  .sheet:last-child {{ page-break-after: auto; }}
  .letter-header {{ display:flex; justify-content:space-between; align-items:flex-start; gap:18px; border-bottom:2px solid #0f3a73; padding-bottom:4px; }}
  .letter-header .org {{ flex:1; text-align:center; }}
  .letter-header .org h1 {{ font-size:22px; color:#0f3a73; margin:0 0 2px; }}
  .letter-header .org h2 {{ font-size:15px; margin:0; font-weight:700; color:#0f3a73; }}
  .letter-header .org h2.project-line {{ color:#0f3a73; }}
  .letter-header .org h3 {{ font-size:13px; margin:1px 0 0; color:#0f3a73; }}
  .letter-header .org-en {{ flex:1; direction: ltr; text-align: center; }}
  .letter-header .org-en h1 {{ font-size:16px; margin:0; color:#0f3a73; }}
  .letter-header .org-en h3 {{ font-size:13px; margin:1px 0; color:#0f3a73; }}
  .letter-header .org-en h4 {{ font-size:11px; margin:0; color:#0f3a73; }}
  .issued {{ margin-top:6px; display:flex; justify-content:flex-start; font-size:14px; color:#475569; padding-bottom:4px; border-bottom:1px dashed #94a3b8; }}
  .recipient {{ margin-top:10px; font-size:16px; }}
  .committee {{ font-size:17px; color:#0f3a73; margin-inline-start: 6cm; margin-top:4px; }}
  .salutation {{ margin-top:10px; font-weight:700; font-size:16px; }}
  .intro {{ margin-top:6px; line-height:2.2; font-size:16px; }}
  .points {{ margin: 6px 0 0; padding-inline-start: 22px; line-height: 2.2; font-size:16px; }}
  .points li {{ margin-bottom:3px; }}
  .points li:last-child {{ text-decoration: underline; text-underline-offset: 4px; }}
  .points strong {{ color:#0f3a73; }}
  .urgent {{ margin-top:8px; font-weight:700; font-size:15px; line-height:2.0; text-align:center; }}
  .closing {{ margin-top:6px; font-weight:700; font-size:16px; text-align:center; }}
  .signatures {{ margin-top: 14px; display:grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: stretch; }}
  .sig {{ text-align:center; display:flex; flex-direction:column; }}
  .sig span {{ display:block; font-weight:700; font-size:14px; color:#0f3a73; line-height:1.08; }}
  .sig span.to {{ font-weight:700; font-size:14px; color:#1f2937; margin: 2px 0 2px; }}
  .sig .line {{ margin-top:auto; padding-top:40px; border-bottom:1.5px solid #1f2937; }}
  .sig span.name {{ margin-top:6px; font-size:14.5px; color:#0f3a73; font-weight:800; white-space: nowrap; }}
  .letter-footer {{ margin-top:auto; border-top:2px solid #0f3a73; padding-top:4px; text-align:center; font-size:11px; color:#475569; direction:ltr; }}
</style></head><body>
<div class="actions">
  <button onclick="window.print()">طباعة</button>
  <button onclick="window.close()" style="background:#1f2937; margin-inline-start:8px;">إغلاق</button>
</div>
{''.join(pages)}
<script>
(function(){{
  var AR='٠١٢٣٤٥٦٧٨٩';
  function conv(t){{return t.replace(/[0-9]/g,function(d){{return AR[d];}});}}
  function walk(n){{
    if(n.nodeType===3){{
      var p=n.parentNode;
      if(p && p.tagName!=='SCRIPT' && p.tagName!=='STYLE'){{
        var v=n.nodeValue;
        if(v && /[0-9]/.test(v)){{ n.nodeValue=conv(v); }}
      }}
    }} else if(n.nodeType===1 && n.tagName!=='SCRIPT' && n.tagName!=='STYLE'){{
      for(var i=0;i<n.childNodes.length;i++) walk(n.childNodes[i]);
    }}
  }}
  walk(document.body);
}})();
</script>
</body></html>"""
