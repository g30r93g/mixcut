export type ConfigProps = {
  stage: string;
  supabaseUrlParameterName: string;
  supabaseServiceRoleKeySecretName: string;
};

const defaultStage =
  process.env.STAGE || process.env.NODE_ENV || process.env.ENV || "prod";

export const getConfig = (stage = defaultStage): ConfigProps => {
  const prefix = `/mixcut/${stage}`;

  return {
    stage,
    supabaseUrlParameterName: `${prefix}/SUPABASE_URL`,
    supabaseServiceRoleKeySecretName: `mixcut/${stage}/supabase-service-role-key`
  };
};
