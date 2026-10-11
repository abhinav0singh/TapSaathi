import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-6">
      <div className="max-w-sm text-center">
        <h1 className="text-[1.5rem] font-semibold tracking-tight">This page does not exist</h1>
        <p className="mt-2 text-[1rem] leading-relaxed text-label-2">
          The link may be old or mistyped. You can head back to the walkthrough or open the operations workspace.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/" className={buttonVariants({ size: "lg" })}>Back to start</Link>
          <Link href="/ops" className={buttonVariants({ variant: "secondary", size: "lg" })}>Open operations workspace</Link>
        </div>
      </div>
    </main>
  );
}
