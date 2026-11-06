import { processesApi, type ProcessDetailOut, type ProcessHistoryOut, type ProcessOut, type TeamMemberOut } from './processes.service'
import { documentsApi, type ChecklistItemOut, type ProcessDocumentOut } from './documents.service'
import type { PossibleStateOut } from '@/types/api'
import { ApiError } from './http'
import { workPlanApi, type SubmissionOut, type WorkPlanOut } from './workplan.service'

export interface TrazabilidadProcessRow {
  process: ProcessOut
  tutor: string | null
}

export interface TrazabilidadDetailData {
  /** Incluye my_process_roles y allowed_actions: de ahí salen los permisos (usePermisos.processPermissions). */
  process: ProcessDetailOut
  history: ProcessHistoryOut[]
  checklist: ChecklistItemOut[]
  documents: ProcessDocumentOut[]
  team: TeamMemberOut[]
  /** Estados a los que QUIEN CONSULTA puede mover el trámite ahora (los calcula el backend). */
  availableTransitions: PossibleStateOut[]
}

export interface EntregablePlanTrazabilidad {
  publicId: string
  deliverableTitle: string
  instructions: string | null
  mandatory: boolean
  applicable: boolean
  active: boolean
  dueDate: string | null
  status: WorkPlanOut['stages'][number]['deliverables'][number]['status']
  submissions: SubmissionOut[]
}

export interface EtapaPlanTrazabilidad {
  publicId: string
  name: string
  active: boolean
  deliverables: EntregablePlanTrazabilidad[]
}

export async function listarProcesosTrazabilidad(accessToken: string): Promise<TrazabilidadProcessRow[]> {
  const processes = await processesApi.list(accessToken)
  return Promise.all(processes.map(async (process) => {
    const team = await processesApi.team(accessToken, process.public_id)
    const tutor = team.find((member) => member.active && member.process_role === 'tutor')?.user.full_name ?? null
    return { process, tutor }
  }))
}

export async function cargarDetalleTrazabilidad(accessToken: string, processId: string): Promise<TrazabilidadDetailData> {
  const [process, history, checklist, documents, team, availableTransitions] = await Promise.all([
    processesApi.get(accessToken, processId),
    processesApi.history(accessToken, processId),
    documentsApi.checklist(accessToken, processId),
    documentsApi.listForProcess(accessToken, processId, true),
    processesApi.team(accessToken, processId),
    processesApi.availableTransitions(accessToken, processId),
  ])
  return { process, history, checklist, documents, team, availableTransitions }
}

export async function cargarEntregasPlanTrazabilidad(accessToken: string, processId: string): Promise<EtapaPlanTrazabilidad[]> {
  let plan: WorkPlanOut
  try {
    plan = await workPlanApi.get(accessToken, processId)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return []
    throw error
  }

  return Promise.all(plan.stages.map(async (stage) => ({
    publicId: stage.public_id,
    name: stage.name,
    active: stage.active,
    deliverables: await Promise.all(stage.deliverables.map(async (deliverable) => {
      const submissions = deliverable.submissions_count > 0
        ? await workPlanApi.listSubmissions(accessToken, processId, deliverable.public_id)
        : deliverable.current_submission ? [deliverable.current_submission] : []
      return {
        publicId: deliverable.public_id,
        deliverableTitle: deliverable.title,
        instructions: deliverable.instructions,
        mandatory: deliverable.mandatory,
        applicable: deliverable.applicable,
        active: deliverable.active,
        dueDate: deliverable.due_date,
        status: deliverable.status,
        submissions,
      }
    })),
  })))
}

export const ETAPAS_TRAZABILIDAD = [
  'Propuesta',
  'Aprobación',
  'Asignación de tutor',
  'Anteproyecto',
  'Avances',
  'Entrega final',
  'Jurados',
  'Sustentación',
  'Cierre',
] as const

export type EstadoTramite =
  | 'BORRADOR'
  | 'ENVIADO'
  | 'EN_REVISION'
  | 'DEVUELTO'
  | 'APROBADO'
  | 'RECHAZADO'
  | 'EN_SUSTENTACION'
  | 'FINALIZADO'

export type RolTramite = 'Coordinador' | 'Tutor' | 'Estudiante' | 'Evaluador' | 'Comite' | 'Consulta'

export interface PersonaTramite {
  id: string
  nombre: string
}

