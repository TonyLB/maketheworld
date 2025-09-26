import { parseWMLHandler } from './parseWML'
import copyWML from './copyWML';
import { resetWML } from './resetWML';
import backupWML from "./backupWML";
import applyEdit from "./applyEdit";
import { checkLock, requestLock, yieldAtomicLock } from "./atomicLock";
import delayPromise from "@tonylb/mtw-utilities/ts/dynamoDB/delayPromise";
import internalCache from "./internalCache";
import { S3Client } from "@aws-sdk/client-s3";
import messageBus from "./messageBus";
import { extractReturnValue } from "./returnValue/index";

const params = { region: process.env.AWS_REGION }
const s3Client = new S3Client(params)

export const handler = async (event: any) => {

    internalCache.clear()
    internalCache.Connection.set({ key: 's3Client', value: s3Client })
    messageBus.clear()

    switch(event.message) {
        case 'parseWML':
            return await parseWMLHandler(event)
        case 'copyWML':
            return await copyWML(event)
        case 'backupWML':
            return await backupWML(event)
        case 'resetWML':
            if (event.address.zone === 'Draft') {
                return await resetWML({
                    ...event,
                    key: `draft[${event.address.player}]`
                })
            }
            else {
                return await resetWML(event)
            }
        case 'requestLock':
            const lock = await requestLock(event.AssetId)
            return await checkLock(event.AssetId, lock)
        case 'checkLock':
            await delayPromise(500)
            return await checkLock(event.AssetId, event.lock, event.timeoutCounter)
        case 'yieldLock':
            await yieldAtomicLock(event.AssetId, event.lock)
            return {}
        case 'applyEdit':
            return await applyEdit(event)
        case 'moveAsset':
            messageBus.send({
                type: 'StreamingEvent',
                dataSourceKey: 'internal',
                event: {
                    streamKey: `ASSET#${event.AssetId}`,
                    update: {
                        type: 'moveAsset',
                        assetId: event.AssetId,
                        fromZone: event.fromZone,
                        toZone: event.toZone,
                        player: event.player,
                        subFolder: event.subFolder
                    }
                },
                timestamp: Date.now()
            })
            await messageBus.flush()
            return await extractReturnValue(messageBus)
    }
}
