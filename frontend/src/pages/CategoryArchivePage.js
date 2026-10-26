import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { BadgeDollarSign, CheckCircle2, Clock, FileMinus, FileSearch, Inbox, Loader2, Save, Search, Send, Trash2, UploadCloud, UserMinus } from "lucide-react";
import AppShell from "../components/AppShell";
import GatewayHero from "../components/GatewayHero";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Textarea } from "../components/ui/textarea";
import { API_BASE, api, getErrorMessage } from "../lib/api";

const CATEGORY_META = {
  pension:          { label: "المعاش",         icon: BadgeDollarSign, parent: "financial", parentLabel: "الموقف المالي", isLetter: false },
  resignations:     { label: "استقالات",       icon: FileMinus,       parent: "financial", parentLabel: "الموقف المالي", isLetter: false },
  dropout:          { label: "إسقاط",          icon: UserMinus,       parent: "financial", parentLabel: "الموقف المالي", isLetter: false },
  aid_pending:      { label: "إعانات في انتظار الموافقة", icon: Clock,          parent: "aid", parentLabel: "الإعانات", isLetter: false, grandParent: "financial", grandParentLabel: "الموقف المالي" },
  aid_disbursed:    { label: "إعانات تم صرفها",          icon: CheckCircle2,   parent: "aid", parentLabel: "الإعانات", isLetter: false, grandParent: "financial", grandParentLabel: "الموقف المالي" },
};

const PATH_TO_CATEGORY = {
  pension: "pension",
  resignations: "resignations",
  dropout: "dropout",
  "aid/pending": "aid_pending",
  "aid/disbursed": "aid_disbursed",
};

const emptyForm = {
  name: "",
  national_id: "",
  membership_number: "",
  record_date: new Date().toISOString().slice(0, 10),
  reference_number: "",
  subject: "",
  notes: "",
};

