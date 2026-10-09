"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { identityFromSession, signIn } from "@/lib/auth";

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

      const identity = identityFromSession(session);
      let destination: string;

      if (identity.groups.includes("OPERATOR")) {
        destination = "/ops";
      } else if (identity.groups.includes("SUPERVISOR")) {
        if (!identity.actorId) {
          throw new Error("Supervisor identity mapping is missing. Contact the demo administrator.");
        }
        destination = "/supervisor";
      } else if (identity.groups.includes("WORKER")) {
        if (!identity.actorId) {
          throw new Error("Worker identity mapping is missing. Contact the demo administrator.");
        }
        destination = `/worker/${encodeURIComponent(identity.actorId)}`;
      } else {
        throw new Error("This account is not assigned to a TaapSaathi role.");
      }

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
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-4 py-10 text-slate-900">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="mb-8">
          <p className="text-xs font-bold tracking-[0.25em] text-orange-600">
            TAAPSAATHI
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            Welcome back
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Sign in with your configured Cognito account to access live, role-appropriate safety tools.
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
            className="min-h-12 w-full rounded-xl bg-orange-600 px-5 font-semibold text-white transition hover:bg-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 disabled:opacity-50"
          >
            {pending ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-semibold text-slate-800">Choose the right workspace after signing in</p>
          <ul className="mt-2 space-y-1 text-xs leading-relaxed">
            <li><span className="font-semibold">Operations:</span> monitor the live intervention workflow.</li>
            <li><span className="font-semibold">Supervisor:</span> acknowledge escalations assigned to you.</li>
            <li><span className="font-semibold">Rider:</span> use the link provided for your worker profile.</li>
          </ul>
        </div>

        <div className="mt-6 text-center">
          <Link href="/ops" className="text-sm font-medium text-slate-500 underline">
            View operations dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
