export const isSystemCollectionName = (name: string): boolean =>
  name.startsWith("system.") || name.startsWith("local.");

export const sortCollectionNames = (names: string[]): string[] =>
  [...names].sort((left, right) => left.localeCompare(right));

export const discoverApplicationCollectionNames = async (
  listCollections: () => Promise<Array<{ name: string }>>
): Promise<string[]> => {
  const collections = await listCollections();
  const names = collections
    .map((entry) => entry.name)
    .filter((name) => name.length > 0 && !isSystemCollectionName(name));

  return sortCollectionNames(names);
};
