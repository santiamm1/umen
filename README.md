# UMEN - Plataforma Inmobiliaria (Vanilla JS)

Versión con JavaScript vanilla, HTML y CSS para mayor facilidad de manipulación.

## 🚀 Características

- **Frontend:** HTML, CSS, JavaScript vanilla
- **Backend:** Firebase (Firestore + Storage + Auth)
- **Responsive:** Diseño adaptable a móviles

### Funcionalidades Públicas
- Listado de propiedades con filtros
- Detalle de propiedad con galería
- Navegación simple

### Panel Administrativo
- Autenticación con Firebase
- CRUD completo de propiedades
- Gestión de categorías, características y ubicaciones

## 📁 Estructura

```
umen-vanilla/
├── index.html              # Página principal
├── property-detail.html    # Detalle de propiedad
├── admin-login.html        # Login admin
├── admin-dashboard.html    # Dashboard admin
├── admin-properties.html   # Gestión propiedades
├── css/
│   └── styles.css          # Estilos CSS
├── js/
│   ├── propertyService.js  # Servicios Firebase
│   ├── main.js             # Lógica página principal
│   ├── propertyDetail.js   # Lógica detalle propiedad
│   ├── adminLogin.js       # Lógica login admin
│   ├── adminDashboard.js   # Lógica dashboard
│   └── adminProperties.js  # Lógica gestión propiedades
└── assets/                 # Imágenes y logos
```

## 🔧 Configuración

1. **Firebase Config:** Edita las credenciales en cada archivo HTML donde aparece `firebaseConfig`.

   Reemplaza:
   ```js
   apiKey: "VITE_FIREBASE_API_KEY",
   // etc.
   ```
   Con tus valores reales de Firebase.

2. **Abrir en navegador:** Abre `index.html` directamente en un navegador web (no requiere servidor local).

## 🗄️ Base de Datos

Misma estructura que la versión React. Consulta el README del proyecto React para detalles.

## 🔐 Reglas de Seguridad Firebase

Configura las mismas reglas de Firestore que en la versión React.

## 📝 Uso

- **Público:** Navega por `index.html`
- **Admin:** Ve a `admin-login.html`, inicia sesión, luego gestiona desde el dashboard

## 🛠️ Desarrollo

Los archivos son independientes y fáciles de editar:
- HTML: Estructura de páginas
- CSS: Estilos en `css/styles.css`
- JS: Lógica en archivos separados en `js/`

Para agregar nuevas páginas, copia la estructura de una existente y crea el JS correspondiente.

## 🚀 Deploy

Sube todos los archivos a cualquier hosting estático (GitHub Pages, Netlify, etc.).

**Nota:** Asegúrate de configurar CORS en Firebase Storage si es necesario.