import { UsersRound } from 'lucide-react'
import type { ProcessOut, TeamMemberOut } from '@/services/processes.service'
import { formatMomentDay } from '../monitoringUi'
import { TEAM_ROLE_LABEL } from './dossierHelpers'
import { Avatar, DossierCard, EmptyNote, SectionError } from './dossierUi'
import type { DossierSection } from './useStudentDossier'

const ROLE_ORDER: Record<string, number> = { estudiante: 0, tutor: 1, evaluador: 2 }

function activeMembers(team: TeamMemberOut[]) {
  return team.filter((m) => m.active).sort((a, b) => (ROLE_ORDER[a.process_role] ?? 9) - (ROLE_ORDER[b.process_role] ?? 9))
}

/** «Titular» = el estudiante a nombre de quien está el proceso de grado (dato real del proceso, no una suposición). */
// Solo presentación (color del avatar); ningún permiso depende de esto.
const TEAM_ROLE_TONE: Record<string, 'violet' | 'navy'> = { estudiante: 'violet' }

function TitularBadge() {
  return <span className="rounded-full border border-[#1565C0] bg-[#1565C0]/10 px-2 py-0.5 text-[11px] font-bold text-[#1565C0] dark:text-sky-300">Titular</span>
}

function MemberRow({ member, titularId, detailed }: { member: TeamMemberOut; titularId: string | null; detailed?: boolean }) {
  return (
    <li className="flex items-center gap-3">
      <Avatar name={member.user.full_name} size="sm" tone={TEAM_ROLE_TONE[member.process_role] ?? 'navy'} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-bold text-[var(--color-secondary)]">
          {member.user.full_name}{member.user.public_id === titularId && <TitularBadge />}
        </p>
        <p className="text-[11.5px] text-[var(--color-text-muted)]">
          {TEAM_ROLE_LABEL[member.process_role] ?? member.process_role}{detailed && <> · {member.user.email} · desde {formatMomentDay(member.assigned_at)}</>}
        </p>
      </div>
    </li>
  )
}

/** Panel lateral: integrantes vigentes del proyecto. */
export function ProjectTeamCard({ team, process }: { team: DossierSection<TeamMemberOut[]>; process: ProcessOut | null }) {
  const members = team.data ? activeMembers(team.data) : []
  return (
    <DossierCard title={<>Equipo del proyecto{team.data && <span className="text-[13px] font-bold text-[var(--color-text-muted)]">({members.length})</span>}</>} Icon={UsersRound} titleId="exp-team-card-title">
      {team.loading ? <p role="status" className="text-[12.5px] text-[var(--color-text-muted)]">Cargando equipo…</p>
        : team.error ? <SectionError message={team.error} />
          : members.length === 0 ? <EmptyNote>Sin integrantes registrados.</EmptyNote>
            : <ul className="space-y-3">{members.map((m) => <MemberRow key={m.public_id} member={m} titularId={process?.student.public_id ?? null} />)}</ul>}
    </DossierCard>
  )
}

/** Pestaña Equipo: integrantes vigentes y, aparte, quienes ya no participan (historial conservado). */
export function TeamTab({ team, process }: { team: DossierSection<TeamMemberOut[]>; process: ProcessOut | null }) {
  const titularId = process?.student.public_id ?? null
  const former = team.data?.filter((m) => !m.active) ?? []
  return (
    <DossierCard title="Equipo" Icon={UsersRound} titleId="exp-team-title">
      {team.loading ? <p role="status" className="text-[13px] text-[var(--color-text-muted)]">Cargando equipo…</p>
        : team.error ? <SectionError message={team.error} />
          : !team.data?.length ? <EmptyNote>Sin integrantes registrados.</EmptyNote> : (
            <div className="space-y-5">
              <ul className="space-y-3.5">{activeMembers(team.data).map((m) => <MemberRow key={m.public_id} member={m} titularId={titularId} detailed />)}</ul>
              {former.length > 0 && (
                <div>
                  <h3 className="mb-2 text-[13px] font-extrabold text-[var(--color-text-muted)]">Ya no participan</h3>
                  <ul className="space-y-3 opacity-75">{former.map((m) => <MemberRow key={m.public_id} member={m} titularId={titularId} detailed />)}</ul>
                </div>
              )}
            </div>
          )}
    </DossierCard>
  )
}
