import AssetWorkspace, { NamespaceMapping } from '@tonylb/mtw-asset-workspace/dist/'
import {
    isNormalRoom,
    isNormalMap,
    NormalForm,
    isNormalComputed,
    isNormalCondition
} from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { unique } from '@tonylb/mtw-utilities/dist/lists'
import { MessageBus } from '../messageBus/baseClasses.js'

export class StateSynthesizer extends Object {
    assetId: string;
    namespaceIdToDB: NamespaceMapping;
    normalForm: NormalForm;
    messageBus: MessageBus;
    constructor(assetWorkspace: AssetWorkspace, messageBus: MessageBus) {
        super()
        this.namespaceIdToDB = assetWorkspace.namespaceIdToDB
        this.normalForm = assetWorkspace.normal || {}
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
                    (parentTag === 'Variable' || parentTag === 'Computed' || parentTag === 'Room' || parentTag === 'Map') &&
                    (childTag === 'Variable' || childTag === 'Computed' || childTag === 'Room' || childTag === 'Map')
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
                dependencies: unique(appearances
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
                    ), [] as string[])
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
