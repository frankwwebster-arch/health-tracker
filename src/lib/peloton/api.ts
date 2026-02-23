import "server-only";

export const PELOTON_BASE_URL = "https://api.onepeloton.com";

interface PelotonLoginResponse {
  user_id?: string;
  session_id?: string;
}

export interface PelotonCredentialsInput {
  username: string;
  password: string;
}

export interface PelotonSession {
  userId: string;
  sessionId: string;
}

export class PelotonApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PelotonApiError";
    this.status = status;
  }
}

export async function createPelotonSession(
  credentials: PelotonCredentialsInput
): Promise<PelotonSession> {
  const response = await fetch(`${PELOTON_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username_or_email: credentials.username,
      password: credentials.password,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new PelotonApiError(
      `Peloton login failed (${response.status})`,
      response.status
    );
  }

  const payload = (await response.json()) as PelotonLoginResponse;
  if (!payload.user_id || !payload.session_id) {
    throw new PelotonApiError(
      "Peloton login response missing user/session data",
      502
    );
  }

  return {
    userId: payload.user_id,
    sessionId: payload.session_id,
  };
}

