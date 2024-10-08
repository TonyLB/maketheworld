import { Schema } from "@tonylb/mtw-wml/ts/schema";
import { Standardizer } from "@tonylb/mtw-wml/ts/standardize";
import assetAtomicLock from "../atomicLock";

export type ApplyEditArguments = {
    schema: string;
}

export const applyEdit = async (args: ApplyEditArguments): Promise<Record<string, any>> => {
    //
    // Create an editStandardizer to be merged with ndjson. Complete
    // this step before requesting a lock on the files.
    //
    const editSchema = new Schema()
    editSchema.loadWML(args.schema)
    const editStandardizer = new Standardizer(editSchema.schema)
    
    //
    // Await atomicLock for asset
    //
    const lock = await assetAtomicLock(`ASSET#${editStandardizer._assetKey}`)

    //
    // TODO: Write ndjson
    //

    //
    // TODO: Write wml
    //

    //
    // TODO: Yield atomicLock for asset
    //
    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Success' })
    }
}

export default applyEdit
