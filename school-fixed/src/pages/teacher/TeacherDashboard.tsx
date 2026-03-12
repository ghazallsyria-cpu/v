import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getTeacherClasses, getTeacherSubjects, getTeacherTimetableSlots, getStudents } from "@/lib/api";
import { Calendar, Users, BookOpen, Clock, Video, ExternalLink, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";

const DAYS_AR = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس"];
const DAY_SHORT = ["أح","اث","ثل","أر","خم"];

export default function TeacherDashboard() {
  const { user } = useAuth();
  const today = new Date().getDay(); // 0=Sun … 6=Sat
  const todayIdx = [0,1,2,3,4].includes(today) ? today : 0;

  const { data: tClasses = [] } = useQuery({ queryKey:["teacher-classes",user?.id], queryFn:()=>getTeacherClasses(user!.id), enabled:!!user });
  const { data: tSubjects = [] } = useQuery({ queryKey:["teacher-subjects",user?.id], queryFn:()=>getTeacherSubjects(user!.id), enabled:!!user });
  const { data: allSlots = [] } = useQuery({ queryKey:["teacher-timetable",user?.id], queryFn:()=>getTeacherTimetableSlots(user!.id), enabled:!!user });
  const { data: allStudents = [] } = useQuery({ queryKey:["students"], queryFn: getStudents });

  const classIds = new Set((tClasses as any[]).map((tc:any)=>tc.class_id));
  const myStudents = (allStudents as any[]).filter(s=>classIds.has(s.class_id));
  const todaySlots = (allSlots as any[]).filter(s=>s.day_of_week===todayIdx).sort((a:any,b:any)=>a.period_number-b.period_number);

  // Build weekly grid
  const weekGrid: Record<number, any[]> = {0:[],1:[],2:[],3:[],4:[]};
  (allSlots as any[]).forEach((s:any)=>{
    if(weekGrid[s.day_of_week]!==undefined) weekGrid[s.day_of_week].push(s);
  });
  Object.values(weekGrid).forEach(arr=>arr.sort((a:any,b:any)=>a.period_number-b.period_number));

  const allPeriods = [...new Set((allSlots as any[]).map((s:any)=>s.period_number))].sort((a,b)=>a-b);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-l from-primary/5 to-transparent border rounded-xl p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center font-heading font-bold text-primary text-xl">{user?.full_name?.[0]}</div>
        <div>
          <h1 className="font-heading text-xl font-bold">مرحباً، {user?.full_name}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{DAYS_AR[todayIdx]} — {tClasses.length} فصل • {tSubjects.length > 0 ? (tSubjects as any[])[0].subjects?.name : ""}</p>
          {user?.zoom_link && (
            <a href={user.zoom_link} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-2 text-xs text-info hover:underline">
              <Video className="w-3.5 h-3.5"/>رابط Zoom الخاص بي
              <ExternalLink className="w-3 h-3"/>
            </a>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {label:"فصولي",val:tClasses.length,icon:BookOpen,color:"text-primary"},
          {label:"طلابي",val:myStudents.length,icon:Users,color:"text-info"},
          {label:"حصصي اليوم",val:todaySlots.length,icon:Calendar,color:"text-success"},
          {label:"حصص الأسبوع",val:(allSlots as any[]).length,icon:Clock,color:"text-warning"},
        ].map(({label,val,icon:Icon,color})=>(
          <div key={label} className="bg-card rounded-xl border p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-accent flex items-center justify-center ${color}`}><Icon className="w-5 h-5"/></div>
            <div><p className={`text-2xl font-bold font-heading ${color}`}>{val}</p><p className="text-xs text-muted-foreground">{label}</p></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Today's schedule */}
        <div className="lg:col-span-1 bg-card rounded-xl border overflow-hidden">
          <div className="p-4 border-b bg-accent/20 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary"/>
            <h2 className="font-heading font-semibold text-sm">حصصي اليوم — {DAYS_AR[todayIdx]}</h2>
          </div>
          {todaySlots.length===0
            ?<div className="text-center py-10 text-muted-foreground text-sm"><Clock className="w-10 h-10 mx-auto mb-2 opacity-20"/>لا توجد حصص اليوم</div>
            :<div className="divide-y">
              {todaySlots.map((slot:any)=>(
                <div key={slot.id} className="p-4 flex items-center gap-3 hover:bg-accent/20">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center font-heading shrink-0">{slot.period_number}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{slot.subjects?.name||"نشاط"}</p>
                    <p className="text-xs text-muted-foreground">{slot.classes?.name} • {slot.start_time?.slice(0,5)}–{slot.end_time?.slice(0,5)}</p>
                  </div>
                  {user?.zoom_link && (
                    <a href={user.zoom_link} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-info/10 text-info hover:bg-info/20" title="ابدأ الحصة على Zoom">
                      <Video className="w-4 h-4"/>
                    </a>
                  )}
                </div>
              ))}
            </div>
          }
          <div className="p-3 border-t">
            <Link to="/attendance" className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-primary hover:bg-primary/5 rounded-lg transition-colors font-heading">
              <Users className="w-3.5 h-3.5"/>تسجيل الحضور
            </Link>
          </div>
        </div>

        {/* Weekly timetable */}
        <div className="lg:col-span-2 bg-card rounded-xl border overflow-hidden">
          <div className="p-4 border-b bg-accent/20 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary"/>
            <h2 className="font-heading font-semibold text-sm">جدولي الأسبوعي</h2>
            {!user?.zoom_link&&(
              <Link to="/settings" className="mr-auto text-xs text-info hover:underline flex items-center gap-1">
                <Video className="w-3 h-3"/>أضف رابط Zoom
              </Link>
            )}
          </div>
          {allSlots.length===0
            ?<div className="text-center py-10 text-muted-foreground text-sm"><Calendar className="w-10 h-10 mx-auto mb-2 opacity-20"/><p>لم يُحدد جدولك بعد</p><p className="text-xs mt-1">تواصل مع إدارة المدرسة</p></div>
            :<div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-accent/30">
                    <th className="text-right px-3 py-2.5 font-heading text-muted-foreground font-semibold border-l w-16">الحصة</th>
                    {[0,1,2,3,4].map(d=>(
                      <th key={d} className={`text-center px-2 py-2.5 font-heading font-semibold ${d===todayIdx?"text-primary bg-primary/10":"text-muted-foreground"}`}>
                        {DAY_SHORT[d]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {allPeriods.length===0?[1,2,3,4,5,6,7].map(p=>(
                    <tr key={p}><td className="px-3 py-2 text-muted-foreground border-l text-center">{p}</td>{[0,1,2,3,4].map(d=><td key={d} className="px-2 py-2 text-center">—</td>)}</tr>
                  )):allPeriods.map(period=>{
                    const firstSlot = (allSlots as any[]).find((s:any)=>s.period_number===period);
                    return (
                      <tr key={period} className="hover:bg-accent/10">
                        <td className="px-3 py-2.5 text-muted-foreground border-l text-center font-mono">
                          <div className="font-semibold">{period}</div>
                          <div className="text-[10px]">{firstSlot?.start_time?.slice(0,5)}</div>
                        </td>
                        {[0,1,2,3,4].map(day=>{
                          const slot = weekGrid[day]?.find((s:any)=>s.period_number===period);
                          return (
                            <td key={day} className={`px-1 py-2 text-center ${day===todayIdx?"bg-primary/5":""}`}>
                              {slot?(
                                <div className="bg-primary/10 rounded px-1 py-1">
                                  <p className="font-semibold text-primary text-[11px] leading-tight">{slot.subjects?.name}</p>
                                  <p className="text-muted-foreground text-[10px]">{slot.classes?.name}</p>
                                  {user?.zoom_link&&(
                                    <a href={user.zoom_link} target="_blank" rel="noopener noreferrer" className="text-info text-[10px] hover:underline flex items-center justify-center gap-0.5 mt-0.5">
                                      <Video className="w-2.5 h-2.5"/>Zoom
                                    </a>
                                  )}
                                </div>
                              ):<span className="text-muted-foreground opacity-30">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          }
        </div>
      </div>
    </div>
  );
}
