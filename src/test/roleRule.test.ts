import { describe, expect, it } from 'vitest'
import { ESLint } from 'eslint'

// Regla 1 de docs/ROLES-DISENO.md: el frontend no decide permisos comparando
// nombres de rol. Esta prueba falla si alguien quita o debilita la regla de
// .eslintrc.cjs, aunque nadie corra `npm run lint`.
const eslint = new ESLint()

async function roleErrors(code: string, filePath = 'src/components/Probe.tsx'): Promise<number> {
  const [result] = await eslint.lintText(code, { filePath })
  return result.messages.filter((m) => m.ruleId === 'no-restricted-syntax').length
}

describe('regla: no comparar nombres de rol en el frontend', () => {
  it.each([
    ["export const a = (r: string) => r === 'coordinador'", 'comparación'],
    ["export const a = (r: string) => r !== 'estudiante'", 'comparación negada'],
    ["export const a = (r: string[]) => r.includes('administrativo')", '.includes'],
    ["export const a = ['docente', 'comite_grado']", 'lista de roles'],
    ["export const a = (r: string) => { switch (r) { case 'externo': return 1 } return 0 }", 'switch'],
  ])('rechaza %s (%s)', async (code) => {
    expect(await roleErrors(code)).toBeGreaterThan(0)
  })

  it('permite los roles de trámite y el texto normal de la interfaz', async () => {
    expect(await roleErrors("export const a = (r: string) => r === 'tutor' || r === 'evaluador'")).toBe(0)
    expect(await roleErrors("export const h = ['Código', 'Estudiante', 'Estado']")).toBe(0)
  })

  it('solo config/roles.ts y config/access.ts pueden nombrarlos', async () => {
    const code = "export const a = ['coordinador']"
    expect(await roleErrors(code, 'src/config/roles.ts')).toBe(0)
    expect(await roleErrors(code, 'src/config/access.ts')).toBe(0)
    expect(await roleErrors(code, 'src/hooks/useAlgo.ts')).toBeGreaterThan(0)
  })
})
