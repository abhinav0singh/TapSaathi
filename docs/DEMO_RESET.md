# Resetting the shared demo

The Operations page shows **Sandbox controls** (Reset demo and Start heat spike) to a signed-in operator or supervisor only; the public landing page is a local walkthrough and has no such controls. This script does the same reset from a terminal, which is useful when the website is unavailable or you want a scripted check. A reset is needed, for example, after an alert ends without a supervisor acknowledgement and leaves Ravi in `AWAITING_SUPERVISOR`, because a spike is skipped while Ravi is in that state.

## Commands

```bash
npm run demo:status
```

Read-only. Needs no sign-in. Prints the current generation and whether the demo is clean. Exit code `0` = clean, `2` = not clean.

```bash
npm run demo:reset
```

Signs in as `demo-operator`, asks you to type `reset`, calls `POST /demo/reset`, then re-reads the dashboard until it shows the clean state.

Useful options (after `--`): `--yes` skips the question, `--force` resets even if the demo already looks clean, `--user <name>` signs in as a different operator, `--check` is what `demo:status` runs.

## Credentials

Nothing is stored or printed. The script uses the first of these it finds:

1. `OPERATOR_ACCESS_TOKEN`: a current Cognito access token, used as is.
2. `OPERATOR_PASSWORD` (and optionally `OPERATOR_USERNAME`, default `demo-operator`) in the environment.
3. A hidden password prompt, in an interactive terminal.

The prompt is the safest choice: environment variables set inline can end up in shell history. The account must be in the `OPERATOR` or `SUPERVISOR` Cognito group, that is `demo-operator` or `demo-neha` (`--user demo-neha`). Supervisor access only works once the backend change that allows it has been deployed; until then the API answers `403` for `demo-neha` and only `demo-operator` can reset or start a spike. `API_URL`, `COGNITO_USER_POOL_ID` and `COGNITO_CLIENT_ID` default to the deployed values and can be overridden.

## What "clean" means

No active interventions, Ravi `SAFE`, Asha `SAFE`, and `delivery-001` assigned to Ravi. Imran's `CAUTION` is part of the opening state.

## Safety notes

- The reset affects **everyone** using the shared demo and starts a new generation. Do not run it while someone is mid-test or while a judge may be using the sandbox.
- It refuses to run without `--yes` in a non-interactive shell, and refuses before any request if no credentials are available.
- A `409` means a reset may already be running; wait about 90 seconds and run `npm run demo:status`.
- `401` means the sign-in was not accepted; `403` means the account is not an operator or supervisor (or, before the backend change is deployed, that it is the supervisor).

## Verification status

Tested locally: the status check against the live demo (it correctly reports the stuck state with exit code 2), the help and refusal paths, the clean-state and argument logic (8 unit tests), and the Cognito sign-in path with deliberately fake credentials (Cognito answered `NotAuthorizedException`, and no reset request was sent). **Not tested:** a full sign-in with real operator credentials followed by a real reset, because that needs the operator password. Run it once yourself and confirm `demo:status` ends `clean` before relying on it.
