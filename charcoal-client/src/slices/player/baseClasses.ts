import { AssetClientPlayerAsset, AssetClientPlayerCharacter, AssetClientPlayerSettings } from '@tonylb/mtw-interfaces/ts/asset';
import { ISSMAttemptNode, ISSMChoiceNode, ISSMHoldNode, ISSMHoldCondition, ISSMDataLayout, ISSMDataReturn, ISSMAction, ISSMRedirectNode } from '../stateSeekingMachine/baseClasses'

export interface PlayerInternal {
    subscription?: any;
    incrementalBackoff: number;
}

// PlayerPublic type - matches the shape of player data (formerly derived from AssetClientPlayerMessage)
export type PlayerPublic = {
    PlayerName: string;
    CodeOfConductConsent: boolean;
    Assets: AssetClientPlayerAsset[];
    Characters: AssetClientPlayerCharacter[];
    Settings: AssetClientPlayerSettings;
    SessionId: string;
}

export type PlayerData = {
    internalData: PlayerInternal;
    publicData: PlayerPublic;
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
    SIGNOUT: ISSMRedirectNode;
    UNSUBSCRIBE: ISSMAttemptNode<PlayerInternal, PlayerPublic>;
    ERROR: ISSMChoiceNode;
}
