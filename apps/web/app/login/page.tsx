"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth";

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

      setPassword("");
      router.replace("/ops");
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
            Sign in to your heat-safety operations account.
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
              className="min-h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-orange-500"
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
              className="min-h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-orange-500"
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
            className="min-h-12 w-full rounded-xl bg-orange-600 px-5 font-semibold text-white transition hover:bg-orange-700 disabled:opacity-50"
          >
            {pending ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Authorized hackathon demo accounts only.
        </p>

        <div className="mt-6 text-center">
          <Link href="/ops" className="text-sm font-medium text-slate-500 underline">
            View operations dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
