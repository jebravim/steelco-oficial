import { pool } from "../lib/database.js";
import { requireEmployee, sendAccessError } from "../lib/auth.js";

const authBaseUrl = process.env.NEON_AUTH_BASE_URL;
const siteOrigin = "https://steelco-oficial.vercel.app";

function readCookies(headers) {
  const values = typeof headers.getSetCookie === "function"
    ? headers.getSetCookie()
    : [headers.get("set-cookie")].filter(Boolean);

  return values
    .map((value) => value.split(";", 1)[0])
    .filter(Boolean)
    .join("; ");
}

async function requestJwt(email, password) {
  const signInResponse = await fetch(`${authBaseUrl}/sign-in/email`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Origin: siteOrigin,
    },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(8_000),
  });

  const signInData = await signInResponse.json().catch(() => null);
  if (!signInResponse.ok || !signInData?.user) return null;

  const responseToken = signInResponse.headers.get("set-auth-jwt");
  if (responseToken) return responseToken;

  const sessionToken = signInData.session?.token;
  if (typeof sessionToken === "string" && sessionToken.split(".").length === 3) {
    return sessionToken;
  }

  const cookie = readCookies(signInResponse.headers);
  if (!cookie) return null;

  const tokenResponse = await fetch(`${authBaseUrl}/token`, {
    headers: {
      Accept: "application/json",
      Cookie: cookie,
      Origin: siteOrigin,
    },
    signal: AbortSignal.timeout(8_000),
  });
  const tokenData = await tokenResponse.json().catch(() => null);
  const tokenHeader = tokenResponse.headers.get("set-auth-jwt");
  return tokenResponse.ok ? tokenHeader || tokenData?.token || null : null;
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Método não permitido." });
  }

  const email = String(request.body?.email || "").trim().toLowerCase();
  const password = String(request.body?.password || "");
  if (!email || email.length > 254 || password.length < 8 || password.length > 200) {
    return response.status(400).json({ error: "E-mail ou senha inválidos." });
  }

  try {
    const access = await pool.query(
      `SELECT 1
         FROM public.employee_access
        WHERE email = $1
          AND active = true
        LIMIT 1`,
      [email],
    );
    if (!access.rowCount) {
      return response.status(403).json({ error: "Esta conta não está autorizada como funcionário." });
    }

    const token = await requestJwt(email, password);
    if (!token) {
      return response.status(401).json({ error: "E-mail ou senha incorretos." });
    }

    const employee = await requireEmployee({
      headers: { authorization: `Bearer ${token}` },
    });

    return response.status(200).json({
      token,
      employee: {
        email: employee.email,
        name: employee.name,
      },
    });
  } catch (error) {
    if (error?.name === "AccessError") return sendAccessError(response, error);
    return response.status(502).json({ error: "Não foi possível concluir o login agora." });
  }
}
