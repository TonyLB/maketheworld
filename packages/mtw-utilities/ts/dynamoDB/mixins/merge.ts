import { Constructor, DBHandlerBase, DBHandlerItem, DBHandlerKey } from "../baseClasses"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { asyncSuppressExceptions } from "../../errors"
import withBatchWrite, { BatchRequest } from './batchWrite'
import withQuery, { QueryKeyProps } from './query'

type MergeQueryResults<KIncoming extends Exclude<string, 'DataCategory'>, T extends string> = {
    [key in KIncoming]: T
} & { DataCategory: string } & Record<Exclude<string, KIncoming | 'DataCategory'>, any>

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
export const withMerge = <KIncoming extends Exclude<string, 'DataCategory'>, KInternal extends Exclude<string, 'DataCategory'>, T extends string, GBase extends ReturnType<typeof withQuery<KIncoming, KInternal, T, ReturnType<typeof withBatchWrite<KIncoming, KInternal, T, Constructor<DBHandlerBase<KIncoming, KInternal, T>>>>>>>(Base: GBase) => {
    return class MergeDBHandler extends Base {
        async merge(props: {
            query: QueryKeyProps<KIncoming, T>;
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
            await this.batchWriteDispatcher(batchActions)
        }
    }
}

export default withMerge
