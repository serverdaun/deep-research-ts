// Config file for the project
import { config as dotenvConfig } from "dotenv";
import { tavily } from "@tavily/core";

// Load environment variables from .env file
dotenvConfig();

// Initialize the Tavily client
export const tavilyClient = tavily({
  apiKey: process.env.TAVILY_API_KEY || "",
});

export const modelSecrets = {
  gpt41: {
    apiKey: process.env.AZURE_OPENAI_API_KEY!,
    apiDeploymentName: process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME_4_1!,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION_4_1!,
    apiInstanceName: process.env.AZURE_OPENAI_API_INSTANCE_NAME!,
  },
  gpt41Mini: {
    apiKey: process.env.AZURE_OPENAI_API_KEY!,
    apiDeploymentName: process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME_4_1_MINI!,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION_4_1_MINI!,
    apiInstanceName: process.env.AZURE_OPENAI_API_INSTANCE_NAME!,
  },
};
