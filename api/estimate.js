import { pool } from "../lib/database.js";

const SETTING_KEY = "steel_frame_m2";

function normalizeArea(value) {
  const area = Number(value);
  return Number.isFinite(area) && area > 0 && area <= 100_000
    ? Math.round(area * 100) / 100
    : null;
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Método não permitido." });
  }

  const area = normalizeArea(request.body?.area);
  if (area === null) {
    return response.status(400).json({ error: "Informe uma área válida entre 0 e 100.000 m²." });
  }

  try {
    const result = await pool.query(
      `SELECT square_meter_price
         FROM public.pricing_settings
        WHERE setting_key = $1`,
      [SETTING_KEY],
    );
    const price = Number(result.rows[0]?.square_meter_price);

    if (!Number.isFinite(price) || price <= 0) {
      return response.status(503).json({ error: "A estimativa está temporariamente indisponível." });
    }

    return response.status(200).json({
      area,
      total: Math.round(area * price * 100) / 100,
    });
  } catch {
    return response.status(503).json({ error: "A estimativa está temporariamente indisponível." });
  }
}
