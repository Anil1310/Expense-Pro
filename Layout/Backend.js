// /*====================================
// Expense Tracker Pro: 2026 Backend Code
// ====================================*/

// // ✅ Put this at the top of your script (global constants)
// const MAIN_ID = "1WK0QOkrz4c7Fl-wvkLKrH1gPODxkF3stvYajR5lVM0M";
// const CONSOLIDATED_ID = '1lCkNPBkVABweit6dD-3atsP71O0qsBnbuH1rlvzqtV8';
// const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// let currentUser = null; // Track current user for adding items

// /**
//  * Logs detailed actions to the Audit__Log sheet for security and tracking.
//  */
// function logAction(action, details, uniqueId, user) {
// try {
// const ss = SpreadsheetApp.openById(MAIN_ID);
// let auditSheet = ss.getSheetByName("Audit_Log");

// if (!auditSheet) {
// auditSheet = ss.insertSheet("Audit_Log");
// auditSheet.appendRow(["Timestamp", "Action", "Details", "Affected ID", "User"]);
// auditSheet.setColumnWidth(1, 150);
// auditSheet.setColumnWidth(2, 100);
// auditSheet.setColumnWidth(3, 300);
// auditSheet.setColumnWidth(4, 150);
// auditSheet.setColumnWidth(5, 100);
// auditSheet.getRange("A1:E1").setFontWeight("bold").setBackground("#e0e0e0");
// // Hide the sheet for security (optional, user can unhide)
// // auditSheet.hideSheet(); 
// }

// auditSheet.appendRow([
// new Date(),
// action,
// details,
// uniqueId || "N/A",
// user || (currentUser ? currentUser.username : "System/Web")
// ]);

// } catch (e) {
// console.error("Audit Log Error: " + e.message); // Never fail the main action because of logging
// }
// }

// /**
//  * Serves the HTML frontend of the web app.
//  */
// function doGet() {
// return HtmlService.createTemplateFromFile('Expense Tracker/Index')
// .evaluate()
// .setTitle('Expenses Tracker Pro')
// .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
// .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
// }

// function include(filename) {
// return HtmlService.createHtmlOutputFromFile(filename).getContent();
// }

// /**
// * Fetches all data from the Data sheet for the reports page in the same format as All Reports.
// * @returns {Object} An object containing all expenses with proper formatting.
// */
// function getAllData() {
// try {
// const ss = SpreadsheetApp.openById(MAIN_ID);
// let allExpenses = [];
// let allCategories = new Set();

// // Get the Data sheet (consolidated data) which is maintained by addEntry
// const masterSheet = ss.getSheetByName("Data");
// if (!masterSheet) {
// return {
// allExpenses: [],
// uniqueCategories: []
// };
// }

// const dataRange = masterSheet.getDataRange();
// if (dataRange.getNumRows() <= 1) {
// return {
// allExpenses: [],
// uniqueCategories: []
// };
// }

// // Use getDisplayValues() to get formatted values
// const displayValues = dataRange.getDisplayValues().slice(1);
// // Use getValues() to get raw values for numbers and dates
// const rawValues = dataRange.getValues().slice(1);

// displayValues.forEach((row, index) => {
// if (row[2] && row[4] && row[5]) { // Date, Item List, Amount columns
// // Use raw value for date to get proper Date object
// const rawDate = rawValues[index][2];
// let dateObj;
// let yearFromDate;
// let formattedDate;

// if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
// // If it's already a Date object
// dateObj = rawDate;
// yearFromDate = dateObj.getFullYear();
// formattedDate = `${MONTHS[dateObj.getMonth()]} ${dateObj.getDate()} ${yearFromDate}`;
// } else if (typeof rawDate === 'string') {
// // Try to parse string date
// const dateMatch = rawDate.toString().match(/^(\w+)\s+(\d+)(?:\s+(\d{4}))?/);
// if (dateMatch) {
// const monthName = dateMatch[1].substring(0, 3);
// const day = dateMatch[2];
// const yearFromString = dateMatch[3] || new Date().getFullYear();
// const monthIndex = MONTHS.findIndex(m =>
// m.toLowerCase() === monthName.toLowerCase()
// );

// if (monthIndex !== -1) {
// yearFromDate = parseInt(yearFromString);
// formattedDate = `${MONTHS[monthIndex]} ${day} ${yearFromDate}`;
// }
// }
// }

// // Default to current year if parsing failed
// if (!yearFromDate) {
// yearFromDate = new Date().getFullYear();
// formattedDate = row[2] + ' ' + yearFromDate;
// }

// // Use raw value for amount to ensure it's a number
// const rawAmount = rawValues[index][5];
// const amount = typeof rawAmount === 'number' ? rawAmount :
// parseFloat(row[5].replace(/[^\d.-]/g, '')) || 0;

// // Get month from column or extract from date
// let monthName = row[3] || '';
// if (!monthName || !MONTHS.includes(monthName)) {
// if (dateObj) {
// monthName = MONTHS[dateObj.getMonth()];
// }
// }

// allExpenses.push([
// formattedDate, // DATE (formatted as "Month Day Year")
// monthName, // MONTH
// row[4], // ITEM LIST
// amount, // AMOUNT (as number)
// row[6] || '', // CREDIT
// yearFromDate.toString(), // YEAR
// row[7] || '' // TRACKER NAME
// ]);

// if (row[4] && row[4].trim()) {
// allCategories.add(row[4].trim());
// }
// }
// });

// // Sort by date (newest first)
// allExpenses.sort((a, b) => {
// try {
// // Parse dates for comparison
// const dateA = parseDateString(a[0], parseInt(a[5]));
// const dateB = parseDateString(b[0], parseInt(b[5]));
// return dateB - dateA;
// } catch (e) {
// return 0;
// }
// });

// return {
// allExpenses: allExpenses.map(expense => [
// expense[0], // DATE (formatted)
// expense[1], // MONTH
// expense[2], // ITEM LIST
// parseFloat(expense[3]).toFixed(2), // AMOUNT formatted
// expense[4], // CREDIT
// expense[5], // YEAR
// expense[6]  // TRACKER NAME
// ]),
// uniqueCategories: Array.from(allCategories).sort()
// };
// } catch (e) {
// return {
// error: e.message
// };
// }
// }

// /**
// * Fetches all consolidated data from the "Master" sheet for the All Data page.
// * @returns {Array<Array<any>>} The consolidated data or an empty array.
// */
// function getConsolidatedData() {
// try {
// // First, get the data from getAllData which formats it properly
// const allDataResult = getAllData();

