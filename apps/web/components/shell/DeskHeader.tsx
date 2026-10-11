import Link from "next/link";
import type { ReactNode } from "react";
import AppNav from "@/components/AppNav";

/** The strip across the top of every desk screen. Quiet: a mark, the nav, nothing else. */
export default function DeskHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 bg-canvas/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[88rem] flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2 sm:px-6">
        <Link href="/" className="flex min-h-10 items-center gap-2.5 text-[1.0625rem] font-semibold tracking-tight">
          <span
            aria-hidden="true"
            lang="hi"
            className="grid size-8 place-items-center rounded-[0.6rem] bg-primary text-[1.0625rem] font-medium leading-none text-primary-foreground"
          >
            त
          </span>
          TaapSaathi
        </Link>
        <div className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
          <AppNav />
        </div>
        {children}
      </div>
    </header>
  );
}
