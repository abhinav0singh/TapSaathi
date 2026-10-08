import Link from "next/link";

export default async function WorkerPage({
  params,
}: {
  params: Promise<{ workerId: string }>;
}) {
  const { workerId } = await params;

  return (
    <main className="min-h-screen bg-[#f5f7fb] p-5">
      <div className="mx-auto max-w-md">
        <Link href="/ops" className="text-sm text-slate-600">
          ← Operations
        </Link>
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-orange-600">
            TAAPSAATHI
          </p>
          <h1 className="mt-3 text-2xl font-bold">
            Rider safety
          </h1>
          <p className="mt-3 text-slate-600">
            Worker: {workerId}
          </p>
          <p className="mt-5 text-sm text-slate-500">
            Live intervention guidance and worker actions
            will be added in the next implementation stage.
          </p>
        </section>
      </div>
    </main>
  );
}
