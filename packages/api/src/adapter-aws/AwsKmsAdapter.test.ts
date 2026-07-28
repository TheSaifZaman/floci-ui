import {describe, expect, test} from 'bun:test'
import {
    CreateKeyCommand,
    DescribeKeyCommand,
    type KMSClient,
    ListKeysCommand,
    ListResourceTagsCommand,
    ScheduleKeyDeletionCommand,
    TagResourceCommand,
    UntagResourceCommand,
} from '@aws-sdk/client-kms'
import {AwsKmsAdapter} from './AwsKmsAdapter'
import {ValidationError} from '../cloud-spi/errors'

type SendResult = Record<string, unknown>

/** Minimal KMSClient stub that records the commands it was sent. */
function stubKms(handler: (command: object) => SendResult | Promise<SendResult>) {
    const sent: object[] = []
    const client = {
        async send(command: object) {
            sent.push(command)
            return handler(command)
        },
    } as unknown as KMSClient
    return {client, sent}
}

const KEY_ID = '68543643-23b6-4037-a59b-4d43d5d308f1'
const KEY_ARN = `arn:aws:kms:us-east-1:000000000000:key/${KEY_ID}`

const keyMetadata = {
    AWSAccountId: '000000000000',
    KeyId: KEY_ID,
    Arn: KEY_ARN,
    CreationDate: new Date('2026-07-28T10:00:00.000Z'),
    Enabled: true,
    Description: 'payments signing key',
    KeyUsage: 'ENCRYPT_DECRYPT',
    KeyState: 'Enabled',
    Origin: 'AWS_KMS',
    KeyManager: 'CUSTOMER',
    KeySpec: 'SYMMETRIC_DEFAULT',
    EncryptionAlgorithms: ['SYMMETRIC_DEFAULT'],
}

/** Routes each command to the response the real runtime gives for it. */
function runtimeStub(overrides: Record<string, SendResult> = {}) {
    return stubKms((command) => {
        if (command instanceof ListKeysCommand) {
            return overrides.list ?? {Keys: [{KeyId: KEY_ID, KeyArn: KEY_ARN}]}
        }
        if (command instanceof DescribeKeyCommand) {
            return overrides.describe ?? {KeyMetadata: keyMetadata}
        }
        if (command instanceof ListResourceTagsCommand) {
            return overrides.tags ?? {Tags: []}
        }
        return {}
    })
}

