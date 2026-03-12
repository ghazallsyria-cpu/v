import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getExams, addExam, updateExam, deleteExam, getClasses, getSubjects, getExamQuestions, addExamQuestion, updateExamQuestion, deleteExamQuestion, getExamResults, getStudentsByClass, getTeacherClasses, getTeacherSubjects } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, X, Save, Eye, EyeOff, PenTool, ChevronRight, Clock, Users, CheckCircle, BarChart3, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { LatexContent } from "@/components/LatexContent";

const EXAM_TYPES = ["اختبار فصلي","اختبار شهري","اختبار قصير","واجب","نشاط","مشروع"];

export default function ExamsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isTeacher = user?.role === "teacher";
  const [tab, setTab] = useState<"list"|"builder"|"results">("list");
  const [sel, setSel] = useState<any>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showAddQ, setShowAddQ] = useState(false);
  const [editingQ, setEditingQ] = useState<any>(null);
  const [viewingStudent, setViewingStudent] = useState<any>(null);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);

  const now = new Date();
  const defaultStart = `${now.toISOString().slice(0,10)}T${now.toTimeString().slice(0,5)}`;
  const defaultEnd = `${now.toISOString().slice(0,10)}T23:59`;

  const [form, setForm] = useState({
    title:"", subject_id:"", class_id:"", teacher_id:"",
    exam_type:"اختبار فصلي", total_marks:100,
    duration_minutes: 0,
    timing_type: "open" as "open"|"scheduled",
    start_time: defaultStart,
    end_time: defaultEnd,
    is_published:false
  });
  const [newQ, setNewQ] = useState({ question_text:"", question_type:"multiple_choice", correct_answer:"", marks:1, options:["","","",""] });

  // Queries
  const { data: allExams = [], isLoading } = useQuery({ queryKey:["exams"], queryFn: getExams });
  const { data: allClasses = [] } = useQuery({ queryKey:["classes"], queryFn: getClasses });
  const { data: allSubjects = [] } = useQuery({ queryKey:["subjects"], queryFn: getSubjects });
  const { data: tClasses = [] } = useQuery({ queryKey:["teacher-classes",user?.id], queryFn:()=>getTeacherClasses(user!.id), enabled:!!user&&isTeacher });
  const { data: tSubjects = [] } = useQuery({ queryKey:["teacher-subjects",user?.id], queryFn:()=>getTeacherSubjects(user!.id), enabled:!!user&&isTeacher });
  const { data: questions = [] } = useQuery({ queryKey:["exam-questions",sel?.id], queryFn:()=>getExamQuestions(sel!.id), enabled:!!sel });
  const { data: results = [] } = useQuery({ queryKey:["exam-results-detail",sel?.id], queryFn:()=>getExamResults(sel!.id), enabled:!!sel&&tab==="results" });
  const { data: classStudents = [] } = useQuery({ queryKey:["students-class",sel?.class_id], queryFn:()=>getStudentsByClass(sel!.class_id), enabled:!!sel?.class_id&&tab==="results" });

  const assignedClassIds = new Set((tClasses as any[]).map((tc:any)=>tc.class_id));
  const assignedSubjIds = new Set((tSubjects as any[]).map((ts:any)=>ts.subject_id));
  const classes = isTeacher?(allClasses as any[]).filter(c=>assignedClassIds.has(c.id)):allClasses;
  const subjects = isTeacher?(allSubjects as any[]).filter(s=>assignedSubjIds.has(s.id)):allSubjects;

  // Filter exams for teacher
  const exams = isTeacher?(allExams as any[]).filter(e=>!e.teacher_id||e.teacher_id===user?.id):allExams;

  // Set teacher_id automatically
  useEffect(()=>{
    if(isTeacher&&user) setForm(f=>({...f,teacher_id:user.id}));
  },[isTeacher,user]);

  // Mutations
  const addMut = useMutation({
    mutationFn:async()=>{
      if(selectedClasses.length>1){
        // Create exam for each selected class
        for(const cid of selectedClasses){
          await addExam({...form, teacher_id: isTeacher ? user!.id : form.teacher_id,class_id:cid,
            start_time:form.timing_type==="scheduled"?form.start_time:null,
            end_time:form.timing_type==="scheduled"?form.end_time:null,
            duration_minutes:form.duration_minutes||null
          });
        }
      } else {
        await addExam({...form, teacher_id: isTeacher ? user!.id : form.teacher_id,
          start_time:form.timing_type==="scheduled"?form.start_time:null,
          end_time:form.timing_type==="scheduled"?form.end_time:null,
          duration_minutes:form.duration_minutes||null
        });
      }
    },
    onSuccess:()=>{ qc.invalidateQueries({queryKey:["exams"]}); setShowAdd(false); setSelectedClasses([]); toast.success("تم إنشاء الاختبار"); },
    onError:()=>toast.error("خطأ في الإنشاء")
  });
  const deleteMut = useMutation({ mutationFn: deleteExam, onSuccess:()=>{ qc.invalidateQueries({queryKey:["exams"]}); setSel(null); setTab("list"); toast.success("تم الحذف"); } });
  const togglePub = useMutation({
    mutationFn:(e:any)=>updateExam(e.id,{is_published:!e.is_published}),
    onSuccess:(_,e)=>{ qc.invalidateQueries({queryKey:["exams"]}); if(sel?.id===e.id) setSel({...sel,is_published:!sel.is_published}); toast.success("تم تحديث حالة النشر"); }
  });
  const addQMut = useMutation({
    mutationFn:()=>addExamQuestion({exam_id:sel!.id,...newQ}),
    onSuccess:()=>{ qc.invalidateQueries({queryKey:["exam-questions",sel?.id]}); setShowAddQ(false); setNewQ({question_text:"",question_type:"multiple_choice",correct_answer:"",marks:1,options:["","","",""]}); toast.success("تم إضافة السؤال"); },
    onError:()=>toast.error("خطأ")
  });
  const updQMut = useMutation({ mutationFn:({id,...u}:any)=>updateExamQuestion(id,u), onSuccess:()=>{ qc.invalidateQueries({queryKey:["exam-questions",sel?.id]}); setEditingQ(null); } });
  const delQMut = useMutation({ mutationFn: deleteExamQuestion, onSuccess:()=>qc.invalidateQueries({queryKey:["exam-questions",sel?.id]}) });

  const totalMarks = (questions as any[]).reduce((s:number,q:any)=>s+q.marks,0);

  // Results processing
  const passed = (results as any[]).filter((r:any)=>r.status==="pass").length;
  const failed = (results as any[]).filter((r:any)=>r.status==="fail").length;
  const avgScore = results.length>0?((results as any[]).reduce((s:number,r:any)=>s+r.percentage,0)/results.length).toFixed(1):"0";
  const pieData = [
    {name:"ناجح",value:passed,color:"hsl(var(--success))"},
    {name:"راسب",value:failed,color:"hsl(var(--destructive))"}
  ].filter(d=>d.value>0);

  if(!sel) return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="font-heading text-2xl font-bold">الاختبارات</h1><p className="text-muted-foreground text-sm mt-1">{exams.length} اختبار</p></div>
        <button onClick={()=>setShowAdd(true)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-heading font-medium hover:bg-primary/90"><Plus className="w-4 h-4"/>إضافة اختبار</button>
      </div>

      {showAdd&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm" onClick={()=>setShowAdd(false)}>
          <div className="bg-card rounded-xl border shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()} dir="rtl">
            <div className="flex items-center justify-between mb-5"><h2 className="font-heading font-bold text-lg">إضافة اختبار / واجب</h2><button onClick={()=>setShowAdd(false)} className="p-1.5 rounded hover:bg-accent"><X className="w-4 h-4"/></button></div>
            <div className="space-y-3">
              <input placeholder="عنوان الاختبار *" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} className="w-full px-4 py-2.5 bg-background border rounded-lg text-sm"/>
              <select value={form.exam_type} onChange={e=>setForm({...form,exam_type:e.target.value})} className="w-full px-4 py-2.5 bg-background border rounded-lg text-sm">
                {EXAM_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
              <select value={form.subject_id} onChange={e=>setForm({...form,subject_id:e.target.value})} className="w-full px-4 py-2.5 bg-background border rounded-lg text-sm">
                <option value="">المادة الدراسية *</option>
                {(subjects as any[]).map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>

              {/* Multi-class selection */}
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">الفصول الدراسية * <span className="text-info">(يمكن اختيار أكثر من فصل)</span></label>
                <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto bg-background border rounded-lg p-2">
                  {(classes as any[]).map((c:any)=>(
                    <label key={c.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-accent cursor-pointer text-sm">
                      <input type="checkbox" checked={selectedClasses.includes(c.id)} onChange={e=>{
                        if(e.target.checked) setSelectedClasses(p=>[...p,c.id]);
                        else setSelectedClasses(p=>p.filter(id=>id!==c.id));
                        setForm(f=>({...f,class_id:c.id})); // last selected
                      }} className="rounded"/>
                      {c.name} <span className="text-xs text-muted-foreground">{c.grade}</span>
                    </label>
                  ))}
                </div>
                {selectedClasses.length>0&&<p className="text-xs text-info mt-1">✓ {selectedClasses.length} فصل محدد</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground block mb-1">الدرجة الكلية</label><input type="number" value={form.total_marks} onChange={e=>setForm({...form,total_marks:+e.target.value})} className="w-full px-3 py-2 bg-background border rounded-lg text-sm"/></div>
                
              </div>

              {/* Timing */}
              <div className="bg-accent/30 rounded-lg p-3 space-y-2">
                <label className="text-xs font-heading font-semibold block">⏱️ إعدادات الوقت</label>
                <div className="flex gap-3">
                  {[["open","وقت مفتوح"],["scheduled","وقت محدد"]].map(([v,l])=>(
                    <label key={v} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="radio" name="timing" value={v} checked={form.timing_type===v} onChange={()=>setForm({...form,timing_type:v as any})} className="accent-primary"/>
                      {l}
                    </label>
                  ))}
                </div>
                {form.timing_type==="scheduled"&&(
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="text-xs text-muted-foreground block mb-1">بداية الاختبار</label><input type="datetime-local" value={form.start_time} onChange={e=>setForm({...form,start_time:e.target.value})} className="w-full px-2 py-1.5 bg-background border rounded-lg text-xs"/></div>
                    <div><label className="text-xs text-muted-foreground block mb-1">نهاية الاختبار</label><input type="datetime-local" value={form.end_time} onChange={e=>setForm({...form,end_time:e.target.value})} className="w-full px-2 py-1.5 bg-background border rounded-lg text-xs"/></div>
                  </div>
                )}
                <div><label className="text-xs text-muted-foreground block mb-1">مدة الاختبار بالدقائق <span className="text-info">(0 = بلا حد)</span></label><input type="number" min="0" value={form.duration_minutes} onChange={e=>setForm({...form,duration_minutes:+e.target.value})} placeholder="0" className="w-full px-3 py-2 bg-background border rounded-lg text-sm"/></div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button onClick={()=>setShowAdd(false)} className="px-4 py-2 text-sm rounded-lg border hover:bg-accent">إلغاء</button>
                <button onClick={()=>addMut.mutate()} disabled={!form.title||!form.subject_id||selectedClasses.length===0||addMut.isPending}
                  className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground disabled:opacity-50 flex items-center gap-1"><Save className="w-3.5 h-3.5"/>{addMut.isPending?"جارٍ الحفظ...":"إنشاء الاختبار"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card rounded-lg border overflow-hidden">
        <table className="data-table">
          <thead><tr><th>الاختبار</th><th>المادة</th><th>الفصل</th><th>النوع</th><th>الوقت</th><th>الحالة</th><th>إجراءات</th></tr></thead>
          <tbody>
            {isLoading&&<tr><td colSpan={7} className="text-center py-8 text-muted-foreground">جارٍ التحميل...</td></tr>}
            {(exams as any[]).map((e:any)=>(
              <tr key={e.id} onClick={()=>{setSel(e);setTab("builder");}}>
                <td><span className="font-medium">{e.title}</span></td>
                <td className="text-muted-foreground text-xs">{e.subjects?.name||"—"}</td>
                <td className="text-muted-foreground text-xs">{e.classes?.name||"—"}</td>
                <td><span className="text-xs bg-accent px-2 py-0.5 rounded">{e.exam_type}</span></td>
                <td className="text-xs text-muted-foreground">
                  {e.duration_minutes>0?<span className="flex items-center gap-1 text-warning"><Clock className="w-3 h-3"/>{e.duration_minutes}د</span>:"مفتوح"}
                </td>
                <td onClick={ev=>ev.stopPropagation()}>
                  <button onClick={()=>togglePub.mutate(e)} className={`text-xs px-2 py-1 rounded-full font-medium ${e.is_published?"badge-success":"badge-destructive"}`}>
                    {e.is_published?"منشور":"مسودة"}
                  </button>
                </td>
                <td onClick={ev=>ev.stopPropagation()}>
                  <div className="flex gap-1">
                    <button onClick={()=>{setSel(e);setTab("builder");}} className="p-1.5 rounded hover:bg-accent text-muted-foreground"><PenTool className="w-3.5 h-3.5"/></button>
                    <button onClick={()=>{setSel(e);setTab("results");}} className="p-1.5 rounded hover:bg-accent text-muted-foreground"><BarChart3 className="w-3.5 h-3.5"/></button>
                    <button onClick={()=>deleteMut.mutate(e.id)} className="p-1.5 rounded text-destructive hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading&&exams.length===0&&<tr><td colSpan={7} className="text-center py-8 text-muted-foreground">لا توجد اختبارات</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Exam header */}
      <div className="bg-card rounded-lg border p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={()=>{setSel(null);setTab("list");}} className="p-2 rounded hover:bg-accent text-muted-foreground"><X className="w-4 h-4"/></button>
          <div>
            <h2 className="font-heading font-bold">{sel.title}</h2>
            <p className="text-xs text-muted-foreground">{sel.subjects?.name} • {sel.classes?.name} • {sel.exam_type}</p>
            {sel.duration_minutes>0&&<p className="text-xs text-warning flex items-center gap-1 mt-0.5"><Clock className="w-3 h-3"/>مدة الاختبار: {sel.duration_minutes} دقيقة</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>togglePub.mutate(sel)} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border font-heading ${sel.is_published?"border-destructive/30 text-destructive hover:bg-destructive/5":"border-success/30 text-success hover:bg-success/5"}`}>
            {sel.is_published?<><EyeOff className="w-3.5 h-3.5"/>إلغاء النشر</>:<><Eye className="w-3.5 h-3.5"/>نشر للطلاب</>}
          </button>
          <button onClick={()=>deleteMut.mutate(sel.id)} className="p-2 rounded border border-destructive/20 text-destructive hover:bg-destructive/5"><Trash2 className="w-4 h-4"/></button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-lg border overflow-hidden bg-card">
        {([["builder","بناء الاختبار"],["results","النتائج والحلول"]] as const).map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} className={`flex-1 py-2.5 text-sm font-heading ${tab===t?"bg-primary text-primary-foreground":"text-muted-foreground hover:bg-accent"}`}>{l}</button>
        ))}
      </div>

      {/* Builder */}
      {tab==="builder"&&(
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{questions.length} سؤال • {totalMarks} درجة إجمالية</p>
            <button onClick={()=>setShowAddQ(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-heading hover:bg-primary/90"><Plus className="w-4 h-4"/>إضافة سؤال</button>
          </div>

          {showAddQ&&(
            <div className="bg-card rounded-lg border p-5 space-y-3">
              <h3 className="font-heading font-semibold text-sm">سؤال جديد</h3>
              <select value={newQ.question_type} onChange={e=>setNewQ({...newQ,question_type:e.target.value,correct_answer:""})} className="w-full px-4 py-2.5 bg-background border rounded-lg text-sm">
                {[["multiple_choice","اختيار من متعدد"],["true_false","صح وخطأ"],["short_answer","إجابة قصيرة"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">نص السؤال <span className="text-info">(يدعم LaTeX: $x^2+y^2=r^2$)</span></label>
                <textarea value={newQ.question_text} onChange={e=>setNewQ({...newQ,question_text:e.target.value})} rows={3} className="w-full px-4 py-2.5 bg-background border rounded-lg text-sm resize-none"/>
                {newQ.question_text&&<div className="mt-1 p-2 bg-accent/20 rounded text-xs"><LatexContent content={newQ.question_text}/></div>}
              </div>
              {newQ.question_type==="multiple_choice"&&(
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">الخيارات (اضغط على ✓ لتحديد الإجابة الصحيحة)</label>
                  {newQ.options.map((opt,i)=>(
                    <div key={i} className="flex gap-2 items-center">
                      <button onClick={()=>setNewQ({...newQ,correct_answer:opt})} className={`w-7 h-7 rounded-full text-xs font-bold shrink-0 ${newQ.correct_answer===opt?"bg-success text-white":"bg-accent"}`}>
                        {newQ.correct_answer===opt?"✓":["أ","ب","ج","د"][i]}
                      </button>
                      <input value={opt} onChange={e=>{ const o=[...newQ.options]; o[i]=e.target.value; setNewQ({...newQ,options:o}); if(newQ.correct_answer===newQ.options[i]) setNewQ(n=>({...n,correct_answer:e.target.value})); }} className="flex-1 px-3 py-1.5 bg-background border rounded-lg text-sm"/>
                    </div>
                  ))}
                </div>
              )}
              {newQ.question_type==="true_false"&&(
                <div className="flex gap-2">
                  {["صح","خطأ"].map(v=>(
                    <button key={v} onClick={()=>setNewQ({...newQ,correct_answer:v})} className={`flex-1 py-2 text-sm rounded-lg border font-heading ${newQ.correct_answer===v?"bg-primary text-primary-foreground":"hover:bg-accent"}`}>{v}</button>
                  ))}
                </div>
              )}
              {newQ.question_type==="short_answer"&&(
                <input placeholder="الإجابة النموذجية" value={newQ.correct_answer} onChange={e=>setNewQ({...newQ,correct_answer:e.target.value})} className="w-full px-4 py-2.5 bg-background border rounded-lg text-sm"/>
              )}
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">الدرجة:</label>
                <input type="number" min="1" value={newQ.marks} onChange={e=>setNewQ({...newQ,marks:+e.target.value})} className="w-20 px-3 py-1.5 bg-background border rounded-lg text-sm"/>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={()=>setShowAddQ(false)} className="px-4 py-2 text-sm rounded-lg border hover:bg-accent">إلغاء</button>
                <button onClick={()=>addQMut.mutate()} disabled={!newQ.question_text||(!newQ.correct_answer&&newQ.question_type!=="short_answer")}
                  className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground disabled:opacity-50"><Save className="w-3.5 h-3.5 inline ml-1"/>حفظ السؤال</button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {(questions as any[]).map((q:any,i:number)=>(
              <div key={q.id} className="bg-card rounded-lg border p-4">
                {editingQ?.id===q.id ? (
                  <div className="space-y-2">
                    <textarea value={editingQ.question_text} onChange={e=>setEditingQ({...editingQ,question_text:e.target.value})} rows={2} className="w-full px-3 py-2 bg-background border rounded-lg text-sm resize-none"/>
                    <input value={editingQ.correct_answer} onChange={e=>setEditingQ({...editingQ,correct_answer:e.target.value})} placeholder="الإجابة" className="w-full px-3 py-2 bg-background border rounded-lg text-sm"/>
                    <div className="flex gap-2 justify-end">
                      <button onClick={()=>setEditingQ(null)} className="px-3 py-1.5 text-xs rounded-lg border hover:bg-accent">إلغاء</button>
                      <button onClick={()=>updQMut.mutate(editingQ)} className="px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground">حفظ</button>
                    </div>
                  </div>
                ):(
                  <div className="flex items-start gap-3">
                    <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{i+1}</span>
                    <div className="flex-1">
                      <LatexContent content={q.question_text}/>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-xs bg-accent px-2 py-0.5 rounded">{q.question_type==="multiple_choice"?"اختيار متعدد":q.question_type==="true_false"?"صح/خطأ":"قصير"}</span>
                        <span className="text-xs text-success">✓ {q.correct_answer}</span>
                        <span className="text-xs text-muted-foreground">{q.marks} درجة</span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={()=>setEditingQ({...q})} className="p-1.5 rounded hover:bg-accent text-muted-foreground"><PenTool className="w-3.5 h-3.5"/></button>
                      <button onClick={()=>delQMut.mutate(q.id)} className="p-1.5 rounded text-destructive hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5"/></button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {questions.length===0&&<div className="text-center py-12 text-muted-foreground bg-card rounded-lg border"><PenTool className="w-12 h-12 mx-auto mb-3 opacity-20"/><p>لا توجد أسئلة — ابدأ بإضافة السؤال الأول</p></div>}
          </div>
        </div>
      )}

      {/* Results & Student answers */}
      {tab==="results"&&(
        <div className="space-y-4">
          {viewingStudent ? (
            <div className="space-y-4">
              <div className="bg-card rounded-lg border p-4 flex items-center gap-3">
                <button onClick={()=>setViewingStudent(null)} className="p-2 rounded hover:bg-accent text-muted-foreground"><X className="w-4 h-4"/></button>
                <div>
                  <h3 className="font-heading font-bold">{viewingStudent.student_name}</h3>
                  <p className="text-xs text-muted-foreground">النتيجة: <span className={`font-bold ${viewingStudent.percentage>=50?"text-success":"text-destructive"}`}>{viewingStudent.percentage}%</span> • {viewingStudent.obtained_marks}/{viewingStudent.total_marks}</p>
                </div>
              </div>
              <div className="space-y-3">
                {(questions as any[]).map((q:any,i:number)=>{
                  const answer = viewingStudent.answers?.find((a:any)=>a.question_id===q.id);
                  const correct = answer?.answer===q.correct_answer;
                  return (
                    <div key={q.id} className={`bg-card rounded-lg border p-4 ${correct?"border-success/20":"border-destructive/20"}`}>
                      <div className="flex items-start gap-2 mb-2">
                        <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${correct?"bg-success/10 text-success":"bg-destructive/10 text-destructive"}`}>{i+1}</span>
                        <LatexContent content={q.question_text}/>
                      </div>
                      <div className="flex gap-4 text-xs mt-2 mr-8">
                        <span>إجابة الطالب: <span className={`font-bold ${correct?"text-success":"text-destructive"}`}>{answer?.answer||"لم يجب"}</span></span>
                        {!correct&&<span>الإجابة الصحيحة: <span className="font-bold text-success">{q.correct_answer}</span></span>}
                        <span className="mr-auto">{correct?q.marks:0}/{q.marks} درجة</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ):(
            <>
              {results.length>0&&(
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="grid grid-cols-2 gap-3 lg:col-span-2">
                    {[["متقدم",results.length,"text-primary"],["ناجح",passed,"text-success"],["راسب",failed,"text-destructive"],["متوسط",`${avgScore}%`,"text-info"]].map(([l,v,c])=>(
                      <div key={l as string} className="bg-card rounded-lg border p-4 text-center">
                        <p className={`text-2xl font-bold font-heading ${c}`}>{v}</p>
                        <p className="text-xs text-muted-foreground mt-1">{l}</p>
                      </div>
                    ))}
                  </div>
                  {pieData.length>0&&<div className="bg-card rounded-lg border p-4 flex items-center justify-center">
                    <PieChart width={150} height={150}>
                      <Pie data={pieData} cx={75} cy={75} innerRadius={40} outerRadius={65} dataKey="value">
                        {pieData.map((d,i)=><Cell key={i} fill={d.color}/>)}
                      </Pie>
                      <Tooltip formatter={(v,n)=>[v,n]}/>
                    </PieChart>
                  </div>}
                </div>
              )}
              <div className="bg-card rounded-lg border overflow-hidden">
                <table className="data-table">
                  <thead><tr><th>#</th><th>الطالب</th><th>الدرجة</th><th>النتيجة</th><th>عرض الحل</th></tr></thead>
                  <tbody>
                    {(results as any[]).map((r:any,i:number)=>(
                      <tr key={r.id}>
                        <td className="text-muted-foreground">{i+1}</td>
                        <td className="font-medium">{r.users?.full_name||"—"}</td>
                        <td><span className={`font-bold ${r.percentage>=50?"text-success":"text-destructive"}`}>{r.obtained_marks}/{r.total_marks}</span> <span className="text-xs text-muted-foreground">({r.percentage}%)</span></td>
                        <td><span className={`text-xs px-2 py-0.5 rounded-full ${r.status==="pass"?"badge-success":"badge-destructive"}`}>{r.status==="pass"?"ناجح ✓":"راسب ✗"}</span></td>
                        <td><button onClick={()=>setViewingStudent({...r,student_name:r.users?.full_name})} className="p-1.5 rounded hover:bg-accent text-info"><Eye className="w-4 h-4"/></button></td>
                      </tr>
                    ))}
                    {results.length===0&&<tr><td colSpan={5} className="text-center py-8 text-muted-foreground">لم يتقدم أي طالب بعد</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
