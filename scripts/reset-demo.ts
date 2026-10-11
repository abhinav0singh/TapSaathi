/**
 * Reset the shared Sahara demo to its clean opening state, or just check it.
 *
 *   npm run demo:status            read-only: is the demo clean? (no sign-in needed)
 *   npm run demo:reset             sign in as the operator and reset (asks to confirm)
 *   npm run demo:reset -- --yes    reset without the confirmation question
 *
 * Credentials are never stored or printed. Use one of:
 *   - the hidden prompt (default, interactive terminals);
 *   - OPERATOR_PASSWORD (and optionally OPERATOR_USERNAME) in the environment;
 *   - OPERATOR_ACCESS_TOKEN, a current Cognito access token, to skip sign-in.
 * The account must be in the OPERATOR group (the demo-operator account).
 */
import readline from "node:readline";
import { AuthenticationDetails, CognitoUser, CognitoUserPool } from "amazon-cognito-identity-js";
import { checkCleanState, describeState, parseArgs, type DashboardSnapshot } from "./lib/demo-reset.js";

const API_URL = (process.env["API_URL"] ?? "https://fkysuwgzb8.execute-api.ap-south-1.amazonaws.com").replace(/\/$/, "");
// Public identifiers (also in apps/web/.env.example); override with the environment if the pool changes.
const USER_POOL_ID = process.env["COGNITO_USER_POOL_ID"] ?? "ap-south-1_cgIO5dxFX";
const CLIENT_ID = process.env["COGNITO_CLIENT_ID"] ?? "2uncftp6ql3a84krgskgrdoq11";

const HELP = `Usage: npm run demo:reset -- [--check] [--yes] [--force] [--user <name>]

  --check        only report whether the demo is clean (no sign-in). Exit 0 clean, 2 not clean.
  --yes, -y      do not ask for confirmation before resetting
  --force        reset even if the demo already looks clean
  --user <name>  operator username (default: OPERATOR_USERNAME or demo-operator)

Environment: API_URL, OPERATOR_USERNAME, OPERATOR_PASSWORD, OPERATOR_ACCESS_TOKEN.`;

function fail(message: string, code = 1): never {
  console.error(message);
  process.exit(code);
}

async function getJson(path: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${API_URL}${path}`, { ...init, signal: AbortSignal.timeout(30_000) });
  const body: unknown = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

async function readDashboard(): Promise<DashboardSnapshot> {
  const { status, body } = await getJson("/dashboard");
  const dashboard = body as Partial<DashboardSnapshot>;
  if (status !== 200 || typeof dashboard.demoGeneration !== "number" || !Array.isArray(dashboard.workers) || !Array.isArray(dashboard.tasks) || !Array.isArray(dashboard.activeInterventions)) {
    fail(`Could not read the demo dashboard (HTTP ${status}). Is ${API_URL} reachable?`);
  }
  return dashboard as DashboardSnapshot;
}

function prompt(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const writer = rl as unknown as { _writeToOutput: (text: string) => void };
    const original = writer._writeToOutput.bind(rl);
    process.stdout.write(question);
    if (hidden) writer._writeToOutput = () => undefined; // do not echo the typed characters
    rl.question("", (answer) => {
      writer._writeToOutput = original;
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

function signIn(username: string, password: string): Promise<string> {
  const pool = new CognitoUserPool({ UserPoolId: USER_POOL_ID, ClientId: CLIENT_ID });
  const user = new CognitoUser({ Username: username, Pool: pool });
  return new Promise((resolve, reject) => {
    user.authenticateUser(new AuthenticationDetails({ Username: username, Password: password }), {
      onSuccess: (session) => resolve(session.getAccessToken().getJwtToken()),
      onFailure: (error: Error) => reject(error),
      newPasswordRequired: () => reject(new Error("This account must set a new password before it can be used (FORCE_CHANGE_PASSWORD).")),
    });
  });
}

async function accessToken(username: string): Promise<string> {
  const supplied = process.env["OPERATOR_ACCESS_TOKEN"];
  if (supplied) return supplied;

  let password = process.env["OPERATOR_PASSWORD"];
  if (!password) {
    if (!process.stdin.isTTY) fail("No credentials: set OPERATOR_ACCESS_TOKEN or OPERATOR_PASSWORD, or run this in an interactive terminal.");
    password = await prompt(`Password for ${username}: `, true);
  }
  if (!password) fail("A password is required.");
  try {
    return await signIn(username, password);
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    const message = error instanceof Error ? error.message : String(error);
    return fail(`Sign-in failed (${name}): ${message}`);
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return console.log(HELP);
  if (options.errors.length > 0) fail(`${options.errors.join("\n")}\n\n${HELP}`);

  const before = await readDashboard();
  const beforeCheck = checkCleanState(before);
  console.log(`Demo now:  ${describeState(before)}`);
  console.log(beforeCheck.clean ? "Status:    clean" : `Status:    NOT clean - ${beforeCheck.problems.join("; ")}`);

  if (options.mode === "check") process.exit(beforeCheck.clean ? 0 : 2);
  if (beforeCheck.clean && !options.force) return console.log("Nothing to do. Use --force to reset anyway.");

  if (!options.yes) {
    if (!process.stdin.isTTY) fail("Refusing to reset without --yes in a non-interactive shell.");
    const answer = await prompt(`This resets the SHARED demo (generation ${before.demoGeneration}) for everyone. Type "reset" to continue: `);
    if (answer !== "reset") fail("Cancelled. Nothing was changed.");
  }

  const username = options.username ?? process.env["OPERATOR_USERNAME"] ?? "demo-operator";
  const token = await accessToken(username);

  const { status, body } = await getJson("/demo/reset", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: "{}",
  });
  if (status !== 200 && status !== 202) {
    const error = (body as { error?: { code?: string; message?: string } }).error;
    const hint = status === 401 ? " (sign-in not accepted)" : status === 403 ? " (this account is not an operator)" : status === 409 ? " (a reset may already be running; wait about 90 seconds)" : "";
    fail(`Reset failed: HTTP ${status}${hint}${error?.code ? ` ${error.code}: ${error.message ?? ""}` : ""}`);
  }
  const result = body as { status?: string; demoGeneration?: number };
  if (result.status !== "RESET_COMPLETE" || typeof result.demoGeneration !== "number") fail("The API answered, but not with RESET_COMPLETE. Check the dashboard before relying on it.");
  console.log(`Reset accepted: generation ${result.demoGeneration}`);

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const after = await readDashboard();
    const check = checkCleanState(after);
    if (check.clean && after.demoGeneration === result.demoGeneration) {
      console.log(`Demo now:  ${describeState(after)}`);
      return console.log("Status:    clean. The shared demo is ready.");
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  fail("The reset was accepted, but the dashboard did not show a clean state in time. Run npm run demo:status again in a few seconds.", 2);
}

main().catch((error: unknown) => fail(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`));
