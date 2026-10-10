import Link from "next/link";

const workflow = [
  ["01", "Sense", "Weather and workload observations enter one deterministic risk path."],
  ["02", "Decide", "A versioned heat-risk event starts a durable AWS intervention."],
  ["03", "Guide", "The rider receives a safer route, rest point, and bilingual audio guidance."],
  ["04", "Protect", "Work is reassigned or escalated until a human response is recorded."],
];

const stack = [
  ["EventBridge", "Signals"], ["Step Functions", "Orchestration"],
  ["DynamoDB", "State"], ["Amazon Location", "Routes"],
  ["Polly", "Voice"], ["Cognito", "Identity"],
];

function ArrowIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4"><path d="M4 10h11M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}

function Brand() {
  return (
    <Link href="/" className="inline-flex items-center gap-3 font-bold tracking-tight text-white">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-orange-500 text-sm text-slate-950 shadow-[0_0_30px_rgba(249,115,22,.35)]">त</span>
      <span>TaapSaathi</span>
    </Link>
  );
}

export default function HomePage() {
  return (
    <main className="overflow-hidden bg-[#07110f] text-[#f4f1e8]">
      <section className="relative min-h-screen border-b border-white/10">
        <div className="landing-grid absolute inset-0 opacity-35" aria-hidden="true" />
        <div className="heat-glow absolute -right-40 -top-56 h-[42rem] w-[42rem] rounded-full bg-orange-500/20 blur-3xl" aria-hidden="true" />

        <nav className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-5 py-6 md:px-8">
          <Brand />
          <div className="hidden items-center gap-8 text-sm text-white/65 md:flex">
            <a href="#how-it-works" className="transition hover:text-white">How it works</a>
            <a href="#architecture" className="transition hover:text-white">Architecture</a>
            <Link href="/login" className="transition hover:text-white">Sign in</Link>
          </div>
          <Link href="/ops" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#f4f1e8] px-5 text-sm font-bold text-slate-950 transition hover:-translate-y-0.5 hover:bg-white">
            Live command center <ArrowIcon />
          </Link>
        </nav>

        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-16 md:px-8 lg:min-h-[calc(100vh-100px)] lg:grid-cols-[.9fr_1.1fr] lg:pb-24 lg:pt-8">
          <div>
            <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/[.04] px-4 py-2 text-xs font-bold uppercase tracking-[.18em] text-orange-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-orange-400" /> Human-first heat safety
            </div>
            <h1 className="max-w-3xl text-[clamp(3.4rem,7.4vw,7.5rem)] font-black leading-[.86] tracking-[-.065em]">
              Heat risk<br />changes fast.
              <span className="mt-2 block font-serif font-normal italic text-orange-400">Dispatch should too.</span>
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-8 text-white/65 md:text-xl">
              TaapSaathi detects dangerous heat exposure, guides riders to safety, and keeps operations moving through one auditable AWS workflow.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/ops" className="inline-flex min-h-14 items-center gap-3 rounded-full bg-orange-500 px-7 font-bold text-slate-950 transition hover:-translate-y-1 hover:bg-orange-400">Explore the live demo <ArrowIcon /></Link>
              <a href="#how-it-works" className="inline-flex min-h-14 items-center rounded-full border border-white/20 px-7 font-semibold text-white transition hover:border-white/40 hover:bg-white/5">See the safety loop</a>
            </div>
            <div className="mt-12 flex flex-wrap gap-x-8 gap-y-4 border-t border-white/10 pt-6 text-sm text-white/50">
              <span><strong className="mr-2 text-white">Real AWS</strong> orchestration</span>
              <span><strong className="mr-2 text-white">3 roles</strong> protected by Cognito</span>
              <span><strong className="mr-2 text-white">139 tests</strong> passing</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-2xl lg:ml-auto">
            <div className="heat-orbit absolute -inset-10 rounded-full border border-orange-400/20" aria-hidden="true" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-[#e9e3d5] p-3 shadow-[0_50px_120px_rgba(0,0,0,.45)] md:p-4">
              <div className="relative min-h-[520px] overflow-hidden rounded-[1.45rem] bg-[#dcd5c5] text-slate-950">
                <div className="map-lines absolute inset-0 opacity-80" aria-hidden="true" />
                <svg viewBox="0 0 700 520" className="absolute inset-0 h-full w-full" aria-hidden="true">
                  <path d="M-20 390C120 320 180 350 270 270s165-40 250-135S675 65 740 80" fill="none" stroke="#f97316" strokeLinecap="round" strokeWidth="9" />
                  <path d="M-20 390C120 320 180 350 270 270s165-40 250-135S675 65 740 80" fill="none" stroke="#fff7ed" strokeDasharray="4 18" strokeLinecap="round" strokeWidth="2" />
                </svg>
                <div className="absolute left-[15%] top-[68%] h-5 w-5 rounded-full border-4 border-white bg-amber-500 shadow-lg" />
                <div className="map-pulse absolute left-[48%] top-[46%] h-7 w-7 rounded-full border-4 border-white bg-violet-600 shadow-xl" />
                <div className="absolute right-[19%] top-[17%] h-5 w-5 rounded-full border-4 border-white bg-emerald-500 shadow-lg" />

                <div className="absolute left-5 top-5 rounded-2xl border border-white/60 bg-white/85 p-4 shadow-lg backdrop-blur md:left-7 md:top-7">
                  <p className="text-[10px] font-black uppercase tracking-[.18em] text-orange-700">Live safety network</p>
                  <p className="mt-2 text-lg font-black">Delhi North Hub</p>
                  <p className="mt-1 text-xs text-slate-500">3 riders · 1 needs follow-up</p>
                </div>

                <div className="landing-float absolute bottom-5 right-5 w-[min(18rem,80%)] rounded-2xl bg-[#081411] p-5 text-white shadow-2xl md:bottom-7 md:right-7">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-[.18em] text-orange-300">Intervention active</p>
                    <span className="rounded-full bg-orange-400/15 px-2 py-1 text-[10px] font-bold text-orange-300">HIGH RISK</span>
                  </div>
                  <p className="mt-4 text-2xl font-bold">Ravi is heading to shade</p>
                  <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl bg-white/[.07] p-3"><span className="text-white/45">Rest point</span><strong className="mt-1 block">Central Park</strong></div>
                    <div className="rounded-xl bg-white/[.07] p-3"><span className="text-white/45">Route</span><strong className="mt-1 block">420 m</strong></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f3efe5] px-5 py-24 text-slate-950 md:px-8 md:py-32" id="how-it-works">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[.75fr_1.25fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[.2em] text-orange-700">One continuous safety loop</p>
              <h2 className="mt-5 max-w-xl text-5xl font-black leading-[.95] tracking-[-.045em] md:text-7xl">From heat signal to human action.</h2>
            </div>
            <p className="max-w-2xl self-end text-xl leading-8 text-slate-600 lg:justify-self-end">A warning alone is not protection. TaapSaathi connects detection, rider guidance, delivery continuity, and supervisor accountability in one visible flow.</p>
          </div>
          <div className="mt-16 grid border-y border-slate-300 md:grid-cols-2 lg:grid-cols-4">
            {workflow.map(([number, title, description]) => (
              <article key={number} className="group border-b border-slate-300 py-8 md:px-6 md:odd:border-r lg:border-b-0 lg:border-r lg:first:pl-0 lg:last:border-r-0">
                <span className="font-mono text-xs text-orange-700">{number}</span>
                <h3 className="mt-16 text-3xl font-bold tracking-tight transition group-hover:text-orange-700">{title}</h3>
                <p className="mt-4 text-sm leading-6 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="architecture" className="relative bg-[#f26b38] px-5 py-24 text-slate-950 md:px-8 md:py-32">
        <div className="absolute right-[-8rem] top-[-8rem] h-96 w-96 rounded-full border-[70px] border-[#07110f]/10" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[.2em]">Built for decisions that cannot disappear</p>
              <h2 className="mt-5 max-w-4xl text-5xl font-black leading-[.92] tracking-[-.05em] md:text-8xl">Durable by design.<br /><span className="font-serif font-normal italic">Human at the center.</span></h2>
            </div>
            <p className="max-w-sm text-base leading-7 text-slate-900/75">Every transition is authenticated, auditable, reset-safe, and visible to the right role.</p>
          </div>
          <div className="mt-16 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stack.map(([service, job]) => (
              <div key={service} className="rounded-2xl border border-slate-950/15 bg-[#f8b28f]/45 p-6 backdrop-blur transition hover:-translate-y-1 hover:bg-[#f8b28f]/70">
                <p className="text-xs font-bold uppercase tracking-[.16em] text-slate-800/60">{job}</p>
                <p className="mt-8 text-2xl font-black">{service}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#07110f] px-5 py-24 md:px-8 md:py-32">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-orange-300">See the system think</p>
            <h2 className="mt-5 max-w-4xl text-5xl font-black leading-[.92] tracking-[-.05em] md:text-8xl">Trigger the heat.<br />Watch safety respond.</h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Link href="/ops" className="inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-orange-500 px-7 font-bold text-slate-950 transition hover:bg-orange-400">Open live operations <ArrowIcon /></Link>
            <Link href="/login" className="inline-flex min-h-14 items-center justify-center rounded-full border border-white/20 px-7 font-semibold transition hover:bg-white/5">Role-based sign in</Link>
          </div>
        </div>
        <footer className="mx-auto mt-24 flex max-w-7xl flex-wrap items-center justify-between gap-5 border-t border-white/10 pt-8 text-sm text-white/45">
          <Brand />
          <p>Heat safety and intelligent dispatch · AWS-native hackathon demo</p>
        </footer>
      </section>
    </main>
  );
}
