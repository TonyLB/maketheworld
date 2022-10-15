import { EphemeraClientMessageEphemeraUpdateMapItemActive } from '@tonylb/mtw-interfaces/dist/ephemera'
import { ISSMAttemptNode, ISSMChoiceNode, ISSMHoldNode, ISSMHoldCondition, ISSMDataLayout, ISSMDataReturn, ISSMAction } from '../stateSeekingMachine/baseClasses'

export interface ActiveCharacterInternal {
    id?: string;
    LastMessageSync?: number;
    subscription?: any;
    incrementalBackoff: number;
}

export type ActiveCharacterMap = Omit<EphemeraClientMessageEphemeraUpdateMapItemActive, 'type' | 'targets' | 'active'>

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
