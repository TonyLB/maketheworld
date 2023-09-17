import {  DeleteItemCommand, DeleteItemCommandInput, UpdateItemCommand, UpdateItemCommandInput } from "@aws-sdk/client-dynamodb"
import { DBHandlerItem, DBHandlerKey, DBHandlerLegalKey } from "../baseClasses"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import mapProjectionFields, { reservedFields } from './utils/mapProjectionFields'
import { produce } from "immer"
import { WritableDraft } from "immer/dist/internal"
import withGetOperations from "./get"
import { DEVELOPER_MODE } from '../../constants'
import delayPromise from "../delayPromise"
import { unique } from "../../lists"
import { deepEqual } from "../../objects"

type DynamicUpdateOutputCommon<T extends Record<string, any>> = {
    ExpressionAttributeNames: Record<string, any>;
    ExpressionAttributeValues: Record<string, any>;
    conditionExpressions: string[];
    newState: T;
}

type DynamicUpdateOutput<T extends Record<string, any>> = {
    action: 'ignore';
} | (DynamicUpdateOutputCommon<T> & (
    {
        action: 'update';
        setExpressions: string[];
        removeExpressions: string[];
    } | { action: 'delete' }
))

type DynamicUpdateInProgress = {
    ExpressionAttributeNames: Record<string, any>;
    oldExpressionAttributeValues: Record<string, any>;
    newExpressionAttributeValues: Record<string, any>;
    conditionExpressions: string[];
    setExpressions: string[];
    removeExpressions: string[];
}

const updateByReducer = <T extends Record<string, any>>({ updateKeys, reducer, checkKeys, deleteCondition }: { updateKeys: string[]; reducer: (draft: WritableDraft<T>) => void, checkKeys?: string[], deleteCondition?: (value: T) => boolean }) => (state: T | undefined): DynamicUpdateOutput<T> => {
    const { ExpressionAttributeNames } = mapProjectionFields(updateKeys)
    const translateToExpressionAttributeNames = Object.entries(ExpressionAttributeNames).reduce<Record<string, string>>((previous, [key, value]) => ({ ...previous, [value]: key }), {})
    const newState = produce(state || {}, reducer) as T
    if (deepEqual(newState, state)) {
        return { action: 'ignore' }
    }
    if (typeof state === 'object' && typeof newState === 'object') {
        //
        // Compare an existing record to changes
        //
        const startingDraft: DynamicUpdateInProgress = {
            ExpressionAttributeNames: {},
            oldExpressionAttributeValues: {},
            newExpressionAttributeValues: {},
            setExpressions: [],
            removeExpressions: [],
            conditionExpressions: []
        }
        const dynamicOutput: DynamicUpdateInProgress = produce(startingDraft, (draft) => {
            updateKeys.forEach((key, index) => {
                const translatedKey = key in translateToExpressionAttributeNames ? translateToExpressionAttributeNames[key] : key
                if (typeof state === 'object' && key in state && (typeof state[key] !== 'undefined')) {
                    if (newState?.[key] === undefined) {
                        //
                        // Remove existing item
                        //
                        draft.removeExpressions.push(`${translatedKey}`)
                        if ((!checkKeys) || checkKeys.includes(key)) {
                            draft.oldExpressionAttributeValues[`:Old${index}`] = state[key]
                            draft.conditionExpressions.push(`${translatedKey} = :Old${index}`)
                        }
                        if (translatedKey in ExpressionAttributeNames) {
                            draft.ExpressionAttributeNames[translatedKey] = key
                        }
                    }
                    else if (!deepEqual(newState[key], state[key])) {
                        //
                        // Update existing item to new value
                        //
                        draft.newExpressionAttributeValues[`:New${index}`] = newState[key]
                        draft.setExpressions.push(`${translatedKey} = :New${index}`)
                        if ((!checkKeys) || checkKeys.includes(key)) {
                            draft.oldExpressionAttributeValues[`:Old${index}`] = state[key]
                            draft.conditionExpressions.push(`${translatedKey} = :Old${index}`)
                        }
                        if (translatedKey in ExpressionAttributeNames) {
                            draft.ExpressionAttributeNames[translatedKey] = key
                        }
                    }
                    else if ((checkKeys || []).includes(key)) {
                        draft.oldExpressionAttributeValues[`:Old${index}`] = state[key]
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
                        draft.newExpressionAttributeValues[`:New${index}`] = newState[key]
                        draft.setExpressions.push(`${translatedKey} = :New${index}`)
                    }
                }
            })
        })
        if (deleteCondition && deleteCondition(newState)) {
            return {
                action: 'delete',
                ExpressionAttributeNames: dynamicOutput.ExpressionAttributeNames,
                ExpressionAttributeValues: dynamicOutput.oldExpressionAttributeValues,
                conditionExpressions: dynamicOutput.conditionExpressions,
                newState
            }
        }
        return {
            action: 'update',
            ExpressionAttributeNames: dynamicOutput.ExpressionAttributeNames,
            ExpressionAttributeValues: { ...dynamicOutput.oldExpressionAttributeValues, ...dynamicOutput.newExpressionAttributeValues },
            conditionExpressions: dynamicOutput.conditionExpressions,
            setExpressions: dynamicOutput.setExpressions,
            removeExpressions: dynamicOutput.removeExpressions,
            newState
        }
    }
    else {
        //
        // Evaluate a new record where none existed before
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
        return { action: 'update', newState, ...produce(startingDraft, (draft) => {
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
                    draft.setExpressions.push(`${translatedKey} = :New${index}`)
                }
            })
        }) }
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
    //
    // deleteCondition, if provided, checks whether the resulting record is one that should
    // be deleted, rather than updated (e.g., an aggregate record that has been reduced down
    // to the point where it is aggregating over nothing), and if so deletes
    //
    deleteCondition?: (output: T) => boolean;
    //
    // deleteCascade, if provided, creates a list of keys *beyond* the one deleted by deleteCondition (above),
    // to also delete (e.g., removing a meta record and removing any cache records associated with it)
    //
    deleteCascade?: (output: DBHandlerItem<KIncoming, KeyType>) => DBHandlerKey<KIncoming, KeyType>[];
    //
    // successCallback, if provided, is called with the results *only* after the update succeeds
    //
    successCallback?: (output: T, prior: T) => void;
    succeedAll?: boolean;
}

