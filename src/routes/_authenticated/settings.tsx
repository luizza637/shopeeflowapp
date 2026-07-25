import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  ExternalLink,
  KeyRound,
  Loader2,
  Settings as SettingsIcon,
  Trash2,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getGeminiKeyStatus,
  saveGeminiKey,
  deleteGeminiKey,
} from "@/lib/ai-keys.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Configurações — ShopeeFlow" }] }),
  component: SettingsPage,
});


function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setUserId(data.user.id);
      setEmail(data.user.email ?? "");
      const { data: p } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", data.user.id)
        .maybeSingle();
      if (p?.display_name) setDisplayName(p.display_name);
      setLoading(false);
    })();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar");
      return;
    }
    toast.success("Perfil atualizado");
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
          <SettingsIcon className="h-4 w-4" />
          Configurações
        </div>
        <h1 className="font-display text-3xl font-bold">Sua conta</h1>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-semibold">Perfil</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Como você aparece dentro do ShopeeFlow.
        </p>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={save} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={80}
              />
            </div>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" value={email} disabled />
              <p className="mt-1.5 text-xs text-muted-foreground">
                E-mail não pode ser alterado.
              </p>
            </div>
            <Button
              type="submit"
              disabled={saving}
              className="bg-gradient-primary shadow-glow hover:opacity-90"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar alterações"}
            </Button>
          </form>
        )}
      </div>

      <GeminiKeyCard />
    </div>

  );
}
