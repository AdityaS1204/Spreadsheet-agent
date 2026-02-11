# Skills Directory

This directory contains skill files that provide best practices and patterns for the AI Sheet Agent.

## Files

### FormulaSkills.md (2.8 KB)
Formula patterns, error handling, and dynamic reference examples for Google Sheets formulas.

**Key Topics:**
- Common formula patterns (percentage, conditional, text, lookup)
- Error prevention (division by zero, empty cells)
- Column reference best practices
- Array formulas

### ChartSkills.md (5.3 KB)
Professional chart styling templates and configuration options.

**Key Topics:**
- Chart type selection guide (bar, column, line, pie, scatter)
- Professional defaults (colors, legends, spacing)
- Axis configuration and formatting
- Color palettes (Material Design, professional themes)

### DataCleaningSkills.md (6.4 KB)
Safe data manipulation patterns and filtering best practices.

**Key Topics:**
- Filter operators and behavior
- Safety checks (prevent >50% deletion)
- Deletion order (bottom-to-top)
- Common user intents ("remove X", "keep only X")

### index.js (2.2 KB)
Skill selector module that dynamically loads relevant skills based on user prompt keywords.

**Functions:**
- `selectSkills(userPrompt)` - Returns combined content of relevant skill files
- `readSkill(filename)` - Reads a single skill file
- `getAvailableSkills()` - Lists all available skill files

## Usage

```javascript
const { selectSkills } = require('./skills');

// User prompt: "Calculate total sales"
const skills = selectSkills("Calculate total sales");
// Returns: FormulaSkills.md content

// User prompt: "Create a bar chart"
const skills = selectSkills("Create a bar chart");
// Returns: ChartSkills.md content

// User prompt: "Remove cancelled products"
const skills = selectSkills("Remove cancelled products");
// Returns: DataCleaningSkills.md content
```

## Keyword Detection

The skill selector uses regex patterns to detect task types:

- **Formula tasks**: formula, calculate, compute, sum, average, total, count, percentage
- **Chart tasks**: chart, graph, plot, visualize, bar, line, pie, scatter
- **Cleaning tasks**: remove, delete, filter, clean, trim, duplicate, empty, keep only
