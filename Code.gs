/**
 * AI Sheet Agent - Google Apps Script Backend
 * Integrates with Node.js backend for AI-powered spreadsheet operations
 */

// Configuration - Update this to your backend URL
const BACKEND_URL = 'https://lawana-nucleoloid-leland.ngrok-free.dev';

/**
 * Creates a custom menu in Google Sheets when the spreadsheet opens.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('AI Assistant')
    .addItem('Open AI Sidebar', 'showSidebar')
    .addToUi();
}

function showSidebar() {
  const html = HtmlService.createTemplateFromFile('Sidebar')
    .evaluate()
    .setTitle('AI Sheet Agent')
    .setWidth(380);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Gets the current user's email and checks if they have an account.
 */
function getUserAccount() {
  try {
    const userEmail = Session.getActiveUser().getEmail();
    const props = PropertiesService.getScriptProperties();
    let users = props.getProperty('REGISTERED_USERS');
    users = users ? JSON.parse(users) : [];

    const isNewUser = !users.includes(userEmail);
    
    if (isNewUser && userEmail) {
      users.push(userEmail);
      props.setProperty('REGISTERED_USERS', JSON.stringify(users));
      console.log('New account created for:', userEmail);
    }

    return {
      email: userEmail || 'Unknown User',
      isNew: isNewUser,
      status: 'success'
    };
  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}

// ============================================================
// SHEET SCHEMA EXTRACTION
// ============================================================

/**
 * Extracts the schema of the current sheet for AI analysis
 */
function getSheetSchema() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  
  if (values.length === 0) {
    return { sheetName: sheet.getName(), headers: [], sampleData: [], rowCount: 0, colCount: 0 };
  }

  // Smart Header Detection
  const headerRowIndex = detectHeaderRow(values);
  const headerRowNumber = headerRowIndex + 1; // 1-based row number

  const headers = values[headerRowIndex].map((header, index) => ({
    name: header ? String(header) : `Column ${String.fromCharCode(65 + index)}`,
    column: String.fromCharCode(65 + index),
    index: index
  }));

  // Get sample data (first 5 rows after header)
  // Ensure we don't go out of bounds
  const dataStartIndex = headerRowIndex + 1;
  const sampleData = values.slice(dataStartIndex, dataStartIndex + 5).map(row => {
    const rowObj = {};
    headers.forEach((h, i) => {
      rowObj[h.name] = row[i];
    });
    return rowObj;
  });

  // Detect data types for each column
  const columnTypes = headers.map((h, i) => {
    // Sample a few rows for type detection
    const colValues = values.slice(dataStartIndex).map(row => row[i]).filter(v => v !== '' && v !== null);
    return {
      ...h,
      detectedType: detectDataType(colValues),
      sampleValues: colValues.slice(0, 3)
    };
  });

  return {
    sheetName: sheet.getName(),
    headers: columnTypes,
    sampleData: sampleData,
    rowCount: values.length,
    colCount: headers.length,
    headerRow: headerRowNumber // Pass this to backend if needed
  };
}

/**
 * Detects the index of the header row (0-based)
 * Strategy: Find the first row with the most non-empty string values
 */
function detectHeaderRow(values) {
  let maxNonEmpty = 0;
  let bestRow = 0;
  
  // Scan first 10 rows (or all if less than 10)
  const limit = Math.min(values.length, 10);
  
  for (let i = 0; i < limit; i++) {
    const row = values[i];
    // Count non-empty string cells
    const nonEmptyCount = row.filter(cell => cell !== '' && cell !== null && typeof cell === 'string').length;
    
    // Heuristic: Headers are usually strings and cover most columns
    if (nonEmptyCount > maxNonEmpty) {
      maxNonEmpty = nonEmptyCount;
      bestRow = i;
    }
  }
  
  return bestRow;
}

/**
 * Detects the predominant data type in a column
 */
