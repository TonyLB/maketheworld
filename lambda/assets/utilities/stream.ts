import { SelectObjectContentEventStream } from "@aws-sdk/client-s3"

export const streamToString = (stream: any): Promise<string> => (
    new Promise((resolve, reject) => {
      const chunks: any[] = []
      stream.on("data", (chunk) => chunks.push(chunk))
      stream.on("error", reject)
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
    })
)

export const streamToBuffer = (stream) => (
  new Promise((resolve, reject) => {
    const chunks: any[] = []
    stream.on("data", (chunk) => chunks.push(chunk))
    stream.on("error", reject)
    stream.on("end", () => resolve(Buffer.concat(chunks)))
  })
)

export const convertSelectDataToJson = async (generator: AsyncIterable<SelectObjectContentEventStream>) => {
    const chunks: Uint8Array[] = []
    for await (const value of generator) {
        if (value.Records) {
            if (value.Records.Payload) {
              chunks.push(value.Records.Payload)
            }
        }
    }
    let payload = Buffer.concat(chunks).toString('utf8')
    payload = payload.replace(/,$/, '')
    return JSON.parse(payload)
}