export interface EventoTramite {
  id: string
  tramiteId: string
  tipo: string
  estadoAnterior: EstadoTramite | null
  estadoNuevo: EstadoTramite
  usuarioId: string
  usuarioNombre: string
  rol: RolTramite
  fecha: string
  detalle: string
  documentoId?: string
}

export interface VersionDocumento {
  version: number
  fecha: string
  autor: PersonaTramite
  estado: 'En revisión' | 'Aprobado' | 'Devuelto'
  nombreArchivo: string
  contenido: string
  mimeType: string
}

export interface DocumentoTramite {
  id: string
  nombre: string
  versiones: VersionDocumento[]
}

export interface ComentarioTramite {
  id: string
  usuarioId: string
  usuarioNombre: string
  rol: RolTramite
  fecha: string
  texto: string
  respuestaA: string | null
}

export interface ReunionTramite {
  id: string
  fecha: string
  tema: string
  compromisos: string
  asistentes: string[]
  registradaPor: string
}

export interface TramiteTrazabilidad {
  id: string
  codigo: string
  titulo: string
  estudiantes: PersonaTramite[]
  tutor: PersonaTramite | null
  jurados: PersonaTramite[]
  programa: string
  estado: EstadoTramite
  etapaActual: string
  pasoActual: number
  totalPasos: number
  fechaActualizacion: string
  fechaInicioEtapa: string
  proximaFechaLimite: string | null
  fechaSustentacion: string | null
  eventos: EventoTramite[]
  documentos: DocumentoTramite[]
  comentarios: ComentarioTramite[]
  reuniones: ReunionTramite[]
  isDemo?: boolean
}

export interface FiltrosTramites {
  busqueda?: string
  estado?: EstadoTramite | ''
  programa?: string
  tutor?: string
  desde?: string
  hasta?: string
}

export interface ActorTramite {
  id: string
  nombre: string
  rol: RolTramite
}

