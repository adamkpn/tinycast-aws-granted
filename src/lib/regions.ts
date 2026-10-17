export const DEFAULT_REGION = "us-east-2";

// Launched regions from the AWS Regional Services table
// (https://api.regional-table.region-services.aws.a2z.com/index.json), plus the
// China partition, which Granted supports. eusc-de-east-1 is left out: Granted
// v0.39.0 has no console host for the European Sovereign Cloud partition.
export const REGIONS = [
  "af-south-1",
  "ap-east-1",
  "ap-east-2",
  "ap-northeast-1",
  "ap-northeast-2",
  "ap-northeast-3",
  "ap-south-1",
  "ap-south-2",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-southeast-3",
  "ap-southeast-4",
  "ap-southeast-5",
  "ap-southeast-6",
  "ap-southeast-7",
  "ca-central-1",
  "ca-west-1",
  "cn-north-1",
  "cn-northwest-1",
  "eu-central-1",
  "eu-central-2",
  "eu-north-1",
  "eu-south-1",
  "eu-south-2",
  "eu-west-1",
  "eu-west-2",
  "eu-west-3",
  "il-central-1",
  "me-central-1",
  "me-south-1",
  "mx-central-1",
  "sa-east-1",
  "us-east-1",
  "us-east-2",
  "us-gov-east-1",
  "us-gov-west-1",
  "us-west-1",
  "us-west-2",
];

const REGION_PATTERN = /^[a-z]{2}(-gov|-iso[a-z]?)?-[a-z]+-\d+$/;

export function isValidRegion(region: string): boolean {
  return REGION_PATTERN.test(region);
}

// All regions with the default first.
export function regionsWithDefault(defaultRegion: string): string[] {
  return [defaultRegion, ...REGIONS.filter((r) => r !== defaultRegion)];
}
