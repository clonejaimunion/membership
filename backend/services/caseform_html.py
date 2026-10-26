"""HTML renderer for the Case Research Form (استمارة بحث حالة).

Extracted from server.py (Phase A refactor). Pure rendering — no DB access.
"""
from typing import Any, Dict


def render_case_research_form_html(
    member: Dict[str, Any],
    mode: str = "print",
    dues_note: str = "",
    dues_note_clean: bool = False,
    date_formatter=None,
    last_paid_month: str = "",
    beneficiaries: list = None,
) -> str:
    """Render the A4 Case Research Form HTML.

    Args:
        member: enriched member dict.
        mode: "print" (auto-prints) or "view".
        dues_note: optional financial-status note string.
        dues_note_clean: when True the note is rendered in green (no arrears).
        date_formatter: callable(str) -> str used to format DOB / status / subscription
            dates. If None, raw values are emitted.
        last_paid_month: YYYY-MM string with the last collected subscription month
            for the member's committee. Rendered as MM / YYYY when present.
        beneficiaries: list of beneficiary dicts [{"name": "...", "relation": "...", "percentage": "...", "amount": ...}]
    """
    fmt = date_formatter or (lambda v: v or "")
    # Format last_paid_month from YYYY-MM into MM / YYYY for display
    last_paid_disp = ""
    if last_paid_month and len(last_paid_month) >= 7 and "-" in last_paid_month:
        y, m = last_paid_month.split("-")[0], last_paid_month.split("-")[1]
        last_paid_disp = f"{m} / {y}"
    # In print mode we no longer auto-print via prompt(). Instead we inject a small modal
    # date picker that runs on load. Once the user confirms, the date is converted to
    # Arabic digits, injected into the form, and window.print() fires.
    auto_print = ""
    aid_date_modal_html = ""
    aid_date_modal_script = ""
    if mode == "print":
        aid_date_modal_html = (
            '<div id="aid-date-modal" class="aid-modal no-print" role="dialog" aria-modal="true">'
            '  <div class="aid-modal-card">'
            '    <div class="aid-modal-title">تاريخ تقديم طلب الإعانة</div>'
            '    <div class="aid-modal-sub">اختر التاريخ من التقويم ثم اضغط تأكيد لإدراجه في الاستمارة قبل الطباعة.</div>'
            '    <div class="aid-modal-row">'
            '      <label for="aid-date-input">التاريخ:</label>'
            '      <input type="date" id="aid-date-input" />'
            '    </div>'
            '    <div class="aid-modal-actions">'
            '      <button type="button" id="aid-date-confirm" class="aid-btn aid-btn-primary">تأكيد وطباعة</button>'
            '      <button type="button" id="aid-date-skip" class="aid-btn aid-btn-ghost">تخطي وطباعة بدون تاريخ</button>'
            '    </div>'
            '  </div>'
            '</div>'
        )
        aid_date_modal_script = """
<script>
(function(){
  var AR='٠١٢٣٤٥٦٧٨٩';
  function toAr(s){ return String(s).replace(/[0-9]/g, function(d){ return AR[d]; }); }
  function pad2(n){ return (n<10?'0':'') + n; }
  function format(value){
    if(!value) return '';
    // value is YYYY-MM-DD
    var parts = value.split('-');
    if(parts.length !== 3) return toAr(value);
    return toAr(pad2(parseInt(parts[2],10)) + '/' + pad2(parseInt(parts[1],10)) + '/' + parts[0]);
  }
  function injectAndPrint(){
    var inp = document.getElementById('aid-date-input');
    var cell = document.getElementById('aid-request-date-cell');
    if(inp && cell && inp.value){
      cell.textContent = format(inp.value);
    }
    var modal = document.getElementById('aid-date-modal');
    if(modal) modal.style.display = 'none';
    setTimeout(function(){ window.print(); }, 200);
  }
  function init(){
    var modal = document.getElementById('aid-date-modal');
    var input = document.getElementById('aid-date-input');
    var confirmBtn = document.getElementById('aid-date-confirm');
    var skipBtn = document.getElementById('aid-date-skip');
    if(!modal || !confirmBtn || !skipBtn) return;
    // Default to today
    var today = new Date();
    var iso = today.getFullYear() + '-' + pad2(today.getMonth()+1) + '-' + pad2(today.getDate());
    if(input) input.value = iso;
    confirmBtn.addEventListener('click', injectAndPrint);
    skipBtn.addEventListener('click', function(){
      var m = document.getElementById('aid-date-modal'); if(m) m.style.display='none';
      setTimeout(function(){ window.print(); }, 200);
    });
    // Enter = confirm
    if(input){
      input.addEventListener('keydown', function(ev){ if(ev.key==='Enter'){ ev.preventDefault(); injectAndPrint(); } });
      setTimeout(function(){ try{ input.focus(); }catch(e){} }, 100);
    }
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
</script>
"""
    exit_button_html = "" if mode == "print" else (
        '<div class="exit-bar no-print">'
        '<button onclick="window.close()" class="exit-btn">إغلاق نافذة العرض</button>'
        '<button onclick="window.print()" class="print-btn">طباعة الاستمارة</button>'
        '</div>'
    )
    name = (member.get("name") or "").strip()
    membership_number = (member.get("membership_number") or "").strip()
    union_committee = (member.get("union_committee") or "").strip()
    governorate = (member.get("governorate") or "").strip()
    subscription_date = fmt(member.get("subscription_date") or "")
    status_date_disp = fmt(member.get("status_date") or "")
    beneficiary_name = (member.get("beneficiary_name") or "").strip()
    # Detect "الورثة الشرعيين" phrase anywhere in the beneficiary field → append suffix to the table title.
    heirs_suffix = ""
    has_heirs = ("الورثة الشرعيين" in beneficiary_name) or ("الورثه الشرعيين" in beneficiary_name)
    if has_heirs:
        heirs_suffix = ' <span class="heirs-suffix">(الورثة الشرعيين)</span>'
    # When the only content is the heirs phrase itself, do NOT duplicate it inside the table —
    # the suffix above already conveys the meaning. Render an empty first row instead.
    beneficiary_cell_text = beneficiary_name
    stripped_no_heirs = beneficiary_name.replace("الورثة الشرعيين", "").replace("الورثه الشرعيين", "").strip(" -+/،,")
    if has_heirs and not stripped_no_heirs:
        beneficiary_cell_text = ""
    notes_block = ""
    if dues_note:
        color = "#065f46" if dues_note_clean else "#7c2d12"
        notes_block = (
            '<div class="section notes-section">'
            f'<div class="section-body"><div class="row"><div class="field full"><label>بيان مالي:</label>'
            f'<div class="value" style="font-weight:700;color:{color};">{dues_note}</div></div></div></div>'
            '</div>'
        )
    title = f"استمارة بحث حالة - {name or membership_number or 'عضو'}"
    
    # إعداد صفوف جدول المستحقين
    if beneficiaries is None:
        beneficiaries = []
    
    beneficiaries_rows = ""
    if beneficiaries:
        # تجميع المستحقين حسب share_group_key لحساب rowspan
        group_map = {}
        for idx, ben in enumerate(beneficiaries[:8]):
            key = ben.get("share_group_key", f"{idx}_unique")
            if key not in group_map:
                group_map[key] = []
            group_map[key].append(idx)
        
        # تحديد الصف الأول في كل مجموعة
        first_in_group = set()
        for indices in group_map.values():
            if indices:
                first_in_group.add(indices[0])
        
        # عرض المستحقين من الحاسبة مع دمج خلايا النسبة الشرعية
        for idx, ben in enumerate(beneficiaries[:8], start=1):
            name_ben = ben.get("name", "")
            relation = ben.get("relation", "")
            
            # حساب rowspan لخلية النسبة الشرعية
            key = ben.get("share_group_key", f"{idx-1}_unique")
            rowspan = len(group_map.get(key, [idx-1]))
            is_first_in_group = (idx-1) in first_in_group
            
            # الفرض الأصلي والرد والنسبة النهائية ونوع الاستحقاق
            base_share_fraction = ben.get("base_share_fraction", "")
            share_group_text = ben.get("share_group_text", "")
            share_type = ben.get("share_type", "") or ben.get("inheritance_type", "")
            radd_fraction = ben.get("radd_fraction", "")
            final_fraction = ben.get("final_share_fraction", "") or ben.get("percentage", "")
            
            # النسبة الشرعية المدموجة
            if not share_group_text:
                base_share_arabic = ben.get("base_share_arabic", "")
                share_group_text = f"{base_share_arabic} والباقي ردًا" if radd_fraction else base_share_arabic or ben.get("percentage_arabic", "") or ben.get("percentage", "")
            
            amount = ben.get("amount", 0)
            amount_fmt = f"{amount:,.2f}" if amount > 0 else ""
            
            row_cells = f'<td>{idx}</td><td style="text-align:right; padding-right:10px; font-weight:700;">{name_ben}</td><td>{relation}</td><td>{base_share_fraction}</td>'
            
            # خلية النسبة الشرعية (مع rowspan إذا كان أول صف في المجموعة)
            if is_first_in_group:
                row_cells += f'<td style="font-weight:700; color:#0f3a73; vertical-align:middle;" rowspan="{rowspan}">{share_group_text}</td>'
            
            # باقي الخلايا
            row_cells += f'<td>{radd_fraction or "-"}</td><td style="font-weight:700;">{final_fraction}</td><td>{share_type}</td><td>{amount_fmt}</td><td></td>'
            
            beneficiaries_rows += f'<tr>{row_cells}</tr>\n'
        
        # إضافة صفوف فارغة للوصول إلى 8 صفوف
        empty_cells = '<td></td>' * 9
        for idx in range(len(beneficiaries) + 1, 9):
            beneficiaries_rows += f'<tr><td>{idx}</td>{empty_cells}</tr>\n'
    else:
        # الجدول الافتراضي (8 صفوف فارغة مع اسم المستفيد في الصف الأول إن وجد)
        beneficiaries_rows = f'<tr><td>1</td><td style="text-align:right; padding-right:10px; font-weight:700;">{beneficiary_cell_text}</td>' + '<td></td>' * 8 + '</tr>\n'
        for idx in range(2, 9):
            beneficiaries_rows += f'<tr><td>{idx}</td>' + '<td></td>' * 9 + '</tr>\n'
    
    return f"""<!doctype html>
<html dir=\"rtl\" lang=\"ar\">
<head>
<meta charset=\"utf-8\" />
<title>{title}</title>
<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">
<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>
<link href=\"https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap\" rel=\"stylesheet\">
<style>
  @page {{ size: A4; margin: 0; }}
  * {{ box-sizing: border-box; }}
  html, body {{ margin:0; padding:0; }}
  body {{ font-family: 'Cairo','Tahoma','Arial',sans-serif; color:#1a1a1a; background:#eef2f7; padding:0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
  .sheet {{ width: 210mm; height: 297mm; margin: 0 auto; background:#fff; padding: 4mm 5mm 4mm; border:1px solid #c9d3e0; box-shadow: 0 4px 18px rgba(0,0,0,.06); position:relative; overflow:hidden; page-break-after: avoid; page-break-inside: avoid; }}
  .sheet::before {{ content:""; position:absolute; inset:2mm; border:1px solid #d8e0eb; pointer-events:none; }}
  .inner {{ position:relative; height:100%; display:flex; flex-direction:column; }}

  .header {{ display:grid; grid-template-columns: 1fr auto 1fr; align-items:center; gap:10px; padding:2px 6px 6px; border-bottom:3px double #0f3a73; margin-bottom:6px; flex-shrink:0; }}
  .header .org-ar h1 {{ font-size:16px; margin:0 0 2px; color:#0f3a73; }}
  .header .org-ar h2 {{ font-size:13px; margin:0; font-weight:700; color:#0f3a73; }}
  .header .crest {{ width:54px; height:54px; border:2px solid #0f3a73; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#0f3a73; font-weight:800; font-size:10px; text-align:center; line-height:1.1; padding:4px; }}
  .header .org-en {{ direction:ltr; text-align:left; font-size:11px; color:#555; }}
  .header .org-en strong {{ display:block; color:#0f3a73; font-size:11.5px; margin-bottom:2px; }}

  .form-title {{ text-align:center; font-size:18px; font-weight:800; color:#0f3a73; margin:2px 0 6px; padding:5px 0; border-top:1px solid #0f3a73; border-bottom:1px solid #0f3a73; letter-spacing:1px; flex-shrink:0; }}

  .section {{ margin: 4px 0; border:1px solid #cbd5e1; border-radius:5px; overflow:hidden; flex-shrink:0; }}
  .section.grow {{ display:flex; flex-direction:column; flex: 1 1 auto; min-height:0; }}
  .section.grow .section-body {{ flex:1; display:flex; flex-direction:column; padding:0; }}
  .section.grow table.beneficiaries {{ flex:1; }}
  .section-title {{ background:#fff; color:#0f3a73; padding:4px 10px; font-weight:700; font-size:13px; display:flex; align-items:center; gap:6px; border-bottom:1.5px solid #0f3a73; }}
  .section-title .num {{ background:#0f3a73; color:#fff; width:20px; height:20px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:12px; font-weight:800; }}
  .section-title .heirs-suffix {{ font-weight:700; color:#0f3a73; font-size:12.5px; background:transparent; }}
  .section-body {{ padding:6px 10px; background:#fff; }}

  .row {{ display:flex; gap:14px; margin:4px 0; flex-wrap:wrap; }}
  .field {{ flex:1; min-width:220px; display:flex; align-items:baseline; gap:6px; }}
  .field label {{ font-weight:700; white-space:nowrap; color:#0f3a73; font-size:13px; }}
  .field .value {{ flex:1; border-bottom:1.2px dotted #4b5563; padding:2px 4px; min-height:20px; font-weight:700; color:#111; font-size:13.5px; }}
  .full {{ width:100%; }}
  .full .value {{ min-height: 28px; border-bottom: 2px dotted #4b5563; }}

  table.beneficiaries {{ width:100%; border-collapse:collapse; height:100%; }}
  table.beneficiaries th, table.beneficiaries td {{ border:1px solid #94a3b8; padding:2px 4px; text-align:center; font-size:12px; line-height:1.15; }}
  table.beneficiaries th {{ background:#e8eef7; color:#0f3a73; font-weight:700; padding:3px 4px; }}
  table.beneficiaries tbody tr:nth-child(odd) td {{ background:#fbfcfe; }}

  .signatures {{ margin-top:6px; padding-top:5px; border-top:1px dashed #94a3b8; flex-shrink:0; }}
  .signatures-title {{ text-align:center; font-weight:800; color:#0f3a73; margin-bottom:10px; font-size:16px; letter-spacing:1px; }}
  .sig-grid {{ display:grid; grid-template-columns: repeat(6, 1fr); gap:8px 10px; }}
  .sig-cell {{ text-align:center; }}
  .sig-cell .role {{ font-weight:700; color:#0f3a73; font-size:12.5px; margin-bottom:4px; white-space:nowrap; }}
  .sig-cell .line {{ border-bottom:1.2px solid #1f2937; height:42px; }}

  .exit-bar {{ position: fixed; top: 10px; left: 10px; right: 10px; background: #0f172a; color:#fff; padding:10px 14px; border-radius:8px; display:flex; justify-content:space-between; gap:10px; z-index:50; box-shadow:0 6px 20px rgba(0,0,0,.18); }}
  .exit-bar .exit-btn, .exit-bar .print-btn {{ background:#fff; color:#0f172a; border:0; border-radius:6px; padding:8px 14px; font-weight:700; cursor:pointer; font-family: inherit; }}
  .exit-bar .print-btn {{ background:#0047AB; color:#fff; }}

  /* Aid request date modal (print mode only) */
  .aid-modal {{ position:fixed; inset:0; background:rgba(15,23,42,.55); display:flex; align-items:center; justify-content:center; z-index:9999; backdrop-filter: blur(2px); }}
  .aid-modal-card {{ background:#fff; border-radius:12px; box-shadow:0 20px 60px rgba(0,0,0,.25); padding:22px 24px; width:min(420px,92vw); font-family:'Cairo','Tahoma','Arial',sans-serif; border-top:5px solid #0f3a73; }}
  .aid-modal-title {{ color:#0f3a73; font-size:18px; font-weight:800; margin-bottom:6px; }}
  .aid-modal-sub {{ color:#475569; font-size:13px; margin-bottom:16px; line-height:1.5; }}
  .aid-modal-row {{ display:flex; align-items:center; gap:10px; margin-bottom:18px; }}
  .aid-modal-row label {{ font-weight:700; color:#0f3a73; font-size:14px; }}
  .aid-modal-row input[type="date"] {{ flex:1; padding:8px 10px; border:1.5px solid #cbd5e1; border-radius:7px; font-size:14px; font-family:inherit; color:#0f172a; outline:none; }}
  .aid-modal-row input[type="date"]:focus {{ border-color:#0f3a73; box-shadow:0 0 0 3px rgba(15,58,115,.12); }}
  .aid-modal-actions {{ display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap; }}
  .aid-btn {{ border:0; padding:9px 14px; border-radius:7px; font-weight:700; cursor:pointer; font-family:inherit; font-size:13px; transition:all .15s ease; }}
  .aid-btn-primary {{ background:#0f3a73; color:#fff; }}
  .aid-btn-primary:hover {{ background:#103e7d; }}
  .aid-btn-ghost {{ background:#f1f5f9; color:#475569; }}
  .aid-btn-ghost:hover {{ background:#e2e8f0; }}

  @media print {{
    body {{ background:#fff; padding:0; }}
    .sheet {{ width: 210mm; height: 297mm; margin:0; border:0; box-shadow:none; padding: 4mm 5mm 4mm; page-break-after: avoid; }}
    .sheet::before {{ inset: 2mm; }}
    .no-print {{ display:none !important; }}
  }}
</style>
</head>
<body>
  {aid_date_modal_html}
  {exit_button_html}
  <div class=\"sheet\">
    <div class=\"inner\">
      <div class=\"header\">
        <div class=\"org-ar\">
          <h1>النقابة العامة للزراعة والري</h1>
          <h2>مشروع التكافل الاجتماعي</h2>
        </div>
        <div class=\"crest\">النقابة<br/>العامة<br/>للزراعة</div>
        <div class=\"org-en\">
          <strong>The General Trade Union</strong>
          Of Workers Of Agriculture<br/>
          Social Solidarity Project
        </div>
      </div>

      <div class=\"form-title\">إستمارة بحث حالة</div>

      <div class=\"section\">
        <div class=\"section-title\"><span class=\"num\">1</span> بيانات العضو</div>
        <div class=\"section-body\">
          <div class=\"row\">
            <div class=\"field\"><label>الاسم الرباعي:</label><div class=\"value\">{name}</div></div>
            <div class=\"field\"><label>رقم العضوية:</label><div class=\"value\">{membership_number}</div></div>
          </div>
          <div class=\"row\">
            <div class=\"field\"><label>اللجنة النقابية:</label><div class=\"value\">{union_committee}</div></div>
            <div class=\"field\"><label>المحافظة:</label><div class=\"value\">{governorate}</div></div>
          </div>
        </div>
      </div>

      <div class=\"section\">
        <div class=\"section-title\"><span class=\"num\">2</span> بيانات الحالة وموقف سداد الاشتراكات</div>
        <div class=\"section-body\">
          <div class=\"row\">
            <div class=\"field\"><label>تاريخ الوفاة / عجز:</label><div class=\"value\">{status_date_disp or '&nbsp;'}</div></div>
            <div class=\"field\"><label>تاريخ تقديم طلب الإعانة:</label><div class=\"value\" id=\"aid-request-date-cell\">&nbsp;</div></div>
          </div>
          <div class=\"row\">
            <div class=\"field\"><label>تاريخ الاشتراك:</label><div class=\"value\">{subscription_date}</div></div>
            <div class=\"field\"><label>آخر شهر سداد للاشتراكات:</label><div class=\"value\">{last_paid_disp or '&nbsp;'}</div></div>
          </div>
        </div>
      </div>

      <div class=\"section grow\">
        <div class=\"section-title\"><span class=\"num\">3</span> المستحقون للإعانة{heirs_suffix}</div>
        <div class=\"section-body\" style=\"padding:0\">
          <table class=\"beneficiaries\">
            <thead>
              <tr>
                <th style=\"width:4%\">م</th>
                <th style=\"width:20%\">الاسم</th>
                <th style=\"width:9%\">درجة القرابة</th>
                <th style=\"width:8%\">الفرض الأصلي</th>
                <th style=\"width:16%\">النسبة الشرعية</th>
                <th style=\"width:7%\">الرد</th>
                <th style=\"width:8%\">النسبة النهائية</th>
                <th style=\"width:9%\">نوع الاستحقاق</th>
                <th style=\"width:9%\">المبلغ</th>
                <th style=\"width:10%\">ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {beneficiaries_rows}
            </tbody>
          </table>
        </div>
      </div>

      <div class=\"section\">
        <div class=\"section-title\"><span class=\"num\">4</span> إجراءات الاعتماد</div>
        <div class=\"section-body\">
          <div class=\"row\">
            <div class=\"field\"><label>تاريخ العرض على مجلس الإدارة:</label><div class=\"value\">&nbsp;</div></div>
          </div>
          <div class=\"row\">
            <div class=\"field full\"><label>قرار المجلس:</label><div class=\"value\">&nbsp;</div></div>
          </div>
        </div>
      </div>

      {notes_block}

      <div class=\"signatures\">
        <div class=\"signatures-title\">التوقيعات والاعتمادات</div>
        <div class=\"sig-grid\">
          <div class=\"sig-cell\"><div class=\"role\">الموظف المسئول</div><div class=\"line\"></div></div>
          <div class=\"sig-cell\"><div class=\"role\">رئيس الحسابات</div><div class=\"line\"></div></div>
          <div class=\"sig-cell\"><div class=\"role\">المراجع القانوني</div><div class=\"line\"></div></div>
          <div class=\"sig-cell\"><div class=\"role\">الأمين العام</div><div class=\"line\"></div></div>
          <div class=\"sig-cell\"><div class=\"role\">أمين الصندوق</div><div class=\"line\"></div></div>
          <div class=\"sig-cell\"><div class=\"role\">رئيس مجلس الإدارة</div><div class=\"line\"></div></div>
        </div>
      </div>
    </div>
  </div>
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
<script>{auto_print}</script>
{aid_date_modal_script}
</body>
</html>"""