const now = new Date()
const daysAgo = (days: number, hour = 10) => {
  const date = new Date(now)
  date.setDate(date.getDate() - days)
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

const people = {
  students: [
    { id: 'student-ana', nombre: 'Ana María Rojas' },
    { id: 'student-luis', nombre: 'Luis Fernando Pérez' },
    { id: 'student-maria', nombre: 'María Camila Torres' },
    { id: 'student-juan', nombre: 'Juan Sebastián Díaz' },
    { id: 'student-laura', nombre: 'Laura Viviana Gómez' },
    { id: 'student-mateo', nombre: 'Mateo Andrés Castro' },
  ],
  tutors: [
    { id: 'tutor-carlos', nombre: 'Carlos Andrés Vega' },
    { id: 'tutor-paula', nombre: 'Paula Andrea León' },
    { id: 'tutor-andres', nombre: 'Andrés Felipe Ruiz' },
  ],
  coordinator: { id: 'coordinador-demo', nombre: 'Diana Coordinadora' },
}

export const PERSONAS_MOCK = {
  tutores: people.tutors,
  jurados: [
    { id: 'jurado-ana', nombre: 'Ana Lucía Cárdenas' },
    { id: 'jurado-mario', nombre: 'Mario Alberto Peña' },
    { id: 'jurado-juliana', nombre: 'Juliana Marcela Ríos' },
  ],
  coordinacion: people.coordinator,
}

function event(
  tramiteId: string,
  id: string,
  tipo: string,
  estadoNuevo: EstadoTramite,
  actor: PersonaTramite,
  rol: RolTramite,
  days: number,
  detalle: string,
  estadoAnterior: EstadoTramite | null = null,
  documentoId?: string,
): EventoTramite {
  return { id, tramiteId, tipo, estadoAnterior, estadoNuevo, usuarioId: actor.id, usuarioNombre: actor.nombre, rol, fecha: daysAgo(days), detalle, documentoId }
}

function mockTramite({
  id, student, tutor, estado, paso, dias, titulo, programa,
}: {
  id: string
  student: PersonaTramite
  tutor: PersonaTramite | null
  estado: EstadoTramite
  paso: number
  dias: number
  titulo: string
  programa: string
}): TramiteTrazabilidad {
  const currentStage = ETAPAS_TRAZABILIDAD[paso - 1]
  const docId = `doc-${id}`
  const actor = tutor ?? people.coordinator
  const timestamp = daysAgo(dias)
  const doc: DocumentoTramite = {
    id: docId,
    nombre: paso < 6 ? 'Documento de avance' : 'Entrega final',
    versiones: [{
      version: 1,
      fecha: timestamp,
      autor: student,
      estado: estado === 'DEVUELTO' || estado === 'RECHAZADO' ? 'Devuelto' : estado === 'APROBADO' || estado === 'FINALIZADO' ? 'Aprobado' : 'En revisión',
      nombreArchivo: `${id}-documento.pdf`,
      contenido: `Documento demostrativo de ${titulo}.`,
      mimeType: 'application/pdf',
    }],
  }
  return {
    id, codigo: `TG-2026-${id.slice(-3)}`, titulo, estudiantes: [student], tutor, jurados: [],
    programa, estado, etapaActual: currentStage, pasoActual: paso, totalPasos: ETAPAS_TRAZABILIDAD.length,
    fechaActualizacion: timestamp, fechaInicioEtapa: daysAgo(dias + 4), proximaFechaLimite: daysAgo(-12).slice(0, 10),
    fechaSustentacion: null,
    eventos: [
      event(id, `event-${id}-1`, 'Propuesta enviada', 'ENVIADO', student, 'Estudiante', 45, 'Se radicó la propuesta de trabajo de grado.'),
      event(id, `event-${id}-2`, 'Revisión iniciada', 'EN_REVISION', people.coordinator, 'Coordinador', 35, 'El trámite fue recibido para revisión.', 'ENVIADO'),
      event(id, `event-${id}-3`, currentStage, estado, actor, tutor ? 'Tutor' : 'Coordinador', dias, `Actualización en la etapa: ${currentStage}.`, 'EN_REVISION', docId),
    ],
    documentos: [doc],
    comentarios: [{
      id: `comment-${id}-1`, usuarioId: actor.id, usuarioNombre: actor.nombre, rol: tutor ? 'Tutor' : 'Coordinador',
      fecha: timestamp, texto: `Seguimiento de demostración para la etapa ${currentStage}.`, respuestaA: null,
    }],
    reuniones: [{
      id: `meeting-${id}-1`, fecha: daysAgo(dias + 2), tema: 'Seguimiento del proyecto',
      compromisos: 'Revisar los avances y acordar la próxima entrega.',
      asistentes: [student.nombre, ...(tutor ? [tutor.nombre] : [])], registradaPor: actor.nombre,
    }],
    isDemo: true,
  }
}

export const MOCK_TRAMITES: TramiteTrazabilidad[] = [
  mockTramite({ id: 'demo-001', student: people.students[0], tutor: people.tutors[0], estado: 'EN_REVISION', paso: 2, dias: 3, titulo: 'Plataforma inteligente para análisis de movilidad urbana', programa: 'Ingeniería de Software' }),
  mockTramite({ id: 'demo-002', student: people.students[1], tutor: people.tutors[1], estado: 'DEVUELTO', paso: 4, dias: 18, titulo: 'Sistema de inventario para microempresas', programa: 'Ingeniería de Software' }),
  mockTramite({ id: 'demo-003', student: people.students[2], tutor: people.tutors[2], estado: 'APROBADO', paso: 5, dias: 5, titulo: 'Estrategia de comercio electrónico local', programa: 'Administración de Empresas' }),
  mockTramite({ id: 'demo-004', student: people.students[3], tutor: people.tutors[0], estado: 'EN_SUSTENTACION', paso: 8, dias: 2, titulo: 'Analítica de ventas minoristas', programa: 'Ingeniería de Software' }),
  mockTramite({ id: 'demo-005', student: people.students[4], tutor: null, estado: 'BORRADOR', paso: 1, dias: 1, titulo: 'Propuesta de economía circular', programa: 'Administración de Empresas' }),
  mockTramite({ id: 'demo-006', student: people.students[5], tutor: people.tutors[1], estado: 'FINALIZADO', paso: 9, dias: 60, titulo: 'Mejora de procesos en empresa de servicios', programa: 'Administración de Empresas' }),
]

let tramitesMock = structuredClone(MOCK_TRAMITES)

export function obtenerTramiteDemo(tramiteId: string): TramiteTrazabilidad | null {
  const tramite = tramitesMock.find((item) => item.id === tramiteId)
  return tramite ? structuredClone({ ...tramite, isDemo: true }) : null
}

export function stepForStateCode(code: string, isFinalState = false, hasTutor = false): number {
  const value = code.toLocaleUpperCase()
  if (isFinalState || /FINALIZ|CERRAD|HOMOLOG|CALIFICACION|REPOSITOR|MENCION/.test(value)) return 9
  if (/SUSTENT/.test(value)) return 8
  if (/JURAD/.test(value)) return 7
  if (/ENTREGA_TRABAJO_ESCRITO|CORRECCIONES_SOLICITADAS|ENTREGA_FINAL/.test(value)) return 6
  if (/AVANCE|EJECUCION/.test(value)) return 5
  if (/ANTEPROYECT/.test(value)) return 4
  // Al aprobar Coordinación y pasar a aval especializado, la etapa de aprobación queda completada.
  // Si ya hay tutor, el siguiente hito visible es el anteproyecto.
  if (/AVAL_AREA|APROBADO_COMITE_GENERAL/.test(value)) return hasTutor ? 4 : 3
  if (/TUTOR|ASIGNAC|ACUERDO_PEDAGOGICO_FIRMADO|APROBADO_COMITE_GENERAL/.test(value)) return 3
  if (/REVISION|REVISIÓN|APROB|DEVUEL|RECHAZ|COMITE|DOCUMENTOS_PENDIENTES|RADICAD|ENVIAD/.test(value)) return 2
  return 1
}

export function estadoFromProcess(process: ProcessOut): EstadoTramite {
  const code = process.state.code.toLocaleUpperCase()
  if (process.state.is_final_state || /FINALIZ|CERRAD|HOMOLOG/.test(code)) return 'FINALIZADO'
  if (/SUSTENT/.test(code)) return 'EN_SUSTENTACION'
  if (/RECHAZ/.test(code)) return 'RECHAZADO'
  if (/DEVUEL|CORRECCIONES/.test(code)) return 'DEVUELTO'
  if (/REVISION|REVISIÓN/.test(code)) return 'EN_REVISION'
  if (/APROB|EJECUCION/.test(code)) return 'APROBADO'
  if (/BORRADOR|POSTULACION_INICIADA/.test(code)) return 'BORRADOR'
  if (/ENVIAD|RADICAD|DOCUMENTOS_PENDIENTES/.test(code)) return 'ENVIADO'
  return 'ENVIADO'
}

export function processToTramite(process: ProcessOut, tutor: { public_id: string; full_name: string } | null = null, evaluators: { public_id: string; full_name: string }[] = []): TramiteTrazabilidad {
  const step = stepForStateCode(process.state.code, process.state.is_final_state, Boolean(tutor))
  const timestamp = process.updated_at ?? process.created_at
  return {
    id: process.public_id,
    codigo: process.process_code,
    titulo: process.title?.trim() || process.process_code,
    estudiantes: [{ id: process.student.public_id, nombre: process.student.full_name }],
    tutor: tutor ? { id: tutor.public_id, nombre: tutor.full_name } : null,
    jurados: evaluators.map((evaluator) => ({ id: evaluator.public_id, nombre: evaluator.full_name })),
    programa: process.modality.name,
    estado: estadoFromProcess(process),
    etapaActual: ETAPAS_TRAZABILIDAD[step - 1],
    pasoActual: step,
    totalPasos: ETAPAS_TRAZABILIDAD.length,
    fechaActualizacion: timestamp,
    fechaInicioEtapa: timestamp,
    proximaFechaLimite: null,
    fechaSustentacion: null,
    eventos: [],
    documentos: [],
    comentarios: [],
    reuniones: [],
    isDemo: false,
  }
}

export async function listarTramites(filtros: FiltrosTramites = {}, accessToken?: string): Promise<TramiteTrazabilidad[]> {
  const real = accessToken
    ? await Promise.all((await processesApi.list(accessToken)).map(async (process) => {
        const team = await processesApi.team(accessToken, process.public_id)
        const assignedTutor = team.find((member) => member.active && member.process_role === 'tutor')?.user
        return processToTramite(process, assignedTutor ? { public_id: assignedTutor.public_id, full_name: assignedTutor.full_name } : null)
      }))
    : []
  const query = filtros.busqueda?.trim().toLocaleLowerCase('es-CO') ?? ''
  return [...real, ...tramitesMock.map((item) => ({ ...item, isDemo: true }))].filter((item) => {
    const updated = item.fechaActualizacion.slice(0, 10)
    const searchMatches = !query || [item.codigo, item.titulo, item.programa, item.tutor?.nombre ?? '', ...item.estudiantes.map((person) => person.nombre)]
      .some((value) => value.toLocaleLowerCase('es-CO').includes(query))
    return searchMatches
      && (!filtros.estado || item.estado === filtros.estado)
      && (!filtros.programa || item.programa === filtros.programa)
      && (!filtros.tutor || item.tutor?.id === filtros.tutor)
      && (!filtros.desde || updated >= filtros.desde)
      && (!filtros.hasta || updated <= filtros.hasta)
  })
}

export async function obtenerTramite(tramiteId: string, accessToken?: string): Promise<TramiteTrazabilidad | null> {
  const demo = tramitesMock.find((item) => item.id === tramiteId)
  if (demo) return structuredClone({ ...demo, isDemo: true })
  if (!accessToken) return null
  const process = await processesApi.get(accessToken, tramiteId)
  const team = await processesApi.team(accessToken, tramiteId)
  const tutor = team.find((member) => member.active && member.process_role === 'tutor')?.user
  return processToTramite(process, tutor ? { public_id: tutor.public_id, full_name: tutor.full_name } : null)
}

export class TrazabilidadPermissionError extends Error {
  constructor(message = 'No tienes permiso para realizar esta acción.') {
    super(message)
    this.name = 'TrazabilidadPermissionError'
  }
}

function requireDemo(tramiteId: string) {
  const tramite = tramitesMock.find((item) => item.id === tramiteId)
  if (!tramite) throw new Error('No encontramos este ejemplo demostrativo.')
  return tramite
}

function logEvent(tramite: TramiteTrazabilidad, actor: ActorTramite, tipo: string, detalle: string, estadoNuevo = tramite.estado, documentoId?: string) {
  const fecha = new Date().toISOString()
  const estadoAnterior = tramite.estado === estadoNuevo ? null : tramite.estado
  tramite.eventos = [{
    id: `event-${crypto.randomUUID()}`, tramiteId: tramite.id, tipo, estadoAnterior, estadoNuevo,
    usuarioId: actor.id, usuarioNombre: actor.nombre, rol: actor.rol, fecha, detalle, documentoId,
  }, ...tramite.eventos]
  tramite.estado = estadoNuevo
  tramite.fechaActualizacion = fecha
  if (estadoAnterior) tramite.fechaInicioEtapa = fecha
  const stateStep = estadoNuevo === 'APROBADO' ? (tramite.tutor ? 4 : 2)
    : estadoNuevo === 'FINALIZADO' ? 9
      : estadoNuevo === 'EN_SUSTENTACION' ? 8
        : stepForStateCode(estadoNuevo)
  tramite.pasoActual = Math.max(tramite.pasoActual, stateStep)
  tramite.etapaActual = ETAPAS_TRAZABILIDAD[tramite.pasoActual - 1]
}

export async function cambiarEstadoDemo(tramiteId: string, actor: ActorTramite, nuevoEstado: EstadoTramite, detalle = '') {
  if (actor.rol !== 'Coordinador' && actor.rol !== 'Tutor') throw new TrazabilidadPermissionError('Tu rol no puede aprobar ni cambiar el estado.')
  const tramite = requireDemo(tramiteId)
  const allowed: Partial<Record<EstadoTramite, EstadoTramite[]>> = {
    BORRADOR: ['ENVIADO'],
    ENVIADO: ['EN_REVISION', 'DEVUELTO', 'RECHAZADO'],
    EN_REVISION: ['APROBADO', 'DEVUELTO', 'RECHAZADO'],
    DEVUELTO: ['EN_REVISION', 'RECHAZADO'],
    APROBADO: ['EN_SUSTENTACION', 'FINALIZADO'],
    EN_SUSTENTACION: ['FINALIZADO', 'DEVUELTO'],
  }
  if (!allowed[tramite.estado]?.includes(nuevoEstado)) throw new Error(`No se permite pasar de ${tramite.estado} a ${nuevoEstado}.`)
  logEvent(tramite, actor, nuevoEstado === 'APROBADO' ? 'Aprobación del tutor' : 'Cambio de estado', detalle || `El trámite cambió a ${nuevoEstado}.`, nuevoEstado)
  return structuredClone(tramite)
}

export function asignarTutorDemo(tramiteId: string, actor: ActorTramite, tutorId: string) {
  if (actor.rol !== 'Coordinador') throw new TrazabilidadPermissionError('Solo Coordinación puede asignar tutores.')
  const tramite = requireDemo(tramiteId)
  const tutor = PERSONAS_MOCK.tutores.find((person) => person.id === tutorId)
  if (!tutor) throw new Error('Selecciona un tutor válido.')
  tramite.tutor = tutor
  tramite.pasoActual = Math.max(tramite.pasoActual, 4)
  tramite.etapaActual = ETAPAS_TRAZABILIDAD[tramite.pasoActual - 1]
  logEvent(tramite, actor, 'Tutor asignado', `${tutor.nombre} quedó asignado al proyecto.`)
  return structuredClone(tramite)
}

export function asignarJuradoDemo(tramiteId: string, actor: ActorTramite, juradoId: string) {
  if (actor.rol !== 'Coordinador') throw new TrazabilidadPermissionError('Solo Coordinación puede asignar jurados.')
  const tramite = requireDemo(tramiteId)
  const jurado = PERSONAS_MOCK.jurados.find((person) => person.id === juradoId)
  if (!jurado) throw new Error('Selecciona un jurado válido.')
  if (tramite.jurados.some((person) => person.id === jurado.id)) throw new Error('Este jurado ya está asignado.')
  tramite.jurados = [...tramite.jurados, jurado]
  tramite.pasoActual = Math.max(tramite.pasoActual, 7)
  tramite.etapaActual = ETAPAS_TRAZABILIDAD[tramite.pasoActual - 1]
  logEvent(tramite, actor, 'Jurado asignado', `${jurado.nombre} quedó asignado como jurado.`)
  return structuredClone(tramite)
}

export function programarSustentacionDemo(tramiteId: string, actor: ActorTramite, fecha: string) {
  if (actor.rol !== 'Coordinador') throw new TrazabilidadPermissionError('Solo Coordinación puede programar la sustentación.')
  const tramite = requireDemo(tramiteId)
  if (!fecha || Number.isNaN(new Date(fecha).getTime())) throw new Error('Indica una fecha válida para la sustentación.')
  tramite.fechaSustentacion = fecha
  tramite.proximaFechaLimite = fecha.slice(0, 10)
  logEvent(tramite, actor, 'Sustentación programada', `Fecha programada: ${new Date(fecha).toLocaleString('es-CO')}.`)
  return structuredClone(tramite)
}

export async function agregarComentarioDemo(tramiteId: string, actor: ActorTramite, texto: string, respuestaA: string | null = null) {
  const tramite = requireDemo(tramiteId)
  if (!texto.trim()) throw new Error('Escribe un comentario antes de enviarlo.')
  const comentario = { id: `comment-${crypto.randomUUID()}`, usuarioId: actor.id, usuarioNombre: actor.nombre, rol: actor.rol, fecha: new Date().toISOString(), texto: texto.trim(), respuestaA }
  tramite.comentarios = [...tramite.comentarios, comentario]
  logEvent(tramite, actor, 'Comentario agregado', texto.trim())
  return structuredClone(tramite)
}

export async function agregarReunionDemo(tramiteId: string, actor: ActorTramite, reunion: Omit<ReunionTramite, 'id' | 'registradaPor'>) {
  if (actor.rol !== 'Tutor' && actor.rol !== 'Coordinador') throw new TrazabilidadPermissionError()
  const tramite = requireDemo(tramiteId)
  tramite.reuniones = [...tramite.reuniones, { ...reunion, id: `meeting-${crypto.randomUUID()}`, registradaPor: actor.nombre }]
  logEvent(tramite, actor, 'Reunión registrada', `Reunión: ${reunion.tema}. Compromisos: ${reunion.compromisos}`)
  return structuredClone(tramite)
}

export async function cargarDocumentoDemo(tramiteId: string, actor: ActorTramite, file: File) {
  const tramite = requireDemo(tramiteId)
  const existing = tramite.documentos.find((document) => document.nombre === file.name)
  const version = (existing?.versiones.length ?? 0) + 1
  const data = await file.arrayBuffer()
  const bytes = new Uint8Array(data)
  let binary = ''
  bytes.forEach((value) => { binary += String.fromCharCode(value) })
  const encoded = btoa(binary)
  const versionRecord: VersionDocumento = {
    version,
    fecha: new Date().toISOString(),
    autor: { id: actor.id, nombre: actor.nombre },
    estado: 'En revisión',
    nombreArchivo: file.name,
    contenido: `data:${file.type || 'application/octet-stream'};base64,${encoded}`,
    mimeType: file.type || 'application/octet-stream',
  }
  const documentoId = existing?.id ?? `doc-${crypto.randomUUID()}`
  if (existing) existing.versiones.push(versionRecord)
  else tramite.documentos.push({ id: documentoId, nombre: file.name, versiones: [versionRecord] })
  logEvent(tramite, actor, 'Documento cargado', `Se cargó la versión ${version} de ${file.name}.`, tramite.estado, documentoId)
  return structuredClone(tramite)
}

export function reiniciarDatosMock() {
  tramitesMock = structuredClone(MOCK_TRAMITES)
}

// Prototipo local para comentarios y asesorías mientras el API de trámites
// no expone esos recursos. La UI indica que estos datos no se sincronizan.
const LOCAL_TRACE_KEY = 'ucompensar-trazabilidad-local-v1'
type LocalTraceEntries = { comments: Record<string, ComentarioTramite[]>; meetings: Record<string, ReunionTramite[]>; sustentationDates: Record<string, string> }

function readLocalTrace(): LocalTraceEntries {
  try {
    const value = window.localStorage.getItem(LOCAL_TRACE_KEY)
    if (!value) return { comments: {}, meetings: {}, sustentationDates: {} }
    const parsed = JSON.parse(value) as Partial<LocalTraceEntries>
    return { comments: parsed.comments ?? {}, meetings: parsed.meetings ?? {}, sustentationDates: parsed.sustentationDates ?? {} }
  } catch {
    return { comments: {}, meetings: {}, sustentationDates: {} }
  }
}

function writeLocalTrace(value: LocalTraceEntries) {
  window.localStorage.setItem(LOCAL_TRACE_KEY, JSON.stringify(value))
}

export function listarComentariosLocales(processId: string): ComentarioTramite[] {
  return structuredClone(readLocalTrace().comments[processId] ?? [])
}

export function guardarComentarioLocal(processId: string, actor: ActorTramite, texto: string, respuestaA: string | null = null): ComentarioTramite {
  const normalized = texto.trim()
  if (!normalized) throw new Error('Escribe un comentario antes de enviarlo.')
  const entries = readLocalTrace()
  const comment: ComentarioTramite = {
    id: `comment-${crypto.randomUUID()}`,
    usuarioId: actor.id,
    usuarioNombre: actor.nombre,
    rol: actor.rol,
    fecha: new Date().toISOString(),
    texto: normalized,
    respuestaA,
  }
  entries.comments[processId] = [...(entries.comments[processId] ?? []), comment]
  writeLocalTrace(entries)
  return structuredClone(comment)
}

export function listarReunionesLocales(processId: string): ReunionTramite[] {
  return structuredClone(readLocalTrace().meetings[processId] ?? [])
}

export function guardarReunionLocal(processId: string, reunion: Omit<ReunionTramite, 'id' | 'registradaPor'>, actor: ActorTramite): ReunionTramite {
  if (!reunion.tema.trim() || !reunion.fecha) throw new Error('Indica la fecha y el tema de la asesoría.')
  const entries = readLocalTrace()
  const meeting: ReunionTramite = {
    ...reunion,
    id: `meeting-${crypto.randomUUID()}`,
    registradaPor: actor.nombre,
    tema: reunion.tema.trim(),
    compromisos: reunion.compromisos.trim(),
  }
  entries.meetings[processId] = [...(entries.meetings[processId] ?? []), meeting]
  writeLocalTrace(entries)
  return structuredClone(meeting)
}

export function leerFechaSustentacionLocal(processId: string): string {
  return readLocalTrace().sustentationDates[processId] ?? ''
}

export function guardarFechaSustentacionLocal(processId: string, date: string) {
  const entries = readLocalTrace()
  if (date) entries.sustentationDates[processId] = date
  else delete entries.sustentationDates[processId]
  writeLocalTrace(entries)
}