// if (allDataResult.error) {
// console.error("Error in getConsolidatedData:", allDataResult.error);
// return [];
// }

// // Transform the data to match the table format with S.N and Unique ID
// const formattedData = allDataResult.allExpenses.map((row, index) => {
// const sn = index + 1;
// const itemList = row[2];
// // Generate a simple unique ID based on S.N and first word of item
// const uniqueId = `${sn}-${itemList.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '')}`;

// return [
// sn, // S.N
// uniqueId, // Unique ID
// row[0], // DATE
// row[1], // MONTH
// row[2], // ITEM LIST
// row[3], // AMOUNT
// row[4], // CREDIT
// row[6] || 'Expenses Tracker 2021' // TRACKER NAME (use default if empty)
// ];
// });

// return formattedData;

// } catch (e) {
// console.error("Error in getConsolidatedData:", e.message);
// return { error: e.message };
// }
// }

// /**
// * Fetches all data and calculates summary stats for a given month.
// * @param {string} month - The name of the sheet (e.g., "Sep").
// * @returns {Object} An object containing summary data and table rows.
// */
// function getMonthlyData(month) {
// try {
// const ss = SpreadsheetApp.openById(MAIN_ID);
// const sheet = ss.getSheetByName(month);
// if (!sheet) {
// return {
// totalExpenses: 0,
// uniqueCategories: 0,
// daysWithExpenses: 0,
// tableData: []
// };
// }

// const dataRange = sheet.getDataRange();
// if (dataRange.getNumRows() <= 1) {
// return {
// totalExpenses: 0,
// uniqueCategories: 0,
// daysWithExpenses: 0,
// tableData: []
// };
// }

// // Use getDisplayValues for display, getValues for calculations
// const displayValues = dataRange.getDisplayValues().slice(1);
// const rawValues = dataRange.getValues().slice(1);

// // Calculate Summary Stats using raw values for numbers
// const expenses = rawValues.map(row => {
// const amount = row[5];
// return typeof amount === 'number' ? amount : parseFloat(amount) || 0;
// });
// const totalExpenses = expenses.reduce((sum, amount) => sum + amount, 0);

// const categories = displayValues.map(row => row[4]);
// const uniqueCategories = new Set(categories.filter(c => c)).size;

// const dates = displayValues.map(row => row[2]);
// const daysWithExpenses = new Set(dates.filter(d => d)).size;

// return {
// totalExpenses: totalExpenses.toFixed(2),
// uniqueCategories: uniqueCategories,
// daysWithExpenses: daysWithExpenses,
// tableData: displayValues.map((row, index) => {
// // Ensure amount is displayed as number
// const rowCopy = [...row];
// rowCopy[5] = expenses[index].toFixed(2);
// return rowCopy;
// })
// };
// } catch (e) {
// return {
// error: e.message
// };
// }
// }

// /**
// * Helper function to parse date strings
// * @param {string} dateStr - Date string like "Sep 15 2025"
// * @param {number} year - Year
// * @returns {Date} Date object
// */
// function parseDateString(dateStr, year) {
// if (!dateStr) return new Date();

// // Check if it's already a date string with year
// const dateMatch = dateStr.match(/^(\w+)\s+(\d+)(?:\s+(\d{4}))?/);
// if (dateMatch) {
// const monthName = dateMatch[1].substring(0, 3);
// const day = parseInt(dateMatch[2]);
// const yearFromString = dateMatch[3] || year || new Date().getFullYear();

// const monthIndex = MONTHS.findIndex(m =>
// m.toLowerCase() === monthName.toLowerCase()
// );

// if (monthIndex !== -1) {
// return new Date(parseInt(yearFromString), monthIndex, day);
// }
// }

// // Try standard Date parsing
// const date = new Date(dateStr);
// if (!isNaN(date.getTime())) {
// return date;
// }

// return new Date();
// }

// /**
// * Generates a unique ID in the format "S.N-ItemList"
// * @param {number} sn - The serial number
// * @param {string} itemList - The item list/category
// * @returns {string} The formatted unique ID
// */
// function generateUniqueId(sn, itemList) {
// const cleanItem = itemList.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '');
// return `${sn}-${cleanItem}`;
// }

// /**
// * Fetches unique item names from column B of the "List" sheet
// * @returns {Array<string>} Array of unique item names
// */
// function getItemList() {
// try {
// const ss = SpreadsheetApp.openById(MAIN_ID);
// const sheet = ss.getSheetByName("List");
// if (!sheet) {
// return [];
// }

// const dataRange = sheet.getDataRange();
// if (dataRange.getNumRows() <= 1) {
// return [];
// }

// // Get all values from column B (index 1)
// const values = dataRange.getValues();
// const itemsColumn = values.slice(1).map(row => row[1]);

// // Filter out empty values and duplicates, then sort
// const uniqueItems = [...new Set(itemsColumn.filter(item => item && item.toString().trim()))]
// .map(item => item.toString().trim())
// .sort();

// return uniqueItems;
// } catch (e) {
// Logger.log('Error in getItemList: ' + e.message);
// return [];
// }
// }

// /**
// * Ensures a sheet exists and has headers with proper formatting
// * @param {string} sheetName - Name of the sheet
// * @param {Array} headers - Array of header names
// * @returns {Sheet} The sheet object
// */
// function ensureSheetExists(sheetName, headers) {
// const ss = SpreadsheetApp.openById(MAIN_ID);
// let sheet = ss.getSheetByName(sheetName);
// if (!sheet) {
// sheet = ss.insertSheet(sheetName);
// sheet.appendRow(headers);

// // Format header row
// const headerRange = sheet.getRange(1, 1, 1, headers.length);
// headerRange.setFontWeight("bold");
// headerRange.setBackground("#f0f0f0");

// // Set column widths
// sheet.setColumnWidth(1, 50);  // S.N
// sheet.setColumnWidth(2, 150); // Unique ID
// sheet.setColumnWidth(3, 100); // Date
// sheet.setColumnWidth(4, 80);  // Month
// sheet.setColumnWidth(5, 200); // Item List
// sheet.setColumnWidth(6, 100); // Amount
// sheet.setColumnWidth(7, 100); // Credit

// // Pre-format the amount column as number
// const amountCol = sheet.getRange(2, 6, sheet.getMaxRows() - 1, 1);
// amountCol.setNumberFormat("###0");
// }
// return sheet;
// }

// /**
// * Adds a new expense entry or updates an existing one.
// * @param {Object} entryData - The data for the new row.
// * @returns {Object} A success or error message.
// */
// function addEntry(entryData) {
// try {
// // Check if it's an update operation
// if (entryData.uniqueId) {
// return updateEntry(entryData);
// }

