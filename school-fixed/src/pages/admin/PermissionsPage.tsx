import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSchoolSettings, saveAllSchoolSettings } from "@/lib/api";
import { toast } from "sonner";
import { Save, Shield, Users, BookOpen, GraduationCap, UserCheck } from "lucide-react";

const ROLE_PERMS = [
  {
    role: "teacher", label: "المعلم", icon: BookOpen, color: "text-info",
    perms: [
      { key: "teacher_can_add_exams", label: "إضافة اختبارات" },
      { key: "teacher_can_edit_exams", label: "تعديل اختبارات" },
      { key: "teacher_can_add_lessons", label: "إضافة دروس" },
      { key: "teacher_can_grade", label: "تسجيل درجات" },
      { key: "teacher_can_take_attendance", label: "تسجيل حضور وغياب" },
      { key: "teacher_can_message_students", label: "مراسلة الطلاب" },
      { key: "teacher_can_message_parents", label: "مراسلة أولياء الأمور" },
      { key: "teacher_can_view_reports", label: "عرض التقارير" },
    ]
  },
  {
    role: "student", label: "الطالب", icon: GraduationCap, color: "text-primary",
    perms: [
      { key: "student_can_take_exams", label: "حل الاختبارات" },
      { key: "student_can_view_grades", label: "عرض الدرجات" },
      { key: "student_can_view_lessons", label: "عرض الدروس" },
      { key: "student_can_view_schedule", label: "عرض الجدول" },
      { key: "student_can_message_teachers", label: "مراسلة المعلمين" },
      { key: "student_can_message_students", label: "مراسلة زملائه" },
    ]
  },
  {
    role: "parent", label: "ولي الأمر", icon: UserCheck, color: "text-warning",
    perms: [
      { key: "parent_can_view_grades", label: "عرض درجات أبنائه" },
      { key: "parent_can_view_attendance", label: "عرض حضور أبنائه" },
      { key: "parent_can_view_schedule", label: "عرض الجدول" },
      { key: "parent_can_message_teachers", label: "مراسلة المعلمين" },
      { key: "parent_can_message_admin", label: "مراسلة الإدارة" },
    ]
  },
];

export default function PermissionsPage() {
  const qc = useQueryClient();
  const [settings, setSettings] = useState<Record<string,string>>({});

  const { data = [], isLoading } = useQuery({ queryKey:["school-settings"], queryFn: () => import("@/lib/api").then(m=>m.getSchoolSettings()) });

  useEffect(()=>{
    const map: Record<string,string> = {};
    // Default all permissions to "true"
    ROLE_PERMS.forEach(rp=>rp.perms.forEach(p=>{ map[p.key]="true"; }));
    (data as any[]).forEach((s:any)=>{ map[s.key]=s.value; });
    setSettings(map);
  },[data]);

  const saveMut = useMutation({
    mutationFn: () => import("@/lib/api").then(m=>m.saveAllSchoolSettings(settings)),
    onSuccess: ()=>{ qc.invalidateQueries({queryKey:["school-settings"]}); toast.success("✅ تم حفظ الصلاحيات"); },
    onError: ()=>toast.error("خطأ في الحفظ")
  });

  const toggle = (key: string) => setSettings(prev=>({...prev,[key]:prev[key]==="false"?"true":"false"}));

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">جارٍ التحميل...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2"><Shield className="w-6 h-6 text-primary"/>إدارة الصلاحيات</h1>
          <p className="text-muted-foreground text-sm mt-1">تحكم بما يستطيع كل دور القيام به في النظام</p>
        </div>
        <button onClick={()=>saveMut.mutate()} disabled={saveMut.isPending}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-heading font-semibold hover:bg-primary/90 disabled:opacity-70">
          <Save className="w-4 h-4"/>{saveMut.isPending?"جارٍ الحفظ...":"حفظ الصلاحيات"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {ROLE_PERMS.map(({role,label,icon:Icon,color,perms})=>{
          const enabled = perms.filter(p=>settings[p.key]!=="false").length;
          return (
            <div key={role} className="bg-card rounded-xl border overflow-hidden">
              <div className={`p-4 border-b bg-accent/20 flex items-center gap-3`}>
                <div className={`w-10 h-10 rounded-xl bg-card flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${color}`}/>
                </div>
                <div className="flex-1">
                  <h3 className="font-heading font-bold">{label}</h3>
                  <p className="text-xs text-muted-foreground">{enabled}/{perms.length} صلاحية مفعّلة</p>
                </div>
                <button onClick={()=>{
                  const allOn = perms.every(p=>settings[p.key]!=="false");
                  const newMap = {...settings};
                  perms.forEach(p=>{ newMap[p.key]=allOn?"false":"true"; });
                  setSettings(newMap);
                }} className="text-xs px-2.5 py-1 rounded-lg border hover:bg-accent font-heading">
                  {perms.every(p=>settings[p.key]!=="false")?"تعطيل الكل":"تفعيل الكل"}
                </button>
              </div>
              <div className="divide-y">
                {perms.map(({key,label:pLabel})=>{
                  const on = settings[key]!=="false";
                  return (
                    <div key={key} className="flex items-center justify-between px-4 py-3 hover:bg-accent/20">
                      <span className={`text-sm ${on?"":"text-muted-foreground line-through"}`}>{pLabel}</span>
                      <button onClick={()=>toggle(key)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${on?"bg-primary":"bg-accent border"}`}>
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${on?"left-5":"left-0.5"}`}/>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex gap-3">
        <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5"/>
        <div className="text-sm text-amber-800 dark:text-amber-200">
          <p className="font-semibold mb-1">ملاحظة:</p>
          <p>تغيير الصلاحيات يؤثر فوراً على ما يراه المستخدمون. المدير دائماً يملك صلاحيات كاملة.</p>
        </div>
      </div>
    </div>
  );
}
