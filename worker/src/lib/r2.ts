
export async function putR2(R2: R2Bucket, key: string, bytes: Uint8Array, opts?: R2PutOptions) {
  await R2.put(key, bytes, opts)
  return key
}
