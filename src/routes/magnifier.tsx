import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/magnifier')({
  beforeLoad: () => {
    throw redirect({ to: '/spotlight' })
  },
})
