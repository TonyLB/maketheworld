import type {
    EphemeraCharacterId,
    EphemeraObjectId,
    EphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { isEphemeraCharacterId as isCharacterId, isEphemeraRoomId as isRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { FanInCluster, FanInHandlerOptions } from '@tonylb/mtw-lambda-patterns/ts/dataSource/fanInCluster'
import { FanInClusterStore } from '@tonylb/mtw-lambda-patterns/ts/dataSource/fanInClusterStore'
import type { MessageBus } from '../../messageBus/baseClasses'
import { publishObjectManipulationPresentation } from './publishObjectManipulationPresentation'
import { resolveTakeHoldPresentationLabels } from './resolveTakeHoldPresentationLabels'

export type ObjectManipulationIntentLeg = {
    kind: 'intent'
    characterId: EphemeraCharacterId
    objectId: EphemeraObjectId
    roomId: EphemeraRoomId
}

export type ObjectManipulationFactLeg = {
    kind: 'fact'
    objectId: EphemeraObjectId
    froms: EphemeraMembershipHostId[]
    to: EphemeraMembershipHostId | null
    beatAnchorTime: number
}

export type ObjectManipulationPresentationLeg = ObjectManipulationIntentLeg | ObjectManipulationFactLeg

export type ObjectManipulationEmissionPlan = {
    characterId: EphemeraCharacterId
    objectId: EphemeraObjectId
    roomId: EphemeraRoomId
    beatAnchorTime: number
    characterName: string
    objectShortName: string
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

const intentEndpointsCompatibleWithFact = (
    intent: ObjectManipulationIntentLeg,
    fact: ObjectManipulationFactLeg
): boolean => {
    if (intent.objectId !== fact.objectId) {
        return false
    }
    if (!fact.froms.includes(intent.roomId)) {
        return false
    }
    if (fact.to !== intent.characterId) {
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

    if (intentLeg) {
        characterId = intentLeg.characterId
        roomId = intentLeg.roomId
    } else if (options.deferralExecution && factLeg.to !== null && isCharacterId(factLeg.to)) {
        characterId = factLeg.to
        roomId = roomFromFactFroms(factLeg.froms)
    }

    if (!characterId || !roomId) {
        return null
    }

    return {
        characterId,
        objectId: factLeg.objectId,
        roomId,
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
            return myIntent.roomId === otherIntent.roomId
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
    if (leg.kind === 'intent') {
        return new ObjectManipulationPresentationFanInCluster(leg.characterId, leg.objectId)
    }
    if (leg.to !== null && isCharacterId(leg.to)) {
        return new ObjectManipulationPresentationFanInCluster(leg.to, leg.objectId)
    }
    return null
}

export const createObjectManipulationPresentationFanInStore = () => new FanInClusterStore<
    ObjectManipulationPresentationLeg,
    ObjectManipulationFanInHandlerContext,
    ObjectManipulationPresentationFanInCluster
>([
    objectManipulationPresentationClusterFromLeg,
])

export const createObjectManipulationFanInHandlerContext = (
    messageBus: MessageBus
): ObjectManipulationFanInHandlerContext => ({
    messageBus,
})
