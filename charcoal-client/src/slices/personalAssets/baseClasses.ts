import { AssetClientFetchURL, AssetClientUploadURL } from '@tonylb/mtw-interfaces/dist/asset';
import { NormalForm } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { Standardizer } from '@tonylb/mtw-wml/dist/standardize'
import { GenericTree, TreeId } from '@tonylb/mtw-wml/dist/tree/baseClasses'
import { ISSMAttemptNode, ISSMChoiceNode, ISSMHoldNode, ISSMHoldCondition, ISSMRedirectNode, ISSMDataLayout, ISSMDataReturn, ISSMAction } from '../stateSeekingMachine/baseClasses'
import { SchemaTag } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import { StandardComponent } from '@tonylb/mtw-wml/dist/standardize/baseClasses';

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
    standardizer?: Standardizer;

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
    // baseSchema is the schema derived purely from WML (i.e., the local
    // schema without inherited data)
    //
    baseSchema: GenericTree<SchemaTag, TreeId>;
    //
    // importData is the set of schemata that are inherited from imports
    //
    importData: Record<string, GenericTree<SchemaTag, TreeId>>;
    //
    // schema is the combination of the baseSchema with all of the
    // data it inherits from imports
    //
    schema: GenericTree<SchemaTag, TreeId>;
    standard: Record<string, StandardComponent>;
    normal: NormalForm;
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
    SAVEBACKOFF: ISSMAttemptNode<PersonalAssetsInternal, PersonalAssetsPublic>;
    SAVEERROR: ISSMChoiceNode;
    CLEAR: ISSMAttemptNode<PersonalAssetsInternal, PersonalAssetsPublic>;
}
