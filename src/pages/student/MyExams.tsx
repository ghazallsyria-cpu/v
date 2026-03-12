import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getExams, submitExamAnswers, getStudentExamResults } from "@/lib/api";
import { toast } from "sonner";
import { Clock, CheckCircle, PenTool, AlertTriangle, Calendar } from "lucide-react";
import { LatexContent } from "@/components/LatexContent";

// ── Timer component ────────────────────────────────────
function ExamTimer({ durationMins, onExpire }: { durationMins: number; onExpire: () => void }) {
  const [seconds, setSeconds] = useState(durationMins * 60);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) { clearInterval(intervalRef.current); onExpire(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const pct = (seconds / (durationMins * 60)) * 100;
  const urgent = pct < 25;

  return (
    <div className={`fixed top-4 left-4 z-50 bg-card border-2 rounded-xl p-3 shadow-lg ${urgent ? "border-destructive animate-pulse" : "border-primary/30"}`}>
      <div className={`flex items-center gap-2 font-heading font-bold text-lg ${urgent ? "text-destructive" : "text-primary"}`}>
        <Clock className="w-5 h-5" />
        {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </div>
      <div className="mt-1.5 h-1.5 bg-accent rounded-full overflow-hidden w-28">
        <div className={`h-full rounded-full transition-all ${urgent ? "bg-destructive" : "bg-primary"}`} style={{ width: `${pct}%` }} />
      </div>
      {urgent && <p className="text-[10px] text-destructive mt-1">⚠️ الوقت ينتهي قريباً!</p>}
    </div>
  );
}

export default function MyExams() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeExam, setActiveExam] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<any>(null);

  const { data: allExams = [], isLoading } = useQuery({ queryKey: ["my-exams", user?.class_id], queryFn: getExams, enabled: !!user });
  const { data: myResults = [] } = useQuery({ queryKey: ["my-exam-results", user?.id], queryFn: () => getStudentExamResults(user!.id), enabled: !!user });

  const exams = (allExams as any[]).filter(e =>
    e.is_published && (e.class_id === user?.class_id || !e.class_id)
  );
  const resultMap = new Map((myResults as any[]).map(r => [r.exam_id, r]));

  // Check if exam is available (timing)
  const isAvailable = (exam: any) => {
    if (!exam.start_datetime && !exam.end_datetime) return true;
    const now = new Date();
    if (exam.start_datetime && new Date(exam.start_datetime) > now) return false;
    if (exam.end_datetime && new Date(exam.end_datetime) < now) return false;
    return true;
  };
  const isUpcoming = (exam: any) => exam.start_datetime && new Date(exam.start_datetime) > new Date();
  const isExpired = (exam: any) => exam.end_datetime && new Date(exam.end_datetime) < new Date();

  const submitMut = useMutation({
    mutationFn: () => submitExamAnswers(activeExam!.id, user!.id, Object.entries(answers).map(([qid, ans]) => ({ question_id: qid, answer: ans }))),
    onSuccess: (res) => {
      setScore(res);
      setSubmitted(true);
      qc.invalidateQueries({ queryKey: ["my-exam-results"] });
      toast.success("تم تسليم الاختبار");
    },
    onError: () => toast.error("خطأ في التسليم")
  });

  const handleExpire = () => {
    if (!submitted) { toast.error("انتهى الوقت! سيتم تسليم الاختبار تلقائياً"); submitMut.mutate(); }
  };

  const handleStart = (exam: any) => {
    setActiveExam(exam); setAnswers({}); setSubmitted(false); setScore(null);
  };

  if (activeExam && !submitted) {
    const questions = activeExam.exam_questions || [];
    const answered = Object.keys(answers).length;
    return (
      <div className="space-y-5 pb-20">
        {activeExam.duration_minutes > 0 && <ExamTimer durationMins={activeExam.duration_minutes} onExpire={handleExpire} />}
        <div className="bg-primary/5 rounded-xl border border-primary/20 p-5">
          <h1 className="font-heading text-xl font-bold">{activeExam.title}</h1>
          <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
            <span>{activeExam.subjects?.name}</span>
            <span>{activeExam.total_marks} درجة كلية</span>
            {activeExam.duration_minutes > 0 && <span className="flex items-center gap-1 text-warning"><Clock className="w-3.5 h-3.5" />{activeExam.duration_minutes} دقيقة</span>}
          </div>
          <div className="mt-3 h-2 bg-accent rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: questions.length > 0 ? `${(answered / questions.length) * 100}%` : "0%" }} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{answered} / {questions.length} سؤال</p>
        </div>

        <div className="space-y-5">
          {questions.map((q: any, i: number) => (
            <div key={q.id} className={`bg-card rounded-xl border p-5 ${answers[q.id] ? "border-primary/30" : ""}`}>
              <div className="flex gap-3 mb-4">
                <span className="w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-heading font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <div className="flex-1"><LatexContent content={q.question_text} /></div>
                <span className="text-xs text-muted-foreground shrink-0">{q.marks} درجة</span>
              </div>
              {q.question_type === "multiple_choice" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mr-11">
                  {(q.options || []).filter(Boolean).map((opt: string, j: number) => (
                    <button key={j} onClick={() => setAnswers(p => ({ ...p, [q.id]: opt }))}
                      className={`p-3 rounded-lg border text-right text-sm transition-all ${answers[q.id] === opt ? "bg-primary text-primary-foreground border-primary shadow-sm" : "hover:bg-accent"}`}>
                      <span className="font-bold ml-2">{["أ","ب","ج","د"][j]}</span> {opt}
                    </button>
                  ))}
                </div>
              )}
              {q.question_type === "true_false" && (
                <div className="flex gap-3 mr-11">
                  {["صح", "خطأ"].map(v => (
                    <button key={v} onClick={() => setAnswers(p => ({ ...p, [q.id]: v }))}
                      className={`flex-1 py-3 rounded-lg border text-sm font-heading font-semibold transition-all ${answers[q.id] === v ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"}`}>
                      {v === "صح" ? "✓ صح" : "✗ خطأ"}
                    </button>
                  ))}
                </div>
              )}
              {q.question_type === "short_answer" && (
                <textarea value={answers[q.id] || ""} onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
                  placeholder="اكتب إجابتك هنا..." rows={3}
                  className="w-full mr-11 w-[calc(100%-44px)] px-4 py-2.5 bg-background border rounded-lg text-sm resize-none"/>
              )}
            </div>
          ))}
        </div>

        <div className="fixed bottom-0 inset-x-0 bg-card border-t p-4 flex items-center justify-between gap-4">
          <button onClick={() => setActiveExam(null)} className="px-4 py-2 text-sm rounded-lg border hover:bg-accent">رجوع</button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{answered}/{questions.length} أجبت</span>
            {answered < questions.length && <span className="text-xs text-warning flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />{questions.length - answered} لم تجب عليها</span>}
            <button onClick={() => submitMut.mutate()} disabled={submitMut.isPending || answered === 0}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-heading font-semibold hover:bg-primary/90 disabled:opacity-60">
              <CheckCircle className="w-4 h-4" />{submitMut.isPending ? "جارٍ التسليم..." : "تسليم الاختبار"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (activeExam && submitted && score) {
    const pct = score.percentage || 0;
    const passed = pct >= (activeExam.pass_marks / activeExam.total_marks * 100);
    return (
      <div className="space-y-5">
        <div className={`text-center py-10 rounded-xl border-2 ${passed ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}>
          <div className={`text-6xl font-bold font-heading mb-2 ${passed ? "text-success" : "text-destructive"}`}>{pct}%</div>
          <p className={`text-2xl font-heading font-bold ${passed ? "text-success" : "text-destructive"}`}>{passed ? "✓ ناجح" : "✗ راسب"}</p>
          <p className="text-muted-foreground mt-2">{score.obtained_marks} / {score.total_marks} درجة</p>
          <p className="text-sm mt-1 text-muted-foreground">{score.correct_count} إجابة صحيحة من {score.total_questions}</p>
        </div>
        <button onClick={() => setActiveExam(null)} className="w-full py-3 rounded-xl border text-sm font-heading font-medium hover:bg-accent">العودة لقائمة الاختبارات</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div><h1 className="font-heading text-2xl font-bold">اختباراتي</h1><p className="text-muted-foreground text-sm mt-1">الاختبارات المتاحة لفصلك</p></div>
      {isLoading && <div className="text-center py-12 text-muted-foreground">جارٍ التحميل...</div>}
      {exams.length === 0 && !isLoading && (
        <div className="text-center py-12 text-muted-foreground bg-card rounded-lg border">
          <PenTool className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>لا توجد اختبارات منشورة</p>
        </div>
      )}
      <div className="space-y-3">
        {exams.map((exam: any) => {
          const result = resultMap.get(exam.id);
          const available = isAvailable(exam);
          const upcoming = isUpcoming(exam);
          const expired = isExpired(exam);
          return (
            <div key={exam.id} className={`bg-card rounded-xl border p-5 ${!available ? "opacity-70" : ""}`}>
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${result ? (result.status==="pass"?"bg-success/10":"bg-destructive/10") : available?"bg-primary/10":"bg-accent"}`}>
                  {result ? (result.status==="pass"?<CheckCircle className="w-5 h-5 text-success"/>:<span className="text-destructive font-bold">✗</span>) : <PenTool className={`w-5 h-5 ${available?"text-primary":"text-muted-foreground"}`}/>}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-heading font-bold text-sm">{exam.title}</h3>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">{exam.subjects?.name}</span>
                    <span className="text-xs bg-accent px-1.5 py-0.5 rounded">{exam.exam_type}</span>
                    {exam.duration_minutes > 0 && <span className="text-xs flex items-center gap-0.5 text-warning"><Clock className="w-3 h-3" />{exam.duration_minutes}د</span>}
                    {upcoming && <span className="text-xs flex items-center gap-0.5 text-info"><Calendar className="w-3 h-3" />يبدأ {new Date(exam.start_datetime).toLocaleString("ar")}</span>}
                    {expired && <span className="text-xs text-destructive">انتهت المهلة</span>}
                  </div>
                  {result && <p className={`text-sm font-bold mt-1 ${result.status==="pass"?"text-success":"text-destructive"}`}>{result.percentage}% • {result.status==="pass"?"ناجح ✓":"راسب ✗"}</p>}
                </div>
                {!result && available && (
                  <button onClick={() => handleStart({ ...exam, exam_questions: [] })}
                    className="shrink-0 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-heading font-semibold hover:bg-primary/90">
                    بدء الاختبار
                  </button>
                )}
                {result && <span className={`shrink-0 text-xs px-2 py-1 rounded-full font-heading ${result.status==="pass"?"badge-success":"badge-destructive"}`}>{result.status==="pass"?"ناجح":"راسب"}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
