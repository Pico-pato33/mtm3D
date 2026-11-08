// Selección del cliente ("Mi selección"), guardada en el navegador.

const MAX_QTY = 99;

export function createCart(storage, key = "mtm3d.cart") {
  let list = load();

  function load() {
    try {
      const parsed = JSON.parse(storage?.getItem(key) ?? "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (i) => i && typeof i.id === "string" && typeof i.nombre === "string" && Number.isInteger(i.qty),
      );
    } catch {
      return [];
    }
  }

  function save() {
    try {
      storage?.setItem(key, JSON.stringify(list));
    } catch {
      // Sin almacenamiento (modo privado, lleno): la selección sigue en memoria.
    }
  }

  const find = (id) => list.find((i) => i.id === id);

  return {
    items: () => list.map((i) => ({ ...i })),
    count: () => list.reduce((sum, i) => sum + i.qty, 0),
    add(piece) {
      const existing = find(piece.id);
      if (existing) existing.qty = Math.min(existing.qty + 1, MAX_QTY);
      else list.push({ id: piece.id, nombre: piece.nombre, qty: 1, color: piece.colores?.[0] ?? "" });
      save();
    },
    setQty(id, qty) {
      const item = find(id);
      const blank = qty === null || (typeof qty === "string" && qty.trim() === "");
      const n = blank ? NaN : Number(qty);
      if (!item || !Number.isFinite(n)) return;
      const whole = Math.floor(n);
      if (whole < 1) list = list.filter((i) => i.id !== id);
      else item.qty = Math.min(whole, MAX_QTY);
      save();
    },
    setColor(id, color) {
      const item = find(id);
      if (item) {
        item.color = String(color);
        save();
      }
    },
    remove(id) {
      list = list.filter((i) => i.id !== id);
      save();
    },
    clear() {
      list = [];
      save();
    },
    // Si el color guardado ya no existe en el catálogo, pasa al primero disponible (o vacío).
    normalizeColors(pieces) {
      for (const item of list) {
        const colores = pieces.find((p) => p.id === item.id)?.colores ?? [];
        if (!colores.includes(item.color)) item.color = colores[0] ?? "";
      }
      save();
    },
    pruneTo(ids) {
      list = list.filter((i) => ids.includes(i.id));
      save();
    },
  };
}
