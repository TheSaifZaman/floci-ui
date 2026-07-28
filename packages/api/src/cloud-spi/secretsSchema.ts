import type {CapabilitySchema, FieldSchema, ResourceActionName, ServiceSchema, TableColumnSchema} from './types'

/**
 * Secret *metadata* only.
 *
 * No schema here exposes a secret value, and no adapter puts one in
 * `CloudResource.metadata`: that object reaches the inspector, the client-side
 * query cache and the request telemetry. Revealing a value is a deliberate,
 * separately advertised, uncached action — see the `revealValue` capability,
 * which stays `coming_soon` until the generic row-action mechanism exists.
 */

// The hyphen is escaped so the pattern also compiles under the `v` flag used for
// HTML pattern validation in the browser.
export const SECRET_NAME_PATTERN = '^[0-9A-Za-z\\-]{1,127}$'
export const SECRET_NAME_MESSAGE = 'Use a valid Key Vault secret name: 1-127 letters, numbers, or hyphens.'

const secretsFilters: FieldSchema[] = [
    {name: 'search', label: 'Search', type: 'text', required: false},
]

const awsSecretsColumns: TableColumnSchema[] = [
    {name: 'name', label: 'Name'},
    {name: 'createdAt', label: 'Created At', format: 'datetime'},
    {name: 'updatedAt', label: 'Last Changed', path: 'metadata.lastChangedDate', format: 'datetime'},
]

const gcpSecretsColumns: TableColumnSchema[] = [
    {name: 'name', label: 'Name'},
    {name: 'createdAt', label: 'Created At', format: 'datetime'},
    {name: 'replication', label: 'Replication', path: 'metadata.replication'},
]

// The list endpoint returns base secret identifiers without a version, so a Version
// column would be blank for every row. Versions are surfaced on inspect instead.
const azureSecretsColumns: TableColumnSchema[] = [
    {name: 'name', label: 'Secret Name'},
    {name: 'status', label: 'Status'},
    {name: 'createdAt', label: 'Created At'},
]

function secretCapabilities(): CapabilitySchema<ResourceActionName>[] {
    return [
        {name: 'list', label: 'List secrets', enabled: true, status: 'available', runtimeRequired: true},
        {name: 'create', label: 'Create secret', enabled: true, status: 'available', runtimeRequired: true},
        {name: 'delete', label: 'Delete secret', enabled: true, status: 'available', runtimeRequired: true},
        {name: 'inspect', label: 'Inspect metadata', enabled: true, status: 'available', runtimeRequired: false},
    ]
}

export function awsSecretsSchema(): ServiceSchema {
    return {
        cloud: 'aws',
        service: 'secrets',
        displayName: 'AWS Secrets Manager',
        fields: [
            {name: 'secretName', label: 'Secret Name', type: 'text', required: true},
            {name: 'description', label: 'Description', type: 'text', required: false},
            {
                name: 'secretValue',
                label: 'Secret Value',
                type: 'text',
                required: false,
                // Write-only: accepted on create, never returned on a resource.
                description: 'Optional initial value. Stored by the runtime and never read back into the console.',
                span: true,
            },
        ],
        actions: ['list', 'create', 'inspect', 'delete'],
        filters: secretsFilters,
        columns: awsSecretsColumns,
        capabilities: {resourceActions: secretCapabilities()},
    }
}

export function gcpSecretsSchema(): ServiceSchema {
    return {
        cloud: 'gcp',
        service: 'secrets',
        displayName: 'Secret Manager',
        fields: [
            {
                name: 'secretName',
                label: 'Secret Name',
                type: 'text',
                required: true,
                description: 'Letters, numbers, hyphens, and underscores.',
            },
        ],
        actions: ['list', 'create', 'inspect', 'delete'],
        filters: secretsFilters,
        columns: gcpSecretsColumns,
        capabilities: {resourceActions: secretCapabilities()},
    }
}

export function azureSecretsSchema(): ServiceSchema {
    return {
        cloud: 'azure',
        service: 'secrets',
        displayName: 'Key Vault',
        fields: [
            {
                name: 'secretName',
                label: 'Secret Name',
                type: 'text',
                required: true,
                description: 'Unique Key Vault secret name.',
                validation: {
                    minLength: 1,
                    maxLength: 127,
                    pattern: SECRET_NAME_PATTERN,
                    message: SECRET_NAME_MESSAGE,
                },
            },
            {
                name: 'secretValue',
                label: 'Secret Value',
                type: 'password',
                required: true,
                description: 'Value stored in the secret.',
                span: true,
            },
            {
                name: 'contentType',
                label: 'Content Type',
                type: 'text',
                required: false,
                description: 'Optional content type, for example application/json.',
            },
        ],
        actions: ['list', 'create', 'delete', 'inspect'],
        capabilities: {
            resourceActions: [
                {name: 'list', label: 'List secrets', enabled: true, status: 'available', runtimeRequired: true},
                {name: 'create', label: 'Create secret', enabled: true, status: 'available', runtimeRequired: true},
                {name: 'delete', label: 'Delete secret', enabled: true, status: 'available', runtimeRequired: true},
                {name: 'inspect', label: 'Inspect metadata', enabled: true, status: 'available', runtimeRequired: true},
            ],
        },
        filters: secretsFilters,
        columns: azureSecretsColumns,
    }
}
