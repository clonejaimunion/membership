"""
محلل نصوص الإعلام الشرعي / أحكام المحكمة
Parser محلي 100% - بدون AI - Rule-Based
"""
import re
from typing import List, Dict, Any, Optional
from fractions import Fraction


# قواميس ثابتة للكلمات المفتاحية
RELATION_KEYWORDS = {
    "زوج": ["زوج", "الزوج", "زوجها"],
    "زوجة": ["زوجة", "زوجته", "الزوجة", "زوجتة"],
    "أب": ["أب", "الأب", "أبوه", "والده", "والد"],
    "أم": ["أم", "الأم", "أمه", "والدته", "والدة"],
    "ابن": ["ابن", "الابن", "ولد", "أولاد", "ابناء", "أبناء", "اولاده", "أولاده"],
    "ابنة": ["ابنة", "بنت", "البنت", "بنات", "البنات", "بناته"],
}

# الأنصبة الشرعية بالعربية
SHARE_NAMES_AR = {
    "نصف": Fraction(1, 2),
    "ربع": Fraction(1, 4),
    "ثمن": Fraction(1, 8),
    "ثلث": Fraction(1, 3),
    "ثلثان": Fraction(2, 3),
    "سدس": Fraction(1, 6),
}

# عبارات الرد
RADD_PATTERNS = [
    r"الباقي\s*رد[اً]?",
    r"والباقي\s*رد[اً]?",
    r"والباقي\s*يرد",
    r"يرد\s*عليه[ما]?\s*الباقي",
]

# عبارات التعصيب
TASEEB_PATTERNS = [
    r"تعصيب[اً]?",
    r"الباقي\s*تعصيب[اً]?",
    r"للذكر\s*مثل\s*حظ\s*الأنثيين",
]


def normalize_text(text: str) -> str:
    """
    تنظيف وتوحيد النص
    - إزالة التشكيل
    - توحيد الألف والهمزات
    - توحيد التاء المربوطة
    - إزالة المسافات الزائدة (لكن الاحتفاظ بالأسطر الجديدة)
    """
    if not text:
        return ""
    
    # إزالة التشكيل
    arabic_diacritics = re.compile(r'[\u064B-\u065F\u0670]')
    text = arabic_diacritics.sub('', text)
    
    # توحيد الألف والهمزات
    text = re.sub(r'[إأآ]', 'ا', text)
    
    # توحيد التاء المربوطة
    text = re.sub(r'ة', 'ه', text)
    
    # توحيد الياء
    text = re.sub(r'ى', 'ي', text)
    
    # إزالة المسافات الزائدة في كل سطر (لكن الاحتفاظ بالأسطر)
    lines = text.split('\n')
    lines = [re.sub(r'\s+', ' ', line).strip() for line in lines]
    text = '\n'.join(lines)
    
    # تنظيف علامات الترقيم
    text = text.strip()
    
    return text


def extract_names_after_keyword(text: str, keyword: str) -> List[str]:
    """
    استخراج الأسماء بعد كلمة مفتاحية
    مثال: "زوجته فاطمة أحمد" -> ["فاطمة أحمد"]
    مثال: "بناته: عائشة، خديجة، مريم" -> ["عائشة", "خديجة", "مريم"]
    """
    names = []
    
    # نمط 1: بناته: اسم، اسم، اسم
    pattern1 = rf'{keyword}\s*:?\s*([\u0600-\u06FF\s,،.]+?)(?:\n|\.|$)'
    match = re.search(pattern1, text, re.UNICODE | re.MULTILINE)
    
    if match:
        names_part = match.group(1).strip()
        # تقسيم الأسماء حسب الفواصل
        if '،' in names_part or ',' in names_part:
            # استخدام regex لتقسيم الأسماء
            split_names = re.split(r'[،,]\s*', names_part)
            names.extend([n.strip() for n in split_names if n.strip()])
        elif ' و ' in names_part:
            split_names = re.split(r'\s+و\s+', names_part)
            names.extend([n.strip() for n in split_names if n.strip()])
        else:
            names.append(names_part.strip())
    
    # نمط 2: زوجته فاطمة أحمد (بدون فواصل)
    if not names:
        pattern2 = rf'{keyword}\s+([\u0600-\u06FF]+(?:\s+[\u0600-\u06FF]+)?)'
        match = re.search(pattern2, text, re.UNICODE)
        if match:
            names.append(match.group(1).strip())
    
    return names


