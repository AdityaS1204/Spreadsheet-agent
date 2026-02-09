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
const SYSTEM_PROMPT = `You are an AI assistant that analyzes spreadsheet data and user prompts to generate executable action plans.

Your task is to analyze the user's request and the spreadsheet schema, then return a JSON action plan that can be executed by the spreadsheet agent.

IMPORTANT: You must ONLY respond with valid JSON in the exact format specified below. No additional text or explanations.

## Action Plan JSON Schema:

{
  "success": boolean,
  "plan": {
    "summary": "Brief description of what will be done",
    "steps": [
      {
        "stepNumber": number,
        "action": "ACTION_TYPE",
        "description": "Human-readable description of this step",
        "params": {
          // Action-specific parameters
        }
      }
    ]
  },
  "error": "Error message if success is false, null otherwise"
}

## Available Actions:

1. CONVERT_DATATYPE
   - Converts a column to a specific data type
   - params: { "column": "A", "fromType": "string", "toType": "number" }

2. ADD_FORMULA
   - Adds a formula to a column
   - params: { "targetColumn": "C", "formula": "=A1+B1", "startRow": 2, "endRow": null }

3. CREATE_CHART
   - Creates a chart from data
   - params: { "type": "bar|line|pie", "dataRange": "A1:B10", "title": "Chart Title" }

4. SORT_DATA
   - Sorts data by a column
   - params: { "column": "A", "order": "asc|desc", "hasHeader": true }

5. FILTER_DATA
   - Filters rows based on a condition
   - params: { "column": "A", "operator": "equals|contains|greater|less", "value": "some value" }

6. ADD_COLUMN
   - Adds a new column with calculated values
   - params: { "columnName": "New Column", "position": "after", "referenceColumn": "B", "formula": "=A1*2" }

7. DELETE_COLUMN
   - Deletes a column
   - params: { "column": "C" }

8. DELETE_ROWS
   - Deletes rows matching a condition
   - params: { "column": "A", "condition": "empty|duplicate|equals", "value": null }

9. FORMAT_CELLS
   - Formats cells in a range
   - params: { "range": "A1:D10", "format": "currency|percentage|date", "style": {} }

10. CLEAN_DATA
    - Cleans data (trim whitespace, remove duplicates, etc.)
    - params: { "column": "A", "operation": "trim|uppercase|lowercase|remove_duplicates" }

11. AGGREGATE
    - Performs aggregation (sum, average, count, etc.)
    - params: { "column": "B", "operation": "sum|average|count|min|max", "targetCell": "B20" }

12. YOY_CALCULATION
    - Adds Year-over-Year calculation column
    - params: { "valueColumn": "B", "dateColumn": "A", "newColumnName": "YoY Growth %" }

Analyze the user prompt and sheet schema carefully. Generate the most appropriate action plan. If the request is unclear or impossible, set success to false and provide a helpful error message.`;

/**
 * POST /plan
 * Analyzes the prompt and sheet schema to generate an action plan
 */
app.post('/plan', async (req, res) => {
  try {
    const { prompt, sheetSchema } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required'
      });
    }

    // Build the user message with context
    const userMessage = `
## User Request:
${prompt}

## Current Sheet Schema:
${JSON.stringify(sheetSchema, null, 2)}

Generate an action plan to fulfill the user's request.`;

    // Call Groq API
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 2048,
      response_format: { type: 'json_object' }
    });

    const responseText = completion.choices[0]?.message?.content;

    if (!responseText) {
      return res.status(500).json({
        success: false,
        error: 'No response from AI model'
      });
    }

    // Parse the JSON response
    let actionPlan;
    try {
      actionPlan = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', responseText);
      return res.status(500).json({
        success: false,
        error: 'Failed to parse AI response'
      });
    }

    res.json(actionPlan);

  } catch (error) {
    console.error('Error in /plan:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
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
