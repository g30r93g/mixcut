import * as dotenv from "dotenv";
import path = require("path");

// 1. Configure dotenv to read from our `.env` file
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

// 2. Define a TS Type to type the returned envs from our function below.
export type ConfigProps = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

// 3. Define a function to retrieve our env variables
export const getConfig = (): ConfigProps => ({
  SUPABASE_URL: process.env.SUPABASE_URL || "",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
});
