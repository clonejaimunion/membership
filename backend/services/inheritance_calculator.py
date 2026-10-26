"""
حاسبة توزيع الإعانات حسب قواعد الميراث الشرعي - مع دعم كامل للرد
"""
from typing import List, Dict, Any, Tuple
from fractions import Fraction


# قاموس تحويل النسب الرقمية إلى ألفاظ عربية شرعية
ARABIC_FRACTIONS = {
    Fraction(1, 2): "نصف",
    Fraction(1, 4): "ربع",
    Fraction(1, 8): "ثمن",
    Fraction(1, 3): "ثلث",
    Fraction(2, 3): "ثلثان",
    Fraction(1, 6): "سدس",
}


def fraction_to_arabic(frac: Fraction) -> str:
    """تحويل الكسر إلى اسم عربي شرعي"""
    if frac in ARABIC_FRACTIONS:
        return ARABIC_FRACTIONS[frac]
    return f"{frac.numerator}/{frac.denominator}"


class InheritanceCalculator:
    """حاسبة توزيع الإعانات على المستحقين"""
    
    RELATION_TYPES = {
        "زوج": "husband",
        "زوجة": "wife",
        "أب": "father",
        "أم": "mother",
        "ابن": "son",
        "ابنة": "daughter",
    }
    
    def __init__(self, total_amount: float, beneficiaries: List[Dict[str, Any]]):
        """
        Args:
            total_amount: أصل المبلغ المعتمد
            beneficiaries: قائمة المستحقين [{"name": "...", "relation": "زوج/زوجة/..."}]
        """
        self.total_amount = total_amount
        self.beneficiaries = beneficiaries
        self.results = []
        
    def calculate(self) -> List[Dict[str, Any]]:
        """حساب التوزيع وإرجاع النتائج"""
        if not self.beneficiaries:
            return []
        
        # تصنيف المستحقين
        classified = self._classify_beneficiaries()
        
        # حساب الحصص مع دعم الرد
        shares = self._calculate_shares_with_radd(classified)
        
        # تحويل الحصص إلى مبالغ
        self.results = self._convert_to_amounts(shares, classified)
        
        return self.results
    
    def _classify_beneficiaries(self) -> Dict[str, Any]:
        """تصنيف المستحقين حسب درجة القرابة"""
        classified = {
            "husbands": [],
            "wives": [],
            "father": None,
            "mother": None,
            "sons": [],
            "daughters": [],
        }
        
        for b in self.beneficiaries:
            relation = b.get("relation", "")
            if relation == "زوج":
                classified["husbands"].append(b)
            elif relation == "زوجة":
                classified["wives"].append(b)
            elif relation == "أب":
                classified["father"] = b
            elif relation == "أم":
                classified["mother"] = b
            elif relation == "ابن":
                classified["sons"].append(b)
            elif relation == "ابنة":
                classified["daughters"].append(b)
        
        return classified
    
    def _calculate_shares_with_radd(self, classified: Dict[str, Any]) -> List[Dict[str, Any]]:
        """حساب الحصص مع دعم كامل لحالات الرد والعَوْل"""
        shares = []
        
        # تحديد وجود الأبناء
        has_children = len(classified["sons"]) > 0 or len(classified["daughters"]) > 0
        
        # المتبقي بعد الفروض
        remaining = Fraction(1)
        
        # 1. حساب الفروض أولاً
        froud_shares = []
        
        # الزوج/الزوجة
        if classified["husbands"]:
            husband_share = Fraction(1, 4) if has_children else Fraction(1, 2)
            for husband in classified["husbands"]:
                froud_shares.append({
                    "beneficiary": husband,
                    "relation": "زوج",
                    "base_share": husband_share,
                    "base_arabic": fraction_to_arabic(husband_share),
                    "share_type": "فرض",
                    "radd_share": Fraction(0),
                    "has_awl": False,
                })
                remaining -= husband_share
        
        if classified["wives"]:
            wife_share_total = Fraction(1, 8) if has_children else Fraction(1, 4)
            wife_share_each = wife_share_total / len(classified["wives"])
            for wife in classified["wives"]:
                froud_shares.append({
                    "beneficiary": wife,
                    "relation": "زوجة",
                    "base_share": wife_share_each,
                    "base_arabic": fraction_to_arabic(wife_share_total) if len(classified["wives"]) == 1 else f"من {fraction_to_arabic(wife_share_total)}",
                    "share_type": "فرض",
                    "radd_share": Fraction(0),
                    "has_awl": False,
                })
            remaining -= wife_share_total
        
        # الأم
        if classified["mother"]:
            mother_share = Fraction(1, 6) if has_children else Fraction(1, 3)
            froud_shares.append({
                "beneficiary": classified["mother"],
                "relation": "أم",
                "base_share": mother_share,
                "base_arabic": fraction_to_arabic(mother_share),
                "share_type": "فرض",
                "radd_share": Fraction(0),
                "has_awl": False,
            })
            remaining -= mother_share
        
        # الأب مع أبناء
        if classified["father"] and has_children:
            father_share = Fraction(1, 6)
            froud_shares.append({
                "beneficiary": classified["father"],
                "relation": "أب",
                "base_share": father_share,
                "base_arabic": fraction_to_arabic(father_share),
                "share_type": "فرض",
                "radd_share": Fraction(0),
                "has_awl": False,
            })
            remaining -= father_share
        
        # 2. حساب التعصيب أو الرد
        sons_count = len(classified["sons"])
        daughters_count = len(classified["daughters"])
        
        if sons_count > 0:
            # يوجد أبناء ذكور: التعصيب (للذكر مثل حظ الأنثيين)
            total_parts = (sons_count * 2) + daughters_count
            
            if total_parts > 0:
                one_part = remaining / total_parts
                
                for son in classified["sons"]:
                    shares.append({
                        "beneficiary": son,
                        "relation": "ابن",
                        "base_share": one_part * 2,
                        "base_arabic": "الباقي تعصيباً",
                        "share_type": "تعصيب",
                        "radd_share": Fraction(0),
                    })
                
                for daughter in classified["daughters"]:
                    shares.append({
                        "beneficiary": daughter,
                        "relation": "ابنة",
                        "base_share": one_part,
                        "base_arabic": "الباقي تعصيباً",
                        "share_type": "تعصيب",
                        "radd_share": Fraction(0),
                    })
                
                remaining = Fraction(0)
        
        elif classified["father"] and not has_children:
            # الأب يأخذ الباقي تعصيباً
            shares.append({
                "beneficiary": classified["father"],
                "relation": "أب",
                "base_share": remaining,
                "base_arabic": "الباقي تعصيباً",
                "share_type": "تعصيب",
                "radd_share": Fraction(0),
            })
            remaining = Fraction(0)
        
        elif daughters_count > 0:
            # بنات فقط بدون أبناء ذكور - فرض + رد محتمل
            if daughters_count == 1:
                # بنت واحدة: نصف فرضاً
                base_share = Fraction(1, 2)
                froud_shares.append({
                    "beneficiary": classified["daughters"][0],
                    "relation": "ابنة",
                    "base_share": base_share,
                    "base_arabic": "نصف",
                    "share_type": "فرض",
                    "radd_share": Fraction(0),
                    "has_awl": False,
                })
                remaining -= base_share
            else:
                # بنتان أو أكثر: ثلثان فرضاً
                base_share_total = Fraction(2, 3)
                base_share_each = base_share_total / daughters_count
                
                for daughter in classified["daughters"]:
                    froud_shares.append({
                        "beneficiary": daughter,
                        "relation": "ابنة",
                        "base_share": base_share_each,
                        "base_arabic": "ثلثان",  # نص مبسط بدون عدد البنات
                        "share_type": "فرض",
                        "radd_share": Fraction(0),
                        "has_awl": False,
                    })
                
                remaining -= base_share_total
        
        # 2.5. معالجة العَوْل: إذا كان مجموع الفروض > 1
        total_froud = sum(s["base_share"] for s in froud_shares)
        has_awl = total_froud > 1
        
        if has_awl:
            # العَوْل: نعيد حساب الحصص بالتناسب
            for share_data in froud_shares:
                # الحصة الجديدة = الحصة الأصلية / مجموع الفروض
                adjusted_share = share_data["base_share"] / total_froud
                share_data["base_share"] = adjusted_share
                share_data["has_awl"] = True
            
            # بعد العول، لا يوجد باقي
            remaining = Fraction(0)
        
        # 3. حالة الرد: إذا بقي شيء ولا يوجد عاصب (ولا عول)
        if remaining > 0 and len(froud_shares) > 0 and not has_awl:
            # الرد على أصحاب الفروض (ما عدا الزوج/الزوجة)
            eligible_for_radd = [s for s in froud_shares if s["relation"] not in ["زوج", "زوجة"]]
            
            if eligible_for_radd:
                # حساب مجموع فروضهم
                total_froud = sum(s["base_share"] for s in eligible_for_radd)
                
                # توزيع الباقي بنسبة فروضهم
                for share_data in eligible_for_radd:
                    radd_portion = (share_data["base_share"] / total_froud) * remaining
                    share_data["radd_share"] = radd_portion
                    share_data["share_type"] = "فرض + رد"
        
        # دمج الفروض مع التعصيب
        shares.extend(froud_shares)
        
        return shares
    
    def _convert_to_amounts(self, shares: List[Dict[str, Any]], classified: Dict[str, Any]) -> List[Dict[str, Any]]:
        """تحويل الحصص إلى مبالغ فعلية مع التفسير"""
        results = []
        
        has_children = len(classified["sons"]) > 0 or len(classified["daughters"]) > 0
        
        for share_data in shares:
            base_share = share_data["base_share"]
            radd_share = share_data.get("radd_share", Fraction(0))
            has_awl = share_data.get("has_awl", False)
            final_share = base_share + radd_share
            
            amount = float(final_share) * self.total_amount
            relation = share_data["relation"]
            name = share_data["beneficiary"]["name"]
            
            # بناء النسبة الشرعية
            base_arabic = share_data["base_arabic"]
            original_share_type = share_data["share_type"]
            
            # تحديث نوع الاستحقاق بناءً على وجود الرد أو العول
            if has_awl:
                # هناك عول - المسألة عالت
                share_type = "فرض (عول)"
                percentage_arabic = f"{base_arabic} (بعد العول)"
                share_group_text = f"{base_arabic} (عول)"
            elif radd_share > 0:
                # هناك رد - يجب تحديث نوع الاستحقاق
                share_type = "فرض + رد"
                percentage_arabic = f"{base_arabic} والباقي ردا"  # نص مبسط
                share_group_text = f"{base_arabic} والباقي ردا"
            else:
                share_type = original_share_type
                percentage_arabic = base_arabic
                share_group_text = base_arabic
            
            # مفتاح التجميع: يُستخدم لتحديد المستحقين الذين يشتركون في نفس الحكم
            # نجمع حسب: درجة القرابة + نوع الاستحقاق + النص الشرعي
            share_group_key = f"{relation}|{share_type}|{share_group_text}"
            
            # التفسير
            explanation = self._generate_detailed_explanation(
                name, relation, base_arabic, share_type, 
                has_children, radd_share > 0
            )
            
            results.append({
                "name": name,
                "relation": relation,
                "base_share_fraction": f"{base_share.numerator}/{base_share.denominator}",
                "base_share_arabic": base_arabic,
                "radd_fraction": f"{radd_share.numerator}/{radd_share.denominator}" if radd_share > 0 else "",
                "final_share_fraction": f"{final_share.numerator}/{final_share.denominator}",
                "percentage": f"{final_share.numerator}/{final_share.denominator}",  # للتوافق مع الكود القديم
                "percentage_arabic": percentage_arabic,
                "share_type": share_type,
                "share_group_text": share_group_text,  # النص المشترك للتجميع
                "share_group_key": share_group_key,  # مفتاح التجميع
                "share_decimal": float(final_share),
                "amount": round(amount, 2),
                "inheritance_type": share_type,  # للتوافق مع الكود القديم
                "explanation": explanation,
            })
        
        return results
    
    def _generate_detailed_explanation(self, name: str, relation: str, base_arabic: str, 
                                      share_type: str, has_children: bool, has_radd: bool) -> str:
        """توليد التفسير التفصيلي"""
        
        if relation == "زوج":
            return f"زوجته {name} وتستحق {base_arabic} تركته فرضًا {'لوجود' if has_children else 'لعدم وجود'} الفرع الوارث"
        
        elif relation == "زوجة":
            return f"زوجته {name} وتستحق {base_arabic} تركته فرضًا {'لوجود' if has_children else 'لعدم وجود'} الفرع الوارث"
        
        elif relation == "أم":
            if has_radd:
                return f"والدته {name} وتستحق {base_arabic} تركته فرضًا والباقي ردًا لعدم وجود عاصب"
            return f"والدته {name} وتستحق {base_arabic} تركته فرضًا {'لوجود' if has_children else 'لعدم وجود'} الفرع الوارث"
        
        elif relation == "أب":
            if share_type == "تعصيب":
                return f"والده {name} ويستحق الباقي تعصيبًا لعدم وجود الفرع الوارث"
            return f"والده {name} ويستحق {base_arabic} تركته فرضًا لوجود الفرع الوارث"
        
        elif relation == "ابن":
            return f"ابنه {name} ويستحق نصيبه من الباقي تعصيبًا للذكر مثل حظ الأنثيين"
        
        elif relation == "ابنة":
            if share_type == "تعصيب":
                return f"ابنته {name} وتستحق نصيبها من الباقي تعصيبًا للذكر مثل حظ الأنثيين"
            elif has_radd:
                return f"ابنته {name} وتستحق نصيبها من {base_arabic} التركة فرضًا والباقي ردًا لعدم وجود عاصب"
            else:
                return f"ابنته {name} وتستحق نصيبها من {base_arabic} التركة فرضًا"
        
        return f"{name}"
    
    def generate_summary_explanation(self) -> str:
        """توليد ملخص نصي كامل للحالة"""
        if not self.results:
            return ""
        
        lines = []
        
        # تجميع حسب نوع الاستحقاق
        froud_only = [r for r in self.results if r.get("inheritance_type") == "فرض"]
        froud_awl = [r for r in self.results if r.get("inheritance_type") == "فرض (عول)"]
        froud_radd = [r for r in self.results if r.get("inheritance_type") == "فرض + رد"]
        tasseeb = [r for r in self.results if r.get("inheritance_type") == "تعصيب"]
        
        # ملاحظة العول
        if froud_awl:
            lines.append("**العَوْل:**")
            lines.append("• مجموع الفروض أكثر من التركة، فعالت المسألة وقُسِّمت الحصص بالتناسب")
            lines.append("")
        
        # الفروض
        if froud_only:
            lines.append("**الفروض:**")
            for ben in froud_only:
                lines.append(f"• {ben['explanation']}")
        
        # الفروض مع العول
        if froud_awl:
            if not froud_only:
                lines.append("**الفروض:**")
            for ben in froud_awl:
                lines.append(f"• {ben['explanation']}")
        
        # الفروض مع الرد
        if froud_radd:
            if not froud_only:
                lines.append("**الفروض:**")
            for ben in froud_radd:
                lines.append(f"• {ben['explanation']}")
        
        # التعصيب
        if tasseeb:
            lines.append("\n**التعصيب:**")
            for ben in tasseeb:
                lines.append(f"• {ben['explanation']}")
        
        # ملاحظة الرد
        if froud_radd:
            lines.append("\n**ملاحظة:**")
            lines.append("• الباقي بعد الفروض يُرد على أصحاب الفروض (ما عدا الزوج/الزوجة) بحسب أنصبتهم الشرعية")
        
        return "\n".join(lines)
    
    def get_total_distributed(self) -> float:
        """الحصول على إجمالي المبالغ الموزعة"""
        return sum(r["amount"] for r in self.results)
    
    def validate(self) -> Dict[str, Any]:
        """التحقق من صحة التوزيع"""
        total_distributed = self.get_total_distributed()
        difference = abs(self.total_amount - total_distributed)
        
        return {
            "is_valid": difference < 0.01,
            "total_amount": self.total_amount,
            "total_distributed": total_distributed,
            "difference": difference,
        }


def calculate_inheritance(total_amount: float, beneficiaries: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    دالة مساعدة لحساب التوزيع
    
    Args:
        total_amount: أصل المبلغ
        beneficiaries: قائمة المستحقين
    
    Returns:
        dict: النتائج مع التحقق والتفسير
    """
    calculator = InheritanceCalculator(total_amount, beneficiaries)
    results = calculator.calculate()
    validation = calculator.validate()
    summary = calculator.generate_summary_explanation()
    
    return {
        "results": results,
        "validation": validation,
        "summary_explanation": summary,
    }
