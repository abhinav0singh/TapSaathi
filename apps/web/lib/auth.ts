import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
  CognitoUserSession,
} from "amazon-cognito-identity-js";

const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
const identityMapValue = process.env.NEXT_PUBLIC_COGNITO_IDENTITY_MAP;

export type AuthenticatedIdentity = {
  username: string;
  groups: string[];
  actorId?: string;
};

let cachedPool: CognitoUserPool | null = null;

function getPool(): CognitoUserPool {
  if (typeof window === "undefined") {
    throw new Error("Authentication is available only in the browser.");
  }

  if (!userPoolId || !clientId) {
    throw new Error("Cognito configuration is missing.");
  }

  if (!cachedPool) {
    cachedPool = new CognitoUserPool({
      UserPoolId: userPoolId,
      ClientId: clientId,
    });
  }

  return cachedPool;
}

export function signIn(
  username: string,
  password: string
): Promise<CognitoUserSession> {
  return new Promise((resolve, reject) => {
    if (!username.trim() || !password) {
      reject(new Error("Username and password are required."));
      return;
    }

    let user: CognitoUser;

    try {
      user = new CognitoUser({
        Username: username.trim(),
        Pool: getPool(),
      });
    } catch (error) {
      reject(error);
      return;
    }

    const authentication = new AuthenticationDetails({
      Username: username.trim(),
      Password: password,
    });

    user.authenticateUser(authentication, {
      onSuccess: (session) => resolve(session),
      onFailure: (error) => reject(error),

      newPasswordRequired: () => {
        reject(
          new Error(
            "This account requires initial password setup. Contact the demo administrator."
          )
        );
      },
    });
  });
}

export function getCurrentSession(): Promise<CognitoUserSession | null> {
  return new Promise((resolve, reject) => {
    let user: CognitoUser | null;

    try {
      user = getPool().getCurrentUser();
    } catch (error) {
      reject(error);
      return;
    }

    if (!user) {
      resolve(null);
      return;
    }

    user.getSession(
      (error: Error | null, session: CognitoUserSession | null) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(session?.isValid() ? session : null);
      }
    );
  });
}

export async function getAccessToken(): Promise<string> {
  const session = await getCurrentSession();

  if (!session) {
    throw new Error("Please sign in to continue.");
  }

  return session.getAccessToken().getJwtToken();
}

function groupsFrom(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((group): group is string => typeof group === "string");
  }

  if (typeof value !== "string") return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((group): group is string => typeof group === "string");
    }
  } catch {
    // Cognito can serialize the group claim as comma-separated text.
  }

  return value
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((group) => group.trim())
    .filter(Boolean);
}

function identityMap(): Record<string, string> {
  if (!identityMapValue) return {};

  try {
    const parsed: unknown = JSON.parse(identityMapValue);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] =>
          typeof entry[0] === "string" && typeof entry[1] === "string"
      )
    );
  } catch {
    return {};
  }
}

export function identityFromSession(session: CognitoUserSession): AuthenticatedIdentity {
  const claims = session.getAccessToken().decodePayload() as Record<string, unknown>;
  const username = claims.username ?? claims["cognito:username"];

  if (typeof username !== "string" || !username) {
    throw new Error("The Cognito session does not contain a username.");
  }

  return {
    username,
    groups: groupsFrom(claims["cognito:groups"]),
    actorId: identityMap()[username],
  };
}

export async function getAuthenticatedIdentity(): Promise<AuthenticatedIdentity | null> {
  const session = await getCurrentSession();
  return session ? identityFromSession(session) : null;
}

export function signOut(): void {
  const user = getPool().getCurrentUser();
  user?.signOut();
}

export type Role = "OPERATOR" | "SUPERVISOR" | "WORKER";

export function hasRole(identity: AuthenticatedIdentity, role: Role): boolean {
  return identity.groups.includes(role);
}

/**
 * Single source of truth for where a signed-in user belongs.
 * Throws a user-readable error when the account cannot be mapped.
 */
export function destinationForIdentity(identity: AuthenticatedIdentity): string {
  if (hasRole(identity, "OPERATOR")) return "/ops";

  if (hasRole(identity, "SUPERVISOR")) {
    if (!identity.actorId) {
      throw new Error("Supervisor identity mapping is missing. Contact the demo administrator.");
    }
    return "/supervisor";
  }

  if (hasRole(identity, "WORKER")) {
    if (!identity.actorId) {
      throw new Error("Worker identity mapping is missing. Contact the demo administrator.");
    }
    return `/worker/${encodeURIComponent(identity.actorId)}`;
  }

  throw new Error("This account is not assigned to a TaapSaathi role.");
}
