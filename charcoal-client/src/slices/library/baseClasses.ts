import { ISSMAttemptNode, ISSMChoiceNode, ISSMHoldNode, ISSMHoldCondition, ISSMDataLayout, ISSMDataReturn, ISSMAction } from '../stateSeekingMachine/baseClasses'
import { LibraryAsset, LibraryCharacter } from '@tonylb/mtw-interfaces/dist/library'

export interface LibraryInternal {
    subscription?: any;
    incrementalBackoff: number;
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
