// Tipos mínimos de la API de ESLint 8 que usa src/test/roleRule.test.ts
// (el paquete no trae tipos y @types/eslint no está instalado).
declare module 'eslint' {
  export class ESLint {
    constructor(options?: Record<string, unknown>)
    lintText(code: string, options?: { filePath?: string }): Promise<Array<{ messages: Array<{ ruleId: string | null }> }>>
  }
}
