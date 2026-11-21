import { requireEmployee, sendAccessError } from "../lib/auth.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Método não permitido." });
  }

  try {
    const employee = await requireEmployee(request);
    return response.status(200).json({
      employee: {
        email: employee.email,
        name: employee.name,
      },
    });
  } catch (error) {
    return sendAccessError(response, error);
  }
}
