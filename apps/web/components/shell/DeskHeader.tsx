import Link from "next/link";
import type { ReactNode } from "react";
import { AccountControls, NavLinks } from "@/components/AppNav";

/**
 * The strip across the top of every desk screen. On a phone the brand and sign-out share the first
 * row and the page links get their own row; from small screens up everything sits on one line.
 */
export default function DeskHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 bg-canvas/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[88rem] flex-wrap items-center gap-x-4 px-4 py-1.5 sm:px-6">
        <Link href="/" className="order-1 flex min-h-10 items-center gap-2.5 text-[1.0625rem] font-semibold tracking-tight">
          <span
            aria-hidden="true"
            lang="hi"
            className="grid size-8 place-items-center rounded-[0.6rem] bg-primary text-[1.0625rem] font-medium leading-none text-primary-foreground"
          >
            स
          </span>
          Sahara
        </Link>
        <div className="order-3 w-full min-w-0 sm:order-2 sm:w-auto sm:flex-1">
          <NavLinks />
        </div>
        <div className="order-2 ml-auto sm:order-3">
          <AccountControls />
        </div>
        {children}
      </div>
    </header>
  );
}