// // Parse the date to determine the month
// const date = new Date(entryData.date);
// const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// const monthName = monthNames[date.getMonth()];
// const year = date.getFullYear();

// // Format date as "Month Day Year" (e.g., "Sep 15 2025")
// const formattedDate = `${monthName} ${date.getDate()} ${year}`;

// // Ensure month sheet exists
// const ss = SpreadsheetApp.openById(MAIN_ID);
// const sheet = ensureSheetExists(monthName, ["S.N", "Unique ID", "Date", "Month", "Item List", "Amount", "Credit"]);
// const lastRow = sheet.getLastRow();
// const sn = lastRow;
// const newUniqueId = generateUniqueId(sn, entryData.itemList);

// // Convert amount to number
// const amount = parseFloat(entryData.amount) || 0;

// const newRow = [
// sn,
// newUniqueId,
// formattedDate,
// monthName,
// entryData.itemList,
// amount,  // This is now a number
// entryData.credit
// ];

// sheet.appendRow(newRow);

// // Apply number formatting to the amount column
// const newRowNum = sheet.getLastRow();
// const amountCell = sheet.getRange(newRowNum, 6); // Column 6 is Amount
// amountCell.setNumberFormat("###0");

// // Update the consolidated "Data" sheet as well
// const consolidatedSheet = ensureSheetExists("Data", ["S.N", "Unique ID", "Date", "Month", "Item List", "Amount", "Credit"]);
// const consolidatedLastRow = consolidatedSheet.getLastRow();
// consolidatedSheet.appendRow([
// consolidatedLastRow,
// newUniqueId,
// formattedDate,
// monthName,
// entryData.itemList,
// amount,  // This is now a number
// entryData.credit
// ]);

// // Apply number formatting to consolidated sheet
// const consolidatedAmountCell = consolidatedSheet.getRange(consolidatedSheet.getLastRow(), 6);
// consolidatedAmountCell.setNumberFormat("###0");

// // Log the creation
// logAction("CREATE", `Added entry: ${entryData.itemList} (${amount})`, newUniqueId);

// return {
// success: true
// };
// } catch (e) {
// return {
// error: e.message
// };
// }
// }

// /**
// * Fetches an entry by its Unique ID and month.
// * @param {string} uniqueId - The unique ID of the row.
// * @param {string} month - The month of the entry.
// * @returns {Array<any>} The row data or null if not found.
// */
// function getEntryByUniqueId(uniqueId, month) {
// try {
// const ss = SpreadsheetApp.openById(MAIN_ID);
// const sheet = ss.getSheetByName(month);
// if (!sheet) return null;

// const data = sheet.getDataRange().getValues();
// const foundRow = data.find(row => row[1] === uniqueId);

// if (foundRow) {
// // Format amount as number
// const formattedRow = [...foundRow];
// if (formattedRow[5]) {
// formattedRow[5] = parseFloat(formattedRow[5]) || 0;
// }
// return formattedRow;
// }

// return null;
// } catch (e) {
// return null;
// }
// }

// /**
//  * Updates an existing entry based on its Unique ID.
//  * @param {Object} entryData - The updated data for the row.
//  * @returns {Object} A success or error message.
//  */
// function updateEntry(entryData) {
// try {
// // Parse the date to determine the month and format
// const date = new Date(entryData.date);
// const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// const monthName = monthNames[date.getMonth()];
// const year = date.getFullYear();
// const formattedDate = `${monthName} ${date.getDate()} ${year}`;

// // Convert amount to number
// const amount = parseFloat(entryData.amount) || 0;

// const ss = SpreadsheetApp.openById(MAIN_ID);

// // Check if the month has changed
// // entryData.month is the OLD month (sheet), monthName is the NEW month
// if (entryData.month && entryData.month !== monthName) {
// // --- CASE 1: Month Changed (Move Entry) ---

// // 1. Add to NEW sheet FIRST (Transactional Safety)
// const newSheet = ensureSheetExists(monthName, ["S.N", "Unique ID", "Date", "Month", "Item List", "Amount", "Credit"]);
// const lastRow = newSheet.getLastRow();

// const newRow = [
// lastRow, // New S.N based on new sheet
// entryData.uniqueId, // Keep same Unique ID
// formattedDate,
// monthName,
// entryData.itemList,
// amount,
// entryData.credit
// ];

// newSheet.appendRow(newRow);

// // Verify row was added (Transactional check)
// if (newSheet.getLastRow() === lastRow) {
// throw new Error("Transactional Error: Failed to write to new month sheet. Aborting delete from old sheet.");
// }

// // Apply number formatting in new sheet
// const newRowNum = newSheet.getLastRow();
// newSheet.getRange(newRowNum, 6).setNumberFormat("###0");

// // 2. Delete from OLD sheet (Only after successful add)
// const oldSheet = ss.getSheetByName(entryData.month);
// if (oldSheet) {
// const oldData = oldSheet.getDataRange().getValues();
// const rowToDelete = oldData.findIndex(row => row[1] === entryData.uniqueId);
// if (rowToDelete > -1) {
// oldSheet.deleteRow(rowToDelete + 1);
// }
// }

// logAction("MOVE", `Moved from ${entryData.month} to ${monthName}`, entryData.uniqueId);

// } else {
// // --- CASE 2: Month Same (Update in place) ---
// const sheet = ss.getSheetByName(entryData.month);
// if (!sheet) throw new Error(`Sheet "${entryData.month}" not found.`);

// // Get all values to find the row index
// const data = sheet.getDataRange().getValues();
// const rowIndexToUpdate = data.findIndex(row => row[1] === entryData.uniqueId);

// if (rowIndexToUpdate > -1) {
// const updatedRow = [
// data[rowIndexToUpdate][0], // Keep the same S.N
// entryData.uniqueId,
// formattedDate,
// monthName,
// entryData.itemList,
// amount,  // This is now a number
// entryData.credit
// ];

// // Update the row in the month-specific sheet
// sheet.getRange(rowIndexToUpdate + 1, 1, 1, updatedRow.length).setValues([updatedRow]);

// // Apply number formatting to amount column
// const amountCell = sheet.getRange(rowIndexToUpdate + 1, 6);
// amountCell.setNumberFormat("###0");

// logAction("UPDATE", `Updated entry details`, entryData.uniqueId);

// } else {
// return { error: "Entry not found in source sheet." };
// }
// }