type OptimisticUpdateFactoryOutput<T extends {}> = {
    action: 'ignore';
} | {
    action: 'update';
    update: Omit<UpdateItemCommandInput, 'TableName' | 'ReturnValues'>;
    newState: T;
} | {
    action: 'delete';
    deletes: Omit<DeleteItemCommandInput, 'TableName'>[];
    newState: T;
}

export const withUpdate = <KIncoming extends DBHandlerLegalKey, T extends string = string>() => <GBase extends ReturnType<ReturnType<typeof withGetOperations<KIncoming, T>>>>(Base: GBase) => {
    return class UpdateDBHandler extends Base {

        async setOperation(props: {
            Key: ({ [key in KIncoming]: T } & { DataCategory: string });
            attributeName: string;
            addItems?: string[];
            deleteItems?: string[];
            setUpdate?: Omit<UpdateItemCommandInput, 'TableName' | 'Key'>
        }) {
            const { Key, attributeName, addItems = [], deleteItems = [], setUpdate } = props
            if (reservedFields.includes(attributeName)) {
                throw new Error('setOperation is not (yet) able to handle reserved field names')
            }
            await this._client.send(new UpdateItemCommand({
                TableName: this._tableName,
                Key: marshall(this._remapIncomingObject(Key), { removeUndefinedValues: true }),
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
            }))
        }

        //
        // optimisticUpdateFactory accepts a fetched (or cached) previous value, runs it through a reducer to generate changes,
        // and if there are changes then generates the UpdateWriteCommandInput (less TableName and ReturnValues) that would
        // attempt to create those changes in the DB.
        //

        //
        // TODO: Refactor _optimisticUpdateFactory to return a discriminated union with 'action' proprerty of 'update' | 'delete' | 'ignore'
        //
        _optimisticUpdateFactory<Fetch extends Partial<DBHandlerItem<KIncoming, T>>>(
                previousItem: Fetch | { [x: string]: never } | undefined,
                props: { Key: DBHandlerKey<KIncoming, T> } & UpdateExtendedProps<KIncoming, T, Fetch>
            ): OptimisticUpdateFactoryOutput<Fetch>
        {
            const {
                Key,
                updateKeys,
                updateReducer,
                checkKeys,
                deleteCondition,
                deleteCascade
            } = props
            if (!updateKeys.length) {
                return { action: 'ignore' }
            }
            const undefineEmptyObject = (value: Fetch | { [x: string]: never } | undefined): Fetch | undefined => ((value && Object.keys(value).length) ? value as Fetch : undefined)
            const updateOutput = updateByReducer({ updateKeys, reducer: updateReducer, checkKeys, deleteCondition })(undefineEmptyObject(previousItem))
            if (updateOutput.action === 'ignore') {
                return { action: 'ignore' }
            }
            else if (updateOutput.action === 'delete') {
                const { ExpressionAttributeNames, ExpressionAttributeValues, conditionExpressions } = updateOutput
                const cascadeDeletes = deleteCascade ? deleteCascade({ ...Key, ...updateOutput.newState }) : []
                return {
                    action: 'delete',
                    deletes: [
                        {
                            Key: marshall(this._remapIncomingObject(Key), { removeUndefinedValues: true }),
                            ...(conditionExpressions.length ? {
                                ConditionExpression: conditionExpressions.join(' AND ')
                            } : {}),
                            ...(ExpressionAttributeValues ? { ExpressionAttributeValues: marshall(ExpressionAttributeValues, { removeUndefinedValues: true }) } : {}),
                            ...((ExpressionAttributeNames && Object.values(ExpressionAttributeNames).length > 0) ? { ExpressionAttributeNames } : {}),
                        },
                        ...cascadeDeletes.map((key) => ({ Key: marshall(this._remapIncomingObject(key), { removeUndefinedValues: true }) }))
                    ],
                    newState: updateOutput.newState
                }
            }
            else {
                const { ExpressionAttributeNames, ExpressionAttributeValues, setExpressions, removeExpressions, conditionExpressions } = updateOutput
                const UpdateExpression = [
                    setExpressions.length ? `SET ${setExpressions.join(', ')}` : '',
                    removeExpressions.length ? `REMOVE ${removeExpressions.join(', ')}` : ''
                ].filter((value) => (value)).join(' ')
                if (!UpdateExpression) {
                    return { action: 'ignore' }
                }
                return {
                    action: 'update',
                    update: {
                        Key: marshall(this._remapIncomingObject(Key), { removeUndefinedValues: true }),
                        UpdateExpression,
                        ...(conditionExpressions.length ? {
                            ConditionExpression: conditionExpressions.join(' AND ')
                        } : {}),
                        ...(ExpressionAttributeValues ? { ExpressionAttributeValues: marshall(ExpressionAttributeValues, { removeUndefinedValues: true }) } : {}),
                        ...((ExpressionAttributeNames && Object.values(ExpressionAttributeNames).length > 0) ? { ExpressionAttributeNames } : {}),
                    },
                    newState: updateOutput.newState
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

        //
        // TODO: Refactor optimisticUpdate with exponentialBackoffWrapper
        //
        async optimisticUpdate<Update extends Partial<DBHandlerItem<KIncoming, T>>>(props: { Key: ({ [key in KIncoming]: T } & { DataCategory: string }) } & UpdateExtendedProps<KIncoming, T, Update>): Promise<Update | undefined> {
            const {
                Key,
                updateKeys,
                updateReducer,
                maxRetries,
                priorFetch,
                checkKeys,
                deleteCondition,
                deleteCascade,
                successCallback,
                succeedAll
            } = props
            if (!updateKeys) {
                return undefined
            }
            let retries = 0
            let exponentialBackoff = 100
            let returnValue: Record<string, any> = {}
            let completed = false
            let updated = false
            let state: Update | { [x: string]: never } = {}
            while(!completed && (retries <= (maxRetries ?? 5))) {
                completed = true
                const stateFetch = ((!retries && priorFetch) || (await this.getItem<Update>({
                    Key,
                    ProjectionFields: unique(updateKeys, [this._internalKeyLabel, 'DataCategory']),
                }))) as Update | { [x: string]: never } | undefined
                state = stateFetch || {}
                
                const updateOutput = this._optimisticUpdateFactory(stateFetch, { Key, updateKeys, updateReducer, checkKeys, deleteCondition, deleteCascade })
                if (updateOutput.action === 'ignore') {
                    returnValue = { ...Key, ...state}
                    break
                }
                else if (updateOutput.action === 'delete') {
                    try {
                        await Promise.all(updateOutput.deletes.map((deleteItem) => (this._client.send(new DeleteItemCommand({
                            TableName: this._tableName,
                            ...deleteItem
                        })))))
                        if (successCallback && succeedAll) {
                            returnValue = { ...Key, ...state}
                        }
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
                else {
                    try {
                        const { Attributes = {} } = await this._client.send(new UpdateItemCommand({
                            TableName: this._tableName,
                            ReturnValues: props.ReturnValues,
                            ...updateOutput.update
                        }))
                        returnValue = this._remapOutgoingObject(props.ReturnValues ? unmarshall(Attributes) as any : { ...Key, ...updateOutput.newState })
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
                    updated = true
                }
            }
            //
            // TODO: Create custom error type to throw when the optimisticUpdate fails
            // entirely
            //
            if (successCallback && (updated || succeedAll)) {
                successCallback(returnValue as Update, state as Update)
            }
            return returnValue as Update
        }
    }
}

export default withUpdate
