import { requireEmployee, sendAccessError } from "../lib/auth.js";
import { pool } from "../lib/database.js";

const SETTING_KEY = "steel_frame_m2";

function normalizePrice(value) {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 && price <= 1_000_000
    ? Math.round(price * 100) / 100
    : null;
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method === "GET") {
    try {
      const result = await pool.query(
        `SELECT square_meter_price, updated_at
           FROM public.pricing_settings
          WHERE setting_key = $1`,
        [SETTING_KEY],
      );
      const row = result.rows[0];
      return response.status(200).json({
        price: row?.square_meter_price === null || row?.square_meter_price === undefined
          ? null
          : Number(row.square_meter_price),
        updatedAt: row?.updated_at || null,
      });
    } catch {
      return response.status(503).json({ error: "O valor do m² está temporariamente indisponível." });
    }
  }

  if (request.method === "PUT") {
    try {
      const employee = await requireEmployee(request);
      const price = normalizePrice(request.body?.price);

      if (price === null) {
        return response.status(400).json({ error: "Informe um valor por m² válido." });
      }

      const result = await pool.query(
        `UPDATE public.pricing_settings
            SET square_meter_price = $1,
                updated_at = now(),
                updated_by = $2
          WHERE setting_key = $3
        RETURNING square_meter_price, updated_at`,
        [price, employee.id, SETTING_KEY],
      );

      return response.status(200).json({
        price: Number(result.rows[0].square_meter_price),
        updatedAt: result.rows[0].updated_at,
      });
    } catch (error) {
      return sendAccessError(response, error);
    }
  }

  response.setHeader("Allow", "GET, PUT");
  return response.status(405).json({ error: "Método não permitido." });
}