function detectDataType(values) {
  if (values.length === 0) return 'empty';
  
  let types = { number: 0, date: 0, string: 0 };
  
  values.forEach(v => {
    if (typeof v === 'number') types.number++;
    else if (v instanceof Date) types.date++;
    else types.string++;
  });

  const max = Math.max(types.number, types.date, types.string);
  if (types.number === max) return 'number';
  if (types.date === max) return 'date';
  return 'string';
}

// ============================================================
// MAIN QUERY PROCESSOR
// ============================================================

/**
 * Process user query - calls backend API and executes the plan
 */
function processQuery(prompt) {
  try {
    const userEmail = Session.getActiveUser().getEmail();
    console.log(`User ${userEmail} prompted: ${prompt}`);

    // Step 1: Get sheet schema
    const sheetSchema = getSheetSchema();
    
    // Step 2: Call backend API to get action plan
    const actionPlan = callPlanAPI(prompt, sheetSchema);
    
    if (!actionPlan.success) {
      return {
        status: 'error',
        message: actionPlan.error || 'Failed to generate action plan'
      };
    }

    // Step 3: Execute the action plan (if any steps exist)
    let executionResult = { summary: '', stepResults: [] };
    if (actionPlan.plan && actionPlan.plan.steps && actionPlan.plan.steps.length > 0) {
      executionResult = executePlan(actionPlan.plan);
    }
    
    // Combine the AI's conversational answer with the execution summary
    let finalMessage = actionPlan.answer || 'Task completed.';
    if (executionResult.summary) {
      finalMessage += `\n\n${executionResult.summary}`;
    }

    return {
      status: 'success',
      message: finalMessage,
      details: executionResult.stepResults
    };

  } catch (e) {
    console.error('processQuery error:', e);
    return {
      status: 'error',
      message: e.toString()
    };
  }
}

/**
 * Calls the backend /plan API
 */
function callPlanAPI(prompt, sheetSchema) {
  const url = `${BACKEND_URL}/plan`;
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      prompt: prompt,
      sheetSchema: sheetSchema
    }),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode !== 200) {
    console.error('API Error:', responseCode, responseText);
    return { success: false, error: `API returned ${responseCode}` };
  }

  return JSON.parse(responseText);
}

// ============================================================
// ACTION PLAN EXECUTOR
// ============================================================

/**
 * Executes an action plan step by step
 */
function executePlan(plan) {
  const stepResults = [];
  let successCount = 0;

  if (!plan.steps || plan.steps.length === 0) {
    return {
      summary: '',
      stepResults: []
    };
  }

  for (const step of plan.steps) {
    try {
      const result = executeAction(step);
      stepResults.push({
        step: step.stepNumber,
        action: step.action,
        description: step.description,
        status: 'success',
        result: result
      });
      successCount++;
    } catch (e) {
      stepResults.push({
        step: step.stepNumber,
        action: step.action,
        description: step.description,
        status: 'error',
        error: e.toString()
      });
    }
  }

  const planSummary = plan.summary ? plan.summary : 'Action plan executed.';
  return {
    summary: `${planSummary}\n\n✅ Completed ${successCount}/${plan.steps.length} steps`,
    stepResults: stepResults
  };
}

/**
 * Executes a single action based on its type
 */
