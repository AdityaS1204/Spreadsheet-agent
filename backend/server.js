require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');
const { getSkillsForIntent, allSkills } = require('./skills/index');
const { builders, wrapFormula } = require('./builders');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const CLASSIFICATION_PROMPT = `Analyze the user prompt and classify the primary intent.

## Intent Guidelines:
- "formula": Use this for ANY request that requires a calculation, sum, average, count, comparison, or specific numerical result from the spreadsheet data. If the user asks "How much", "What is the total", "Compare X and Y", or "Give me the percentage", it is a FORMULA intent.
- "chart": Visualizing data with graphs/charts.
- "clean_data": Filtering rows, removing duplicates, trim, or data formatting.
- "organization": Sorting or styling large ranges.
- "insight": Qualitative questions about what the data represents, schema explanations, or general trends that DON'T require a specific calculation.

Return JSON only:
{
  "intent": "formula" | "chart" | "clean_data" | "organization" | "insight",
  "explicit_chart_type": "line" | "bar" | "column" | "pie" | "scatter" | null,
  "confidence": number
}`;

const PLANNING_PROMPT = `You are a high-level spreadsheet action planner for a premium analytical tool.
Return valid JSON only.
Select supported patterns from the provided skills JSON.

## CORE PRINCIPLES:
1. DATASET AGNOSTIC: Rely strictly on the provided "Schema" and "Headers" for column mapping. Your plan must be robust enough to work on 1,000s of rows based on the patterns identified in the sample data and schema.
2. ACCURACY: If the user asks for a count with a condition (e.g., "how many orders in X"), use "count_if" or "count_ifs". Do NOT use simple "count" if a filter is implied.
3. PROFESSIONALISM: Your "label" for each calculation must be clear and context-rich (e.g., "Total Orders for Festival Event" instead of just "Count").

## STRUCTURAL RULES:
1. Do NOT generate raw formulas.
2. Do NOT generate full chart configuration.
3. For ALL column parameters, you MUST use the COLUMN LETTER (e.g., "A", "B", "C") from the provided schema.
4. Only return a structured plan.

Current Skills:
{{SKILLS_JSON}}

If intent = formula or insight:
Return: { 
  "conversational_answer": string, 
  "calculations": [
    { "pattern": string, "parameters": {}, "label": string }
  ]
}
## NOTE: For "OR" conditions (e.g., "Category is Fashion OR Footwear"), generate MULTIPLE calculation items in the array. 

If intent = chart:
Return: { "conversational_answer": string, "chart_goal": string, "explicit_chart_type": string | null, "x_column": string, "y_columns": [] }

If intent = clean_data:
Return: { "conversational_answer": string, "operations": [ { "operation": "filter_data" | "trim_whitespace" | "convert_to_number", "column": string, "operator"?: string, "value"?: any, "description": string } ] }

If intent = organization:
Return: { "conversational_answer": string, "operations": [ { "operation": "sort_data" | "format_cells", "column"?: string, "order"?: string, "range"?: string, "format"?: string } ] }`;

/**
 * Resolution helper to map column names/letters to column letters
 */
function resolveColumn(identifier, headers) {
  if (!identifier || !headers) return identifier;
  const idStr = String(identifier).trim();
  // If it's already a single/double letter, return as is (A, B, AA, etc.)
  if (/^[A-Z]{1,2}$/i.test(idStr)) return idStr.toUpperCase();
  
  // Look up in headers by name
  const match = headers.find(h => h.name.toLowerCase() === idStr.toLowerCase());
  if (match) return match.column;

  // Fallback to original
  return idStr;
}

