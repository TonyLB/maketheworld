import {  UpdateItemCommand, UpdateItemCommandInput } from "@aws-sdk/client-dynamodb"
import { DBHandlerItem, DBHandlerKey, DBHandlerLegalKey } from "../baseClasses"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import mapProjectionFields from './utils/mapProjectionFields'
import produce from "immer"
import { WritableDraft } from "immer/dist/internal"
import withGetOperations from "./get"
import { DEVELOPER_MODE } from '../../constants'
import delayPromise from "../delayPromise"

type DynamicUpdateOutput = {
    ExpressionAttributeNames: Record<string, any>;
    ExpressionAttributeValues: Record<string, any>;
    setExpressions: string[];
    removeExpressions: string[];
    conditionExpressions: string[];
}

//
// TODO: Can we replace empty objects with undefined, and do away with the need for this typeguard?
//
const isDynamicUpdateOutput = (item: {} | DynamicUpdateOutput): item is DynamicUpdateOutput => (Object.values(item).length > 0)

const updateByReducer = <T extends Record<string, any>>({ updateKeys, reducer, checkKeys }: { updateKeys: string[]; reducer: (draft: WritableDraft<T>) => void, checkKeys?: string[] }) => (state: T | undefined): DynamicUpdateOutput | {} => {
    const { ExpressionAttributeNames } = mapProjectionFields(updateKeys)
    const translateToExpressionAttributeNames = Object.entries(ExpressionAttributeNames).reduce<Record<string, string>>((previous, [key, value]) => ({ ...previous, [value]: key }), {})
    const newState = produce(state || {}, reducer)
    if (newState === state) {
        return {}
    }
    if (typeof state === 'object' && typeof newState === 'object') {
        //
        // Updating an existing record
        //
        const startingDraft: {
            ExpressionAttributeNames: Record<string, any>;
            ExpressionAttributeValues: Record<string, any>;
            setExpressions: string[];
            removeExpressions: string[];
            conditionExpressions: string[];
        } = {
            ExpressionAttributeNames: {},
            ExpressionAttributeValues: {},
            setExpressions: [],
            removeExpressions: [],
            conditionExpressions: []
        }
        return produce(startingDraft, (draft) => {
            updateKeys.forEach((key, index) => {
                const translatedKey = key in translateToExpressionAttributeNames ? translateToExpressionAttributeNames[key] : key
                if (typeof state === 'object' && key in state && (typeof state[key] !== 'undefined')) {
                    if (newState?.[key] === undefined) {
                        //
                        // Remove existing item
                        //
                        draft.removeExpressions.push(`${translatedKey}`)
                        if ((!checkKeys) || checkKeys.includes(key)) {
                            draft.ExpressionAttributeValues[`:Old${index}`] = state[key]
                            draft.conditionExpressions.push(`${translatedKey} = :Old${index}`)
                        }
                        if (translatedKey in ExpressionAttributeNames) {
                            draft.ExpressionAttributeNames[translatedKey] = key
                        }
                    }
                    else if (newState[key] !== state[key]) {
                        //
                        // Update existing item to new value
                        //
                        draft.ExpressionAttributeValues[`:New${index}`] = newState[key]
                        draft.setExpressions.push(`${translatedKey} = :New${index}`)
                        if ((!checkKeys) || checkKeys.includes(key)) {
                            draft.ExpressionAttributeValues[`:Old${index}`] = state[key]
                            draft.conditionExpressions.push(`${translatedKey} = :Old${index}`)
                        }
                        if (translatedKey in ExpressionAttributeNames) {
                            draft.ExpressionAttributeNames[translatedKey] = key
                        }
                    }
                    else if ((checkKeys || []).includes(key)) {
                        draft.ExpressionAttributeValues[`:Old${index}`] = state[key]
                        draft.conditionExpressions.push(`${translatedKey} = :Old${index}`)
                    }
                }
                else {
                    if ((!checkKeys) || checkKeys.includes(key)) {
                        draft.conditionExpressions.push(`attribute_not_exists(${translatedKey})`)
                    }
                    if (translatedKey in ExpressionAttributeNames) {
                        draft.ExpressionAttributeNames[translatedKey] = key
                    }
                    if (typeof newState === 'object' && key in newState && newState[key] !== undefined) {
                        //
                        // Add new item
                        //
                        draft.ExpressionAttributeValues[`:New${index}`] = newState[key]
                        draft.setExpressions.push(`${translatedKey} = :New${index}`)
                    }
                }
            })
        })
    }
    else {
        //
        // Putting a new record
        //
        const startingDraft: {
            ExpressionAttributeNames: Record<string, any>;
            ExpressionAttributeValues: Record<string, any>;
            setExpressions: string[];
            removeExpressions: string[];
            conditionExpressions: string[];
        } = {
            ExpressionAttributeNames: {},
            ExpressionAttributeValues: {},
            setExpressions: [],
            removeExpressions: [],
            conditionExpressions: []
        }
        return produce(startingDraft, (draft) => {
            draft.conditionExpressions.push(`attribute_not_exists(DataCategory)`)
            updateKeys.forEach((key, index) => {
                const translatedKey = key in translateToExpressionAttributeNames ? translateToExpressionAttributeNames[key] : key
                if (newState && key in newState && newState[key] !== undefined) {
                    //
                    // Add new item
                    //
                    if (translatedKey in ExpressionAttributeNames) {
                        draft.ExpressionAttributeNames[translatedKey] = key
                    }
                    draft.ExpressionAttributeValues[`:New${index}`] = newState[key]
                    draft.setExpressions.push(`${key} = :New${index}`)
                }
            })
        })
    }
}

