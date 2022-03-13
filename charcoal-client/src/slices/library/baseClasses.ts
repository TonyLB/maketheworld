import { ISSMAttemptNode, ISSMChoiceNode, ISSMHoldNode, ISSMHoldCondition, ISSMDataLayout, ISSMDataReturn, ISSMAction } from '../stateSeekingMachine/baseClasses'

export interface LibraryInternal {
    subscription?: any;
    incrementalBackoff: number;
}

export type LibraryAsset = {
    AssetId: string;
    Story?: boolean;
    instance?: boolean;
}

export type LibraryCharacter = {
    CharacterId: string;
    Name: string;
    scopedId: string;
    fileName: string;
    fileURL?: string;
}

export interface LibraryPublic {
    Assets: LibraryAsset[];
    Characters: LibraryCharacter[];
}

export type LibraryRecord = ISSMDataLayout<LibraryInternal, LibraryPublic>
export type LibraryReturn = ISSMDataReturn<LibraryInternal, LibraryPublic>
export type LibraryAction = ISSMAction<LibraryInternal, LibraryPublic>
export type LibraryCondition = ISSMHoldCondition<LibraryInternal, LibraryPublic>

export interface Library {
    INITIAL: ISSMHoldNode<LibraryInternal, LibraryPublic>;
    INACTIVE: ISSMChoiceNode;
    SUBSCRIBE: ISSMAttemptNode<LibraryInternal, LibraryPublic>;
    SYNCHRONIZE: ISSMAttemptNode<LibraryInternal, LibraryPublic>;
    CONNECTED: ISSMChoiceNode;
    UNSUBSCRIBE: ISSMAttemptNode<LibraryInternal, LibraryPublic>;
    ERROR: ISSMChoiceNode;
}
