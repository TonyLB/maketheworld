// Import required AWS SDK clients and commands for Node.js
import { S3Client, ListObjectsCommand, DeleteObjectsCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import { readdir, stat, readFile } from 'node:fs/promises'

const params = { region: process.env.AWS_REGION }
const s3Client = new S3Client(params)

const contentTypeMapping = {
    ico: 'image/vnd.microsoft.icon',
    json: 'application/json',
    html: 'text/html',
    txt: 'text/plain',
    png: 'image/png',
    svg: 'image/svg+xml',
    js: 'text/javascript',
    css: 'text/css',
    map: 'plain/text'
}

const clearClientBucket = async (): Promise<void> => {
    const objectList = await s3Client.send(new ListObjectsCommand({
        Bucket: process.env.CLIENT_BUCKET
    }))
    if (objectList.Contents) {
        await s3Client.send(new DeleteObjectsCommand({
            Bucket: process.env.CLIENT_BUCKET,
            Delete: {
                Objects: objectList.Contents.map(({ Key }) => ({ Key }))
            }
        }))
    }
}

const initializeClientData = async (subDir: string = ''): Promise<void> => {
    const baseDir = `/opt${subDir}`
    const dirContents = await readdir(baseDir)
    await Promise.all(
        dirContents.map(async (item) => {
            if ((await stat(`${baseDir}/${item}`)).isDirectory()) {
                await initializeClientData(`${subDir}/${item}`)
            }
            else {
                if (subDir || !(item === 'config.json')) {
                    const fileExtension = item.split('.').slice(-1)[0]
                    const contentType = contentTypeMapping[fileExtension]
                    const data = await readFile(`${baseDir}/${item}`)
                    await s3Client.send(new PutObjectCommand({
                        Bucket: process.env.CLIENT_BUCKET,
                        Key: subDir ? `${subDir.slice(1)}/${item}` : item,
                        Body: data,
                        ContentType: contentType || 'application/octet-stream'
                    }))
                }
            }
        })
    )
}

export const handler = async (event, context) => {

    // Handle EventBridge messages
    if (event?.source === 'mtw.diagnostics') {
        if (event["detail-type"] === 'Initialize') {
            console.log(`Initializer called`)
            await clearClientBucket()
            await Promise.all([
                initializeClientData(),
                s3Client.send(new PutObjectCommand({
                    Bucket: process.env.CLIENT_BUCKET,
                    Key: 'config.json',
                    Body: JSON.stringify(Object.entries({
                        UserPoolClient: process.env.USER_POOL_CLIENT,
                        UserPoolId: process.env.USER_POOL_ID,
                        WebSocketURI: process.env.WEB_SOCKET_URI
                    }).map(([key, value]) => ({
                        OutputKey: key,
                        OutputValue: value
                    })), null, 4)
                }))
            ])
            return JSON.stringify(`Success`)
        }
    }

}
