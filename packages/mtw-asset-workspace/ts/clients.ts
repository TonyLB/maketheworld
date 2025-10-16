import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand, GetObjectTaggingCommand, PutObjectTaggingCommand } from "@aws-sdk/client-s3"
import { streamToString } from "./stream"

const params = { region: process.env.AWS_REGION }

const { S3_BUCKET = 'Test', UPLOAD_BUCKET = 'Test' } = process.env;

const internalS3Client = (params.region ? new S3Client(params) : { send: async () => { return { Body: undefined } } }) as S3Client

export const s3Client = {
    async check({ Key }: {
        Key: string
    }): Promise<boolean> {
        try {
            await internalS3Client.send(new HeadObjectCommand({
                Bucket: S3_BUCKET,
                Key
            }))
            return true
        }
        catch (err: any) {
            if (err && err.name === 'NotFound') {
                return false
            }
            throw err
        }
    },

    async get({ Key, upload }: {
        Key: string,
        upload?: boolean;
    }): Promise<string> {
        const { Body: contentStream } = await internalS3Client.send(new GetObjectCommand({
            Bucket: upload ? UPLOAD_BUCKET : S3_BUCKET,
            Key
        }))
        const contents = await streamToString(contentStream)
        return contents
    },

    async put({ Key, Body }: {
        Key: string;
        Body: string;
    }): Promise<void> {
        await internalS3Client.send(new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key,
            Body
        }))
    },

    async putWithTags({ Key, Body, Tags, Metadata }: {
        Key: string;
        Body: string;
        Tags?: Record<string, string>;
        Metadata?: Record<string, string>;
    }): Promise<void> {
        await internalS3Client.send(new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key,
            Body,
            Tagging: Tags ? Object.entries(Tags).map(([k, v]) => `${k}=${v}`).join('&') : undefined,
            Metadata
        }))
    },

    async getTags({ Key }: {
        Key: string;
    }): Promise<Record<string, string>> {
        try {
            const response = await internalS3Client.send(new GetObjectTaggingCommand({
                Bucket: S3_BUCKET,
                Key
            }))
            
            return response.TagSet
                ? response.TagSet.reduce<Record<string, string>>((acc, tag) => {
                    if (tag.Key && tag.Value) {
                        return { ...acc, [tag.Key]: tag.Value }
                    }
                    return acc
                }, {})
                : {}
        } catch (err: any) {
            if (err && err.name === 'NoSuchKey') {
                return {}
            }
            throw err
        }
    },

    async updateTags({ Key, Tags }: {
        Key: string;
        Tags: Record<string, string>;
    }): Promise<void> {
        await internalS3Client.send(new PutObjectTaggingCommand({
            Bucket: S3_BUCKET,
            Key,
            Tagging: {
                TagSet: Object.entries(Tags).map(([Key, Value]) => ({ Key, Value }))
            }
        }))
    },

    async getMetadata({ Key }: {
        Key: string;
    }): Promise<Record<string, string> | undefined> {
        try {
            const response = await internalS3Client.send(new HeadObjectCommand({
                Bucket: S3_BUCKET,
                Key
            }))
            return response.Metadata
        } catch (err: any) {
            if (err && err.name === 'NotFound') {
                return undefined
            }
            throw err
        }
    },

    internalClient: internalS3Client
}