describe('AwsKmsAdapter', () => {
    test('identifies itself as the AWS KMS adapter', () => {
        const adapter = new AwsKmsAdapter(runtimeStub().client)

        expect(adapter.cloud).toBe('aws')
        expect(adapter.service).toBe('kms')
        expect(adapter.schema().displayName).toBe('AWS KMS')
    })

    test('lists keys by fanning out DescribeKey over the thin ListKeys result', async () => {
        // ListKeys returns only id and ARN, so every displayed column depends on
        // the per-key DescribeKey call.
        const {client, sent} = runtimeStub()
        const [resource] = await new AwsKmsAdapter(client).list()

        expect(sent[0]).toBeInstanceOf(ListKeysCommand)
        expect(sent[1]).toBeInstanceOf(DescribeKeyCommand)
        expect(resource).toMatchObject({
            id: KEY_ID,
            name: KEY_ID,
            cloud: 'aws',
            service: 'kms',
            type: 'key',
            region: 'us-east-1',
            status: 'Enabled',
            createdAt: '2026-07-28T10:00:00.000Z',
        })
        expect(resource?.metadata).toMatchObject({
            arn: KEY_ARN,
            description: 'payments signing key',
            keyUsage: 'ENCRYPT_DECRYPT',
            keySpec: 'SYMMETRIC_DEFAULT',
            keyManager: 'CUSTOMER',
            origin: 'AWS_KMS',
            enabled: true,
        })
    })

    test('keeps keys that are pending deletion in the list', async () => {
        // ScheduleKeyDeletion is a soft delete and real AWS keeps listing the key,
        // so hiding it here would misreport the account.
        const {client} = runtimeStub({
            describe: {KeyMetadata: {...keyMetadata, KeyState: 'PendingDeletion', Enabled: false}},
        })
        const [resource] = await new AwsKmsAdapter(client).list()

        expect(resource?.status).toBe('PendingDeletion')
    })

    test('surfaces key tags under metadata', async () => {
        const {client} = runtimeStub({tags: {Tags: [{TagKey: 'env', TagValue: 'prod'}]}})
        const [resource] = await new AwsKmsAdapter(client).list()

        expect(resource?.metadata.tags).toEqual([{key: 'env', value: 'prod'}])
    })

    test('filters the list by key id or description', async () => {
        // The name is an opaque uuid, so a search that ignored the description
        // would be unusable.
        const adapter = new AwsKmsAdapter(runtimeStub().client)

        await expect(adapter.list({search: '68543643'})).resolves.toHaveLength(1)
        await expect(adapter.list({search: 'payments'})).resolves.toHaveLength(1)
        await expect(adapter.list({search: 'nope'})).resolves.toHaveLength(0)
    })

    test('returns null when a key does not exist', async () => {
        const {client} = stubKms(() => {
            throw Object.assign(new Error('NotFoundException'), {$metadata: {httpStatusCode: 404}})
        })
        await expect(new AwsKmsAdapter(client).get('missing')).resolves.toBeNull()
    })

    test('rethrows a non-404 failure from get', async () => {
        const {client} = stubKms(() => {
            throw Object.assign(new Error('AccessDenied'), {$metadata: {httpStatusCode: 403}})
        })
        await expect(new AwsKmsAdapter(client).get(KEY_ID)).rejects.toThrow('AccessDenied')
    })

    test('inspects a key through DescribeKey', async () => {
        const {client, sent} = runtimeStub()
        const resource = await new AwsKmsAdapter(client).get(KEY_ID)

        expect(sent[0]).toBeInstanceOf(DescribeKeyCommand)
        expect((sent[0] as DescribeKeyCommand).input.KeyId).toBe(KEY_ID)
        expect(resource?.id).toBe(KEY_ID)
    })

    test('creates a key with the requested description and usage', async () => {
        const {client, sent} = stubKms(() => ({KeyMetadata: keyMetadata}))
        const resource = await new AwsKmsAdapter(client).create({
            values: {description: 'payments signing key', keyUsage: 'ENCRYPT_DECRYPT'},
        })

        const command = sent[0] as CreateKeyCommand
        expect(command).toBeInstanceOf(CreateKeyCommand)
        expect(command.input.Description).toBe('payments signing key')
        expect(command.input.KeyUsage).toBe('ENCRYPT_DECRYPT')
        expect(resource.id).toBe(KEY_ID)
    })

    test('defaults key usage and spec when they are omitted', async () => {
        const {client, sent} = stubKms(() => ({KeyMetadata: keyMetadata}))
        await new AwsKmsAdapter(client).create({values: {}})

        const command = sent[0] as CreateKeyCommand
        expect(command.input.KeyUsage).toBe('ENCRYPT_DECRYPT')
        expect(command.input.KeySpec).toBe('SYMMETRIC_DEFAULT')
    })

    test('rejects a key usage the schema does not offer', async () => {
        const adapter = new AwsKmsAdapter(stubKms(() => ({})).client)

        await expect(adapter.create({values: {keyUsage: 'MINE_BITCOIN'}})).rejects.toThrow(ValidationError)
    })

    test('rejects a description longer than the KMS limit', async () => {
        const adapter = new AwsKmsAdapter(stubKms(() => ({})).client)

        await expect(adapter.create({values: {description: 'x'.repeat(8193)}})).rejects.toThrow(ValidationError)
    })

    test('deletes a key by scheduling deletion with the shortest window', async () => {
        const {client, sent} = stubKms(() => ({KeyId: KEY_ARN, DeletionDate: new Date()}))
        await new AwsKmsAdapter(client).delete(KEY_ID)

        const command = sent[0] as ScheduleKeyDeletionCommand
        expect(command).toBeInstanceOf(ScheduleKeyDeletionCommand)
        expect(command.input.KeyId).toBe(KEY_ID)
        expect(command.input.PendingWindowInDays).toBe(7)
    })

    test('adds and removes tags in one update', async () => {
        const {client, sent} = stubKms(() => ({}))
        await new AwsKmsAdapter(client).updateTags(KEY_ID, {env: 'prod', stale: null})

        const tagged = sent.find((c) => c instanceof TagResourceCommand) as TagResourceCommand
        const untagged = sent.find((c) => c instanceof UntagResourceCommand) as UntagResourceCommand

        expect(tagged.input.Tags).toEqual([{TagKey: 'env', TagValue: 'prod'}])
        expect(untagged.input.TagKeys).toEqual(['stale'])
    })

    test('skips the tag calls it has nothing to send', async () => {
        const {client, sent} = stubKms(() => ({}))
        await new AwsKmsAdapter(client).updateTags(KEY_ID, {env: 'prod'})

        expect(sent.some((c) => c instanceof UntagResourceCommand)).toBe(false)
    })
})
