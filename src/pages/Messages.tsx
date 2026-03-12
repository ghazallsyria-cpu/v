import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getMessagesBetween, sendMessage, getTeachers, getStudents, getStudentsByClass, getTeacherClasses, getParents, getParentChildren, createNotification } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Search, Users, BookOpen, Shield, UserCheck, MessageCircle } from "lucide-react";

type SectionKey = "students"|"teachers"|"admin"|"parents";

async function getContactsForRole(user: any, allStudents: any[], allTeachers: any[], allParents: any[], teacherClassIds: Set<string>) {
  if (user.role === "admin") {
    return {
      students: allStudents,
      teachers: allTeachers.filter((t:any)=>t.role==="teacher"),
      admin: allTeachers.filter((t:any)=>t.role==="admin"&&t.id!==user.id),
      parents: allParents,
    };
  }
  if (user.role === "teacher") {
    const myStudents = allStudents.filter((s:any)=>teacherClassIds.has(s.class_id));
    // Parents of my students
    const myStudentIds = new Set(myStudents.map((s:any)=>s.id));
    const myParents = allParents.filter((p:any)=>
      (p.parent_students||[]).some((ps:any)=>myStudentIds.has(ps.student_id))
    );
    return {
      students: myStudents,
      teachers: allTeachers.filter((t:any)=>t.role==="teacher"&&t.id!==user.id),
      admin: allTeachers.filter((t:any)=>t.role==="admin"),
      parents: myParents,
    };
  }
  if (user.role === "student") {
    const classmates = allStudents.filter((s:any)=>s.class_id===user.class_id&&s.id!==user.id);
    const myTeachers = allTeachers.filter((t:any)=>t.role==="teacher");
    return { students: classmates, teachers: myTeachers, admin: [], parents: [] };
  }
  // Parent
  return {
    students: [],
    teachers: allTeachers.filter((t:any)=>t.role==="teacher"),
    admin: allTeachers.filter((t:any)=>t.role==="admin"),
    parents: [],
  };
}

const SECTIONS: {key:SectionKey;label:string;icon:any}[] = [
  {key:"students",label:"الطلاب",icon:Users},
  {key:"teachers",label:"المعلمون",icon:BookOpen},
  {key:"admin",label:"الإدارة",icon:Shield},
  {key:"parents",label:"أولياء الأمور",icon:UserCheck},
];

