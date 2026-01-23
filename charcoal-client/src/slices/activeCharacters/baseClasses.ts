import { EphemeraCharacterId, EphemeraMapId, EphemeraAssetId } from '@tonylb/mtw-interfaces/ts/baseClasses';
import { EphemeraClientMessageEphemeraUpdateMapItemActive } from '@tonylb/mtw-interfaces/ts/ephemera'
import { ISSMAttemptNode, ISSMChoiceNode, ISSMHoldNode, ISSMHoldCondition, ISSMDataLayout, ISSMDataReturn, ISSMAction } from '../stateSeekingMachine/baseClasses'

export interface ActiveCharacterInternal {
    id?: EphemeraCharacterId;
    LastMessageSync?: number;
    subscription?: any;
    incrementalBackoff: number;
}

export type ActiveCharacterMapRoom = {
    roomId: string;
    name: string;
    x: number;
    y: number;
    exits: Array<{ name: string; to: string }>;
}

export type ActiveCharacterMap = {
    MapId: EphemeraMapId;
    description: string;
    name: string;
    rooms: ActiveCharacterMapRoom[];
    assets: Record<EphemeraAssetId, string>;
    fileURL?: string;
}

export interface ActiveCharacterPublic {
    maps: Record<EphemeraMapId, ActiveCharacterMap>;
}

export type ActiveCharacterData = {
    internalData: ActiveCharacterInternal;
    publicData: ActiveCharacterPublic;
}

export type ActiveCharacterRecord = ISSMDataLayout<ActiveCharacterInternal, ActiveCharacterPublic>
export type ActiveCharacterReturn = ISSMDataReturn<ActiveCharacterInternal, ActiveCharacterPublic>
export type ActiveCharacterAction = ISSMAction<ActiveCharacterInternal, ActiveCharacterPublic>
export type ActiveCharacterCondition = ISSMHoldCondition<ActiveCharacterInternal, ActiveCharacterPublic>

export interface ActiveCharacterNodes {
    INITIAL: ISSMHoldNode<ActiveCharacterInternal, ActiveCharacterPublic>;
    INACTIVE: ISSMChoiceNode;
    FETCHFROMCACHE: ISSMAttemptNode<ActiveCharacterInternal, ActiveCharacterPublic>;
    REGISTER: ISSMAttemptNode<ActiveCharacterInternal, ActiveCharacterPublic>;
    SYNCHRONIZE: ISSMAttemptNode<ActiveCharacterInternal, ActiveCharacterPublic>;
    SYNCHRONIZEBACKOFF: ISSMAttemptNode<ActiveCharacterInternal, ActiveCharacterPublic>;
    CONNECTED: ISSMChoiceNode;
    UNREGISTER: ISSMAttemptNode<ActiveCharacterInternal, ActiveCharacterPublic>;
    MAPSUBSCRIBE: ISSMAttemptNode<ActiveCharacterInternal, ActiveCharacterPublic>;
    MAPSUBSCRIBED: ISSMChoiceNode;
    MAPUNSUBSCRIBE: ISSMAttemptNode<ActiveCharacterInternal, ActiveCharacterPublic>;
    ERROR: ISSMChoiceNode;
}
