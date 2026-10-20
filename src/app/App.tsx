import { AppShell, Group, Title } from '@mantine/core'

export function App() {
  return (
    <AppShell header={{ height: 56 }} padding="md" h="100%">
      <AppShell.Header>
        <Group h="100%" px="md">
          <Title order={1} size="h4">
            Invoice Review
          </Title>
        </Group>
      </AppShell.Header>
      <AppShell.Main />
    </AppShell>
  )
}
