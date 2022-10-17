import { EphemeraCharacterId, EphemeraRoomId, LegalCharacterColor } from '@tonylb/mtw-interfaces/dist/baseClasses';
import { EphemeraClientMessageEphemeraUpdateCharacterInPlay, EphemeraClientMessageEphemeraUpdateCharacterInPlayActive } from '@tonylb/mtw-interfaces/dist/ephemera';
import { ISSMAttemptNode, ISSMChoiceNode, ISSMHoldNode, ISSMHoldCondition, ISSMDataLayout, ISSMDataReturn, ISSMAction } from '../stateSeekingMachine/baseClasses'

export interface EphemeraInternal {
    subscription?: any;
    incrementalBackoff: number;
}

export type EphemeraCharacterColor = {
    name: LegalCharacterColor;
    primary: string;
    light: string;
    recap: string;
    recapLight: string;
    direct: string;
}

export type EphemeraCharacterInPlay = Omit<EphemeraClientMessageEphemeraUpdateCharacterInPlayActive, 'Connected' | 'type' | 'Color'> & {
    color: EphemeraCharacterColor
}

export interface EphemeraPublic {
    charactersInPlay: Record<EphemeraCharacterId, EphemeraCharacterInPlay>
}

export type EphemeraRecord = ISSMDataLayout<EphemeraInternal, EphemeraPublic>
export type EphemeraReturn = ISSMDataReturn<EphemeraInternal, EphemeraPublic>
export type EphemeraAction = ISSMAction<EphemeraInternal, EphemeraPublic>
export type EphemeraCondition = ISSMHoldCondition<EphemeraInternal, EphemeraPublic>

export interface EphemeraNodes {
    INITIAL: ISSMHoldNode<EphemeraInternal, EphemeraPublic>;
    SUBSCRIBE: ISSMAttemptNode<EphemeraInternal, EphemeraPublic>;
    SYNCHRONIZE: ISSMAttemptNode<EphemeraInternal, EphemeraPublic>;
    CONNECTED: ISSMChoiceNode;
    UNSUBSCRIBE: ISSMAttemptNode<EphemeraInternal, EphemeraPublic>;
    ERROR: ISSMChoiceNode;
}
