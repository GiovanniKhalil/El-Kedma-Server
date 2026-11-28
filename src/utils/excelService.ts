/**
 * Excel (.xlsx) Import and Export Services powered by SheetJS (xlsx)
 */
import * as XLSX from 'xlsx';
import { Child, Stage, AttendanceRecord, EventType } from '../types';
import { calculateExactAge, parseBirthDateParts } from './ageUtils';
import { EVENT_LABELS, MONTHS } from '../data/mockData';

export interface ParsedChildExcelRow {
  name: string;
  gender: 'boy' | 'girl';
  stage: Stage;
  age: number;
  birthDate: string;
  birthMonth: number;
  area: string;
  phone: string;
  parentName: string;
  parentRelation: string;
  parentPhone: string;
  parentJob: string;
  parent2Name?: string;
  parent2Relation?: string;
  parent2Phone?: string;
  parent2Job?: string;
  notes?: string;
}

/**
 * Spelling normalization for dynamic stage names (handling hamzas, diacritics, spaces)
 */
export function normalizeStageName(raw: string): Stage {
  const clean = (raw || '').trim().replace(/[إأآا]/g, 'ا').replace(/ة/g, 'ه').toLowerCase();
  if (clean.includes('حضانه') || clean.includes('حضانة')) return 'حضانة';
  if (clean.includes('اولى') || clean.includes('تانيه') || clean.includes('ثانية') || clean.includes('1') || clean.includes('2')) return 'ابتدائي (أولى وتانية)';
  if (clean.includes('ثالثه') || clean.includes('ثالثة') || clean.includes('رابعه') || clean.includes('رابعة') || clean.includes('3') || clean.includes('4')) return 'ابتدائي (ثالثة ورابعة)';
  if (clean.includes('خامسه') || clean.includes('خامسة') || clean.includes('سادسه') || clean.includes('سادسة') || clean.includes('5') || clean.includes('6')) return 'ابتدائي (خامسة وسادسة)';
  if (clean.includes('اعدادي') || clean.includes('إعدادي')) return 'إعدادي';
  if (clean.includes('ثانوي')) return 'ثانوي';
  if (clean.includes('جامعي') || clean.includes('خريج') || clean.includes('شباب')) return 'خريجون وشباب جامعي';
  return raw || 'ابتدائي (ثالثة ورابعة)';
}

/**
 * Exports children records to an authentic .xlsx spreadsheet
 */
