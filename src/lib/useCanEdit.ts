'use client'
// Permissão de escrita no cliente — espelha canEdit() de '@/lib/access'.
// Só esconde controles na interface; a API continua sendo quem bloqueia.
import { useSession } from 'next-auth/react'

export function useCanEdit(): boolean {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  return role === 'ADMIN' || role === 'MANAGER'
}
