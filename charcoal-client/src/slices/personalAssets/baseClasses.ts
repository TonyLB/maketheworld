import { AssetClientFetchURL, AssetClientUploadURL } from '@tonylb/mtw-interfaces/ts/asset';
import { GenericTree } from '@tonylb/mtw-base/ts/genericTree'
import { ISSMAttemptNode, ISSMChoiceNode, ISSMHoldNode, ISSMHoldCondition, ISSMDataLayout, ISSMDataReturn, ISSMAction } from '../stateSeekingMachine/baseClasses'
import { StandardFormData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes';
import { SchemaTag } from '@tonylb/mtw-base/ts/schema';
import type { ScopedInstrumentationOptions } from '../../testing/scopedInstrumentation';

export type PendingEditMeta = { key: string; time: number; instrumentationOptions?: ScopedInstrumentationOptions };
import { AssetUUID } from '@tonylb/mtw-base/ts/schema';

export interface PersonalAssetsInternal {
    id?: AssetUUID;
    incrementalBackoff: number;
    saveURL?: string;
    s3Object?: string;
    saveImages?: AssetClientUploadURL["images"];
    uploadRequestId?: string;
    error?: {
        error?: string;
        errorStart?: number;
        errorEnd?: number;
    };
}

export type PersonalAssetsLoadedImage = {
    loadId: string;
    file: File;
}

export interface PersonalAssetsPublic {
    //
    // importData is the set of schemata that are inherited from imports
    //
    importData: Record<string, GenericTree<SchemaTag>>;

    //
    // inherited is the standard form of data inherited from imports
    //
    inherited: StandardFormData;
    //
    // pendingEdits holds optimistic edits enqueued before applyEdit send; stream confirm clears
    // rows via wmlDataSource afterProcessEnvelope -> pendingHygieneCheck
    //
    pendingEdits: {
        meta: PendingEditMeta;
        edit: StandardFormData;
    }[];

    //
    // edit holds the current edit asset that reflects the changes made since the last attempt to
    // stream edits out to the WML back end.
    //
    edit: StandardFormData;

    /** Aggregate of instrumentation options from all updateStandard calls in the current edit slice; used when converting edit to pendingEdit and for gating applyEdit logs. Cleared on save. */
    instrumentationOptionsForCurrentEdit?: ScopedInstrumentationOptions;

    /** JSON form of the diff last merged into edit by updateStandard; used for client-driven side-effects (e.g. fetchImports when diff has `from`). Cleared by clearLastUpdateDiff. */
    lastUpdateDiff?: StandardFormData;

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
    WAIT_WML_READY: ISSMHoldNode<PersonalAssetsInternal, PersonalAssetsPublic>;
    SUBSCRIBE: ISSMAttemptNode<PersonalAssetsInternal, PersonalAssetsPublic>;
    SUBSCRIBEBACKOFF: ISSMAttemptNode<PersonalAssetsInternal, PersonalAssetsPublic>;
    SUBSCRIBED: ISSMHoldNode<PersonalAssetsInternal, PersonalAssetsPublic>;
    FETCHERROR: ISSMChoiceNode;
    FETCHIMPORTS: ISSMAttemptNode<PersonalAssetsInternal, PersonalAssetsPublic>;
    FRESH: ISSMChoiceNode;
    WMLERROR: ISSMChoiceNode;
    NEW: ISSMAttemptNode<PersonalAssetsInternal, PersonalAssetsPublic>;
    SCHEMADIRTY: ISSMHoldNode<PersonalAssetsInternal, PersonalAssetsPublic>;
    CLEAR: ISSMAttemptNode<PersonalAssetsInternal, PersonalAssetsPublic>;
}
