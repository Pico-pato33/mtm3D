// Validación del cliente, número de pedido y mensaje de WhatsApp.

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function validateCustomer({ nombre = "", contacto = "" } = {}) {
  const errors = {};
  if (!String(nombre).trim()) errors.nombre = "Escribe tu nombre.";
  if (!String(contacto).trim()) errors.contacto = "Escribe un contacto (teléfono o Instagram).";
  return { ok: Object.keys(errors).length === 0, errors };
}

export function generateOrderNumber(now, rand = Math.random) {
  const two = (n) => String(n).padStart(2, "0");
  const date = `${two(now.getFullYear() % 100)}${two(now.getMonth() + 1)}${two(now.getDate())}`;
  let code = "";
  for (let i = 0; i < 4; i++) code += CHARS[Math.floor(rand() * CHARS.length)];
  return `MTM-${date}-${code}`;
}

const line = (i) => `${i.qty}x ${i.nombre}${i.color ? ` (${i.color})` : ""}`;

export function formatPieces(items) {
  return items.map(line).join("; ");
}

export function buildOrder({ numero, items, customer, now }) {
  return {
    numero,
    fecha: now.toISOString(),
    nombre: customer.nombre.trim(),
    contacto: customer.contacto.trim(),
    piezas: formatPieces(items),
    notas: (customer.notas ?? "").trim(),
  };
}

export function buildWhatsAppUrl(number, order) {
  const lines = [
    `Hola, soy ${order.nombre}. Quiero hacer el pedido ${order.numero}:`,
    ...order.piezas.split("; ").map((p) => `- ${p}`),
  ];
  if (order.notas) lines.push(`Notas: ${order.notas}`);
  const digits = String(number).replace(/\D/g, "");
  // Un emoji partido a la mitad haría fallar encodeURIComponent: se sustituye por �.
  const text = lines.join("\n");
  const wellFormed = typeof text.toWellFormed === "function" ? text.toWellFormed() : text;
  return `https://wa.me/${digits}?text=${encodeURIComponent(wellFormed)}`;
}

/**
 * Envía el pedido al Apps Script y devuelve true solo si la hoja confirma que lo guardó.
 * Se manda como text/plain (petición simple, sin preflight CORS) para poder leer la respuesta.
 */
export async function submitToSheet(endpoint, payload, fetchFn = fetch) {
  if (!endpoint) return false;
  try {
    const res = await fetchFn(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      signal: typeof AbortSignal?.timeout === "function" ? AbortSignal.timeout(10000) : undefined,
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.ok === true;
  } catch {
    return false;
  }
}
