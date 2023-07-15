import {  UpdateItemCommand, UpdateItemCommandInput } from "@aws-sdk/client-dynamodb"
import { Constructor, DBHandlerBase, DBHandlerItem, DBHandlerKey, DBHandlerLegalKey } from "../baseClasses"
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

const updateByReducer = <T extends Record<string, any>>({ updateKeys, reducer }: { updateKeys: string[]; reducer: (draft: WritableDraft<T>) => void }) => (state: T | undefined): DynamicUpdateOutput | {} => {
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
                        draft.ExpressionAttributeValues[`:Old${index}`] = state[key]
                        draft.conditionExpressions.push(`${translatedKey} = :Old${index}`)
                        if (translatedKey in ExpressionAttributeNames) {
                            draft.ExpressionAttributeNames[translatedKey] = key
                        }
                    }
                    if (typeof newState === 'object' && key in newState && (typeof newState[key] !== 'undefined') && newState[key] !== state[key]) {
                        //
                        // Update existing item to new value
                        //
                        draft.ExpressionAttributeValues[`:Old${index}`] = state[key]
                        draft.ExpressionAttributeValues[`:New${index}`] = newState[key]
                        draft.setExpressions.push(`${translatedKey} = :New${index}`)
                        draft.conditionExpressions.push(`${translatedKey} = :Old${index}`)
                        if (translatedKey in ExpressionAttributeNames) {
                            draft.ExpressionAttributeNames[translatedKey] = key
                        }
                    }
                }
                else {
                    draft.conditionExpressions.push(`attribute_not_exists(${translatedKey})`)
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

export type UpdateExtendedProps<T extends Record<string, any>> = {
    updateKeys: string[],
    updateReducer: (draft: WritableDraft<T>) => void,
    ExpressionAttributeNames?: Record<string, any>,
    ReturnValues?: 'NONE' | 'ALL_NEW' | 'UPDATED_NEW',
    maxRetries?: number,
    catchException?: (err: any) => Promise<void>
}

export const withUpdate = <KIncoming extends DBHandlerLegalKey, T extends string = string>() => <GBase extends ReturnType<ReturnType<typeof withGetOperations<KIncoming, T>>>>(Base: GBase) => {
    return class UpdateDBHandler extends Base {

        //
        // optimisticUpdateFactory accepts a fetched (or cached) previous value, runs it through a reducer to generate changes,
        // and if there are changes then generates the UpdateWriteCommandInput (less TableName and ReturnValues) that would
        // attempt to create those changes in the DB.
        //
        _optimisticUpdateFactory<Fetch extends DBHandlerItem<KIncoming, T>>(
                previousItem: Fetch | undefined,
                props: { Key: DBHandlerKey<KIncoming, T> } & UpdateExtendedProps<Fetch>
            ): Omit<UpdateItemCommandInput, 'TableName' | 'ReturnValues'> | undefined
        {
            const {
                Key,
                updateKeys,
                updateReducer
            } = props
            if (!updateKeys.length) {
                return undefined
            }
            const updateOutput = updateByReducer({ updateKeys, reducer: updateReducer })(previousItem)
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
                    Key: marshall(this._remapIncomingObject(Key)),
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
        async optimisticUpdate<Update extends DBHandlerItem<KIncoming, T>>(props: { Key: ({ [key in KIncoming]: T } & { DataCategory: string }) } & UpdateExtendedProps<Update>): Promise<Update | undefined> {
            const {
                Key,
                updateKeys,
                updateReducer,
                maxRetries
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
                const stateFetch = await this.getItem<Update>({
                    Key,
                    ProjectionFields: updateKeys,
                })
                const state = stateFetch || {}
                const updateOutput = this._optimisticUpdateFactory(stateFetch, { Key, updateKeys, updateReducer })
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
