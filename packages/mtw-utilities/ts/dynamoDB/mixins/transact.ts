import { TransactWriteItem, TransactWriteItemsCommand, UpdateItemCommandInput } from "@aws-sdk/client-dynamodb"
import { DBHandlerItem, DBHandlerKey, DBHandlerLegalKey } from "../baseClasses"
import { marshall } from "@aws-sdk/util-dynamodb"
import { produce } from "immer"
import { WritableDraft } from "immer/dist/internal"
import { UpdateExtendedProps } from "./update"
import withGetOperations from "./get"
import withUpdate from "./update"
import { unique } from "../../lists"
import { deepEqual } from "../../objects"
import mapProjectionFields, { reservedFields } from "./utils/mapProjectionFields"

type TransactionRequestUpdate<KIncoming extends DBHandlerLegalKey, KeyType extends string = string> = { Key: DBHandlerKey<KIncoming, KeyType> } & UpdateExtendedProps<KIncoming, KeyType>

export type TransactionRequestMultiKeyUpdate<KIncoming extends DBHandlerLegalKey, KeyType extends string = string, T extends Partial<DBHandlerItem<KIncoming, KeyType>> = Partial<DBHandlerItem<KIncoming, KeyType>>> = {
    Keys: DBHandlerKey<KIncoming, KeyType>[];
    updateKeys: string[];
    reducer: (draft: WritableDraft<Record<string, T>>) => void;
    checkKeys?: string[];
    //
    // cascade, if provided, runs after the reducer and sees both the prior and next (already-reduced)
    // Record<string, T>. Its returned TransactionRequest items merge into the same atomic transaction ---
    // generalizing deleteCascade's "cascade output rides the same TransactWriteItems call" pattern beyond
    // deleteCascade's delete-only/final-state-only limits. There is no second fetch round for cascade
    // output: a cascade-returned Update must supply its own priorFetch, and a cascade may not return a
    // nested MultiKeyUpdate --- both throw rather than silently misbehaving.
    //
    cascade?: (prior: Record<string, T>, next: Record<string, T>) => TransactionRequest<KIncoming, KeyType>[];
}
export type TransactionRequestConditionCheck<KIncoming extends DBHandlerLegalKey, KeyType extends string = string> = {
    Key: DBHandlerKey<KIncoming, KeyType>;
    ProjectionFields: string[];
    ConditionExpression: string;
    ExpressionAttributeValues?: Record<string, any>;
}
export type TransactionRequestPrimitiveUpdate<KIncoming extends DBHandlerLegalKey, KeyType extends string = string> = {
    Key: DBHandlerKey<KIncoming, KeyType>;
    ProjectionFields: string[];
    UpdateExpression: string;
    ConditionExpression?: string;
    ExpressionAttributeValues?: Record<string, any>;
}

export type TransactionRequestSetOperation<KIncoming extends DBHandlerLegalKey, KeyType extends string = string> = {
    Key: DBHandlerKey<KIncoming, KeyType>;
    attributeName: string;
    addItems?: string[];
    deleteItems?: string[];
    setUpdate?: Omit<UpdateItemCommandInput, 'TableName' | 'Key'>
}

export type TransactionRequest<KIncoming extends DBHandlerLegalKey, KeyType extends string = string> = {
    Put: DBHandlerItem<KIncoming, KeyType>
} | {
    Update: TransactionRequestUpdate<KIncoming, KeyType>;
} | {
    PrimitiveUpdate: TransactionRequestPrimitiveUpdate<KIncoming, KeyType>;
} | {
    SetOperation: TransactionRequestSetOperation<KIncoming, KeyType>;
} | {
    Delete: DBHandlerKey<KIncoming, KeyType>
} | {
    ConditionCheck: TransactionRequestConditionCheck<KIncoming, KeyType>;
} | {
    MultiKeyUpdate: TransactionRequestMultiKeyUpdate<KIncoming, KeyType>;
}

