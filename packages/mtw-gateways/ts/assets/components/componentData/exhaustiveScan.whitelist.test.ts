import * as fs from 'fs'
import * as path from 'path'

/**
 * Documents allowed importers of exhaustiveScan / exhaustiveScanCache (D5: no CI import guard).
 * Update this list when whitelist call sites migrate to the subpath.
 */
export const EXHAUSTIVE_SCAN_ALLOWED_IMPORTERS = [
    'lambda/assets/dataSource/components/verticals/syncImportVerticalPartition',
    'lambda/assets/dataSource/components/verticals/healComponentVertical',
    'lambda/assets/dataSource/components/verticals/exhaustivePartitionLoader',
    'lambda/diagnostics/componentVerticalMisalignmentSweep/index',
    'lambda/diagnostics/componentVerticalMisalignmentSweep/exhaustivePartitionLoader',
    'packages/mtw-gateways/ts/assets/components/verticals/consistency',
] as const

const REPO_ROOT = path.join(__dirname, '../../../../../..')

function sourcePathForImporter(importer: string): string {
    if (importer.startsWith('lambda/') || importer.startsWith('packages/')) {
        return path.join(REPO_ROOT, `${importer}.ts`)
    }
    return path.join(REPO_ROOT, importer)
}

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

    it('whitelist lambda modules import exhaustiveScan or exhaustiveScanCache subpath', () => {
        const lambdaImporters = EXHAUSTIVE_SCAN_ALLOWED_IMPORTERS.filter((p) => p.startsWith('lambda/'))
        for (const importer of lambdaImporters) {
            const filePath = sourcePathForImporter(importer)
            const source = fs.readFileSync(filePath, 'utf8')
            const importsSubpath =
                /componentData\/exhaustiveScanCache/.test(source) ||
                /componentData\/exhaustiveScan['"]/.test(source) ||
                /\.\/exhaustivePartitionLoader/.test(source) ||
                /\.\/syncImportVerticalPartition/.test(source)
            expect(importsSubpath).toBe(true)
        }
    })
})
