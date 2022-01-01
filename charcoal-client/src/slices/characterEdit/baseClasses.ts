import { ISSMAttemptNode, ISSMChoiceNode, ISSMHoldNode, ISSMHoldCondition, ISSMDataLayout, ISSMDataReturn, ISSMAction } from '../stateSeekingMachine/baseClasses'

export type CharacterEditKeys = 'assetKey' | 'Name' | 'Pronouns' | 'FirstImpression' | 'OneCoolThing' | 'Outfit'

export interface CharacterEditInternal {
    id?: string;
    fetchURL?: string;
    postURL?: string;
    uploadRequestId?: string;
    characterWML?: string;
}

export interface CharacterEditPublic {
    defaultValue: Partial<Record<CharacterEditKeys, string>>,
    value: Partial<Record<CharacterEditKeys, string>>
}

export type CharacterEditRecord = ISSMDataLayout<CharacterEditInternal, CharacterEditPublic>
export type CharacterEditReturn = ISSMDataReturn<CharacterEditInternal, CharacterEditPublic>
export type CharacterEditAction = ISSMAction<CharacterEditInternal, CharacterEditPublic>
export type CharacterEditCondition = ISSMHoldCondition<CharacterEditInternal, CharacterEditPublic>

export interface CharacterEditNodes {
    INITIAL: ISSMHoldNode<CharacterEditInternal, CharacterEditPublic>;
    GETURL: ISSMAttemptNode<CharacterEditInternal, CharacterEditPublic>;
    FETCH: ISSMAttemptNode<CharacterEditInternal, CharacterEditPublic>;
    PARSE: ISSMAttemptNode<CharacterEditInternal, CharacterEditPublic>;
    PARSED: ISSMChoiceNode;
    INITIATESAVE: ISSMAttemptNode<CharacterEditInternal, CharacterEditPublic>;
    POSTSAVE: ISSMAttemptNode<CharacterEditInternal, CharacterEditPublic>;
    ERROR: ISSMChoiceNode;
}
