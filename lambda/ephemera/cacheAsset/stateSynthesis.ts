import AssetWorkspace, { NamespaceMapping } from '@tonylb/mtw-asset-workspace/dist/'
import {
    isNormalRoom,
    isNormalMap,
    NormalForm,
    isNormalComputed,
    isNormalCondition,
    NormalReference,
    NormalItem,
    NormalConditionMixin,
    isNormalBookmark
} from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { unique } from '@tonylb/mtw-utilities/dist/lists'
import { MessageBus } from '../messageBus/baseClasses.js'
import { TaggedMessageContentUnrestricted } from '@tonylb/mtw-interfaces/dist/messages.js'
import { WorkspaceProperties } from '@tonylb/mtw-asset-workspace'

const extractDependenciesFromTaggedContent = (values: TaggedMessageContentUnrestricted[]): string[] => {
    const returnValue = values.reduce<string[]>((previous, item) => {
        if (item.tag === 'Condition') {
            return [
                ...previous,
                ...(item.conditions
                    .map(({ dependencies }) => (dependencies))
                    .reduce<string[]>((accumulator, list) => ([ ...accumulator, ...list ]), [])
                ),
                ...extractDependenciesFromTaggedContent(item.contents)
            ]
        }
        if (item.tag === 'Bookmark') {
            return [
                ...previous,
                item.to
            ]
        }
        return previous
    }, [])
    return unique(returnValue) as string[]
}

const extractDependenciesFromContents = (normalForm: NormalForm, values: NormalReference[]): string[] => {
    const returnValue = values
        .filter(({ tag }) => (tag === 'If'))
        .map(({ key }) => (normalForm[key]))
        .filter((value): value is NormalItem => (Boolean(value)))
        .filter(isNormalCondition)
        .reduce<NormalConditionMixin["conditions"]>((previous, { conditions }) => ([ ...previous, ...conditions ]), [])
        .reduce<string[]>((previous, { dependencies }) => ([ ...previous, ...dependencies ]), [])
    return unique(returnValue) as string[]
}

export class StateSynthesizer extends Object {
    assetId: string;
    namespaceIdToDB: NamespaceMapping;
    normalForm: NormalForm;
    properties: WorkspaceProperties;
    messageBus: MessageBus;
    constructor(assetWorkspace: AssetWorkspace, messageBus: MessageBus) {
        super()
        this.namespaceIdToDB = assetWorkspace.namespaceIdToDB
        this.normalForm = assetWorkspace.normal || {}
        this.properties = assetWorkspace.properties
        this.assetId = (Object.values(this.normalForm).find(({ tag }) => (tag === 'Asset')) || { key: '' }).key
        this.messageBus = messageBus
    }
    
    sendDependencyMessages() {
        const sendMessages = ({ key: childKey, dependencies }: { key: string; dependencies: string[] }) => {
            const EphemeraId = this.namespaceIdToDB[childKey]
            if (!EphemeraId) {
                return
            }
            dependencies.forEach((key) => {
                const targetId = this.namespaceIdToDB[key]
                if (!targetId) {
                    return
                }
                const parentTag = this.normalForm[key]?.tag
                const childTag = this.normalForm[childKey]?.tag
                if (
                    (parentTag === 'Variable' || parentTag === 'Computed' || parentTag === 'Room' || parentTag === 'Map' || parentTag === 'Bookmark') &&
                    (childTag === 'Variable' || childTag === 'Computed' || childTag === 'Room' || childTag === 'Map' || parentTag === 'Bookmark')
                ) {
                    this.messageBus.send({
                        type: 'DescentUpdate',
                        EphemeraId: targetId,
                        putItem: {
                            key,
                            EphemeraId,
                            assets: [this.assetId]
                        }
                    })
                    this.messageBus.send({
                        type: 'AncestryUpdate',
                        EphemeraId,
                        putItem: {
                            key,
                            EphemeraId: targetId,
                            assets: [this.assetId]
                        }
                    })
                }
            })
        }
        Object.values(this.normalForm)
            .filter(isNormalComputed)
            .forEach(sendMessages)
        Object.values(this.normalForm)
            .filter(isNormalRoom)
            .map(({ key, appearances }) => ({
                key,
                dependencies: unique(
                    appearances
                        .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'Map'))))
                        .reduce((previous, { contextStack }) => (
                            contextStack
                                .filter(({ tag }) => (tag === 'If'))
                                .map(({ key }) => (this.normalForm[key]))
                                .filter(isNormalCondition)
                                .reduce((accumulator, { conditions }) => ([
                                    ...accumulator,
                                    ...conditions.reduce((innerAccumulator, { dependencies }) => ([
                                        ...innerAccumulator,
                                        ...dependencies
                                    ]), accumulator)
                                ]), previous)
                        ), [] as string[]),
                    appearances
                        .reduce<string[]>((previous, { render = [], name = [], contents = [] }) => ([
                            ...previous,
                            ...extractDependenciesFromTaggedContent(render),
                            ...extractDependenciesFromTaggedContent(name),
                            ...extractDependenciesFromContents(this.normalForm, contents)
                        ]), [])
                ) as string[]
            }))
            .forEach(sendMessages)
        Object.values(this.normalForm)
            .filter(isNormalBookmark)
            .map(({ key, appearances }) => ({
                key,
                dependencies: unique(
                    appearances
                        .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'Map'))))
                        .reduce((previous, { contextStack }) => (
                            contextStack
                                .filter(({ tag }) => (tag === 'If'))
                                .map(({ key }) => (this.normalForm[key]))
                                .filter(isNormalCondition)
                                .reduce((accumulator, { conditions }) => ([
                                    ...accumulator,
                                    ...conditions.reduce((innerAccumulator, { dependencies }) => ([
                                        ...innerAccumulator,
                                        ...dependencies
                                    ]), accumulator)
                                ]), previous)
                        ), [] as string[]),
                    appearances
                        .reduce<string[]>((previous, { render = [] }) => ([
                            ...previous,
                            ...extractDependenciesFromTaggedContent(render)
                        ]), [])
                ) as string[]
            }))
            .forEach(sendMessages)
        Object.values(this.normalForm)
            .filter(isNormalMap)
            .map(({ key, appearances }) => ({
                key,
                dependencies: unique(appearances
                    .reduce<string[]>((previous, { rooms }) => ([ ...previous, ...(rooms.map(({ key }) => (key)))]), [])
                ) as string[]
            }))
            .forEach(sendMessages)
    }
}

export default StateSynthesizer
