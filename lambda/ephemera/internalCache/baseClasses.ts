export class Deferred <T>{
    promise: Promise<T>;
    resolve: (value: T) => void = () => {}
    reject: () => void = () => {}
    constructor() {
        this.promise = new Promise((resolve, reject)=> {
            this.reject = reject
            this.resolve = resolve
        })
    }
}

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

export type LegalDependencyTag = 'Asset' | 'Variable' | 'Computed' | 'Room' | 'Feature' | 'Map'
export const isLegalDependencyTag = (tag: string): tag is LegalDependencyTag => (['Asset', 'Variable', 'Computed', 'Room', 'Feature', 'Map'].includes(tag))

export type DependencyGraphPut = {
    EphemeraId: string;
    putItem: DependencyEdge;
}

export type DependencyGraphDelete = {
    EphemeraId: string;
    deleteItem: DependencyEdge;
}

export type DependencyGraphAction = DependencyGraphPut | DependencyGraphDelete

export const isDependencyGraphPut = (action: DependencyGraphAction): action is DependencyGraphPut => ('putItem' in action)
export const isDependencyGraphDelete = (action: DependencyGraphAction): action is DependencyGraphDelete => ('deleteItem' in action)

export class CacheBase {
    clear() {}
    async flush() {}
}

type Constructor<T = {}> = new (...args: any[]) => T;

export type CacheConstructor = Constructor<{
    clear(): void;
    flush(): Promise<void>;
}>
