import {ValidationError} from '../cloud-spi/errors'
import {gcpStorageSchema} from '../cloud-spi/storageSchema'
import {gcpEndpoint, gcpProject} from '../gcp'
import type {
    CloudResource,
    CloudServiceAdapter,
    CreateResourceInput,
    ResourceQuery,
    ServiceSchema,
    StorageObject,
    StorageObjectDownload,
    StorageObjectList,
} from '../cloud-spi/types'

interface GcpBucket {
    id?: string
    name?: string
    location?: string
    timeCreated?: string
    updated?: string
    storageClass?: string
}

interface GcpObject {
    name?: string
    bucket?: string
    size?: string
    updated?: string
    timeCreated?: string
    contentType?: string
    storageClass?: string
    etag?: string
}

export class GcpStorageAdapter implements CloudServiceAdapter {
    readonly cloud = 'gcp' as const
    readonly service = 'storage' as const

    constructor(
        private readonly endpoint: string = gcpEndpoint(),
        private readonly project: string = gcpProject(),
    ) {}

    schema(): ServiceSchema {
        return gcpStorageSchema()
    }

    async list(query: ResourceQuery = {}): Promise<CloudResource[]> {
        const body = await this.fetchJson<{items?: GcpBucket[]}>(`/storage/v1/b?project=${encodeURIComponent(this.project)}`)
        return filterBySearch((body.items ?? []).map(toResource), query.search)
    }

    async get(id: string): Promise<CloudResource | null> {
        const res = await this.fetch(`/storage/v1/b/${encodeURIComponent(id)}`, {method: 'GET'}, true)
        if (res.status === 404) return null
        if (!res) return null
        return toResource(await res.json() as GcpBucket)
    }

    async create(input: CreateResourceInput): Promise<CloudResource> {
        const bucketName = stringValue(input.values.bucketName)
        if (!bucketName) throw new ValidationError('bucketName is required')
        if (!isValidBucketName(bucketName)) {
            throw new ValidationError('Use a valid GCS bucket name: 3-63 lowercase characters, numbers, dots, underscores, or hyphens.')
        }
        const body = await this.fetchJson<GcpBucket>(`/storage/v1/b?project=${encodeURIComponent(this.project)}`, {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify({name: bucketName}),
        })
        return toResource(body)
    }

    async delete(id: string): Promise<void> {
        await this.fetch(`/storage/v1/b/${encodeURIComponent(id)}`, {method: 'DELETE'}, true)
    }

    async listObjects(resourceId: string, prefix = ''): Promise<StorageObjectList> {
        const qs = new URLSearchParams({delimiter: '/'})
        if (prefix) qs.set('prefix', prefix)
        const body = await this.fetchJson<{items?: GcpObject[]; prefixes?: string[]}>(`/storage/v1/b/${encodeURIComponent(resourceId)}/o?${qs}`)
        return {
            prefix,
            objects: [
                ...(body.prefixes ?? []).map((key): StorageObject => ({
                    key,
                    name: objectName(key, prefix),
                    type: 'folder',
                    size: null,
                    lastModified: null,
                    metadata: {
                        provider: 'gcp',
                        storageService: 'cloud-storage',
                        prefix: key,
                    },
                })),
                ...(body.items ?? [])
                    .filter((item) => item.name && item.name !== prefix)
                    .map((item): StorageObject => ({
                        key: item.name ?? '',
                        name: objectName(item.name ?? '', prefix),
                        type: 'object',
                        size: numberValue(item.size),
                        lastModified: item.updated ?? item.timeCreated ?? null,
                        metadata: {
                            provider: 'gcp',
                            storageService: 'cloud-storage',
                            contentType: item.contentType,
                            storageClass: item.storageClass,
                            etag: item.etag,
                        },
                    })),
            ],
        }
    }

    async putObject(resourceId: string, key: string, body: Uint8Array, contentType: string): Promise<void> {
        const path = `/upload/storage/v1/b/${encodeURIComponent(resourceId)}/o?uploadType=media&name=${encodeURIComponent(key)}`
        await this.fetch(path, {
            method: 'POST',
            headers: {'content-type': contentType},
            body: copyBytes(body),
        })
    }

    async getObject(resourceId: string, key: string): Promise<StorageObjectDownload> {
        const res = await this.fetch(`/storage/v1/b/${encodeURIComponent(resourceId)}/o/${encodeURIComponent(key)}?alt=media`, {method: 'GET'})
        return {
            body: await res.arrayBuffer(),
            contentType: res.headers.get('content-type') ?? 'application/octet-stream',
            contentLength: numberValue(res.headers.get('content-length')),
        }
    }

    async deleteObject(resourceId: string, key: string): Promise<void> {
        await this.fetch(`/storage/v1/b/${encodeURIComponent(resourceId)}/o/${encodeURIComponent(key)}`, {method: 'DELETE'}, true)
    }

    async copyObject(srcResourceId: string, srcKey: string, destKey: string, destResourceId?: string): Promise<void> {
        const destBucket = destResourceId ?? srcResourceId
        await this.fetch(
            `/storage/v1/b/${encodeURIComponent(srcResourceId)}/o/${encodeURIComponent(srcKey)}/copyTo/b/${encodeURIComponent(destBucket)}/o/${encodeURIComponent(destKey)}`,
            {method: 'POST'},
        )
    }

    private async fetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
        const res = await this.fetch(path, init)
        return res.json() as Promise<T>
    }

    private async fetch(path: string, init: RequestInit, emptyOnNotFound = false): Promise<Response> {
        let res: Response
        try {
            res = await globalThis.fetch(`${this.endpoint}${path}`, init)
        } catch (error) {
            throw new Error(`Cannot reach Floci-GCP at ${this.endpoint}: ${errorMessage(error)}`)
        }
        if (emptyOnNotFound && res.status === 404) return res
        if (!res.ok && !(emptyOnNotFound && res.status === 404)) {
            throw new Error(`GCP Storage request failed: HTTP ${res.status}`)
        }
        return res
    }
}

function toResource(bucket: GcpBucket): CloudResource {
    const name = bucket.name ?? bucket.id ?? ''
    return {
        id: name,
        name,
        cloud: 'gcp',
        service: 'storage',
        type: 'bucket',
        region: bucket.location ?? null,
        createdAt: bucket.timeCreated ?? null,
        metadata: {
            provider: 'gcp',
            storageService: 'cloud-storage',
            storageClass: bucket.storageClass,
            updated: bucket.updated,
        },
    }
}

function stringValue(value: unknown): string {
    return typeof value === 'string' ? value.trim() : ''
}

function filterBySearch(resources: CloudResource[], search?: string): CloudResource[] {
    const normalized = search?.trim().toLowerCase()
    if (!normalized) return resources
    return resources.filter((resource) => resource.name.toLowerCase().includes(normalized))
}

function objectName(key: string, prefix: string): string {
    const relative = key.startsWith(prefix) ? key.slice(prefix.length) : key
    return relative.replace(/\/$/, '') || key
}

function numberValue(value: string | null | undefined): number | null {
    if (!value) return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
}

function copyBytes(bytes: Uint8Array): ArrayBuffer {
    const copy = new Uint8Array(bytes.byteLength)
    copy.set(bytes)
    return copy.buffer
}

function isValidBucketName(value: string): boolean {
    return /^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$/.test(value)
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}
