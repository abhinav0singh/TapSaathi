import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
  CognitoUserSession,
} from "amazon-cognito-identity-js";

const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;

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

export function signOut(): void {
  const user = getPool().getCurrentUser();
  user?.signOut();
}
