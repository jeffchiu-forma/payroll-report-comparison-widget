import Papa from 'papaparse';

export interface PayrollRow {
  'Employee Id': string;
  'Earnings Code': string;
  'Amount': number;
  [key: string]: any;
}

export interface ComparisonResult {
  totalRowsA: number;
  totalRowsB: number;
  matches: number;
  discrepancies: Discrepancy[];
  isPerfectMatch: boolean;
  headerDiscrepancy?: string;
}

export type DiscrepancyType = 'MISSING_IN_B' | 'MISSING_IN_A' | 'AMOUNT_DIFFERENCE' | 'HEADER_MISMATCH';

export interface Discrepancy {
  type: DiscrepancyType;
  employeeId?: string;
  earningsCode?: string;
  amountA?: number;
  amountB?: number;
  message: string;
}

export const parseCSV = (file: File): Promise<{ data: PayrollRow[]; headers: string[] }> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => header.trim(),
      transform: (value) => value.trim(),
      complete: (results) => {
        const headers = results.meta.fields || [];
        if (results.data.length === 0) {
          resolve({ data: [], headers });
          return;
        }

        const findKey = (row: any, target: string) => {
          const normalizedTarget = target.toLowerCase().replace(/[\s_]/g, '');
          return Object.keys(row).find(key => {
            const normalizedKey = key.toLowerCase().replace(/[\s_]/g, '');
            return normalizedKey === normalizedTarget;
          });
        };

        const data = results.data.map((row: any) => {
          const empIdKey = findKey(row, 'Employee Id') || findKey(row, 'EmployeeId') || findKey(row, 'EmpId') || findKey(row, 'ID') || findKey(row, 'EE ID');
          const earnCodeKey = findKey(row, 'Earnings Code') || findKey(row, 'EarningsCode') || findKey(row, 'EarnCode') || findKey(row, 'Code') || findKey(row, 'PayCode');
          const amountKey = findKey(row, 'Amount') || findKey(row, 'Total') || findKey(row, 'Value');

          const empId = empIdKey ? String(row[empIdKey]) : '';
          const earnCode = earnCodeKey ? String(row[earnCodeKey]) : '';
          const amountStr = amountKey ? String(row[amountKey]) : '0';
          
          const amount = parseFloat(amountStr.replace(/[^0-9.-]+/g, '')) || 0;

          return {
            'Employee Id': empId,
            'Earnings Code': earnCode,
            'Amount': amount,
          };
        }).filter(row => row['Employee Id'] && row['Earnings Code']);

        resolve({ data, headers });
      },
      error: (error) => reject(error),
    });
  });
};

export const comparePayrollData = (
  fileA: PayrollRow[], 
  fileB: PayrollRow[], 
  headersA: string[], 
  headersB: string[]
): ComparisonResult => {
  const discrepancies: Discrepancy[] = [];

  // 1. Header Comparison
  const hA = headersA.join(', ');
  const hB = headersB.join(', ');
  if (hA !== hB) {
    discrepancies.push({
      type: 'HEADER_MISMATCH',
      message: `Header mismatch: File A headers are [${hA}], but File B headers are [${hB}].`
    });
  }

  // 2. Data Comparison
  const groupData = (data: PayrollRow[]) => {
    const groups: Record<string, number[]> = {};
    data.forEach(row => {
      const key = `${row['Employee Id']}|${row['Earnings Code']}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(row['Amount']);
    });
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => a - b);
    });
    return groups;
  };

  const groupsA = groupData(fileA);
  const groupsB = groupData(fileB);

  const allKeys = new Set([...Object.keys(groupsA), ...Object.keys(groupsB)]);

  allKeys.forEach(key => {
    const [employeeId, earningsCode] = key.split('|');
    const amountsA = groupsA[key] || [];
    const amountsB = groupsB[key] || [];

    const maxLength = Math.max(amountsA.length, amountsB.length);
    
    for (let i = 0; i < maxLength; i++) {
      const valA = amountsA[i];
      const valB = amountsB[i];

      if (valA === undefined) {
        discrepancies.push({
          type: 'MISSING_IN_A',
          employeeId,
          earningsCode,
          amountB: valB,
          message: `Row for Employee ${employeeId} (${earningsCode}) with amount ${valB} is missing in File A.`
        });
      } else if (valB === undefined) {
        discrepancies.push({
          type: 'MISSING_IN_B',
          employeeId,
          earningsCode,
          amountA: valA,
          message: `Row for Employee ${employeeId} (${earningsCode}) with amount ${valA} is missing in File B.`
        });
      } else if (Math.abs(valA - valB) > 0.001) {
        discrepancies.push({
          type: 'AMOUNT_DIFFERENCE',
          employeeId,
          earningsCode,
          amountA: valA,
          amountB: valB,
          message: `Amount mismatch for Employee ${employeeId} (${earningsCode}): File A has ${valA}, File B has ${valB}.`
        });
      }
    }
  });

  const isPerfectMatch = discrepancies.length === 0;

  return {
    // Including header row in the count as requested (data + 1)
    totalRowsA: fileA.length + (headersA.length > 0 ? 1 : 0),
    totalRowsB: fileB.length + (headersB.length > 0 ? 1 : 0),
    matches: isPerfectMatch ? (fileA.length + 1) : (fileA.length - discrepancies.filter(d => d.type !== 'MISSING_IN_A' && d.type !== 'HEADER_MISMATCH').length),
    discrepancies,
    isPerfectMatch
  };
};
