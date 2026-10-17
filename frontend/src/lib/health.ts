export type Health = {
  status: string
  app_version: string
  model_status: string
}

export async function getHealth(): Promise<Health> {
  const response = await fetch('/api/health', { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Service returned ${response.status}`)
  }
  return response.json() as Promise<Health>
}
