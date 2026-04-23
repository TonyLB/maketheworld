import {
    EphemeraFeatureId,
    EphemeraKnowledgeId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'
import StandardExample from '@tonylb/mtw-wml/ts/standardize/components/example'
import { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
import { isSchemaComponentUUID } from '@tonylb/mtw-base/ts/schema'

export type ExampleComponentId = EphemeraFeatureId | EphemeraKnowledgeId

export type ExamplesReturn = {
    assetId: string;
    examples: StandardExample[];
}

export class ExamplesData {
    _ExamplesCache: DeferredCache<ExamplesReturn[]> = new DeferredCache<ExamplesReturn[]>();
    _ExamplesOverridden: Record<string, boolean> = {}
    _invalidateCallback?: (EphemeraId: ExampleComponentId) => void;
    
    constructor(invalidateCallback?: (EphemeraId: ExampleComponentId) => void) {
        this._invalidateCallback = invalidateCallback
    }

    clear() {
        this._ExamplesCache.clear()
        this._ExamplesOverridden = {}
    }
    flush() {
        this._ExamplesCache.flush()
    }
    async get(keys: ExampleComponentId[]): Promise<Record<ExampleComponentId, ExamplesReturn[]>> {
        this._ExamplesCache.add({
            promiseFactory: async (keys: string[]) => {
                return await Promise.all(keys.map(async (componentId) => {
                    const examples = await assetDB.query<{ AssetId: EphemeraFeatureId | EphemeraKnowledgeId; DataCategory: string; name?: RenderTree; displayName?: RenderTree; description: RenderTree; summary: RenderTree }>({
                        Key: { AssetId: componentId },
                        KeyConditionExpression: 'begins_with(DataCategory, :dcPrefix)',
                        ExpressionAttributeValues: {
                            ':dcPrefix': 'EXAMPLE#'
                        },
                        ProjectionFields: ['DataCategory', 'name', 'displayName', 'description', 'summary']
                    })
                    return {
                        componentId,
                        examples: examples.map(({ DataCategory, name, displayName, description, summary }) => {
                            const universalKey = DataCategory.split('::')[0]
                            if (!isSchemaComponentUUID(universalKey)) {
                                throw new Error(`Invalid universalKey in ExamplesData.get: ${universalKey}`)
                            }
                            return {
                                assetId: DataCategory.split('::')[1],
                                example: new StandardExample({
                                    tag: 'Example',
                                    universalKey,
                                    displayName: (displayName ?? name) as unknown as any,
                                    description: description as unknown as any,
                                    summary: summary as unknown as any
                                })
                            }
                        })
                    }
                }))
            },
            requiredKeys: keys,
            transform: (outputList) => (outputList.reduce((previous, { componentId, examples }) => {
                const returnValue = examples.reduce((accumulator, { assetId, example }) => {
                    const previousExamples = accumulator[componentId] || []
                    const previousExamplesForThisAssetId = previousExamples.find(({ assetId: checkAssetId }) => checkAssetId === assetId) ?? []
                    return {
                        ...accumulator,
                        [componentId]: [
                            ...(accumulator[componentId] || []).filter(({ assetId: checkAssetId }) => checkAssetId !== assetId),
                            {
                                assetId,
                                examples: [
                                    ...previousExamplesForThisAssetId,
                                    example
                                ]
                            }
                        ]
                    }
                }, previous)
                if (!returnValue[componentId]) {
                    return {
                        ...returnValue,
                        [componentId]: []
                    }
                }
                return returnValue
            }, {}))
        })
        return Object.assign({}, ...(await Promise.all(
            keys.map(async (EphemeraId) => ({ [EphemeraId]: await this._ExamplesCache.get(EphemeraId) }))
        ))) as Record<ExampleComponentId, ExamplesReturn[]>
    }

    set(EphemeraId: ExampleComponentId, value: ExamplesReturn[]) {
        this._ExamplesCache.set(Infinity, EphemeraId, value)
        this._ExamplesOverridden[EphemeraId] = true
        this._invalidateCallback?.(EphemeraId)
    }

    invalidate(EphemeraId: ExampleComponentId) {
        this._ExamplesCache.invalidate(EphemeraId)
        delete this._ExamplesOverridden[EphemeraId]
        this._invalidateCallback?.(EphemeraId)
    }

    isOverridden(EphemeraId: ExampleComponentId) {
        return this._ExamplesOverridden[EphemeraId]
    }
}

export default ExamplesData
