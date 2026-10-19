/**
 * Payoff, diagnostics leg (containmentDriftCoverage Slice 4). For each shared scenario
 * (`@tonylb/mtw-gateways/.../containmentDriftScenarios`), the **real** sweeps run over the drifted rows
 * with their **default** `emitFinding`, so each finding goes through the real
 * `DiagnosticsEventSerializer` and out as a `PutEventsCommand`; only the EventBridge client is
 * mocked. The captured wire event is read back the way the consuming lambda reads it. Then the same
 * sweeps run over the scenario's `healed` rows, which the ephemera leg
 * (`containmentDriftPayoff.integration.test.ts`) proves the real heals produce, and must read silent.
 * The real EventBridge hop stays a manual `aws events put-events` check.
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals'

const sent: { Source: string; DetailType: string; Detail: string }[] = []

jest.mock('@aws-sdk/client-eventbridge', () => ({
    EventBridgeClient: class {
        async send(command: { input: { Entries: { Source: string; DetailType: string; Detail: string }[] } }) {
            sent.push(...command.input.Entries)
        }
    },
    PutEventsCommand: class {
        constructor(public input: unknown) {}
    },
}))

import { DiagnosticsEventSerializer } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'
import { createNodeDataSourceEnvironment } from '@tonylb/mtw-lambda-patterns/ts/dataSource/nodeEnvironment'
import { fromEventBridgeFormat } from '@tonylb/mtw-lambda-patterns/ts/dataSource/formatTransform'
import {
    containmentDriftScenarios,
    type ContainmentDriftScenario,
    type ScenarioRow,
} from '@tonylb/mtw-gateways/ts/ephemera/positions/containmentDriftScenarios'

import { fixedContainmentDriftSweep } from './fixedContainmentDriftSweep'
import { authoredChildrenOf } from './fixedContainmentDriftSweep/authoredNestings'
import { presenceCoverDriftSweep } from './presenceCoverDriftSweep'

const FIXED_FINDING = 'Fixed Containment Drift Finding'
const COVER_FINDING = 'Presence Cover Drift Finding'

/** The authored list as the sweep's own reader derives it from per-asset diffs (so `ref < 0` is filtered by the real code). */
const listAuthoredChildren = (scenario: ContainmentDriftScenario) => (parentId: string) => authoredChildrenOf(parentId, {
    cachedAssetsOf: async (id) => scenario.authored[id] ? ['ASSET#test'] : [],
    nodesAcrossAssets: async (id) => [scenario.authored[id] ?? []],
})

const fixedRows = (rows: ScenarioRow[]) => rows.filter(({ DataCategory }) => ['Meta::Room', 'Meta::Feature', 'Meta::Area'].includes(DataCategory))

/** The findings a sweep emitted, read back from the wire the way the consuming lambda reads them. */
const emittedFindings = async (detailType: string): Promise<string[]> => {
    const serializer = new DiagnosticsEventSerializer(createNodeDataSourceEnvironment())
    const found: string[] = []
    for (const entry of sent.filter((candidate) => candidate.DetailType === detailType)) {
        const { header, update } = fromEventBridgeFormat({ Source: entry.Source, DetailType: entry.DetailType, Detail: JSON.parse(entry.Detail) })
        const content = await serializer.deserialize({ header: header as any, content: update as any })
        expect(content).toMatchObject({ type: detailType })
        found.push((content as { ephemeraId: string }).ephemeraId)
    }
    return found.sort()
}

const runSweeps = async (scenario: ContainmentDriftScenario, rows: ScenarioRow[]) => {
    sent.length = 0
    const fixed = await fixedContainmentDriftSweep({}, {
        listCandidateRows: async () => fixedRows(rows),
        listAuthoredChildren: listAuthoredChildren(scenario),
    })
    const cover = await presenceCoverDriftSweep({}, { listCandidateRows: async () => rows })
    return { fixed, cover, wire: { fixed: await emittedFindings(FIXED_FINDING), cover: await emittedFindings(COVER_FINDING) } }
}

const summarizeUnrepairable = (entries: { ephemeraId: string; noBase: boolean; findings: { kind: string }[] }[]) => (
    entries.map(({ ephemeraId, noBase, findings }) => ({ ephemeraId, noBase, kinds: findings.map(({ kind }) => kind) }))
)

describe('containment drift payoff: diagnostics leg', () => {
    beforeEach(() => {
        process.env.EVENT_BUS_NAME = 'test-bus'
    })

    it.each(containmentDriftScenarios.map((scenario) => [scenario.name, scenario] as const))('%s', async (_name, scenario) => {
        const before = await runSweeps(scenario, scenario.drifted)

        // The drifted rows produce exactly the expected findings, on the wire and in the result.
        expect(before.fixed.ephemeraIds).toEqual([...scenario.expected.fixed].sort())
        expect(before.cover.ephemeraIds).toEqual([...scenario.expected.cover].sort())
        expect(before.wire).toEqual({ fixed: [...scenario.expected.fixed].sort(), cover: [...scenario.expected.cover].sort() })
        expect(summarizeUnrepairable(before.cover.unrepairable)).toEqual(scenario.expected.unrepairable)

        // The healed rows read silent (report-only entries aside, which no heal removes).
        const after = await runSweeps(scenario, scenario.healed)
        expect(after.fixed).toEqual({ emittedCount: 0, ephemeraIds: [] })
        expect(after.cover.emittedCount).toBe(0)
        expect(after.wire).toEqual({ fixed: [], cover: [] })
        expect(summarizeUnrepairable(after.cover.unrepairable)).toEqual(scenario.expectedHealed?.unrepairable ?? [])
    })

    it('covers every non-negative scenario with a nonempty drift (a vacuous fixture would pass the second sweep trivially)', () => {
        for (const scenario of containmentDriftScenarios.filter(({ redeliver }) => !redeliver)) {
            const { fixed, cover, unrepairable } = scenario.expected
            expect(fixed.length + cover.length + unrepairable.length).toBeGreaterThan(0)
        }
    })
})
