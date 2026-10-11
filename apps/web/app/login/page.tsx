"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { destinationForIdentity, identityFromSession, signIn } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);

    try {
      const session = await signIn(username, password);
      if (!session.isValid()) {
        throw new Error("Authentication session is invalid.");
      }

      const destination = destinationForIdentity(identityFromSession(session));
      setPassword("");
      router.replace(destination);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5 text-[1.0625rem] font-semibold tracking-tight">
          <span aria-hidden="true" lang="hi" className="grid size-8 place-items-center rounded-[0.6rem] bg-primary text-[1.0625rem] font-medium leading-none text-primary-foreground">
            स
          </span>
          Sahara
        </Link>

        <div className="rounded-3xl bg-surface p-7 sm:p-8">
          <h1 className="text-[1.5rem] font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-label-2">
            Use your Sahara account. You will land in the workspace for your role.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-[0.9375rem] font-medium">Username</Label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="demo-operator"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[0.9375rem] font-medium">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            {error && (
              <p role="alert" className="flex items-start gap-2.5 rounded-xl bg-critical-tint px-3.5 py-3 text-[0.9375rem] text-critical-ink">
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {error}
              </p>
            )}

            <Button type="submit" size="xl" className="w-full" disabled={pending}>
              {pending && <LoaderCircle aria-hidden="true" className="animate-spin" />}
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>

        <aside aria-label="Judge access" className="mt-5 rounded-2xl px-2 text-[0.9375rem] leading-relaxed text-label-2">
          <p>
            Reviewing this project? You can see everything without signing in:{" "}
            <Link href="/demo" className="text-rest underline-offset-4 hover:underline">watch a recorded run</Link> or open the read-only{" "}
            <Link href="/ops" className="text-rest underline-offset-4 hover:underline">operations board</Link>. To try the actions yourself, sign in with{" "}
            <code className="rounded bg-surface px-1.5 py-0.5 text-[0.875rem]">demo-operator</code>,{" "}
            <code className="rounded bg-surface px-1.5 py-0.5 text-[0.875rem]">demo-ravi</code> or{" "}
            <code className="rounded bg-surface px-1.5 py-0.5 text-[0.875rem]">demo-neha</code>. The demo password is in the submission writeup.
          </p>
        </aside>
      </div>
    </main>
  );
}
