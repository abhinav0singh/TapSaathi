import {
  GetParameterCommand,
  SSMClient,
} from "@aws-sdk/client-ssm";
import { AppError } from "./errors.js";
import {
  loadIdentityMapping,
  type DemoIdentityMapping,
} from "./identity-mapping.js";

type ParameterClient = Pick<SSMClient, "send">;

export async function loadRuntimeIdentityMapping(
  parameterName: string | undefined =
    process.env["DEMO_IDENTITY_MAPPING_PARAMETER"],
  client: ParameterClient = new SSMClient({})
): Promise<DemoIdentityMapping> {
  if (!parameterName || !parameterName.trim()) {
    throw new AppError(
      "IDENTITY_MAPPING_UNAVAILABLE",
      "Demo identity configuration is unavailable.",
      500
    );
  }

  const response = await client.send(
    new GetParameterCommand({
      Name: parameterName,
      WithDecryption: true,
    })
  );

  const value = response.Parameter?.Value;

  if (!value) {
    throw new AppError(
      "IDENTITY_MAPPING_UNAVAILABLE",
      "Demo identity configuration is unavailable.",
      500
    );
  }

  return loadIdentityMapping({
    DEMO_IDENTITY_MAPPING: value,
  });
}
