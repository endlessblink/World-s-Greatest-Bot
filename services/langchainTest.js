require('dotenv').config();
const { ChatPerplexity } = require("@langchain/community/chat_models/perplexity");
const { HumanMessage, SystemMessage } = require("@langchain/core/messages");

async function runLangchainTest() {
  if (!process.env.PERPLEXITY_API_KEY) {
    console.error("PERPLEXITY_API_KEY is not set in your .env file.");
    return;
  }

  const model = new ChatPerplexity({
    apiKey: process.env.PERPLEXITY_API_KEY,
    model: "llama-3.1-sonar-small-128k-online",
    temperature: 0.7,
  });

  try {
    const messages = [
      new SystemMessage(process.env.MASTER_PROMPT),
      new HumanMessage("Generate content about remote work productivity tips"),
    ];

    console.log("Sending request to Perplexity via LangChain...");
    const response = await model.invoke(messages);
    console.log("LangChain Test Response:", response.content);
  } catch (error) {
    console.error("Error during LangChain test:", error);
  }
}

runLangchainTest();