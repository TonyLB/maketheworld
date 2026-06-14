import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { FanInCluster, FanInHandlerOptions } from '@tonylb/mtw-lambda-patterns/ts/dataSource/fanInCluster'
import { FanInClusterStore } from '@tonylb/mtw-lambda-patterns/ts/dataSource/fanInClusterStore'
import type { MessageBus } from '../../messageBus/baseClasses'
import { publishMembershipPresentation } from './publishMembershipPresentation'

/** Provisional until positions publishedEvents.ts (slice 1b); null = out of play. */
export type MembershipEndpoint = EphemeraRoomId | null

export type MembershipIntentKind = 'navigate' | 'home' | 'teleport' | 'connect' | 'disconnect'

export type MembershipIntentLeg = {
    kind: 'intent'
    characterId: EphemeraCharacterId
    intentKind: MembershipIntentKind
    fromRoomId?: EphemeraRoomId
    toRoomId?: EphemeraRoomId
    exitName?: string
}

export type MembershipFactLeg = {
    kind: 'fact'
    characterId: EphemeraCharacterId
    from: MembershipEndpoint
    to: MembershipEndpoint
    legalExits?: string[]
    beatAnchorTime: number
    characterName?: string
}

export type MembershipPresentationLeg = MembershipIntentLeg | MembershipFactLeg

export type MembershipEmissionShape = 'leaveAndArrive' | 'arriveOnly' | 'leaveOnly' | 'none'

export type MembershipEmissionCopyKind =
    | 'exitAware'
    | 'home'
    | 'connect'
    | 'disconnect'
    | 'genericNavigate'
    | 'genericFactOnly'

export type MembershipEmissionPlan = {
    shape: MembershipEmissionShape
    copyKind: MembershipEmissionCopyKind
    exitName?: string
    beatAnchorTime: number
    characterId: EphemeraCharacterId
    from: MembershipEndpoint
    to: MembershipEndpoint
    characterName?: string
}

export type MembershipFanInHandlerContext = {
    messageBus: MessageBus;
}

const formatEndpointForIdentity = (endpoint: MembershipEndpoint): string => (
    endpoint ?? 'out'
)

export const membershipClusterIdentity = (
    characterId: EphemeraCharacterId,
    from: MembershipEndpoint,
    to: MembershipEndpoint
): string => (
    `${characterId}:${formatEndpointForIdentity(from)}->${formatEndpointForIdentity(to)}`
)

export const inferMembershipEmissionShape = (
    from: MembershipEndpoint,
    to: MembershipEndpoint
): MembershipEmissionShape => {
    const fromInPlay = from !== null
    const toInPlay = to !== null
    if (fromInPlay && toInPlay && from !== to) {
        return 'leaveAndArrive'
    }
    if (!fromInPlay && toInPlay) {
        return 'arriveOnly'
    }
    if (fromInPlay && !toInPlay) {
        return 'leaveOnly'
    }
    return 'none'
}

const intentEndpointsCompatibleWithFact = (
    intent: MembershipIntentLeg,
    fact: MembershipFactLeg
): boolean => {
    if (intent.fromRoomId !== undefined && intent.fromRoomId !== fact.from) {
        return false
    }
    if (intent.toRoomId !== undefined && intent.toRoomId !== fact.to) {
        return false
    }
    return true
}

const endpointsCompatible = (
    leftFrom: MembershipEndpoint | undefined,
    leftTo: MembershipEndpoint | undefined,
    rightFrom: MembershipEndpoint | undefined,
    rightTo: MembershipEndpoint | undefined
): boolean => {
    if (leftFrom !== undefined && rightFrom !== undefined && leftFrom !== rightFrom) {
        return false
    }
    if (leftTo !== undefined && rightTo !== undefined && leftTo !== rightTo) {
        return false
    }
    return true
}

