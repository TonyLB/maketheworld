import type { MembershipEmissionCopyKind } from '../positions/manipulation/kernel/kernelStep'

/**
 * The presentation kernel's copy-suffix builders for membership narration (`presentStepSequence.ts`'s
 * `buildNarrationCopy`, `kind: 'membershipMove'` case) --- the only surviving exports of this file
 * after the async membership fan-in migration retired `MembershipPresentationFanInCluster`,
 * `membershipPresentationFanIn.ts` itself (its one remaining export, `MembershipEmissionCopyKind`,
 * relocated to `kernelStep.ts` --- the file that actually structurally depends on it), and the
 * `publishMembershipPresentation` publish function that used to call these directly. Every membership
 * move (navigate/home/connect/disconnect, and the ghost-purge repair sweep) now narrates through the
 * kernel's positional-capture mechanism instead of this file's own publish path --- these two
 * functions are reused verbatim rather than duplicated, since the copy wording itself did not change,
 * only how the audience and delivery are resolved.
 */
export const buildMembershipLeaveSuffix = (
    copyKind: MembershipEmissionCopyKind,
    exitName?: string
): string => {
    if (copyKind === 'exitAware' && exitName) {
        return ` left by ${exitName} exit.`
    }
    if (copyKind === 'home') {
        return ' left to return home.'
    }
    if (copyKind === 'disconnect') {
        return ' has disconnected.'
    }
    return ' has left.'
}

export const buildMembershipArriveSuffix = (copyKind: MembershipEmissionCopyKind): string => {
    if (copyKind === 'connect') {
        return ' has connected.'
    }
    return ' has arrived.'
}
