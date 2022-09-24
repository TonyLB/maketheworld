export type RoomCharacterListItem = {
    EphemeraId: string;
    Color?: string;
    ConnectionIds: string[];
    fileURL?: string;
    Name: string;
}

export type DependencyEdge = {
    EphemeraId: string;
    key?: string;
    assets: string[];
}

export type DependencyNode = {
    EphemeraId: string;
    completeness: 'Partial' | 'Complete';
    connections: DependencyEdge[]
}

export type LegalDependencyTag = 'Variable' | 'Computed' | 'Room' | 'Feature' | 'Map'
export const isLegalDependencyTag = (tag: string): tag is LegalDependencyTag => (['Variable', 'Computed', 'Room', 'Feature', 'Map'].includes(tag))

export class CacheBase {
    async clear() {}
}

type Constructor<T = {}> = new (...args: any[]) => T;

export type CacheConstructor = Constructor<{
    clear(): void;
}>
