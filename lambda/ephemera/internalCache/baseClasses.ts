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

export class CacheBase {
    async clear() {}
}

type Constructor<T = {}> = new (...args: any[]) => T;

export type CacheConstructor = Constructor<{
    clear(): void;
}>
