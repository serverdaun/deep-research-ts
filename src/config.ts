// Config file for the project
import { config as dotenvConfig } from "dotenv";

// Load environment variables from .env file
dotenvConfig();

class Config {
  mainModel: string;
  summarizationModel: string;
  tavilyMaxResults: number;
  scopingModel: string;
  scopingModelTemperature: number;

  constructor() {
    this.mainModel = process.env.MAIN_MODEL || "openai:gpt-4.1";
    this.summarizationModel =
      process.env.SUMMARIZATION_MODEL || "openai:gpt-4.1";
    this.tavilyMaxResults = parseInt(process.env.TAVILY_MAX_RESULTS || "3");
    this.scopingModel = process.env.SCOPING_MODEL || "openai:gpt-4.1";
    this.scopingModelTemperature = parseFloat(
      process.env.SCOPING_MODEL_TEMPERATURE || "0.0",
    );
  }
}

export const config = new Config();
