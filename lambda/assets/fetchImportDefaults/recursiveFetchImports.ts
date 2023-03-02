import { SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses";
import internalCache from "../internalCache";
import normalSubset from "./normalSubset"

type RecursiveFetchImportArgument = {
    assetId: `ASSET#${string}`;
    keys: string[];
    stubKeys: string[];
}

export const recursiveFetchImports = async ({ assetId, keys, stubKeys }: RecursiveFetchImportArgument): Promise<SchemaTag[]> => {
    const { normal } = await internalCache.JSONFile.get(assetId)
    //
    // Coming straight from the datalake, this normal should already be in standardized form,
    // and can be fed directly to normalSubset
    //

    //
    // TODO: ISS-2246: Extend normalSubset to return an updated list of stubKeys, in addition to
    // the SchemaTag main output, and use that to determine what needs to be looked up
    // as possible imports from a different asset, to fill out yet more of the
    // layers of inheritance.
    //

    //
    // TODO: ISS-2247: Rename imports from recursive calls, to match them with their original aliases
    //

    //
    // TODO: ISS-2248: Rename stubKeys from recursive calls, if needed to avoid conflict with names
    // in the original asset (or other imported stubKeys)
    //
    return normalSubset({ normal, keys, stubKeys })

}

export default recursiveFetchImports
