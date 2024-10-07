import { EphemeraAssetId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import { exponentialBackoffWrapper } from "@tonylb/mtw-utilities/ts/dynamoDB"
import assetDB from "./mockableAssetDB"
import delayPromise from "@tonylb/mtw-utilities/ts/dynamoDB/delayPromise"
import now from "./mockableTime"

export const assetAtomicLock = async (AssetId: EphemeraAssetId, key: string): Promise<void> => {
    //
    // Append key to the "locks" property on Meta::Asset record for this AssetId.
    //
    await exponentialBackoffWrapper(async () => {
        await assetDB.optimisticUpdate({
            Key: {
                AssetId,
                DataCategory: 'Meta::Asset'
            },
            updateKeys: ['atomicLocks'],
            updateReducer: (state) => {
                state.atomicLocks = [...state.atomicLocks ?? [], key]
            }
        })
    }, { retryErrors: ['ConditionalCheckFailedException'] })

    while(true) {
        const checkItem = await assetDB.getItem<{ atomicLocks: string[]; timeToUnlock: number }>({
            Key: {
                AssetId,
                DataCategory: 'Meta::Asset'
            },
            ProjectionFields: ['atomicLocks', 'timeToUnlock'],
            ConsistentRead: true
        })
        if (checkItem) {
            //
            // If key does not exist on the locks property then throw an exception.
            //
            if (!((checkItem.atomicLocks ?? []).includes(key))) {
                throw new Error('Lock request has been removed from Asset')
            }

            //
            // If key is the *first* item on the locks property then you have the lock. Set
            // a timeToUnlock and resolve the promise.
            //
            if (checkItem.atomicLocks[0] === key) {
                await exponentialBackoffWrapper(async () => {
                    await assetDB.optimisticUpdate({
                        Key: {
                            AssetId,
                            DataCategory: 'Meta::Asset'
                        },
                        updateKeys: ['timeToUnlock'],
                        updateReducer: (state) => {
                            state.timeToUnlock = now() + 5000
                        }
                    })
                }, { retryErrors: ['ConditionalCheckFailedException'] })
                return
            }

            //
            // If key is the *second* item on the locks property, and the timeToUnlock has passed,
            // forcibly unlock the key and take ownership of it. Set a timeToUnlock and resolve the promise.
            //
            if (checkItem.atomicLocks[1] === key && now() > (checkItem.timeToUnlock ?? 0)) {
                await exponentialBackoffWrapper(async () => {
                    await assetDB.optimisticUpdate({
                        Key: {
                            AssetId,
                            DataCategory: 'Meta::Asset'
                        },
                        updateKeys: ['atomicLocks', 'timeToUnlock'],
                        updateReducer: (state) => {
                            if (state.atomicLocks[0] !== key) {
                                state.atomicLocks = state.atomicLocks.slice(1)
                            }
                            if (state.atomicLocks[0] !== key) {
                                throw new Error('Lock mishap in lock timeout')
                            }
                            state.timeToUnlock = now() + 5000
                        }
                    })
                }, { retryErrors: ['ConditionalCheckFailedException'] })
                return
            }

            //
            // Otherwise, wait 500 milliseconds and try again.
            //

            await delayPromise(500)

        }
        else {
            throw new Error('Waiting for lock on non-existent Asset')
        }

    }
}

export const yieldAtomicLock = async (AssetId: EphemeraAssetId, key: string): Promise<void> => {

}

export default assetAtomicLock