def extract_heirs(text: str) -> List[Dict[str, Any]]:
    """
    استخراج الورثة من النص باستخدام regex والقواعد
    
    Returns:
        List[Dict]: قائمة الورثة مع البيانات الأساسية
        [
            {"name": "فاطمة أحمد", "relation": "زوجة"},
            {"name": "عائشة", "relation": "ابنة"},
            ...
        ]
    """
    heirs = []
    normalized = normalize_text(text)
    lines = normalized.split('\n')
    
    # نمط 1: استخراج الزوجة من سطر مثل "زوجته/ عايدة رجب ابوالسعود"
    wife_pattern = r'زوجته?\s*/?\s*([\u0600-\u06FF\s]+?)(?:\s+وتستحق|\s+تستحق|$)'
    for match in re.finditer(wife_pattern, normalized, re.UNICODE | re.IGNORECASE):
        name = match.group(1).strip()
        if name and len(name) > 3:
            # تنظيف الاسم من كلمات زائدة
            name = re.sub(r'\s+(وتستحق|تستحق|ويستحق|يستحق).*$', '', name).strip()
            heirs.append({
                "name": name,
                "relation": "زوجة"
            })
    
    # نمط 2: استخراج الزوج
    husband_pattern = r'زوجه\s*/?\s*([\u0600-\u06FF\s]+?)(?:\s+ويستحق|\s+يستحق|$)'
    for match in re.finditer(husband_pattern, normalized, re.UNICODE | re.IGNORECASE):
        name = match.group(1).strip()
        if name and len(name) > 3:
            name = re.sub(r'\s+(ويستحق|يستحق|وتستحق|تستحق).*$', '', name).strip()
            heirs.append({
                "name": name,
                "relation": "زوج"
            })
    
    # نمط 3: استخراج الأبناء/البنات من أسطر مثل:
    # "ضحي ابراهيم عبد الجليل محمد السحت - ابنة"
    children_pattern = r'^([\u0600-\u06FF\s]+?)\s*-\s*(ابنه|ابن|بنت|بنته|ابنة)$'
    for line in lines:
        line = line.strip()
        match = re.match(children_pattern, line, re.UNICODE | re.IGNORECASE)
        if match:
            name = match.group(1).strip()
            relation_text = match.group(2).strip()
            
            # تحديد العلاقة
            if relation_text in ['ابنه', 'بنت', 'بنته', 'ابنة']:
                relation = "ابنة"
            else:
                relation = "ابن"
            
            if name and len(name) > 3:
                heirs.append({
                    "name": name,
                    "relation": relation
                })
    
    # نمط 4: استخراج الأب والأم
    father_pattern = r'(?:ابوه|والده|ابيه)\s*/?\s*([\u0600-\u06FF\s]+?)(?:\s+ويستحق|\s+يستحق|$)'
    for match in re.finditer(father_pattern, normalized, re.UNICODE | re.IGNORECASE):
        name = match.group(1).strip()
        if name and len(name) > 3:
            name = re.sub(r'\s+(ويستحق|يستحق).*$', '', name).strip()
            heirs.append({
                "name": name,
                "relation": "أب"
            })
    
    mother_pattern = r'(?:امه|والدته)\s*/?\s*([\u0600-\u06FF\s]+?)(?:\s+وتستحق|\s+تستحق|$)'
    for match in re.finditer(mother_pattern, normalized, re.UNICODE | re.IGNORECASE):
        name = match.group(1).strip()
        if name and len(name) > 3:
            name = re.sub(r'\s+(وتستحق|تستحق).*$', '', name).strip()
            heirs.append({
                "name": name,
                "relation": "أم"
            })
    
    # إزالة التكرارات
    seen = set()
    unique_heirs = []
    for heir in heirs:
        key = f"{heir['name']}_{heir['relation']}"
        if key not in seen:
            seen.add(key)
            unique_heirs.append(heir)
    
    return unique_heirs


def extract_deceased_name(text: str) -> Optional[str]:
    """
    استخراج اسم المتوفى من النص
    
    Returns:
        str: اسم المتوفى أو None
    """
    normalized = normalize_text(text)
    
    # نمط: "توفي المرحوم/ [الاسم]"
    pattern = r'توفي\s*(?:المرحوم|المتوفي|المتوفاه|المرحومه)\s*/?\s*([\u0600-\u06FF\s]+?)(?:\n|وانحصر)'
    match = re.search(pattern, normalized, re.UNICODE | re.IGNORECASE)
    
    if match:
        name = match.group(1).strip()
        return name if len(name) > 3 else None
    
    return None


