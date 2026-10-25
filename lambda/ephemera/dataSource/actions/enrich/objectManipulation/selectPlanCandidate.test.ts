import { objectManipulationErrorMessages } from './resolveObjectSpan'
import { selectPlanTuple } from './selectPlanCandidate'
import type { DryRunOutcome } from './validatePlanDryRun'

type Candidate = { name: string; confidence: number; dryRun: DryRunOutcome }

const select = (candidates: Candidate[]) => selectPlanTuple({
    candidates,
    getConfidence: (candidate) => candidate.confidence,
    dryRun: (candidate) => candidate.dryRun,
    toConsultAlternative: (candidate) => ({ label: candidate.name, proposedCommand: candidate.name }),
})

describe('selectPlanTuple', () => {
    it('abstains when there is nothing to choose from', () => {
        expect(select([])).toEqual({ verdict: 'abstain', reason: objectManipulationErrorMessages.noCatalog })
    })

    it('abstains when nothing is legal and no refusal gives a reason', () => {
        expect(select([{ name: 'cup', confidence: 0.9, dryRun: { verdict: 'illegal', decidable: true } }]))
            .toEqual({ verdict: 'abstain', reason: objectManipulationErrorMessages.noMatch })
    })

    it('errors with the most confident refusal\'s reason when nothing is legal', () => {
        expect(select([
            { name: 'floor cup', confidence: 0.6, dryRun: { verdict: 'illegal', decidable: true, reason: 'The box has the cup.' } },
            { name: 'table cup', confidence: 0.9, dryRun: { verdict: 'illegal', decidable: true, reason: 'The table has no cup.' } },
        ])).toEqual({ verdict: 'error', reason: 'The table has no cup.' })
    })
})
