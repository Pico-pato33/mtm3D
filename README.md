# mtm_3D

Web para vender piezas impresas en 3D bajo pedido. El cliente marca piezas, envía el pedido (queda guardado en una hoja de Google y se abre WhatsApp) y tú lo gestionas desde la hoja. Coste: 0 €.

- Diseño: `docs/superpowers/specs/2026-11-08-tienda-3d-design.md`
- Plan de construcción: `docs/superpowers/plans/2026-11-08-tienda-3d.md`

## Probar en local

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

Con `CATALOG_CSV_URL` vacío en `js/config.js`, la web usa `data/catalogo-ejemplo.csv`. Con `ORDERS_ENDPOINT` vacío, los pedidos no se guardan en la hoja (WhatsApp se abre igualmente y la web avisa).

Tests: `npm test` (necesita Node 20 o superior).

## Puesta en marcha

### 1. Crear la hoja de Google

Crea una hoja de cálculo con dos pestañas.

**`Catálogo`**: en la fila 1, estas cabeceras exactas:

```
id | nombre | categoría | fotos | descripción | tamaño | colores | precio | autor | licencia | enlace_original | activa
```

- `fotos` y `colores`: varios valores separados por `|` (por ejemplo `negro|rojo`).
- `fotos`: enlaces directos a fotos tuyas de las piezas (empiezan por `https://`).
- `precio`: una cifra con su unidad (`4 €`) o `A consultar`.
- `activa`: `sí` para mostrarla, `no` para ocultarla sin borrarla.
- Solo publica modelos cuya licencia permita uso comercial. Rellena `autor`, `licencia` y `enlace_original` de cada uno.

**`Pedidos`**: en la fila 1:

```
número | fecha | nombre | contacto | piezas | notas | estado
```

En la columna `estado`, selecciona la columna entera → Datos → Validación de datos → Lista de elementos: `nuevo, confirmado, imprimiendo, listo, entregado, cancelado`.

### 2. Publicar el catálogo

En la hoja: Archivo → Compartir → Publicar en la web → elige la pestaña `Catálogo` y el formato **Valores separados por comas (.csv)** → Publicar. Copia la URL que te da.

### 3. Activar la recepción de pedidos

1. En la hoja: Extensiones → Apps Script.
2. Borra el contenido y pega el de `apps-script/Code.gs`. Guarda.
3. Implementar → Nueva implementación → tipo **Aplicación web**.
   - Ejecutar como: **Yo**.
   - Quién tiene acceso: **Cualquier persona**.
4. Autoriza los permisos cuando te los pida y copia la URL de la aplicación web (termina en `/exec`).

Cada vez que cambies `Code.gs` hay que crear una nueva implementación (o actualizar la existente).

### 4. Configurar la web

En `js/config.js`:

```js
export const CATALOG_CSV_URL = "<URL del CSV del paso 2>";
export const ORDERS_ENDPOINT = "<URL /exec del paso 3>";
```

### 5. Publicar la web

Sube la carpeta a un repositorio de GitHub y activa GitHub Pages (Settings → Pages → rama `main`, carpeta raíz), o súbela a Cloudflare Pages. No hay paso de build.

## Antes de abrir al público

1. Haz una copia de la hoja para pruebas y apunta ahí las dos URLs.
2. Haz un pedido de prueba: debe aparecer una fila nueva con estado `nuevo` y abrirse WhatsApp con el mismo número de pedido.
3. Haz otro pedido con el nombre `=1+1`: en la hoja debe verse como texto, no como el resultado de una fórmula.
4. Pon una pieza en `activa = no`: debe desaparecer de la web.
5. Estropea la URL del Apps Script a propósito: WhatsApp debe abrirse igualmente con el aviso.
6. Cuando todo vaya bien, vuelve a poner las URLs de tu hoja real.
7. Pruébalo desde tu móvil.
