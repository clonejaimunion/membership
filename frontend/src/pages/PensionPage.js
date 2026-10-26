import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, Printer, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { api, getErrorMessage } from "../lib/api";
import * as XLSX from "xlsx";
import "../styles/disclosure.css";

const ROWS_PER_PAGE = 28;
const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out.length ? out : [[]];
};

export default function PensionPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [department, setDepartment] = useState(null);
  const [governorates, setGovernorates] = useState([]);
  const [committeesByGov, setCommitteesByGov] = useState({});
  
  // الفلاتر
  const [governorate, setGovernorate] = useState("");
  const [unionCommittee, setUnionCommittee] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  
  const [allMembers, setAllMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showReport, setShowReport] = useState(false);

  // جلب البيانات الأولية
  useEffect(() => {
    (async () => {
      try {
        const [{ data: deps }, { data: tax }] = await Promise.all([
          api.get("/departments"),
          api.get(`/classifications?department_id=${id}`),
        ]);
        setDepartment(deps.find((d) => d.id === id) || null);
        setGovernorates(tax.governorates || []);
        setCommitteesByGov(tax.committees_by_governorate || {});
      } catch (err) {
        toast.error(getErrorMessage(err));
      }
    })();
  }, [id]);

  // اللجان المتاحة حسب المحافظة المختارة
  const availableCommittees = useMemo(() => {
    if (!governorate) return [];
    return committeesByGov[governorate] || [];
  }, [governorate, committeesByGov]);

  // جلب تقرير المعاش
  const loadReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ department_id: id });
      if (governorate) params.set("governorate", governorate);
      if (unionCommittee) params.set("union_committee", unionCommittee);
      if (fromDate) params.set("from_date", fromDate);
      if (toDate) params.set("to_date", toDate);
      if (search) params.set("search", search);

      // جلب جميع الصفحات
      let allData = [];
      let currentPage = 1;
      let hasMore = true;

      while (hasMore) {
        params.set("page", currentPage);
        params.set("page_size", 100);
        const { data } = await api.get(`/reports/pension?${params.toString()}`);
        allData = [...allData, ...(data.members || [])];
        
        if (data.page >= data.total_pages || data.members.length === 0) {
          hasMore = false;
        } else {
          currentPage++;
        }
      }

      setAllMembers(allData);
      setShowReport(true);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // تصدير Excel
  const exportToExcel = () => {
    if (allMembers.length === 0) {
      toast.error("لا توجد بيانات للتصدير");
      return;
    }

    const data = allMembers.map((m, idx) => ({
      "#": idx + 1,
      "الاسم": m.name || "",
      "الرقم القومي": m.national_id || "",
      "تاريخ الميلاد": m.birth_date || "",
      "رقم العضوية": m.membership_number || "",
      "المحافظة": m.governorate || "",
      "اللجنة النقابية": m.union_committee || "",
      "تاريخ بلوغ المعاش": m.retirement_date || "",
      "سن المعاش": m.retirement_age || "",
    }));
    
    data.push({
      "#": "",
      "الاسم": "",
      "الرقم القومي": "",
      "تاريخ الميلاد": "",
      "رقم العضوية": "",
      "المحافظة": "",
      "اللجنة النقابية": `إجمالي: ${allMembers.length}`,
      "تاريخ بلوغ المعاش": "",
      "سن المعاش": "",
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "تقرير المعاش");
    XLSX.writeFile(wb, `تقرير_المعاش_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("تم تصدير التقرير إلى Excel");
  };

  // طباعة
  const handlePrint = () => {
    if (allMembers.length === 0) {
      toast.error("لا توجد بيانات للطباعة");
      return;
    }
    window.print();
  };

  // تغيير المحافظة
  const handleGovernorateChange = (value) => {
    setGovernorate(value);
    setUnionCommittee("");
  };

  if (!showReport) {
    return (
      <div className="p-6 max-w-4xl mx-auto screen-only">
        <div className="mb-6">
          <button
            onClick={() => nav(`/project/${id}/financial`)}
            className="text-sm text-slate-600 hover:text-slate-900 mb-2"
          >
            ← العودة للموقف المالي
          </button>
          <h1 className="text-2xl font-bold text-slate-900">تقرير المعاش</h1>
          <p className="text-sm text-slate-600 mt-1">
            تقرير مفصل بأسماء الأعضاء الذين بلغوا سن المعاش
          </p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-700 mb-4">الفلاتر والبحث</h3>
            
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label htmlFor="from-date">من تاريخ</Label>
                <Input
                  id="from-date"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="to-date">إلى تاريخ</Label>
                <Input
                  id="to-date"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="governorate">المحافظة</Label>
                <Select value={governorate} onValueChange={handleGovernorateChange}>
                  <SelectTrigger id="governorate" className="mt-1">
                    <SelectValue placeholder="الكل" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">الكل</SelectItem>
                    {governorates.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="committee">اللجنة النقابية</Label>
                <Select value={unionCommittee} onValueChange={setUnionCommittee} disabled={!governorate}>
                  <SelectTrigger id="committee" className="mt-1">
                    <SelectValue placeholder="الكل" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">الكل</SelectItem>
                    {availableCommittees.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="search">بحث (الاسم - الرقم القومي - رقم العضوية - اسم اللجنة)</Label>
              <Input
                id="search"
                type="text"
                placeholder="ابحث..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button onClick={loadReport} disabled={loading}>
                {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                عرض التقرير
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="screen-only p-6 max-w-4xl mx-auto mb-4">
        <div className="flex gap-3">
          <Button onClick={() => setShowReport(false)} variant="outline">
            ← تعديل الفلاتر
          </Button>
          <Button onClick={handlePrint} variant="outline">
            <Printer className="ml-2 h-4 w-4" />
            طباعة
          </Button>
          <Button onClick={exportToExcel} variant="outline">
            <FileSpreadsheet className="ml-2 h-4 w-4" />
            تصدير Excel
          </Button>
        </div>
      </div>

      <PensionReport 
        members={allMembers}
        departmentName={department?.name || ""}
        governorate={governorate}
        unionCommittee={unionCommittee}
        fromDate={fromDate}
        toDate={toDate}
      />
    </div>
  );
}

function PensionReport({ members, departmentName, governorate, unionCommittee, fromDate, toDate }) {
  if (members.length === 0) {
    return (
      <div className="a4-sheet text-center text-slate-500">
        <div className="p-12">
          <p className="text-xl">لا توجد نتائج</p>
          <p className="text-sm mt-2">جرب تعديل الفلاتر</p>
        </div>
      </div>
    );
  }

  const pages = chunk(members, ROWS_PER_PAGE);
  
  let subtitle = "";
  if (governorate && unionCommittee) {
    subtitle = `محافظة: ${governorate} • لجنة: ${unionCommittee}`;
  } else if (governorate) {
    subtitle = `محافظة: ${governorate}`;
  } else if (unionCommittee) {
    subtitle = `لجنة: ${unionCommittee}`;
  } else {
    subtitle = "جميع المحافظات واللجان";
  }

  if (fromDate && toDate) {
    subtitle += ` • الفترة: ${fromDate} → ${toDate}`;
  } else if (fromDate) {
    subtitle += ` • من تاريخ: ${fromDate}`;
  } else if (toDate) {
    subtitle += ` • حتى تاريخ: ${toDate}`;
  }

  return (
    <>
      {pages.map((pageMembers, pi) => {
        const isLast = pi === pages.length - 1;
        return (
          <div className="a4-sheet" key={pi}>
            <ReportHeader 
              title="تقرير المعاش" 
              subtitle={subtitle}
              departmentName={departmentName}
            />
            
            <table className="a4-table">
              <thead>
                <tr>
                  <th style={{ width: "4%" }}>#</th>
                  <th style={{ width: "18%" }}>الاسم</th>
                  <th style={{ width: "10%" }}>الرقم القومي</th>
                  <th style={{ width: "10%" }}>تاريخ الميلاد</th>
                  <th style={{ width: "8%" }}>رقم العضوية</th>
                  <th style={{ width: "14%" }}>المحافظة</th>
                  <th style={{ width: "16%" }}>اللجنة النقابية</th>
                  <th style={{ width: "10%" }}>تاريخ المعاش</th>
                  <th style={{ width: "10%" }}>سن المعاش</th>
                </tr>
              </thead>
              <tbody>
                {pageMembers.map((member, i) => (
                  <tr key={member.id || i}>
                    <td className="num">{pi * ROWS_PER_PAGE + i + 1}</td>
                    <td>{member.name || "—"}</td>
                    <td className="num">{member.national_id || "—"}</td>
                    <td>{member.birth_date || "—"}</td>
                    <td className="num">{member.membership_number || "—"}</td>
                    <td>{member.governorate || "—"}</td>
                    <td>{member.union_committee || "—"}</td>
                    <td>{member.retirement_date || "—"}</td>
                    <td className="num">{member.retirement_age || "—"}</td>
                  </tr>
                ))}
                {isLast && (
                  <tr className="grand">
                    <td colSpan={8} style={{ textAlign: "center" }}>
                      إجمالي الأعضاء المتقاعدين
                    </td>
                    <td className="num">{members.length}</td>
                  </tr>
                )}
              </tbody>
            </table>
            
            <ReportFooter pageIndex={pi + 1} totalPages={pages.length} />
          </div>
        );
      })}
    </>
  );
}

function ReportHeader({ title, subtitle, departmentName }) {
  return (
    <div className="a4-header">
      <h1>{title}</h1>
      <div className="meta">
        <span>الإدارة: {departmentName}</span>
        {subtitle && <span>{subtitle}</span>}
        <span>تاريخ الطباعة: {new Date().toLocaleDateString("ar-EG")}</span>
      </div>
    </div>
  );
}

function ReportFooter({ pageIndex, totalPages }) {
  return (
    <div className="a4-footer">
      <span className="page-num" data-page={`صفحة ${pageIndex} من ${totalPages}`}></span>
    </div>
  );
}
