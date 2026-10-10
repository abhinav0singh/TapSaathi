"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in. Please try again."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#07110f] px-4 py-8 text-slate-900">
      <div className="landing-grid absolute inset-0 opacity-25" aria-hidden="true" />
      <div className="heat-glow absolute -right-48 -top-48 h-[36rem] w-[36rem] rounded-full bg-orange-500/20 blur-3xl" aria-hidden="true" />
      <div className="relative grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-[0_40px_120px_rgba(0,0,0,.45)] lg:grid-cols-[1.05fr_.95fr]">
        <section className="relative hidden min-h-[700px] flex-col justify-between overflow-hidden bg-[#f26b38] p-12 lg:flex">
          <div className="absolute -bottom-28 -right-24 h-96 w-96 rounded-full border-[65px] border-slate-950/10" aria-hidden="true" />
          <Link href="/" className="relative inline-flex items-center gap-3 text-lg font-black">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-950 text-sm text-orange-300">त</span>
            TaapSaathi
          </Link>
          <div className="relative">
            <p className="text-xs font-black uppercase tracking-[.2em]">Role-aware by design</p>
            <h2 className="mt-5 max-w-lg text-6xl font-black leading-[.9] tracking-[-.055em]">The right action.<br /><span className="font-serif font-normal italic">To the right person.</span></h2>
            <p className="mt-7 max-w-md text-lg leading-8 text-slate-900/70">Operators coordinate. Supervisors acknowledge. Riders act on clear safety guidance. Cognito keeps every role in its lane.</p>
          </div>
          <div className="relative grid grid-cols-3 gap-3">
            {[["01", "Operator"], ["02", "Supervisor"], ["03", "Rider"]].map(([number, role]) => (
              <div key={role} className="rounded-2xl border border-slate-950/15 bg-white/20 p-4">
                <p className="font-mono text-xs">{number}</p><p className="mt-5 text-sm font-bold">{role}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="p-7 sm:p-10 lg:flex lg:flex-col lg:justify-center lg:p-14">
        <div className="mb-8">
          <p className="text-xs font-bold tracking-[0.25em] text-orange-600">
            TAAPSAATHI
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            Welcome back
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Use your configured Cognito account. We will take you directly to the workspace for your role.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="username"
              className="mb-2 block text-sm font-semibold"
            >
              Username
            </label>

            <input
              id="username"
              name="username"
              autoComplete="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="demo-operator"
              className="min-h-12 w-full rounded-xl border border-slate-300 px-4 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-semibold"
            >
              Password
            </label>

            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="min-h-12 w-full rounded-xl border border-slate-300 px-4 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
          className="min-h-14 w-full rounded-xl bg-slate-950 px-5 font-semibold text-white transition hover:bg-orange-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 disabled:opacity-50"
          >
            {pending ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-semibold text-slate-800">Choose the right workspace after signing in</p>
          <ul className="mt-2 space-y-1 text-xs leading-relaxed">
            <li><span className="font-semibold">Operations:</span> monitor the live intervention workflow.</li>
            <li><span className="font-semibold">Supervisor:</span> acknowledge escalations assigned to you.</li>
            <li><span className="font-semibold">Rider:</span> use the link provided for your worker profile.</li>
          </ul>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm font-semibold text-slate-500 underline underline-offset-4">
            Return to the TaapSaathi story
          </Link>
        </div>
        </div>
      </div>
    </main>
  );
}