// // --- Update Consolidated Sheet (Always Check & Update) ---
// const consolidatedSheet = ss.getSheetByName("Data");
// if (consolidatedSheet) {
// const consolidatedData = consolidatedSheet.getDataRange().getValues();
// const consolidatedRowIndex = consolidatedData.findIndex(row => row[1] === entryData.uniqueId);

// const consolidatedRowValues = [
// // We can't easily retrieve the original S.N for the consolidated sheet without reading it first,
// // but we found the index, so we can preserve slot or just overwrite.
// // Let's grab the current S.N from the row we found.
// (consolidatedRowIndex > -1) ? consolidatedData[consolidatedRowIndex][0] : consolidatedSheet.getLastRow(),
// entryData.uniqueId,
// formattedDate,
// monthName,
// entryData.itemList,
// amount,
// entryData.credit
// ];

// if (consolidatedRowIndex > -1) {
// consolidatedSheet.getRange(consolidatedRowIndex + 1, 1, 1, consolidatedRowValues.length).setValues([consolidatedRowValues]);
// consolidatedSheet.getRange(consolidatedRowIndex + 1, 6).setNumberFormat("###0");
// }
// }

// return { success: true };

// } catch (e) {
// return { error: e.message };
// }
// }

// /**
// * Deletes an entry based on its Unique ID from both sheets.
// * @param {string} uniqueId - The unique ID of the row to delete.
// * @param {string} month - The sheet name.
// * @returns {Object} A success or error message.
// */
// function deleteEntry(uniqueId, month) {
// try {
// const ss = SpreadsheetApp.openById(MAIN_ID);
// const sheet = ss.getSheetByName(month);
// if (!sheet) throw new Error(`Sheet "${month}" not found.`);

// const data = sheet.getDataRange().getValues();
// const rowIndexToDelete = data.findIndex(row => row[1] == uniqueId) + 1;

// if (rowIndexToDelete > 0) {
// sheet.deleteRow(rowIndexToDelete);

// // Delete from the consolidated "Data" sheet as well
// const consolidatedSheet = ss.getSheetByName("Data");
// if (consolidatedSheet) {
// const consolidatedData = consolidatedSheet.getDataRange().getValues();
// const consolidatedRowIndex = consolidatedData.findIndex(row => row[1] == uniqueId);
// if (consolidatedRowIndex > -1) {
// consolidatedSheet.deleteRow(consolidatedRowIndex + 1);
// }
// }

// logAction("DELETE", `Deleted entry from ${month}`, uniqueId);

// return {
// success: true
// };
// }
// return {
// error: "Entry not found."
// };
// } catch (e) {
// return {
// error: e.message
// };
// }
// }

// /**
// * Authenticates Admin from the "Admin" sheet
// * @param {string} username - The username to authenticate
// * @param {string} password - The password to verify
// * @returns {Object} Authentication result with user details or error message
// */
// function checkLogin(username, password) {
// try {
// const ss = SpreadsheetApp.openById(MAIN_ID);
// let AdminSheet = ss.getSheetByName("Admin");

// if (!AdminSheet) {
// // Create a default Admin sheet if it doesn't exist
// AdminSheet = ss.insertSheet("Admin");
// AdminSheet.appendRow(["Username", "Password", "Name", "Role", "Last Update"]);
// AdminSheet.appendRow(["Anil Chahar", "4566", "Anil Chahar", "Admin", new Date()]);
// AdminSheet.appendRow(["Radhika", "4566", "Radhika Chahar", "User", new Date()]);

// // Format header
// const headerRange = AdminSheet.getRange(1, 1, 1, 5);
// headerRange.setFontWeight("bold");
// headerRange.setBackground("#f0f0f0");

// // Set column widths
// AdminSheet.setColumnWidth(1, 100); // Username
// AdminSheet.setColumnWidth(2, 100); // Password
// AdminSheet.setColumnWidth(3, 100); // Name
// AdminSheet.setColumnWidth(4, 100); // Role
// AdminSheet.setColumnWidth(5, 150); // Last Update
// }

// const dataRange = AdminSheet.getDataRange();
// if (dataRange.getNumRows() <= 1) {
// return {
// success: false,
// message: "No Admin configured in the Admin sheet"
// };
// }

// // Get all user data starting from row 2 (skip header)
// const AdminData = dataRange.getValues().slice(1);

// // Search for the username
// for (let i = 0; i < AdminData.length; i++) {
// const userRow = AdminData[i];
// const storedUsername = userRow[0] ? userRow[0].toString().trim() : "";
// const storedPassword = userRow[1] ? userRow[1].toString().trim() : "";
// const storedName = userRow[2] ? userRow[2].toString().trim() : storedUsername;
// const storedRole = userRow[3] ? userRow[3].toString().trim() : "User";

// if (storedUsername.toLowerCase() === username.toLowerCase()) {
// if (storedPassword === password) {
// // Update last login time
// AdminSheet.getRange(i + 2, 5).setValue(new Date());

// // Set current user
// currentUser = {
// username: storedUsername,
// name: storedName,
// role: storedRole
// };

// return {
// success: true,
// name: storedName,
// role: storedRole,
// username: storedUsername
// };
// } else {
// return {
// success: false,
// message: "Invalid password"
// };
// }
// }
// }

// return {
// success: false,
// message: "Username not found"
// };

// } catch (e) {
// Logger.log('Error in checkLogin: ' + e.message);
// return {
// success: false,
// message: "Authentication error: " + e.message
// };
// }
// }

// function initializeSpreadsheet() {
// const ss = SpreadsheetApp.openById(MAIN_ID);

// // Create month sheets
// MONTHS.forEach(month => {
// ensureSheetExists(month, ["S.N", "Unique ID", "Date", "Month", "Item List", "Amount", "Credit"]);
// });

// // Create consolidated "Data" sheet
// ensureSheetExists("Data", ["S.N", "Unique ID", "Date", "Month", "Item List", "Amount", "Credit"]);

// // Create or ensure Admin sheet exists with Last Update column
// const AdminSheet = ensureSheetExists("Admin", ["Username", "Password", "Name", "Role", "Last Update"]);

// // If the sheet was just created, add default Admin with current date
// if (AdminSheet.getLastRow() === 1) {
// AdminSheet.appendRow(["Anil Chahar", "4566", "Anil Chahar", "Admin", new Date()]);
// AdminSheet.appendRow(["Radhika", "4566", "Radhika Chahar", "User", new Date()]);
// }

// // Create or ensure List sheet exists
// ensureListSheet();

// // Delete the default sheet if it exists
// const defaultSheet = ss.getSheetByName("Sheet1");
// if (defaultSheet && ss.getSheets().length > 1) {
// ss.deleteSheet(defaultSheet);
// }
// }

