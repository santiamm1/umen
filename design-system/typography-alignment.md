# Alineación de texto

Regla del sitio: todo título, párrafo y bloque de texto se alinea a la
izquierda, al mismo margen que usa `.container` (donde arrancan el logo,
el buscador y las cards). No usar `text-align: center` ni
`margin: 0 auto` con `max-width` para centrar bloques de texto de sección
(headers de página, breadcrumbs, artículos, etc.).

**Por qué:** con `max-width` + `margin: auto` el texto queda angosto y
desplazado del borde real del contenido (cover, filtros, cards), generando
una desalineación visible como la del header "Blog" en `blog.html` (título
y descripción centrados mientras el resto de la página está a la izquierda).

**Excepciones válidas para centrar:**
- Elementos decorativos aislados (loaders, empty states, iconos de error).
- Contenido dentro de un modal o card angosta donde el centrado es parte del
  componente (ej. avatares, badges).

Si una sección necesita quedar más angosta que el contenedor, usar
`max-width` sin `margin: auto` (o alinear con `margin-right: auto` para
que crezca desde la izquierda), nunca centrar el bloque completo.
