import type {
    EphemeraCharacterId,
    EphemeraObjectId,
    EphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { HostRelationalEdgeKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { isEphemeraCharacterId as isCharacterId, isEphemeraRoomId as isRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { FanInCluster, FanInHandlerOptions } from '@tonylb/mtw-lambda-patterns/ts/dataSource/fanInCluster'
import { FanInClusterStore } from '@tonylb/mtw-lambda-patterns/ts/dataSource/fanInClusterStore'
import type { MessageBus } from '../../messageBus/baseClasses'
import {
    publishObjectManipulationPresentation,
    publishObjectRelationalPresentation,
} from './publishObjectManipulationPresentation'
import { resolveRelationalPresentationLabels } from './resolveRelationalPresentationLabels'
import { resolveTakeHoldPresentationLabels } from './resolveTakeHoldPresentationLabels'

export type ObjectManipulationOperation = 'takeHold' | 'drop'

export type RelationalManipulationOperation = 'establishRelation' | 'dissolveRelation'

export type RelationalFactOperation = 'establish' | 'dissolve'

export type ObjectManipulationIntentLeg = {
    kind: 'intent'
    operation: ObjectManipulationOperation
    characterId: EphemeraCharacterId
    objectId: EphemeraObjectId
    /** The full carry-closed transfer set (BD-13) this leg's `objectId` is one member of --- size 1 for an ordinary command. `objectIds[0]` is the primary object; only its cluster publishes a message when the set has more than one member. */
    objectIds: EphemeraObjectId[]
    roomId: EphemeraRoomId
}

export type ObjectManipulationFactLeg = {
    kind: 'fact'
    objectId: EphemeraObjectId
    froms: EphemeraMembershipHostId[]
    to: EphemeraMembershipHostId | null
    beatAnchorTime: number
}

export type ObjectRelationalIntentLeg = {
    kind: 'relationalIntent'
    operation: RelationalManipulationOperation
    characterId: EphemeraCharacterId
    subjectId: EphemeraObjectId
    targetId: EphemeraObjectId
    roomId: EphemeraRoomId
    relationKind: HostRelationalEdgeKind
    relationLabel?: string
}

export type ObjectRelationalFactLeg = {
    kind: 'relationalFact'
    subjectId: EphemeraObjectId
    targetId: EphemeraObjectId
    hostRoomId: EphemeraRoomId
    relationKind: HostRelationalEdgeKind
    relationLabel?: string
    operation: RelationalFactOperation
    beatAnchorTime: number
}

export type ObjectManipulationPresentationLeg =
    | ObjectManipulationIntentLeg
    | ObjectManipulationFactLeg
    | ObjectRelationalIntentLeg
    | ObjectRelationalFactLeg

export type ObjectManipulationEmissionPlan = {
    operation: ObjectManipulationOperation
    characterId: EphemeraCharacterId
    objectId: EphemeraObjectId
    roomId: EphemeraRoomId
    beatAnchorTime: number
    characterName: string
    objectShortName: string
    /** Size of the carry-closed transfer set (BD-13); 1 for an ordinary command. */
    carriedObjectCount: number
}

export type ObjectRelationalEmissionPlan = {
    operation: RelationalManipulationOperation
    characterId: EphemeraCharacterId
    subjectId: EphemeraObjectId
    targetId: EphemeraObjectId
    roomId: EphemeraRoomId
    relationKind: HostRelationalEdgeKind
    relationLabel?: string
    beatAnchorTime: number
    characterName: string
    subjectShortName: string
    targetShortName: string
}

export type ObjectManipulationFanInHandlerContext = {
    messageBus: MessageBus;
}

export const objectManipulationClusterIdentity = (
    characterId: EphemeraCharacterId,
    objectId: EphemeraObjectId,
    beatAnchorTime: number
): string => `${characterId}:${objectId}:${beatAnchorTime}`

const roomFromFactFroms = (froms: EphemeraMembershipHostId[]): EphemeraRoomId | undefined => (
    froms.find((entry): entry is EphemeraRoomId => isRoomId(entry))
)

const characterFromFactFroms = (froms: EphemeraMembershipHostId[]): EphemeraCharacterId | undefined => (
    froms.find((entry): entry is EphemeraCharacterId => isCharacterId(entry))
)

const inferOperationFromFact = (fact: ObjectManipulationFactLeg): ObjectManipulationOperation | undefined => {
    if (fact.to !== null && isCharacterId(fact.to)) {
        return 'takeHold'
    }
    const characterId = characterFromFactFroms(fact.froms)
    if (characterId && fact.to !== null && isRoomId(fact.to)) {
        return 'drop'
    }
    return undefined
}

const intentEndpointsCompatibleWithFact = (
    intent: ObjectManipulationIntentLeg,
    fact: ObjectManipulationFactLeg
): boolean => {
    if (intent.objectId !== fact.objectId) {
        return false
    }
    if (intent.operation === 'takeHold') {
        if (!fact.froms.includes(intent.roomId)) {
            return false
        }
        if (fact.to !== intent.characterId) {
            return false
        }
        return true
    }
    if (!fact.froms.includes(intent.characterId)) {
        return false
    }
    if (fact.to !== intent.roomId) {
        return false
    }
    return true
}

export const buildObjectManipulationEmissionPlan = (
    legs: ObjectManipulationPresentationLeg[],
    options: { deferralExecution: boolean }
): Omit<ObjectManipulationEmissionPlan, 'characterName' | 'objectShortName'> | null => {
    const factLeg = legs.find((leg): leg is ObjectManipulationFactLeg => leg.kind === 'fact')
    if (!factLeg) {
        return null
    }

    const intentLeg = legs.find((leg): leg is ObjectManipulationIntentLeg => leg.kind === 'intent')
    let characterId: EphemeraCharacterId | undefined
    let roomId: EphemeraRoomId | undefined
    let operation: ObjectManipulationOperation | undefined

    if (intentLeg) {
        // Only the primary object's cluster publishes a message for a multi-object carry
        // (BD-13) --- every other object in the set gets its own intent+fact match (same
        // per-object cluster mechanism as an ordinary command) but must not emit its own line.
        if (intentLeg.objectIds.length > 1 && factLeg.objectId !== intentLeg.objectIds[0]) {
            return null
        }
        characterId = intentLeg.characterId
        roomId = intentLeg.roomId
        operation = intentLeg.operation
    } else if (options.deferralExecution) {
        operation = inferOperationFromFact(factLeg)
        if (operation === 'takeHold') {
            if (factLeg.to !== null && isCharacterId(factLeg.to)) {
                characterId = factLeg.to
                roomId = roomFromFactFroms(factLeg.froms)
            }
        } else if (operation === 'drop') {
            characterId = characterFromFactFroms(factLeg.froms)
            if (factLeg.to !== null && isRoomId(factLeg.to)) {
                roomId = factLeg.to
            }
        }
    }

    if (!characterId || !roomId || !operation) {
        return null
    }

    return {
        operation,
        characterId,
        objectId: factLeg.objectId,
        roomId,
        carriedObjectCount: intentLeg?.objectIds.length ?? 1,
        beatAnchorTime: factLeg.beatAnchorTime,
    }
}

export class ObjectManipulationPresentationFanInCluster extends FanInCluster<
    ObjectManipulationPresentationLeg,
    ObjectManipulationFanInHandlerContext
> {
    readonly characterId: EphemeraCharacterId
    readonly objectId: EphemeraObjectId
    readonly legs: ObjectManipulationPresentationLeg[] = []

    constructor(characterId: EphemeraCharacterId, objectId: EphemeraObjectId) {
        super()
        this.characterId = characterId
        this.objectId = objectId
    }

    private factLeg(): ObjectManipulationFactLeg | undefined {
        return this.legs.find((leg): leg is ObjectManipulationFactLeg => leg.kind === 'fact')
    }

    private intentLeg(): ObjectManipulationIntentLeg | undefined {
        return this.legs.find((leg): leg is ObjectManipulationIntentLeg => leg.kind === 'intent')
    }

    canAcceptLeg(leg: ObjectManipulationPresentationLeg): boolean {
        if (leg.kind === 'relationalIntent' || leg.kind === 'relationalFact') {
            return false
        }
        if (leg.kind === 'intent') {
            if (leg.characterId !== this.characterId || leg.objectId !== this.objectId) {
                return false
            }
            if (this.intentLeg()) {
                return false
            }
            const fact = this.factLeg()
            return fact ? intentEndpointsCompatibleWithFact(leg, fact) : true
        }

        if (leg.objectId !== this.objectId) {
            return false
        }
        if (this.factLeg()) {
            return false
        }
        const intent = this.intentLeg()
        return intent ? intentEndpointsCompatibleWithFact(intent, leg) : true
    }

    canUnifyWith(other: FanInCluster<ObjectManipulationPresentationLeg, ObjectManipulationFanInHandlerContext>): boolean {
        if (!(other instanceof ObjectManipulationPresentationFanInCluster)) {
            return false
        }
        if (other.characterId !== this.characterId || other.objectId !== this.objectId) {
            return false
        }

        const myFact = this.factLeg()
        const otherFact = other.factLeg()
        if (myFact && otherFact) {
            return myFact.beatAnchorTime === otherFact.beatAnchorTime
                && myFact.to === otherFact.to
                && myFact.froms.length === otherFact.froms.length
                && myFact.froms.every((entry, index) => entry === otherFact.froms[index])
        }

        const myIntent = this.intentLeg()
        const otherIntent = other.intentLeg()

        if (myFact && otherIntent) {
            return intentEndpointsCompatibleWithFact(otherIntent, myFact)
        }
        if (otherFact && myIntent) {
            return intentEndpointsCompatibleWithFact(myIntent, otherFact)
        }

        if (myIntent && otherIntent) {
            return myIntent.operation === otherIntent.operation
                && myIntent.roomId === otherIntent.roomId
        }

        return true
    }

    unifyWith(other: FanInCluster<ObjectManipulationPresentationLeg, ObjectManipulationFanInHandlerContext>): void {
        if (!(other instanceof ObjectManipulationPresentationFanInCluster)) {
            return
        }
        for (const leg of other.legs) {
            if (!this.legs.some((existing) => existing.kind === leg.kind)) {
                this.legs.push(leg)
            }
        }
    }

    registerLeg(leg: ObjectManipulationPresentationLeg): void {
        this.legs.push(leg)
    }

    clusterIdentity(): string | null {
        const fact = this.factLeg()
        if (!fact) {
            return null
        }
        return objectManipulationClusterIdentity(this.characterId, this.objectId, fact.beatAnchorTime)
    }

    get completed(): boolean {
        return Boolean(this.intentLeg()) && Boolean(this.factLeg())
    }

    async handler(ctx: ObjectManipulationFanInHandlerContext, options: FanInHandlerOptions): Promise<void> {
        const structuralPlan = buildObjectManipulationEmissionPlan(this.legs, {
            deferralExecution: options.deferralExecution,
        })
        if (!structuralPlan) {
            return
        }

        const labels = await resolveTakeHoldPresentationLabels({
            characterId: structuralPlan.characterId,
            objectId: structuralPlan.objectId,
            roomId: structuralPlan.roomId,
        })

        publishObjectManipulationPresentation(ctx.messageBus, {
            ...structuralPlan,
            ...labels,
        })
    }
}

export const objectManipulationPresentationClusterFromLeg = (
    leg: ObjectManipulationPresentationLeg
): ObjectManipulationPresentationFanInCluster | null => {
    if (leg.kind === 'relationalIntent' || leg.kind === 'relationalFact') {
        return null
    }
    if (leg.kind === 'intent') {
        return new ObjectManipulationPresentationFanInCluster(leg.characterId, leg.objectId)
    }
    if (leg.to !== null && isCharacterId(leg.to)) {
        return new ObjectManipulationPresentationFanInCluster(leg.to, leg.objectId)
    }
    const characterId = characterFromFactFroms(leg.froms)
    if (characterId && leg.to !== null && isRoomId(leg.to)) {
        return new ObjectManipulationPresentationFanInCluster(characterId, leg.objectId)
    }
    return null
}

const relationalIntentOperationFromFact = (
    operation: RelationalFactOperation
): RelationalManipulationOperation => (
    operation === 'establish' ? 'establishRelation' : 'dissolveRelation'
)

const relationFieldsCompatible = (
    relationKind: HostRelationalEdgeKind,
    relationLabel: string | undefined,
    otherKind: HostRelationalEdgeKind,
    otherLabel: string | undefined
): boolean => {
    if (relationKind !== otherKind) {
        return false
    }
    if (relationKind === 'Custom') {
        return relationLabel === otherLabel
    }
    return true
}

const relationalIntentEndpointsCompatibleWithFact = (
    intent: ObjectRelationalIntentLeg,
    fact: ObjectRelationalFactLeg
): boolean => {
    if (intent.subjectId !== fact.subjectId || intent.targetId !== fact.targetId) {
        return false
    }
    if (intent.roomId !== fact.hostRoomId) {
        return false
    }
    if (!relationFieldsCompatible(
        intent.relationKind,
        intent.relationLabel,
        fact.relationKind,
        fact.relationLabel
    )) {
        return false
    }
    return relationalIntentOperationFromFact(fact.operation) === intent.operation
}

export const objectRelationalClusterIdentity = (
    characterId: EphemeraCharacterId,
    subjectId: EphemeraObjectId,
    targetId: EphemeraObjectId,
    beatAnchorTime: number
): string => `${characterId}:${subjectId}:${targetId}:${beatAnchorTime}`

export const buildObjectRelationalEmissionPlan = (
    legs: ObjectManipulationPresentationLeg[]
): Omit<ObjectRelationalEmissionPlan, 'characterName' | 'subjectShortName' | 'targetShortName'> | null => {
    const factLeg = legs.find((leg): leg is ObjectRelationalFactLeg => leg.kind === 'relationalFact')
    if (!factLeg) {
        return null
    }

    const intentLeg = legs.find((leg): leg is ObjectRelationalIntentLeg => leg.kind === 'relationalIntent')
    if (!intentLeg) {
        return null
    }

    return {
        operation: intentLeg.operation,
        characterId: intentLeg.characterId,
        subjectId: factLeg.subjectId,
        targetId: factLeg.targetId,
        roomId: intentLeg.roomId,
        relationKind: factLeg.relationKind,
        ...(factLeg.relationLabel !== undefined ? { relationLabel: factLeg.relationLabel } : {}),
        beatAnchorTime: factLeg.beatAnchorTime,
    }
}

export class ObjectRelationalPresentationFanInCluster extends FanInCluster<
    ObjectManipulationPresentationLeg,
    ObjectManipulationFanInHandlerContext
> {
    readonly subjectId: EphemeraObjectId
    readonly targetId: EphemeraObjectId
    characterId: EphemeraCharacterId | undefined
    readonly legs: ObjectManipulationPresentationLeg[] = []

    constructor(
        subjectId: EphemeraObjectId,
        targetId: EphemeraObjectId,
        characterId?: EphemeraCharacterId
    ) {
        super()
        this.subjectId = subjectId
        this.targetId = targetId
        this.characterId = characterId
    }

    private factLeg(): ObjectRelationalFactLeg | undefined {
        return this.legs.find((leg): leg is ObjectRelationalFactLeg => leg.kind === 'relationalFact')
    }

    private intentLeg(): ObjectRelationalIntentLeg | undefined {
        return this.legs.find((leg): leg is ObjectRelationalIntentLeg => leg.kind === 'relationalIntent')
    }

    canAcceptLeg(leg: ObjectManipulationPresentationLeg): boolean {
        if (leg.kind === 'intent' || leg.kind === 'fact') {
            return false
        }
        if (leg.kind === 'relationalIntent') {
            if (leg.subjectId !== this.subjectId || leg.targetId !== this.targetId) {
                return false
            }
            if (this.characterId !== undefined && leg.characterId !== this.characterId) {
                return false
            }
            if (this.intentLeg()) {
                return false
            }
            const fact = this.factLeg()
            return fact ? relationalIntentEndpointsCompatibleWithFact(leg, fact) : true
        }

        if (leg.subjectId !== this.subjectId || leg.targetId !== this.targetId) {
            return false
        }
        if (this.factLeg()) {
            return false
        }
        const intent = this.intentLeg()
        return intent ? relationalIntentEndpointsCompatibleWithFact(intent, leg) : true
    }

    canUnifyWith(other: FanInCluster<ObjectManipulationPresentationLeg, ObjectManipulationFanInHandlerContext>): boolean {
        if (!(other instanceof ObjectRelationalPresentationFanInCluster)) {
            return false
        }
        if (other.subjectId !== this.subjectId || other.targetId !== this.targetId) {
            return false
        }

        const myFact = this.factLeg()
        const otherFact = other.factLeg()
        if (myFact && otherFact) {
            return myFact.beatAnchorTime === otherFact.beatAnchorTime
                && myFact.operation === otherFact.operation
                && myFact.hostRoomId === otherFact.hostRoomId
                && relationFieldsCompatible(
                    myFact.relationKind,
                    myFact.relationLabel,
                    otherFact.relationKind,
                    otherFact.relationLabel
                )
        }

        const myIntent = this.intentLeg()
        const otherIntent = other.intentLeg()

        if (myFact && otherIntent) {
            return relationalIntentEndpointsCompatibleWithFact(otherIntent, myFact)
        }
        if (otherFact && myIntent) {
            return relationalIntentEndpointsCompatibleWithFact(myIntent, otherFact)
        }

        if (myIntent && otherIntent) {
            return myIntent.operation === otherIntent.operation
                && myIntent.characterId === otherIntent.characterId
                && myIntent.roomId === otherIntent.roomId
        }

        return true
    }

    unifyWith(other: FanInCluster<ObjectManipulationPresentationLeg, ObjectManipulationFanInHandlerContext>): void {
        if (!(other instanceof ObjectRelationalPresentationFanInCluster)) {
            return
        }
        if (this.characterId === undefined && other.characterId !== undefined) {
            this.characterId = other.characterId
        }
        for (const leg of other.legs) {
            if (!this.legs.some((existing) => existing.kind === leg.kind)) {
                this.legs.push(leg)
            }
        }
    }

    registerLeg(leg: ObjectManipulationPresentationLeg): void {
        if (leg.kind === 'relationalIntent' && this.characterId === undefined) {
            this.characterId = leg.characterId
        }
        this.legs.push(leg)
    }

    clusterIdentity(): string | null {
        const fact = this.factLeg()
        if (!fact || this.characterId === undefined) {
            return null
        }
        return objectRelationalClusterIdentity(
            this.characterId,
            this.subjectId,
            this.targetId,
            fact.beatAnchorTime
        )
    }

    get completed(): boolean {
        return Boolean(this.intentLeg()) && Boolean(this.factLeg())
    }

    async handler(ctx: ObjectManipulationFanInHandlerContext, _options: FanInHandlerOptions): Promise<void> {
        const structuralPlan = buildObjectRelationalEmissionPlan(this.legs)
        if (!structuralPlan) {
            return
        }

        const labels = await resolveRelationalPresentationLabels({
            characterId: structuralPlan.characterId,
            subjectId: structuralPlan.subjectId,
            targetId: structuralPlan.targetId,
            roomId: structuralPlan.roomId,
        })

        publishObjectRelationalPresentation(ctx.messageBus, {
            ...structuralPlan,
            ...labels,
        })
    }
}

export const objectRelationalPresentationClusterFromLeg = (
    leg: ObjectManipulationPresentationLeg
): ObjectRelationalPresentationFanInCluster | null => {
    if (leg.kind === 'relationalIntent') {
        return new ObjectRelationalPresentationFanInCluster(
            leg.subjectId,
            leg.targetId,
            leg.characterId
        )
    }
    if (leg.kind === 'relationalFact') {
        return new ObjectRelationalPresentationFanInCluster(leg.subjectId, leg.targetId)
    }
    return null
}

export type ObjectManipulationPresentationFanInClusterType =
    | ObjectManipulationPresentationFanInCluster
    | ObjectRelationalPresentationFanInCluster

export const createObjectManipulationPresentationFanInStore = () => new FanInClusterStore<
    ObjectManipulationPresentationLeg,
    ObjectManipulationFanInHandlerContext,
    ObjectManipulationPresentationFanInClusterType
>([
    objectManipulationPresentationClusterFromLeg,
    objectRelationalPresentationClusterFromLeg,
])

export const createObjectManipulationFanInHandlerContext = (
    messageBus: MessageBus
): ObjectManipulationFanInHandlerContext => ({
    messageBus,
})
