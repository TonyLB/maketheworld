import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

export const addPrimitivesAddress = async (): Promise<void> => {
    // Add the missing address entry for the primitives asset
    await assetDB.putItem({
        AssetId: 'ASSET#primitives',
        DataCategory: 'Meta::Asset',
        address: {
            zone: 'Canon',
            fileName: 'primitives',
            subFolder: 'Assets'
        },
        zone: 'Canon'
    })
    
    console.log('Added primitives address entry to asset table')
}

// Run if called directly
if (require.main === module) {
    addPrimitivesAddress()
        .then(() => {
            console.log('Successfully added primitives address')
            process.exit(0)
        })
        .catch((error) => {
            console.error('Error adding primitives address:', error)
            process.exit(1)
        })
} 