function executeAction(step) {
  let action = step.action;
  let params = step.params;
  
  // Robustness Fix: Handle cases where AI returns { "ADD_FORMULA": { ... } } instead of { "action": "ADD_FORMULA", "params": { ... } }
  if (!action && !params) {
    const keys = Object.keys(step).filter(k => k !== 'stepNumber' && k !== 'description');
    if (keys.length > 0) {
      action = keys[0];
      params = step[action];
      console.log(`Detected nested action format: ${action}`, params);
    }
  }
  
  switch (action) {
    case 'CONVERT_DATATYPE':
      return convertDataType(params);
    case 'ADD_FORMULA':
      return addFormula(params);
    case 'CREATE_CHART':
      return createChart(params);
    case 'SORT_DATA':
      return sortData(params);
    case 'FILTER_DATA':
      return filterData(params);
    case 'ADD_COLUMN':
      return addColumn(params);
    case 'DELETE_COLUMN':
      return deleteColumn(params);
    case 'DELETE_ROWS':
      return deleteRows(params);
    case 'FORMAT_CELLS':
      return formatCells(params);
    case 'CLEAN_DATA':
      return cleanData(params);
    case 'AGGREGATE':
      return aggregate(params);
    case 'YOY_CALCULATION':
      return yoyCalculation(params);
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// ============================================================
// EXECUTOR FUNCTIONS
// ============================================================

/**
 * Converts data type of a column
 */
function convertDataType(params) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const col = columnLetterToIndex(params.column);
  const lastRow = sheet.getLastRow();
  
  const range = sheet.getRange(2, col, lastRow - 1, 1);
  const values = range.getValues();
  
  const converted = values.map(([val]) => {
    if (params.toType === 'number') {
      return [parseFloat(val) || 0];
    } else if (params.toType === 'string') {
      return [String(val)];
    } else if (params.toType === 'date') {
      return [new Date(val)];
    }
    return [val];
  });
  
  range.setValues(converted);
  return `Converted column ${params.column} to ${params.toType}`;
}

/**
 * Adds a formula to a column
 */
function addFormula(params) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const col = columnLetterToIndex(params.targetColumn);
  
  // Dynamic Start Row
  // If params.startRow is not provided, detect headers
  let startRow = params.startRow;
  if (!startRow) {
    const values = sheet.getDataRange().getValues();
    // header index + 1 (for 1-based) + 1 (for next row that is data)
    startRow = detectHeaderRow(values) + 2; 
  }
  
  const endRow = params.endRow || sheet.getLastRow();
  
  // Extract the base row number from the formula if possible (e.g. "2" from "=H2*10")
  // Look for a letter followed by a number
  const rowMatch = params.formula.match(/[A-Za-z]+(\d+)/);
  const baseRow = rowMatch ? rowMatch[1] : '1'; // Default to 1 if no row found
  const rowRegex = new RegExp(`([A-Za-z]+)${baseRow}\\b`, 'g');

  for (let row = startRow; row <= endRow; row++) {
    const formula = params.formula.replace(rowRegex, `$1${row}`);
    sheet.getRange(row, col).setFormula(formula);
  }
  
  return `Added formula to column ${params.targetColumn}`;
}

/**
 * Creates a chart with improved options
 */
function createChart(params) {
  try {
    console.log('createChart called with params:', JSON.stringify(params));
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    let range;
    
    if (params.range) {
      console.log('Using params.range:', params.range);
      range = sheet.getRange(params.range);
    } else if (params.dataRange) {
      console.log('Using params.dataRange:', params.dataRange);
      range = sheet.getRange(params.dataRange);
    } else {
      console.log('Using entire data range');
      range = sheet.getDataRange();
    }
    
    console.log('Range A1 notation:', range.getA1Notation());

    const typeStr = (params.chartType || params.type || 'column').toLowerCase();
    console.log('Chart type:', typeStr);
    
    let chartType;
    switch (typeStr) {
      case 'bar': chartType = Charts.ChartType.BAR; break;
      case 'line': chartType = Charts.ChartType.LINE; break;
      case 'pie': chartType = Charts.ChartType.PIE; break;
      case 'scatter': chartType = Charts.ChartType.SCATTER; break;
      case 'area': chartType = Charts.ChartType.AREA; break;
      default: chartType = Charts.ChartType.COLUMN;
    }
    
    // Position the chart to the right of the data
    const positionRow = 2;
    const positionCol = sheet.getLastColumn() + 2;
    console.log('Chart position: Row', positionRow, 'Col', positionCol);
    
    const chartBuilder = sheet.newChart()
      .setChartType(chartType)
      .addRange(range)
      .setPosition(positionRow, positionCol, 0, 0)
      .setOption('title', params.title || 'Chart Generated by AI')
      .setOption('useFirstRowAsHeaders', true);
    
    console.log('Building chart...');
    const chart = chartBuilder.build();
    
    console.log('Inserting chart into sheet...');
    sheet.insertChart(chart);
    
    console.log('Chart created successfully');
    return `Created ${typeStr} chart: "${params.title || 'Untitled'}" at Column ${positionCol}`;
    
  } catch (e) {
    console.error('Error in createChart:', e.toString());
    console.error('Stack:', e.stack);
    throw new Error(`Failed to create chart: ${e.toString()}`);
  }
}

