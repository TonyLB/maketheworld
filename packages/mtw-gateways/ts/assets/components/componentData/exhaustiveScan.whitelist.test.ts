import * as fs from 'fs'
import * as path from 'path'

/**
 * Documents allowed importers of exhaustiveScan / exhaustiveScanCache (D5: no CI import guard).
 * Update this list when whitelist call sites migrate to the subpath.
 */
export const EXHAUSTIVE_SCAN_ALLOWED_IMPORTERS = [
    'lambda/assets/dataSource/components/verticals/syncImportVerticalPartition',
    'lambda/assets/dataSource/components/verticals/healComponentVertical',
    'lambda/diagnostics/componentVerticalMisalignmentSweep',
    'packages/mtw-gateways/ts/assets/components/verticals/consistency',
] as const

describe('exhaustiveScan whitelist documentation', () => {
    it('lists maintenance/diagnostics allowed importers', () => {
        expect(EXHAUSTIVE_SCAN_ALLOWED_IMPORTERS.length).toBeGreaterThanOrEqual(4)
        expect(EXHAUSTIVE_SCAN_ALLOWED_IMPORTERS).toContain(
            'lambda/assets/dataSource/components/verticals/syncImportVerticalPartition'
        )
    })

    it('componentData barrel does not export exhaustiveScan', () => {
        const indexPath = path.join(__dirname, 'index.ts')
        const source = fs.readFileSync(indexPath, 'utf8')
        expect(source).not.toMatch(/exhaustiveScan/)
    })
})
