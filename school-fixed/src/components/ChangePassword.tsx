import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { changeUserPassword } from "@/lib/api";
import { toast } from "sonner";
import { Lock, Eye, EyeOff, Save } from "lucide-react";

export function ChangePassword() {
  const { user, updateUser } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);

  const mut = useMutation({
    mutationFn: async () => {
      // Verify current password from DB
      const { data } = await supabase
        .from("users").select("password_hash").eq("id", user!.id).single();
      if (!data || data.password_hash !== current) throw new Error("كلمة المرور الحالية غير صحيحة");
      return changeUserPassword(user!.id, next);
    },
    onSuccess: () => {
      toast.success("✅ تم تغيير كلمة المرور بنجاح");
      updateUser({ password_hash: next });
      setCurrent(""); setNext(""); setConfirm("");
    },
    onError: (e: any) => toast.error(e.message || "خطأ في تغيير كلمة المرور")
  });

  const errors: string[] = [];
  if (next && next.length < 6) errors.push("كلمة المرور الجديدة يجب 6 أحرف على الأقل");
  if (confirm && next !== confirm) errors.push("كلمتا المرور غير متطابقتان");
  const valid = current.length > 0 && next.length >= 6 && next === confirm;

  return (
    <div className="bg-card rounded-xl border p-6 space-y-4 max-w-md">
      <div className="flex items-center gap-2">
        <Lock className="w-5 h-5 text-primary"/>
        <h3 className="font-heading font-bold text-lg">تغيير كلمة المرور</h3>
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1.5">كلمة المرور الحالية</label>
          <div className="relative">
            <input type={show?"text":"password"} value={current} onChange={e=>setCurrent(e.target.value)}
              className="w-full px-4 py-2.5 bg-background border rounded-lg text-sm pl-10" dir="ltr"/>
            <button type="button" onClick={()=>setShow(!show)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {show?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}
            </button>
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1.5">كلمة المرور الجديدة</label>
          <input type={show?"text":"password"} value={next} onChange={e=>setNext(e.target.value)}
            className="w-full px-4 py-2.5 bg-background border rounded-lg text-sm" dir="ltr"/>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1.5">تأكيد كلمة المرور</label>
          <input type={show?"text":"password"} value={confirm} onChange={e=>setConfirm(e.target.value)}
            className="w-full px-4 py-2.5 bg-background border rounded-lg text-sm" dir="ltr"/>
        </div>
        {errors.map(e=><p key={e} className="text-xs text-destructive flex items-center gap-1">⚠️ {e}</p>)}
        <button onClick={()=>mut.mutate()} disabled={!valid||mut.isPending}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-heading font-semibold hover:bg-primary/90 disabled:opacity-50">
          <Save className="w-4 h-4"/>{mut.isPending?"جارٍ الحفظ...":"حفظ كلمة المرور الجديدة"}
        </button>
      </div>
    </div>
  );
}

export function AdminChangePassword({ targetUser, onDone }: { targetUser: any; onDone?: ()=>void }) {
  const [newPwd, setNewPwd] = useState("");
  const [show, setShow] = useState(false);
  const mut = useMutation({
    mutationFn: () => changeUserPassword(targetUser.id, newPwd),
    onSuccess: () => { toast.success(`✅ تم تغيير كلمة مرور ${targetUser.full_name}`); setNewPwd(""); onDone?.(); },
    onError: () => toast.error("خطأ في التغيير")
  });
  return (
    <div className="flex gap-2 items-center">
      <div className="relative flex-1">
        <input type={show?"text":"password"} value={newPwd} onChange={e=>setNewPwd(e.target.value)}
          placeholder="كلمة مرور جديدة" className="w-full px-3 py-2 bg-background border rounded-lg text-sm pl-10" dir="ltr"/>
        <button type="button" onClick={()=>setShow(!show)} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">
          {show?<EyeOff className="w-3.5 h-3.5"/>:<Eye className="w-3.5 h-3.5"/>}
        </button>
      </div>
      <button onClick={()=>mut.mutate()} disabled={newPwd.length<4||mut.isPending}
        className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-heading disabled:opacity-50 shrink-0">
        {mut.isPending?"...":"تغيير"}
      </button>
    </div>
  );
}
