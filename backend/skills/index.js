const fs = require('fs');
const path = require('path');

const skillsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../skills.json'), 'utf8'));

/**
 * Returns the relevant section of skills.json based on intent
 * @param {string} intent - formula | chart | clean_data
 * @returns {object} - The relevant skill definition
 */
function getSkillsForIntent(intent) {
  return skillsData[intent] || {};
}

module.exports = {
  getSkillsForIntent,
  allSkills: skillsData
};
