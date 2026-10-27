# UCompensar — Sistema de Gestión de Trabajos de Grado

Plataforma de gestión de trámites académicos de titulación para la Fundación Universitaria Compensar.

---

## 🏗️ Stack Tecnológico

| Tecnología | Versión | Uso |
|---|---|---|
| React | 18.3 | UI Framework |
| TypeScript | 5.4 | Tipado estático |
| Vite | 5.3 | Build tool / Dev server |
| Tailwind CSS | 3.4 | Estilos utilitarios |
| Zustand | 4.5 | Estado global |
| Lucide React | 0.383 | Iconos |

---

## 📁 Estructura del Proyecto

```
src/
├── app/                    # Configuración de la aplicación
├── components/
│   ├── ui/                 # Componentes reutilizables base
│   │   ├── Badge.tsx       # Badges de estado y tipo
│   │   ├── Button.tsx      # Botón con variantes
│   │   ├── Card.tsx        # Contenedor de tarjeta
│   │   ├── Input.tsx       # Input y Select
│   │   ├── Logo.tsx        # Logo SVG UCompensar
│   │   ├── MetricCard.tsx  # Tarjeta de métrica
│   │   ├── AlertBanner.tsx # Banner de alerta
│   │   └── index.ts        # Barrel export
│   ├── auth/               # Flujo de autenticación
│   │   ├── LoginScreen.tsx
│   │   ├── LoginPanel.tsx
│   │   ├── SSOForm.tsx
│   │   ├── CredentialsForm.tsx
│   │   └── AuthOverlay.tsx
│   ├── layout/             # Estructura del dashboard
│   │   ├── DashboardLayout.tsx
│   │   ├── Sidebar.tsx
│   │   └── Topbar.tsx
│   ├── dashboard/
│   │   └── DashboardSection.tsx
│   ├── tramites/
│   │   ├── TramitesSection.tsx
│   │   ├── NuevoTramiteSection.tsx
│   │   └── BuscarSection.tsx
│   ├── trazabilidad/
│   │   └── TrazabilidadSection.tsx
│   ├── documentos/
│   │   └── DocumentosSection.tsx
│   └── reportes/
│       └── ReportesSection.tsx
├── hooks/
│   └── useAuth.ts          # Lógica de autenticación
├── stores/
│   └── app.store.ts        # Estado global Zustand
├── types/
│   └── index.ts            # Todos los tipos TypeScript
├── constants/
│   └── index.ts            # Constantes de la aplicación
├── utils/
│   ├── cn.ts               # Utilidad className (clsx + twMerge)
│   ├── format.ts           # Utilidades de formateo
│   └── mock-data.ts        # Datos de ejemplo
└── styles/
    └── globals.css         # Estilos globales + Tailwind
```

---

## 🚀 Instalación y Uso

### Requisitos
- Node.js ≥ 18
- npm ≥ 9

### Pasos

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo
npm run dev

# 3. Build para producción
npm run build

# 4. Preview del build
npm run preview
```

El servidor de desarrollo estará en: `http://localhost:5173`
El Servidor de Network se iniciará en: `http://{api_address}:5173/login`

---

## API y autenticacion en desarrollo

El frontend valida el acceso contra el backend institucional; no hay credenciales de demostracion ni login simulado en el cliente.

- Inicia el frontend con npm run dev. En desarrollo, las solicitudes a /api usan el proxy de Vite hacia http://localhost:8000.
- El backend debe ejecutarse por separado y exponer /api/auth/login, /api/auth/me, /api/auth/refresh y /api/auth/logout.
- Este repositorio no incluye el backend ni documenta su comando de inicio. Solicita el proyecto/backend institucional y sus instrucciones al equipo responsable; no hay usuarios demo habilitados por el frontend.
- Para un backend remoto o una URL distinta, configura VITE_API_URL con la URL base de la API, incluyendo /api. En ese entorno, el backend debe permitir el origen del frontend y credenciales para la cookie de renovacion.
## 🎨 Sistema de Diseño

### Colores principales
```
brand-orange:       #E05A1E   (Acción principal)
brand-orange-light: #FEF0E8   (Fondos naranja)
brand-green:        #2D6135   (Sidebar / estados positivos)
brand-green-light:  #EAF2EC   (Fondos verdes)
neutral-bg:         #F5F5F3   (Fondo general)
neutral-border:     #E0DDD8   (Bordes)
```

### Componentes UI
Todos los componentes base están en `src/components/ui/` con barrel export en `index.ts`.

---

## 📋 Secciones del Sistema

| Sección | Descripción |
|---|---|
| Dashboard | Vista general con métricas y alertas |
| Mis trámites | Tabla completa con filtros por modalidad |
| Nuevo trámite | Formulario de radicación |
| Buscar por cédula | Búsqueda rápida de estudiante |
| Trazabilidad | Estado detallado y timeline de un trámite |
| Documentos | Repositorio SharePoint |
| Reportes | Estadísticas y gráficas |

---

## 🔧 Extensión Recomendada (VS Code)

- **Tailwind CSS IntelliSense** — autocompletado de clases
- **ES7+ React/Redux/React-Native snippets** — snippets de React
- **TypeScript Hero** — imports automáticos

---

## 📄 Licencia

Uso interno — Fundación Universitaria Compensar © 2026
