import React, { useState, useCallback } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2, ArrowRight, FileWarning, Trash2 } from 'lucide-react';
import { parseCSV, comparePayrollData, PayrollRow, ComparisonResult } from './utils/payrollLogic';
import { cn } from './lib/utils';

export default function App() {
  const [fileA, setFileA] = useState<{ name: string; data: PayrollRow[]; headers: string[] } | null>(null);
  const [fileB, setFileB] = useState<{ name: string; data: PayrollRow[]; headers: string[] } | null>(null);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, target: 'A' | 'B') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      const { data, headers } = await parseCSV(file);
      if (data.length === 0) {
        setError(`Warning: No valid records found in ${file.name}. Please ensure the CSV has headers for "Employee Id", "Earnings Code", and "Amount".`);
      }
      if (target === 'A') {
        setFileA({ name: file.name, data, headers });
      } else {
        setFileB({ name: file.name, data, headers });
      }
      setResult(null); // Reset results when new file is uploaded
    } catch (err) {
      setError(`Error parsing ${file.name}. Please ensure it's a valid CSV.`);
      console.error(err);
    }
  }, []);

  const handleCompare = () => {
    if (!fileA || !fileB) return;
    setIsComparing(true);
    setTimeout(() => {
      const comparison = comparePayrollData(fileA.data, fileB.data, fileA.headers, fileB.headers);
      setResult(comparison);
      setIsComparing(false);
    }, 300);
  };

  const reset = () => {
    setFileA(null);
    setFileB(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      {/* Header */}
      <header className="border-b border-[#141414] p-6 flex justify-between items-center">
        <div>
          <h1 className="font-serif italic text-2xl tracking-tight">Payroll Data Auditor</h1>
          <p className="text-[11px] uppercase tracking-wider opacity-50 mt-1">Data Integrity Verification System v1.0</p>
        </div>
        {(fileA || fileB) && (
          <button 
            onClick={reset}
            className="text-[11px] uppercase tracking-wider opacity-50 hover:opacity-100 transition-opacity flex items-center gap-2"
          >
            <Trash2 size={14} />
            Reset Session
          </button>
        )}
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-8">
        {/* Upload Section */}
        <div className="grid md:grid-cols-2 gap-6">
          <UploadCard 
            title="File A (Source)" 
            file={fileA} 
            onUpload={(e) => handleFileUpload(e, 'A')} 
            id="file-a"
          />
          <UploadCard 
            title="File B (Comparison)" 
            file={fileB} 
            onUpload={(e) => handleFileUpload(e, 'B')} 
            id="file-b"
          />
        </div>

        {/* Data Preview */}
        {(fileA || fileB) && !result && (
          <div className="grid md:grid-cols-2 gap-6 animate-in fade-in duration-500">
            <DataPreview data={fileA?.data} title="File A Preview" />
            <DataPreview data={fileB?.data} title="File B Preview" />
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded flex items-center gap-3">
            <AlertCircle size={18} />
            <span className="text-sm font-mono">{error}</span>
          </div>
        )}

        {/* Action Bar */}
        <div className="flex justify-center">
          <button
            onClick={handleCompare}
            disabled={!fileA || !fileB || isComparing}
            className={cn(
              "px-12 py-4 border border-[#141414] uppercase tracking-[0.2em] text-xs font-bold transition-all duration-300",
              (!fileA || !fileB || isComparing) 
                ? "opacity-20 cursor-not-allowed" 
                : "hover:bg-[#141414] hover:text-[#E4E3E0]"
            )}
          >
            {isComparing ? "Processing..." : "Run Audit Comparison"}
          </button>
        </div>

        {/* Results Section */}
        {result && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Summary Banner */}
            <div className={cn(
              "border border-[#141414] p-8 flex flex-col items-center text-center space-y-4",
              result.isPerfectMatch ? "bg-emerald-50" : "bg-amber-50"
            )}>
              <div className="font-serif italic text-3xl">Comparison Summary</div>
              {result.isPerfectMatch ? (
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle2 size={48} className="text-emerald-600" />
                  <p className="text-xl font-bold text-emerald-700">✅ Data Integrity Verified: 100% Match.</p>
                  <p className="text-sm opacity-60">
                    All records match perfectly across both datasets.
                    <br />
                    <span className="font-mono mt-1 block">File A: {result.totalRowsA} rows | File B: {result.totalRowsB} rows</span>
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <FileWarning size={48} className="text-amber-600" />
                  <p className="text-xl font-bold text-amber-700">Discrepancies Detected</p>
                  <p className="text-sm opacity-60">Found {result.discrepancies.length} issues during the audit.</p>
                </div>
              )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 border-y border-[#141414]">
              <StatBox label="File A Total Rows" value={result.totalRowsA} />
              <StatBox label="File B Total Rows" value={result.totalRowsB} />
              <StatBox label="Discrepancies" value={result.discrepancies.length} highlight={result.discrepancies.length > 0} />
            </div>

            {/* Discrepancy List */}
            {!result.isPerfectMatch && (
              <div className="space-y-4">
                <h3 className="font-serif italic text-xl">Audit Findings</h3>
                <div className="border border-[#141414] divide-y divide-[#141414]">
                  <div className="grid grid-cols-[1fr_1fr_2fr] p-3 bg-[#141414] text-[#E4E3E0] text-[10px] uppercase tracking-wider font-bold">
                    <div>Employee / Code</div>
                    <div>Type</div>
                    <div>Details</div>
                  </div>
                  {result.discrepancies.map((d, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_2fr] p-4 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors group cursor-default">
                      <div className="flex flex-col">
                        <span className="font-mono text-sm font-bold">{d.employeeId}</span>
                        <span className="text-[10px] opacity-60 uppercase tracking-tight group-hover:opacity-100">{d.earningsCode}</span>
                      </div>
                      <div className="flex items-center">
                        <span className={cn(
                          "text-[10px] px-2 py-0.5 border rounded-full uppercase tracking-wider font-bold",
                          d.type === 'AMOUNT_DIFFERENCE' ? "border-amber-500 text-amber-600 group-hover:text-amber-400 group-hover:border-amber-400" : "border-red-500 text-red-600 group-hover:text-red-400 group-hover:border-red-400"
                        )}>
                          {d.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="text-sm font-mono flex items-center">
                        {d.message}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-[#141414] p-8 text-center opacity-30">
        <p className="text-[10px] uppercase tracking-[0.3em]">Confidential Payroll Audit Tool</p>
      </footer>
    </div>
  );
}

function UploadCard({ title, file, onUpload, id }: { title: string; file: any; onUpload: (e: any) => void; id: string }) {
  return (
    <div className="border border-[#141414] p-6 bg-white/50 backdrop-blur-sm flex flex-col space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-serif italic text-lg">{title}</h2>
        {file && <CheckCircle2 size={16} className="text-emerald-600" />}
      </div>
      
      {!file ? (
        <label htmlFor={id} className="border-2 border-dashed border-[#141414]/20 h-32 flex flex-col items-center justify-center cursor-pointer hover:bg-[#141414]/5 transition-colors group">
          <Upload size={24} className="opacity-20 group-hover:opacity-100 transition-opacity" />
          <span className="text-[10px] uppercase tracking-widest mt-2 opacity-40 group-hover:opacity-100">Click to Upload CSV</span>
          <input id={id} type="file" accept=".csv" onChange={onUpload} className="hidden" />
        </label>
      ) : (
        <div className="h-32 border border-[#141414] p-4 flex flex-col justify-center items-center space-y-2 bg-[#141414] text-[#E4E3E0]">
          <FileText size={32} />
          <p className="text-xs font-mono truncate max-w-full">{file.name}</p>
          <p className="text-[10px] opacity-50 uppercase tracking-widest">{file.data.length + (file.headers.length > 0 ? 1 : 0)} Total Rows (Incl. Header)</p>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="p-6 border-r border-[#141414] last:border-r-0 flex flex-col items-center justify-center">
      <span className="text-[10px] uppercase tracking-widest opacity-50 mb-1">{label}</span>
      <span className={cn(
        "font-mono text-3xl font-bold",
        highlight && value > 0 ? "text-red-600" : ""
      )}>
        {value}
      </span>
    </div>
  );
}

function DataPreview({ data, title }: { data?: PayrollRow[]; title: string }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="border border-[#141414] bg-white/30 p-4">
      <h3 className="text-[10px] uppercase tracking-widest opacity-50 mb-3">{title} (First 3 rows)</h3>
      <div className="space-y-2">
        {data.slice(0, 3).map((row, i) => (
          <div key={i} className="grid grid-cols-3 gap-2 text-[11px] font-mono border-b border-[#141414]/10 pb-1 last:border-0">
            <div className="truncate" title="Employee ID">{row['Employee Id']}</div>
            <div className="truncate" title="Earnings Code">{row['Earnings Code']}</div>
            <div className="text-right">{row['Amount'].toFixed(2)}</div>
          </div>
        ))}
        {data.length > 3 && <div className="text-[9px] opacity-40 italic text-center">... and {data.length - 3} more rows</div>}
      </div>
    </div>
  );
}