// /**
// * Ensures List sheet exists with proper structure
// */
// function ensureListSheet() {
// const ss = SpreadsheetApp.openById(MAIN_ID);
// let listSheet = ss.getSheetByName("List");

// if (!listSheet) {
// listSheet = ss.insertSheet("List");
// // Add headers
// listSheet.appendRow(["ID", "Item Name", "Category", "Date Added", "Added By"]);

// // Format header
// const headerRange = listSheet.getRange(1, 1, 1, 5);
// headerRange.setFontWeight("bold");
// headerRange.setBackground("#f0f0f0");

// // Set column widths
// listSheet.setColumnWidth(1, 50);   // ID
// listSheet.setColumnWidth(2, 200);  // Item Name
// listSheet.setColumnWidth(3, 100);  // Category
// listSheet.setColumnWidth(4, 120);  // Date Added
// listSheet.setColumnWidth(5, 100);  // Added By

// // Add some default items
// const defaultItems = [
// ['Groceries', 'Food'],
// ['Fuel', 'Transport'],
// ['Food', 'Food'],
// ['Transport', 'Transport'],
// ['Utilities', 'Utilities'],
// ['Shopping', 'Shopping'],
// ['Entertainment', 'Entertainment']
// ];

// defaultItems.forEach(([item, category], index) => {
// listSheet.appendRow([
// index + 1,
// item,
// category,
// new Date(),
// 'System'
// ]);
// });
// }

// return listSheet;
// }

// /**
// * Fetches yearly summary data for a specific year from Master sheet.
// * @param {string} year - The year to get data for (e.g., "2025").
// * @returns {Object} An object containing monthly totals and yearly total.
// */
// function getYearlyData(year) {
// try {
// const ss = SpreadsheetApp.openById(CONSOLIDATED_ID);
// const sheet = ss.getSheetByName("Master");
// if (!sheet) {
// return { error: "Sheet 'Master' not found." };
// }

// let yearlyData = {};
// let yearlyTotal = 0;

// // Initialize all months to 0
// MONTHS.forEach(month => yearlyData[month] = 0);

// const dataRange = sheet.getDataRange();
// if (dataRange.getNumRows() <= 1) {
// return yearlyData; // no data
// }

// const values = dataRange.getValues().slice(1); // exclude header row

// values.forEach(row => {
// const dateCell = row[2];   // Column C = Date
// const amountCell = row[5]; // Column F = Amount

// if (dateCell && amountCell) {
// let rowDate = dateCell;

// // Convert to Date object if it's a string
// if (!(rowDate instanceof Date)) {
// if (typeof rowDate === 'string') {
// // Try to parse the date string
// const dateMatch = rowDate.toString().match(/^(\w+)\s+(\d+)(?:\s+(\d{4}))?/);
// if (dateMatch) {
// const monthName = dateMatch[1].substring(0, 3);
// const day = parseInt(dateMatch[2]);
// const yearFromString = dateMatch[3] || new Date().getFullYear();
// const monthIndex = MONTHS.findIndex(m =>
// m.toLowerCase() === monthName.toLowerCase()
// );

// if (monthIndex !== -1) {
// rowDate = new Date(parseInt(yearFromString), monthIndex, day);
// }
// } else {
// // Try standard Date parsing
// rowDate = new Date(rowDate);
// }
// }
// }

// // Check if date is valid and matches target year
// if (rowDate instanceof Date && !isNaN(rowDate.getTime()) && rowDate.getFullYear().toString() === year) {
// const monthName = MONTHS[rowDate.getMonth()];
// const amount = parseFloat(amountCell) || 0;

// yearlyData[monthName] += amount;
// yearlyTotal += amount;
// }
// }
// });

// yearlyData["Total"] = yearlyTotal;
// yearlyData["Year"] = year;
// return yearlyData;

// } catch (e) {
// console.error("Error in getYearlyData:", e.message);
// return { error: e.message };
// }
// }

// /**
// * Gets comprehensive yearly report with all calculations
// * @param {string} year - The year to generate report for
// * @returns {Object} Complete report data
// */
// function getYearlyReport(year) {
// try {
// // Get all data
// const allDataResult = getAllData();

// if (allDataResult.error) {
// return { error: allDataResult.error };
// }

// const allExpenses = allDataResult.allExpenses || [];

// if (allExpenses.length === 0) {
// return {
// year: year,
// yearlyTotal: 0,
// monthlyTotals: [],
// categorySummary: [],
// totalTransactions: 0,
// uniqueCategories: 0,
// detailedData: []
// };
// }

// let yearlyTotal = 0;
// let monthlyTotals = {};
// let categorySummary = {};
// let detailedData = [];
// let allCategories = new Set();

// // Initialize monthly totals
// MONTHS.forEach(month => {
// monthlyTotals[month] = 0;
// });

// // Filter expenses for the target year
// const yearlyExpenses = allExpenses.filter(expense => {
// const expenseYear = expense[5]; // YEAR column
// return expenseYear === year;
// });

// // Process yearly expenses
// yearlyExpenses.forEach(expense => {
// const amount = parseFloat(expense[3]) || 0;
// const month = expense[1]; // MONTH column
// const category = expense[2]; // ITEM LIST column

// yearlyTotal += amount;

// if (month && MONTHS.includes(month)) {
// monthlyTotals[month] += amount;
// }

// if (category) {
// if (!categorySummary[category]) {
// categorySummary[category] = 0;
// }
// categorySummary[category] += amount;
// allCategories.add(category);
// }

// detailedData.push([
// expense[0], // DATE
// month,
// category,
// amount.toFixed(2),
// expense[4], // CREDIT
// year,
// expense[6] // TRACKER NAME
// ]);
// });

// // Convert monthly totals to array
// const monthlyTotalsArray = MONTHS.map(month => ({
// month: month,
// total: monthlyTotals[month] || 0
// }));

// // Convert category summary to array and sort
// const categorySummaryArray = Object.entries(categorySummary)
// .map(([category, total]) => ({
// category: category,
// total: parseFloat(total.toFixed(2))
// }))
// .sort((a, b) => b.total - a.total);

// // Calculate category percentages
// const categoryPercentages = categorySummaryArray.map(item => ({
// category: item.category,
// amount: item.total,
// percentage: yearlyTotal > 0 ? ((item.total / yearlyTotal) * 100).toFixed(1) + "%" : "0%"
// }));

// // Find highest spending month
// let highestMonth = { month: "", total: 0 };
// monthlyTotalsArray.forEach(m => {
// if (m.total > highestMonth.total) {
// highestMonth = m;
// }
// });

