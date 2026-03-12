import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getClasses, getStudentsByClass, getAttendanceByClassAndDate, upsertAttendance, getAllAttendanceRange } from "@/lib/api";
import { toast } from "sonner";
import { Save, Calendar, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function Attendance() {
  const qc = useQueryClient();
  const today = new Date().toISOString().split("T")[0];
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedDate, setSelectedDate] = useState(today);
  const [statRange, setStatRange] = useState<"week"|"month">("week");
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});

  const { data: classes = [] } = useQuery({ queryKey: ["classes"], queryFn: getClasses });
  const { data: students = [] } = useQuery({ queryKey: ["students-class", selectedClass], queryFn: () => getStudentsByClass(selectedClass), enabled: !!selectedClass });
  const { data: existingAtt = [] } = useQuery({
    queryKey: ["attendance-class-date", selectedClass, selectedDate],
    queryFn: () => getAttendanceByClassAndDate(selectedClass, selectedDate),
    enabled: !!selectedClass && !!selectedDate,
    onSuccess: (data: any[]) => {
      const map: Record<string, string> = {};
      (students as any[]).forEach(s => { map[s.id] = "حاضر"; });
      data.forEach(a => { map[a.student_id] = a.status; });
      setStatusMap(map);
    }
  } as any);

  // Stats
  const getDatesRange = () => {
    const end = new Date(); const start = new Date();
    start.setDate(start.getDate() - (statRange === "week" ? 7 : 30));
    return { startDate: start.toISOString().split("T")[0], endDate: end.toISOString().split("T")[0] };
  };
  const { startDate, endDate } = getDatesRange();
  const { data: rangeAtt = [] } = useQuery({ queryKey: ["att-range", statRange], queryFn: () => getAllAttendanceRange(startDate, endDate) });

  const saveMut = useMutation({
    mutationFn: () => {
      const records = (students as any[]).map(s => ({ student_id: s.id, class_id: selectedClass, date: selectedDate, status: statusMap[s.id] || "حاضر" }));
      return upsertAttendance(records);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attendance"] }); toast.success("تم حفظ سجل الحضور"); },
    onError: () => toast.error("خطأ في الحفظ")
  });

  const setAll = (status: string) => {
    const map: Record<string, string> = {};
    (students as any[]).forEach(s => { map[s.id] = status; });
    setStatusMap(map);
  };

  const present = Object.values(statusMap).filter(s => s === "حاضر").length;
  const absent = Object.values(statusMap).filter(s => s === "غائب").length;
  const late = Object.values(statusMap).filter(s => s === "متأخر").length;
  const total = students.length;

  // Build chart data
  const attByDate: Record<string, any> = {};
  (rangeAtt as any[]).forEach(a => {
    if (!attByDate[a.date]) attByDate[a.date] = { date: a.date.slice(5), present: 0, absent: 0, late: 0 };
    if (a.status === "حاضر") attByDate[a.date].present++;
    else if (a.status === "غائب") attByDate[a.date].absent++;
    else attByDate[a.date].late++;
  });
  const chartData = Object.values(attByDate).sort((a: any, b: any) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="font-heading text-2xl font-bold">الحضور والغياب</h1><p className="text-muted-foreground text-sm mt-1">تسجيل ومتابعة الحضور اليومي</p></div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-lg border p-4 flex flex-wrap gap-4 items-end">
        <div><label className="text-xs text-muted-foreground block mb-1.5">الفصل الدراسي</label>
          <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="px-4 py-2.5 bg-background border rounded-lg text-sm">
            <option value="">اختر فصلاً</option>
            {(classes as any[]).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div><label className="text-xs text-muted-foreground block mb-1.5">التاريخ</label>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} max={today} className="px-4 py-2.5 bg-background border rounded-lg text-sm" />
        </div>
        {selectedClass && students.length > 0 && (
          <div className="flex items-end gap-2 mr-auto">
            <div className="flex gap-1">
              {["حاضر","غائب","متأخر"].map(s => (
                <button key={s} onClick={() => setAll(s)} className={`px-3 py-2.5 text-xs rounded-lg border font-heading transition-colors ${s==="حاضر"?"hover:bg-success/10 hover:text-success hover:border-success/30":s==="غائب"?"hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30":"hover:bg-warning/10 hover:text-warning hover:border-warning/30"}`}>
                  الكل {s}
                </button>
              ))}
            </div>
            <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-heading hover:bg-primary/90 disabled:opacity-70">
              <Save className="w-4 h-4" />{saveMut.isPending ? "جارٍ الحفظ..." : "حفظ"}
            </button>
          </div>
        )}
      </div>

      {selectedClass && students.length > 0 && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {[["الإجمالي",total,"text-foreground"],["حاضر",present,"text-success"],["غائب",absent,"text-destructive"],["متأخر",late,"text-warning"],["نسبة الحضور",total>0?`${((present/total)*100).toFixed(0)}%`:"0%","text-primary"]].map(([l,v,c])=>(
              <div key={l as string} className="stat-card text-center"><p className={`text-2xl font-bold font-heading ${c}`}>{v}</p><p className="text-xs text-muted-foreground mt-1">{l}</p></div>
            ))}
          </div>

          {/* Table */}
          <div className="bg-card rounded-lg border overflow-hidden">
            <table className="data-table">
              <thead><tr><th>#</th><th>الطالب</th><th>رقم الهوية</th><th>الحالة</th></tr></thead>
              <tbody>
                {(students as any[]).map((s: any, i: number) => {
                  const status = statusMap[s.id] || "حاضر";
                  return (
                    <tr key={s.id}>
                      <td className="text-muted-foreground">{i + 1}</td>
                      <td className="font-medium">{s.full_name}</td>
                      <td className="text-muted-foreground font-mono text-xs">{s.national_id}</td>
                      <td>
                        <div className="flex gap-1">
                          {["حاضر","غائب","متأخر"].map(st => (
                            <button key={st} onClick={() => setStatusMap(prev => ({ ...prev, [s.id]: st }))}
                              className={`px-3 py-1 text-xs rounded-lg font-heading transition-colors ${status===st?(st==="حاضر"?"bg-success text-success-foreground":st==="غائب"?"bg-destructive text-destructive-foreground":"bg-warning text-warning-foreground"):"bg-accent text-muted-foreground hover:bg-accent/80"}`}>
                              {st}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!selectedClass && <div className="text-center py-12 text-muted-foreground bg-card rounded-lg border"><Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>اختر فصلاً دراسياً لتسجيل الحضور</p></div>}

      {/* Stats Chart */}
      <div className="bg-card rounded-lg border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />إحصائيات الحضور</h2>
          <div className="flex rounded-lg border overflow-hidden">
            {(["week","month"] as const).map(r => (
              <button key={r} onClick={() => setStatRange(r)} className={`px-3 py-1.5 text-xs font-heading ${statRange===r?"bg-primary text-primary-foreground":"text-muted-foreground hover:bg-accent"}`}>{r==="week"?"أسبوع":"شهر"}</button>
            ))}
          </div>
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} />
              <Tooltip /><Legend />
              <Bar dataKey="present" name="حاضر" fill="hsl(var(--success))" radius={[3,3,0,0]} />
              <Bar dataKey="late" name="متأخر" fill="hsl(var(--warning))" radius={[3,3,0,0]} />
              <Bar dataKey="absent" name="غائب" fill="hsl(var(--destructive))" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">لا توجد بيانات حضور للفترة المحددة</div>
        )}
      </div>
    </div>
  );
}
