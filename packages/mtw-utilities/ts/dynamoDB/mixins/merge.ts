import { Constructor, DBHandlerBase, DBHandlerItem, DBHandlerKey, DBHandlerLegalKey } from "../baseClasses"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { asyncSuppressExceptions } from "../../errors"
import withBatchWrite, { BatchRequest } from './batchWrite'
import withQuery, { QueryKeyProps } from './query'
import withTransaction, { TransactionRequest } from "./transact"
import withGetOperations from "./get"
import withUpdate from "./update"

type MergeQueryResults<KIncoming extends DBHandlerLegalKey, T extends string> = {
    [key in KIncoming]: T
} & { DataCategory: string } & Record<Exclude<string, KIncoming | 'DataCategory'>, any>

type MergeAction<KIncoming extends DBHandlerLegalKey, T extends string> = 'ignore' | 'delete' | DBHandlerItem<KIncoming, T>

type MergeTransactProps<KIncoming extends DBHandlerLegalKey, T extends string> = {
    query: QueryKeyProps<KIncoming, T>;
    items: DBHandlerItem<KIncoming, T>[];
    mergeFunction: (props: { incoming: DBHandlerItem<KIncoming, T>, current: DBHandlerItem<KIncoming, T> }) => MergeAction<KIncoming, T>;
    transactFactory: (props: { key: DBHandlerKey<KIncoming, T>; action: MergeAction<KIncoming, T> }) => Promise<TransactionRequest<KIncoming, T>[]>
}