/**
 * Sorts data by a column
 */
function sortData(params) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const col = columnLetterToIndex(params.column);
  
  // Smart Header Detection for sorting
  const values = sheet.getDataRange().getValues();
  const headerRowIndex = detectHeaderRow(values);
  const startRow = headerRowIndex + 2; // Data starts after header
  
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  
  if (lastRow < startRow) return 'Not enough data to sort';

  const range = sheet.getRange(startRow, 1, lastRow - startRow + 1, lastCol);
  range.sort({ column: col, ascending: params.order === 'asc' });
  
  return `Sorted data by column ${params.column} (${params.order})`;
}

/**
 * Filters data based on a condition
 * IMPORTANT: This function REMOVES rows that match the condition
 */
function filterData(params) {
  try {
    console.log('filterData called with params:', JSON.stringify(params));
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const col = columnLetterToIndex(params.column);
    const lastRow = sheet.getLastRow();
    
    const values = sheet.getDataRange().getValues();
    const headerRowIndex = detectHeaderRow(values);
    const startRow = headerRowIndex + 2;

    // We read specific column values starting from data row
    const checkRange = sheet.getRange(startRow, col, lastRow - startRow + 1, 1);
    const checkValues = checkRange.getValues();
    
    console.log(`Checking ${checkValues.length} rows for filter condition`);
    
    let rowsToDelete = [];
    checkValues.forEach(([val], i) => {
      let shouldDelete = false;
      
      // Ensure comparisons are robust
      const checkVal = (val === '' || val === null) ? '' : String(val).toLowerCase().trim();
      const paramVal = String(params.value).toLowerCase().trim();

      switch (params.operator) {
        case 'equals': 
          // DELETE rows where value equals the target
          shouldDelete = checkVal === paramVal;
          break;
        case 'not_equals':
          // DELETE rows where value does NOT equal the target
          shouldDelete = checkVal !== paramVal;
          break;
        case 'contains': 
          // DELETE rows where value contains the target
          shouldDelete = checkVal.includes(paramVal);
          break;
        case 'not_contains':
          // DELETE rows where value does NOT contain the target
          shouldDelete = !checkVal.includes(paramVal);
          break;
        case 'greater': 
          shouldDelete = parseFloat(val) > parseFloat(params.value);
          break;
        case 'less': 
          shouldDelete = parseFloat(val) < parseFloat(params.value);
          break;
        case 'empty':
          shouldDelete = val === '' || val === null;
          break;
        case 'not_empty':
          shouldDelete = val !== '' && val !== null;
          break;
      }
      
      if (shouldDelete) {
        rowsToDelete.push(startRow + i);
      }
    });
    
    console.log(`Found ${rowsToDelete.length} rows to delete:`, rowsToDelete);
    
    // CRITICAL: Sort in DESCENDING order and delete from bottom to top
    // This prevents row index shifting issues
    rowsToDelete.sort((a, b) => b - a);
    
    console.log('Deleting rows in order:', rowsToDelete);
    rowsToDelete.forEach(row => {
      console.log(`Deleting row ${row}`);
      sheet.deleteRow(row);
    });
    
    return `Deleted ${rowsToDelete.length} rows where ${params.column} ${params.operator} "${params.value}"`;
    
  } catch (e) {
    console.error('Error in filterData:', e.toString());
    throw new Error(`Failed to filter data: ${e.toString()}`);
  }
}

/**
 * Deletes a column
 */