// // Calculate average monthly expense
// const monthsWithData = monthlyTotalsArray.filter(m => m.total > 0).length;
// const averageMonthlyExpense = monthsWithData > 0
// ? (yearlyTotal / monthsWithData).toFixed(2)
// : 0;

// // Sort detailed data by date (newest first)
// detailedData.sort((a, b) => {
// try {
// const dateA = parseDateString(a[0], parseInt(a[5]));
// const dateB = parseDateString(b[0], parseInt(b[5]));
// return dateB - dateA;
// } catch (e) {
// return 0;
// }
// });

// return {
// year: year,
// yearlyTotal: parseFloat(yearlyTotal.toFixed(2)),
// monthlyTotals: monthlyTotalsArray,
// categorySummary: categorySummaryArray,
// categoryPercentages: categoryPercentages,
// topCategories: categorySummaryArray.slice(0, 5),
// averageMonthlyExpense: parseFloat(averageMonthlyExpense),
// highestMonth: highestMonth,
// totalTransactions: detailedData.length,
// uniqueCategories: allCategories.size,
// detailedData: detailedData
// };
// } catch (e) {
// console.error("Error in getYearlyReport:", e.message);
// return { error: e.message };
// }
// }

// /**
// * Gets available years from consolidated Master sheet
// * @returns {Array<string>} Array of available years
// */
// function getAvailableYears() {
// try {
// const ss = SpreadsheetApp.openById(CONSOLIDATED_ID);
// const dataSheet = ss.getSheetByName("Master");
// if (!dataSheet) {
// return [new Date().getFullYear().toString()];
// }

// const dataRange = dataSheet.getDataRange();
// if (dataRange.getNumRows() <= 1) {
// return [new Date().getFullYear().toString()];
// }

// const values = dataRange.getValues().slice(1);
// const yearsSet = new Set();

// values.forEach(row => {
// const dateCell = row[2];
// if (dateCell) {
// if (dateCell instanceof Date && !isNaN(dateCell.getTime())) {
// yearsSet.add(dateCell.getFullYear().toString());
// } else if (typeof dateCell === 'string') {
// // Try to extract year from date string
// const yearMatch = dateCell.toString().match(/\b(\d{4})\b/);
// if (yearMatch) {
// yearsSet.add(yearMatch[1]);
// }
// }
// }
// });

// // Add current year if no data found
// if (yearsSet.size === 0) {
// yearsSet.add(new Date().getFullYear().toString());
// }

// // Convert to array and sort in descending order
// const years = Array.from(yearsSet).sort((a, b) => parseInt(b) - parseInt(a));
// return years;
// } catch (e) {
// console.error("Error in getAvailableYears:", e.message);
// return [new Date().getFullYear().toString()];
// }
// }

// // Simplified versions of other report functions
// function getYearlyCategorySummary(year) {
// return getYearlyReport(year);
// }

// function getMonthlyTrends(year) {
// const report = getYearlyReport(year);
// if (report.error) return report;

// const monthlyTrends = report.monthlyTotals.map((monthData, index) => ({
// month: monthData.month,
// total: monthData.total,
// categories: 0,
// growth: index === 0 ? 0 :
// report.monthlyTotals[index - 1].total > 0 ?
// ((monthData.total - report.monthlyTotals[index - 1].total) / report.monthlyTotals[index - 1].total * 100).toFixed(1) : 0
// }));

// return {
// year: year,
// monthlyTrends: monthlyTrends,
// peakMonth: report.highestMonth
// };
// }

// function getCategoryAnalysis(year) {
// const report = getYearlyReport(year);
// if (report.error) return report;

// const total = report.yearlyTotal;
// const categoryAnalysis = report.categorySummary.map(cat => ({
// category: cat.category,
// amount: cat.total,
// percentage: total > 0 ? (cat.total / total * 100).toFixed(1) : 0,
// monthlyAverage: (cat.total / 12).toFixed(2)
// }));

// return {
// year: year,
// categoryAnalysis: categoryAnalysis,
// topCategory: categoryAnalysis[0] || null
// };
// }

// function getCreditDistribution(year) {
// const report = getYearlyReport(year);
// if (report.error) return report;

// const creditSummary = {};
// let totalAmount = 0;

// report.detailedData.forEach(expense => {
// const creditType = expense[4] ? expense[4].toString().trim() : "Not Specified";
// const amount = parseFloat(expense[3]) || 0;

// if (!creditSummary[creditType]) {
// creditSummary[creditType] = 0;
// }
// creditSummary[creditType] += amount;
// totalAmount += amount;
// });

// const creditDistribution = Object.entries(creditSummary).map(([creditType, amount]) => ({
// creditType: creditType,
// amount: parseFloat(amount.toFixed(2)),
// percentage: totalAmount > 0 ? ((amount / totalAmount) * 100).toFixed(1) + "%" : "0%"
// })).sort((a, b) => b.amount - a.amount);

// return {
// year: year,
// creditDistribution: creditDistribution,
// mostUsedCredit: creditDistribution[0] || null
// };
// }

// /**
// * Gets yearly detailed data for a specific year
// * @param {string} year - The year to get detailed data for
// * @returns {Object} Detailed yearly data
// */
// function getYearlyDetailedData(year) {
// try {
// const allDataResult = getAllData();

// if (allDataResult.error) {
// return { error: allDataResult.error };
// }

// const allExpenses = allDataResult.allExpenses || [];
// const yearlyExpenses = allExpenses.filter(expense => {
// const expenseYear = expense[5]; // YEAR column
// return expenseYear === year;
// });

// const uniqueCategories = [...new Set(yearlyExpenses.map(expense => expense[2]))].sort();
// const totalAmount = yearlyExpenses.reduce((sum, expense) => sum + parseFloat(expense[3]), 0);

// return {
// allExpenses: yearlyExpenses.map(expense => [
// expense[0], // DATE
// expense[1], // MONTH
// expense[2], // ITEM LIST
// parseFloat(expense[3]), // AMOUNT
// expense[4], // CREDIT
// expense[5]  // YEAR
// ]),
// uniqueCategories: uniqueCategories,
// totalAmount: parseFloat(totalAmount.toFixed(2)),
// year: year
// };
// } catch (e) {
// console.error("Error in getYearlyDetailedData:", e.message);
// return { error: e.message };
// }
// }

// /*=====================================
// Add New Item to List Sheet Functionality
// =====================================*/