//
// merge takes the results of a query and compares them to a set of items that shows what that query
// "should" return, then deletes and updates records in order to merge the two.
//
// A given record _already_ in the database will either match (by primary Key and DataCategory) with
// an incoming record, or it will not.  Likewise, a given incoming record will either match a record
// already present, or it will not.
//
// The merge function takes a map of two-element tuples, incoming and current, indexed by the key
// (DataCategory, or Asset/EphemeraId) that is *not* specified in the search.  Each of these
// tuples will contain either:
//    * A match (both incoming and current elements specified)
//    * An unmatched incoming element
//    * An unmatched current element
//
// The merge function must return a different map on the same keys.  Each key will specify either:
//    * The string 'ignore', which will do nothing
//    * The string 'delete', which will eliminate the current element if present
//    * An object with the two keys unique to that position in the map, that will be
//      made into the body of a PutItem operation to update the current element
//
export const withMerge = <KIncoming extends DBHandlerLegalKey, T extends string>() => <GBase extends
        ReturnType<ReturnType<typeof withTransaction<KIncoming, T>>> &
        ReturnType<ReturnType<typeof withUpdate<KIncoming, T>>> &
        ReturnType<ReturnType<typeof withGetOperations<KIncoming, T>>> &
        ReturnType<ReturnType<typeof withQuery<KIncoming, T>>> &
        ReturnType<ReturnType<typeof withBatchWrite<KIncoming, T>>>>(Base: GBase) => {
    return class MergeDBHandler extends Base {
        async merge(props: {
            query: QueryKeyProps<KIncoming, T>;
            //
            // TODO: Figure out how to not need to sometimes use explicit any for the items property in this calling pattern
            //
            items: DBHandlerItem<KIncoming, T>[];
            mergeFunction: (props: { incoming: DBHandlerItem<KIncoming, T>, current: DBHandlerItem<KIncoming, T> }) => ('ignore' | 'delete' | DBHandlerItem<KIncoming, T>)
        }) {
            //
            // TODO:  Better error handling and validation throughout
            //
            const {
                query,
                items,
                mergeFunction
            } = props
            const currentItems = await this.query<MergeQueryResults<KIncoming, T>>(query)
            const findByKey = (findItem: DBHandlerItem<KIncoming, T> | DBHandlerKey<KIncoming, T>) => (item: DBHandlerItem<KIncoming, T> | DBHandlerKey<KIncoming, T>): boolean => (item[this._incomingKeyLabel] === findItem[this._incomingKeyLabel] && item.DataCategory === findItem.DataCategory)
            const keysToExamine = [currentItems, items].flat().reduce<DBHandlerKey<KIncoming, T>[]>((previous, item) => {
                if (previous.find(findByKey(item))) {
                    return previous
                }
                else {
                    return [
                        ...previous,
                        {
                            [this._incomingKeyLabel]: item[this._incomingKeyLabel],
                            DataCategory: item.DataCategory
                        } as DBHandlerKey<KIncoming, T>
                    ]
                }
            }, [])
            const batchActions = keysToExamine.reduce<BatchRequest<KIncoming, T>[]>((previous, key) => {
                const currentItem = currentItems.find(findByKey(key))
                const incomingItem = items.find(findByKey(key))
                if (currentItem) {
                    if (incomingItem) {
                        const mergeOutput = mergeFunction({ incoming: incomingItem, current: currentItem })
                        if (typeof mergeOutput === 'string') {
                            if (mergeOutput === 'delete') {
                                return [
                                    ...previous,
                                    { DeleteRequest: key }
                                ]
                            }
                        }
                        else {
                            return [
                                ...previous,
                                { PutRequest: mergeOutput }
                            ]    
                        }
                    }
                    else {
                        return [
                            ...previous,
                            { DeleteRequest: key }
                        ]
                    }
                }
                else {
                    if (incomingItem) {
                        return [
                            ...previous,
                            { PutRequest: incomingItem }
                        ]
                    }
                }
                return previous
            }, [])
            if (batchActions.length) {
                await this.batchWriteDispatcher(batchActions)
            }
        }

        //
        // mergeTransact merges two lists, and then optionally (for each key) generates a transaction
        // that includes both the put/delete that would have occurred in the original merge, *and* a
        // generated set of other transaction elements to atomically update denormalized data (e.g.,
        // put/delete the Meta::<Asset> item detail in Ephemera caching, and also update/delete the
        // Meta::<ComponentTag> overview record to update what assets have been cached for that component)
        //
        async mergeTransact(props: MergeTransactProps<KIncoming, T>) {
            const {
                query,
                items,
                mergeFunction,
                transactFactory
            } = props
            const currentItems = await this.query<MergeQueryResults<KIncoming, T>>(query)
            const findByKey = (findItem: DBHandlerItem<KIncoming, T> | DBHandlerKey<KIncoming, T>) => (item: DBHandlerItem<KIncoming, T> | DBHandlerKey<KIncoming, T>): boolean => (item[this._incomingKeyLabel] === findItem[this._incomingKeyLabel] && item.DataCategory === findItem.DataCategory)
            const keysToExamine = [currentItems, items].flat().reduce<DBHandlerKey<KIncoming, T>[]>((previous, item) => {
                if (previous.find(findByKey(item))) {
                    return previous
                }
                else {
                    return [
                        ...previous,
                        {
                            [this._incomingKeyLabel]: item[this._incomingKeyLabel],
                            DataCategory: item.DataCategory
                        } as DBHandlerKey<KIncoming, T>
                    ]
                }
            }, [])

            const { batchActions, transactions } = (await Promise.all(keysToExamine.map(async (key) => {
                    const currentItem = currentItems.find(findByKey(key))
                    const incomingItem = items.find(findByKey(key))
                    let batchRequest: BatchRequest<KIncoming, T> | undefined = undefined
                    //
                    // TODO: Add a distinguishing factor for transactFactory, telling it whether a put is a new item or update
                    //
                    if (currentItem) {
                        if (incomingItem) {
                            const mergeOutput = mergeFunction({ incoming: incomingItem, current: currentItem })
                            if (typeof mergeOutput === 'string') {
                                if (mergeOutput === 'delete') {
                                    batchRequest = { DeleteRequest: key }
                                }
                            }
                            else {
                                batchRequest = { PutRequest: mergeOutput }
                            }
                        }
                        else {
                            batchRequest = { DeleteRequest: key }
                        }
                    }
                    else {
                        if (incomingItem) {
                            batchRequest = { PutRequest: incomingItem }
                        }
                    }
                    if (!batchRequest) {
                        return {
                            batchRequest: undefined,
                            associatedTransactions: []
                        }
                    }
                    const associatedTransactions = await transactFactory({ key, action: 'DeleteRequest' in batchRequest ? 'delete' : batchRequest.PutRequest })
                    return {
                        batchRequest,
                        associatedTransactions
                    }
                })))
                .reduce<{ batchActions: BatchRequest<KIncoming, T>[], transactions: TransactionRequest<KIncoming, T>[][] }>((previous, { batchRequest, associatedTransactions }) => {
                    if (!batchRequest) { return previous }
                    if (associatedTransactions.length) {
                        return {
                            batchActions: previous.batchActions,
                            transactions: [
                                ...previous.transactions,
                                [
                                    'DeleteRequest' in batchRequest ? { Delete: batchRequest.DeleteRequest } : { Put: batchRequest.PutRequest },
                                    ...associatedTransactions
                                ]
                            ]
                        }
                    }
                    else {
                        return {
                            batchActions: [...previous.batchActions, batchRequest],
                            transactions: previous.transactions
                        }
                    }
                }, { batchActions: [], transactions: [] })
            await Promise.all([
                ...(batchActions.length ? [this.batchWriteDispatcher(batchActions)] : []),
                ...transactions.map((transactionList) => (this.transactWrite(transactionList)))
            ])
        }
    }
}

export default withMerge
