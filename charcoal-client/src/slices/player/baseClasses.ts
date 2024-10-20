import { AssetClientPlayerMessage } from '@tonylb/mtw-interfaces/dist/asset';
import { ISSMAttemptNode, ISSMChoiceNode, ISSMHoldNode, ISSMHoldCondition, ISSMDataLayout, ISSMDataReturn, ISSMAction, ISSMRedirectNode } from '../stateSeekingMachine/baseClasses'

export interface PlayerInternal {
    subscription?: any;
    incrementalBackoff: number;
}

export type PlayerPublic = Omit<AssetClientPlayerMessage, 'messageType' | 'RequestId'>

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
    FETCHNOTIFICATIONS: ISSMAttemptNode<PlayerInternal, PlayerPublic>;
    SYNCHRONIZE: ISSMAttemptNode<PlayerInternal, PlayerPublic>;
    FETCHDRAFTASSET: ISSMAttemptNode<PlayerInternal, PlayerPublic>;
    CONNECTED: ISSMChoiceNode;
    SIGNOUT: ISSMRedirectNode;
    UNSUBSCRIBE: ISSMAttemptNode<PlayerInternal, PlayerPublic>;
    ERROR: ISSMChoiceNode;
}