// /**
// * Adds a new item to the "List" sheet in column B
// * @param {string} itemName - The new item to add
// * @param {string} category - Optional category for the item
// * @returns {Object} Success or error response
// */
// function addItemToList(itemName, category) {
// try {
// if (!itemName || itemName.trim() === '') {
// return {
// success: false,
// message: 'Item Name Cannot Be Empty'
// };
// }

// const ss = SpreadsheetApp.openById(MAIN_ID);
// const listSheet = ensureListSheet();

// // Check if item already exists (case-insensitive)
// const existingItems = getItemList();
// const itemExists = existingItems.some(item =>
// item.toLowerCase() === itemName.trim().toLowerCase()
// );

// if (itemExists) {
// return {
// success: false,
// message: `"${itemName}" Already Exists In List`
// };
// }

// // Get the next ID
// const lastRow = listSheet.getLastRow();
// const nextId = lastRow + 1;

// // Format date
// const now = new Date();
// const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// const formattedDate = `${monthNames[now.getMonth()]} ${now.getDate()} ${now.getFullYear()}`;

// // Add the new item
// listSheet.appendRow([
// nextId,
// itemName.trim(),
// category || "General",
// formattedDate,
// currentUser ? currentUser.name : "Web App"
// ]);

// // Update data validation across all month sheets
// updateDataValidationForItemList();

// return {
// success: true,
// message: `"${itemName}" Added Successfully 2 List!`,
// newItem: itemName.trim()
// };

// } catch (error) {
// Logger.log('Error Adding New Item: ' + error.message);
// return {
// success: false,
// message: 'Error Adding Item: ' + error.toString()
// };
// }
// }

// /**
// * Updates data validation for Item List column across all month sheets
// */
// function updateDataValidationForItemList() {
// try {
// const ss = SpreadsheetApp.openById(MAIN_ID);
// const allItems = getItemList();

// if (allItems.length === 0) return;

// // Update data validation for Item List column (column 5) in all month sheets
// MONTHS.forEach(month => {
// const sheet = ss.getSheetByName(month);
// if (sheet) {
// const lastRow = sheet.getLastRow();
// if (lastRow > 1) {
// const itemListRange = sheet.getRange(2, 5, lastRow - 1, 1); // Column E (5th column)

// // Create data validation rule
// const rule = SpreadsheetApp.newDataValidation()
// .requireValueInList(allItems, true)
// .setAllowInvalid(false)
// .build();

// itemListRange.setDataValidation(rule);
// }
// }
// });

// // Also update the Data sheet
// const dataSheet = ss.getSheetByName("Data");
// if (dataSheet && dataSheet.getLastRow() > 1) {
// const dataRange = dataSheet.getRange(2, 5, dataSheet.getLastRow() - 1, 1);
// const rule = SpreadsheetApp.newDataValidation()
// .requireValueInList(allItems, true)
// .setAllowInvalid(false)
// .build();
// dataRange.setDataValidation(rule);
// }

// Logger.log('Data Validation Updated With All Items');

// } catch (error) {
// Logger.log('Error Updating Data Validation: ' + error.message);
// }
// }

// /**
// * Export functions for CSV download
// */

// /**
// * Exports data for a specific month to CSV format
// * @param {string} monthName - The month to export
// * @returns {Object} CSV content and filename
// */
// function exportData(monthName) {
// try {
// const monthlyData = getMonthlyData(monthName);

// if (monthlyData.error) {
// return { error: monthlyData.error };
// }

// let csvContent = "S.N,Unique ID,Date,Month,Item List,Amount,Credit\n";

// monthlyData.tableData.forEach((row, index) => {
// csvContent += `${index + 1},${row[1] || ''},"${row[2] || ''}","${row[3] || ''}","${row[4] || ''}",${row[5] || 0},"${row[6] || ''}"\n`;
// });

// return {
// success: true,
// csvContent: csvContent,
// fileName: `Expenses_${monthName}_${new Date().getFullYear()}.csv`
// };
// } catch (e) {
// return { error: e.message };
// }
// }

// /**
// * Exports all data to CSV format
// * @returns {Object} CSV content and filename
// */
// function exportAllData() {
// try {
// const allData = getAllData();

// if (allData.error) {
// return { error: allData.error };
// }

// let csvContent = "Date,Month,Item List,Amount,Credit,Year,Tracker\n";

// allData.allExpenses.forEach(row => {
// csvContent += `"${row[0] || ''}","${row[1] || ''}","${row[2] || ''}",${row[3] || 0},"${row[4] || ''}","${row[5] || ''}","${row[6] || ''}"\n`;
// });

// return {
// success: true,
// csvContent: csvContent,
// fileName: `All_Expenses_${new Date().getFullYear()}.csv`
// };
// } catch (e) {
// return { error: e.message };
// }
// }

// /**
// * Enhanced addEntry function to handle new items
// * @param {Object} entryData - The expense data
// * @returns {Object} Response with success/error
// */
// function addExpenseEntry(entryData) {
// try {
// // Check if we need to add a new item to the list
// if (entryData.isNewItem && entryData.newItemName) {
// const addItemResult = addItemToList(entryData.newItemName);
// if (!addItemResult.success) {
// return addItemResult; // Return error if item addition failed
// }
// // Use the new item name for the expense
// entryData.itemList = addItemResult.newItem;
// }

// // Proceed with adding the expense entry
// return addEntry({
// date: entryData.date,
// itemList: entryData.itemList,
// amount: entryData.amount,
// credit: entryData.credit
// });

// } catch (error) {
// return {
// success: false,
// message: 'Error Processing Expense: ' + error.toString()
// };
// }
// }


// // =======================================
// // NEW DATA SUMMARY & GRAPHS FUNCTIONS
// // =======================================

// /**
//  * Fetches summary data from the 'Data' sheet in MAIN_ID.
//  * @returns {Object} Summary metrics and data for dashboards.
//  */
// function getSummaryData(year) {
// try {
// const ss = SpreadsheetApp.openById(MAIN_ID);
// const sheet = ss.getSheetByName("Data");

// let rows = [];
// if (sheet && sheet.getLastRow() > 1) {
// rows = sheet.getDataRange().getValues().slice(1);
// } else {
// MONTHS.forEach(m => {
// const mSheet = ss.getSheetByName(m);
// if (mSheet && mSheet.getLastRow() > 1) {
// rows = rows.concat(mSheet.getDataRange().getValues().slice(1));
// }
// });
// }

// if (rows.length === 0) return getEmptySummary();

// // Use passed year or default to current year
// const targetYear = (year && year !== 'all') ? year.toString() : new Date().getFullYear().toString();

