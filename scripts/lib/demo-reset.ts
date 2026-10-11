/** Pure helpers for scripts/reset-demo.ts. No network, no secrets, easy to test. */

export interface DashboardSnapshot {
  demoGeneration: number;
  workers: Array<{ workerId: string; state: string }>;
  tasks: Array<{ taskId: string; assigneeId?: string }>;
  activeInterventions: unknown[];
}

export interface CleanCheck {
  clean: boolean;
  problems: string[];
}

/** The opening state the demo reset restores: Ravi and Asha safe, delivery-001 with Ravi, nothing active. */
export function checkCleanState(dashboard: DashboardSnapshot): CleanCheck {
  const problems: string[] = [];
  const state = (workerId: string) => dashboard.workers.find((worker) => worker.workerId === workerId)?.state;

  if (dashboard.activeInterventions.length > 0) {
    problems.push(`${dashboard.activeInterventions.length} active intervention(s) are still open`);
  }
  if (state("ravi-001") !== "SAFE") problems.push(`Ravi is ${state("ravi-001") ?? "missing"}, expected SAFE`);
  if (state("asha-001") !== "SAFE") problems.push(`Asha is ${state("asha-001") ?? "missing"}, expected SAFE`);

  const delivery = dashboard.tasks.find((task) => task.taskId === "delivery-001");
  if (delivery?.assigneeId !== "ravi-001") {
    problems.push(`delivery-001 is with ${delivery?.assigneeId ?? "nobody"}, expected ravi-001`);
  }
  return { clean: problems.length === 0, problems };
}

export function describeState(dashboard: DashboardSnapshot): string {
  const workers = dashboard.workers.map((worker) => `${worker.workerId.replace("-001", "")}=${worker.state}`).join(", ");
  const delivery = dashboard.tasks.find((task) => task.taskId === "delivery-001")?.assigneeId ?? "nobody";
  return `generation ${dashboard.demoGeneration} | ${workers} | delivery-001 with ${delivery} | ${dashboard.activeInterventions.length} active`;
}

export interface CliOptions {
  mode: "reset" | "check";
  yes: boolean;
  force: boolean;
  help: boolean;
  username: string | undefined;
  errors: string[];
}

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { mode: "reset", yes: false, force: false, help: false, username: undefined, errors: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === "--check") options.mode = "check";
    else if (arg === "--yes" || arg === "-y") options.yes = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--user") {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) options.errors.push("--user needs a username");
      else {
        options.username = value;
        index += 1;
      }
    } else options.errors.push(`Unknown option: ${arg}`);
  }
  return options;
}
