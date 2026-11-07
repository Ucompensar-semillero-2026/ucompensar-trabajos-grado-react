import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'

// jsdom no implementa window.scrollTo; el catálogo lo usa para partir siempre del inicio.
window.scrollTo = (() => {}) as typeof window.scrollTo

// findBy*/waitFor esperan 1 s por defecto. En el build de Vercel (máquina más lenta: ~33 s solo de
// pruebas) eso no siempre alcanza: el mismo commit pasó y falló en dos builds distintos
// (portafolio.test.tsx, «Por asignar»). 5 s no oculta errores: si la pantalla hace algo mal,
// la prueba sigue fallando, solo que espera un poco más antes de decirlo.
configure({ asyncUtilTimeout: 5000 })
