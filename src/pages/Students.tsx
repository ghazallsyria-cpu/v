import { AdminChangePassword } from "@/components/ChangePassword";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getTeacherClasses, getStudents, addStudent, deleteStudent, getClasses, getGradesByStudent, getAttendanceStatsByStudent } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, X, Save, ChevronRight, BookOpen, Calendar, Search } from "lucide-react";

const gradeLabel = (p:number) => p>=90?"ممتاز":p>=75?"جيد جداً":p>=60?"جيد":p>=50?"مقبول":"راسب";
const gradeColor = (p:number) => p>=75?"text-success":p>=60?"text-info":p>=50?"text-warning":"text-destructive";

export default function Students() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [sel, setSel] = useState<any>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [filterClass, setFilterClass] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ full_name:"", national_id:"", class_id:"", password_hash:"123456" });

  const isTeacher = user?.role === "teacher";
  const canAdd = user?.role === "admin";

  const { data: tClasses = [] } = useQuery({ queryKey:["teacher-classes",user?.id], queryFn:()=>getTeacherClasses(user!.id), enabled:!!user&&isTeacher });
  const teacherClassIds = new Set((tClasses as any[]).map((tc:any)=>tc.class_id));

  const { data: students = [], isLoading } = useQuery({ queryKey:["students"], queryFn: getStudents });
  const { data: classes = [] } = useQuery({ queryKey:["classes"], queryFn: getClasses });
  const { data: grades = [] } = useQuery({ queryKey:["grades-student",sel?.id], queryFn:()=>getGradesByStudent(sel!.id), enabled:!!sel });
  const { data: attStats } = useQuery({ queryKey:["att-stats",sel?.id], queryFn:()=>getAttendanceStatsByStudent(sel!.id), enabled:!!sel });

  const addMut = useMutation({ mutationFn:()=>addStudent(form), onSuccess:()=>{ qc.invalidateQueries({queryKey:["students"]}); setShowAdd(false); setForm({full_name:"",national_id:"",class_id:"",password_hash:"123456"}); toast.success("تمت إضافة الطالب"); }, onError:()=>toast.error("خطأ - الرقم المدني مكرر") });
  const deleteMut = useMutation({ mutationFn: deleteStudent, onSuccess:()=>{ qc.invalidateQueries({queryKey:["students"]}); setSel(null); toast.success("تم الحذف"); } });

  const allStudents = students as any[];
  const visible = isTeacher ? allStudents.filter(s=>teacherClassIds.has(s.class_id)) : allStudents;
  const filtered = visible.filter(s=>
    (!filterClass||s.class_id===filterClass) &&
    (!search||s.full_name.includes(search)||s.national_id.includes(search))
  );
  const classGroups: Record<string,any[]> = {};
  filtered.forEach(s=>{const k=s.classes?.name||"بدون فصل";if(!classGroups[k])classGroups[k]=[];classGroups[k].push(s);});

  const avgGrade = grades.length>0?((grades as any[]).reduce((s:number,g:any)=>s+(g.score/g.max_score)*100,0)/grades.length).toFixed(1):"0";

  if (!sel) return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="font-heading text-2xl font-bold">الطلاب</h1><p className="text-muted-foreground text-sm mt-1">{visible.length} طالب</p></div>
        {canAdd && <button onClick={()=>setShowAdd(true)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-heading font-medium hover:bg-primary/90"><Plus className="w-4 h-4"/>إضافة طالب</button>}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm" onClick={()=>setShowAdd(false)}>
          <div className="bg-card rounded-xl border shadow-xl p-6 w-full max-w-md mx-4" onClick={e=>e.stopPropagation()} dir="rtl">
            <div className="flex items-center justify-between mb-5"><h2 className="font-heading font-bold text-lg">إضافة طالب</h2><button onClick={()=>setShowAdd(false)} className="p-1.5 rounded hover:bg-accent"><X className="w-4 h-4"/></button></div>
            <div className="space-y-3">
              <input placeholder="الاسم الكامل *" value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} className="w-full px-4 py-2.5 bg-background border rounded-lg text-sm"/>
              <input placeholder="الرقم المدني *" value={form.national_id} onChange={e=>setForm({...form,national_id:e.target.value})} className="w-full px-4 py-2.5 bg-background border rounded-lg text-sm" dir="ltr"/>
              <select value={form.class_id} onChange={e=>setForm({...form,class_id:e.target.value})} className="w-full px-4 py-2.5 bg-background border rounded-lg text-sm">
                <option value="">الفصل الدراسي *</option>
                {(classes as any[]).map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input placeholder="كلمة المرور (افتراضي: 123456)" value={form.password_hash} onChange={e=>setForm({...form,password_hash:e.target.value})} className="w-full px-4 py-2.5 bg-background border rounded-lg text-sm" dir="ltr"/>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={()=>setShowAdd(false)} className="px-4 py-2 text-sm rounded-lg border hover:bg-accent">إلغاء</button>
                <button onClick={()=>addMut.mutate()} disabled={!form.full_name||!form.national_id||!form.class_id} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground disabled:opacity-50 flex items-center gap-1"><Save className="w-3.5 h-3.5"/>حفظ</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs"><Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="بحث..." className="w-full pr-9 pl-4 py-2.5 bg-card border rounded-lg text-sm"/></div>
        <select value={filterClass} onChange={e=>setFilterClass(e.target.value)} className="px-4 py-2.5 bg-card border rounded-lg text-sm">
          <option value="">كل الفصول</option>
          {(classes as any[]).filter(c=>!isTeacher||teacherClassIds.has(c.id)).map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {isLoading?<div className="text-center py-12 text-muted-foreground">جارٍ التحميل...</div>:(
        <div className="space-y-6">
          {Object.entries(classGroups).map(([cn,cs])=>(
            <div key={cn}>
              <h2 className="font-heading font-bold text-sm mb-3 text-muted-foreground flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">{cs.length}</span>{cn}
              </h2>
              <div className="bg-card rounded-lg border overflow-hidden">
                <table className="data-table">
                  <thead><tr><th>#</th><th>الطالب</th><th>الرقم المدني</th><th>إجراءات</th></tr></thead>
                  <tbody>
                    {cs.map((s:any,i:number)=>(
                      <tr key={s.id} onClick={()=>setSel(s)}>
                        <td className="text-muted-foreground">{i+1}</td>
                        <td><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{s.full_name[0]}</div><span className="font-medium">{s.full_name}</span></div></td>
                        <td className="text-muted-foreground font-mono text-xs">{s.national_id}</td>
                        <td onClick={ev=>ev.stopPropagation()}>
                          <div className="flex gap-1">
                            <button onClick={()=>setSel(s)} className="p-1.5 rounded text-muted-foreground hover:bg-accent"><ChevronRight className="w-4 h-4"/></button>
                            {canAdd&&<button onClick={()=>deleteMut.mutate(s.id)} className="p-1.5 rounded text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4"/></button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {Object.keys(classGroups).length===0&&<div className="text-center py-12 text-muted-foreground">لا يوجد طلاب</div>}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-lg border p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={()=>setSel(null)} className="p-2 rounded hover:bg-accent text-muted-foreground"><X className="w-4 h-4"/></button>
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-heading font-bold text-primary">{sel.full_name[0]}</div>
          <div><h2 className="font-heading font-bold">{sel.full_name}</h2><p className="text-xs text-muted-foreground">{sel.classes?.name} • {sel.national_id}</p></div>
        </div>
        {canAdd&&<button onClick={()=>deleteMut.mutate(sel.id)} className="px-4 py-2 text-sm rounded-lg border border-destructive/20 text-destructive hover:bg-destructive/5">حذف</button>}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card text-center"><p className="text-2xl font-bold text-primary">{avgGrade}%</p><p className="text-xs text-muted-foreground mt-1">متوسط الدرجات</p></div>
        <div className="stat-card text-center"><p className="text-2xl font-bold text-success">{attStats?.rate||0}%</p><p className="text-xs text-muted-foreground mt-1">نسبة الحضور</p></div>
        <div className="stat-card text-center"><p className="text-2xl font-bold text-info">{grades.length}</p><p className="text-xs text-muted-foreground mt-1">درجة مسجلة</p></div>
      </div>
      {canAdd && (
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-heading font-semibold text-sm mb-3">تغيير كلمة المرور</h3>
          <AdminChangePassword targetUser={sel} />
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-heading font-semibold text-sm mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary"/>الدرجات</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {(grades as any[]).map((g:any)=>{const pct=(g.score/g.max_score)*100;return(
              <div key={g.id} className="flex items-center justify-between p-2 rounded-lg bg-accent/30">
                <div><p className="text-sm font-medium">{g.subjects?.name}</p><p className="text-xs text-muted-foreground">{g.grade_type} • {g.semester}</p></div>
                <div className="text-left"><p className={`font-bold text-sm ${gradeColor(pct)}`}>{g.score}/{g.max_score}</p><p className="text-xs text-muted-foreground">{gradeLabel(pct)}</p></div>
              </div>
            );})}
            {grades.length===0&&<p className="text-xs text-center py-4 text-muted-foreground">لا توجد درجات</p>}
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-heading font-semibold text-sm mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-info"/>الحضور</h3>
          {attStats&&(
            <div className="space-y-3">
              <div className="flex gap-3 text-sm">
                <span className="text-success font-bold">{attStats.present} حاضر</span>
                <span className="text-destructive font-bold">{attStats.absent} غائب</span>
                <span className="text-warning font-bold">{attStats.late} متأخر</span>
                <span className="text-primary font-bold mr-auto">{attStats.rate}%</span>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {attStats.records.slice(0,20).map((a:any)=>(
                  <div key={a.id} className={`p-1 rounded text-center text-[10px] ${a.status==="حاضر"?"bg-success/10 text-success":a.status==="غائب"?"bg-destructive/10 text-destructive":"bg-warning/10 text-warning"}`}>
                    <p className="font-bold">{a.status==="حاضر"?"✓":a.status==="غائب"?"✗":"~"}</p><p>{a.date.slice(5)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
