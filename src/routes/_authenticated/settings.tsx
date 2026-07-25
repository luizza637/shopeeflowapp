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

function GeminiKeyCard() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [masked, setMasked] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const s = await getGeminiKeyStatus();
        setConfigured(s.configured);
        setMasked(s.masked);
      } catch {
        /* silencioso */
      }
      setLoading(false);
    })();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    setBusy(true);
    try {
      const r = await saveGeminiKey({ data: { apiKey: apiKey.trim() } });
      setConfigured(true);
      setMasked(r.masked);
      setApiKey("");
      toast.success("Chave do Gemini salva! As imagens agora usam a sua conta.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar a chave");
    }
    setBusy(false);
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteGeminiKey();
      setConfigured(false);
      setMasked(null);
      toast.success("Chave removida. Voltando a usar o saldo de IA do app.");
    } catch {
      toast.error("Não foi possível remover a chave");
    }
    setBusy(false);
  };

  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface p-6">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-semibold">Sua chave do Google Gemini</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Cada pessoa pode usar a própria chave gratuita do Google AI Studio para gerar imagens
        sem consumir o saldo de IA do app. A chave fica visível somente para você.
      </p>
      <a
        href="https://aistudio.google.com/app/apikey"
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        Criar minha chave no Google AI Studio
        <ExternalLink className="h-3.5 w-3.5" />
      </a>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : configured ? (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm">
            <Check className="h-4 w-4 text-primary" />
            Chave ativa: <code className="text-xs">{masked}</code>
          </span>
          <Button variant="outline" size="sm" onClick={remove} disabled={busy}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Trash2 className="mr-1.5 h-4 w-4" />
                Remover
              </>
            )}
          </Button>
        </div>
      ) : (
        <form onSubmit={save} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="gemini">Chave da API</Label>
            <Input
              id="gemini"
              type="password"
              autoComplete="off"
              placeholder="AIza..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            disabled={busy || !apiKey.trim()}
            className="bg-gradient-primary shadow-glow hover:opacity-90"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar chave"}
          </Button>
        </form>
      )}
    </div>
  );
}

