import { createRemoteJWKSet, jwtVerify } from "jose";
import { pool } from "./database.js";

const authBaseUrl = process.env.NEON_AUTH_BASE_URL;
const jwksUrl = process.env.NEON_AUTH_JWKS_URL;

if (!authBaseUrl || !jwksUrl) {
  throw new Error("Configuração do Neon Auth ausente.");
}

const jwks = createRemoteJWKSet(new URL(jwksUrl));
const issuer = new URL(authBaseUrl).origin;

export class AccessError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "AccessError";
    this.status = status;
  }
}

function readBearerToken(request) {
  const authorization = request.headers.authorization || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

export async function requireEmployee(request) {
  const token = readBearerToken(request);
  if (!token) {
    throw new AccessError("Faça login para continuar.", 401);
  }

  let payload;
  try {
    ({ payload } = await jwtVerify(token, jwks, { issuer }));
  } catch {
    throw new AccessError("Sua sessão expirou. Entre novamente.", 401);
  }

  if (!payload.sub) {
    throw new AccessError("Sessão inválida.", 401);
  }

  const result = await pool.query(
    `SELECT u.id, u.email, u.name
       FROM neon_auth."user" AS u
       JOIN public.employee_access AS employee
         ON employee.email = lower(u.email)
        AND employee.active = true
      WHERE u.id = $1
      LIMIT 1`,
    [payload.sub],
  );

  if (!result.rowCount) {
    throw new AccessError("Esta conta não está autorizada como funcionário.", 403);
  }

  return result.rows[0];
}

export function sendAccessError(response, error) {
  const status = error instanceof AccessError ? error.status : 500;
  const message = error instanceof AccessError
    ? error.message
    : "Não foi possível validar o acesso agora.";

  response.status(status).json({ error: message });
}
