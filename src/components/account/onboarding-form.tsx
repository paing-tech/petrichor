"use client";

import { useActionState } from "react";
import { Loader2Icon } from "lucide-react";
import { ProfileFields } from "@/components/account/profile-fields";
import { Button } from "@/components/ui/button";
import { saveNewProfile, type ProfileFormState } from "@/app/onboarding/actions";

type OnboardingFormProps = { next: string; suggestedUsername: string; suggestedName: string };

export function OnboardingForm({ next, suggestedUsername, suggestedName }: OnboardingFormProps) {
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(saveNewProfile, {});
  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="next" value={next} />
      <ProfileFields username={suggestedUsername} displayName={suggestedName} errors={state.fieldErrors} />
      {state.error && <p className="text-destructive text-sm">{state.error}</p>}
      <Button type="submit" size="lg" className="h-11" disabled={pending}>
        {pending && <Loader2Icon className="animate-spin" />} Continue
      </Button>
    </form>
  );
}
