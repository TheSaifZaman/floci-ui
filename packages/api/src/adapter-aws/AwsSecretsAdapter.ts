import {
    CreateSecretCommand,
    DeleteSecretCommand,
    DescribeSecretCommand,
    ListSecretsCommand,
    type SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager'
import {ValidationError} from '../cloud-spi/errors'
import {awsSecretsSchema} from '../cloud-spi/secretsSchema'
import {secretsManager as defaultSecretsManager} from '../aws'
import type {
    CloudResource,
    CloudServiceAdapter,
    CreateResourceInput,
    ResourceQuery,
    ServiceSchema,
} from '../cloud-spi/types'

/**
 * AWS Secrets Manager metadata as `secrets` resources.
 *
 * Deliberately never calls GetSecretValue. A value placed on `CloudResource`
 * would flow into the inspector, the client query cache and request telemetry;
 * reveal belongs in an explicit, uncached action instead. Until that exists the
 * dedicated Secrets Manager page remains the way to read a value.
 */

export class AwsSecretsAdapter implements CloudServiceAdapter {
    readonly cloud = 'aws' as const
    readonly service = 'secrets' as const

    constructor(private readonly client: SecretsManagerClient = defaultSecretsManager) {}

    schema(): ServiceSchema {
        return awsSecretsSchema()
    }

    async list(query: ResourceQuery = {}): Promise<CloudResource[]> {
        const resources: CloudResource[] = []
        let nextToken: string | undefined

        do {
            const res = await this.client.send(new ListSecretsCommand({NextToken: nextToken}))
            for (const secret of res.SecretList ?? []) resources.push(toResource(secret))
            nextToken = res.NextToken
        } while (nextToken)

        return filterBySearch(resources, query.search)
    }

    async get(id: string): Promise<CloudResource | null> {
        try {
            return toResource(await this.client.send(new DescribeSecretCommand({SecretId: id})))
        } catch (error) {
            if (isMissing(error)) return null
            throw error
        }
    }

    async create(input: CreateResourceInput): Promise<CloudResource> {
        const name = stringValue(input.values.secretName ?? input.values.name)
        const description = stringValue(input.values.description)
        // Accepted as input and forwarded once; it is never read back or placed
        // on the resource. AWS allows a secret with no value, but one is far more
        // useful with an initial version.
        const secretValue = stringValue(input.values.secretValue)
        if (!name) throw new ValidationError('secretName is required')

        const res = await this.client.send(
            new CreateSecretCommand({
                Name: name,
                ...(description ? {Description: description} : {}),
                ...(secretValue ? {SecretString: secretValue} : {}),
            }),
        )
        return toResource({Name: res.Name ?? name, ARN: res.ARN})
    }

    async delete(id: string): Promise<void> {
        // Immediate rather than the provider's 7-30 day recovery window, and a
        // deliberate divergence from the legacy /secretsmanager page, which
        // defaults to a 7 day window with force as an option.
        //
        // The explorer's delete is a generic verb with no place to ask "recover
        // for how long?", and a soft-deleted secret keeps appearing in the table,
        // which reads as a delete that silently failed. When the two surfaces are
        // unified under the row-action mechanism, the page's choice is the one to
        // keep — a recovery window with force as an explicit option.
        await this.client.send(new DeleteSecretCommand({SecretId: id, ForceDeleteWithoutRecovery: true}))
    }
}

interface SecretSummary {
    Name?: string
    ARN?: string
    Description?: string
    CreatedDate?: Date
    LastChangedDate?: Date
    LastAccessedDate?: Date
    RotationEnabled?: boolean
    Tags?: Array<{Key?: string; Value?: string}>
}

function toResource(secret: SecretSummary): CloudResource {
    const name = secret.Name ?? ''
    return {
        id: name,
        name,
        cloud: 'aws',
        service: 'secrets',
        type: 'secret',
        region: null,
        createdAt: secret.CreatedDate?.toISOString() ?? null,
        metadata: {
            provider: 'aws',
            secretsService: 'secretsmanager',
            arn: secret.ARN,
            description: secret.Description,
            lastChangedDate: secret.LastChangedDate?.toISOString(),
            lastAccessedDate: secret.LastAccessedDate?.toISOString(),
            rotationEnabled: secret.RotationEnabled,
            tags: secret.Tags,
            // No secret value here, by design — see the module comment.
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

function isMissing(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false
    return (error as {name?: string}).name === 'ResourceNotFoundException'
}
