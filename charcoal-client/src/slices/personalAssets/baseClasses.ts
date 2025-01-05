import { AssetClientFetchURL, AssetClientUploadURL } from '@tonylb/mtw-interfaces/dist/asset';
import { GenericTree } from '@tonylb/mtw-base/dist/genericTree'
import { ISSMAttemptNode, ISSMChoiceNode, ISSMHoldNode, ISSMHoldCondition, ISSMRedirectNode, ISSMDataLayout, ISSMDataReturn, ISSMAction } from '../stateSeekingMachine/baseClasses'
import { StandardFormData } from '@tonylb/mtw-wml/dist/standardize/components/dataTypes';
import { SchemaTag } from '@tonylb/mtw-base/dist/schema';
import { SchemaMetaTag } from '@tonylb/mtw-base/dist/schema/metaData';

export interface PersonalAssetsInternal {
    id?: string;
    incrementalBackoff: number;
    fetchURL?: string;
    saveURL?: string;
    s3Object?: string;
    saveImages?: AssetClientUploadURL["images"];
    uploadRequestId?: string;
    error?: {
        error?: string;
        errorStart?: number;
        errorEnd?: number;
    };
    subscription?: any;
}

export type PersonalAssetsLoadedImage = {
    loadId: string;
    file: File;
}

export interface PersonalAssetsPublic {
    originalWML?: string;
    currentWML?: string;
    draftWML?: string;
    //
    // importData is the set of schemata that are inherited from imports
    //
    importData: Record<string, GenericTree<SchemaTag>>;
    //
    // base is the standard form of the pre-existing data be edited (either or both of an asset being
    // updated, or inherited data from imports)
    //
    base: StandardFormData;
    //
    // pendingEdits holds the edit assets that have been streamed out to WML for update into the
    // relevant personalAsset (but which have not yet been reflected back through the asset
    // subscription)
    //
    pendingEdits: {
        meta: SchemaMetaTag;
        edit: StandardFormData;
    }[];

    //
    // edit holds the current edit asset that reflects the changes made since the last attempt to
    // stream edits out to the WML back end.
    //
    edit: StandardFormData;

    //
    // inherited is the standard form of data inherited from imports
    //
    inherited: StandardFormData;
    properties: AssetClientFetchURL["properties"];
    loadedImages: Record<string, PersonalAssetsLoadedImage>;
    serialized?: boolean;
}

export type PersonalAssetsData = {
    internalData: PersonalAssetsInternal;
    publicData: PersonalAssetsPublic;
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
    FETCHERROR: ISSMChoiceNode;
    FETCHIMPORTS: ISSMAttemptNode<PersonalAssetsInternal, PersonalAssetsPublic>;
    FRESH: ISSMChoiceNode;
    WMLDIRTY: ISSMChoiceNode;
    NEEDPARSE: ISSMRedirectNode;
    PARSEDRAFT: ISSMAttemptNode<PersonalAssetsInternal, PersonalAssetsPublic>;
    NEEDERROR: ISSMRedirectNode;
    DRAFTERROR: ISSMChoiceNode;
    WMLERROR: ISSMChoiceNode;
    NEW: ISSMAttemptNode<PersonalAssetsInternal, PersonalAssetsPublic>;
    SCHEMADIRTY: ISSMChoiceNode;
    REGENERATEWML: ISSMAttemptNode<PersonalAssetsInternal, PersonalAssetsPublic>;
    NEEDSAVE: ISSMRedirectNode;
    GETSAVEURL: ISSMAttemptNode<PersonalAssetsInternal, PersonalAssetsPublic>;
    SAVE: ISSMAttemptNode<PersonalAssetsInternal, PersonalAssetsPublic>;
    PARSE: ISSMAttemptNode<PersonalAssetsInternal, PersonalAssetsPublic>;
    SAVEERROR: ISSMRedirectNode;
    CLEAR: ISSMAttemptNode<PersonalAssetsInternal, PersonalAssetsPublic>;
}
