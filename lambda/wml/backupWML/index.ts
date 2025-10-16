import { EphemeraAssetId } from "@tonylb/mtw-interfaces/ts/baseClasses"

export type BackupWMLArguments = {
    assetId: EphemeraAssetId;
    to: string;
}

/**
 * Phase 1B: Stubbed out for Phase 2 S3 refactor
 * 
 * Backup functionality will be completely redesigned in Phase 2
 * to work with the new flat UUID-based storage architecture.
 * 
 * This stub exists to maintain API compatibility with existing
 * app.ts handlers during the transition.
 */
export const backupWML = async (args: BackupWMLArguments) => {
    throw new Error('Backup functionality temporarily disabled during Phase 1B migration. Will be reimplemented in Phase 2.')
}

export default backupWML

/* ============================================================================
 * ORIGINAL IMPLEMENTATION - Preserved for Phase 2 reference
 * 
 * The tar-stream packaging logic below will be useful when reimplementing
 * backup functionality with flat UUID-based storage.
 * ============================================================================

import AssetWorkspace, { AssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace"
import { s3Client } from "../clients"
import { Upload } from "@aws-sdk/lib-storage"
import { GetObjectCommand } from "@aws-sdk/client-s3"
import { Readable, PassThrough, pipeline } from "node:stream"
import { createGzip } from "node:zlib"
import tar from "tar-stream"
import StandardImage from "@tonylb/mtw-wml/ts/standardize/components/image"

export type BackupWMLArguments = {
    from: AssetWorkspaceAddress;
    to: string;
}

//
// backupWML takes the WML and associated files from a certain address, and saves them to another
// location in compressed tar.gz format.
//
export const backupWML = async (args: BackupWMLArguments) => {
    //
    // Fetch all information you will need in order to change the internal structure of the file
    //
    const fromWorkspace = new AssetWorkspace(args.from)

    await fromWorkspace.loadJSON()

    //
    // Open streams for WML and file associations
    //
    const [wml, ...images] = await Promise.all([
        s3Client.send(new GetObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: `${fromWorkspace.filePath}${fromWorkspace.fileName}.wml`
        })),
        ...Object.values(fromWorkspace.standard?.byId ?? {})
            .filter((component) => (component instanceof StandardImage))
            .map((component) => ({ key: component.key, fileName: component.fileName }))
            .filter(({ fileName }) => (fileName))
            .map(async ({ key, fileName }) => {
                    const { Body, ContentLength } = await s3Client.send(new GetObjectCommand({
                        Bucket: process.env.IMAGES_BUCKET,
                        Key: fileName
                    }))
                    return { key, Body, ContentLength }
            })
    ])
    const filteredImages = images
        .filter(({ Body }) => (Body && Body instanceof Readable))

    //
    // Pipe streams into tar-stream
    //
    const pack = tar.pack()
    const { Body: wmlBody } = wml
    if (wmlBody && wmlBody instanceof Readable) {
        if (filteredImages.length) {
            wmlBody.pipe(pack.entry({ name: `${fromWorkspace.fileName}.wml`, size: wml.ContentLength }))
        }
        else {
            wmlBody.pipe(pack.entry({ name: `${fromWorkspace.fileName}.wml`, size: wml.ContentLength }, () => {
                pack.finalize()
            }))
        }
    }
    else {
        throw new Error('No WML file found')
    }
    filteredImages
        .forEach(({ key, Body, ContentLength }, index) => {
            const stream = Body as unknown as Readable
            if (index === filteredImages.length - 1) {
                stream.pipe(pack.entry({ name: `${key}.png`, size: ContentLength }, () => {
                    pack.finalize()
                }))
            }
            else {
                stream.pipe(pack.entry({ name: `${key}.png`, size: ContentLength }))
            }
        })

    //
    // Pipe resulting tar-stream through zlib
    //
    const dataPassThrough = new PassThrough()
    const gzip = createGzip()
    pipeline(pack, gzip, dataPassThrough, () => {
        console.log(`Pipeline error in backupWML`)
    })

    //
    // Pipe resulting tar.gz stream to S3 Upload
    //
    const upload = new Upload({
        client: s3Client,
        params: {
            Bucket: process.env.S3_BUCKET,
            Key: args.to,
            Body: dataPassThrough
        }
    })
    await upload.done()
}

export default backupWML

============================================================================ */