export default function CategoryArchivePage() {
  const params = useParams();
  const location = useLocation();
  const { id, category, subcategory } = params;
  const categoryKey = useMemo(() => {
    if (subcategory) {
      if (location.pathname.includes("/aid/")) return PATH_TO_CATEGORY[`aid/${subcategory}`];
      if (location.pathname.includes("/letters/")) return PATH_TO_CATEGORY[`letters/${subcategory}`];
    }
    return PATH_TO_CATEGORY[category];
  }, [location.pathname, category, subcategory]);
  const meta = CATEGORY_META[categoryKey];

  const [records, setRecords] = useState([]);
  const [department, setDepartment] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [documentRecord, setDocumentRecord] = useState(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const backHref = useMemo(() => {
    if (!meta) return `/project/${id}/financial`;
    if (meta.parent === "letters") return `/project/${id}/financial/letters`;
    if (meta.parent === "aid") return `/project/${id}/financial/aid`;
    return `/project/${id}/financial`;
  }, [meta, id]);

  const loadRecords = async () => {
    if (!categoryKey) return;
    const params = new URLSearchParams({ department_id: id, category: categoryKey });
    if (search.trim()) params.set("search", search.trim());
    const { data } = await api.get(`/category-records?${params.toString()}`);
    setRecords(data);
  };

  useEffect(() => {
    if (!categoryKey) return;
    (async () => {
      try {
        const { data: deps } = await api.get("/departments");
        setDepartment(deps.find((d) => d.id === id) || null);
        await loadRecords();
      } catch (err) {
        setError(getErrorMessage(err));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, categoryKey]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (categoryKey) loadRecords().catch((err) => setError(getErrorMessage(err)));
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const uploadDocument = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    setStatus("جاري رفع الملف...");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const { data } = await api.post("/documents/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setDocumentRecord(data);
      setStatus("تم رفع الملف. أكمل بيانات السجل ثم احفظه.");
      if (data?.extracted_fields) {
        const ef = data.extracted_fields;
        setForm((prev) => ({
          ...prev,
          name: prev.name || ef.name || "",
          national_id: prev.national_id || ef.national_id || "",
          membership_number: prev.membership_number || ef.membership_number || "",
        }));
      }
    } catch (err) {
      setError(getErrorMessage(err));
      setStatus("");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  };

  const saveRecord = async (event) => {
    event.preventDefault();
    if (!categoryKey) return;
    setBusy(true);
    setError("");
    setStatus("جاري حفظ السجل...");
    try {
      await api.post("/category-records", {
        department_id: id,
        category: categoryKey,
        document_id: documentRecord?.id || "",
        ...form,
      });
      setForm(emptyForm);
      setDocumentRecord(null);
      setStatus("تم حفظ السجل بنجاح.");
      await loadRecords();
    } catch (err) {
      setError(getErrorMessage(err));
      setStatus("");
    } finally {
      setBusy(false);
    }
  };

  const removeRecord = async (recordId) => {
    if (!window.confirm("هل تريد حذف هذا السجل؟")) return;
    try {
      await api.delete(`/category-records/${recordId}`);
      await loadRecords();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  if (!meta) {
    return (
      <AppShell title="بوابة غير معروفة" subtitle="">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700" data-testid="category-not-found">البوابة المطلوبة غير معروفة.</div>
      </AppShell>
    );
  }

  return (
    <AppShell title={meta.label} subtitle={`${department?.name || "المشروع"} — ${meta.parentLabel} / ${meta.label}`}>
      <div className="space-y-7" data-testid={`category-archive-${categoryKey}`}>
        <GatewayHero
          icon={meta.icon}
          badge={meta.isLetter ? "بوابة خطابات" : "بوابة قرارات"}
          title={meta.label}
          subtitle={`أرشيف ${meta.label} لأعضاء ${department?.name || "المشروع"}.`}
          crumbs={[
            { to: "/departments", label: "الإدارات" },
            { to: `/project/${id}`, label: department?.name || "مشروع التكافل الاجتماعي" },
            { to: `/project/${id}/financial`, label: "الموقف المالي" },
            ...(meta.grandParent ? [{ to: `/project/${id}/financial/${meta.parent}`, label: meta.parentLabel }] : []),
            { label: meta.label },
          ]}
          stats={[{ key: "records", label: meta.isLetter ? "إجمالي الخطابات" : "إجمالي السجلات", value: records.length }]}
        />

        <div className="grid gap-6 xl:grid-cols-[420px_1fr]" data-testid="category-archive-layout">
          <section className="space-y-6" data-testid="category-form-section">
          <Card className="rounded-lg border-slate-200 shadow-none" data-testid="category-attach-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <UploadCloud className="h-5 w-5 text-[#0047AB]" /> إرفاق ملف (PDF/صورة)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <label className="flex h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100" data-testid="category-upload-label">
                <UploadCloud className="h-6 w-6 text-[#0047AB]" />
                <span>{documentRecord ? documentRecord.original_name : "اختر ملف للرفع"}</span>
                <input type="file" accept="application/pdf,image/*" className="sr-only" onChange={uploadDocument} data-testid="category-upload-input" />
              </label>
              {documentRecord && (
                <p className="mt-3 text-xs text-emerald-700" data-testid="category-upload-status">تم تجهيز الملف للحفظ مع السجل.</p>
              )}
              {(status || error) && (
                <div className={`mt-4 rounded-lg border p-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`} data-testid="category-status-message">
                  {error || status}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-lg border-slate-200 shadow-none" data-testid="category-form-card">
            <CardHeader>
              <CardTitle className="text-xl">بيانات السجل</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveRecord} className="grid gap-4" data-testid="category-record-form">
                {meta.isLetter ? (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="cat-subject">موضوع الخطاب</Label>
                      <Input id="cat-subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} data-testid="category-input-subject" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="cat-reference">الرقم المرجعي</Label>
                      <Input id="cat-reference" value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} data-testid="category-input-reference" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="cat-record-date">تاريخ الخطاب</Label>
                      <Input id="cat-record-date" type="date" value={form.record_date} onChange={(e) => setForm({ ...form, record_date: e.target.value })} data-testid="category-input-record-date" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="cat-name">الجهة / العضو</Label>
                      <Input id="cat-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="category-input-name" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="cat-name">اسم العضو</Label>
                      <Input id="cat-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="category-input-name" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="cat-national">الرقم القومي</Label>
                      <Input id="cat-national" value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} data-testid="category-input-national" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="cat-membership">رقم العضوية</Label>
                      <Input id="cat-membership" value={form.membership_number} onChange={(e) => setForm({ ...form, membership_number: e.target.value })} data-testid="category-input-membership" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="cat-reference">رقم القرار / المرجع</Label>
                      <Input id="cat-reference" value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} data-testid="category-input-reference" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="cat-record-date">تاريخ القرار</Label>
                      <Input id="cat-record-date" type="date" value={form.record_date} onChange={(e) => setForm({ ...form, record_date: e.target.value })} data-testid="category-input-record-date" />
                    </div>
                  </>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="cat-notes">ملاحظات</Label>
                  <Textarea id="cat-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} data-testid="category-input-notes" />
                </div>
                <Button type="submit" disabled={busy} className="bg-[#0047AB] hover:bg-[#003380]" data-testid="category-save-button">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} حفظ السجل
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white" data-testid="category-list-section">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5" data-testid="category-list-header">
            <div>
              <h2 className="text-2xl font-bold text-slate-950">سجلات {meta.label}</h2>
              <p className="mt-1 text-sm text-slate-500" data-testid="category-records-count">{records.length} سجل</p>
            </div>
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم / الرقم القومي / المرجع" className="pe-10" data-testid="category-search-input" />
            </div>
          </div>
          <div className="p-2">
            <Table data-testid="category-table">
              <TableHeader>
                <TableRow>
                  {meta.isLetter ? (
                    <>
                      <TableHead className="text-start">الموضوع</TableHead>
                      <TableHead className="text-start">الجهة / العضو</TableHead>
                      <TableHead className="text-start">المرجع</TableHead>
                      <TableHead className="text-start">التاريخ</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead className="text-start">الاسم</TableHead>
                      <TableHead className="text-start">الرقم القومي</TableHead>
                      <TableHead className="text-start">رقم العضوية</TableHead>
                      <TableHead className="text-start">رقم القرار</TableHead>
                      <TableHead className="text-start">تاريخ القرار</TableHead>
                    </>
                  )}
                  <TableHead className="text-start">الملف</TableHead>
                  <TableHead className="text-start">إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((rec) => (
                  <TableRow key={rec.id} data-testid={`category-row-${rec.id}`}>
                    {meta.isLetter ? (
                      <>
                        <TableCell className="font-semibold text-slate-950" data-testid={`category-subject-${rec.id}`}>{rec.subject || "-"}</TableCell>
                        <TableCell data-testid={`category-name-${rec.id}`}>{rec.name || "-"}</TableCell>
                        <TableCell data-testid={`category-reference-${rec.id}`}>{rec.reference_number || "-"}</TableCell>
                        <TableCell data-testid={`category-date-${rec.id}`}>{rec.record_date || "-"}</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="font-semibold text-slate-950" data-testid={`category-name-${rec.id}`}>{rec.name || "-"}</TableCell>
                        <TableCell data-testid={`category-national-${rec.id}`}>{rec.national_id || "-"}</TableCell>
                        <TableCell data-testid={`category-membership-${rec.id}`}>{rec.membership_number || "-"}</TableCell>
                        <TableCell data-testid={`category-reference-${rec.id}`}>{rec.reference_number || "-"}</TableCell>
                        <TableCell data-testid={`category-date-${rec.id}`}>{rec.record_date || "-"}</TableCell>
                      </>
                    )}
                    <TableCell data-testid={`category-document-${rec.id}`}>
                      {rec.document_url ? (
                        <Button asChild variant="outline" size="sm" data-testid={`category-document-link-${rec.id}`}>
                          <a href={`${API_BASE.replace("/api", "")}${rec.document_url}`} target="_blank" rel="noreferrer">
                            <FileSearch className="h-4 w-4" /> فتح
                          </a>
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell data-testid={`category-actions-${rec.id}`}>
                      <Button variant="ghost" size="sm" onClick={() => removeRecord(rec.id)} className="text-red-600 hover:text-red-700" data-testid={`category-delete-${rec.id}`}>
                        <Trash2 className="h-4 w-4" /> حذف
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!records.length && (
                  <TableRow data-testid="category-empty-row">
                    <TableCell colSpan={meta.isLetter ? 6 : 7} className="py-12 text-center text-slate-500" data-testid="category-empty-message">
                      لا توجد سجلات بعد. أضف أول سجل من النموذج بجانب.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="border-t border-slate-200 p-5">
            <Button asChild variant="outline" data-testid="category-back-button">
              <Link to={backHref}>العودة</Link>
            </Button>
          </div>
        </section>
        </div>
      </div>
    </AppShell>
  );
}
