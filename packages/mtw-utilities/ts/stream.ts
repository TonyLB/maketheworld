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
