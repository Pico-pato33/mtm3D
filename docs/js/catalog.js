// Lectura del catálogo (CSV de Google Sheets), búsqueda y categorías.

/** Lector CSV por estados: soporta comillas dobles, comas y saltos de línea dentro de campos. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

const plain = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

const list = (s) =>
  String(s ?? "")
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean);

/** Devuelve solo las piezas activas del catálogo. */
export function parseCatalogCsv(text) {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  const col = {};
  header.forEach((h, i) => {
    col[plain(h).replace(/_/g, "")] = i;
  });
  const get = (r, name) => (r[col[name]] ?? "").trim();

  return rows
    .map((r) => ({
      id: get(r, "id"),
      nombre: get(r, "nombre"),
      categoria: get(r, "categoria"),
      fotos: list(get(r, "fotos")),
      descripcion: get(r, "descripcion"),
      tamano: get(r, "tamano"),
      colores: list(get(r, "colores")),
      precio: get(r, "precio"),
      autor: get(r, "autor"),
      licencia: get(r, "licencia"),
      enlaceOriginal: get(r, "enlaceoriginal"),
      activa: ["si", "true", "1"].includes(plain(get(r, "activa"))),
    }))
    .filter((p) => p.id && p.nombre && p.activa)
    .map(({ activa, ...piece }) => piece);
}

export function filterPieces(pieces, { query = "", category = "" } = {}) {
  const q = plain(query);
  return pieces.filter(
    (p) =>
      (!category || p.categoria === category) &&
      (!q || plain(p.nombre).includes(q) || plain(p.descripcion).includes(q)),
  );
}

export function categoriesOf(pieces) {
  return [...new Set(pieces.map((p) => p.categoria).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );
}
