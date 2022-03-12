import { ISSMAttemptNode, ISSMChoiceNode, ISSMHoldNode, ISSMHoldCondition, ISSMDataLayout, ISSMDataReturn, ISSMAction } from '../stateSeekingMachine/baseClasses'

export interface PlayerInternal {
    subscription?: any;
    incrementalBackoff: number;
}

export type PlayerAsset = {
    AssetId: string;
    Story?: boolean;
    instance?: boolean;
}

export type PlayerCharacter = {
    CharacterId: string;
    Name: string;
    scopedId: string;
    fileName: string;
    fileURL?: string;
}

export interface PlayerPublic {
    PlayerName: string;
    CodeOfConductConsent: boolean;
    Assets: PlayerAsset[];
    Characters: PlayerCharacter[];
}

export type PlayerRecord = ISSMDataLayout<PlayerInternal, PlayerPublic>
export type PlayerReturn = ISSMDataReturn<PlayerInternal, PlayerPublic>
export type PlayerAction = ISSMAction<PlayerInternal, PlayerPublic>
export type PlayerCondition = ISSMHoldCondition<PlayerInternal, PlayerPublic>

export interface PlayerNodes {
    INITIAL: ISSMHoldNode<PlayerInternal, PlayerPublic>;
    SUBSCRIBE: ISSMAttemptNode<PlayerInternal, PlayerPublic>;
    SYNCHRONIZE: ISSMAttemptNode<PlayerInternal, PlayerPublic>;
    CONNECTED: ISSMChoiceNode;
    UNSUBSCRIBE: ISSMAttemptNode<PlayerInternal, PlayerPublic>;
    ERROR: ISSMChoiceNode;
}
