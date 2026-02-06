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
    .setTitle('AI Sheet Analyst')
    .setWidth(350);
  SpreadsheetApp.getUi().showSidebar(html);
}

function processQuery(prompt) {
  try {
    // For now, we simulate analysis. 
    // You can use SpreadsheetApp.getActiveSpreadsheet() here to read data.
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const range = sheet.getDataRange();
    const values = range.getValues();
    
    // Simple placeholder response
    return {
      status: 'success',
      message: `Analyzing ${values.length} rows of data... \n\nReceived prompt: "${prompt}"\n\n(AI integration step goes here)`
    };
  } catch (e) {
    return {
      status: 'error',
      message: e.toString()
    };
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
