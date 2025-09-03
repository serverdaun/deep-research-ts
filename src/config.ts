// Config file for the project
import { config as dotenvConfig } from "dotenv";
import { tavily } from "@tavily/core";
import { initChatModel, ConfigurableModel } from "langchain/chat_models/universal";

// Load environment variables from .env file
dotenvConfig();

// Config class for the project
class Config {
  mainModel!: ConfigurableModel;
  summarizationModel!: ConfigurableModel;
  tavilyMaxResults: number;
  scopingModel!: ConfigurableModel;
  scopingModelTemperature: number;
  compressModel!: ConfigurableModel;
  compressModelMaxTokens: number;

  constructor() {
    this.tavilyMaxResults = parseInt(process.env.TAVILY_MAX_RESULTS || "3");
    this.scopingModelTemperature = parseFloat(
      process.env.SCOPING_MODEL_TEMPERATURE || "0.0",
    );
    this.compressModelMaxTokens = parseInt(
      process.env.COMPRESS_MODEL_MAX_TOKENS || "32000",
    );
  }

  async initialize() {
    this.mainModel = await initChatModel(
      process.env.MAIN_MODEL || "openai:gpt-4.1"
    );
    this.summarizationModel = await initChatModel(
      process.env.SUMMARIZATION_MODEL || "openai:gpt-4.1-mini"
    );
    this.scopingModel = await initChatModel(
      process.env.SCOPING_MODEL || "openai:gpt-4.1", 
      {
        temperature: this.scopingModelTemperature,
      }
    );
    this.compressModel = await initChatModel(
      process.env.COMPRESS_MODEL || "openai:gpt-4.1",
      {
        maxTokens: this.compressModelMaxTokens
      }
    );
  }
}

// Initialize the config
export const config = new Config();

// Initialize asynchronously
config.initialize().catch((error) => {
  console.error("Failed to initialize config:", error);
  process.exit(1);
});

// Initialize the Tavily client
export const tavilyClient = tavily({
  apiKey: process.env.TAVILY_API_KEY || ""
});
