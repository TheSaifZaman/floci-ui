import type {CloudProvider, FieldSchema, ServiceSchema, TableColumnSchema} from './types'

/**
 * A KMS key has no name — only an opaque uuid and an optional description — so
 * the description carries the identity in the table and in search.
 */
const kmsColumns: TableColumnSchema[] = [
    {name: 'name', label: 'Key ID', format: 'code'},
    {name: 'description', label: 'Description', path: 'metadata.description', emptyText: '—'},
    {name: 'status', label: 'State', format: 'badge'},
    {name: 'keyUsage', label: 'Usage', path: 'metadata.keyUsage'},
    {name: 'createdAt', label: 'Created', format: 'datetime'},
]

const kmsFilters: FieldSchema[] = [{name: 'search', label: 'Search', type: 'text', required: false}]

/** Offered on create. Kept in sync with the adapter's validation. */
export const KMS_KEY_USAGES = ['ENCRYPT_DECRYPT', 'SIGN_VERIFY', 'GENERATE_VERIFY_MAC'] as const
export const KMS_KEY_SPECS = [
    'SYMMETRIC_DEFAULT',
    'RSA_2048',
    'RSA_4096',
    'ECC_NIST_P256',
    'HMAC_256',
] as const

/** KMS caps a key description at 8192 characters. */
export const KMS_DESCRIPTION_MAX_LENGTH = 8192

export function awsKmsSchema(): ServiceSchema {
    return {
        cloud: 'aws',
        service: 'kms',
        displayName: 'AWS KMS',
        fields: [
            {
                name: 'description',
                label: 'Description',
                type: 'text',
                required: false,
                description: 'How this key is used. A key has no name, so this is how you will recognise it.',
                span: true,
                validation: {
                    maxLength: KMS_DESCRIPTION_MAX_LENGTH,
                    message: `Keep the description under ${KMS_DESCRIPTION_MAX_LENGTH} characters.`,
                },
            },
            {
                name: 'keyUsage',
                label: 'Key Usage',
                type: 'select',
                required: false,
                options: KMS_KEY_USAGES.map((value) => ({label: value, value})),
            },
            {
                name: 'keySpec',
                label: 'Key Spec',
                type: 'select',
                required: false,
                options: KMS_KEY_SPECS.map((value) => ({label: value, value})),
            },
        ],
        actions: ['list', 'create', 'delete', 'inspect'],
        capabilities: {
            resourceActions: [
                {name: 'list', label: 'List keys', enabled: true, status: 'available', runtimeRequired: true},
                {name: 'create', label: 'Create key', enabled: true, status: 'available', runtimeRequired: true},
                {
                    name: 'delete',
                    label: 'Schedule key deletion',
                    enabled: true,
                    status: 'available',
                    runtimeRequired: true,
                },
                {name: 'inspect', label: 'Inspect key', enabled: true, status: 'available', runtimeRequired: true},
                {name: 'updateTags', label: 'Edit tags', enabled: true, status: 'available', runtimeRequired: true},
            ],
        },
        filters: kmsFilters,
        columns: kmsColumns,
    }
}

export function kmsSchemaFor(cloud: CloudProvider): ServiceSchema | null {
    return cloud === 'aws' ? awsKmsSchema() : null
}