function deleteColumn(params) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const col = columnLetterToIndex(params.column);
  sheet.deleteColumn(col);
  return `Deleted column ${params.column}`;
}

/**
 * Deletes rows based on condition
 */
function deleteRows(params) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const col = columnLetterToIndex(params.column);
  const lastRow = sheet.getLastRow();
  
  const values = sheet.getDataRange().getValues();
  const headerRowIndex = detectHeaderRow(values);
  const startRow = headerRowIndex + 2;
  
  const range = sheet.getRange(startRow, col, lastRow - startRow + 1, 1);
  const checkValues = range.getValues();
  
  let rowsToDelete = [];
  
  checkValues.forEach(([val], i) => {
    let shouldDelete = false;
    const checkVal = String(val).toLowerCase();
    const paramVal = String(params.value).toLowerCase();
    
    switch (params.condition) {
      case 'empty': shouldDelete = val === '' || val === null; break;
      case 'equals': shouldDelete = checkVal == paramVal; break;
      case 'duplicate':
        // Basic duplicate check in current dataset
        const count = checkValues.filter(([v]) => String(v).toLowerCase() === checkVal).length;
        // Mark for deletion if it appears earlier? No, usually keep first.
        // This logic is complex for O(N^2). Simplified:
        // If we've seen it before in the loop, delete it.
        // We need a Set outside.
        break;
    }
    if (shouldDelete) rowsToDelete.unshift(startRow + i);
  });
  
  // Special handling for duplicates to be efficient
  if (params.condition === 'duplicate') {
     const seen = new Set();
     rowsToDelete = [];
     checkValues.forEach(([val], i) => {
       const key = String(val).toLowerCase();
       if (seen.has(key)) {
         rowsToDelete.unshift(startRow + i);
       } else {
         seen.add(key);
       }
     });
  }

  rowsToDelete.forEach(row => sheet.deleteRow(row));
  return `Deleted ${rowsToDelete.length} rows`;
}

/**
 * Formats cells
 */
function formatCells(params) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const range = sheet.getRange(params.range);
  
  switch (params.format) {
    case 'currency':
      range.setNumberFormat('$#,##0.00');
      break;
    case 'percentage':
      range.setNumberFormat('0.00%');
      break;
    case 'date':
      range.setNumberFormat('yyyy-mm-dd');
      break;
  }
  
  return `Formatted ${params.range} as ${params.format}`;
}

/**
 * Cleans data in a column
 */
function cleanData(params) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const col = columnLetterToIndex(params.column);
  const lastRow = sheet.getLastRow();
  
  const values = sheet.getDataRange().getValues();
  const headerRowIndex = detectHeaderRow(values);
  const startRow = headerRowIndex + 2;
  
  const range = sheet.getRange(startRow, col, lastRow - startRow + 1, 1);
  const checkValues = range.getValues();
  
  let cleaned;
  switch (params.operation) {
    case 'trim':
      cleaned = checkValues.map(([v]) => [String(v).trim()]);
      break;
    case 'uppercase':
      cleaned = checkValues.map(([v]) => [String(v).toUpperCase()]);
      break;
    case 'lowercase':
      cleaned = checkValues.map(([v]) => [String(v).toLowerCase()]);
      break;
    default:
      cleaned = checkValues;
  }
  
  range.setValues(cleaned);
  return `Cleaned column ${params.column} (${params.operation})`;
}

/**
 * Performs aggregation
 */
function aggregate(params) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const col = columnLetterToIndex(params.column);
  const lastRow = sheet.getLastRow();
  
  const values = sheet.getDataRange().getValues();
  const headerRowIndex = detectHeaderRow(values);
  const startRow = headerRowIndex + 2;
  
  const colLetter = params.column;
  
  const formula = {
    'sum': `=SUM(${colLetter}${startRow}:${colLetter}${lastRow})`,
    'average': `=AVERAGE(${colLetter}${startRow}:${colLetter}${lastRow})`,
    'count': `=COUNT(${colLetter}${startRow}:${colLetter}${lastRow})`,
    'min': `=MIN(${colLetter}${startRow}:${colLetter}${lastRow})`,
    'max': `=MAX(${colLetter}${startRow}:${colLetter}${lastRow})`
  }[params.operation];
  
  sheet.getRange(params.targetCell).setFormula(formula);
  return `Added ${params.operation} formula at ${params.targetCell}`;
}