app.post('/plan', async (req, res) => {
  const requestId = Date.now();
  console.log(`[${requestId}] POST /plan received`);

  try {
    const { prompt, sheetSchema } = req.body;
    if (!prompt) return res.status(400).json({ success: false, error: 'Prompt is required' });

    // STEP 3: Intent Classification
    console.log(`[${requestId}] Classification Prompt Sent`);
    const classification = await groq.chat.completions.create({
      messages: [{ role: 'system', content: CLASSIFICATION_PROMPT }, { role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0,
      response_format: { type: 'json_object' }
    });

    const rawClassificationContent = classification.choices[0].message.content;
    const intentResult = JSON.parse(rawClassificationContent);
    console.log(`[${requestId}] LLM Classification RAW:`, rawClassificationContent);
    console.log(`[${requestId}] Parsed intent:`, intentResult);

    if (intentResult.confidence < 0.6) {
      return res.json({ success: false, answer: "I'm not sure what you want to do. Could you be more specific?", plan: { steps: [] } });
    }

    const { intent } = intentResult;

    // Handle 'insight' (simple Q&A) separately if needed, or route to planner
    if (intent === 'insight') {
      console.log(`[${requestId}] Insight Prompt Sent`);
      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: "You are an AI data analyst. Answer questions based on the provided schema." },
          { role: 'user', content: `Schema: ${JSON.stringify(sheetSchema)}\nQuestion: ${prompt}` }
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
      });
      const insightResponse = completion.choices[0].message.content;
      console.log(`[${requestId}] LLM Insight RAW:`, insightResponse);
      return res.json({ success: true, answer: insightResponse, plan: { steps: [] } });
    }

    // STEP 4: Planning with Structured Skills
    // Insight effectively uses formula skills to extract real data
    const effectiveIntent = (intent === 'insight' || intent === 'formula') ? 'formula' : intent;
    const skillSection = getSkillsForIntent(effectiveIntent);

    console.log(`[${requestId}] Planning Prompt Sent for intent: ${intent}`);
    const planCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: PLANNING_PROMPT.replace('{{SKILLS_JSON}}', JSON.stringify(skillSection)) },
        { role: 'user', content: `Prompt: ${prompt}\nSchema: ${JSON.stringify(sheetSchema)}` }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0,
      response_format: { type: 'json_object' }
    });

    const rawPlanContent = planCompletion.choices[0].message.content;
    const rawPlan = JSON.parse(rawPlanContent);
    console.log(`[${requestId}] LLM Plan RAW:`, rawPlanContent);
    console.log(`[${requestId}] Parsed plan:`, rawPlan);

    // STEP 5 & 6 & 7: Deterministic Building & Dispatching 
    const steps = [];
    let summary = "";

    try {
      if (intent === 'formula' || intent === 'insight') {
        const calcs = rawPlan.calculations || [];
        if (!Array.isArray(calcs) && rawPlan.pattern) {
          // Compatibility for single pattern if AI misses array
          calcs.push({ pattern: rawPlan.pattern, parameters: rawPlan.parameters });
        }

        calcs.forEach((calc, idx) => {
          const pattern = calc.pattern;
          const patternDef = allSkills.formula.patterns[pattern];

          if (!patternDef) {
            console.warn(`[${requestId}] Unsupported formula pattern: ${pattern}`);
            return;
          }

          // Validate required params
          const missingParams = patternDef.required_params.filter(p => calc.parameters[p] === undefined);
          if (missingParams.length > 0) {
            console.warn(`[${requestId}] Missing params for ${pattern}: ${missingParams.join(', ')}`);
            return;
          }

          const builderName = patternDef.builder;

          // AUTO-RESOLVE COLUMNS in parameters
          const resolvedParams = { ...calc.parameters };
          const headers = sheetSchema?.headers || [];

          // NORMALIZE CRITERIA: If AI sends an object like {"A": "Val"}, convert to array [{column: "A", value: "Val", operator: "equals"}]
          if (resolvedParams.criteria && !Array.isArray(resolvedParams.criteria) && typeof resolvedParams.criteria === 'object') {
            const normalized = [];
            for (const [key, val] of Object.entries(resolvedParams.criteria)) {
              normalized.push({
                column: key,
                value: val,
                operator: 'equals'
              });
            }
            resolvedParams.criteria = normalized;
          }

          if (resolvedParams.column) resolvedParams.column = resolveColumn(resolvedParams.column, headers);
          if (resolvedParams.sum_column) resolvedParams.sum_column = resolveColumn(resolvedParams.sum_column, headers);
          if (resolvedParams.average_column) resolvedParams.average_column = resolveColumn(resolvedParams.average_column, headers);
          if (resolvedParams.criteria_column) resolvedParams.criteria_column = resolveColumn(resolvedParams.criteria_column, headers);

          if (resolvedParams.criteria && Array.isArray(resolvedParams.criteria)) {
            resolvedParams.criteria = resolvedParams.criteria.map(c => ({
              ...c,
              column: resolveColumn(c.column || c.criteria_column, headers)
            }));
          }

          const formula = builders[builderName](resolvedParams);
          const finalFormula = wrapFormula(formula, allSkills.formula.rules);

          if (patternDef.type === 'aggregate') {
            steps.push({
              stepNumber: idx + 1,
              action: 'QUERY_VALUE',
              description: calc.label || `Querying ${pattern}`,
              params: {
                formula: finalFormula,
                label: calc.label || pattern
              }
            });
          } else {
            steps.push({
              stepNumber: idx + 1,
              action: 'ADD_COLUMN',
              description: `Calculating ${pattern}`,
              params: {
                columnName: calc.parameters.column_name || pattern,
                formula: finalFormula
              }
            });
          }
        });

        summary = intent === 'formula' ? "Performing calculations." : "Analyzing data with queries.";
      } else if (intent === 'chart') {
        // CHART DECISION ENGINE
        const chartGoal = rawPlan.chart_goal;
        let chartType = intentResult.explicit_chart_type || rawPlan.explicit_chart_type;

        if (!chartType && allSkills.chart.goals[chartGoal]) {
          chartType = allSkills.chart.goals[chartGoal].default_type;
        }

        chartType = (chartType || 'column').toLowerCase();

        // RESOLVE CHART COLUMNS
        const headers = sheetSchema?.headers || [];
        const resolvedX = resolveColumn(rawPlan.x_column, headers);
        const resolvedY = Array.isArray(rawPlan.y_columns)
          ? rawPlan.y_columns.map(col => resolveColumn(col, headers))
          : [];

        // Validate chart type
        if (!allSkills.chart.supported_types.includes(chartType)) {
          console.warn(`Fallback: Unsupported chart type ${chartType}, using column instead.`);
          chartType = 'column';
        }

        // Apply rules
        if (chartType === 'pie' && resolvedY.length > allSkills.chart.rules.pie_max_slices) {
          chartType = 'bar';
          console.log(`Fallback: Pie chart has too many slices, switched to bar.`);
        }

        steps.push({
          stepNumber: 1,
          action: 'CREATE_CHART',
          description: `Creating ${chartType} chart for ${chartGoal}`,
          params: {
            chartType: chartType,
            title: rawPlan.title || prompt,
            xAxisColumn: resolvedX,
            seriesColumns: resolvedY,
            styling: allSkills.chart.styling
          }
        });
        summary = `Creating a ${chartType} chart.`;
      } else if (intent === 'clean_data') {
        if (!Array.isArray(rawPlan.operations)) {
          throw new Error('Invalid clean_data operations format');
        }

        rawPlan.operations.forEach((op, index) => {
          const opName = op.operation;
          if (!allSkills.clean_data.operations.hasOwnProperty(opName)) {
            console.warn(`Unsupported cleaning operation: ${opName}`);
            return;
          }

          const stepAction = opName === 'filter_data' ? 'FILTER_DATA' : 'CLEAN_DATA';
          const headers = sheetSchema?.headers || [];

          // Handle both flat and nested structure
          const params = op.parameters || op;
          const resolvedCol = resolveColumn(params.column, headers);

          let operator = params.operator;
          // Robust operator mapping
          if (opName === 'filter_data') {
            const opMap = {
              'not_equal_to': 'not_equals',
              'not_equal': 'not_equals',
              'is_not': 'not_equals',
              '!=': 'not_equals',
              'equal_to': 'equals',
              'is': 'equals',
              '==': 'equals',
              'greater_than': 'greater',
              '>': 'greater',
              'less_than': 'less',
              '<': 'less'
            };
            operator = opMap[operator?.toLowerCase()] || operator;
          }

          steps.push({
            stepNumber: index + 1,
            action: stepAction,
            description: `Performing ${opName}`,
            params: {
              column: resolvedCol,
              operation: opName,
              operator: operator,
              value: params.value,
              fillValue: params.fillValue
            }
          });
        });
        summary = "Cleaning sheet data.";
      } else if (intent === 'organization') {
        if (!Array.isArray(rawPlan.operations)) {
          throw new Error('Invalid organization operations format');
        }

        rawPlan.operations.forEach((op, index) => {
          const opName = op.operation;
          const stepAction = opName.toUpperCase(); // SORT_DATA or FORMAT_CELLS
          const headers = sheetSchema?.headers || [];

          // Handle nested if needed
          const params = op.parameters || op;
          // Resolve column if present
          if (params.column) params.column = resolveColumn(params.column, headers);

          steps.push({
            stepNumber: index + 1,
            action: stepAction,
            description: `Performing ${opName}`,
            params: params
          });
        });
        summary = "Organizing sheet data.";
      }
    } catch (valError) {
      console.error(`[${requestId}] Validation/Build Error:`, valError.message);
      return res.json({ success: false, answer: `I couldn't complete that: ${valError.message}`, plan: { steps: [] } });
    }

    res.json({
      success: true,
      answer: rawPlan.conversational_answer || summary,
      plan: { summary, steps },
      error: null
    });

  } catch (error) {
    console.error(`[${requestId}] Server Error:`, error);
    res.status(500).json({ success: false, error: 'Internal server error during planning' });
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
