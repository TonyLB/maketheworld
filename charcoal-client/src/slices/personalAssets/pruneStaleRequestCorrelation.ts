import { isSchemaAssetUUID } from '@tonylb/mtw-base/ts/schema'
import { storedConfirmedRequestIdStrings } from '../dataSource'
import { getSubscribedStreams, pruneStaleConfirmedRequestIds } from '../wmlDataSource'
import type { PersonalAssetsPublic } from './baseClasses'

export type PruneStaleRequestCorrelationDeps = {
    publicActions: {
        trimStalePendingEdits: (assetId: string) => (payload: { now?: number; confirmedIds?: string[] }) => any
    }
    getPendingEdits: (assetId: string) => (state: any) => PersonalAssetsPublic['pendingEdits'] | undefined
}

const collectCandidateAssetIds = (
    state: any,
    getPendingEdits: PruneStaleRequestCorrelationDeps['getPendingEdits']
): string[] => {
    const subscribedStreams = getSubscribedStreams(state)
    const personalAssetsById = state.personalAssets?.byId ?? {}
    const keys = new Set<string>()

    for (const streamKey of Object.keys(subscribedStreams)) {
        if (isSchemaAssetUUID(streamKey)) {
            keys.add(streamKey)
        }
    }

    for (const key of Object.keys(personalAssetsById)) {
        if (!isSchemaAssetUUID(key)) {
            continue
        }
        const pending = getPendingEdits(key)(state)
        const confirmedRows = subscribedStreams[key]?.confirmedRequestIds
        if (pending?.length || confirmedRows?.length) {
            keys.add(key)
        }
    }

    return [...keys]
}

export const createPruneStaleRequestCorrelation = (deps: PruneStaleRequestCorrelationDeps) =>
    (options?: { now?: number }) =>
        (dispatch: any, getState: any) => {
            const { publicActions, getPendingEdits } = deps
            const now = options?.now ?? Date.now()
            const state = getState()
            const subscribedStreams = getSubscribedStreams(state)
            const personalAssetsById = state.personalAssets?.byId ?? {}

            for (const assetId of collectCandidateAssetIds(state, getPendingEdits)) {
                const stream = subscribedStreams[assetId]
                const storedConfirmed = storedConfirmedRequestIdStrings(stream?.confirmedRequestIds)

                if (personalAssetsById[assetId]) {
                    dispatch(publicActions.trimStalePendingEdits(assetId)({
                        now,
                        confirmedIds: storedConfirmed.length > 0 ? storedConfirmed : undefined
                    }))
                }

                const pendingKeys = (getPendingEdits(assetId)(getState()) ?? []).map(({ meta }) => meta.key)

                if (stream?.confirmedRequestIds !== undefined) {
                    dispatch(pruneStaleConfirmedRequestIds({
                        streamKey: assetId,
                        now,
                        pendingKeys
                    }))
                }
            }
        }