export type UpdateExtendedProps<KIncoming extends DBHandlerLegalKey, KeyType extends string = string, T extends Partial<DBHandlerItem<KIncoming, KeyType>> = Partial<DBHandlerItem<KIncoming, KeyType>>> = {
    updateKeys: string[];
    updateReducer: (draft: WritableDraft<T>) => void;
    ExpressionAttributeNames?: Record<string, any>;
    ReturnValues?: 'NONE' | 'ALL_NEW' | 'UPDATED_NEW';
    maxRetries?: number;
    catchException?: (err: any) => Promise<void>;
    //
    // priorFetch primes the pump for the get/update cycle by providing pre-existing data
    // for the first attempt (presumably for caches)
    //
    priorFetch?: T | { [K in string]: never };
    //
    // checkKeys, if provided, gives a specific set of keys to compare against previous values
    // in order to determine if the record is unchanged since fetch (e.g., an updatedAt field
    // that is updated each time the record changes can be used, alone, to check that the record
    // is the same as when it was fetched).
    //
    checkKeys?: string[];
}

export const withUpdate = <KIncoming extends DBHandlerLegalKey, T extends string = string>() => <GBase extends ReturnType<ReturnType<typeof withGetOperations<KIncoming, T>>>>(Base: GBase) => {
    return class UpdateDBHandler extends Base {

        //
        // optimisticUpdateFactory accepts a fetched (or cached) previous value, runs it through a reducer to generate changes,
        // and if there are changes then generates the UpdateWriteCommandInput (less TableName and ReturnValues) that would
        // attempt to create those changes in the DB.
        //
        _optimisticUpdateFactory<Fetch extends Partial<DBHandlerItem<KIncoming, T>>>(
                previousItem: Fetch | { [x: string]: never } | undefined,
                props: { Key: DBHandlerKey<KIncoming, T> } & UpdateExtendedProps<KIncoming, T, Fetch>
            ): Omit<UpdateItemCommandInput, 'TableName' | 'ReturnValues'> | undefined
        {
            const {
                Key,
                updateKeys,
                updateReducer,
                checkKeys
            } = props
            if (!updateKeys.length) {
                return undefined
            }
            const undefineEmptyObject = (value: Fetch | { [x: string]: never } | undefined): Fetch | undefined => ((value && Object.keys(value).length) ? value as Fetch : undefined)
            const updateOutput = updateByReducer({ updateKeys, reducer: updateReducer, checkKeys })(undefineEmptyObject(previousItem))
            if (!isDynamicUpdateOutput(updateOutput)) {
                return undefined
            }
            else {
                const { ExpressionAttributeNames, ExpressionAttributeValues, setExpressions, removeExpressions, conditionExpressions } = updateOutput
                const UpdateExpression = [
                    setExpressions.length ? `SET ${setExpressions.join(', ')}` : '',
                    removeExpressions.length ? `REMOVE ${removeExpressions.join(', ')}` : ''
                ].filter((value) => (value)).join(' ')
                if (!UpdateExpression) {
                    return undefined
                }
                return {
                    Key: marshall(this._remapIncomingObject(Key), { removeUndefinedValues: true }),
                    UpdateExpression,
                    ...(conditionExpressions.length ? {
                        ConditionExpression: conditionExpressions.join(' AND ')
                    } : {}),
                    ...(ExpressionAttributeValues ? { ExpressionAttributeValues: marshall(ExpressionAttributeValues, { removeUndefinedValues: true }) } : {}),
                    ...((ExpressionAttributeNames && Object.values(ExpressionAttributeNames).length > 0) ? { ExpressionAttributeNames } : {}),
                }
            }
        }

        //
        // optimisticUpdate fetches the current state of the keys you intend to update,
        // and then runs that record through a change procedure (as in Immer) to change
        // their values.  If the reducer causes some changes, then the update attempts
        // to update the DB record ... conditional on all of those values still being
        // the same they were when they were first fetched.  Otherwise, it knows that
        // it is in a potential deadlock condition with other updates, and so pauses for
        // incremental backoff, and tries again (fetching and reducing from scratch)
        // until such time as either (a) the reducer causes no changes or (b) it succeeds
        // in completing a cycle without any other process side-effecting the same fields.
        //

        async optimisticUpdate<Update extends Partial<DBHandlerItem<KIncoming, T>>>(props: { Key: ({ [key in KIncoming]: T } & { DataCategory: string }) } & UpdateExtendedProps<KIncoming, T, Update>): Promise<Update | undefined> {
            const {
                Key,
                updateKeys,
                updateReducer,
                maxRetries,
                priorFetch,
                checkKeys
            } = props
            if (!updateKeys) {
                return undefined
            }
            let retries = 0
            let exponentialBackoff = 100
            let returnValue: Record<string, any> = {}
            let completed = false
            while(!completed && (retries <= (maxRetries ?? 5))) {
                completed = true
                const stateFetch = ((!retries && priorFetch) || (await this.getItem<Update>({
                    Key,
                    ProjectionFields: updateKeys,
                }))) as Update | { [x: string]: never } | undefined
                const state = stateFetch || {}
                const updateOutput = this._optimisticUpdateFactory(stateFetch, { Key, updateKeys, updateReducer, checkKeys })
                if (typeof updateOutput === 'undefined') {
                    returnValue = state
                    break
                }
                else {
                    try {
                        const { Attributes = {} } = await this._client.send(new UpdateItemCommand({
                            TableName: this._tableName,
                            ReturnValues: props.ReturnValues,
                            ...updateOutput
                        }))
                        returnValue = this._remapOutgoingObject(unmarshall(Attributes) as any)
                    }
                    catch (err: any) {
                        if (err.code === 'ConditionalCheckFailedException') {
                            await delayPromise(exponentialBackoff)
                            exponentialBackoff = exponentialBackoff * 2
                            retries++
                            completed = false
                        }
                        else {
                            if (DEVELOPER_MODE) {
                                throw err
                            }
                            else {
                                returnValue = props.catchException?.(err) ?? {}
                            }
                        }
                    }
                }
            }
            //
            // TODO: Create custom error type to throw when the optimisticUpdate fails
            // entirely
            //
            return returnValue as Update
        }
    }
}

export default withUpdate