export const withTransaction = <KIncoming extends DBHandlerLegalKey, T extends string = string>() => <GBase extends
        ReturnType<ReturnType<typeof withUpdate<KIncoming, T>>> &
        ReturnType<ReturnType<typeof withGetOperations<KIncoming, T>>>>(Base: GBase) => {
    return class TransactionDBHandler extends Base {
        //
        // _marshalledKeyString returns a deterministic string form of a DBHandlerKey's marshalled
        // representation, used to key the Record<string, T> a MultiKeyUpdate reducer operates over.
        //
        _marshalledKeyString(key: DBHandlerKey<KIncoming, T>): string {
            return JSON.stringify(marshall(this._remapIncomingObject(key), { removeUndefinedValues: true }))
        }

        //
        // _unchangedFieldConditions builds an equality (or attribute_not_exists) condition for every
        // field in `fields`, unconditionally --- unlike updateByReducer's inline per-field conditions
        // (only emitted for fields that are *checked and changed*, or on the "new record" branch),
        // this always locks every field so a MultiKeyUpdate key that was fetched but left unchanged by
        // the reducer still participates in the transaction's optimistic lock (OD-3, no opt-out).
        //
        _unchangedFieldConditions(
            fields: string[],
            priorValue: Partial<DBHandlerItem<KIncoming, T>> | undefined
        ): { ExpressionAttributeNames: Record<string, string>; ExpressionAttributeValues: Record<string, any>; conditionExpressions: string[] } {
            const { ExpressionAttributeNames } = mapProjectionFields(fields)
            const translateToExpressionAttributeNames = Object.entries(ExpressionAttributeNames).reduce<Record<string, string>>((previous, [key, value]) => ({ ...previous, [value]: key }), {})
            return fields.reduce<{ ExpressionAttributeNames: Record<string, string>; ExpressionAttributeValues: Record<string, any>; conditionExpressions: string[] }>((previous, field, index) => {
                const translatedField = field in translateToExpressionAttributeNames ? translateToExpressionAttributeNames[field] : field
                const hasValue = priorValue !== undefined && field in priorValue && (priorValue as Record<string, any>)[field] !== undefined
                return {
                    ExpressionAttributeNames: (translatedField in ExpressionAttributeNames)
                        ? { ...previous.ExpressionAttributeNames, [translatedField]: field }
                        : previous.ExpressionAttributeNames,
                    ExpressionAttributeValues: hasValue
                        ? { ...previous.ExpressionAttributeValues, [`:Old${index}`]: (priorValue as Record<string, any>)[field] }
                        : previous.ExpressionAttributeValues,
                    conditionExpressions: [
                        ...previous.conditionExpressions,
                        hasValue ? `${translatedField} = :Old${index}` : `attribute_not_exists(${translatedField})`
                    ]
                }
            }, { ExpressionAttributeNames: {}, ExpressionAttributeValues: {}, conditionExpressions: [] })
        }

        //
        // _transactionRequestItemToTransactWriteItems converts a single TransactionRequest item into raw
        // TransactWriteItem(s) plus any success/delete callbacks it registers. Extracted (Slice 2) so the
        // MultiKeyUpdate branch can recursively convert cascade-returned items via the exact same logic,
        // rather than duplicating it.
        //
        _transactionRequestItemToTransactWriteItems(
            item: TransactionRequest<KIncoming, T>,
            fetchedItems: DBHandlerItem<KIncoming, T>[]
        ): {
            items: TransactWriteItem[];
            successCallbacks: (() => Promise<void>)[];
            deleteCallbacks: (() => Promise<void>)[];
        } {
            const none = { items: [] as TransactWriteItem[], successCallbacks: [] as (() => Promise<void>)[], deleteCallbacks: [] as (() => Promise<void>)[] }
            if ('Put' in item) {
                return { ...none, items: [{
                    Put: {
                        Item: marshall(this._remapIncomingObject(item.Put), { removeUndefinedValues: true }),
                        TableName: this._tableName
                    }
                }] }
            }
            if ('Delete' in item) {
                return { ...none, items: [{
                    Delete: {
                        Key: marshall(this._remapIncomingObject(item.Delete), { removeUndefinedValues: true }),
                        TableName: this._tableName
                    }
                }] }
            }
            if ('Update' in item) {
                const fetchedItem = item.Update.priorFetch || fetchedItems.find((checkItem) => (checkItem[this._incomingKeyLabel] === item.Update.Key[this._incomingKeyLabel] && checkItem.DataCategory === item.Update.Key.DataCategory))
                const updateTransaction = this._optimisticUpdateFactory(fetchedItem, item.Update)
                const { successCallback, succeedAll, deleteCallback } = item.Update
                if (updateTransaction.action === 'ignore') {
                    return {
                        ...none,
                        successCallbacks: (succeedAll && successCallback) ? [async () => { await successCallback(fetchedItem as DBHandlerItem<KIncoming, T>, fetchedItem as DBHandlerItem<KIncoming, T>) }] : []
                    }
                }
                if (updateTransaction.action === 'delete') {
                    return {
                        items: updateTransaction.deletes.map((deleteItem) => ({
                            Delete: {
                                TableName: this._tableName,
                                ...deleteItem
                            }
                        })),
                        successCallbacks: (succeedAll && successCallback) ? [async () => { await successCallback(fetchedItem as DBHandlerItem<KIncoming, T>, fetchedItem as DBHandlerItem<KIncoming, T>) }] : [],
                        deleteCallbacks: deleteCallback ? [async () => { await deleteCallback(fetchedItem as DBHandlerItem<KIncoming, T>) }] : []
                    }
                }
                return {
                    items: [{
                        Update: {
                            TableName: this._tableName,
                            ...updateTransaction.update
                        }
                    } as TransactWriteItem],
                    successCallbacks: successCallback ? [async () => { await successCallback(updateTransaction.newState, fetchedItem as DBHandlerItem<KIncoming, T>) }] : [],
                    deleteCallbacks: []
                }
            }
            if ('MultiKeyUpdate' in item) {
                const { Keys, updateKeys, reducer, checkKeys, cascade } = item.MultiKeyUpdate
                const priorRecord = Keys.reduce<Record<string, DBHandlerItem<KIncoming, T>>>((previous, key) => {
                    const marshalledKey = this._marshalledKeyString(key)
                    const fetchedItem = fetchedItems.find((checkItem) => (checkItem[this._incomingKeyLabel] === key[this._incomingKeyLabel] && checkItem.DataCategory === key.DataCategory))
                    return fetchedItem ? { ...previous, [marshalledKey]: fetchedItem } : previous
                }, {})
                const nextRecord = produce(priorRecord, reducer)
                const keyItems = Keys.flatMap((key) => {
                    const marshalledKey = this._marshalledKeyString(key)
                    const prior = priorRecord[marshalledKey]
                    const next = nextRecord[marshalledKey]
                    if (deepEqual(prior, next)) {
                        const { ExpressionAttributeNames, ExpressionAttributeValues, conditionExpressions } = this._unchangedFieldConditions(checkKeys ?? updateKeys, prior)
                        if (!conditionExpressions.length) {
                            return []
                        }
                        return [{
                            ConditionCheck: {
                                TableName: this._tableName,
                                Key: marshall(this._remapIncomingObject(key), { removeUndefinedValues: true }),
                                ConditionExpression: conditionExpressions.join(' AND '),
                                ...(Object.keys(ExpressionAttributeNames).length > 0 ? { ExpressionAttributeNames } : {}),
                                ...(Object.keys(ExpressionAttributeValues).length > 0 ? { ExpressionAttributeValues: marshall(ExpressionAttributeValues, { removeUndefinedValues: true }) } : {})
                            }
                        }] as TransactWriteItem[]
                    }
                    if (prior !== undefined && next === undefined) {
                        //
                        // MultiKeyUpdate does not (yet) support removing a key from the Record it reduces
                        // over --- see OD-2 in the MultiKeyUpdate task plan. A reducer that clears a
                        // previously-fetched key's value is a caller error, not a legal "delete" outcome.
                        //
                        throw new Error('MultiKeyUpdate reducer may not remove a previously-fetched key (deletion is not yet supported)')
                    }
                    const updateTransaction = this._optimisticUpdateFactory(prior, { Key: key, updateKeys, updateReducer: () => next, checkKeys })
                    if (updateTransaction.action !== 'update') {
                        return []
                    }
                    return [{
                        Update: {
                            TableName: this._tableName,
                            ...updateTransaction.update
                        }
                    } as TransactWriteItem]
                })
                if (!cascade) {
                    return { ...none, items: keyItems }
                }
                //
                // The cascade runs after the reducer, seeing its actual (prior, next) output --- matching
                // deleteCascade's own precedent (update.ts). There is no second fetch round for cascade
                // output: an Update must supply its own priorFetch, and a nested MultiKeyUpdate is not
                // supported --- both throw rather than silently misbehaving (Slice 2, decided 2026-07-14).
                //
                const cascadeResults = cascade(priorRecord, nextRecord).map((cascadeItem) => {
                    if ('MultiKeyUpdate' in cascadeItem) {
                        throw new Error('MultiKeyUpdate cascade may not return a nested MultiKeyUpdate item')
                    }
                    if ('Update' in cascadeItem && !('priorFetch' in cascadeItem.Update)) {
                        throw new Error('MultiKeyUpdate cascade\'s Update items must supply priorFetch --- no second fetch round is run for cascade output')
                    }
                    return this._transactionRequestItemToTransactWriteItems(cascadeItem, fetchedItems)
                })
                return {
                    items: [...keyItems, ...cascadeResults.flatMap((result) => result.items)],
                    successCallbacks: cascadeResults.flatMap((result) => result.successCallbacks),
                    deleteCallbacks: cascadeResults.flatMap((result) => result.deleteCallbacks)
                }
            }
            if ('ConditionCheck' in item) {
                const { ExpressionAttributeNames } = mapProjectionFields(item.ConditionCheck.ProjectionFields)
                const translateToExpressionAttributeNames = Object.entries(ExpressionAttributeNames).reduce<Record<string, string>>((previous, [key, value]) => ({ ...previous, [value]: key }), {})
                const replaceAttributeNames = (incoming: string): string => (
                    Object.entries(translateToExpressionAttributeNames).reduce<string>(
                        (previous, [key, translated]) => {
                            return previous.replace(new RegExp(`\\b(?<!:)${key}\\b`, 'g'), translated)
                        },
                        incoming
                    )
                )
                return { ...none, items: [{
                    ConditionCheck: {
                        TableName: this._tableName,
                        Key: marshall(this._remapIncomingObject(item.ConditionCheck.Key), { removeUndefinedValues: true }),
                        ConditionExpression: replaceAttributeNames(item.ConditionCheck.ConditionExpression),
                        ...(Object.keys(ExpressionAttributeNames).length > 0 ? { ExpressionAttributeNames } : {}),
                        ...(item.ConditionCheck.ExpressionAttributeValues ? { ExpressionAttributeValues: marshall(item.ConditionCheck.ExpressionAttributeValues, { removeUndefinedValues: true }) } : {})
                    }
                }] }
            }
            if ('PrimitiveUpdate' in item) {
                const { ExpressionAttributeNames } = mapProjectionFields(item.PrimitiveUpdate.ProjectionFields)
                const translateToExpressionAttributeNames = Object.entries(ExpressionAttributeNames).reduce<Record<string, string>>((previous, [key, value]) => ({ ...previous, [value]: key }), {})
                const replaceAttributeNames = (incoming: string): string => (
                    Object.entries(translateToExpressionAttributeNames).reduce<string>(
                        (previous, [key, translated]) => {
                            return previous.replace(new RegExp(`\\b(?<!:)${key}\\b`, 'g'), translated)
                        },
                        incoming
                    )
                )
                return { ...none, items: [{
                    Update: {
                        TableName: this._tableName,
                        Key: marshall(this._remapIncomingObject(item.PrimitiveUpdate.Key), { removeUndefinedValues: true }),
                        UpdateExpression: replaceAttributeNames(item.PrimitiveUpdate.UpdateExpression),
                        ...(item.PrimitiveUpdate.ConditionExpression ? { ConditionExpression: replaceAttributeNames(item.PrimitiveUpdate.ConditionExpression) } : {}),
                        ...(Object.keys(ExpressionAttributeNames).length > 0 ? { ExpressionAttributeNames } : {}),
                        ...(item.PrimitiveUpdate.ExpressionAttributeValues ? { ExpressionAttributeValues: marshall(item.PrimitiveUpdate.ExpressionAttributeValues, { removeUndefinedValues: true }) } : {})
                    }
                }] }
            }
            if ('SetOperation' in item) {
                const { Key, attributeName, addItems = [], deleteItems = [], setUpdate } = item.SetOperation
                if (reservedFields.includes(attributeName)) {
                    throw new Error('setOperation is not (yet) able to handle reserved field names')
                }
                return { ...none, items: [{
                    Update: {
                        TableName: this._tableName,
                        Key: marshall(this._remapIncomingObject(item.SetOperation.Key), { removeUndefinedValues: true }),
                        UpdateExpression: [
                            ...(setUpdate ? [setUpdate.UpdateExpression] : []),
                            ...(addItems.length ? [`ADD ${attributeName} :addItems`] : []),
                            ...(deleteItems.length ? [`DELETE ${attributeName} :deleteItems`] : [])
                        ].join(' '),
                        ...((setUpdate && setUpdate.ExpressionAttributeNames) ? { ExpressionAttributeNames: setUpdate.ExpressionAttributeNames } : {}),
                        ExpressionAttributeValues: {
                            ...(setUpdate ? setUpdate.ExpressionAttributeValues || {} : {}),
                            ...marshall({
                                ...(addItems.length ? { ':addItems': new Set(addItems) } : {}),
                                ...(deleteItems.length ? { ':deleteItems': new Set(deleteItems) } : {})
                            })
                        }
                    }
                }] }
            }
            return none
        }

        async transactWrite(items: TransactionRequest<KIncoming, T>[]) {
            const itemsToFetch = items.reduce<TransactionRequestUpdate<KIncoming, T>[]>((previous, item) => ('Update' in item && (!('priorFetch' in item.Update)) ? [...previous, item.Update] : previous), [])
            const multiKeyItems = items.reduce<TransactionRequestMultiKeyUpdate<KIncoming, T>[]>((previous, item) => ('MultiKeyUpdate' in item ? [...previous, item.MultiKeyUpdate] : previous), [])
            const aggregateProjectionFields = unique(
                [this._incomingKeyLabel, 'DataCategory'],
                ...itemsToFetch.map(({ updateKeys }) => (updateKeys)),
                ...multiKeyItems.map(({ updateKeys }) => (updateKeys))
            )
            const allKeysToFetch = [
                ...itemsToFetch.map((item) => (item.Key)),
                ...multiKeyItems.flatMap((item) => (item.Keys))
            ]
            const fetchedItems = allKeysToFetch.length ? await this.getItems<DBHandlerItem<KIncoming, T>>({
                Keys: allKeysToFetch,
                ProjectionFields: aggregateProjectionFields
            }) : []

            let successCallbacks: (() => Promise<void>)[] = []
            let deleteCallbacks: (() => Promise<void>)[] = []
            const transactions = items.flatMap((item) => {
                const result = this._transactionRequestItemToTransactWriteItems(item, fetchedItems)
                successCallbacks = [...successCallbacks, ...result.successCallbacks]
                deleteCallbacks = [...deleteCallbacks, ...result.deleteCallbacks]
                return result.items
            })
            if (transactions.length > 0) {
                await this._client.send(new TransactWriteItemsCommand({ TransactItems: transactions }))
            }
            await Promise.all([
                ...successCallbacks.map(async (callback) => { await callback()  }),
                ...deleteCallbacks.map(async (callback) => { await callback()  })
            ])
        }

        //
        // TODO: Add transactAggregateGraph operation that accepts a graph with nodes of the following types:
        //    - ValueFetch (with priorFetch option) to make child steps dependent upon the value of unchanged parent nodes
        //    - AggregateUpdate to take in parent values, update a node using a reducer, and pass on the updated values
        //
        // Process each topological layer of the aggregateGraph as a transaction, using ConditionCheck and Update transactWrite
        // arguments.
        //
    }
}

export default withTransaction
