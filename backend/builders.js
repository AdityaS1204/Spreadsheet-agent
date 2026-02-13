/**
 * Deterministic Formula Builders
 */

const builders = {
  buildSum: (params) => {
    const { column } = params;
    return `=SUM(${column}:${column})`;
  },
  
  buildAverage: (params) => {
    const { column } = params;
    return `=AVERAGE(${column}:${column})`;
  },
  
  buildCount: (params) => {
    const { column } = params;
    // Use COUNTA to support both text and numeric entries
    return `=COUNTA(${column}:${column})`;
  },
  
  buildCountIf: (params) => {
    const { criteria_column, operator, value } = params;
    const sheetOp = mapOperator(operator);
    const criterion = (sheetOp === '=') ? value : `${sheetOp}${value}`;
    const formattedCriterion = typeof criterion === 'string' ? `"${criterion}"` : criterion;
    return `=COUNTIF(${criteria_column}:${criteria_column}, ${formattedCriterion})`;
  },
  
  buildCountIfs: (params) => {
    const { criteria } = params;
    let formula = `=COUNTIFS(`;
    criteria.forEach((c, idx) => {
      const sheetOp = mapOperator(c.operator);
      const criterion = (sheetOp === '=') ? c.value : `${sheetOp}${c.value}`;
      const formattedCriterion = typeof criterion === 'string' ? `"${criterion}"` : criterion;
      formula += `${idx > 0 ? ', ' : ''}${c.column}:${c.column}, ${formattedCriterion}`;
    });
    formula += `)`;
    return formula;
  },
  
  buildSumIf: (params) => {
    const { sum_column, criteria_column, operator, value } = params;
    const sheetOp = mapOperator(operator);
    const criterion = (sheetOp === '=') ? value : `${sheetOp}${value}`;
    const formattedCriterion = typeof criterion === 'string' ? `"${criterion}"` : criterion;
    return `=SUMIF(${criteria_column}:${criteria_column}, ${formattedCriterion}, ${sum_column}:${sum_column})`;
  },
  
  buildSumIfs: (params) => {
    const { sum_column, criteria } = params;
    let formula = `=SUMIFS(${sum_column}:${sum_column}`;
    criteria.forEach(c => {
      const sheetOp = mapOperator(c.operator);
      const criterion = (sheetOp === '=') ? c.value : `${sheetOp}${c.value}`;
      const formattedCriterion = typeof criterion === 'string' ? `"${criterion}"` : criterion;
      formula += `, ${c.column}:${c.column}, ${formattedCriterion}`;
    });
    formula += `)`;
    return formula;
  },
  
  buildPercentGrowth: (params) => {
    const { current_cell, previous_cell } = params;
    return `=(${current_cell}-${previous_cell})/${previous_cell}`;
  },
  
  buildRunningTotal: (params) => {
    const { column, start_row } = params;
    return `=SUM(${column}$${start_row}:${column}${start_row})`;
  },

  buildRowCalc: (params) => {
    // This allows the AI to suggest a raw formula if it fits a specific row-wise math need
    // but still subject to the executor's row-filling logic
    return params.formula;
  }
};

function mapOperator(op) {
  if (!op) return '=';
  const map = {
    'equals': '=',
    'not_equals': '<>',
    'greater': '>',
    'less': '<',
    'greater_than': '>',
    'less_than': '<',
    'not_equal_to': '<>'
  };
  return map[op.toLowerCase()] || op;
}

/**
 * Wraps formula with IFERROR if enabled in rules
 */
function wrapFormula(formula, rules) {
  if (rules && rules.wrap_with_iferror) {
    // Only wrap if it's a formula
    if (typeof formula === 'string' && formula.startsWith('=')) {
      return `=IFERROR(${formula.substring(1)}, "")`;
    }
  }
  return formula;
}

module.exports = {
  builders,
  wrapFormula
};