export function exportChildrenToXLSX(children: Child[], stageName = 'عام'): void {
  const dataRows = children.map((c, index) => {
    const calculatedAge = calculateExactAge(c.birthDate, c.age);
    return {
      'م': index + 1,
      'الاسم الكامل للمخدوم': c.name,
      'النوع': c.gender === 'boy' ? 'ولد' : 'بنت',
      'المرحلة الدراسية': c.stage,
      'السن': calculatedAge,
      'تاريخ الميلاد': c.birthDate || '',
      'شهر الميلاد': c.birthMonth || '',
      'المنطقة / السكن': c.area || '',
      'تليفون المخدوم': c.phone || '',
      'اسم ولي الأمر (1)': c.parentName || '',
      'صلة القرابة (1)': c.parentRelation || 'الأب',
      'تليفون ولي الأمر (1)': c.parentPhone || '',
      'مهنة ولي الأمر (1)': c.parentJob || '',
      'اسم ولي الأمر (2)': c.parent2Name || '',
      'صلة القرابة (2)': c.parent2Relation || (c.parent2Name ? 'الأم' : ''),
      'تليفون ولي الأمر (2)': c.parent2Phone || '',
      'مهنة ولي الأمر (2)': c.parent2Job || '',
      'ملاحظات الخدمة والافتقاد': c.notes || ''
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(dataRows);
  
  // RTL direction for worksheet
  worksheet['!dir'] = 'rtl';
  
  // Auto-fit column widths
  const colWidths = [
    { wch: 5 },  // م
    { wch: 25 }, // الاسم
    { wch: 8 },  // النوع
    { wch: 22 }, // المرحلة
    { wch: 8 },  // السن
    { wch: 14 }, // تاريخ الميلاد
    { wch: 10 }, // شهر الميلاد
    { wch: 18 }, // المنطقة
    { wch: 14 }, // تليفون المخدوم
    { wch: 22 }, // ولي الأمر 1
    { wch: 12 }, // صلة القرابة
    { wch: 15 }, // تليفون 1
    { wch: 18 }, // وظيفة 1
    { wch: 22 }, // ولي الأمر 2
    { wch: 12 }, // صلة القرابة 2
    { wch: 15 }, // تليفون 2
    { wch: 18 }, // وظيفة 2
    { wch: 30 }, // ملاحظات
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'كشف الأولاد');

  const todayStr = new Date().toISOString().split('T')[0];
  const safeStage = stageName.replace(/[\/\\?%*:|"<>]/g, '_');
  XLSX.writeFile(workbook, `كشف_الأولاد_${safeStage}_${todayStr}.xlsx`);
}

/**
 * Exports Attendance Records filtered by Month to .xlsx (Present vs Absent & secondary stages)
 */
export function exportAttendanceMonthToXLSX(
  attendanceRecords: AttendanceRecord[],
  childrenList: Child[],
  selectedMonth: number,
  eventType: EventType,
  stageFilter: string,
  customEventLabel?: string
): void {
  const monthName = MONTHS.find(m => m.value === selectedMonth)?.label || `شهر ${selectedMonth}`;
  const eventLabel = customEventLabel || EVENT_LABELS[eventType] || eventType;

  // Filter attendance records by month and event
  const monthRecords = attendanceRecords.filter(a => {
    if (a.targetType !== 'child') return false;
    if (a.eventType !== eventType) return false;
    const parts = a.date.split('-');
    const recordMonth = parseInt(parts[1], 10);
    return recordMonth === selectedMonth;
  });

  // Extract unique sorted dates for this month
  const dates = Array.from(new Set(monthRecords.map(r => r.date))).sort();

  // Filter children by primary stage or secondaryStages
  const scopedChildren = stageFilter === 'all' 
    ? childrenList 
    : childrenList.filter(c => c.stage === stageFilter || (c.secondaryStages && c.secondaryStages.includes(stageFilter)));

  // Build matrix data
  const rows = scopedChildren.map((kid, idx) => {
    const rowObj: Record<string, any> = {
      'م': idx + 1,
      'اسم المخدوم': kid.name,
      'المرحلة': kid.stage,
      'المراحل الفرعية': kid.secondaryStages?.join(', ') || '—',
      'السن': calculateExactAge(kid.birthDate, kid.age),
      'تليفون ولي الأمر': kid.parentPhone
    };

    let presentDays = 0;
    let recordedDays = 0;

    dates.forEach(d => {
      const dayRecord = monthRecords.find(r => r.date === d);
      const kidStatus = dayRecord?.records[kid.id]?.status;
      
      let mark = '—';
      if (kidStatus === 'present') {
        mark = 'حاضر ✓';
        presentDays++;
        recordedDays++;
      } else if (kidStatus === 'absent') {
        mark = 'غائب ✗';
        recordedDays++;
      }
      
      rowObj[d] = mark;
    });

    const percent = recordedDays > 0 ? `${Math.round((presentDays / recordedDays) * 100)}%` : '—';
    rowObj['إجمالي الحضور'] = `${presentDays} من ${recordedDays}`;
    rowObj['نسبة الحضور'] = percent;

    return rowObj;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!dir'] = 'rtl';

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `حضور ${monthName}`);

  const safeStage = stageFilter.replace(/[\/\\?%*:|"<>]/g, '_');
  XLSX.writeFile(workbook, `تقرير_حضور_${eventLabel}_${monthName}_${safeStage}.xlsx`);
}

/**
 * Parses an Excel (.xlsx / .xls) or CSV file into ParsedChildExcelRow array
 */
export async function parseExcelOrCsvFile(file: File): Promise<ParsedChildExcelRow[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  // Read first worksheet
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Convert to 2D array of rows
  const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  if (rawData.length < 2) {
    throw new Error('الملف فارغ أو لا يحتوي على بيانات كافية');
  }

  // Find header row and identify column indices
  let headerIndex = 0;
  for (let i = 0; i < Math.min(5, rawData.length); i++) {
    const row = rawData[i];
    if (row && row.some((cell: any) => typeof cell === 'string' && (cell.includes('اسم') || cell.includes('مخدوم') || cell.includes('name')))) {
      headerIndex = i;
      break;
    }
  }

  const headerRow = rawData[headerIndex].map((c: any) => String(c || '').trim().toLowerCase());

  // Helper to find column index matching variants
  const getCol = (...aliases: string[]): number => {
    return headerRow.findIndex(h => aliases.some(alias => h.includes(alias.toLowerCase())));
  };

  const nameCol = getCol('الاسم', 'اسم المخدوم', 'اسم الطالب', 'name', 'المخدوم');
  const genderCol = getCol('النوع', 'الجنس', 'gender');
  const stageCol = getCol('المرحلة', 'الفصل', 'stage', 'الصف');
  const ageCol = getCol('السن', 'العمر', 'age');
  const birthDateCol = getCol('تاريخ الميلاد', 'الميلاد', 'birthdate', 'dob');
  const areaCol = getCol('المنطقة', 'السكن', 'العنوان', 'area', 'address');
  const phoneCol = getCol('تليفون الولد', 'رقم الولد', 'موبايل الولد', 'phone');
  
  const parentNameCol = getCol('اسم ولي الأمر (1)', 'ولي الأمر 1', 'الوالد', 'الأب', 'parent 1', 'ولي الأمر');
  const parentRelationCol = getCol('صلة القرابة (1)', 'صلة 1', 'relation 1');
  const parentPhoneCol = getCol('تليفون ولي الأمر (1)', 'موبايل ولي الأمر 1', 'رقم ولي الأمر 1', 'parent phone 1', 'هاتف ولي الأمر');
  const parentJobCol = getCol('مهنة ولي الأمر (1)', 'وظيفة 1', 'مهنة 1');

  const parent2NameCol = getCol('اسم ولي الأمر (2)', 'ولي الأمر 2', 'الأم', 'parent 2', 'الام');
  const parent2RelationCol = getCol('صلة القرابة (2)', 'صلة 2', 'relation 2');
  const parent2PhoneCol = getCol('تليفون ولي الأمر (2)', 'موبايل ولي الأمر 2', 'رقم ولي الأمر 2', 'parent phone 2');
  const parent2JobCol = getCol('مهنة ولي الأمر (2)', 'وظيفة 2', 'مهنة 2');
  const notesCol = getCol('ملاحظات', 'افتقاد', 'notes');

  if (nameCol === -1) {
    throw new Error('لم يتم التعرف على عمود "اسم المخدوم" في ملف الإكسيل. يرجى التأكد من ترويسة الأعمدة.');
  }

  const parsedList: ParsedChildExcelRow[] = [];

  for (let r = headerIndex + 1; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row || row.length === 0) continue;

    const name = String(row[nameCol] || '').trim();
    if (!name || name.length < 2) continue;

    // Detect gender
    const rawGender = genderCol !== -1 ? String(row[genderCol] || '').trim() : '';
    const gender: 'boy' | 'girl' = rawGender.includes('بنت') || rawGender.toLowerCase().includes('girl') || rawGender.toLowerCase().includes('f') 
      ? 'girl' 
      : 'boy';

    // Stage (Normalized spelling)
    const rawStage = stageCol !== -1 ? String(row[stageCol] || '').trim() : '';
    const stage = normalizeStageName(rawStage);

    // BirthDate
    let birthDate = birthDateCol !== -1 ? String(row[birthDateCol] || '').trim() : '';
    if (/^\d{5}$/.test(birthDate)) {
      try {
        const serial = parseInt(birthDate, 10);
        const jsDate = new Date(Math.round((serial - 25569) * 86400 * 1000));
        birthDate = jsDate.toISOString().split('T')[0];
      } catch (e) {
        // ignore
      }
    }

    const parsedDate = parseBirthDateParts(birthDate, 1);
    const birthMonth = birthDate ? parsedDate.month : 1;

    const rawAge = ageCol !== -1 ? parseInt(String(row[ageCol] || ''), 10) : undefined;
    const age = calculateExactAge(birthDate, rawAge || 9);

    const area = areaCol !== -1 ? String(row[areaCol] || '').trim() : 'المعراج';
    const phone = phoneCol !== -1 ? String(row[phoneCol] || '').trim() : '';
    const parentName = parentNameCol !== -1 ? String(row[parentNameCol] || '').trim() : `والد ${name.split(' ')[0]}`;
    const parentRelation = parentRelationCol !== -1 ? String(row[parentRelationCol] || '').trim() : 'الأب';
    const parentPhone = parentPhoneCol !== -1 ? String(row[parentPhoneCol] || '').trim() : '';
    const parentJob = parentJobCol !== -1 ? String(row[parentJobCol] || '').trim() : '';

    const parent2Name = parent2NameCol !== -1 ? String(row[parent2NameCol] || '').trim() : '';
    const parent2Relation = parent2RelationCol !== -1 ? String(row[parent2RelationCol] || '').trim() : (parent2Name ? 'الأم' : undefined);
    const parent2Phone = parent2PhoneCol !== -1 ? String(row[parent2PhoneCol] || '').trim() : '';
    const parent2Job = parent2JobCol !== -1 ? String(row[parent2JobCol] || '').trim() : '';
    const notes = notesCol !== -1 ? String(row[notesCol] || '').trim() : '';

    parsedList.push({
      name,
      gender,
      stage,
      age,
      birthDate,
      birthMonth,
      area,
      phone,
      parentName,
      parentRelation: parentRelation || 'الأب',
      parentPhone,
      parentJob,
      parent2Name: parent2Name || undefined,
      parent2Relation: parent2Relation || undefined,
      parent2Phone: parent2Phone || undefined,
      parent2Job: parent2Job || undefined,
      notes
    });
  }

  return parsedList;
}

/**
 * Downloads a pre-formatted Excel template for importing children
 */
export function downloadExcelTemplate(): void {
  const sampleData = [
    {
      'الاسم الكامل للمخدوم': 'مينا كيرلس شفيق',
      'النوع': 'ولد',
      'المرحلة الدراسية': 'ابتدائي (ثالثة ورابعة)',
      'السن': 9,
      'تاريخ الميلاد': '2017-05-14',
      'المنطقة / السكن': 'المعراج العلوي',
      'تليفون المخدوم': '01223456789',
      'اسم ولي الأمر (1)': 'كيرلس شفيق',
      'صلة القرابة (1)': 'الأب',
      'تليفون ولي الأمر (1)': '01221112222',
      'مهنة ولي الأمر (1)': 'مهندس مدني',
      'اسم ولي الأمر (2)': 'مريم جرجس',
      'صلة القرابة (2)': 'الأم',
      'تليفون ولي الأمر (2)': '01223334444',
      'مهنة ولي الأمر (2)': 'طبيبة',
      'ملاحظات الخدمة والافتقاد': 'شاطر ومواظب على مدارس الأحد'
    },
    {
      'الاسم الكامل للمخدوم': 'مريم بيشوي سامي',
      'النوع': 'بنت',
      'المرحلة الدراسية': 'ابتدائي (أولى وتانية)',
      'السن': 7,
      'تاريخ الميلاد': '2019-11-20',
      'المنطقة / السكن': 'المعراج السفلي',
      'تليفون المخدوم': '',
      'اسم ولي الأمر (1)': 'بيشوي سامي',
      'صلة القرابة (1)': 'الأب',
      'تليفون ولي الأمر (1)': '01003334444',
      'مهنة ولي الأمر (1)': 'محاسب',
      'اسم ولي الأمر (2)': '',
      'صلة القرابة (2)': '',
      'تليفون ولي الأمر (2)': '',
      'مهنة ولي الأمر (2)': '',
      'ملاحظات الخدمة والافتقاد': 'تحب التلوين وألحان الكنيسة'
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  worksheet['!dir'] = 'rtl';
  worksheet['!cols'] = [
    { wch: 25 }, { wch: 8 }, { wch: 22 }, { wch: 8 },
    { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 22 },
    { wch: 12 }, { wch: 15 }, { wch: 18 }, { wch: 22 },
    { wch: 12 }, { wch: 15 }, { wch: 18 }, { wch: 30 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'نموذج كشف الأولاد');
  XLSX.writeFile(workbook, 'نموذج_إضافة_مخدومين_جدد.xlsx');
}