// let totalAmount = 0;
// const monthlyTotals = {};
// const categoryTotals = {};
// const paymentMethods = { 'Credit': 0, 'Cash': 0 };
// const yearlyCategoryCounts = {};

// rows.forEach(row => {
// const amount = parseFloat(row[5]) || 0;
// const dateStr = row[2];
// const month = row[3];
// const category = row[4] || "Uncategorized";

// const creditStr = String(row[6] || '').toLowerCase();
// const credit = (creditStr.includes('✓') || creditStr.includes('credit')) ? 'Credit' : 'Cash';

// // Parse date to check year
// let dateObj = new Date(dateStr);
// if (isNaN(dateObj.getTime())) dateObj = new Date();

// const rowYear = dateObj.getFullYear().toString();

// if (rowYear === targetYear) {
// totalAmount += amount;

// // Monthly Totals
// monthlyTotals[month] = (monthlyTotals[month] || 0) + amount;

// // Category Totals
// categoryTotals[category] = (categoryTotals[category] || 0) + amount;
// yearlyCategoryCounts[category] = (yearlyCategoryCounts[category] || 0) + 1;

// // Payment Methods
// paymentMethods[credit] += amount;
// }
// });

// const currentYearTotal = totalAmount;

// // Helper to sort and format
// const topCategories = Object.entries(categoryTotals)
// .map(([cat, amt]) => ({
// category: cat,
// total: amt,
// percentage: currentYearTotal > 0 ? ((amt / currentYearTotal) * 100).toFixed(1) : 0,
// transactions: yearlyCategoryCounts[cat],
// avgPer: yearlyCategoryCounts[cat] ? amt / yearlyCategoryCounts[cat] : 0
// }))
// .sort((a, b) => b.total - a.total)
// .slice(0, 5);

// const catDist = Object.entries(categoryTotals)
// .map(([cat, amt]) => ({ category: cat, percentage: currentYearTotal > 0 ? ((amt / currentYearTotal) * 100).toFixed(1) : 0 }))
// .sort((a, b) => b.percentage - a.percentage)
// .slice(0, 5);

// const payMethods = Object.entries(paymentMethods)
// .map(([method, amt]) => ({ method: method, amount: amt, percentage: currentYearTotal > 0 ? ((amt / currentYearTotal) * 100).toFixed(1) : 0 }));

// const monthsArr = Object.entries(monthlyTotals)
// .map(([m, amt]) => ({ month: m, amount: amt }))
// .sort((a, b) => b.amount - a.amount);

// const highest = monthsArr.length > 0 ? monthsArr[0] : { month: '-', amount: 0 };
// const lowest = monthsArr.length > 0 ? monthsArr[monthsArr.length - 1] : { month: '-', amount: 0 };

// // Monthly Comparison Mockup (Trend)
// const monthlyComparison = MONTHS.map(m => {
// const amt = monthlyTotals[m] || 0;
// return {
// month: m,
// total: amt,
// dailyAvg: amt / 30, // Approx
// transactions: 0,
// categories: 0,
// trend: amt > (currentYearTotal / 12) ? 'up' : 'down'
// };
// });

// return {
// yearlyTotal: currentYearTotal,
// monthlyAverage: currentYearTotal / 12,
// highestMonth: highest,
// lowestMonth: lowest,
// categoryDistribution: catDist,
// userSpending: [{ user: 'Admin', amount: currentYearTotal, percentage: 100 }], // Placeholder
// paymentMethods: payMethods,
// monthlyComparison: monthlyComparison,
// topCategories: topCategories
// };

// } catch (e) {
// return { error: e.message };
// }
// }

// function getEmptySummary() {
// return {
// yearlyTotal: 0, monthlyAverage: 0, highestMonth: { month: '-', amount: 0 }, lowestMonth: { month: '-', amount: 0 },
// categoryDistribution: [], userSpending: [], paymentMethods: [], monthlyComparison: [], topCategories: []
// };
// }

// /**
//  * Fetches graph data from the 'Data' sheet.
//  * @param {string} type - Graph type (monthly, category, etc.)
//  * @param {string} year - Year filter
//  * @param {string} user - User filter
//  */
// function getGraphsData(type, year, user) {
// try {
// const ss = SpreadsheetApp.openById(MAIN_ID);
// const sheet = ss.getSheetByName("Data");
// if (!sheet) return {}; // Return empty structure

// const data = sheet.getDataRange().getValues();
// const rows = data.slice(1);

// // Filter rows
// const filteredRows = rows.filter(row => {
// const rowDate = new Date(row[2]);
// if (isNaN(rowDate.getTime())) return false;
// return rowDate.getFullYear().toString() === year;
// });

// // 1. Main Chart (Monthly Trend)
// const monthlyData = new Array(12).fill(0);
// MONTHS.forEach((m, i) => {
// monthlyData[i] = filteredRows
// .filter(r => r[3] === m)
// .reduce((sum, r) => sum + (parseFloat(r[5]) || 0), 0);
// });

// const mainChart = {
// labels: MONTHS,
// datasets: [{
// label: 'Monthly Expenses',
// data: monthlyData,
// borderColor: '#4361ee',
// backgroundColor: 'rgba(67, 97, 238, 0.1)',
// fill: true,
// tension: 0.4
// }]
// };

// // 2. Pie Chart (Category)
// const catTotals = {};
// filteredRows.forEach(r => {
// const cat = r[4] || 'Other';
// catTotals[cat] = (catTotals[cat] || 0) + (parseFloat(r[5]) || 0);
// });
// const pieChart = {
// labels: Object.keys(catTotals),
// datasets: [{
// data: Object.values(catTotals),
// backgroundColor: ['#4361ee', '#3a0ca3', '#7209b7', '#f72585', '#4cc9f0', '#fee440', '#9b5de5', '#00bbf9']
// }]
// };

// // 3. Bar Chart (Detailed Monthly)
// const barChart = {
// labels: MONTHS,
// datasets: [{
// label: 'Expenses',
// data: monthlyData,
// backgroundColor: '#3a0ca3'
// }]
// };

// // 4. Detailed Chart (Daily Pattern or Cumulative)
// // Let's do cumulative
// let cumulative = 0;
// const cumulativeData = monthlyData.map(val => {
// cumulative += val;
// return cumulative;
// });
// const detailedChart = {
// labels: MONTHS,
// datasets: [{
// label: 'Cumulative Spending',
// data: cumulativeData,
// borderColor: '#f72585',
// tension: 0.2
// }]
// };

// return {
// mainChart,
// pieChart,
// barChart,
// detailedChart
// };

// } catch (e) {
// return { error: e.message };
// }
// }


