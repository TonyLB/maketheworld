import { AssetClientFetchURL, AssetClientImportDefaults, AssetClientUploadURL } from '@tonylb/mtw-interfaces/dist/asset';
import { NormalForm } from '@tonylb/mtw-wml/dist/normalize/baseClasses';
import { SchemaTag } from '@tonylb/mtw-wml/dist/schema/baseClasses';
import { ISSMAttemptNode, ISSMChoiceNode, ISSMHoldNode, ISSMHoldCondition, ISSMRedirectNode, ISSMDataLayout, ISSMDataReturn, ISSMAction } from '../stateSeekingMachine/baseClasses'

export interface PersonalAssetsInternal {
    id?: string;
    incrementalBackoff: number;
    fetchURL?: string;
    saveURL?: string;
    s3Object?: string;
    saveImages?: AssetClientUploadURL["images"];
    uploadRequestId?: string;
}

export type PersonalAssetsLoadedImage = {
    loadId: string;
    file: File;
}

export interface PersonalAssetsPublic {
    originalWML?: string;
    currentWML?: string;
    draftWML?: string;
    normal: NormalForm;
    importDefaults: AssetClientImportDefaults["defaultsByKey"];
    properties: AssetClientFetchURL["properties"];
    loadedImages: Record<string, PersonalAssetsLoadedImage>;
}

export type PersonalAssetsRecord = ISSMDataLayout<PersonalAssetsInternal, PersonalAssetsPublic>
export type PersonalAssetsReturn = ISSMDataReturn<PersonalAssetsInternal, PersonalAssetsPublic>
export type PersonalAssetsAction = ISSMAction<PersonalAssetsInternal, PersonalAssetsPublic>
export type PersonalAssetsCondition = ISSMHoldCondition<PersonalAssetsInternal, PersonalAssetsPublic>

export interface PersonalAssetsNodes {
    INITIAL: ISSMHoldNode<PersonalAssetsInternal, PersonalAssetsPublic>;
    INACTIVE: ISSMChoiceNode;
    FETCHURL: ISSMAttemptNode<PersonalAssetsInternal, PersonalAssetsPublic>;
    FETCHURLBACKOFF: ISSMAttemptNode<PersonalAssetsInternal, PersonalAssetsPublic>;
    FETCH: ISSMAttemptNode<PersonalAssetsInternal, PersonalAssetsPublic>;
    FETCHBACKOFF: ISSMAttemptNode<PersonalAssetsInternal, PersonalAssetsPublic>;
    FETCHDEFAULTS: ISSMAttemptNode<PersonalAssetsInternal, PersonalAssetsPublic>;
    FETCHDEFAULTSBACKOFF: ISSMAttemptNode<PersonalAssetsInternal, PersonalAssetsPublic>;
    FETCHERROR: ISSMChoiceNode;
    FRESH: ISSMChoiceNode;
    WMLDIRTY: ISSMChoiceNode;
    WMLERROR: ISSMChoiceNode;
    NORMALDIRTY: ISSMChoiceNode;
    REGENERATEWML: ISSMAttemptNode<PersonalAssetsInternal, PersonalAssetsPublic>;
    NEEDSAVE: ISSMRedirectNode;
    GETSAVEURL: ISSMAttemptNode<PersonalAssetsInternal, PersonalAssetsPublic>;
    SAVE: ISSMAttemptNode<PersonalAssetsInternal, PersonalAssetsPublic>;
    PARSE: ISSMAttemptNode<PersonalAssetsInternal, PersonalAssetsPublic>;
    SAVEBACKOFF: ISSMAttemptNode<PersonalAssetsInternal, PersonalAssetsPublic>;
    SAVEERROR: ISSMChoiceNode;
    CLEAR: ISSMAttemptNode<PersonalAssetsInternal, PersonalAssetsPublic>;
}
