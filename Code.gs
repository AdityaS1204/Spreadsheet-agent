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

/**
 * Gets the current user's email and checks if they have an account.
 * If not, it "creates" one by saving it to properties.
 */
 
function getUserAccount() {
  try {
    const userEmail = Session.getActiveUser().getEmail();
    
    // In a real scenario, you'd check your external DB or a central Sheet.
    // Here we use ScriptProperties as a simple persistent storage for the script.
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

function processQuery(prompt) {
  try {
    // Audit log: know who is making the query
    const userEmail = Session.getActiveUser().getEmail();
    console.log(`User ${userEmail} prompted: ${prompt}`);

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const range = sheet.getDataRange();
    const values = range.getValues();
    
    return {
      status: 'success',
      message: `Analyzing ${values.length} rows for ${userEmail}... \n\nReceived prompt: "${prompt}"\n\n(AI integration step goes here)`
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
