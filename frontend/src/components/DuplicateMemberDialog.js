import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, AlertCircle, Printer } from "lucide-react";

const ROW_LABELS = {
  membership_number: "رقم العضوية",
  national_id: "الرقم القومي",
  name: "الاسم الرباعي",
  governorate: "المحافظة",
  union_committee: "اللجنة النقابية",
  birth_date: "تاريخ الميلاد",
  subscription_date: "تاريخ الاشتراك",
  status: "الحالة",
  status_date: "تاريخ الحالة",
  address: "العنوان",
  address_phone: "محل الإقامة والتليفون",
  phone: "الهاتف",
  job: "الوظيفة",
  beneficiary_name: "المستحق للإعانة",
  created_at: "تاريخ الإضافة للنظام",
  updated_at: "تاريخ آخر تحديث",
  retirement_age: "سن المعاش",
  retirement_date: "تاريخ المعاش",
  retirement_label: "بيانات المعاش",
  id: "رقم السجل بالنظام",
};

const FIELD_ORDER = [
  "membership_number",
  "national_id",
  "name",
  "governorate",
  "union_committee",
  "birth_date",
  "subscription_date",
  "status",
  "status_date",
  "address",
  "address_phone",
  "phone",
  "job",
  "beneficiary_name",
  "retirement_age",
  "retirement_date",
  "retirement_label",
  "created_at",
  "updated_at",
  "id",
];

/**
 * Modal shown when the API returns 409 duplicate_member.
 *
 * Props:
 *   open: boolean
 *   message: short Arabic title (from API)
 *   member: the existing duplicate record from the API response
 *   allDuplicates: array of all duplicate members in different committees
 *   committeeInfo: array of committee information for each duplicate
 *   duplicateCount: total number of duplicates
 *   onClose: () => void
 */
