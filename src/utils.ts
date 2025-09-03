/**
 * Research Utilities and Tools.
 *
 * This module porives search content processint utilities for the research agent,
 * including web search capabilities and content summarization tools.
 */

import { config, tavilyClient } from "./config";
import { createSummarizeWebpagePrompt } from "./shared/prompts";
import { Summary } from "./shared/types";
import { HumanMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod/v3";

// ===== UTILITY FUNCTIONS =====

/**
 * Get current date in a human-readable format
 * @returns Formatted date string (e.g. "Mon, Aug 23, 2025")
 */
export function getToday(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ===== SEARCH FUNCTIONS =====

/**
 * Perform search suing Tavily API for multiple queries
 * @param searchQueries - List of search queries to execute
 * @param maxResults - Maximum number of results per query
 * @param topic - Topic filter for search queries
 * @param includeRawContent - Whether to include raw content in the results
 * @returns List of search result dictionaries
 */
export async function tavilySearchMultiple(
  searchQueries: string[],
  maxResults: number,
  topic: "general" | "news" | "finance" = "general",
  includeRawContent: boolean = false,
): Promise<Record<string, any>[]> {
  // Execute searches sequentially.
  // Note: you can use AsyncTavilyClient to run searches in parallel.
  let searchDocs = [];
  for (const query of searchQueries) {
    const result = await tavilyClient.search(query, {
      max_results: maxResults,
      topic: topic,
      include_raw_content: includeRawContent,
    });
    searchDocs.push(result);
  }

  return searchDocs;
}

/**
 * Summarize webpage content using the configured summarization model
 * @param webpageContent - Raw webpage content to summarize
 * @returns Formatted summary with key excerpts
 */
export async function summarizeWebpageContent(
  webpageContent: string,
): Promise<string> {
  try {
    // Set up structured output model for summarization
    const structuredModel =
      config.summarizationModel.withStructuredOutput(Summary);

    // Generate summary
    const summary = await structuredModel.invoke([
      new HumanMessage(createSummarizeWebpagePrompt(webpageContent)),
    ]);

    const formatted_summary = `<summary>\n${summary.summary}\n</summary>\n\n<key_excerpts>\n${summary.key_excerpts}\n</key_excerpts>\n`;

    return formatted_summary;
  } catch (error) {
    console.error("Error summarizing webpage content:", error);
    return webpageContent.length > 1000
      ? webpageContent.substring(0, 1000) + "..."
      : webpageContent;
  }
}

/**
 * Deduplicate seaerch results by URL to avoid processing duplicate content.
 * @param searchResults - List of search results
 * @returns Dictionary mapping URLs to unique results
 */
export async function deduplicateSearchResults(
  searchResults: Record<string, any>[],
): Promise<Record<string, any>> {
  let uniqueResults: Record<string, any> = {};

  for (const response of searchResults) {
    for (const result of response.results) {
      const url = result.url;
      if (!uniqueResults[url]) {
        uniqueResults[url] = result;
      }
    }
  }

  return uniqueResults;
}

/**
 * Process search results by summarizing content where available.
 * @param uniqueResults - Dictionary of unique search results
 * @returns Dictionary of processed results with summaries
 */
export async function processSearchResults(
  uniqueResults: Record<string, any>,
): Promise<Record<string, any>> {
  let summarizedResults: Record<string, any> = {};

  for (const [url, result] of Object.entries(uniqueResults)) {
    // Use existing content if no raw content for summarization
    let content: string;
    if (!result.raw_content) {
      content = result.content;
    } else {
      // Summarize raw content for better processing
      content = await summarizeWebpageContent(result.raw_content);
    }

    summarizedResults[url] = {
      title: result.title,
      content: content,
    };
  }

  return summarizedResults;
}

/**
 * Format search results into a well-structured string output.
 * @param summarizedResults - Dictionary of processed search results
 * @returns Formatted string of search resutls with clear source separation
 */
export async function formatSearchOutput(
  summarizedResults: Record<string, any>,
): Promise<string> {
  if (!summarizedResults || Object.keys(summarizedResults).length === 0) {
    return "No valid search results found. Please try different search queries or use a different search API.";
  }

  let formattedOutput = "Search Results:\n\n";

  for (const [i, [url, result]] of Object.entries(
    summarizedResults,
  ).entries()) {
    const sourceNumber = i + 1;
    formattedOutput += `\n\n--- SOURCE ${sourceNumber}: ${result.title} ---\n`;
    formattedOutput += `URL: ${url}\n\n`;
    formattedOutput += `SUMMARY:\n${result.content}\n\n`;
    formattedOutput += "-".repeat(80) + "\n";
  }

  return formattedOutput;
}

// ===== RESEARCH TOOLS =====

function createTavilySearchFields() {
  const searchFieldsSchema = z.object({
    query: z.string().describe("A single search query to execute."),
  });

  return {
    name: "tavily_search",
    description:
      "Fetch results from Tavily search API with content summarization.",
    schema: searchFieldsSchema,
  };
}

type SearchFields = z.infer<
  ReturnType<typeof createTavilySearchFields>["schema"]
>;

export const tavilySearch = tool(
  async (input: SearchFields): Promise<string> => {
    const { query } = input;

    const maxResults = config.tavilyMaxResults || 3;
    const topic = "general";

    // Execute search for a single query
    const searchResults = await tavilySearchMultiple(
      [query],
      maxResults,
      topic,
      true,
    );

    // Deduplicate results by URL to avoid processing duplicate content
    const uniqueResults = await deduplicateSearchResults(searchResults);

    // Process results with summarization
    const summarizedResults = await processSearchResults(uniqueResults);

    // Format output for consumption
    return await formatSearchOutput(summarizedResults);
  },
  createTavilySearchFields(),
);

function createThinkToolFields() {
  const thinkFieldsSchema = z.object({
    reflection: z
      .string()
      .describe(
        "Your detailed reflection on reserach progress, findings, gaps and next steps.",
      ),
  });

  return {
    name: "think_tool",
    description:
      "Use this tool after each search to analyze results and plant next steps sytematically." +
      "This creates a deliberate pause in the research workflow for quality decision-making." +
      "When to use: " +
      "- After receiving search results: What key information did I find?" +
      "- Before decideing next steps: Do i have neough to answer comprehensively?" +
      "- When assesing research gaps: What specific information am I still missing?" +
      "- Before concluding research: Cna I provide a complete answer now?" +
      " Reflection should address:" +
      "1. Analysis of current findigs - What concrete information have I gathered?" +
      "2. Gap assessment - What cruicial information is still missing?" +
      "3. Quality evaluation - Do I have sufficient evidence/examples for a good answer?" +
      "4. Strategic decidsion - Should i continue seraching or provide my answer?",
    schema: thinkFieldsSchema,
  };
}

type ThinkFields = z.infer<ReturnType<typeof createThinkToolFields>["schema"]>;

export const thinkTool = tool(async (input: ThinkFields): Promise<string> => {
  const { reflection } = input;

  return `Reflection recorded: ${reflection}`;
}, createThinkToolFields());
