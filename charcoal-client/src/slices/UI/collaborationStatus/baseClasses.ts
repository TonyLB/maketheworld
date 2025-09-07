import { ISSMAttemptNode, ISSMChoiceNode, ISSMHoldNode, ISSMData } from '../../stateSeekingMachine/baseClasses'

export interface CollaborationStatusInternal {
    incrementalBackoff: number;
    error?: string;
}

export interface CollaborationStatusPublic {
    status?: {
        phase: 'Bootstrap' | 'Active' | 'Paused' | 'Error';
    };
    loading: boolean;
}

export type CollaborationStatusAction = ISSMAttemptNode<CollaborationStatusInternal, CollaborationStatusPublic>['action']

export type CollaborationStatusCondition = (data: {
    internalData: Partial<CollaborationStatusInternal>;
    publicData: Partial<CollaborationStatusPublic>;
}, getState: any) => boolean

export interface CollaborationStatusNodes {
    INITIAL: ISSMChoiceNode;
    WAIT_FOR_CONNECTION: ISSMHoldNode<CollaborationStatusInternal, CollaborationStatusPublic>;
    FETCHING: ISSMAttemptNode<CollaborationStatusInternal, CollaborationStatusPublic>;
    SUCCESS: ISSMChoiceNode;
    ERROR: ISSMChoiceNode;
    BACKOFF: ISSMAttemptNode<CollaborationStatusInternal, CollaborationStatusPublic>;
}