def extract_share_from_text(text: str, heir_relation: str) -> Optional[Dict[str, Any]]:
    """
    استخراج النصيب الشرعي من النص إذا كان مذكوراً صراحة
    
    Returns:
        Dict أو None:
        {
            "base_share_arabic": "ثمن",
            "base_share_fraction": "1/8",
            "has_radd": False,
            "share_type": "فرض"
        }
    """
    normalized = normalize_text(text)
    
    # البحث عن عبارات تحتوي على الأنصبة
    for share_name, fraction in SHARE_NAMES_AR.items():
        # البحث عن النمط: "تستحق [النصيب]"
        pattern = rf'{share_name}'
        if re.search(pattern, normalized):
            # التحقق من وجود الرد
            has_radd = any(re.search(p, normalized) for p in RADD_PATTERNS)
            
            # التحقق من وجود التعصيب
            has_taseeb = any(re.search(p, normalized) for p in TASEEB_PATTERNS)
            
            # تحديد نوع الاستحقاق
            if has_radd:
                share_type = "فرض + رد"
            elif has_taseeb:
                share_type = "تعصيب"
            else:
                share_type = "فرض"
            
            return {
                "base_share_arabic": share_name,
                "base_share_fraction": f"{fraction.numerator}/{fraction.denominator}",
                "has_radd": has_radd,
                "share_type": share_type
            }
    
    return None


def count_heirs_by_relation(heirs: List[Dict[str, Any]]) -> Dict[str, int]:
    """
    عد الورثة حسب درجة القرابة
    """
    counts = {}
    for heir in heirs:
        relation = heir["relation"]
        counts[relation] = counts.get(relation, 0) + 1
    
    return counts


def parse_shariah_text(text: str) -> Dict[str, Any]:
    """
    تحليل نص الإعلام الشرعي وإرجاع البيانات المنظمة
    
    Args:
        text: نص الإعلام الشرعي / نص المحكمة
    
    Returns:
        Dict: البيانات المستخرجة
        {
            "success": bool,
            "deceased_name": str,
            "heirs": List[Dict],
            "parsing_method": "extracted" | "needs_calculation",
            "extracted_shares": Dict,
            "error": str (optional)
        }
    """
    if not text or len(text.strip()) < 10:
        return {
            "success": False,
            "error": "النص فارغ أو قصير جداً",
            "heirs": []
        }
    
    try:
        # استخراج اسم المتوفى
        deceased_name = extract_deceased_name(text)
        
        # استخراج الورثة
        heirs = extract_heirs(text)
        
        if not heirs:
            return {
                "success": False,
                "error": "لم يتم العثور على ورثة في النص",
                "heirs": [],
                "deceased_name": deceased_name
            }
        
        # محاولة استخراج الأنصبة من النص
        extracted_shares = {}
        for heir in heirs:
            share_info = extract_share_from_text(text, heir["relation"])
            if share_info:
                extracted_shares[heir["relation"]] = share_info
        
        # تحديد طريقة المعالجة
        if extracted_shares:
            parsing_method = "extracted"  # تم استخراج الأنصبة من النص
        else:
            parsing_method = "needs_calculation"  # نحتاج حساب الأنصبة
        
        return {
            "success": True,
            "deceased_name": deceased_name,
            "heirs": heirs,
            "parsing_method": parsing_method,
            "extracted_shares": extracted_shares,
            "heir_counts": count_heirs_by_relation(heirs)
        }
    
    except Exception as e:
        return {
            "success": False,
            "error": f"خطأ في التحليل: {str(e)}",
            "heirs": [],
            "deceased_name": None
        }


def convert_parsed_to_calculator_format(parsed_data: Dict[str, Any]) -> List[Dict[str, str]]:
    """
    تحويل البيانات المستخرجة إلى صيغة يفهمها inheritance_calculator.py
    
    Args:
        parsed_data: نتائج parse_shariah_text()
    
    Returns:
        List[Dict]: قائمة المستفيدين بصيغة الحاسبة
        [
            {"name": "فاطمة أحمد", "relation": "زوجة"},
            {"name": "عائشة", "relation": "ابنة"},
            ...
        ]
    """
    if not parsed_data.get("success"):
        return []
    
    beneficiaries = []
    for heir in parsed_data.get("heirs", []):
        beneficiaries.append({
            "name": heir["name"],
            "relation": heir["relation"]
        })
    
    return beneficiaries
