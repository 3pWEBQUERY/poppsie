/** Welche dieser User haben eine aktive (nicht abgelaufene) Story? Wird vom Community-Modul implementiert. */
export async function usersWithActiveStory(_userIds: string[]): Promise<Set<string>> {
  return new Set();
}