export default function Messages() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selUser, setSelUser] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [section, setSection] = useState<SectionKey>("students");
  const [search, setSearch] = useState("");
  const msgEndRef = useRef<HTMLDivElement>(null);

  const { data: allTeachers = [] } = useQuery({ queryKey:["teachers"], queryFn: getTeachers });
  const { data: allStudents = [] } = useQuery({ queryKey:["students"], queryFn: getStudents });
  const { data: allParents = [] } = useQuery({ queryKey:["parents-with-children"], queryFn: async () => {
    const { data } = await supabase.from("parents").select("*, parent_students(student_id)");
    return data || [];
  }});
  const { data: tClasses = [] } = useQuery({ queryKey:["teacher-classes",user?.id], queryFn:()=>getTeacherClasses(user!.id), enabled:!!user&&user.role==="teacher" });
  const teacherClassIds = new Set((tClasses as any[]).map((tc:any)=>tc.class_id));

  const contacts = (() => {
    if (!user) return { students:[], teachers:[], admin:[], parents:[] };
    const aS = allStudents as any[], aT = allTeachers as any[], aP = allParents as any[];
    if (user.role === "admin") return {
      students: aS,
      teachers: aT.filter((t:any)=>t.role==="teacher"),
      admin: aT.filter((t:any)=>t.role==="admin"&&t.id!==user.id),
      parents: aP,
    };
    if (user.role === "teacher") {
      const myStudents = aS.filter((s:any)=>teacherClassIds.has(s.class_id));
      const myStudentIds = new Set(myStudents.map((s:any)=>s.id));
      const myParents = aP.filter((p:any)=>(p.parent_students||[]).some((ps:any)=>myStudentIds.has(ps.student_id)));
      return {
        students: myStudents,
        teachers: aT.filter((t:any)=>t.role==="teacher"&&t.id!==user.id),
        admin: aT.filter((t:any)=>t.role==="admin"),
        parents: myParents,
      };
    }
    if (user.role === "student") return {
      students: aS.filter((s:any)=>s.class_id===user.class_id&&s.id!==user.id),
      teachers: aT.filter((t:any)=>t.role==="teacher"),
      admin: [] as any[],
      parents: [] as any[],
    };
    // parent
    return {
      students: [] as any[],
      teachers: aT.filter((t:any)=>t.role==="teacher"),
      admin: aT.filter((t:any)=>t.role==="admin"),
      parents: [] as any[],
    };
  })();

  const visibleSections = SECTIONS.filter(s => {
    if (s.key === "admin" && user?.role === "student") return false;
    if (s.key === "parents" && (user?.role === "student" || user?.role === "parent")) return false;
    return true;
  });

  const currentList = ((contacts[section] || []) as any[])
    .filter((c:any)=>!search||c.full_name?.includes(search)||(c.national_id||"").includes(search));

  const { data: messages = [] } = useQuery({
    queryKey:["messages",user?.id,selUser?.id],
    queryFn:()=>getMessagesBetween(user!.id, selUser!.id),
    enabled:!!selUser&&!!user,
    refetchInterval: 5000, // poll every 5s for new messages
  });

  useEffect(()=>{
    msgEndRef.current?.scrollIntoView({behavior:"smooth"});
  },[messages]);

  const sendMut = useMutation({
    mutationFn:()=>sendMessage({sender_id:user!.id, receiver_id:selUser!.id, content:message}),
    onSuccess:()=>{ qc.invalidateQueries({queryKey:["messages",user?.id,selUser?.id]}); createNotification({user_id:selUser!.id, title:"رسالة جديدة", body:`أرسل لك ${user?.full_name || "شخص"} رسالة`, type:"message"}).catch(()=>{}); setMessage(""); },
    onError:()=>toast.error("خطأ في الإرسال")
  });

  const handleKey = (e:React.KeyboardEvent) => {
    if(e.key==="Enter"&&!e.shiftKey&&message.trim()){e.preventDefault();sendMut.mutate();}
  };

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-bold">الرسائل</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{height:"calc(100vh - 200px)",minHeight:"480px"}}>
        {/* Sidebar */}
        <div className="bg-card rounded-xl border flex flex-col overflow-hidden">
          {/* Section tabs */}
          <div className="grid border-b" style={{gridTemplateColumns:`repeat(${visibleSections.length},1fr)`}}>
            {visibleSections.map(({key,label,icon:Icon})=>(
              <button key={key} onClick={()=>{setSection(key);setSelUser(null);setSearch("");}}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-heading border-b-2 transition-colors ${section===key?"border-primary text-primary bg-primary/5":"border-transparent text-muted-foreground hover:bg-accent"}`}>
                <Icon className="w-3.5 h-3.5"/>{label}
                <span className="text-[10px] opacity-70">{(contacts[key]||[]).length}</span>
              </button>
            ))}
          </div>
          {/* Search */}
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="بحث..."
                className="w-full pr-8 pl-3 py-1.5 bg-background border rounded-lg text-xs"/>
            </div>
          </div>
          {/* Contact list */}
          <div className="flex-1 overflow-y-auto divide-y">
            {currentList.length===0&&<div className="text-center py-8 text-sm text-muted-foreground">لا يوجد جهات</div>}
            {currentList.map((c:any)=>(
              <button key={c.id} onClick={()=>setSelUser(c)}
                className={`w-full flex items-center gap-3 p-3 text-right hover:bg-accent transition-colors ${selUser?.id===c.id?"bg-primary/5 border-r-2 border-primary":""}`}>
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-heading font-bold text-primary text-sm shrink-0">
                  {c.full_name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{c.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.classes?.name||c.national_id||""}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className="lg:col-span-2 bg-card rounded-xl border flex flex-col overflow-hidden">
          {selUser ? (
            <>
              <div className="p-4 border-b flex items-center gap-3 bg-accent/10">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-heading font-bold text-primary">{selUser.full_name?.[0]}</div>
                <div><p className="font-heading font-semibold text-sm">{selUser.full_name}</p><p className="text-xs text-muted-foreground">{selUser.classes?.name||selUser.national_id||""}</p></div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {(messages as any[]).length===0&&<div className="text-center py-12 text-muted-foreground text-sm flex flex-col items-center gap-2"><MessageCircle className="w-10 h-10 opacity-20"/>ابدأ المحادثة</div>}
                {(messages as any[]).map((m:any)=>{
                  const mine = m.sender_id===user?.id;
                  return (
                    <div key={m.id} className={`flex ${mine?"justify-start":"justify-end"}`}>
                      <div className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm ${mine?"bg-primary text-primary-foreground rounded-tr-sm":"bg-accent rounded-tl-sm"}`}>
                        <p>{m.content}</p>
                        <p className={`text-[10px] mt-1 ${mine?"opacity-70":"text-muted-foreground"}`}>{new Date(m.created_at).toLocaleTimeString("ar",{hour:"2-digit",minute:"2-digit"})}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={msgEndRef}/>
              </div>
              <div className="p-3 border-t flex gap-2">
                <input value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={handleKey}
                  placeholder="اكتب رسالتك..." className="flex-1 px-4 py-2.5 bg-background border rounded-xl text-sm"/>
                <button onClick={()=>sendMut.mutate()} disabled={!message.trim()||sendMut.isPending}
                  className="p-2.5 rounded-xl bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary/90">
                  <Send className="w-4 h-4"/>
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center flex-col gap-3 text-muted-foreground">
              <MessageCircle className="w-14 h-14 opacity-20"/>
              <p className="text-sm">اختر جهة اتصال لبدء المحادثة</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
