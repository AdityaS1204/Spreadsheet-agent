const fs = require('fs');
const path = require('path');

/**
 * Selects relevant skill files based on user prompt keywords
 * @param {string} userPrompt - The user's query/request
 * @returns {string} - Combined content of relevant skill files
 */
function selectSkills(userPrompt) {
  const skills = [];
  const promptLower = userPrompt.toLowerCase();
  
  // Detect formula-related tasks
  if (/formula|calculate|compute|sum|average|total|count|percentage|multiply|divide|add|subtract/i.test(promptLower)) {
    skills.push(readSkill('FormulaSkills.md'));
  }
  
  // Detect chart-related tasks
  if (/chart|graph|plot|visualize|visualization|bar|line|pie|scatter|column/i.test(promptLower)) {
    skills.push(readSkill('ChartSkills.md'));
  }
  
  // Detect data cleaning/filtering tasks
  if (/remove|delete|filter|clean|trim|duplicate|empty|keep only|get rid|clear/i.test(promptLower)) {
    skills.push(readSkill('DataCleaningSkills.md'));
  }
  
  // If no specific skills matched, return empty string
  if (skills.length === 0) {
    return '';
  }
  
  // Combine skills with separators
  return skills.join('\n\n---\n\n');
}

/**
 * Reads a skill file from the skills directory
 * @param {string} filename - Name of the skill file
 * @returns {string} - Content of the skill file
 */
function readSkill(filename) {
  try {
    const skillPath = path.join(__dirname, filename);
    const content = fs.readFileSync(skillPath, 'utf8');
    return `# SKILL: ${filename.replace('.md', '')}\n\n${content}`;
  } catch (error) {
    console.error(`Error reading skill file ${filename}:`, error.message);
    return '';
  }
}

/**
 * Gets a list of all available skill files
 * @returns {string[]} - Array of skill filenames
 */
function getAvailableSkills() {
  try {
    const skillsDir = __dirname;
    const files = fs.readdirSync(skillsDir);
    return files.filter(file => file.endsWith('.md'));
  } catch (error) {
    console.error('Error listing skill files:', error.message);
    return [];
  }
}

module.exports = {
  selectSkills,
  readSkill,
  getAvailableSkills
};
