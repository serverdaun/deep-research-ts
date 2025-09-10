import { AzureChatOpenAI } from "@langchain/openai";
import { modelSecrets } from "../config";

type ModelFamily = keyof typeof modelSecrets; // e.g., 'gpt41' | 'gpt41Mini'

export type ChatModelOptions = {
  family?: ModelFamily;
  model?: string; // e.g., 'gpt-4.1'
  temperature?: number;
  maxTokens?: number;
};

/**
 * Create a configured AzureChatOpenAI instance based on configured model family.
 * Optionally bind tools via the caller using .bindTools().
 */
export function createChatModel(opts: ChatModelOptions = {}) {
  const family: ModelFamily = opts.family ?? "gpt41";
  const config = modelSecrets[family];

  if (!config) {
    throw new Error(`Unknown model family: ${family}`);
  }

  const base: any = {
    model: opts.model ?? "gpt-4.1",
    azureOpenAIApiKey: config.apiKey,
    azureOpenAIApiDeploymentName: config.apiDeploymentName,
    azureOpenAIApiVersion: config.apiVersion,
    azureOpenAIApiInstanceName: config.apiInstanceName,
  };
  if (typeof opts.temperature === "number") base.temperature = opts.temperature;
  if (typeof opts.maxTokens === "number") base.maxTokens = opts.maxTokens;

  return new AzureChatOpenAI(base);
}
