import { S3Client } from "@aws-sdk/client-s3";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { EKSClient } from "@aws-sdk/client-eks";
import { EC2Client } from "@aws-sdk/client-ec2";
import { RDSClient } from "@aws-sdk/client-rds";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
const endpoint = process.env.FLOCI_ENDPOINT;
const region = process.env.AWS_REGION || "us-east-1";
const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test",
};
const base = {
  region,
  credentials,
  ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
};

export const awsClients = {
  s3: new S3Client({ ...base, forcePathStyle: true }),
  lambda: new LambdaClient(base),
  eks: new EKSClient(base),
  ec2: new EC2Client(base),
  rds: new RDSClient(base),
  secretsManager: new SecretsManagerClient(base),
} as const;

export type AwsClientName = keyof typeof awsClients;

export const s3 = awsClients.s3;
export const lambda = awsClients.lambda;
export const eks = awsClients.eks;
export const ec2 = awsClients.ec2;
export const rds = awsClients.rds;
export const secretsManager = awsClients.secretsManager;
