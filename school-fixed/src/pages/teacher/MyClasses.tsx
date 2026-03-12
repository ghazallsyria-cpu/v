import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getTeacherClasses, getTeacherSubjects, getStudentsByClass } from "@/lib/api";
import { useState } from "react";
import { Users, BookOpen, ChevronRight, X } from "lucide-react";

export default function MyClasses() {
  const { user } = useAuth();
  const [selClass, setSelClass] = useState<any>(null);

  const { data: myClasses = [] } = useQuery({ queryKey:["teacher-classes",user?.id], queryFn:()=>getTeacherClasses(user!.id), enabled:!!user });
  const { data: mySubjects = [] } = useQuery({ queryKey:["teacher-subjects",user?.id], queryFn:()=>getTeacherSubjects(user!.id), enabled:!!user });
  const { data: classStudents = [] } = useQuery({ queryKey:["students-class",selClass?.class_id], queryFn:()=>getStudentsByClass(selClass!.class_id), enabled:!!selClass });

  if (selClass) return (
    <div className="space-y-4">
      <div className="bg-card rounded-lg border p-4 flex items-center gap-3">
        <button onClick={()=>setSelClass(null)} className="p-2 rounded hover:bg-accent text-muted-foreground"><X className="w-4 h-4"/></button>
        <div>
          <h2 className="font-heading font-bold">{selClass.classes?.name}</h2>
          <p className="text-xs text-muted-foreground">{selClass.classes?.grade} • {classStudents.length} طالب</p>
        </div>
      </div>
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="p-3 border-b bg-accent/20"><p className="text-sm font-heading font-semibold">طلاب الفصل</p></div>
        <table className="data-table">
          <thead><tr><th>#</th><th>الطالب</th><th>الرقم المدني</th></tr></thead>
          <tbody>
            {(classStudents as any[]).map((s:any,i:number)=>(
              <tr key={s.id}><td className="text-muted-foreground">{i+1}</td><td><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{s.full_name[0]}</div><span className="font-medium">{s.full_name}</span></div></td><td className="text-muted-foreground font-mono text-xs">{s.national_id}</td></tr>
            ))}
            {classStudents.length===0&&<tr><td colSpan={3} className="text-center py-6 text-muted-foreground">لا يوجد طلاب</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div><h1 className="font-heading text-2xl font-bold">فصولي ومواد</h1><p className="text-muted-foreground text-sm">{myClasses.length} فصل • {mySubjects.length} مادة</p></div>
      {myClasses.length===0&&mySubjects.length===0&&(
        <div className="text-center py-16 bg-card rounded-xl border text-muted-foreground"><Users className="w-16 h-16 mx-auto mb-4 opacity-20"/><p className="font-heading">لم تُخصص لك فصول أو مواد بعد</p><p className="text-sm mt-1">تواصل مع إدارة المدرسة</p></div>
      )}
      {myClasses.length>0&&(
        <div>
          <h2 className="font-heading font-semibold mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-primary"/>فصولي الدراسية</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(myClasses as any[]).map((tc:any)=>(
              <button key={tc.id} onClick={()=>setSelClass(tc)} className="bg-card rounded-xl border p-5 text-right hover:shadow-md transition-all hover:border-primary/30 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center font-heading font-bold text-primary text-lg">{tc.classes?.name?.[0]}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-bold">{tc.classes?.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{tc.classes?.grade} • {tc.classes?.section}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0"/>
              </button>
            ))}
          </div>
        </div>
      )}
      {mySubjects.length>0&&(
        <div>
          <h2 className="font-heading font-semibold mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4 text-info"/>موادي الدراسية</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {(mySubjects as any[]).map((ts:any)=>(
              <div key={ts.id} className="bg-card rounded-xl border p-4 text-center hover:border-info/30 transition-colors">
                <div className="w-10 h-10 rounded-full bg-info/10 flex items-center justify-center mx-auto mb-2 font-heading font-bold text-info text-sm">{ts.subjects?.code||"—"}</div>
                <p className="font-heading font-semibold text-sm">{ts.subjects?.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
