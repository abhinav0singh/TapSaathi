import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const steps = [
  ["Detect", "Weather and workload feed one clear risk rule. When a rider crosses the limit, an alert starts."],
  ["Guide", "The rider gets a short route to shade and spoken guidance, in English or Hindi."],
  ["Protect", "Their delivery moves to another rider, or goes to a supervisor if nobody is free."],
  ["Confirm", "A person acknowledges, and every step is written to an audit trail."],
];

const roles = [
  { title: "Riders", text: "A phone screen with one decision at a time: take a break, or say you feel unwell.", href: "/demo", cta: "See a recorded run" },
  { title: "Supervisors", text: "A queue of riders waiting on you, longest wait first, and one action to acknowledge.", href: "/login", cta: "Sign in" },
  { title: "Operations", text: "The whole run on one screen: the map, the stages, the riders and the audit trail.", href: "/ops", cta: "Open the live board" },
];

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-[1.0625rem] font-semibold tracking-tight">
      <span aria-hidden="true" lang="hi" className="grid size-8 place-items-center rounded-[0.6rem] bg-primary text-[1.0625rem] font-medium leading-none text-primary-foreground">
        स
      </span>
      Sahara
    </Link>
  );
}

export default function HomePage() {
  return (
    <main className="bg-canvas">
      <header className="px-5 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between py-5">
          <Brand />
          <nav aria-label="Primary" className="flex items-center gap-1 text-[0.9375rem]">
            <Link href="/demo" className="rounded-full px-3.5 py-2 text-label-2 hover:text-label">Recorded run</Link>
            <Link href="/login" className={buttonVariants({ variant: "secondary", size: "sm" })}>Sign in</Link>
          </nav>
        </div>
      </header>

      <section className="px-5 pb-20 pt-14 sm:px-8 sm:pb-28 sm:pt-24">
        <div className="mx-auto max-w-5xl">
          <h1 className="max-w-3xl text-[clamp(2rem,4.5vw,3rem)] font-semibold leading-[1.08] tracking-tight">
            When heat puts a rider at risk, someone has to act.
          </h1>
          <p className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-label-2">
            Sahara turns a heat warning into a rider reaching shade, a delivery that keeps moving, and a person who is accountable for what happens next.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/ops" className={buttonVariants({ size: "xl" })}>Open the live demo</Link>
            <Link href="/demo" className={buttonVariants({ variant: "secondary", size: "xl" })}>Watch a recorded run</Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="how" className="bg-surface px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 id="how" className="text-[1.5rem] font-semibold tracking-tight">How a run goes</h2>
          <ol className="mt-10 grid gap-x-12 gap-y-9 sm:grid-cols-2">
            {steps.map(([title, text], index) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-fill text-[0.9375rem] font-medium tabular-nums">{index + 1}</span>
                <div>
                  <h3 className="text-[1.0625rem] font-semibold">{title}</h3>
                  <p className="mt-1 text-[1rem] leading-relaxed text-label-2">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="roles" className="px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 id="roles" className="text-[1.5rem] font-semibold tracking-tight">Made for three people</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {roles.map((role) => (
              <article key={role.title} className="flex flex-col rounded-3xl bg-surface p-7">
                <h3 className="text-[1.125rem] font-semibold">{role.title}</h3>
                <p className="mt-2 flex-1 text-[1rem] leading-relaxed text-label-2">{role.text}</p>
                <Link href={role.href} className={cn(buttonVariants({ variant: "secondary" }), "mt-7 w-fit")}>
                  {role.cta}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="px-5 pb-12 sm:px-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 text-[0.875rem] text-label-2">
          <Brand />
          <p>A hackathon demonstration on AWS. Riders, weather and rest points are simulated. Sahara gives no medical advice and does not call emergency services.</p>
        </div>
      </footer>
    </main>
  );
}
