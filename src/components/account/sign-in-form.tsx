"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, Loader2Icon, MailIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

type Step = { kind: "email" } | { kind: "code"; email: string };

/**
 * Runs an auth call and returns its error message, or null on success. Neon's client
 * throws for most failures instead of returning `{ error }`, so both are handled.
 */
async function attempt(call: () => Promise<{ error?: { message?: string } | null }>): Promise<string | null> {
  try {
    const { error } = await call();
    return error ? (error.message ?? "") : null;
  } catch (error) {
    return error instanceof Error ? error.message : "";
  }
}

/** Plain words for what went wrong with a code (the server's messages are "Invalid OTP" and the like). */
function codeErrorMessage(message: string) {
  const text = message.toLowerCase();
  if (text.includes("expired")) return "This code has expired. Send a new code.";
  if (text.includes("too many")) return "Too many tries. Send a new code.";
  if (text.includes("invalid") || text.includes("otp")) return "Invalid code.";
  return "Couldn't check the code. Try again in a moment.";
}

/** Email code (no passwords) or Google. New emails get an account on first sign-in. */
export function SignInForm({
  next,
  onStepChange,
}: {
  next: string;
  /** Told when the form moves between entering an email and entering the code. */
  onStepChange?: (step: Step["kind"]) => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "email" });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"email" | "code" | "google" | null>(null);

  useEffect(() => onStepChange?.(step.kind), [step.kind, onStepChange]);

  // Every sign-in finishes on /auth/callback, which sends new accounts to username setup.
  const callbackPath = `/auth/callback?next=${encodeURIComponent(next)}`;

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy("email");
    setError(null);
    const error = await attempt(() => authClient.emailOtp.sendVerificationOtp({ email: address, type: "sign-in" }));
    setBusy(null);
    if (error !== null) {
      setError(/too many|rate/i.test(error) ? "Too many requests. Wait a minute, then try again." : "We couldn't send a code. Try again in a moment.");
      return;
    }
    setCode("");
    setStep({ kind: "code", email: address });
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    if (step.kind !== "code") return;
    setBusy("code");
    setError(null);
    const error = await attempt(() => authClient.signIn.emailOtp({ email: step.email, otp: code.trim() }));
    if (error !== null) {
      setBusy(null);
      setError(codeErrorMessage(error));
      return;
    }
    router.replace(callbackPath);
    router.refresh();
  }

  async function signInWithGoogle() {
    setBusy("google");
    setError(null);
    const error = await attempt(() =>
      authClient.signIn.social({ provider: "google", callbackURL: `${window.location.origin}${callbackPath}` }),
    );
    if (error !== null) {
      setBusy(null);
      setError("Google sign-in didn't start. Try again.");
    }
  }

  if (step.kind === "code") {
    return (
      <form onSubmit={verifyCode} className="grid gap-4">
        <div className="grid gap-3">
          {/* The instruction doubles as the field's label. */}
          <Label htmlFor="otp" className="block leading-snug font-normal">
            We sent a code to <span className="font-medium">{step.email}</span>
          </Label>
          <Input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
              setError(null);
            }}
            placeholder="123456"
            aria-invalid={!!error}
            className="bg-background h-11 text-center text-lg tracking-[0.4em] tabular-nums"
          />
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button type="submit" size="lg" className="h-11" disabled={code.trim().length < 6 || busy !== null}>
          {busy === "code" && <Loader2Icon className="animate-spin" />} Sign in
        </Button>
        <div className="flex justify-between text-sm">
          <button type="button" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1" onClick={() => {
              setError(null);
              setStep({ kind: "email" });
            }}>
            <ArrowLeftIcon className="size-3.5" /> Use a different email
          </button>
          <button type="button" className="text-muted-foreground hover:text-foreground" disabled={busy !== null} onClick={() => sendCode()}>
            Send a new code
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="grid gap-3">
      <Button type="button" variant="outline" size="lg" className="bg-background h-11" disabled={busy !== null} onClick={signInWithGoogle}>
        {busy === "google" ? <Loader2Icon className="animate-spin" /> : <GoogleIcon />} Continue with Google
      </Button>
      <div className="text-muted-foreground flex h-3 items-center gap-3 text-xs">
        <span className="bg-border h-px flex-1" /> or <span className="bg-border h-px flex-1" />
      </div>
      <form onSubmit={sendCode} className="grid gap-3">
        {/* The placeholder shows what goes here; the label stays for screen readers. */}
        <Label htmlFor="email" className="sr-only">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-invalid={!!error}
          className="bg-background h-11"
        />
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button type="submit" size="lg" className="h-11" disabled={busy !== null}>
          {busy === "email" ? <Loader2Icon className="animate-spin" /> : <MailIcon />} Email me a code
        </Button>
      </form>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  );
}
