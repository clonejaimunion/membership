import { useState, useEffect } from "react";
import { Calculator, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { api, getErrorMessage } from "../lib/api";

const RELATION_TYPES = [
  { value: "زوج", label: "زوج" },
  { value: "زوجة", label: "زوجة" },
  { value: "أب", label: "أب" },
  { value: "أم", label: "أم" },
  { value: "ابن", label: "ابن" },
  { value: "ابنة", label: "ابنة" },
];

export default function InheritanceCalculatorDialog({ open, onOpenChange, aid }) {
  const [totalAmount, setTotalAmount] = useState(0);
  const [beneficiaries, setBeneficiaries] = useState([{ name: "", relation: "" }]);
  const [results, setResults] = useState([]);
  const [validation, setValidation] = useState(null);
  const [summaryExplanation, setSummaryExplanation] = useState("");
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // حالات استيراد النص الشرعي
  const [shariahText, setShariahText] = useState("");
  const [parsingText, setParsingText] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [showImportSection, setShowImportSection] = useState(false);

  // جلب البيانات المحفوظة سابقاً عند فتح الـ dialog
  useEffect(() => {
    if (open && aid) {
      loadSavedData();
    }
  }, [open, aid]);

  const loadSavedData = async () => {
    setLoading(true);
    try {
      // جلب أصل المبلغ من الإعانة
      const amount = aid.amount || 0;
      setTotalAmount(amount);

      // جلب المستحقين المحفوظين إن وجدوا
      const { data } = await api.get(`/aids/${aid.id}/beneficiaries`);
      
      if (data.found && data.beneficiaries && data.beneficiaries.length > 0) {
        // توجد بيانات محفوظة مسبقاً
        setBeneficiaries(data.beneficiaries.map(b => ({ name: b.name, relation: b.relation })));
        setResults(data.beneficiaries);
        setSummaryExplanation(data.summary_explanation || "");
        setValidation({
          is_valid: true,
          total_amount: data.total_amount,
          total_distributed: data.beneficiaries.reduce((sum, b) => sum + (b.amount || 0), 0),
        });
      } else {
        // لا توجد بيانات، استخدم القيم الافتراضية
        const defaultBenName = aid.member_beneficiary_name || "";
        if (defaultBenName) {
          setBeneficiaries([{ name: defaultBenName, relation: "" }]);
        } else {
          setBeneficiaries([{ name: "", relation: "" }]);
        }
        setResults([]);
        setValidation(null);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const addBeneficiary = () => {
    setBeneficiaries([...beneficiaries, { name: "", relation: "" }]);
  };

  const removeBeneficiary = (index) => {
    if (beneficiaries.length === 1) {
      toast.error("يجب أن يكون هناك مستحق واحد على الأقل");
      return;
    }
    setBeneficiaries(beneficiaries.filter((_, i) => i !== index));
  };

  const updateBeneficiary = (index, field, value) => {
    const updated = [...beneficiaries];
    updated[index][field] = value;
    setBeneficiaries(updated);
  };

  const calculateDistribution = async () => {
    // التحقق من البيانات
    if (totalAmount <= 0) {
      toast.error("أصل المبلغ يجب أن يكون أكبر من صفر");
      return;
    }

    const incompleteBeneficiaries = beneficiaries.filter(b => !b.name.trim() || !b.relation);
    if (incompleteBeneficiaries.length > 0) {
      toast.error("يرجى إدخال الاسم ودرجة القرابة لجميع المستحقين");
      return;
    }

    setCalculating(true);
    try {
      const { data } = await api.post(`/aids/${aid.id}/calculate-beneficiaries`, {
        total_amount: totalAmount,
        beneficiaries: beneficiaries,
      });

      setResults(data.results || []);
      setValidation(data.validation || null);
      setSummaryExplanation(data.summary_explanation || "");
      
      if (data.validation && data.validation.is_valid) {
        toast.success("تم حساب التوزيع بنجاح");
      } else {
        toast.warning("تم الحساب لكن هناك فرق في التوزيع");
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCalculating(false);
    }
  };

  // تحليل نص الإعلام الشرعي
  const parseShariahText = async () => {
    if (!shariahText.trim()) {
      toast.error("يرجى إدخال نص الإعلام الشرعي");
      return;
    }

    setParsingText(true);
    try {
      const { data } = await api.post(`/aids/${aid.id}/parse-shariah-text`, {
        text: shariahText,
      });

      console.log("Parse response:", data); // DEBUG

      if (data.success) {
        // ملء جدول المستحقين تلقائياً
        if (data.beneficiaries && data.beneficiaries.length > 0) {
          console.log("Setting beneficiaries:", data.beneficiaries); // DEBUG
          setBeneficiaries(data.beneficiaries);
          toast.success(`✓ تم استخراج ${data.beneficiaries.length} مستحق من النص`);
          
          // إغلاق قسم الاستيراد وإظهار المستحقين
          setShowImportSection(false);
          setShariahText("");
          setParsedData(null);
        } else {
          console.log("No beneficiaries in response"); // DEBUG
          toast.error("لم يتم العثور على مستحقين في النص");
        }
      } else {
        toast.error(data.error || "فشل تحليل النص");
        setParsedData(null);
      }
    } catch (err) {
      console.error("Parse error:", err); // DEBUG
      toast.error(getErrorMessage(err));
      setParsedData(null);
    } finally {
      setParsingText(false);
    }
  };

  // تطبيق النتائج المستخرجة على المستحقين
  const applyParsedResults = () => {
    if (!parsedData || !parsedData.beneficiaries) {
      toast.error("لا توجد نتائج لتطبيقها");
      return;
    }

    setBeneficiaries(parsedData.beneficiaries);
    setParsedData(null);
    setShariahText("");
    setShowImportSection(false);
    toast.success("تم تطبيق النتائج على قائمة المستحقين");
  };

  const saveResults = async () => {
    if (results.length === 0) {
      toast.error("يرجى حساب التوزيع أولاً");
      return;
    }

    setSaving(true);
    try {
      await api.post(`/aids/${aid.id}/save-beneficiaries`, {
        aid_id: aid.id,
        total_amount: totalAmount,
        beneficiaries: results,
        summary_explanation: summaryExplanation,
      });

      toast.success("تم حفظ بيانات المستحقين بنجاح");
      onOpenChange(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    const defaultBenName = aid?.member_beneficiary_name || "";
    if (defaultBenName) {
      setBeneficiaries([{ name: defaultBenName, relation: "" }]);
    } else {
      setBeneficiaries([{ name: "", relation: "" }]);
    }
    setResults([]);
    setValidation(null);
  };

  if (!aid) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Calculator className="h-5 w-5 text-purple-600" />
            حاسبة توزيع الإعانة على المستحقين
          </DialogTitle>
          <DialogDescription>
            حساب توزيع الإعانة حسب قواعد الميراث الشرعي - {aid.member_name}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* قسم استيراد من الإعلام الشرعي */}
            <div className="border-2 border-dashed border-purple-300 rounded-lg p-4 bg-purple-50/50">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-purple-900">📄 استيراد من الإعلام الشرعي / نص المحكمة</h3>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => setShowImportSection(!showImportSection)}
                >
                  {showImportSection ? "إخفاء" : "عرض"}
                </Button>
              </div>

              {showImportSection && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm">الصق نص الإعلام الشرعي أو نص المحكمة هنا:</Label>
                    <textarea
                      value={shariahText}
                      onChange={(e) => setShariahText(e.target.value)}
                      placeholder="مثال: توفي المرحوم ... وانحصر إرثه الشرعي في زوجته فاطمة أحمد وبناته عائشة وخديجة ومريم..."
                      className="w-full mt-1 p-3 border border-slate-300 rounded-md min-h-[120px] font-arabic text-sm"
                      dir="rtl"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={parseShariahText}
                      disabled={parsingText || !shariahText.trim()}
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {parsingText ? (
                        <><Loader2 className="h-4 w-4 animate-spin ml-1" /> جاري التحليل...</>
                      ) : (
                        <><Calculator className="h-4 w-4 ml-1" /> تحليل النص</>
                      )}
                    </Button>

                    {parsedData && parsedData.success && (
                      <Button 
                        onClick={applyParsedResults}
                        size="sm"
                        variant="outline"
                        className="border-green-600 text-green-700 hover:bg-green-50"
                      >
                        ✓ تطبيق النتائج
                      </Button>
                    )}
                  </div>

                  {/* معاينة النتائج المستخرجة */}
                  {parsedData && parsedData.success && (
                    <div className="mt-3 p-3 bg-white border border-green-300 rounded-md">
                      <h4 className="text-sm font-bold text-green-900 mb-2">✓ تم استخراج المستحقين:</h4>
                      <div className="space-y-1">
                        {parsedData.beneficiaries.map((ben, idx) => (
                          <div key={idx} className="text-sm text-slate-700 flex gap-2">
                            <span className="font-medium">{idx + 1}.</span>
                            <span className="font-bold">{ben.name}</span>
                            <span className="text-slate-500">({ben.relation})</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-slate-600 mt-2">
                        اضغط "تطبيق النتائج" لإضافتهم إلى قائمة المستحقين أدناه
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* أصل المبلغ */}
            <div>
              <Label htmlFor="total-amount">أصل مبلغ الإعانة المعتمد (ج.م)</Label>
              <Input
                id="total-amount"
                type="number"
                step="0.01"
                value={totalAmount}
                onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)}
                className="mt-1 text-lg font-bold"
              />
            </div>

            {/* المستحقون */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-bold">المستحقون</Label>
                <Button size="sm" variant="outline" onClick={addBeneficiary}>
                  <Plus className="h-4 w-4 ml-1" /> إضافة مستحق
                </Button>
              </div>

              <div className="space-y-3">
                {beneficiaries.map((ben, idx) => (
                  <div key={idx} className="flex gap-3 items-start p-3 border rounded-lg bg-slate-50">
                    <div className="flex-1">
                      <Label className="text-xs text-slate-600">الاسم</Label>
                      <Input
                        value={ben.name}
                        onChange={(e) => updateBeneficiary(idx, "name", e.target.value)}
                        placeholder="اسم المستحق"
                        className="mt-1"
                      />
                    </div>
                    <div className="w-48">
                      <Label className="text-xs text-slate-600">درجة القرابة</Label>
                      <Select
                        value={ben.relation}
                        onValueChange={(value) => updateBeneficiary(idx, "relation", value)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="اختر..." />
                        </SelectTrigger>
                        <SelectContent>
                          {RELATION_TYPES.map((rel) => (
                            <SelectItem key={rel.value} value={rel.value}>
                              {rel.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 mt-6"
                      onClick={() => removeBeneficiary(idx)}
                      disabled={beneficiaries.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* زر الحساب */}
            <div className="flex gap-3">
              <Button onClick={calculateDistribution} disabled={calculating} className="bg-purple-600 hover:bg-purple-700">
                {calculating ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Calculator className="h-4 w-4 ml-2" />}
                حساب التوزيع
              </Button>
              <Button variant="outline" onClick={resetForm}>
                <X className="h-4 w-4 ml-2" /> إعادة تعيين
              </Button>
            </div>

            {/* النتائج */}
            {results.length > 0 && (
              <div className="border-t pt-4">
                <h3 className="text-lg font-bold text-slate-700 mb-3">نتائج التوزيع</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-purple-50">
                        <th className="border border-slate-300 px-2 py-2 text-right">#</th>
                        <th className="border border-slate-300 px-2 py-2 text-right">الاسم</th>
                        <th className="border border-slate-300 px-2 py-2 text-center">درجة القرابة</th>
                        <th className="border border-slate-300 px-2 py-2 text-center">الفرض الأصلي</th>
                        <th className="border border-slate-300 px-2 py-2 text-center">النسبة الشرعية</th>
                        <th className="border border-slate-300 px-2 py-2 text-center">الرد</th>
                        <th className="border border-slate-300 px-2 py-2 text-center">النسبة النهائية</th>
                        <th className="border border-slate-300 px-2 py-2 text-center">نوع الاستحقاق</th>
                        <th className="border border-slate-300 px-2 py-2 text-center">المبلغ (ج.م)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        // تجميع النتائج حسب share_group_key لحساب rowspan
                        const groupMap = new Map();
                        results.forEach((result, idx) => {
                          const key = result.share_group_key || `${idx}_unique`;
                          if (!groupMap.has(key)) {
                            groupMap.set(key, []);
                          }
                          groupMap.get(key).push(idx);
                        });

                        // تحديد الصف الأول في كل مجموعة
                        const firstInGroup = new Set();
                        groupMap.forEach((indices) => {
                          if (indices.length > 0) {
                            firstInGroup.add(indices[0]);
                          }
                        });

                        return results.map((result, idx) => {
                          const key = result.share_group_key || `${idx}_unique`;
                          const groupIndices = groupMap.get(key) || [idx];
                          const rowspan = groupIndices.length;
                          const isFirstInGroup = firstInGroup.has(idx);

                          return (
                            <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                              <td className="border border-slate-300 px-2 py-2 text-center">{idx + 1}</td>
                              <td className="border border-slate-300 px-2 py-2 font-medium">{result.name}</td>
                              <td className="border border-slate-300 px-2 py-2 text-center">{result.relation}</td>
                              <td className="border border-slate-300 px-2 py-2 text-center" data-testid={`inheritance-base-${idx}`}>{result.base_share_fraction || "-"}</td>
                              {/* دمج خلية النسبة الشرعية للمستحقين المتشابهين */}
                              {isFirstInGroup && (
                                <td 
                                  className="border border-slate-300 px-2 py-2 text-center font-bold text-purple-700" 
                                  rowSpan={rowspan}
                                  style={{verticalAlign: 'middle'}}
                                >
                                  {result.share_group_text || result.base_share_arabic || result.percentage_arabic || "-"}
                                </td>
                              )}
                              <td className="border border-slate-300 px-2 py-2 text-center text-amber-700 font-medium">
                                {result.radd_fraction || "-"}
                              </td>
                              <td className="border border-slate-300 px-2 py-2 text-center font-bold" data-testid={`inheritance-final-${idx}`}>{result.final_share_fraction || result.percentage || "-"}</td>
                              <td className="border border-slate-300 px-2 py-2 text-center text-xs" data-testid={`inheritance-type-${idx}`}>{result.share_type || result.inheritance_type || "-"}</td>
                              <td className="border border-slate-300 px-2 py-2 text-center font-bold text-emerald-700">
                                {result.amount.toFixed(2)}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                    <tfoot>
                      <tr className="bg-emerald-50 font-bold">
                        <td colSpan={8} className="border border-slate-300 px-2 py-2 text-right">
                          الإجمالي الموزع:
                        </td>
                        <td className="border border-slate-300 px-2 py-2 text-center text-emerald-700">
                          {validation?.total_distributed?.toFixed(2) || "0.00"}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* التحقق */}
                {validation && (
                  <div className={`mt-3 p-3 rounded-lg ${validation.is_valid ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                    <p className="text-sm font-medium">
                      {validation.is_valid ? (
                        <>✅ التوزيع صحيح - الإجمالي الموزع = أصل المبلغ</>
                      ) : (
                        <>⚠️ تحذير: يوجد فرق {validation.difference?.toFixed(2)} ج.م</>
                      )}
                    </p>
                  </div>
                )}

                {/* التفسير الشرعي */}
                {summaryExplanation && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="text-base font-bold text-blue-900 mb-3 flex items-center gap-2">
                      📜 التفسير الشرعي للتوزيع
                    </h4>
                    <div className="text-sm text-blue-800 leading-relaxed whitespace-pre-line">
                      {summaryExplanation}
                    </div>
                  </div>
                )}

                {/* تفاصيل كل مستحق */}
                <div className="mt-4">
                  <h4 className="text-base font-bold text-slate-700 mb-3">تفاصيل كل مستحق:</h4>
                  <div className="space-y-2">
                    {results.map((result, idx) => (
                      result.explanation && (
                        <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded text-sm text-slate-700">
                          <span className="font-bold text-purple-700">{idx + 1}.</span> {result.explanation}
                        </div>
                      )
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={saveResults} disabled={saving || results.length === 0} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Save className="h-4 w-4 ml-2" />}
            حفظ النتائج
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