export const buildMembershipEmissionPlan = (
    legs: MembershipPresentationLeg[],
    options: { deferralExecution: boolean }
): MembershipEmissionPlan | null => {
    const factLeg = legs.find((leg): leg is MembershipFactLeg => leg.kind === 'fact')
    if (!factLeg) {
        return null
    }

    const intentLeg = legs.find((leg): leg is MembershipIntentLeg => leg.kind === 'intent')
    const shape = inferMembershipEmissionShape(factLeg.from, factLeg.to)

    let copyKind: MembershipEmissionCopyKind = 'genericFactOnly'
    let exitName: string | undefined

    if (!options.deferralExecution && intentLeg) {
        if (intentLeg.intentKind === 'navigate' && intentLeg.exitName) {
            copyKind = 'exitAware'
            exitName = intentLeg.exitName
        } else if (intentLeg.intentKind === 'home') {
            copyKind = 'home'
        } else if (intentLeg.intentKind === 'connect') {
            copyKind = 'connect'
        } else if (intentLeg.intentKind === 'disconnect') {
            copyKind = 'disconnect'
        } else {
            copyKind = 'genericNavigate'
        }
    }

    return {
        shape,
        copyKind,
        exitName,
        beatAnchorTime: factLeg.beatAnchorTime,
        characterId: factLeg.characterId,
        from: factLeg.from,
        to: factLeg.to,
        characterName: factLeg.characterName,
    }
}

export class MembershipPresentationFanInCluster extends FanInCluster<
    MembershipPresentationLeg,
    MembershipFanInHandlerContext
> {
    readonly characterId: EphemeraCharacterId
    readonly legs: MembershipPresentationLeg[] = []

    constructor(characterId: EphemeraCharacterId) {
        super()
        this.characterId = characterId
    }

    private factLeg(): MembershipFactLeg | undefined {
        return this.legs.find((leg): leg is MembershipFactLeg => leg.kind === 'fact')
    }

    private intentLeg(): MembershipIntentLeg | undefined {
        return this.legs.find((leg): leg is MembershipIntentLeg => leg.kind === 'intent')
    }

    canAcceptLeg(leg: MembershipPresentationLeg): boolean {
        if (leg.characterId !== this.characterId) {
            return false
        }
        if (leg.kind === 'intent') {
            if (this.intentLeg()) {
                return false
            }
            const fact = this.factLeg()
            return fact ? intentEndpointsCompatibleWithFact(leg, fact) : true
        }
        if (this.factLeg()) {
            return false
        }
        const intent = this.intentLeg()
        return intent ? intentEndpointsCompatibleWithFact(intent, leg) : true
    }

    canUnifyWith(other: FanInCluster<MembershipPresentationLeg, MembershipFanInHandlerContext>): boolean {
        if (!(other instanceof MembershipPresentationFanInCluster)) {
            return false
        }
        if (other.characterId !== this.characterId) {
            return false
        }

        const myFact = this.factLeg()
        const otherFact = other.factLeg()
        if (myFact && otherFact) {
            return myFact.from === otherFact.from && myFact.to === otherFact.to
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
            return endpointsCompatible(
                myIntent.fromRoomId,
                myIntent.toRoomId,
                otherIntent.fromRoomId,
                otherIntent.toRoomId
            )
        }

        return true
    }

    unifyWith(other: FanInCluster<MembershipPresentationLeg, MembershipFanInHandlerContext>): void {
        if (!(other instanceof MembershipPresentationFanInCluster)) {
            return
        }
        for (const leg of other.legs) {
            if (!this.legs.some((existing) => existing.kind === leg.kind)) {
                this.legs.push(leg)
            }
        }
    }

    registerLeg(leg: MembershipPresentationLeg): void {
        this.legs.push(leg)
    }

    clusterIdentity(): string | null {
        const fact = this.factLeg()
        if (!fact) {
            return null
        }
        return membershipClusterIdentity(fact.characterId, fact.from, fact.to)
    }

    get completed(): boolean {
        return Boolean(this.intentLeg()) && Boolean(this.factLeg())
    }

    async handler(ctx: MembershipFanInHandlerContext, options: FanInHandlerOptions): Promise<void> {
        const plan = buildMembershipEmissionPlan(this.legs, {
            deferralExecution: options.deferralExecution,
        })
        if (plan) {
            publishMembershipPresentation(ctx.messageBus, plan)
        }
    }
}

export const membershipPresentationClusterFromLeg = (
    leg: MembershipPresentationLeg
): MembershipPresentationFanInCluster | null => {
    if (leg.kind === 'intent' || leg.kind === 'fact') {
        return new MembershipPresentationFanInCluster(leg.characterId)
    }
    return null
}

export const createMembershipPresentationFanInStore = () => new FanInClusterStore<
    MembershipPresentationLeg,
    MembershipFanInHandlerContext,
    MembershipPresentationFanInCluster
>([
    membershipPresentationClusterFromLeg,
])

export const createMembershipFanInHandlerContext = (messageBus: MessageBus): MembershipFanInHandlerContext => ({
    messageBus,
})
