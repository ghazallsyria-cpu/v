import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getClasses, getStudentsByClass, getTimetableByClass, getAttendanceForClassDay, upsertAttendanceV2, getAllAttendanceRange, getTeacherDaySlots, getAttendanceStatsByStudent, getStudentsByClass } from "@/lib/api";
import { toast } from "sonner";
import { Save, Calendar, TrendingUp, ChevronLeft, ChevronRight, Clock, Users, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const DAYS_AR = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const STATUS_COLORS: Record<string,string> = { "حاضر":"bg-success text-white","غائب":"bg-destructive text-white","متأخر":"bg-warning text-white" };

function addDays(d: string, n: number) { const dt=new Date(d); dt.setDate(dt.getDate()+n); return dt.toISOString().split("T")[0]; }

// ─── ADMIN ───────────────────────────────────────
function AdminAttendance() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = new Date().toISOString().split("T")[0];
  const [cls, setCls] = useState("");
  const [date, setDate] = useState(today);
  const [activePeriod, setActivePeriod] = useState(1);
  const [statusMap, setStatusMap] = useState<Record<number,Record<string,string>>>({});
  const [tab, setTab] = useState<"register"|"stats">("register");

  const { data: classes = [] } = useQuery({ queryKey:["classes"], queryFn: getClasses });
  const { data: students = [] } = useQuery({ queryKey:["students-class",cls], queryFn:()=>getStudentsByClass(cls), enabled:!!cls });
  const { data: timetable = [] } = useQuery({ queryKey:["timetable",cls], queryFn:()=>getTimetableByClass(cls), enabled:!!cls });

  // KEY FIX: use useEffect instead of onSuccess (removed in RQ v5)
  const { data: existingAtt = [] } = useQuery({
    queryKey:["att-class-day",cls,date],
    queryFn:()=>getAttendanceForClassDay(cls,date),
    enabled:!!cls
  });
  useEffect(()=>{
    if (!existingAtt.length || !students.length) return;
    const newMap: Record<number,Record<string,string>> = {};
    // Initialize all as present
    const dayOfWeek = new Date(date).getDay();
    const daySlots = (timetable as any[]).filter(s=>s.day_of_week===dayOfWeek);
    const periods = daySlots.length>0?daySlots.map((s:any)=>s.period_number):[1,2,3,4,5,6];
    periods.forEach(p=>{
      newMap[p]={};
      (students as any[]).forEach((s:any)=>{ newMap[p][s.id]="حاضر"; });
    });
    // Override with actual data
    (existingAtt as any[]).forEach(r=>{
      if(!newMap[r.period_number]) newMap[r.period_number]={};
      newMap[r.period_number][r.student_id]=r.status;
    });
    setStatusMap(newMap);
  },[existingAtt, students, date, timetable]);

  const { data: rangeAtt = [] } = useQuery({ queryKey:["att-range-30"], queryFn:()=>getAllAttendanceRange(addDays(today,-30),today), enabled:tab==="stats" });

  const dayOfWeek = new Date(date).getDay();
  const daySlots = (timetable as any[]).filter(s=>s.day_of_week===dayOfWeek).sort((a:any,b:any)=>a.period_number-b.period_number);
  const periods = daySlots.length>0?daySlots.map((s:any)=>s.period_number):[1,2,3,4,5,6];

  const getStatus=(p:number,sid:string)=>statusMap[p]?.[sid]||"حاضر";
  const setStatus=(p:number,sid:string,st:string)=>setStatusMap(prev=>({...prev,[p]:{...(prev[p]||{}),[sid]:st}}));
  const setAll=(p:number,st:string)=>{ const m:Record<string,string>={}; (students as any[]).forEach((s:any)=>{m[s.id]=st;}); setStatusMap(prev=>({...prev,[p]:m})); };

  const saveMut = useMutation({
    mutationFn:async()=>{
      const recs:any[]=[];
      periods.forEach(period=>{
        const slot=daySlots.find((s:any)=>s.period_number===period);
        (students as any[]).forEach((s:any)=>{ recs.push({student_id:s.id,class_id:cls,date,period_number:period,subject_id:slot?.subject_id||null,status:getStatus(period,s.id),recorded_by:user?.id}); });
      });
      await upsertAttendanceV2(recs);
    },
    onSuccess:()=>{ qc.invalidateQueries({queryKey:["att-class-day",cls,date]}); toast.success("✅ تم حفظ الحضور"); },
    onError:()=>toast.error("خطأ في الحفظ")
  });

  const attByDate:Record<string,any>={};
  (rangeAtt as any[]).forEach((a:any)=>{
    if(!attByDate[a.date]) attByDate[a.date]={date:a.date.slice(5),present:0,absent:0,late:0};
    if(a.status==="حاضر") attByDate[a.date].present++;
    else if(a.status==="غائب") attByDate[a.date].absent++;
    else attByDate[a.date].late++;
  });
  const chartData=Object.values(attByDate).sort((a:any,b:any)=>a.date.localeCompare(b.date)).slice(-14);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="font-heading text-2xl font-bold">الحضور والغياب</h1><p className="text-muted-foreground text-sm mt-1">تسجيل يومي حسب الحصة</p></div>
        <div className="flex rounded-lg border overflow-hidden">
          {(["register","stats"] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)} className={`px-4 py-2 text-sm font-heading ${tab===t?"bg-primary text-primary-foreground":"text-muted-foreground hover:bg-accent"}`}>
              {t==="register"?"تسجيل الحضور":"الإحصائيات"}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-card rounded-lg border p-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="text-xs text-muted-foreground block mb-1.5">الفصل</label>
          <select value={cls} onChange={e=>{setCls(e.target.value);setStatusMap({});setActivePeriod(1);}} className="px-4 py-2.5 bg-background border rounded-lg text-sm min-w-44">
            <option value="">اختر فصلاً</option>
            {(classes as any[]).map((c:any)=><option key={c.id} value={c.id}>{c.name} — {c.grade}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1.5">التاريخ</label>
          <div className="flex items-center gap-1">
            <button onClick={()=>{setDate(addDays(date,-1));setStatusMap({});}} className="p-2 rounded border hover:bg-accent"><ChevronRight className="w-4 h-4"/></button>
            <input type="date" value={date} onChange={e=>{setDate(e.target.value);setStatusMap({});}} max={today} className="px-3 py-2 bg-background border rounded-lg text-sm"/>
            <button onClick={()=>{setDate(addDays(date,1));setStatusMap({});}} disabled={date>=today} className="p-2 rounded border hover:bg-accent disabled:opacity-30"><ChevronLeft className="w-4 h-4"/></button>
          </div>
        </div>
        {cls&&<div className="text-xs bg-accent/50 px-3 py-2 rounded-lg"><span className="font-semibold">{DAYS_AR[dayOfWeek]}</span> • {daySlots.length>0?`${daySlots.length} حصص`:"بدون جدول"}</div>}
      </div>

      {tab==="register"&&cls&&students.length>0&&(
        <>
          <div className="bg-card rounded-lg border overflow-hidden">
            <div className="flex border-b overflow-x-auto bg-accent/10">
              {periods.map(period=>{
                const slot=daySlots.find((s:any)=>s.period_number===period);
                const p_=(students as any[]).filter((s:any)=>getStatus(period,s.id)==="حاضر").length;
                const a_=(students as any[]).filter((s:any)=>getStatus(period,s.id)==="غائب").length;
                const l_=(students as any[]).filter((s:any)=>getStatus(period,s.id)==="متأخر").length;
                return (
                  <button key={period} onClick={()=>setActivePeriod(period)}
                    className={`flex-shrink-0 px-4 py-3 border-b-2 text-sm transition-colors ${activePeriod===period?"border-primary text-primary bg-primary/5":"border-transparent text-muted-foreground hover:bg-accent"}`}>
                    <div className="font-heading font-semibold">الحصة {period}</div>
                    {slot?.subjects&&<div className="text-[11px] opacity-70 mt-0.5 max-w-24 truncate">{slot.subjects.name}</div>}
                    <div className="flex gap-1 mt-1 justify-center">
                      <span className="text-[10px] bg-success/20 text-success px-1 rounded">{p_}✓</span>
                      {a_>0&&<span className="text-[10px] bg-destructive/20 text-destructive px-1 rounded">{a_}✗</span>}
                      {l_>0&&<span className="text-[10px] bg-warning/20 text-warning px-1 rounded">{l_}~</span>}
                    </div>
                  </button>
                );
              })}
            </div>
            {(()=>{
              const slot=daySlots.find((s:any)=>s.period_number===activePeriod);
              const p_=(students as any[]).filter((s:any)=>getStatus(activePeriod,s.id)==="حاضر").length;
              const a_=(students as any[]).filter((s:any)=>getStatus(activePeriod,s.id)==="غائب").length;
              const l_=(students as any[]).filter((s:any)=>getStatus(activePeriod,s.id)==="متأخر").length;
              const pct=students.length>0?Math.round(p_/students.length*100):0;
              return (
                <div className="p-3 border-b bg-accent/20 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="font-heading font-bold text-sm">الحصة {activePeriod}{slot?.subjects&&<span className="text-muted-foreground font-normal mr-2">— {slot.subjects.name}</span>}</p>
                    {slot?.start_time&&<span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3"/>{slot.start_time}–{slot.end_time}</span>}
                    <div className="flex gap-1.5 text-xs">
                      <span className="badge-success">{p_} ✓</span>
                      {a_>0&&<span className="badge-destructive">{a_} ✗</span>}
                      {l_>0&&<span className="badge-warning">{l_} ~</span>}
                      <span className="text-muted-foreground">| {pct}%</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {["حاضر","غائب","متأخر"].map(st=>(
                      <button key={st} onClick={()=>setAll(activePeriod,st)}
                        className={`px-2.5 py-1.5 text-xs rounded-lg border font-heading ${st==="حاضر"?"hover:bg-success/10 hover:text-success":st==="غائب"?"hover:bg-destructive/10 hover:text-destructive":"hover:bg-warning/10 hover:text-warning"}`}>
                        الكل {st}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
            <table className="w-full text-sm">
              <thead className="bg-accent/10"><tr>
                <th className="text-right px-4 py-2.5 text-xs text-muted-foreground font-heading w-10">#</th>
                <th className="text-right px-4 py-2.5 text-xs text-muted-foreground font-heading">الطالب</th>
                <th className="text-right px-4 py-2.5 text-xs text-muted-foreground font-heading">الحالة</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {(students as any[]).map((s:any,i:number)=>{
                  const status=getStatus(activePeriod,s.id);
                  return (
                    <tr key={s.id} className="hover:bg-accent/20">
                      <td className="px-4 py-2.5 text-muted-foreground">{i+1}</td>
                      <td className="px-4 py-2.5"><div className="flex items-center gap-2"><div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${status==="حاضر"?"bg-success/10 text-success":status==="غائب"?"bg-destructive/10 text-destructive":"bg-warning/10 text-warning"}`}>{s.full_name[0]}</div><span className="font-medium">{s.full_name}</span></div></td>
                      <td className="px-4 py-2.5"><div className="flex gap-1.5">{["حاضر","غائب","متأخر"].map(st=>(
                        <button key={st} onClick={()=>setStatus(activePeriod,s.id,st)}
                          className={`px-3 py-1.5 text-xs rounded-lg font-heading transition-all ${status===st?STATUS_COLORS[st]+" shadow-sm":"bg-accent/60 text-muted-foreground hover:bg-accent"}`}>{st}</button>
                      ))}</div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <button onClick={()=>saveMut.mutate()} disabled={saveMut.isPending}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-heading font-medium hover:bg-primary/90 disabled:opacity-70">
              <Save className="w-4 h-4"/>{saveMut.isPending?"جارٍ الحفظ...":"حفظ الحضور لجميع الحصص"}
            </button>
          </div>
        </>
      )}
      {tab==="register"&&!cls&&<div className="text-center py-12 text-muted-foreground bg-card rounded-lg border"><Calendar className="w-12 h-12 mx-auto mb-3 opacity-20"/><p>اختر فصلاً لتسجيل الحضور</p></div>}
      {tab==="register"&&cls&&students.length===0&&<div className="text-center py-12 text-muted-foreground bg-card rounded-lg border"><Users className="w-12 h-12 mx-auto mb-3 opacity-20"/><p>لا يوجد طلاب</p></div>}

      {tab==="stats"&&(
        <div className="bg-card rounded-lg border p-5">
          <h2 className="font-heading font-semibold mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary"/>إحصائيات الحضور (آخر 14 يوم)</h2>
          {chartData.length>0?(
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3"/>
                <XAxis dataKey="date" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/>
                <Tooltip/><Legend/>
                <Bar dataKey="present" name="حاضر" fill="hsl(var(--success))" stackId="a" radius={[3,3,0,0]}/>
                <Bar dataKey="late" name="متأخر" fill="hsl(var(--warning))" stackId="a"/>
                <Bar dataKey="absent" name="غائب" fill="hsl(var(--destructive))" stackId="a" radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          ):<div className="h-48 flex items-center justify-center text-muted-foreground text-sm">لا توجد بيانات</div>}
        </div>
      )}
    </div>
  );
}

// ─── TEACHER ─────────────────────────────────────
function TeacherAttendanceView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [activeSlot, setActiveSlot] = useState<any>(null);
  const [statusMap, setStatusMap] = useState<Record<string,string>>({});
  const [tab, setTab] = useState<"register"|"stats">("register");

  const curDay = new Date(date).getDay();

  const { data: mySlots = [] } = useQuery({ queryKey:["teacher-day-slots",user?.id,curDay], queryFn:()=>getTeacherDaySlots(user!.id,curDay), enabled:!!user });
  const { data: students = [] } = useQuery({ queryKey:["students-class",activeSlot?.class_id], queryFn:()=>getStudentsByClass(activeSlot!.class_id), enabled:!!activeSlot?.class_id });

  // Fix: use useEffect instead of onSuccess
  const { data: slotAtt = [] } = useQuery({
    queryKey:["att-slot",activeSlot?.class_id,date,activeSlot?.period_number],
    queryFn:()=>getAttendanceForClassDay(activeSlot!.class_id,date),
    enabled:!!activeSlot
  });
  useEffect(()=>{
    if(!activeSlot||!students.length) return;
    const m:Record<string,string>={};
    (students as any[]).forEach((s:any)=>{ m[s.id]="حاضر"; });
    (slotAtt as any[]).filter((r:any)=>r.period_number===activeSlot.period_number).forEach((r:any)=>{ m[r.student_id]=r.status; });
    setStatusMap(m);
  },[slotAtt, students, activeSlot]);

  // Teacher stats: all attendance recorded by this teacher
  const { data: rangeAtt = [] } = useQuery({ queryKey:["teacher-att-range",user?.id], queryFn:()=>getAllAttendanceRange(addDays(today,-30),today), enabled:tab==="stats"&&!!user });

  const saveMut = useMutation({
    mutationFn:()=>upsertAttendanceV2((students as any[]).map((s:any)=>({
      student_id:s.id, class_id:activeSlot!.class_id, date,
      period_number:activeSlot!.period_number, subject_id:activeSlot!.subject_id||null,
      status:statusMap[s.id]||"حاضر", recorded_by:user?.id
    }))),
    onSuccess:()=>{ qc.invalidateQueries({queryKey:["att-slot"]}); toast.success("✅ تم تسجيل حضور الحصة"); },
    onError:()=>toast.error("خطأ في الحفظ")
  });

  const present=Object.values(statusMap).filter(s=>s==="حاضر").length;
  const pct=students.length>0?Math.round(present/students.length*100):0;

  // Stats processing
  const attByDate:Record<string,any>={};
  (rangeAtt as any[]).forEach((a:any)=>{
    if(!attByDate[a.date]) attByDate[a.date]={date:a.date.slice(5),present:0,absent:0,late:0};
    if(a.status==="حاضر") attByDate[a.date].present++;
    else if(a.status==="غائب") attByDate[a.date].absent++;
    else attByDate[a.date].late++;
  });
  const chartData=Object.values(attByDate).sort((a:any,b:any)=>a.date.localeCompare(b.date)).slice(-14);
  const total=(rangeAtt as any[]).length;
  const totalPresent=(rangeAtt as any[]).filter((a:any)=>a.status==="حاضر").length;
  const totalAbsent=(rangeAtt as any[]).filter((a:any)=>a.status==="غائب").length;
  const totalLate=(rangeAtt as any[]).filter((a:any)=>a.status==="متأخر").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="font-heading text-2xl font-bold">تسجيل الحضور</h1><p className="text-muted-foreground text-sm mt-1">حصصي — حسب الجدول</p></div>
        <div className="flex rounded-lg border overflow-hidden">
          {(["register","stats"] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)} className={`px-4 py-2 text-sm font-heading ${tab===t?"bg-primary text-primary-foreground":"text-muted-foreground hover:bg-accent"}`}>
              {t==="register"?"تسجيل":"إحصائياتي"}
            </button>
          ))}
        </div>
      </div>

      {tab==="register"&&(
        <>
          <div className="bg-card rounded-lg border p-4 flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">التاريخ</label>
              <div className="flex items-center gap-1">
                <button onClick={()=>{setDate(addDays(date,-1));setActiveSlot(null);}} className="p-2 rounded border hover:bg-accent"><ChevronRight className="w-4 h-4"/></button>
                <input type="date" value={date} onChange={e=>{setDate(e.target.value);setActiveSlot(null);}} max={today} className="px-3 py-2 bg-background border rounded-lg text-sm"/>
                <button onClick={()=>{setDate(addDays(date,1));setActiveSlot(null);}} disabled={date>=today} className="p-2 rounded border hover:bg-accent disabled:opacity-30"><ChevronLeft className="w-4 h-4"/></button>
              </div>
            </div>
            <span className="text-sm font-heading font-medium bg-accent/50 px-3 py-2 rounded-lg">{DAYS_AR[curDay]}</span>
          </div>

          {(mySlots as any[]).length===0
            ?<div className="text-center py-12 text-muted-foreground bg-card rounded-lg border"><Calendar className="w-12 h-12 mx-auto mb-3 opacity-20"/><p>لا توجد حصص يوم {DAYS_AR[curDay]}</p></div>
            :<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(mySlots as any[]).map((slot:any)=>(
                <button key={slot.id} onClick={()=>{ setActiveSlot(slot); setStatusMap({}); }}
                  className={`bg-card rounded-lg border p-4 text-right transition-all hover:shadow-md ${activeSlot?.id===slot.id?"border-primary ring-1 ring-primary":""}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-heading font-bold flex items-center justify-center">{slot.period_number}</span>
                    <span className="text-xs text-muted-foreground">{slot.start_time}–{slot.end_time}</span>
                  </div>
                  <p className="font-heading font-bold text-sm">{slot.subjects?.name||"نشاط"}</p>
                  <p className="text-xs text-muted-foreground">{slot.classes?.name} • {slot.classes?.grade}</p>
                </button>
              ))}
            </div>
          }

          {activeSlot&&students.length>0&&(
            <div className="bg-card rounded-lg border overflow-hidden">
              <div className="p-4 border-b bg-primary/5 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="font-heading font-bold">الحصة {activeSlot.period_number} — {activeSlot.subjects?.name}</h3>
                  <p className="text-xs text-muted-foreground">{activeSlot.classes?.name} • {students.length} طالب • <span className="font-bold text-primary">{pct}%</span> حضور</p>
                </div>
                <div className="flex gap-1">
                  {["حاضر","غائب","متأخر"].map(st=>(
                    <button key={st} onClick={()=>{const m:Record<string,string>={};(students as any[]).forEach((s:any)=>{m[s.id]=st;});setStatusMap(m);}}
                      className={`px-2.5 py-1.5 text-xs rounded-lg border font-heading ${st==="حاضر"?"hover:bg-success/10 hover:text-success":st==="غائب"?"hover:bg-destructive/10 hover:text-destructive":"hover:bg-warning/10 hover:text-warning"}`}>الكل {st}</button>
                  ))}
                </div>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-accent/20"><tr>
                  <th className="text-right px-4 py-2.5 text-xs text-muted-foreground font-heading">#</th>
                  <th className="text-right px-4 py-2.5 text-xs text-muted-foreground font-heading">الطالب</th>
                  <th className="text-right px-4 py-2.5 text-xs text-muted-foreground font-heading">الحالة</th>
                </tr></thead>
                <tbody className="divide-y">
                  {(students as any[]).map((s:any,i:number)=>{
                    const status=statusMap[s.id]||"حاضر";
                    return (
                      <tr key={s.id} className="hover:bg-accent/20">
                        <td className="px-4 py-2.5 text-muted-foreground">{i+1}</td>
                        <td className="px-4 py-2.5"><div className="flex items-center gap-2"><div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${status==="حاضر"?"bg-success/10 text-success":status==="غائب"?"bg-destructive/10 text-destructive":"bg-warning/10 text-warning"}`}>{s.full_name[0]}</div><span className="font-medium">{s.full_name}</span></div></td>
                        <td className="px-4 py-2.5"><div className="flex gap-1.5">
                          {["حاضر","غائب","متأخر"].map(st=>(
                            <button key={st} onClick={()=>setStatusMap(p=>({...p,[s.id]:st}))}
                              className={`px-3 py-1.5 text-xs rounded-lg font-heading transition-all ${status===st?STATUS_COLORS[st]+" shadow-sm":"bg-accent/60 text-muted-foreground hover:bg-accent"}`}>{st}</button>
                          ))}
                        </div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="p-4 border-t flex justify-end">
                <button onClick={()=>saveMut.mutate()} disabled={saveMut.isPending}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-heading hover:bg-primary/90 disabled:opacity-70">
                  <Save className="w-4 h-4"/>{saveMut.isPending?"جارٍ الحفظ...":"حفظ حضور الحصة"}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {tab==="stats"&&(
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {[["الإجمالي",total,"text-primary"],["حاضر",totalPresent,"text-success"],["غائب",totalAbsent,"text-destructive"],["متأخر",totalLate,"text-warning"]].map(([l,v,c])=>(
              <div key={l as string} className="bg-card rounded-lg border p-4 text-center">
                <p className={`text-2xl font-bold font-heading ${c}`}>{v}</p>
                <p className="text-xs text-muted-foreground mt-1">{l}</p>
              </div>
            ))}
          </div>
          <div className="bg-card rounded-lg border p-5">
            <h2 className="font-heading font-semibold mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary"/>غياب الطلاب (آخر 30 يوم)</h2>
            {chartData.length>0?(
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3"/>
                  <XAxis dataKey="date" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/>
                  <Tooltip/><Legend/>
                  <Bar dataKey="present" name="حاضر" fill="hsl(var(--success))" stackId="a" radius={[3,3,0,0]}/>
                  <Bar dataKey="late" name="متأخر" fill="hsl(var(--warning))" stackId="a"/>
                  <Bar dataKey="absent" name="غائب" fill="hsl(var(--destructive))" stackId="a" radius={[3,3,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            ):<div className="h-40 flex items-center justify-center text-muted-foreground">لا توجد بيانات</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Attendance() {
  const { user } = useAuth();
  if (user?.role==="teacher") return <TeacherAttendanceView/>;
  return <AdminAttendance/>;
}
