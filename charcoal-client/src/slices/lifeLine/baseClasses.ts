import { ISSMAttemptNode, ISSMChoiceNode, ISSMHoldNode, ISSMHoldCondition, ISSMDataLayout, ISSMDataReturn, ISSMAction } from '../stateSeekingMachine/baseClasses'

type IntervalType = ReturnType<typeof setInterval>
type TimeoutType = ReturnType<typeof setTimeout>

export interface LifeLineInternal {
    pingInterval: IntervalType | null;
    refreshTimeout: TimeoutType | null;
    messageSubscription: string | null;
    incrementalBackoff: number;
}

export interface LifeLinePublic {
    webSocket: WebSocket | null;
}

export type LifeLineRecord = ISSMDataLayout<LifeLineInternal, LifeLinePublic>
export type LifeLineReturn = ISSMDataReturn<LifeLineInternal, LifeLinePublic>
export type LifeLineAction = ISSMAction<LifeLineInternal, LifeLinePublic>
export type LifeLineCondition = ISSMHoldCondition<LifeLineInternal, LifeLinePublic>

export interface LifeLineNodes {
    INITIAL: ISSMChoiceNode;
    SUBSCRIBE: ISSMAttemptNode<LifeLineInternal, LifeLinePublic>;
    CONNECT: ISSMAttemptNode<LifeLineInternal, LifeLinePublic>;
    CONNECTBACKOFF: ISSMAttemptNode<LifeLineInternal, LifeLinePublic>;
    CONNECTED: ISSMChoiceNode;
    DISCONNECT: ISSMAttemptNode<LifeLineInternal, LifeLinePublic>;
    UNSUBSCRIBE: ISSMAttemptNode<LifeLineInternal, LifeLinePublic>;
    STALE: ISSMChoiceNode;
    ERROR: ISSMChoiceNode;
}

export type ParseCommandModes = 'SayMessage' | 'NarrateMessage' | 'Command'

export interface ParseCommandProps {
    mode: ParseCommandModes;
    entry: string;
    raiseError: (error: string) => void;
}