/**
 * Adds Year-over-Year calculation
 */
function yoyCalculation(params) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const lastCol = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  
  const values = sheet.getDataRange().getValues();
  const headerRowIndex = detectHeaderRow(values);
  const headerRow = headerRowIndex + 1;
  const startRow = headerRow + 1;

  // Add new column header
  sheet.getRange(headerRow, lastCol + 1).setValue(params.newColumnName || 'YoY Growth %');
  
  // Add YoY formula
  for (let row = startRow + 1; row <= lastRow; row++) {
    const formula = `=IF(${params.valueColumn}${row-1}<>0,(${params.valueColumn}${row}-${params.valueColumn}${row-1})/${params.valueColumn}${row-1}*100,0)`;
    sheet.getRange(row, lastCol + 1).setFormula(formula);
  }
  
  // Format as percentage
  sheet.getRange(startRow + 1, lastCol + 1, lastRow - startRow, 1).setNumberFormat('0.00"%"');
  return 'Added YoY Change column';
}

/**
 * Adds a new column
 */
function addColumn(params) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const refCol = params.referenceColumn ? columnLetterToIndex(params.referenceColumn) : sheet.getLastColumn();
  const position = params.position || 'after';
  
  let newColIndex;
  if (position === 'after') {
    sheet.insertColumnAfter(refCol);
    newColIndex = refCol + 1;
  } else {
    sheet.insertColumnBefore(refCol);
    newColIndex = refCol;
  }
  
  // Use Detected Header Row to place the title
  const values = sheet.getDataRange().getValues();
  const headerRowIndex = detectHeaderRow(values);
  const headerRow = headerRowIndex + 1;
  const startRow = headerRow + 1;
  
  // Header
  sheet.getRange(headerRow, newColIndex).setValue(params.columnName);
  
  if (params.formula) {
    const lastRow = sheet.getLastRow();
    const headers = values[headerRowIndex];
    
    // Extract the base row number from the formula if possible (e.g. "2" from "=H2*10")
    // Look for a letter followed by a number
    const rowMatch = params.formula.match(/[A-Za-z]+(\d+)/);
    const baseRow = rowMatch ? rowMatch[1] : '1'; // Default to 1 if no row found
    const rowRegex = new RegExp(`([A-Za-z]+)${baseRow}\\b`, 'g');

    for (let row = startRow; row <= lastRow; row++) {
      let formula = params.formula;
      
      // If formula uses column names (e.g. [Price]*[Qty])
      if (headers) {
         headers.forEach((h, i) => {
            const colLetter = String.fromCharCode(65 + i);
            if (h) { // only replace if header exists
                formula = formula.replace(new RegExp(`\\[${h}\\]`, 'g'), `${colLetter}${row}`);
            }
         });
      }
      
      // If formula uses cell notation (e.g. H2), replace the base row with current row
      // Example: If base is 2, replace H2 -> H{row}, A2 -> A{row}
      // We use the regex created above that targets the specific base row number
      formula = formula.replace(rowRegex, `$1${row}`);
      
      sheet.getRange(row, newColIndex).setFormula(formula);
    }
  }
  
  return `Added column "${params.columnName}" at index ${newColIndex}`;
}













// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Converts column letter to index (A = 1, B = 2, etc.)
 */
function columnLetterToIndex(letter) {
  if (!letter) return 1;
  const upper = letter.toUpperCase();
  let result = 0;
  for (let i = 0; i < upper.length; i++) {
    result = result * 26 + upper.charCodeAt(i) - 64;
  }
  return result;
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

