import { EphemeraMapUpdate } from '../lifeLine/ephemera';
import { ISSMAttemptNode, ISSMChoiceNode, ISSMHoldNode, ISSMHoldCondition, ISSMDataLayout, ISSMDataReturn, ISSMAction } from '../stateSeekingMachine/baseClasses'

export interface ActiveCharacterInternal {
    id?: string;
    LastMessageSync?: number;
    subscription?: any;
    incrementalBackoff: number;
}

// type ActiveCharacterMapExit = {
//     name?: string;
//     to: string;
//     toEphemeraId: string;
//     key: string;
// }

// type ActiveCharacterMapRoom = {
//     EphemeraId: string;
//     exits?: ActiveCharacterMapExit[];
//     name?: string[];
//     x?: number;
//     y?: number;
// }

// export type ActiveCharacterMap = {
//     MapId: string;
//     Name: string;
//     fileURL?: string;
//     rooms: Record<string, ActiveCharacterMapRoom>
// }

export type ActiveCharacterMap = Omit<EphemeraMapUpdate, 'type' | 'targets'>

export interface ActiveCharacterPublic {
    maps: Record<string, ActiveCharacterMap>;
}

export type ActiveCharacterRecord = ISSMDataLayout<ActiveCharacterInternal, ActiveCharacterPublic>
export type ActiveCharacterReturn = ISSMDataReturn<ActiveCharacterInternal, ActiveCharacterPublic>
export type ActiveCharacterAction = ISSMAction<ActiveCharacterInternal, ActiveCharacterPublic>
export type ActiveCharacterCondition = ISSMHoldCondition<ActiveCharacterInternal, ActiveCharacterPublic>

export interface ActiveCharacterNodes {
    INITIAL: ISSMHoldNode<ActiveCharacterInternal, ActiveCharacterPublic>;
    FETCHFROMCACHE: ISSMAttemptNode<ActiveCharacterInternal, ActiveCharacterPublic>;
    REGISTER: ISSMAttemptNode<ActiveCharacterInternal, ActiveCharacterPublic>;
    SYNCHRONIZE: ISSMAttemptNode<ActiveCharacterInternal, ActiveCharacterPublic>;
    SYNCHRONIZEBACKOFF: ISSMAttemptNode<ActiveCharacterInternal, ActiveCharacterPublic>;
    CONNECTED: ISSMChoiceNode;
    MAPSUBSCRIBE: ISSMAttemptNode<ActiveCharacterInternal, ActiveCharacterPublic>;
    MAPSUBSCRIBED: ISSMChoiceNode;
    ERROR: ISSMChoiceNode;
}
