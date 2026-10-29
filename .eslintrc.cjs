// Códigos de rol (institucionales y los globales de antes). Regla 1 de
// docs/ROLES-DISENO.md: el frontend NO decide permisos comparando roles; usa
// `modules` de GET /auth/me (config/access.ts) y `allowed_actions` del trámite
// (config/actions.ts). No incluye los roles de trámite (tutor, evaluador) ni los
// nombres de App Role de Entra con mayúscula ('Estudiante'...): el frontend ya no
// los recibe y son palabras normales de la interfaz (encabezados de tabla).
const ROLE_NAMES =
  '^(estudiante|docente|coordinador|comite_grado|administrador|consulta|externo|' +
  'administrativo|consejo_facultad|tutor_investigador|tutor_emprendedor|tutor_consultor|docente_curso|' +
  'coordinador_movilidad|empresa_cliente|comunidad_beneficiaria|grupo_investigacion)$'
const ROLE_MESSAGE =
  'No compares nombres de rol en el frontend: usa hasModule (config/access.ts) o can(detalle, acción) (config/actions.ts). Ver docs/ROLES-DISENO.md, regla 1.'

module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
  overrides: [
    {
      files: ['src/**/*.ts', 'src/**/*.tsx'],
      // roles.ts: etiquetas para mostrar; access.ts: claves de módulo (algunas se llaman igual
      // que un rol, p. ej. 'externo'); pruebas: arman usuarios de ejemplo.
      excludedFiles: ['src/config/roles.ts', 'src/config/access.ts', 'src/**/*.test.ts', 'src/**/*.test.tsx', 'src/test/**'],
      rules: {
        'no-restricted-syntax': [
          'error',
          { selector: `BinaryExpression[operator=/^[!=]==?$/] > Literal[value=/${ROLE_NAMES}/]`, message: ROLE_MESSAGE },
          { selector: `CallExpression[callee.property.name='includes'] > Literal[value=/${ROLE_NAMES}/]`, message: ROLE_MESSAGE },
          { selector: `ArrayExpression > Literal[value=/${ROLE_NAMES}/]`, message: ROLE_MESSAGE },
          { selector: `SwitchCase > Literal[value=/${ROLE_NAMES}/]`, message: ROLE_MESSAGE },
        ],
      },
    },
  ],
}