export default function DuplicateMemberDialog({ 
  open, 
  message, 
  member, 
  allDuplicates = [], 
  committeeInfo = [],
  duplicateCount = 1,
  onClose 
}) {
  
  // دالة الطباعة
  const handlePrint = () => {
    // إنشاء محتوى الطباعة
    const printWindow = window.open('', '_blank');
    const currentDate = new Date().toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    let printContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>بيانات عضو مكرر</title>
  <style>
    @page {
      size: A4;
      margin: 20mm;
    }
    
    body {
      font-family: 'Cairo', 'Tahoma', sans-serif;
      direction: rtl;
      text-align: right;
      padding: 20px;
      background: white;
    }
    
    .header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 3px solid #b91c1c;
      padding-bottom: 15px;
    }
    
    .header h1 {
      color: #b91c1c;
      font-size: 24px;
      margin: 0 0 10px 0;
      font-weight: 800;
    }
    
    .header p {
      color: #7f1d1d;
      font-size: 14px;
      margin: 5px 0;
      font-weight: 600;
    }
    
    .duplicate-summary {
      background: #fef2f2;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 25px;
      border-right: 6px solid #b91c1c;
    }
    
    .duplicate-summary h2 {
      color: #7f1d1d;
      font-size: 18px;
      font-weight: 800;
      margin: 0 0 15px 0;
    }
    
    .duplicate-summary p {
      margin: 8px 0;
      color: #991b1b;
      font-size: 14px;
      font-weight: 600;
      line-height: 1.8;
    }
    
    .committees-list {
      background: #fff7ed;
      padding: 15px;
      border-radius: 6px;
      margin-top: 15px;
      border: 2px solid #fdba74;
    }
    
    .committees-list h3 {
      color: #9a3412;
      font-size: 15px;
      font-weight: 700;
      margin: 0 0 12px 0;
    }
    
    .committee-item {
      padding: 10px;
      background: white;
      margin-bottom: 8px;
      border-radius: 4px;
      border-right: 3px solid #fb923c;
      font-size: 13px;
    }
    
    .committee-item strong {
      color: #9a3412;
    }
    
    .info-section {
      background: #fef2f2;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
      border-right: 4px solid #b91c1c;
    }
    
    .info-section p {
      margin: 0;
      color: #7f1d1d;
      font-size: 14px;
      font-weight: 600;
      line-height: 1.6;
    }
    
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .data-table th {
      background: #0f3a73;
      color: white;
      padding: 12px;
      text-align: right;
      font-weight: 700;
      font-size: 13px;
      border: 1px solid #0a2951;
    }
    
    .data-table td {
      padding: 10px 12px;
      border: 1px solid #e5e7eb;
      font-size: 13px;
    }
    
    .data-table tr:nth-child(even) {
      background: #f8fafc;
    }
    
    .data-table tr:nth-child(odd) {
      background: white;
    }
    
    .label-cell {
      font-weight: 700;
      color: #0f3a73;
      width: 200px;
      background: #f1f5f9 !important;
    }
    
    .value-cell {
      color: #0f172a;
      word-break: break-word;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      color: #64748b;
      font-size: 12px;
    }
    
    .print-date {
      text-align: left;
      color: #64748b;
      font-size: 12px;
      margin-top: 20px;
    }
    
    .page-break {
      page-break-after: always;
    }
    
    @media print {
      body {
        padding: 0;
      }
      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>⚠️ تقرير عضو مكرر</h1>
    <p>نظام الأرشيف الإلكتروني - منظم للعضويات والاشتراكات</p>
  </div>
  
  <div class="duplicate-summary">
    <h2>📊 ملخص التكرارات</h2>
    <p><strong>عدد اللجان التي يوجد فيها هذا العضو:</strong> ${duplicateCount} لجنة نقابية</p>
    <p><strong>التنبيه:</strong> ${message || "يوجد عضو مسجّل بنفس البيانات في عدة لجان نقابية."}</p>
    
    ${committeeInfo && committeeInfo.length > 0 ? `
    <div class="committees-list">
      <h3>🏛️ اللجان النقابية المكرر فيها:</h3>
      ${committeeInfo.map((info, idx) => `
        <div class="committee-item">
          <strong>${idx + 1}.</strong> المحافظة: <strong>${info.governorate || 'غير محدد'}</strong> | 
          اللجنة: <strong>${info.union_committee || 'غير محدد'}</strong> | 
          الحالة: <strong>${info.status || 'غير محدد'}</strong>
        </div>
      `).join('')}
    </div>
    ` : ''}
  </div>
  
  <h3 style="color: #0f3a73; margin: 20px 0 10px 0; font-size: 16px;">📋 بيانات العضو التفصيلية:</h3>
  
  <table class="data-table">
    <thead>
      <tr>
        <th>البيان</th>
        <th>القيمة</th>
      </tr>
    </thead>
    <tbody>
`;

    // إضافة البيانات
    FIELD_ORDER.forEach((key) => {
      const raw = member?.[key];
      if (raw === undefined || raw === null || raw === "") return;
      
      let displayValue = String(raw);
      
      // تنسيق التواريخ
      if (key.includes('_at') && displayValue.includes('T')) {
        try {
          const date = new Date(displayValue);
          displayValue = date.toLocaleString('ar-EG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        } catch (e) {
          // إذا فشل التنسيق، اعرض القيمة كما هي
        }
      }
      
      printContent += `
      <tr>
        <td class="label-cell">${ROW_LABELS[key] || key}</td>
        <td class="value-cell">${displayValue}</td>
      </tr>
      `;
    });

    printContent += `
    </tbody>
  </table>
  
  <div class="print-date">
    تاريخ الطباعة: ${currentDate}
  </div>
  
  <div class="footer">
    <p>نظام الأرشيف الإلكتروني | منظم للعضويات والاشتراكات</p>
    <p style="margin-top: 5px; font-size: 11px;">تم إنشاء هذا التقرير تلقائياً من نظام الأرشيف الإلكتروني</p>
  </div>
  
  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
  };
  
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  // Render via portal at document.body so we escape the parent Radix Dialog's
  // focus trap & pointer-events lock; otherwise the close button is unclickable.
  const content = (
    <div
      data-testid="duplicate-member-dialog"
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,.55)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2147483647,
        padding: "16px",
        pointerEvents: "auto",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          width: "min(560px, 96vw)",
          maxHeight: "90vh",
          overflow: "hidden",
          borderRadius: "14px",
          boxShadow: "0 20px 60px rgba(0,0,0,.3)",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Cairo','Tahoma',sans-serif",
          direction: "rtl",
          borderTop: "6px solid #b91c1c",
          pointerEvents: "auto",
        }}
      >
        <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <AlertCircle size={24} color="#b91c1c" />
            <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#0f172a" }}>
              بيانات مكررة — العضو موجود مسبقاً
            </h3>
          </div>
          <button
            data-testid="duplicate-member-dialog-close-x"
            onClick={onClose}
            aria-label="إغلاق"
            style={{
              background: "transparent",
              border: 0,
              cursor: "pointer",
              color: "#475569",
              padding: 4,
              borderRadius: 6,
              display: "inline-flex",
            }}
          >
            <X size={22} />
          </button>
        </div>

        <div style={{ padding: "12px 20px 4px", background: "#fef2f2" }}>
          <p style={{ margin: "6px 0 10px", color: "#7f1d1d", fontSize: "13.5px", fontWeight: 700, lineHeight: 1.6 }}>
            {message || "يوجد عضو مسجّل بنفس البيانات في نفس اللجنة والمحافظة."}
          </p>
          
          {/* عرض عدد اللجان المكررة */}
          {duplicateCount > 1 && (
            <div style={{ 
              marginTop: "12px", 
              padding: "12px", 
              background: "#fff7ed", 
              borderRadius: "8px",
              border: "2px solid #fdba74"
            }}>
              <p style={{ 
                margin: "0 0 10px 0", 
                color: "#9a3412", 
                fontSize: "14px", 
                fontWeight: 800 
              }}>
                📊 العضو مكرر في {duplicateCount} لجنة نقابية:
              </p>
              {committeeInfo && committeeInfo.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {committeeInfo.map((info, idx) => (
                    <div 
                      key={idx}
                      style={{
                        padding: "8px 10px",
                        background: "white",
                        borderRadius: "6px",
                        borderRight: "3px solid #fb923c",
                        fontSize: "12.5px",
                        color: "#7c2d12"
                      }}
                    >
                      <strong>{idx + 1}.</strong> المحافظة: <strong>{info.governorate || 'غير محدد'}</strong> | 
                      اللجنة: <strong>{info.union_committee || 'غير محدد'}</strong> | 
                      الحالة: <strong>{info.status || 'غير محدد'}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: "12px 20px 16px", overflowY: "auto", flex: 1 }}>
          <div style={{ marginBottom: 8, fontSize: "12.5px", color: "#475569", fontWeight: 700 }}>
            بيانات العضو الموجود في النظام:
          </div>
          <div
            data-testid="duplicate-member-dialog-data"
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: "10px",
              overflow: "hidden",
              background: "#fff",
            }}
          >
            {FIELD_ORDER.map((key, idx) => {
              const raw = member?.[key];
              if (raw === undefined || raw === null || raw === "") return null;
              return (
                <div
                  key={key}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "150px 1fr",
                    gap: "10px",
                    padding: "8px 12px",
                    background: idx % 2 === 0 ? "#f8fafc" : "#fff",
                    borderBottom: "1px solid #f1f5f9",
                    fontSize: "13px",
                  }}
                >
                  <div style={{ fontWeight: 700, color: "#0f3a73" }}>{ROW_LABELS[key]}</div>
                  <div style={{ color: "#0f172a", wordBreak: "break-word" }}>{String(raw)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid #e5e7eb", background: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
          <button
            onClick={handlePrint}
            style={{
              background: "#059669",
              color: "#fff",
              border: 0,
              padding: "9px 22px",
              borderRadius: "8px",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "13.5px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Printer size={18} />
            طباعة التقرير
          </button>
          
          <button
            data-testid="duplicate-member-dialog-close-btn"
            onClick={onClose}
            style={{
              background: "#0f3a73",
              color: "#fff",
              border: 0,
              padding: "9px 22px",
              borderRadius: "8px",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "13.5px",
              fontWeight: 700,
            }}
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
