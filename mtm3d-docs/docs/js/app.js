import { STORE_NAME, WHATSAPP_NUMBER, CATALOG_CSV_URL, ORDERS_ENDPOINT } from "./config.js";
import { parseCatalogCsv, filterPieces, categoriesOf } from "./catalog.js";
import { createCart } from "./cart.js";
import { validateCustomer, generateOrderNumber, buildOrder, buildWhatsAppUrl, submitToSheet } from "./order.js";

const $ = (id) => document.getElementById(id);

// Todo el contenido que viene de la hoja se inserta con textContent, nunca con innerHTML.
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) el.append(c);
  return el;
}

const safeUrl = (u) => (/^https?:\/\//i.test(u) ? u : "");

let storage = null;
try {
  storage = window.localStorage;
} catch {
  storage = null;
}
const cart = createCart(storage);

let pieces = [];
const filters = { query: "", category: "" };
let lastFocus = null;

// ---------- Catálogo ----------
async function loadCatalog() {
  setStatus("Cargando catálogo…");
  try {
    const res = await fetch(CATALOG_CSV_URL || "data/catalogo-ejemplo.csv", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    pieces = parseCatalogCsv(await res.text());
    cart.pruneTo(pieces.map((p) => p.id));
    cart.normalizeColors(pieces);
    fillCategories();
    renderGrid();
    renderCart();
  } catch {
    pieces = [];
    $("grid").replaceChildren();
    $("status").className = "status error";
    $("status").replaceChildren(
      "No se ha podido cargar el catálogo. Inténtalo de nuevo en unos minutos. ",
      h("button", { class: "btn btn-light", type: "button", onclick: loadCatalog }, "Reintentar"),
    );
    renderCart();
  }
}

function setStatus(text) {
  $("status").className = "status";
  $("status").textContent = text;
}

function fillCategories() {
  const select = $("category");
  select.replaceChildren(h("option", { value: "" }, "Todas las categorías"));
  for (const c of categoriesOf(pieces)) select.append(h("option", { value: c }, c));
  select.value = filters.category;
}

function renderGrid() {
  const shown = filterPieces(pieces, filters);
  const grid = $("grid");
  grid.replaceChildren(...shown.map(card));
  if (pieces.length === 0) setStatus("Aún no hay piezas disponibles.");
  else if (shown.length === 0) setStatus("No hay piezas con ese filtro.");
  else setStatus("");
}

function thumb(piece) {
  const src = safeUrl(piece.fotos[0] ?? "");
  return src
    ? h("img", { class: "thumb", src, alt: piece.nombre, loading: "lazy" })
    : h("div", { class: "thumb", "aria-hidden": "true" }, "3D");
}

function card(piece) {
  return h(
    "button",
    { class: "card", type: "button", onclick: () => openPiece(piece) },
    thumb(piece),
    h(
      "div",
      { class: "card-body" },
      h("div", { class: "card-name" }, piece.nombre),
      h("div", { class: "card-meta" }, piece.precio || "A consultar"),
    ),
  );
}

// ---------- Ficha de pieza ----------
function openPiece(piece) {
  lastFocus = document.activeElement;
  const dialog = $("piece-dialog");
  const fotos = piece.fotos.map(safeUrl).filter(Boolean);
  const link = safeUrl(piece.enlaceOriginal);
  const facts = [
    piece.tamano && `Tamaño: ${piece.tamano}`,
    piece.colores.length > 0 && `Colores: ${piece.colores.join(", ")}`,
    `Precio: ${piece.precio || "A consultar"}`,
  ].filter(Boolean);

  const credit = h(
    "p",
    { class: "credit" },
    `Diseño de ${piece.autor || "autor desconocido"}`,
    piece.licencia ? ` · Licencia ${piece.licencia}` : "",
    link ? [" · ", h("a", { href: link, target: "_blank", rel: "noopener noreferrer" }, "Ver modelo original")] : "",
  );

  $("piece-body").replaceChildren(
    h(
      "div",
      { class: "dialog-inner" },
      h("div", { class: "gallery" },
        fotos.length > 0
          ? fotos.map((src) => h("img", { src, alt: piece.nombre, loading: "lazy" }))
          : h("div", { class: "thumb", "aria-hidden": "true" }, "3D")),
      h("h2", { id: "piece-title" }, piece.nombre),
      piece.descripcion ? h("p", {}, piece.descripcion) : "",
      h("ul", { class: "facts" }, facts.map((f) => h("li", {}, f))),
      credit,
      h(
        "div",
        { class: "row" },
        h("button", { class: "btn btn-light", type: "button", onclick: () => dialog.close() }, "Cerrar"),
        h("button", {
          class: "btn btn-primary", type: "button",
          onclick: () => { cart.add(piece); renderCart(); dialog.close(); openCart(); },
        }, "Añadir a mi selección"),
      ),
    ),
  );
  dialog.showModal();
}

// ---------- Selección ----------
function openCart() {
  lastFocus = document.activeElement;
  $("overlay").hidden = false;
  const panel = $("cart-panel");
  panel.classList.add("open");
  panel.setAttribute("aria-hidden", "false");
  $("close-cart").focus();
}

function closeCart() {
  $("overlay").hidden = true;
  const panel = $("cart-panel");
  panel.classList.remove("open");
  panel.setAttribute("aria-hidden", "true");
  lastFocus?.focus?.();
}

function renderCart() {
  $("cart-count").textContent = String(cart.count());
  const items = cart.items();
  const box = $("cart-content");

  if (items.length === 0) {
    box.replaceChildren(h("p", {}, "Todavía no has marcado ninguna pieza. Elige las que te gusten del catálogo."));
    return;
  }

  const list = items.map((item) => {
    const piece = pieces.find((p) => p.id === item.id);
    const colors = piece?.colores ?? [];
    return h(
      "div",
      { class: "cart-item" },
      h("div", { class: "cart-item-top" }, item.nombre),
      h(
        "div",
        { class: "cart-item-controls" },
        h("input", {
          type: "number", min: "1", max: "99", value: String(item.qty), "aria-label": `Cantidad de ${item.nombre}`,
          onchange: (e) => { cart.setQty(item.id, e.target.value); renderCart(); },
        }),
        colors.length > 0
          ? h("select", {
              "aria-label": `Color de ${item.nombre}`,
              onchange: (e) => cart.setColor(item.id, e.target.value),
            }, colors.map((c) => h("option", { value: c, selected: c === item.color }, c)))
          : h("span", {}),
        h("button", {
          class: "btn btn-ghost", type: "button", "aria-label": `Quitar ${item.nombre}`,
          onclick: () => { cart.remove(item.id); renderCart(); },
        }, "Quitar"),
      ),
    );
  });

  const form = h(
    "form",
    { class: "form", novalidate: true, onsubmit: submitOrder },
    h("div", { class: "field" },
      h("label", { for: "f-nombre" }, "Tu nombre"),
      h("input", { id: "f-nombre", name: "nombre", autocomplete: "name", maxlength: "100" }),
      h("div", { class: "field-error", id: "e-nombre" })),
    h("div", { class: "field" },
      h("label", { for: "f-contacto" }, "Contacto (teléfono o Instagram)"),
      h("input", { id: "f-contacto", name: "contacto", autocomplete: "tel", maxlength: "100" }),
      h("div", { class: "field-error", id: "e-contacto" })),
    h("div", { class: "field" },
      h("label", { for: "f-notas" }, "Notas (opcional)"),
      h("textarea", { id: "f-notas", name: "notas", rows: "3", maxlength: "500" })),
    h("div", { class: "hp", "aria-hidden": "true" },
      h("label", { for: "f-website" }, "No rellenar"),
      h("input", { id: "f-website", name: "website", tabindex: "-1", autocomplete: "off" })),
    h("button", { class: "btn btn-primary", type: "submit" }, "Enviar pedido"),
    h("p", { class: "credit" }, "Al enviar se abrirá WhatsApp con el resumen. Te confirmo precio y plazo por ahí."),
  );

  box.replaceChildren(...list, form);
}

// ---------- Envío ----------
async function submitOrder(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const customer = {
    nombre: form.nombre.value,
    contacto: form.contacto.value,
    notas: form.notas.value,
  };
  const check = validateCustomer(customer);
  $("e-nombre").textContent = check.errors.nombre ?? "";
  $("e-contacto").textContent = check.errors.contacto ?? "";
  if (!check.ok) {
    (check.errors.nombre ? form.nombre : form.contacto).focus();
    return;
  }

  const items = cart.items();
  if (items.length === 0) return;
  const now = new Date();
  const order = buildOrder({ numero: generateOrderNumber(now), items, customer, now });
  const waUrl = buildWhatsAppUrl(WHATSAPP_NUMBER, order);

  form.querySelector("button[type=submit]").disabled = true;

  // WhatsApp se abre siempre y antes de esperar a la hoja, para que el navegador no bloquee la ventana.
  const popup = window.open(waUrl, "_blank");
  if (popup) popup.opener = null;

  const saved = await submitToSheet(ORDERS_ENDPOINT, { ...order, website: form.website.value });

  showConfirmation(order, waUrl, saved, popup);
  cart.clear();
  $("cart-count").textContent = "0";
}

function showConfirmation(order, waUrl, saved, popup) {
  $("cart-content").replaceChildren(
    h(
      "div",
      { class: "confirm" },
      h("h2", {}, "¡Pedido preparado!"),
      h("p", {}, "Tu número de pedido es ", h("span", { class: "code" }, order.numero), "."),
      h("p", {}, order.piezas),
      saved
        ? ""
        : h("div", { class: "notice", role: "alert" },
            "No hemos podido registrar el pedido automáticamente. Envía el mensaje de WhatsApp para que lo recibamos."),
      popup
        ? h("p", {}, "Se ha abierto WhatsApp. Pulsa enviar para que me llegue tu pedido.")
        : h("p", {}, "Pulsa el botón para abrir WhatsApp y enviar tu pedido."),
      h("a", { class: "btn btn-primary", href: waUrl, target: "_blank", rel: "noopener noreferrer" }, "Abrir WhatsApp"),
      h("p", {}, h("button", { class: "btn btn-light", type: "button", onclick: closeCart }, "Volver al catálogo")),
    ),
  );
}

// ---------- Arranque ----------
document.title = `${STORE_NAME} · Piezas impresas en 3D bajo pedido`;
$("search").addEventListener("input", (e) => { filters.query = e.target.value; renderGrid(); });
$("category").addEventListener("change", (e) => { filters.category = e.target.value; renderGrid(); });
$("open-cart").addEventListener("click", openCart);
$("close-cart").addEventListener("click", closeCart);
$("overlay").addEventListener("click", closeCart);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && $("cart-panel").classList.contains("open")) closeCart();
});
$("piece-dialog").addEventListener("close", () => {
  if (!$("cart-panel").classList.contains("open")) lastFocus?.focus?.();
});

renderCart();
loadCatalog();
