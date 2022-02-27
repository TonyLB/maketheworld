export const instantiateAsset = async ({
    assetId,
    instanceId,
    options = {}
} = {}) => {
    const { check = false, recursive = false, forceCache = false } = options

    // if (check) {
    //     const alreadyPresent = await checkEphemeraMetaData(assetId)
    //     if (alreadyPresent) {
    //         return
    //     }
    // }
    // const { fileName, importTree, instance } = await fetchAssetMetaData(assetId)
    // //
    // // Instanced stories are not directly cached, they are instantiated ... so
    // // this would be a miscall, and should be ignored.
    // //
    // if (instance) {
    //     return
    // }
    // if (recursive) {
    //     await Promise.all(Object.keys(importTree || {}).map((assetId) => (cacheAsset(assetId, { recursive: true, check: !forceCache }))))
    // }
    // const firstPassNormal = await parseWMLFile(fileName)
    // const secondPassNormal = await globalizeDBEntries(assetId, firstPassNormal)

}

export default instantiateAsset
