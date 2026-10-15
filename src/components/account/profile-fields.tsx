import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProfileFieldsProps = {
  username: string;
  displayName: string;
  errors?: { username?: string; displayName?: string };
};

/** Username and name inputs shared by account setup and settings. */
export function ProfileFields({ username, displayName, errors }: ProfileFieldsProps) {
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="displayName">Name</Label>
        <Input
          id="displayName"
          name="displayName"
          defaultValue={displayName}
          maxLength={50}
          autoComplete="name"
          aria-invalid={!!errors?.displayName}
          className="bg-background h-11"
        />
        <p className={errors?.displayName ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
          {errors?.displayName ?? "Shown under cards you own."}
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="username">Username</Label>
        <div className="relative">
          <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">@</span>
          <Input
            id="username"
            name="username"
            defaultValue={username}
            maxLength={20}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={!!errors?.username}
            className="bg-background h-11 pl-7"
          />
        </div>
        <p className={errors?.username ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
          {errors?.username ?? "3–20 lowercase letters, numbers, dots or underscores. You can change it later."}
        </p>
      </div>
    </>
  );
}
