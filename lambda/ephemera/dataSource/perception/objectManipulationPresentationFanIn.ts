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
import { publishObjectRelationalPresentation } from './publishObjectManipulationPresentation'
import { resolveRelationalPresentationLabels } from './resolveRelationalPresentationLabels'

export type RelationalManipulationOperation = 'establishRelation' | 'dissolveRelation'

export type RelationalFactOperation = 'establish' | 'dissolve'

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

/**
 * Narrowed to the two relational members in Phase 4, when object take/drop stopped narrating through
 * this fan-in at all: it now compiles into the mutation kernel's step sequence and narrates from a
 * positionally-captured roster (`positions/manipulation/membership/orchestrateObjectMove.ts`). The
 * relational half --- reposition within a host --- is a deliberate deferral, not a boundary; it is
 * the third member of the same move family and belongs on the same compiler. Tracked in
 * `taskPlanning/lambda/ephemera/AGENT.relationalNarration.planning.md`.
 */
export type ObjectManipulationPresentationLeg =
    | ObjectRelationalIntentLeg
    | ObjectRelationalFactLeg

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

export type ObjectManipulationPresentationFanInClusterType = ObjectRelationalPresentationFanInCluster

export const createObjectManipulationPresentationFanInStore = () => new FanInClusterStore<
    ObjectManipulationPresentationLeg,
    ObjectManipulationFanInHandlerContext,
    ObjectManipulationPresentationFanInClusterType
>([
    objectRelationalPresentationClusterFromLeg,
])

export const createObjectManipulationFanInHandlerContext = (
    messageBus: MessageBus
): ObjectManipulationFanInHandlerContext => ({
    messageBus,
})
