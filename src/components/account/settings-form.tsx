"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { ProfileFields } from "@/components/account/profile-fields";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { saveSettings, type SettingsFormState } from "@/app/settings/actions";

type SettingsFormProps = { username: string; displayName: string; searchable: boolean };

export function SettingsForm({ username, displayName, searchable }: SettingsFormProps) {
  const router = useRouter();
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(saveSettings, {});

  useEffect(() => {
    if (state.saved) {
      toast.success("Settings saved");
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={action} className="grid gap-5">
      <ProfileFields username={username} displayName={displayName} errors={state.fieldErrors} />
      <div className="bg-background flex items-start justify-between gap-4 rounded-xl border p-4">
        <div className="grid gap-1">
          <Label htmlFor="searchable">Let people find me</Label>
          <p className="text-muted-foreground text-xs">
            When on, people can find you by name or @username and send cards straight to your account. When off,
            you can still receive cards through links people send you.
          </p>
        </div>
        <Switch id="searchable" name="searchable" defaultChecked={searchable} />
      </div>
      {state.error && <p className="text-destructive text-sm">{state.error}</p>}
      <Button type="submit" size="lg" className="h-11" disabled={pending}>
        {pending && <Loader2Icon className="animate-spin" />} Save
      </Button>
    </form>
  );
}
