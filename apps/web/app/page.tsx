import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import InteractiveWalkthrough from "@/components/landing/InteractiveWalkthrough";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const principles = [
  ["Detect", "A deterministic policy considers heat context and continuous active time."],
  ["Guide", "Riders get concise bilingual guidance and a route toward a simulated rest point."],
  ["Protect", "Delivery ownership is secured before a rider rests or a supervisor is asked to follow up."],
  ["Confirm", "Role-bound actions and an audit trail make operational responsibility visible."],
];

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-[1.0625rem] font-semibold tracking-tight">
      <span aria-hidden="true" lang="hi" className="grid size-8 place-items-center rounded-[0.6rem] bg-primary text-[1.0625rem] font-medium leading-none text-primary-foreground">स</span>
      Sahara
    </Link>
  );
}

export default function HomePage() {
  return (
    <main className="overflow-x-hidden bg-canvas">
      <header className="px-5 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between py-5">
          <Brand />
          <nav aria-label="Primary" className="flex items-center gap-2 text-[0.9375rem]">
            <a href="#walkthrough" className="rounded-full px-3.5 py-2 text-label-2 hover:text-label">Walkthrough</a>
            <Link href="/login" className={buttonVariants({ variant: "secondary", size: "sm" })}>Sign in</Link>
          </nav>
        </div>
      </header>

      <section className="px-5 pb-16 pt-12 sm:px-8 sm:pb-24 sm:pt-20">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-[0.8125rem] font-medium text-primary"><ShieldCheck aria-hidden="true" className="size-4" /> Heat-safety coordination for delivery teams</p>
            <h1 className="mt-6 max-w-4xl text-[clamp(2.35rem,6vw,4.6rem)] font-semibold leading-[1.02] tracking-[-0.045em]">When heat puts a rider at risk, someone has to act.</h1>
            <p className="mt-6 max-w-2xl text-[1.125rem] leading-relaxed text-label-2">Sahara connects a heat-risk signal to practical rider guidance, protected delivery handling, and accountable supervisor follow-up.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="#walkthrough" className={buttonVariants({ size: "xl" })}>Explore the walkthrough <ArrowRight aria-hidden="true" /></a>
              <Link href="/login" className={buttonVariants({ variant: "secondary", size: "xl" })}>Open Sahara workspace</Link>
            </div>
          </div>
          <aside className="rounded-3xl bg-surface p-6 shadow-sm">
            <p className="text-[0.8125rem] font-medium text-label-2">WHAT YOU CAN EXPLORE</p>
            <ul className="mt-4 space-y-3 text-[0.9375rem] leading-relaxed">
              <li className="flex gap-3"><CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />Ravi’s rider phone experience</li>
              <li className="flex gap-3"><CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />Delivery reassignment on a map</li>
              <li className="flex gap-3"><CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />Supervisor acknowledgement path</li>
            </ul>
          </aside>
        </div>
      </section>

      <section className="px-5 pb-20 sm:px-8 sm:pb-28"><div className="mx-auto max-w-6xl"><InteractiveWalkthrough /></div></section>

      <section aria-labelledby="principles" className="bg-surface px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-[0.8125rem] font-medium tracking-wide text-label-2">THE PRODUCT WORKFLOW</p>
          <h2 id="principles" className="mt-3 max-w-2xl text-[clamp(1.8rem,4vw,2.75rem)] font-semibold leading-tight tracking-tight">A response is more than a warning.</h2>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {principles.map(([title, detail], index) => (
              <li key={title} className="rounded-3xl bg-canvas p-6">
                <span className="grid size-8 place-items-center rounded-full bg-fill text-[0.875rem] font-semibold">{index + 1}</span>
                <h3 className="mt-6 text-[1.125rem] font-semibold">{title}</h3>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-label-2">{detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8"><div className="mx-auto grid max-w-6xl gap-6 rounded-[2rem] bg-primary px-7 py-10 text-primary-foreground sm:px-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"><div><h2 className="text-[1.75rem] font-semibold tracking-tight">For the operational workspace, sign in.</h2><p className="mt-3 max-w-2xl text-[1rem] leading-relaxed text-primary-foreground/80">The product workspace is authenticated and role-bound. The landing-page walkthrough is deliberately separate and cannot change operational data.</p></div><Link href="/login" className={cn(buttonVariants({ variant: "secondary", size: "xl" }), "w-fit")}>Sign in to Sahara</Link></div></section>

      <footer className="px-5 pb-12 sm:px-8"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-[0.875rem] text-label-2"><Brand /><p>Walkthrough riders, routes and actions are simulated. Sahara makes no medical claims and does not place emergency calls.</p></div></footer>
    </main>
  );
}
