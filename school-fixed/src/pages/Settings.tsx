import { ChangePassword } from "@/components/ChangePassword";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSchoolSettings, saveAllSchoolSettings } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Save, School, Lock, Video, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// ── Teacher/Student/Parent view: only password + zoom (teacher only)
function UserSettings() {
  const { user, updateUser } = useAuth();
  const [zoomLink, setZoomLink] = useState(user?.zoom_link || "");
  const [saving, setSaving] = useState(false);

  const saveZoom = async () => {
    setSaving(true);
    await supabase.from("users").update({ zoom_link: zoomLink }).eq("id", user!.id);
    updateUser({ zoom_link: zoomLink });
    setSaving(false);
    toast.success("تم حفظ رابط Zoom");
  };

  return (
    <div className="space-y-6 max-w-md">
      <div><h1 className="font-heading text-2xl font-bold">إعدادات الحساب</h1><p className="text-muted-foreground text-sm mt-1">تعديل معلوماتك الشخصية</p></div>

      {/* Profile info */}
      <div className="bg-card rounded-xl border p-5 space-y-3">
        <h3 className="font-heading font-semibold">معلومات الحساب</h3>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between py-1.5 border-b"><span className="text-muted-foreground">الاسم</span><span className="font-medium">{user?.full_name}</span></div>
          <div className="flex justify-between py-1.5 border-b"><span className="text-muted-foreground">الرقم المدني</span><span className="font-mono">{user?.national_id}</span></div>
          <div className="flex justify-between py-1.5"><span className="text-muted-foreground">الصلاحية</span><span className="font-medium">{user?.role === "teacher"?"معلم":user?.role === "student"?"طالب":user?.role === "parent"?"ولي أمر":"مدير"}</span></div>
        </div>
      </div>

      {/* Zoom link - teachers only */}
      {user?.role === "teacher" && (
        <div className="bg-card rounded-xl border p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-info"/>
            <h3 className="font-heading font-semibold">رابط Zoom الخاص بك</h3>
          </div>
          <p className="text-xs text-muted-foreground">سيُضاف هذا الرابط تلقائياً لجميع حصصك في الجدول الدراسي</p>
          <input value={zoomLink} onChange={e=>setZoomLink(e.target.value)}
            placeholder="https://zoom.us/j/..." dir="ltr"
            className="w-full px-4 py-2.5 bg-background border rounded-lg text-sm font-mono"/>
          <button onClick={saveZoom} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-info text-white rounded-lg text-sm font-heading hover:bg-info/90 disabled:opacity-50">
            <Save className="w-4 h-4"/>{saving?"جارٍ الحفظ...":"حفظ الرابط"}
          </button>
          {user.zoom_link && <p className="text-xs text-success">✓ الرابط الحالي: <a href={user.zoom_link} target="_blank" className="underline">{user.zoom_link}</a></p>}
        </div>
      )}

      {/* Change password */}
      <ChangePassword />
    </div>
  );
}

// ── Admin view: full school settings + permissions tab
export default function Settings() {
  const { user } = useAuth();
  const qc = useQueryClient();

  if (user?.role !== "admin") return <UserSettings />;

  // Admin full settings
  return <AdminSettings />;
}

function AdminSettings() {
  const qc = useQueryClient();
  const [settings, setSettings] = useState<Record<string,string>>({});
  const [activeTab, setActiveTab] = useState("school");

  const { data = [], isLoading } = useQuery({ queryKey:["school-settings"], queryFn: getSchoolSettings });
  useEffect(()=>{
    if ((data as any[]).length > 0) {
      const map: Record<string,string> = {};
      (data as any[]).forEach((s:any) => { map[s.key] = s.value; });
      setSettings(map);
    }
  }, [data]);

  const saveMut = useMutation({ mutationFn:()=>saveAllSchoolSettings(settings), onSuccess:()=>toast.success("تم حفظ الإعدادات"), onError:()=>toast.error("خطأ في الحفظ") });
  const set = (key: string, val: string) => setSettings(prev=>({...prev,[key]:val}));
  const toggle = (key: string) => setSettings(prev=>({...prev,[key]:prev[key]==="true"?"false":"true"}));

  const tabs = [
    {id:"school",label:"المدرسة"},
    {id:"notifications",label:"الإشعارات"},
    {id:"account",label:"الحساب"},
  ];

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">جارٍ التحميل...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div><h1 className="font-heading text-2xl font-bold">الإعدادات</h1><p className="text-muted-foreground text-sm mt-1">إدارة إعدادات النظام</p></div>

      <div className="flex gap-1 bg-accent/30 p-1 rounded-lg w-fit">
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)}
            className={`px-4 py-2 text-sm font-heading rounded-md transition-colors ${activeTab===t.id?"bg-card shadow-sm text-primary":"text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab==="school"&&(
        <div className="bg-card rounded-xl border p-6 space-y-4">
          <h2 className="font-heading font-semibold flex items-center gap-2"><School className="w-4 h-4 text-primary"/>إعدادات المدرسة</h2>
          {[["school_name","اسم المدرسة","text"],["school_address","عنوان المدرسة","text"],["school_phone","هاتف المدرسة","text"],["school_email","البريد الإلكتروني","email"],["current_semester","الفصل الدراسي الحالي","text"],["academic_year","العام الدراسي","text"]].map(([k,l,t])=>(
            <div key={k}><label className="text-xs text-muted-foreground block mb-1.5">{l}</label>
            <input type={t} value={settings[k]||""} onChange={e=>set(k,e.target.value)} className="w-full px-4 py-2.5 bg-background border rounded-lg text-sm"/></div>
          ))}
        </div>
      )}
      {activeTab==="notifications"&&(
        <div className="bg-card rounded-xl border p-6 space-y-4">
          <h2 className="font-heading font-semibold">إعدادات الإشعارات</h2>
          {[["notify_absence","إشعار الغياب"],["notify_grades","إشعار الدرجات"],["notify_exams","إشعار الاختبارات"],["notify_messages","إشعار الرسائل"]].map(([k,l])=>(
            <div key={k} className="flex items-center justify-between p-3 bg-accent/30 rounded-lg">
              <span className="text-sm font-medium">{l}</span>
              <button onClick={()=>toggle(k)} className={`w-11 h-6 rounded-full transition-colors relative ${settings[k]==="true"?"bg-primary":"bg-accent"}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings[k]==="true"?"translate-x-0.5":"-translate-x-5"}`}/>
              </button>
            </div>
          ))}
        </div>
      )}
      {activeTab==="account"&&<ChangePassword />}

      <div className="flex justify-end">
        <button onClick={()=>saveMut.mutate()} disabled={saveMut.isPending}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-heading font-semibold hover:bg-primary/90 disabled:opacity-70">
          <Save className="w-4 h-4"/>{saveMut.isPending?"جارٍ الحفظ...":"حفظ التغييرات"}
        </button>
      </div>
    </div>
  );
}
