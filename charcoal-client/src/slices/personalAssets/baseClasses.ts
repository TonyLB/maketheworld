import { AssetClientFetchURL, AssetClientUploadURL } from '@tonylb/mtw-interfaces/ts/asset';
import { GenericTree } from '@tonylb/mtw-base/ts/genericTree'
import { ISSMAttemptNode, ISSMChoiceNode, ISSMHoldNode, ISSMHoldCondition, ISSMRedirectNode, ISSMDataLayout, ISSMDataReturn, ISSMAction } from '../stateSeekingMachine/baseClasses'
import { StandardFormData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes';
import { SchemaTag } from '@tonylb/mtw-base/ts/schema';
import { SchemaMetaTag } from '@tonylb/mtw-base/ts/schema/metaData';
import { AssetUUID } from '@tonylb/mtw-base/ts/schema';

export interface PersonalAssetsInternal {
    id?: AssetUUID;
    incrementalBackoff: number;
    /** @deprecated No longer used; WML comes from dataSource Snapshot. Kept for getFetchURL helper. */
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
    // inherited is the standard form of data inherited from imports
    //
    inherited: StandardFormData;
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
    SUBSCRIBE: ISSMAttemptNode<PersonalAssetsInternal, PersonalAssetsPublic>;
    SUBSCRIBEBACKOFF: ISSMAttemptNode<PersonalAssetsInternal, PersonalAssetsPublic>;
    SUBSCRIBED: ISSMHoldNode<PersonalAssetsInternal, PersonalAssetsPublic>;
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
    CLEAR: ISSMAttemptNode<PersonalAssetsInternal, PersonalAssetsPublic>;
}
