require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// System prompt for action plan generation
const SYSTEM_PROMPT = `You are an AI Sheet Agent. You analyze spreadsheet schemas and user prompts to either answer questions about the data or generate executable action plans to modify the data.

## Your Response Format:
You must ALWAYS respond with a JSON object in this exact format:
{
  "success": boolean,
  "answer": "A clear, conversational response to the user. If they asked a question (e.g., 'how many rows?'), put the answer here.",
  "plan": {
    "summary": "Briefly describe the modifications being made, or null if no modifications.",
    "steps": [
       // Only include steps if you are MODifying the spreadsheet
    ]
  },
  "error": "Error message if success is false, null otherwise"
}

## Guidelines:
1. IF THE USER ASKS A QUESTION (e.g., "How many rows?", "What are the headers?", "Who has the highest sales?"):
   - Read the provided 'sheetSchema'.
   - Provide the answer in the "answer" field.
   - Set "plan.steps" to an empty array [].

2. IF THE USER REQUESTS A TASK/MODIFICATION (e.g., "Sort by price", "Calculate total cost"):
   - Provide a confirmation in the "answer" field.
   - Detail the execution in the "plan" object.

## IMPORTANT: Action Step Format
Every step in the "steps" array MUST look like this:
{
  "stepNumber": 1,
  "action": "ACTION_NAME",
  "description": "Description of what this step does",
  "params": {
     // Parameters for the specific action
  }
}

## ONE-SHOT EXAMPLE:
User: "Calculate total cost (Price * Qty) in a new column"
Response:
{
  "success": true,
  "answer": "I'm adding a new 'Total Cost' column calculating Price * Quantity.",
  "plan": {
    "summary": "Adding Total Cost column",
    "steps": [
      {
        "stepNumber": 1,
        "action": "ADD_COLUMN",
        "description": "Add new column with formula",
        "params": {
          "columnName": "Total Cost",
          "formula": "=[Price]*[Qty]"
        }
      }
    ]
  },
  "error": null
}

3. Available Actions (ONLY for plan.steps):
   - CONVERT_DATATYPE: { "column": "A", "toType": "number|text|date" }
   - ADD_FORMULA: { "targetColumn": "C", "formula": "=A1+B1", "startRow": 2 }
   - CREATE_CHART: { "chartType": "bar|column|line|pie|scatter", "range": "A1:C20", "title": "Sales Report", "xAxisColumn": "A", "seriesColumns": ["B", "C"] }
   - SORT_DATA: { "column": "A", "order": "asc|desc" }
   - FILTER_DATA: { "column": "A", "operator": "equals|not_equals|contains|not_contains|greater|less|empty|not_empty", "value": "pending" }
     NOTE: FILTER_DATA REMOVES/DELETES rows that match the condition. 
     Example: operator "equals" with value "pending" will DELETE all rows where column A equals "pending"
   - ADD_COLUMN: { "columnName": "New", "referenceColumn": "A", "formula": "=A1*2" }
   - DELETE_COLUMN: { "column": "C" }
   - DELETE_ROWS: { "column": "A", "condition": "empty|duplicate|equals", "value": null }
   - FORMAT_CELLS: { "range": "A1:D10", "format": "currency|percentage|date" }
   - CLEAN_DATA: { "column": "A", "operation": "trim|uppercase|lowercase" }
   - AGGREGATE: { "column": "B", "operation": "sum|avg|count", "targetCell": "B20" }
   - YOY_CALCULATION: { "valueColumn": "B", "dateColumn": "A" }

Current Sheet Schema:
{{SCHEMA}}`;

/**
 * POST /plan
 * Analyzes the prompt and sheet schema to generate an action plan
 */
/**
 * POST /plan
 * Analyzes the prompt and sheet schema to generate an action plan
 */
app.post('/plan', async (req, res) => {
  const requestId = Date.now();
  console.log(`[${requestId}] POST /plan received`);
  
  try {
    const { prompt, sheetSchema } = req.body;
    
    // Log summary of the request
    console.log(`[${requestId}] Prompt: "${prompt}"`);
    console.log(`[${requestId}] Sheet Schema: ${sheetSchema ? `${sheetSchema.rowCount} rows, ${sheetSchema.colCount} cols` : 'MISSING'}`);

    if (!prompt) {
      console.warn(`[${requestId}] Error: Prompt is required`);
      return res.status(400).json({ success: false, error: 'Prompt is required' });
    }

    const userMessage = `User Request: "${prompt}"\n\nCurrent Schema: ${JSON.stringify(sheetSchema)}`;
    
    console.log(`[${requestId}] Sending request to Groq API (model: llama-3.3-70b-versatile)...`);
    const startTime = Date.now();

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT.replace('{{SCHEMA}}', JSON.stringify(sheetSchema)) },
        { role: 'user', content: userMessage }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });
    
    const duration = Date.now() - startTime;
    console.log(`[${requestId}] Groq API responded in ${duration}ms`);

    const responseText = completion.choices[0]?.message?.content;
    console.log(`[${requestId}] Raw AI response:`, responseText);

    if (!responseText) {
      console.error(`[${requestId}] Error: No content in Groq response`);
      return res.status(500).json({ success: false, error: 'No response from AI model' });
    }

    let result;
    try {
      result = JSON.parse(responseText);
      console.log(`[${requestId}] Successfully parsed JSON response`);
    } catch (parseError) {
      console.error(`[${requestId}] JSON Parse Error:`, parseError);
      console.error(`[${requestId}] Failed JSON content:`, responseText);
      return res.status(500).json({ success: false, error: 'Failed to parse AI response' });
    }

    console.log(`[${requestId}] Sending success response to client`);
    res.json(result);

  } catch (error) {
    console.error(`[${requestId}] Server Error:`, error);
    if (error.response) {
       console.error(`[${requestId}] Upstream API Error Data:`, error.response.data);
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


// Start server
app.listen(PORT, () => {
  console.log(`🚀 Excel Agent Backend running on http://localhost:${PORT}`);
});
