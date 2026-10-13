/*====================================
Expense Tracker Pro: 2026 Backend Code
// ====================================*/

// ✅ Put this at the top of your script (global constants)
const MAIN_ID = "1WK0QOkrz4c7Fl-wvkLKrH1gPODxkF3stvYajR5lVM0M";
const CONSOLIDATED_ID = '1lCkNPBkVABweit6dD-3atsP71O0qsBnbuH1rlvzqtV8';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
let currentUser = null; // Track current user for adding items

/**
 * Logs detailed actions to the Audit__Log sheet for security and tracking.
 */
function logAction(action, details, uniqueId, user) {
    try {
        const ss = SpreadsheetApp.openById(MAIN_ID);
        let auditSheet = ss.getSheetByName("Login");

        if (!auditSheet) {
            auditSheet = ss.insertSheet("Login");
            auditSheet.appendRow(["Timestamp", "Action", "Details", "Affected ID", "User", "Ref", "Name"]);
            auditSheet.setColumnWidth(1, 150);
            auditSheet.setColumnWidth(2, 100);
            auditSheet.setColumnWidth(3, 300);
            auditSheet.setColumnWidth(4, 150);
            auditSheet.setColumnWidth(5, 100);
            auditSheet.setColumnWidth(6, 50);
            auditSheet.setColumnWidth(7, 150);
            auditSheet.getRange("A1:G1").setFontWeight("bold").setBackground("#e0e0e0");
        } else {
            // Check if headers for F and G are missing (in case sheet existed with fewer columns)
            if (auditSheet.getLastColumn() < 7 || auditSheet.getRange("G1").getValue() === "") {
                const headerRange = auditSheet.getRange("F1:G1");
                const values = headerRange.getValues();
                if (values[0][0] === "" || values[0][1] === "") {
                    auditSheet.getRange("F1").setValue("Ref");
                    auditSheet.getRange("G1").setValue("Name");
                    auditSheet.getRange("F1:G1").setFontWeight("bold").setBackground("#e0e0e0");
                    auditSheet.setColumnWidth(6, 50);
                    auditSheet.setColumnWidth(7, 150);
                }
            }
        }

        // Logic to determine name to log
        // If 'user' is provided (usually from frontend), it is likely the Name.
        // If not, try to use currentUser.name, else username.
        const nameToLog = user || (currentUser ? currentUser.name : (currentUser ? currentUser.username : "System/Web"));

        auditSheet.appendRow([
            new Date(),
            action,
            details,
            uniqueId || "N/A",
            user || (currentUser ? currentUser.username : "System/Web"), // Column E: User/Username
            "", // Column F: Ref
            nameToLog // Column G: Name
        ]);

    } catch (e) {
        console.error("Audit Log Error: " + e.message); // Never fail the main action because of logging
    }
}

/**
 * Serves the HTML frontend of the web app.
 * Enhanced with PWA support and data pre-loading for performance.
 */
function doGet(e) {
    const page = (e && e.parameter) ? e.parameter.page : null;

    if (page === 'manifest') {
        return HtmlService.createHtmlOutputFromFile('manifest.json')
            .setMimeType(ContentService.MimeType.JSON);
    }

    if (page === 'sw') {
        return HtmlService.createHtmlOutputFromFile('sw.js')
            .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    if (page === 'syncList' || page === 'updateList' || page === 'fixList') {
        const result = syncAndFixListSheetNow();
        return ContentService.createTextOutput(JSON.stringify(result))
            .setMimeType(ContentService.MimeType.JSON);
    }

    if (page === 'readList') {
        const ss = SpreadsheetApp.openById(MAIN_ID);
        const listSheet = ss.getSheetByName("List");
        const data = listSheet.getRange(1, 1, listSheet.getLastRow(), 5).getValues();
        return ContentService.createTextOutput(JSON.stringify(data))
            .setMimeType(ContentService.MimeType.JSON);
    }

    const template = HtmlService.createTemplateFromFile('Expense Tracker/Index');

    // PRE-LOAD INITIAL DATA (Faster Start)
    try {
        const now = new Date();
        const currentMonth = MONTHS[now.getMonth()];

        // Fetch data in one go
        template.initialData = JSON.stringify({
            month: currentMonth,
            monthlyData: getMonthlyData(currentMonth),
            itemsList: getItemList()
        });
    } catch (err) {
        template.initialData = null;
    }

    return template
        .evaluate()
        .setTitle('Expenses Tracker Pro')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
* Fetches all data from the Data sheet for the reports page in the same format as All Reports.
* @returns {Object} An object containing all expenses with proper formatting.
*/
function getAllData() {
    try {
        let allExpenses = [];
        let allCategories = new Set();
        let uniqueIdSet = new Set(); // To prevent duplicates

        const loadFromSource = (spreadsheetId, sheetName) => {
            try {
                const ss = SpreadsheetApp.openById(spreadsheetId);
                const sheet = ss.getSheetByName(sheetName);
                if (!sheet || sheet.getLastRow() <= 1) return;

                const dataRange = sheet.getDataRange();
                const allValues = dataRange.getValues();
                const headers = allValues[0];
                const rawValues = allValues.slice(1);

                // Dynamically find indices based on headers
                const findIdx = (names) => {
                    for (let name of names) {
                        const idx = headers.findIndex(h => h.toString().toLowerCase().includes(name.toLowerCase()));
                        if (idx !== -1) return idx;
                    }
                    return -1;
                };

                const idxUID = findIdx(['unique', 'uid', 'id']);
                const idxDate = findIdx(['date']);
                const idxMonth = findIdx(['month']);
                const idxItem = findIdx(['item', 'list', 'category']);
                const idxAmount = findIdx(['amount']);
                const idxRemark = findIdx(['remark', 'credit', 'ref']);
                const idxAdmin = findIdx(['admin', 'user', 'tracker']);

                rawValues.forEach((row, index) => {
                    const dateCol = idxDate !== -1 ? row[idxDate] : null;
                    const itemCol = idxItem !== -1 ? row[idxItem] : null;
                    const amtCol = idxAmount !== -1 ? row[idxAmount] : "";

                    if (dateCol && itemCol && amtCol !== "") {
                        const uid = idxUID !== -1 ? (row[idxUID] || '').toString().trim() : '';
                        const rawDate = dateCol;
                        let dateObj;
                        let yearFromDate;
                        let formattedDate;

                        if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
                            dateObj = rawDate;
                            yearFromDate = dateObj.getFullYear();
                            formattedDate = `${MONTHS[dateObj.getMonth()]} ${dateObj.getDate()} ${yearFromDate}`;
                        } else {
                            const dateStr = rawDate.toString();
                            const dateMatch = dateStr.match(/^(\w+)\s+(\d+)(?:\s+(\d{4}))?/);
                            if (dateMatch) {
                                const monthName = dateMatch[1].substring(0, 3);
                                const day = dateMatch[2];
                                const yearFromString = dateMatch[3] || new Date().getFullYear();
                                const monthIndex = MONTHS.findIndex(m => m.toLowerCase() === monthName.toLowerCase());
                                if (monthIndex !== -1) {
                                    yearFromDate = parseInt(yearFromString);
                                    formattedDate = `${MONTHS[monthIndex]} ${day} ${yearFromDate}`;
                                } else {
                                    formattedDate = dateStr;
                                }
                            } else {
                                formattedDate = dateStr;
                            }
                        }

                        if (!yearFromDate) {
                            const yearMatch = rawDate.toString().match(/(\d{4})/);
                            yearFromDate = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
                        }

                        // Filter out years older than 2021 (e.g. invalid date parsing/typos resulting in 2001)
                        if (yearFromDate < 2021) {
                            return;
                        }

                        const amount = typeof amtCol === 'number' ? amtCol : parseFloat(amtCol.toString().replace(/[^\d.-]/g, '')) || 0;

                        let monthName = idxMonth !== -1 ? (row[idxMonth] || '').toString() : '';
                        if (!monthName || !MONTHS.includes(monthName)) {
                            if (dateObj) monthName = MONTHS[dateObj.getMonth()];
                        }

                        const remarkData = idxRemark !== -1 ? (row[idxRemark] || '') : '';
                        const adminData = idxAdmin !== -1 ? (row[idxAdmin] || '') : '';

                        const dedupeKey = uid ? `${uid}|${monthName}|${yearFromDate}` : `${formattedDate}|${monthName}|${itemCol.toString().trim()}|${amount.toFixed(2)}`;
                        if (uniqueIdSet.has(dedupeKey)) return;
                        uniqueIdSet.add(dedupeKey);

                        allExpenses.push([
                            formattedDate,
                            monthName,
                            itemCol,
                            amount,
                            remarkData,
                            yearFromDate.toString(),
                            adminData,
                            uid
                        ]);

                        if (itemCol && itemCol.toString().trim()) {
                            allCategories.add(itemCol.toString().trim());
                        }
                    }
                });
            } catch (e) {
                console.error(`Error loading from ${sheetName} in ${spreadsheetId}: ${e.message}`);
            }
        };

        // Load from both Master (All Years) and current Data sheet
        loadFromSource(CONSOLIDATED_ID, "Master");
        loadFromSource(MAIN_ID, "Data");

        // Sort by date (newest first)
        allExpenses.sort((a, b) => {
            try {
                const dateA = parseDateString(a[0], parseInt(a[5]));
                const dateB = parseDateString(b[0], parseInt(b[5]));
                return dateB - dateA;
            } catch (e) {
                return 0;
            }
        });

        return {
            allExpenses: allExpenses.map(expense => [
                expense[0], // DATE
                expense[1], // MONTH
                expense[2], // ITEM LIST
                parseFloat(expense[3]), // AMOUNT
                expense[4], // CREDIT
                expense[5], // YEAR
                expense[6], // ADMIN
                expense[7]  // UID
            ]),
            uniqueCategories: Array.from(allCategories).sort()
        };
    } catch (e) {
        return { error: e.message };
    }
}

/**
* Fetches all consolidated data from the "Master" sheet for the All Data page.
* @returns {Array<Array<any>>} The consolidated data or an empty array.
*/
function getConsolidatedData() {
    try {
        // First, get the data from getAllData which formats it properly
        const allDataResult = getAllData();

        if (allDataResult.error) {
            console.error("Error in getConsolidatedData:", allDataResult.error);
            return [];
        }

        // Transform the data to match the table format with S.N and Unique ID
        const formattedData = allDataResult.allExpenses.map((row, index) => {
            const sn = index + 1;
            const itemList = row[2];
            // Generate a simple unique ID based on S.N and first word of item
            const uniqueId = `${sn}-${itemList.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '')}`;

            return [
                sn, // S.N
                uniqueId, // Unique ID
                row[0], // DATE
                row[1], // MONTH
                row[2], // ITEM LIST
                row[3], // AMOUNT
                row[4], // CREDIT
                row[6] || 'Expenses Tracker 2021' // ADMIN (use default if empty)
            ];
        });

        return formattedData;

    } catch (e) {
        console.error("Error in getConsolidatedData:", e.message);
        return { error: e.message };
    }
}

/**
* Fetches all data and calculates summary stats for a given month.
* @param {string} month - The name of the sheet (e.g., "Sep").
* @returns {Object} An object containing summary data and table rows.
*/
function getMonthlyData(month) {
    try {
        const ss = SpreadsheetApp.openById(MAIN_ID);
        const sheet = ss.getSheetByName(month);
        if (!sheet) {
            return {
                totalExpenses: 0,
                uniqueCategories: 0,
                daysWithExpenses: 0,
                tableData: []
            };
        }

        const dataRange = sheet.getDataRange();
        if (dataRange.getNumRows() <= 1) {
            return {
                totalExpenses: 0,
                uniqueCategories: 0,
                daysWithExpenses: 0,
                tableData: []
            };
        }

        // Use getDisplayValues for display, getValues for calculations
        const displayValues = dataRange.getDisplayValues().slice(1);
        const rawValues = dataRange.getValues().slice(1);

        // Calculate Summary Stats using raw values for numbers
        const expenses = rawValues.map(row => {
            const amount = row[5];
            return typeof amount === 'number' ? amount : parseFloat(amount) || 0;
        });
        const totalExpenses = expenses.reduce((sum, amount) => sum + amount, 0);

        const categories = displayValues.map(row => row[4]);
        const uniqueCategories = new Set(categories.filter(c => c)).size;

        const dates = displayValues.map(row => row[2]);
        const daysWithExpenses = new Set(dates.filter(d => d)).size;

        return {
            totalExpenses: totalExpenses.toFixed(2),
            uniqueCategories: uniqueCategories,
            daysWithExpenses: daysWithExpenses,
            tableData: displayValues.map((row, index) => {
                // Ensure amount is displayed as number
                const rowCopy = [...row];
                rowCopy[5] = expenses[index];
                // Ensure Admin column exists in return data even if sheet is old
                if (rowCopy.length < 8) {
                    rowCopy[7] = '';
                }
                return rowCopy;
            })
        };
    } catch (e) {
        return {
            error: e.message
        };
    }
}

/**
* Helper function to parse date strings
* @param {string} dateStr - Date string like "Sep 15 2025"
* @param {number} year - Year
* @returns {Date} Date object
*/
function parseDateString(dateStr, year) {
    if (!dateStr) return new Date();

    // Check if it's already a date string with year
    const dateMatch = dateStr.match(/^(\w+)\s+(\d+)(?:\s+(\d{4}))?/);
    if (dateMatch) {
        const monthName = dateMatch[1].substring(0, 3);
        const day = parseInt(dateMatch[2]);
        const yearFromString = dateMatch[3] || year || new Date().getFullYear();

        const monthIndex = MONTHS.findIndex(m =>
            m.toLowerCase() === monthName.toLowerCase()
        );

        if (monthIndex !== -1) {
            return new Date(parseInt(yearFromString), monthIndex, day);
        }
    }

    // Try standard Date parsing
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
        return date;
    }

    return new Date();
}

/**
* Generates a unique ID in the format "S.N-ItemList"
* @param {number} sn - The serial number
* @param {string} itemList - The item list/category
* @returns {string} The formatted unique ID
*/
function generateUniqueId(sn, itemList) {
    const cleanItem = itemList.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '');
    return `${sn}-${cleanItem}`;
}

/**
* Fetches unique item names from column B of the "List" sheet
* @returns {Array<string>} Array of unique item names
*/
function getItemList() {
    try {
        ensureListSheet();
        const ss = SpreadsheetApp.openById(MAIN_ID);
        const sheet = ss.getSheetByName("List");
        if (!sheet) {
            return [];
        }

        const dataRange = sheet.getDataRange();
        if (dataRange.getNumRows() <= 1) {
            return [];
        }

        // Get all values from column B (index 1)
        const values = dataRange.getValues();
        const itemsColumn = values.slice(1).map(row => row[1]);

        // Filter out empty values and duplicates, then sort
        const uniqueItems = [...new Set(itemsColumn.filter(item => item && item.toString().trim()))]
            .map(item => item.toString().trim())
            .sort();

        return uniqueItems;
    } catch (e) {
        Logger.log('Error in getItemList: ' + e.message);
        return [];
    }
}

/**
* Ensures a sheet exists and has headers with proper formatting
* @param {string} sheetName - Name of the sheet
* @param {Array} headers - Array of header names
* @returns {Sheet} The sheet object
*/
function ensureSheetExists(ss, sheetName, headers) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.appendRow(headers);

        // Format header row
        const headerRange = sheet.getRange(1, 1, 1, headers.length);
        headerRange.setFontWeight("bold");
        headerRange.setBackground("#f0f0f0");

        // Set column widths
        sheet.setColumnWidth(1, 50);  // S.N
        sheet.setColumnWidth(2, 150); // Unique ID
        sheet.setColumnWidth(3, 100); // Date
        sheet.setColumnWidth(4, 80);  // Month
        sheet.setColumnWidth(5, 200); // Item List
        sheet.setColumnWidth(6, 100); // Amount
        sheet.setColumnWidth(7, 150); // Credit & Remark
        sheet.setColumnWidth(8, 150); // Admin

        // Pre-format the amount column as number
        const amountCol = sheet.getRange(2, 6, sheet.getMaxRows() - 1, 1);
        amountCol.setNumberFormat("###0");
    }
    return sheet;
}

/**
* Ensures the Trash sheet exists with proper headers and formatting.
* @param {Spreadsheet} ss - The spreadsheet object
* @returns {Sheet} The Trash sheet
*/
function ensureTrashSheet(ss) {
    const headers = ["S.N", "Unique ID", "Date", "Month", "Item List", "Amount", "Credit & Remark", "Admin", "Deleted By", "Deleted At", "Original Month"];
    let sheet = ss.getSheetByName("Trash");
    if (!sheet) {
        sheet = ss.insertSheet("Trash");
        sheet.appendRow(headers);

        // Format header row
        const headerRange = sheet.getRange(1, 1, 1, headers.length);
        headerRange.setFontWeight("bold");
        headerRange.setBackground("#f0f0f0");

        // Set column widths
        sheet.setColumnWidth(1, 50);   // S.N
        sheet.setColumnWidth(2, 150);  // Unique ID
        sheet.setColumnWidth(3, 100);  // Date
        sheet.setColumnWidth(4, 80);   // Month
        sheet.setColumnWidth(5, 200);  // Item List
        sheet.setColumnWidth(6, 100);  // Amount
        sheet.setColumnWidth(7, 150);  // Credit & Remark
        sheet.setColumnWidth(8, 150);  // Admin
        sheet.setColumnWidth(9, 150);  // Deleted By
        sheet.setColumnWidth(10, 150); // Deleted At
        sheet.setColumnWidth(11, 120); // Original Month

        // Pre-format the amount column as number
        const amountCol = sheet.getRange(2, 6, sheet.getMaxRows() - 1, 1);
        amountCol.setNumberFormat("###0");
    }
    return sheet;
}

/**
* Adds a new expense entry or updates an existing one.
* @param {Object} entryData - The data for the new row.
* @returns {Object} A success or error message.
*/
function addEntry(entryData) {
    try {
        // Check if it's an update operation
        if (entryData.uniqueId) {
            return updateEntry(entryData);
        }

        // Parse the date safely to prevent timezone shifts
        let date;
        if (typeof entryData.date === 'string' && entryData.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const parts = entryData.date.split('-');
            date = new Date(parts[0], parts[1] - 1, parts[2]);
        } else {
            date = new Date(entryData.date);
        }

        const monthName = MONTHS[date.getMonth()];
        const year = date.getFullYear();
        const dayStr = date.getDate().toString().padStart(2, '0');
        const formattedDate = `${monthName} ${date.getDate()}, ${year}`;

        const ss = SpreadsheetApp.openById(MAIN_ID);
        const sheet = ensureSheetExists(ss, monthName, ["S.N", "Unique ID", "Date", "Month", "Item List", "Amount", "Credit & Remark", "Admin"]);
        const lastRow = sheet.getLastRow();
        const sn = lastRow;
        const newUniqueId = generateUniqueId(sn, entryData.itemList);

        // Convert amount to number
        const amount = parseFloat(entryData.amount) || 0;

        const newRow = [
            sn,
            newUniqueId,
            formattedDate,
            monthName,
            entryData.itemList,
            amount,  // This is now a number
            entryData.credit, // Now Credit & Remark
            entryData.user   // Admin name
        ];

        sheet.appendRow(newRow);

        // Update the consolidated "Data" sheet as well
        const consolidatedSheet = ensureSheetExists(ss, "Data", ["S.N", "Unique ID", "Date", "Month", "Item List", "Amount", "Credit & Remark", "Admin"]);
        const consolidatedLastRow = consolidatedSheet.getLastRow();
        consolidatedSheet.appendRow([
            consolidatedLastRow,
            newUniqueId,
            formattedDate,
            monthName,
            entryData.itemList,
            amount,  // This is now a number
            entryData.credit,
            entryData.user
        ]);

        // Log the creation
        const userForLog = entryData.user || (currentUser ? currentUser.username : "System/Web");
        logAction("CREATE", `Added entry: ${entryData.itemList} (${amount})`, newUniqueId, userForLog);

        return {
            success: true
        };
    } catch (e) {
        return {
            error: e.message
        };
    }
}

/**
* Fetches an entry by its Unique ID and month.
* @param {string} uniqueId - The unique ID of the row.
* @param {string} month - The month of the entry.
* @returns {Array<any>} The row data or null if not found.
*/
function getEntryByUniqueId(uniqueId, month) {
    try {
        const ss = SpreadsheetApp.openById(MAIN_ID);
        const sheet = ss.getSheetByName(month);
        if (!sheet) return null;

        const data = sheet.getDataRange().getValues();
        const foundRow = data.find(row => String(row[1]).trim() === String(uniqueId).trim());

        if (foundRow) {
            // Format amount as number
            const formattedRow = [...foundRow];
            if (formattedRow[5]) {
                formattedRow[5] = parseFloat(formattedRow[5]) || 0;
            }
            return formattedRow;
        }

        return null;
    } catch (e) {
        return null;
    }
}

/**
* Updates an existing entry based on its Unique ID.
* @param {Object} entryData - The updated data for the row.
* @returns {Object} A success or error message.
*/
function updateEntry(entryData) {
    try {
        // Parse the date safely to prevent timezone shifts
        let date;
        if (typeof entryData.date === 'string' && entryData.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const parts = entryData.date.split('-');
            date = new Date(parts[0], parts[1] - 1, parts[2]);
        } else {
            date = new Date(entryData.date);
        }

        const monthName = MONTHS[date.getMonth()];
        const year = date.getFullYear();
        const dayStr = date.getDate().toString().padStart(2, '0');
        const formattedDate = `${monthName} ${date.getDate()}, ${year}`;

        // Convert amount to number
        const amount = parseFloat(entryData.amount) || 0;

        const ss = SpreadsheetApp.openById(MAIN_ID);

        // Check if the month has changed
        // entryData.month is the OLD month (sheet), monthName is the NEW month
        if (entryData.month && entryData.month !== monthName) {
            // --- CASE 1: Month Changed (Move Entry) ---

            // 1. Add to NEW sheet FIRST (Transactional Safety)
            const newSheet = ensureSheetExists(ss, monthName, ["S.N", "Unique ID", "Date", "Month", "Item List", "Amount", "Credit & Remark", "Admin"]);
            const lastRow = newSheet.getLastRow();

            // Generate new S.N if needed, or append to end
            const sn = lastRow;

            const newRow = [
                sn, // New S.N based on new sheet
                entryData.uniqueId, // Keep same Unique ID
                formattedDate,
                monthName,
                entryData.itemList,
                amount,
                entryData.credit,
                entryData.user
            ];

            newSheet.appendRow(newRow);

            // Verify row was added (Transactional check)
            if (newSheet.getLastRow() === lastRow) {
                throw new Error("Transactional Error: Failed to write to new month sheet. Aborting delete from old sheet.");
            }

            // Number formatting is pre-applied via ensureSheetExists

            // 2. Delete from OLD sheet (Only after successful add)
            const oldSheet = ss.getSheetByName(entryData.month);
            if (oldSheet) {
                const oldData = oldSheet.getDataRange().getValues();
                const rowToDelete = oldData.findIndex(row => String(row[1]).trim() === String(entryData.uniqueId).trim());
                if (rowToDelete > -1) {
                    oldSheet.deleteRow(rowToDelete + 1);
                }
            }

            logAction("MOVE", `Moved from ${entryData.month} to ${monthName}`, entryData.uniqueId, entryData.user);

        } else {
            // --- CASE 2: Month Same (Update in place) ---
            const sheet = ss.getSheetByName(entryData.month);
            if (!sheet) throw new Error(`Sheet "${entryData.month}" not found.`);

            // Get all values to find the row index
            const data = sheet.getDataRange().getValues();
            const rowIndexToUpdate = data.findIndex(row => String(row[1]).trim() === String(entryData.uniqueId).trim());

            if (rowIndexToUpdate > -1) {
                const updatedRow = [
                    data[rowIndexToUpdate][0], // Keep the same S.N
                    entryData.uniqueId,
                    formattedDate,
                    monthName,
                    entryData.itemList,
                    amount,  // This is now a number
                    entryData.credit,
                    entryData.user
                ];

                // Update the row in the month-specific sheet
                sheet.getRange(rowIndexToUpdate + 1, 1, 1, updatedRow.length).setValues([updatedRow]);

                // Number formatting is pre-applied via ensureSheetExists

                logAction("UPDATE", `Updated entry details`, entryData.uniqueId, entryData.user);

            } else {
                return { error: "Entry not found in source sheet." };
            }
        }

        // --- Update Consolidated Sheet (Always Check & Update) ---
        // Use try-catch for consolidated update so it doesn't fail the main update
        try {
            const consolidatedSheet = ss.getSheetByName("Data");
            if (consolidatedSheet) {
                const consolidatedData = consolidatedSheet.getDataRange().getValues();
                const consolidatedRowIndex = consolidatedData.findIndex(row => String(row[1]).trim() === String(entryData.uniqueId).trim());

                const consolidatedRowValues = [
                    (consolidatedRowIndex > -1) ? consolidatedData[consolidatedRowIndex][0] : consolidatedSheet.getLastRow(),
                    entryData.uniqueId,
                    formattedDate,
                    monthName,
                    entryData.itemList,
                    amount,
                    entryData.credit,
                    entryData.user
                ];

                if (consolidatedRowIndex > -1) {
                    consolidatedSheet.getRange(consolidatedRowIndex + 1, 1, 1, consolidatedRowValues.length).setValues([consolidatedRowValues]);
                }
            }
        } catch (e) {
            console.error("Consolidated update failed: " + e.message);
        }

        return { success: true };

    } catch (e) {
        return { error: e.message };
    }
}


/**
* Deletes an entry based on its Unique ID from both sheets.
* This version performs a hard delete from the current month and Data sheets.
* @param {string} uniqueId - The unique ID of the row to delete.
* @param {string} month - The sheet name.
* @returns {Object} A success or error message.
*/
function deleteEntry(uniqueId, month, user) {
    try {
        const ss = SpreadsheetApp.openById(MAIN_ID);
        const sheet = ss.getSheetByName(month);
        if (!sheet) throw new Error(`Sheet "${month}" not found.`);

        const dataRange = sheet.getDataRange();
        const displayData = dataRange.getDisplayValues();

        // Find row by comparing display values (safer for client-side strings)
        const rowIndexToDelete = displayData.findIndex((row, idx) => {
            return idx > 0 && String(row[1]).trim() === String(uniqueId).trim();
        });

        if (rowIndexToDelete > -1) {
            // --- Move to Trash before deleting ---
            try {
                const trashSheet = ensureTrashSheet(ss);
                const rowData = dataRange.getValues()[rowIndexToDelete];

                // Construct trash row: [Original 8 columns] + [Deleted By, Deleted At, Original Month]
                const trashRow = [
                    ...rowData.slice(0, 8),
                    user || "System/Unknown",
                    new Date(),
                    month
                ];

                trashSheet.appendRow(trashRow);
            } catch (trashErr) {
                console.error("Failed to move entry to Trash:", trashErr);
                // We still proceed with deletion even if trash fails, or should we?
                // The user specifically asked for this, so maybe we should stop if it fails?
                // For now, let's just log it and proceed.
            }

            sheet.deleteRow(rowIndexToDelete + 1);

            // Delete from the consolidated "Data" sheet as well
            const consolidatedSheet = ss.getSheetByName("Data");
            if (consolidatedSheet) {
                const consolidatedData = consolidatedSheet.getDataRange().getDisplayValues();
                const consolidatedRowIndex = consolidatedData.findIndex((row, idx) => {
                    return idx > 0 && String(row[1]).trim() === String(uniqueId).trim();
                });
                if (consolidatedRowIndex > -1) {
                    consolidatedSheet.deleteRow(consolidatedRowIndex + 1);
                }
            }

            // Ensure changes are written before returning
            SpreadsheetApp.flush();

            // Log the action
            try {
                logAction("DELETE", `Deleted record ${uniqueId} from ${month}`, uniqueId, user);
            } catch (logErr) {
                console.warn("Log failed:", logErr);
            }

            return { success: true };
        }

        return { error: `Entry ${uniqueId} not found in ${month} sheet.` };
    } catch (e) {
        console.error("Delete backend error:", e);
        return { error: e.message };
    }
}

/**
 * Restores an entry from the Trash sheet back to its original month sheet.
 * (Kept for compatibility with existing Trash data)
 */
function restoreEntry(uniqueId) {
    try {
        const ss = SpreadsheetApp.openById(MAIN_ID);
        const trashSheet = ss.getSheetByName("Trash");
        if (!trashSheet) return { error: "Trash sheet not found." };

        const trashData = trashSheet.getDataRange().getValues();
        const rowIdx = trashData.findIndex((row, idx) =>
            idx > 0 && String(row[1]).trim() === String(uniqueId).trim()
        );

        if (rowIdx === -1) return { error: `Entry ${uniqueId} not found in Trash.` };

        const trashRow = trashData[rowIdx];
        const origMonth = String(trashRow[10]).trim(); // col 11 = Original Month
        const origRowData = trashRow.slice(0, 8);       // cols 1-8 = original entry

        // ── Restore to original month sheet ───────────────────────────────────
        const destSheet = ensureSheetExists(ss, origMonth, [
            "S.N", "Unique ID", "Date", "Month", "Item List",
            "Amount", "Credit & Remark", "Admin"
        ]);
        destSheet.appendRow(origRowData);

        // ── Restore to Data sheet ─────────────────────────────────────────────
        const dataSheet = ss.getSheetByName("Data");
        if (dataSheet) {
            dataSheet.appendRow(origRowData);
        }

        // ── Remove from Trash ─────────────────────────────────────────────────
        trashSheet.deleteRow(rowIdx + 1);
        SpreadsheetApp.flush();

        try {
            logAction("RESTORE", `Restored ${uniqueId} to ${origMonth}`, uniqueId, "System");
        } catch (e) { /* ignore */ }

        return { success: true, month: origMonth };

    } catch (e) {
        console.error("restoreEntry error:", e);
        return { error: e.message };
    }
}

/**
 * Returns all rows currently in the Trash sheet.
 */
function getTrashData() {
    try {
        const ss = SpreadsheetApp.openById(MAIN_ID);
        const trashSheet = ss.getSheetByName("Trash");
        if (!trashSheet || trashSheet.getLastRow() <= 1) return [];

        const values = trashSheet.getDataRange().getValues().slice(1); // skip header
        return values.map(row => ({
            sn: row[0],
            uniqueId: row[1],
            date: row[2] ? row[2].toString() : "",
            month: row[3],
            item: row[4],
            amount: parseFloat(row[5]) || 0,
            credit: row[6],
            admin: row[7],
            deletedBy: row[8],
            deletedAt: row[9] ? row[9].toString() : "",
            origMonth: row[10]
        }));
    } catch (e) {
        return [];
    }
}

/**
* Authenticates Admin from the "Admin" sheet
* @param {string} username - The username to authenticate
* @param {string} password - The password to verify
* @returns {Object} Authentication result with user details or error message
*/
function checkLogin(username, password) {
    try {
        const ss = SpreadsheetApp.openById(MAIN_ID);
        let AdminSheet = ss.getSheetByName("Admin");

        if (!AdminSheet) {
            // Create a default Admin sheet if it doesn't exist
            AdminSheet = ss.insertSheet("Admin");
            AdminSheet.appendRow(["Username", "Password", "Name", "Role", "Email", "Last Update"]);
            AdminSheet.appendRow(["Anil Chahar", "4566", "Anil Chahar", "Admin", "automationbyanil@gmail.com", new Date()]);
            AdminSheet.appendRow(["Radhika", "4566", "Radhika Chahar", "User", "aniratha32@gmail.com", new Date()]);

            // Format header
            const headerRange = AdminSheet.getRange(1, 1, 1, 6);
            headerRange.setFontWeight("bold");
            headerRange.setBackground("#f0f0f0");

            // Set column widths
            AdminSheet.setColumnWidth(1, 120); // Username
            AdminSheet.setColumnWidth(2, 100); // Password
            AdminSheet.setColumnWidth(3, 120); // Name
            AdminSheet.setColumnWidth(4, 100); // Role
            AdminSheet.setColumnWidth(5, 200); // Email
            AdminSheet.setColumnWidth(6, 150); // Last Update
        }

        const dataRange = AdminSheet.getDataRange();
        if (dataRange.getNumRows() <= 1) {
            return {
                success: false,
                message: "No Admin configured in the Admin sheet"
            };
        }

        // Get all user data starting from row 2 (skip header)
        const AdminData = dataRange.getValues().slice(1);
        const headers = dataRange.getValues()[0].map(h => h.toString().trim());

        const usernameIdx = headers.indexOf("Username") !== -1 ? headers.indexOf("Username") : 0;
        const passwordIdx = headers.indexOf("Password") !== -1 ? headers.indexOf("Password") : 1;
        const nameIdx = headers.indexOf("Name") !== -1 ? headers.indexOf("Name") : 2;
        const roleIdx = headers.indexOf("Role") !== -1 ? headers.indexOf("Role") : 3;
        const emailIdx = headers.indexOf("Email");
        const lastUpdateIdx = headers.indexOf("Last Update") !== -1 ? headers.indexOf("Last Update") : 5;

        // Search for the username
        for (let i = 0; i < AdminData.length; i++) {
            const userRow = AdminData[i];
            const storedUsername = userRow[usernameIdx] ? userRow[usernameIdx].toString().trim() : "";
            const storedPassword = userRow[passwordIdx] ? userRow[passwordIdx].toString().trim() : "";
            const storedName = userRow[nameIdx] ? userRow[nameIdx].toString().trim() : storedUsername;
            const storedRole = userRow[roleIdx] ? userRow[roleIdx].toString().trim() : "User";
            const storedEmail = emailIdx !== -1 && userRow[emailIdx] ? userRow[emailIdx].toString().trim() : "automationbyanil@gmail.com";

            if (storedUsername.toLowerCase() === username.toLowerCase()) {
                if (storedPassword === password) {
                    // Update last login time
                    AdminSheet.getRange(i + 2, lastUpdateIdx + 1).setValue(new Date());

                    // Set current user
                    currentUser = {
                        username: storedUsername,
                        name: storedName,
                        role: storedRole,
                        email: storedEmail
                    };

                    return {
                        success: true,
                        name: storedName,
                        role: storedRole,
                        username: storedUsername,
                        email: storedEmail
                    };
                } else {
                    return {
                        success: false,
                        message: "Invalid password"
                    };
                }
            }
        }

        return {
            success: false,
            message: "Username not found"
        };

    } catch (e) {
        Logger.log('Error in checkLogin: ' + e.message);
        return {
            success: false,
            message: "Authentication error: " + e.message
        };
    }
}

function initializeSpreadsheet() {
    const ss = SpreadsheetApp.openById(MAIN_ID);

    // Create month sheets
    MONTHS.forEach(month => {
        ensureSheetExists(ss, month, ["S.N", "Unique ID", "Date", "Month", "Item List", "Amount", "Credit"]);
    });

    // Create consolidated "Data" sheet
    ensureSheetExists(ss, "Data", ["S.N", "Unique ID", "Date", "Month", "Item List", "Amount", "Credit"]);

    // Create or ensure Admin sheet exists with Last Update column
    const AdminSheet = ensureSheetExists(ss, "Admin", ["Username", "Password", "Name", "Role", "Last Update"]);

    // If the sheet was just created, add default Admin with current date
    if (AdminSheet.getLastRow() === 1) {
        AdminSheet.appendRow(["Anil Chahar", "4566", "Anil Chahar", "Admin", new Date()]);
        AdminSheet.appendRow(["Radhika", "4566", "Radhika Chahar", "User", new Date()]);
    }

    // Create or ensure List sheet exists
    ensureListSheet();

    // Create or ensure Trash sheet exists
    ensureTrashSheet(ss);

    // Delete the default sheet if it exists
    const defaultSheet = ss.getSheetByName("Sheet1");
    if (defaultSheet && ss.getSheets().length > 1) {
        ss.deleteSheet(defaultSheet);
    }
}

/**
* Ensures List sheet exists with proper structure
*/
function ensureListSheet() {
    const ss = SpreadsheetApp.openById(MAIN_ID);
    let listSheet = ss.getSheetByName("List");

    if (!listSheet) {
        listSheet = ss.insertSheet("List");
        // Add headers
        listSheet.appendRow(["ID", "Item Name", "Category", "Date Added", "Added By"]);

        // Format header
        const headerRange = listSheet.getRange(1, 1, 1, 5);
        headerRange.setFontWeight("bold");
        headerRange.setBackground("#f0f0f0");

        // Set column widths
        listSheet.setColumnWidth(1, 50);   // ID
        listSheet.setColumnWidth(2, 200);  // Item Name
        listSheet.setColumnWidth(3, 100);  // Category
        listSheet.setColumnWidth(4, 120);  // Date Added
        listSheet.setColumnWidth(5, 100);  // Added By
    }

    // Check if the sheet needs to be updated/populated with the new list of categories
    const dataRange = listSheet.getDataRange();
    let values = [];
    if (dataRange.getNumRows() > 1) {
        values = dataRange.getValues().slice(1).map(row => row[1]);
    }

    // Check for new categories (e.g. 🍎 Fruit) or if list has 7 or fewer rows (old default template)
    const hasFruit = values.some(item => item && (item.includes('🍎 Fruit') || item.includes('Fruit')));

    if (!hasFruit || values.length <= 7) {
        // Clear all data rows except header
        if (listSheet.getLastRow() > 1) {
            listSheet.getRange(2, 1, listSheet.getLastRow() - 1, 5).clearContent();
        }

        const newItems = [
            ['🍎 Fruit', 'Food'],
            ['🍕 Food', 'Food'],
            ['🥤 Coldrink', 'Food'],
            ['🛺 Auto', 'Transport'],
            ['🚇 Metro', 'Transport'],
            ['🍦 Ice Cream', 'Food'],
            ['🥦 Vegetables', 'Food'],
            ['🥛 Milk', 'Food'],
            ['🍿 Snacks', 'Food'],
            ['🛒 Grocery', 'Food'],
            ['💊 Medicine', 'Medical'],
            ['🩺 Doctor Fees', 'Medical'],
            ['💊 Medicines', 'Medical'],
            ['🔬 Pathology Test', 'Medical'],
            ['🚼 Baby Diaper', 'Baby Care'],
            ['🍼 Bottle', 'Baby Care'],
            ['👶 Rudra Baby 6 Months', 'Baby Care'],
            ['🪔 Durga Pooja', 'Festivals'],
            ['🪔 Diwali', 'Festivals'],
            ['🎨 Holi', 'Festivals'],
            ['🌕 Karvachauth', 'Festivals'],
            ['🏫 School Stationary', 'Education'],
            ['🪭 Fan', 'Electronics'],
            ['🪭 Electric Fan', 'Electronics'],
            ['📺 TV', 'Electronics'],
            ['🧪 Medical Test', 'Medical'],
            ['🏥 ICU Care', 'Medical'],
            ['⛽ Petrol', 'Transport'],
            ['🥤 Juice', 'Food'],
            ['💇 Hair Color', 'Personal Care'],
            ['✂️ Hair Cut', 'Personal Care'],
            ['📱 Recharge', 'Bills'],
            ['🛍️ Shopping', 'Shopping'],
            ['🤖 AI', 'Other'],
            ['🏠Room Rent', 'Bills'],
            ['🔥 Lighter', 'Other'],
            ['🏠10000 Rent+3000 Security', 'Bills'],
            ['🧺 Surf', 'Personal Care']
        ];

        newItems.forEach(([item, category], index) => {
            listSheet.appendRow([
                index + 1,
                item,
                category,
                new Date(),
                'System'
            ]);
        });

        // Update validation rules across the spreadsheet
        try {
            updateDataValidationForItemList();
        } catch (e) {
            Logger.log('Validation update error: ' + e.message);
        }
    }

    // Auto-enrich any items missing emoji icons or categories in the List sheet
    autoEnrichMissingCategoriesAndIcons(ss, listSheet);

    return listSheet;
}

/**
 * Infer category name based on item keywords
 */
/**
 * Infer category name based on item keywords
 */
function inferCategoryForItem(itemName) {
    if (!itemName) return "General";
    const lower = itemName.toLowerCase().trim();
    if (/rudra|baby|diaper|cushion|cradle|infant|toddler|cerelac|nan pro/i.test(lower)) return "Baby Care";
    if (/durga|pooja|puja|diwali|iwali|deepawali|deepavali|holi|karvachauth|karwa\s*chauth|karva\s*chauth|navratri|festival|mandir|temple|rakhi|katha|ganesh/i.test(lower)) return "Festivals";
    if (/school|station|book|notebook|admission|tuition|exam|paper|print\s*out/i.test(lower)) return "Education";
    if (/fan|cooler|ac|air conditioner|refrigerator|fridge|tv|television|washing machine|geyser|microwave|iron|heater|eelctic|battery|cell|switch/i.test(lower)) return "Electronics";
    if (/fruit|vegetable|food|milk|snack|grocery|juice|bread|cake|sweet|dairy|curd|paneer|coffee|oil/i.test(lower)) return "Food";
    if (/petrol|fuel|auto|metro|taxi|cab|bus|train|flight|transport|engine|service/i.test(lower)) return "Transport";
    if (/medicine|doctor|medical|hospital|clinic|test|icu|ultrasound|sanitary|vaccin/i.test(lower)) return "Medical";
    if (/recharge|bill|wifi|fiber|electricity|rent|room rent|sbi|axis|axix|office\s*365|bulb|locker/i.test(lower)) return "Bills";
    if (/shopping|clothes|sari|saari|shirt|pant|shoes|slippers|amazon|vishal\s*mart|jewellery|nagrela|strap|cover|belt/i.test(lower)) return "Shopping";
    if (/hair|ahir|shaving|surf|soap|personal|cream|barber|salon|toothpaste|radhika/i.test(lower)) return "Personal Care";
    if (/movie|birthday|reception|fair/i.test(lower)) return "Entertainment";
    if (/home|labour|folding\s*bed|tap|lighter|cups\s*&\s*plates|repellent/i.test(lower)) return "Household Utilities";
    return "Other";
}

/**
 * Infer icon string based on item keywords
 */
function inferIconForItem(itemName) {
    if (!itemName) return "";
    const lower = itemName.toLowerCase().trim();
    if (/rudra.*baby|baby.*6\s*month|rudra/i.test(lower)) return "👶 Rudra Baby 6 Months";
    if (/durga.*pooja|durga.*puja|durga/i.test(lower)) return "🪔 Durga Pooja";
    if (/diwali|iwali|deepawali|deepavali/i.test(lower)) return "🪔 Diwali";
    if (/holi|dhuleti|rangwali/i.test(lower)) return "🎨 Holi";
    if (/karvachauth|karwa\s*chauth|karva\s*chauth/i.test(lower)) return "🌕 Karvachauth";
    if (/school.*station/i.test(lower)) return "🏫 School Stationary";
    if (/ahir.*cut|hair.*cut|haircut/i.test(lower)) return "✂️ Hair Cut";
    if (/eelctic.*fan|electic.*fan|electric.*fan/i.test(lower)) return "🪭 Electric Fan";
    if (/^fan\b|table\s*fan|ceiling\s*fan|exhaust\s*fan/i.test(lower)) return "🪭 Fan";
    if (/\btv\b|television|smart\s*tv|led\s*tv|samsung\s*tv/i.test(lower)) return "📺 TV";
    if (/electric\s*switch|switch/i.test(lower)) return "🔌 Electric Switch";
    if (/^engine\b/i.test(lower)) return "⚙️ Engine";
    if (/^fair\b/i.test(lower)) return "🎡 Fair";
    if (/feb.*mar/i.test(lower)) return "📅 Feb 2026 - Mar 2026";
    if (/ganesh/i.test(lower)) return "🪔 Ganesh Chaturthi Celebration";
    if (/^home\b/i.test(lower)) return "🏠 Home";
    if (/katha/i.test(lower)) return "🪔 Katha";
    if (/labour|labor/i.test(lower)) return "🛠️ Labour Charges";
    if (/money.*₹?1500/i.test(lower)) return "💵 Money ₹1500";
    if (/money\s*distribution/i.test(lower)) return "💸 Money Distribution";
    if (/^paper/i.test(lower)) return "📄 Papers";
    if (/radhika.*rudra/i.test(lower)) return "👩‍👦 Radhika Chahar + Rudra Chahar";
    if (/watch\s*strap|strap/i.test(lower)) return "⌚ Redmi Watch Strap";
    if (/baby.*diaper|diaper/i.test(lower)) return "🚼 Baby Diaper";
    if (/baby/i.test(lower)) return "👶 " + itemName;
    if (/pooja|puja/i.test(lower)) return "🪔 " + itemName;
    if (/stationary|stationery/i.test(lower)) return "📚 " + itemName;
    return "";
}

/**
 * Automatically enriches and updates items that are missing category icons/emojis
 * or missing categories in the "List" sheet and across month sheets.
 */
function autoEnrichMissingCategoriesAndIcons(ss, listSheet, forceOverride) {
    try {
        const lastRow = listSheet.getLastRow();
        if (lastRow <= 1) return { updatedCount: 0, totalRows: 0 };

        const range = listSheet.getRange(2, 1, lastRow - 1, 5);
        const data = range.getValues();
        let sheetUpdated = false;
        let updatedCount = 0;
        const nameReplacements = {};

        const specificRules = [
            // Baby Care
            { pattern: /rudra.*6|baby.*6.*month/i, exactName: '👶 Rudra Baby 6 Months', category: 'Baby Care' },
            { pattern: /rudra.*celebration/i, exactName: '👶 Rudra Baby 6 Months Celebration', category: 'Baby Care' },
            { pattern: /radhika.*rudra/i, exactName: '👩‍👦 Radhika Chahar + Rudra Chahar', category: 'Baby Care' },
            { pattern: /baby.*diaper|diaper/i, exactName: '🚼 Baby Diaper', category: 'Baby Care' },
            { pattern: /baby.*carrier|carrier.*belt/i, exactName: '🚼 Baby Carrier Belt', category: 'Baby Care' },
            { pattern: /baby.*cushion|sleeping.*cushion/i, exactName: '🛏️ Baby Sleeping Cushion', category: 'Baby Care' },
            { pattern: /cradle/i, exactName: '🛏️ Cradle', category: 'Baby Care' },
            { pattern: /baby.*oil/i, exactName: '💊 Baby Oil', category: 'Baby Care' },
            { pattern: /bottle/i, exactName: '🍼 Bottle', category: 'Baby Care' },
            { pattern: /shopping.*rudra/i, exactName: '🛍️ Shopping Rudra', category: 'Baby Care' },

            // Festivals
            { pattern: /durga.*pooja|durga.*puja|durga/i, exactName: '🪔 Durga Pooja', category: 'Festivals' },
            { pattern: /diwali|iwali|deepawali|deepavali/i, exactName: '🪔 Diwali', category: 'Festivals' },
            { pattern: /holi|dhuleti|rangwali/i, exactName: '🎨 Holi', category: 'Festivals' },
            { pattern: /karvachauth|karwa.*chauth|karva.*chauth/i, exactName: '🌕 Karvachauth', category: 'Festivals' },
            { pattern: /ganesh.*chaturthi/i, exactName: '🪔 Ganesh Chaturthi Celebration', category: 'Festivals' },
            { pattern: /rakhi/i, exactName: '🎀 Rakhi', category: 'Festivals' },
            { pattern: /katha.*items/i, exactName: '🛒 Katha Items', category: 'Festivals' },
            { pattern: /^katha$|katha/i, exactName: '🪔 Katha', category: 'Festivals' },
            { pattern: /decoration/i, exactName: '🎉 Decoration', category: 'Festivals' },

            // Education
            { pattern: /school.*station/i, exactName: '🏫 School Stationary', category: 'Education' },
            { pattern: /school.*book|school.*books/i, exactName: '📚 School Books', category: 'Education' },
            { pattern: /school.*activity.*fees/i, exactName: '🏫 School Activity Fees', category: 'Education' },
            { pattern: /school.*activity/i, exactName: '🏫 School Activity', category: 'Education' },
            { pattern: /school.*dress/i, exactName: '🏫 School Dress', category: 'Education' },
            { pattern: /school.*exam/i, exactName: '🏫 School Exam Fees', category: 'Education' },
            { pattern: /school.*fees.*apr/i, exactName: '🏫 School Fees Apr', category: 'Education' },
            { pattern: /school.*fees.*jul/i, exactName: '🏫 School Fees Jul', category: 'Education' },
            { pattern: /school.*fees.*jun/i, exactName: '🏫 School Fees Jun', category: 'Education' },
            { pattern: /school.*fees.*may/i, exactName: '🏫 School Fees May', category: 'Education' },
            { pattern: /school.*transport/i, exactName: '🏫 School Transportation', category: 'Education' },
            { pattern: /^school$/i, exactName: '🏫 School', category: 'Education' },
            { pattern: /notebook/i, exactName: '📓 Notebook', category: 'Education' },
            { pattern: /print.*out/i, exactName: '🖨️ Print Out', category: 'Education' },
            { pattern: /^papers$/i, exactName: '📄 Papers', category: 'Education' },

            // Electronics & Appliances
            { pattern: /eelctic.*fan|electic.*fan|electric.*fan/i, exactName: '🪭 Electric Fan', category: 'Electronics' },
            { pattern: /^fan$|ceiling.*fan|table.*fan|exhaust.*fan/i, exactName: '🪭 Fan', category: 'Electronics' },
            { pattern: /^tv$|television|smart.*tv|led.*tv/i, exactName: '📺 TV', category: 'Electronics' },
            { pattern: /battery/i, exactName: '🔋 Battery', category: 'Electronics' },
            { pattern: /^cell$/i, exactName: '🔋 Cell', category: 'Electronics' },
            { pattern: /electric.*switch|switch/i, exactName: '🔌 Electric Switch', category: 'Electronics' },

            // Medical & Health
            { pattern: /icu.*care/i, exactName: '🏥 ICU Care', category: 'Medical' },
            { pattern: /ultrasound/i, exactName: '🏥 Ultrasound', category: 'Medical' },
            { pattern: /pathology.*test/i, exactName: '🔬 Pathology Test', category: 'Medical' },
            { pattern: /medical.*test/i, exactName: '🧪 Medical Test', category: 'Medical' },
            { pattern: /medical.*powder/i, exactName: '💊 Medical Powder', category: 'Medical' },
            { pattern: /doctor.*fees/i, exactName: '🩺 Doctor Fees', category: 'Medical' },
            { pattern: /medical.*vaccination|vaccination/i, exactName: '💉 Medical + Vaccination', category: 'Medical' },
            { pattern: /medicine.*vd3/i, exactName: '💊 Medicine VD3', category: 'Medical' },
            { pattern: /medicines/i, exactName: '💊 Medicines', category: 'Medical' },
            { pattern: /medicine/i, exactName: '💊 Medicine', category: 'Medical' },
            { pattern: /cotton.*band/i, exactName: '💊 Cotton & Bandage', category: 'Medical' },
            { pattern: /medical.*1000.*apr.*7/i, exactName: '🩺 Medical ₹1000, Apr 7', category: 'Medical' },
            { pattern: /medical.*1000.*apr.*6/i, exactName: '🩺 Medical ₹1000, Apr 6', category: 'Medical' },

            // Personal Care
            { pattern: /ahir.*cut|hair.*cut|haircut/i, exactName: '✂️ Hair Cut', category: 'Personal Care' },
            { pattern: /hair.*color/i, exactName: '💇 Hair Color', category: 'Personal Care' },
            { pattern: /sanitary.*pad/i, exactName: '🩹 Sanitary Pads', category: 'Personal Care' },
            { pattern: /toothpaste/i, exactName: '🦷 Toothpaste', category: 'Personal Care' },
            { pattern: /soap/i, exactName: '🧼 Soap', category: 'Personal Care' },
            { pattern: /surf.*excel/i, exactName: '🧺 Surf Excel', category: 'Personal Care' },
            { pattern: /surf/i, exactName: '🧺 Surf', category: 'Personal Care' },
            { pattern: /^radhika$/i, exactName: '👩 Radhika', category: 'Personal Care' },

            // Food & Grocery
            { pattern: /fruit/i, exactName: '🍎 Fruit', category: 'Food' },
            { pattern: /vegetables|vegetable/i, exactName: '🥦 Vegetables', category: 'Food' },
            { pattern: /curd/i, exactName: '🍕 Curd', category: 'Food' },
            { pattern: /food/i, exactName: '🍕 Food', category: 'Food' },
            { pattern: /bread/i, exactName: '🍞 Bread', category: 'Food' },
            { pattern: /ice.*cream/i, exactName: '🍦 Ice Cream', category: 'Food' },
            { pattern: /sweets|sweet/i, exactName: '🍬 Sweets', category: 'Food' },
            { pattern: /snacks|snack/i, exactName: '🍿 Snacks', category: 'Food' },
            { pattern: /cake/i, exactName: '🎂 Cake', category: 'Food' },
            { pattern: /paneer/i, exactName: '🧀 Paneer', category: 'Food' },
            { pattern: /dairy/i, exactName: '🥛 Dairy', category: 'Food' },
            { pattern: /milk/i, exactName: '🥛 Milk', category: 'Food' },
            { pattern: /coldrink|cold.*drink/i, exactName: '🥤 Coldrink', category: 'Food' },
            { pattern: /juice/i, exactName: '🥤 Juice', category: 'Food' },
            { pattern: /coffee/i, exactName: '☕ Coffee', category: 'Food' },
            { pattern: /grocery/i, exactName: '🛒 Grocery', category: 'Food' },
            { pattern: /^oil$/i, exactName: '🫙 Oil', category: 'Food' },

            // Transport
            { pattern: /auto/i, exactName: '🛺 Auto', category: 'Transport' },
            { pattern: /petrol/i, exactName: '⛽ Petrol', category: 'Transport' },
            { pattern: /engine/i, exactName: '⚙️ Engine', category: 'Transport' },
            { pattern: /service/i, exactName: '🔧 Service', category: 'Transport' },
            { pattern: /train/i, exactName: '🚂 Train', category: 'Transport' },
            { pattern: /metro/i, exactName: '🚇 Metro', category: 'Transport' },

            // Bills & Utilities
            { pattern: /jio.*fiber|fiber/i, exactName: '🌐 Jio Fiber', category: 'Bills' },
            { pattern: /recharge/i, exactName: '📱 Recharge', category: 'Bills' },
            { pattern: /13000.*rent|10000.*rent/i, exactName: '🏠 13000 Rent+Security', category: 'Bills' },
            { pattern: /room.*rent/i, exactName: '🏠 Room Rent', category: 'Bills' },
            { pattern: /axix|axis/i, exactName: '🏦 Axis', category: 'Bills' },
            { pattern: /sbi/i, exactName: '🏦 SBI', category: 'Bills' },
            { pattern: /office.*365/i, exactName: '📦 Office 365', category: 'Bills' },
            { pattern: /bulb.*jan/i, exactName: '💡 Bulb Jan 4, 2026 - Jan 4, 2028', category: 'Bills' },
            { pattern: /bulb.*jun/i, exactName: '💡 Bulb Jun 15, 26 - June 15, 27', category: 'Bills' },
            { pattern: /feb.*2026.*mar/i, exactName: '📅 Feb 2026 - Mar 2026', category: 'Bills' },
            { pattern: /advance.*payment/i, exactName: '💵 Advance Payment', category: 'Bills' },
            { pattern: /locker/i, exactName: '🔒 Locker', category: 'Bills' },

            // Shopping
            { pattern: /shoes.*slippers/i, exactName: '👟 Shoes & Slippers', category: 'Shopping' },
            { pattern: /shoes/i, exactName: '👟 Shoes', category: 'Shopping' },
            { pattern: /jewellery/i, exactName: '💍 Jewellery', category: 'Shopping' },
            { pattern: /nagrela/i, exactName: '💍 Nagrela', category: 'Shopping' },
            { pattern: /cover/i, exactName: '📱 Cover', category: 'Shopping' },
            { pattern: /belt/i, exactName: '🥋 Belt', category: 'Shopping' },
            { pattern: /amazon.*watch/i, exactName: '📦 Amazon Watches', category: 'Shopping' },
            { pattern: /amazon/i, exactName: '📦 Amazon', category: 'Shopping' },
            { pattern: /vishal.*mart/i, exactName: '🏪 Vishal Mart', category: 'Shopping' },
            { pattern: /redmi.*watch|watch.*strap/i, exactName: '⌚ Redmi Watch Strap', category: 'Shopping' },
            { pattern: /shopping.*radhika/i, exactName: '🛍️ Shopping Radhika', category: 'Shopping' },
            { pattern: /shopping/i, exactName: '🛍️ Shopping', category: 'Shopping' },
            { pattern: /money.*distribution.*saari/i, exactName: '🥻 Money Distribution & Saari', category: 'Shopping' },

            // Entertainment
            { pattern: /birthday.*gift/i, exactName: '🎂 Birthday Gift', category: 'Entertainment' },
            { pattern: /birthday/i, exactName: '🎂 Birthday', category: 'Entertainment' },
            { pattern: /candle.*ribbon/i, exactName: '🎂 Candle & Ribbon', category: 'Entertainment' },
            { pattern: /reception/i, exactName: '🎉 Reception', category: 'Entertainment' },
            { pattern: /movie/i, exactName: '🎬 Movie', category: 'Entertainment' },
            { pattern: /fair/i, exactName: '🎡 Fair', category: 'Entertainment' },

            // Household Utilities
            { pattern: /home/i, exactName: '🏠 Home', category: 'Household Utilities' },
            { pattern: /shoes.*polish/i, exactName: '👟 Shoes Polish', category: 'Household Utilities' },
            { pattern: /tap.*jun/i, exactName: '📦 Tap Jun 15, 2026', category: 'Household Utilities' },
            { pattern: /lighter/i, exactName: '🔥 Lighter', category: 'Household Utilities' },
            { pattern: /cups.*plates/i, exactName: '🥤 Cups & Plates', category: 'Household Utilities' },
            { pattern: /mosquito.*repellent/i, exactName: '🦟 Mosquito Repellent', category: 'Household Utilities' },
            { pattern: /folding.*bed/i, exactName: '🛏️ Folding Bed', category: 'Household Utilities' },
            { pattern: /labour.*charges|labour/i, exactName: '🛠️ Labour Charges', category: 'Household Utilities' },

            // Other / AI
            { pattern: /gemini.*pro/i, exactName: '🤖 Gemini Pro', category: 'Other' },
            { pattern: /^ai$/i, exactName: '🤖 AI', category: 'Other' },
            { pattern: /money.*1500/i, exactName: '💵 Money ₹1500', category: 'Other' },
            { pattern: /money.*distribution/i, exactName: '💸 Money Distribution', category: 'Other' },
            { pattern: /anil.*chahar/i, exactName: '🛡️ Anil Chahar', category: 'Other' },
            { pattern: /radhika.*chahar/i, exactName: '🛡️ Radhika Chahar', category: 'Other' }
        ];

        data.forEach(row => {
            let itemName = (row[1] || '').toString().trim();
            let category = (row[2] || '').toString().trim();
            if (!itemName) return;

            // Strip existing symbols/emojis to get clean text for matching
            const cleanName = itemName.replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}☀-➿\s]+/u, '').trim();

            let rowChanged = false;
            let ruleMatched = false;

            // 1. Check specific known items
            for (const rule of specificRules) {
                if (rule.pattern.test(itemName) || (cleanName && rule.pattern.test(cleanName))) {
                    ruleMatched = true;
                    if (itemName !== rule.exactName) {
                        nameReplacements[itemName] = rule.exactName;
                        row[1] = rule.exactName;
                        rowChanged = true;
                    }
                    if (row[2] !== rule.category) {
                        row[2] = rule.category;
                        rowChanged = true;
                    }
                    break;
                }
            }

            // 2. Fallback category inference if rule did not match and category is missing/general
            if (!ruleMatched && (!row[2] || row[2] === 'General' || row[2] === 'Uncategorized' || forceOverride)) {
                const inferredCat = inferCategoryForItem(row[1]);
                if (inferredCat && inferredCat !== 'General' && row[2] !== inferredCat) {
                    row[2] = inferredCat;
                    rowChanged = true;
                }
            }

            // 3. Fallback emoji inference if item name doesn't start with emoji
            const hasEmoji = /^([\p{Extended_Pictographic}\p{Emoji_Presentation}☀-➿])/u.test(row[1]);
            if (!hasEmoji) {
                const inferredIcon = inferIconForItem(row[1]);
                if (inferredIcon && inferredIcon !== row[1]) {
                    nameReplacements[row[1]] = inferredIcon;
                    row[1] = inferredIcon;
                    rowChanged = true;
                }
            }

            if (rowChanged) {
                sheetUpdated = true;
                updatedCount++;
            }
        });

        // 4. Ensure mandatory user items exist
        const mandatoryItems = [
            { exactName: '👶 Rudra Baby 6 Months', category: 'Baby Care' },
            { exactName: '🪔 Durga Pooja', category: 'Festivals' },
            { exactName: '🪔 Diwali', category: 'Festivals' },
            { pattern: /holi/i, exactName: '🎨 Holi', category: 'Festivals' },
            { exactName: '🌕 Karvachauth', category: 'Festivals' },
            { exactName: '🏫 School Stationary', category: 'Education' },
            { pattern: /^🪭\s*Fan$|^Fan$/i, exactName: '🪭 Fan', category: 'Electronics' },
            { pattern: /Electric\s*Fan/i, exactName: '🪭 Electric Fan', category: 'Electronics' },
            { pattern: /\btv\b|television/i, exactName: '📺 TV', category: 'Electronics' },
            { pattern: /Hair\s*Cut/i, exactName: '✂️ Hair Cut', category: 'Personal Care' },
            { pattern: /Hair\s*Color/i, exactName: '💇 Hair Color', category: 'Personal Care' }
        ];

        let nextId = data.length > 0 ? (Math.max(...data.map(r => parseInt(r[0]) || 0)) + 1) : 1;
        const existingNames = new Set(data.map(r => (r[1] || '').toString().trim().toLowerCase()));

        const itemsToAppend = [];
        mandatoryItems.forEach(item => {
            const lowerName = item.exactName.toLowerCase();
            const exists = Array.from(existingNames).some(name => {
                if (item.pattern) return item.pattern.test(name);
                return name === lowerName || name.includes(item.exactName.toLowerCase().replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}☀-➿\s]+/u, '').trim());
            });

            if (!exists) {
                itemsToAppend.push([
                    nextId++,
                    item.exactName,
                    item.category,
                    new Date(),
                    'Web App'
                ]);
            }
        });

        if (sheetUpdated) {
            range.setValues(data);
            Logger.log('List sheet items and categories updated: ' + updatedCount + ' rows changed.');

            // Update occurrences in month sheets
            if (Object.keys(nameReplacements).length > 0) {
                MONTHS.forEach(month => {
                    try {
                        const monthSheet = ss.getSheetByName(month);
                        if (monthSheet && typeof monthSheet.getLastRow === 'function' && monthSheet.getLastRow() > 1) {
                            const itemRange = monthSheet.getRange(2, 5, monthSheet.getLastRow() - 1, 1);
                            const itemVals = itemRange.getValues();
                            let mChanged = false;
                            itemVals.forEach(r => {
                                const val = (r[0] || '').toString().trim();
                                if (nameReplacements[val]) {
                                    r[0] = nameReplacements[val];
                                    mChanged = true;
                                }
                            });
                            if (mChanged) {
                                itemRange.setValues(itemVals);
                            }
                        }
                    } catch (mErr) {
                        Logger.log('Month sheet update error for ' + month + ': ' + mErr.message);
                    }
                });
            }

            // Refresh validation rules
            try {
                updateDataValidationForItemList();
            } catch (e) {
                Logger.log('Validation update error: ' + e.message);
            }
        }

        if (itemsToAppend.length > 0) {
            itemsToAppend.forEach(row => {
                listSheet.appendRow(row);
            });
            Logger.log('Appended ' + itemsToAppend.length + ' mandatory missing items.');
            try {
                updateDataValidationForItemList();
            } catch (e) {
                Logger.log('Validation update error: ' + e.message);
            }
        }

        return {
            updatedCount: updatedCount + itemsToAppend.length,
            totalRows: lastRow - 1 + itemsToAppend.length
        };
    } catch (err) {
        Logger.log('Error in autoEnrichMissingCategoriesAndIcons: ' + err.message);
        return { updatedCount: 0, totalRows: 0, error: err.message };
    }
}

/**
 * Force-syncs and fixes all item categories and missing icons in the 'List' sheet.
 * Can be triggered via web app query (?page=syncList) or admin call.
 */
function syncAndFixListSheetNow() {
    try {
        const ss = SpreadsheetApp.openById(MAIN_ID);
        let listSheet = ss.getSheetByName("List");
        if (!listSheet) {
            const sheets = ss.getSheets();
            for (let i = 0; i < sheets.length; i++) {
                try {
                    const s = sheets[i];
                    if (s.getSheetId() === 2123310085 || s.getName().trim().toLowerCase() === "list") {
                        listSheet = s;
                        break;
                    }
                } catch (e) {}
            }
        }
        if (!listSheet) {
            listSheet = ensureListSheet();
        }

        const result = autoEnrichMissingCategoriesAndIcons(ss, listSheet, true);
        deduplicateAndRenumberListSheet(ss, listSheet);

        return {
            success: true,
            targetSheet: listSheet ? listSheet.getName() : null,
            targetSheetId: listSheet ? listSheet.getSheetId() : null,
            targetSheetRows: listSheet ? listSheet.getLastRow() : 0,
            result: result,
            timestamp: new Date().toISOString()
        };
    } catch (e) {
        Logger.log('Error in syncAndFixListSheetNow: ' + e.message);
        return {
            success: false,
            error: e.message,
            stack: e.stack
        };
    }
}

/**
 * Deduplicates items in the List sheet, cleans spaces, and renumbers IDs sequentially.
 */
function deduplicateAndRenumberListSheet(ss, listSheet) {
    try {
        const lastRow = listSheet.getLastRow();
        if (lastRow <= 1) return;
        const values = listSheet.getRange(2, 1, lastRow - 1, 5).getValues();
        const seen = new Set();
        const cleanRows = [];
        let idCounter = 1;

        values.forEach(r => {
            const itemName = (r[1] || '').toString().trim();
            const category = (r[2] || '').toString().trim();
            if (!itemName) return;
            const normKey = itemName.toLowerCase();
            if (!seen.has(normKey)) {
                seen.add(normKey);
                cleanRows.push([
                    idCounter++,
                    itemName,
                    category,
                    r[3] || new Date(),
                    r[4] || 'Web App'
                ]);
            }
        });

        listSheet.getRange(2, 1, lastRow - 1, 5).clearContent();
        if (cleanRows.length > 0) {
            listSheet.getRange(2, 1, cleanRows.length, 5).setValues(cleanRows);
        }
    } catch (err) {
        Logger.log('Error in deduplicateAndRenumberListSheet: ' + err.message);
    }
}


function getYearlyData(year) {
    try {
        const ss = SpreadsheetApp.openById(CONSOLIDATED_ID);
        const sheet = ss.getSheetByName("Master");
        if (!sheet) {
            return { error: "Sheet 'Master' not found." };
        }

        let yearlyData = {};
        let yearlyTotal = 0;

        // Initialize all months to 0
        MONTHS.forEach(month => yearlyData[month] = 0);

        const dataRange = sheet.getDataRange();
        if (dataRange.getNumRows() <= 1) {
            return yearlyData; // no data
        }

        const values = dataRange.getValues().slice(1); // exclude header row

        values.forEach(row => {
            const dateCell = row[2];   // Column C = Date
            const amountCell = row[5]; // Column F = Amount

            if (dateCell && amountCell) {
                let rowDate = dateCell;

                // Convert to Date object if it's a string
                if (!(rowDate instanceof Date)) {
                    if (typeof rowDate === 'string') {
                        // Try to parse the date string
                        const dateMatch = rowDate.toString().match(/^(\w+)\s+(\d+)(?:\s+(\d{4}))?/);
                        if (dateMatch) {
                            const monthName = dateMatch[1].substring(0, 3);
                            const day = parseInt(dateMatch[2]);
                            const yearFromString = dateMatch[3] || new Date().getFullYear();
                            const monthIndex = MONTHS.findIndex(m =>
                                m.toLowerCase() === monthName.toLowerCase()
                            );

                            if (monthIndex !== -1) {
                                rowDate = new Date(parseInt(yearFromString), monthIndex, day);
                            }
                        } else {
                            // Try standard Date parsing
                            rowDate = new Date(rowDate);
                        }
                    }
                }

                // Check if date is valid and matches target year
                if (rowDate instanceof Date && !isNaN(rowDate.getTime()) && rowDate.getFullYear().toString() === year) {
                    const monthName = MONTHS[rowDate.getMonth()];
                    const amount = parseFloat(amountCell) || 0;

                    yearlyData[monthName] += amount;
                    yearlyTotal += amount;
                }
            }
        });

        yearlyData["Total"] = yearlyTotal;
        yearlyData["Year"] = year;
        return yearlyData;

    } catch (e) {
        console.error("Error in getYearlyData:", e.message);
        return { error: e.message };
    }
}

/**
* Gets comprehensive yearly report with all calculations
* @param {string} year - The year to generate report for
* @returns {Object} Complete report data
*/
function getYearlyReport(year) {
    try {
        // Get all data
        const allDataResult = getAllData();

        if (allDataResult.error) {
            return { error: allDataResult.error };
        }

        const allExpenses = allDataResult.allExpenses || [];

        if (allExpenses.length === 0) {
            return {
                year: year,
                yearlyTotal: 0,
                monthlyTotals: [],
                categorySummary: [],
                totalTransactions: 0,
                uniqueCategories: 0,
                detailedData: []
            };
        }

        let yearlyTotal = 0;
        let monthlyTotals = {};
        let categorySummary = {};
        let detailedData = [];
        let allCategories = new Set();

        // Initialize monthly totals
        MONTHS.forEach(month => {
            monthlyTotals[month] = 0;
        });

        // Filter expenses for the target year
        const yearlyExpenses = allExpenses.filter(expense => {
            const expenseYear = expense[5]; // YEAR column
            return expenseYear === year;
        });

        // Process yearly expenses
        yearlyExpenses.forEach(expense => {
            const amount = parseFloat(expense[3]) || 0;
            const month = expense[1]; // MONTH column
            const category = expense[2]; // ITEM LIST column

            yearlyTotal += amount;

            if (month && MONTHS.includes(month)) {
                monthlyTotals[month] += amount;
            }

            if (category) {
                if (!categorySummary[category]) {
                    categorySummary[category] = 0;
                }
                categorySummary[category] += amount;
                allCategories.add(category);
            }

            detailedData.push([
                expense[0], // DATE
                month,
                category,
                amount.toFixed(2),
                expense[4], // CREDIT
                year,
                expense[6] // ADMIN
            ]);
        });

        // Convert monthly totals to array
        const monthlyTotalsArray = MONTHS.map(month => ({
            month: month,
            total: monthlyTotals[month] || 0
        }));

        // Convert category summary to array and sort
        const categorySummaryArray = Object.entries(categorySummary)
            .map(([category, total]) => ({
                category: category,
                total: parseFloat(total.toFixed(2))
            }))
            .sort((a, b) => b.total - a.total);

        // Calculate category percentages
        const categoryPercentages = categorySummaryArray.map(item => ({
            category: item.category,
            amount: item.total,
            percentage: yearlyTotal > 0 ? ((item.total / yearlyTotal) * 100).toFixed(1) + "%" : "0%"
        }));

        // Find highest spending month
        let highestMonth = { month: "", total: 0 };
        monthlyTotalsArray.forEach(m => {
            if (m.total > highestMonth.total) {
                highestMonth = m;
            }
        });

        // Calculate average monthly expense
        const monthsWithData = monthlyTotalsArray.filter(m => m.total > 0).length;
        const averageMonthlyExpense = monthsWithData > 0
            ? (yearlyTotal / monthsWithData).toFixed(2)
            : 0;

        // Sort detailed data by date (newest first)
        detailedData.sort((a, b) => {
            try {
                const dateA = parseDateString(a[0], parseInt(a[5]));
                const dateB = parseDateString(b[0], parseInt(b[5]));
                return dateB - dateA;
            } catch (e) {
                return 0;
            }
        });

        return {
            year: year,
            yearlyTotal: parseFloat(yearlyTotal.toFixed(2)),
            monthlyTotals: monthlyTotalsArray,
            categorySummary: categorySummaryArray,
            categoryPercentages: categoryPercentages,
            topCategories: categorySummaryArray.slice(0, 5),
            averageMonthlyExpense: parseFloat(averageMonthlyExpense),
            highestMonth: highestMonth,
            totalTransactions: detailedData.length,
            uniqueCategories: allCategories.size,
            detailedData: detailedData
        };
    } catch (e) {
        console.error("Error in getYearlyReport:", e.message);
        return { error: e.message };
    }
}

/**
* Gets available years from consolidated Master sheet
* @returns {Array<string>} Array of available years
*/
function getAvailableYears() {
    try {
        const ss = SpreadsheetApp.openById(MAIN_ID);
        const dataSheet = ss.getSheetByName("Data");
        if (!dataSheet) {
            return [new Date().getFullYear().toString()];
        }

        const dataRange = dataSheet.getDataRange();
        if (dataRange.getNumRows() <= 1) {
            return [new Date().getFullYear().toString()];
        }

        const values = dataRange.getValues().slice(1);
        const yearsSet = new Set();

        values.forEach(row => {
            const dateCell = row[2]; // Date column in "Data" sheet
            if (dateCell) {
                if (dateCell instanceof Date && !isNaN(dateCell.getTime())) {
                    yearsSet.add(dateCell.getFullYear().toString());
                } else if (typeof dateCell === 'string') {
                    // Try to extract year from date string
                    const yearMatch = dateCell.toString().match(/\b(\d{4})\b/);
                    if (yearMatch) {
                        yearsSet.add(yearMatch[1]);
                    }
                }
            }
        });

        // Add current year if no data found
        if (yearsSet.size === 0) {
            yearsSet.add(new Date().getFullYear().toString());
        }

        // Convert to array and sort in descending order
        const years = Array.from(yearsSet).sort((a, b) => parseInt(b) - parseInt(a));
        return years;
    } catch (e) {
        console.error("Error in getAvailableYears:", e.message);
        return [new Date().getFullYear().toString()];
    }
}

// Simplified versions of other report functions
function getYearlyCategorySummary(year) {
    return getYearlyReport(year);
}

function getMonthlyTrends(year) {
    const report = getYearlyReport(year);
    if (report.error) return report;

    const monthlyTrends = report.monthlyTotals.map((monthData, index) => ({
        month: monthData.month,
        total: monthData.total,
        categories: 0,
        growth: index === 0 ? 0 :
            report.monthlyTotals[index - 1].total > 0 ?
                ((monthData.total - report.monthlyTotals[index - 1].total) / report.monthlyTotals[index - 1].total * 100).toFixed(1) : 0
    }));

    return {
        year: year,
        monthlyTrends: monthlyTrends,
        peakMonth: report.highestMonth
    };
}

function getCategoryAnalysis(year) {
    const report = getYearlyReport(year);
    if (report.error) return report;

    const total = report.yearlyTotal;
    const categoryAnalysis = report.categorySummary.map(cat => ({
        category: cat.category,
        amount: cat.total,
        percentage: total > 0 ? (cat.total / total * 100).toFixed(1) : 0,
        monthlyAverage: (cat.total / 12).toFixed(2)
    }));

    return {
        year: year,
        categoryAnalysis: categoryAnalysis,
        topCategory: categoryAnalysis[0] || null
    };
}

function getCreditDistribution(year) {
    const report = getYearlyReport(year);
    if (report.error) return report;

    const creditSummary = {};
    let totalAmount = 0;

    report.detailedData.forEach(expense => {
        const creditType = expense[4] ? expense[4].toString().trim() : "Not Specified";
        const amount = parseFloat(expense[3]) || 0;

        if (!creditSummary[creditType]) {
            creditSummary[creditType] = 0;
        }
        creditSummary[creditType] += amount;
        totalAmount += amount;
    });

    const creditDistribution = Object.entries(creditSummary).map(([creditType, amount]) => ({
        creditType: creditType,
        amount: parseFloat(amount.toFixed(2)),
        percentage: totalAmount > 0 ? ((amount / totalAmount) * 100).toFixed(1) + "%" : "0%"
    })).sort((a, b) => b.amount - a.amount);

    return {
        year: year,
        creditDistribution: creditDistribution,
        mostUsedCredit: creditDistribution[0] || null
    };
}

/**
* Gets yearly detailed data for a specific year
* @param {string} year - The year to get detailed data for
* @returns {Object} Detailed yearly data
*/
function getYearlyDetailedData(year) {
    try {
        const allDataResult = getAllData();

        if (allDataResult.error) {
            return { error: allDataResult.error };
        }

        const allExpenses = allDataResult.allExpenses || [];
        const yearlyExpenses = allExpenses.filter(expense => {
            const expenseYear = expense[5]; // YEAR column
            return expenseYear === year;
        });

        const uniqueCategories = [...new Set(yearlyExpenses.map(expense => expense[2]))].sort();
        const totalAmount = yearlyExpenses.reduce((sum, expense) => sum + parseFloat(expense[3]), 0);

        return {
            allExpenses: yearlyExpenses.map(expense => [
                expense[0], // DATE
                expense[1], // MONTH
                expense[2], // ITEM LIST
                parseFloat(expense[3]), // AMOUNT
                expense[4], // CREDIT
                expense[5]  // YEAR
            ]),
            uniqueCategories: uniqueCategories,
            totalAmount: parseFloat(totalAmount.toFixed(2)),
            year: year
        };
    } catch (e) {
        console.error("Error in getYearlyDetailedData:", e.message);
        return { error: e.message };
    }
}

/*=====================================
Add New Item to List Sheet Functionality
=====================================*/

/**
* Adds a new item to the "List" sheet in column B
* @param {string} itemName - The new item to add
* @param {string} category - Optional category for the item
* @returns {Object} Success or error response
*/
function addItemToList(itemName, category) {
    try {
        if (!itemName || itemName.trim() === '') {
            return {
                success: false,
                message: 'Item Name Cannot Be Empty'
            };
        }

        const ss = SpreadsheetApp.openById(MAIN_ID);
        const listSheet = ensureListSheet();

        // Check if item already exists (case-insensitive)
        const existingItems = getItemList();
        const itemExists = existingItems.some(item =>
            item.toLowerCase() === itemName.trim().toLowerCase()
        );

        if (itemExists) {
            return {
                success: false,
                message: `"${itemName}" Already Exists In List`
            };
        }

        // Get the next ID
        const lastRow = listSheet.getLastRow();
        const nextId = lastRow + 1;

        // Format date
        const now = new Date();
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const formattedDate = `${monthNames[now.getMonth()]} ${now.getDate()} ${now.getFullYear()}`;

        let finalItemName = itemName.trim();
        let finalCategory = (category && category.trim()) ? category.trim() : inferCategoryForItem(finalItemName);

        // Auto-enrich item name with emoji icon if missing
        const hasEmoji = /^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|[\u2600-\u27BF])/u.test(finalItemName);
        if (!hasEmoji) {
            const inferredIcon = inferIconForItem(finalItemName);
            if (inferredIcon) {
                finalItemName = inferredIcon;
            }
        }

        // Add the new item
        listSheet.appendRow([
            nextId,
            finalItemName,
            finalCategory,
            formattedDate,
            currentUser ? currentUser.name : "Web App"
        ]);

        // Update data validation across all month sheets
        updateDataValidationForItemList();

        return {
            success: true,
            message: `"${finalItemName}" Added Successfully 2 List!`,
            newItem: finalItemName
        };

    } catch (error) {
        Logger.log('Error Adding New Item: ' + error.message);
        return {
            success: false,
            message: 'Error Adding Item: ' + error.toString()
        };
    }
}

/**
* Updates data validation for Item List column across all month sheets
*/
function updateDataValidationForItemList() {
    try {
        const ss = SpreadsheetApp.openById(MAIN_ID);
        const allItems = getItemList();

        if (allItems.length === 0) return;

        // Update data validation for Item List column (column 5) in all month sheets
        MONTHS.forEach(month => {
            const sheet = ss.getSheetByName(month);
            if (sheet) {
                const lastRow = sheet.getLastRow();
                if (lastRow > 1) {
                    const itemListRange = sheet.getRange(2, 5, lastRow - 1, 1); // Column E (5th column)

                    // Create data validation rule
                    const rule = SpreadsheetApp.newDataValidation()
                        .requireValueInList(allItems, true)
                        .setAllowInvalid(false)
                        .build();

                    itemListRange.setDataValidation(rule);
                }
            }
        });

        // Also update the Data sheet
        const dataSheet = ss.getSheetByName("Data");
        if (dataSheet && dataSheet.getLastRow() > 1) {
            const dataRange = dataSheet.getRange(2, 5, dataSheet.getLastRow() - 1, 1);
            const rule = SpreadsheetApp.newDataValidation()
                .requireValueInList(allItems, true)
                .setAllowInvalid(false)
                .build();
            dataRange.setDataValidation(rule);
        }

        Logger.log('Data Validation Updated With All Items');

    } catch (error) {
        Logger.log('Error Updating Data Validation: ' + error.message);
    }
}

/**
* Export functions for CSV download
*/

/**
* Exports data for a specific month to CSV format
* @param {string} monthName - The month to export
* @returns {Object} CSV content and filename
*/
function exportSingleSheetToExcel(sheetName) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(MAIN_ID);
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) {
            return { error: `Sheet "${sheetName}" not found.` };
        }

        // Create a temporary spreadsheet
        const tempName = `Expenses_${sheetName}_${new Date().getFullYear()}`;
        const tempSS = SpreadsheetApp.create(tempName);
        const tempId = tempSS.getId();

        // Copy the target sheet to the temporary spreadsheet
        const copiedSheet = sheet.copyTo(tempSS);
        copiedSheet.setName(sheetName);

        // Remove the default "Sheet1" sheet
        const defaultSheet = tempSS.getSheetByName("Sheet1");
        if (defaultSheet) {
            tempSS.deleteSheet(defaultSheet);
        }

        // Flush changes
        SpreadsheetApp.flush();

        // Fetch the XLSX bytes of the temporary spreadsheet
        const url = `https://docs.google.com/spreadsheets/d/${tempId}/export?format=xlsx`;
        const token = ScriptApp.getOAuthToken();
        const response = UrlFetchApp.fetch(url, {
            headers: {
                'Authorization': 'Bearer ' + token
            },
            muteHttpExceptions: true
        });

        if (response.getResponseCode() !== 200) {
            // Clean up before throwing error
            DriveApp.getFileById(tempId).setTrashed(true);
            return { error: `Failed to export sheet. Status: ${response.getResponseCode()}` };
        }

        const blob = response.getBlob();
        const base64Data = Utilities.base64Encode(blob.getBytes());

        // Delete the temporary spreadsheet from Drive
        DriveApp.getFileById(tempId).setTrashed(true);

        return {
            success: true,
            isExcelBase64: true,
            base64Data: base64Data,
            fileName: `${tempName}.xlsx`
        };
    } catch (e) {
        return { error: e.message };
    }
}

function exportData(monthName) {
    return exportSingleSheetToExcel(monthName);
}

function exportAllData() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(MAIN_ID);
        const spreadsheetId = ss.getId();
        return {
            success: true,
            isExcel: true,
            url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`,
            fileName: `All_Expenses_${new Date().getFullYear()}.xlsx`
        };
    } catch (e) {
        return { error: e.message };
    }
}

/**
* Enhanced addEntry function to handle new items
* @param {Object} entryData - The expense data
* @returns {Object} Response with success/error
*/
function addExpenseEntry(entryData) {
    try {
        // Check if we need to add a new item to the list
        if (entryData.isNewItem && entryData.newItemName) {
            const addItemResult = addItemToList(entryData.newItemName, entryData.category);
            if (!addItemResult.success) {
                return addItemResult; // Return error if item addition failed
            }
            // Use the new item name for the expense
            entryData.itemList = addItemResult.newItem;
        }

        // Proceed with adding the expense entry
        return addEntry({
            date: entryData.date,
            itemList: entryData.itemList,
            amount: entryData.amount,
            credit: entryData.credit,
            user: entryData.user
        });

    } catch (error) {
        return {
            success: false,
            message: 'Error Processing Expense: ' + error.toString()
        };
    }
}


// =======================================
// NEW DATA SUMMARY & GRAPHS FUNCTIONS
// =======================================

/**
* Fetches summary data from the 'Data' sheet in MAIN_ID.
* @returns {Object} Summary metrics and data for dashboards.
*/
function getSummaryData(year) {
    try {
        const ss = SpreadsheetApp.openById(CONSOLIDATED_ID);
        const sheet = ss.getSheetByName("Master");

        let rows = [];
        if (sheet && sheet.getLastRow() > 1) {
            rows = sheet.getDataRange().getValues().slice(1);
        } else {
            MONTHS.forEach(m => {
                const mSheet = ss.getSheetByName(m);
                if (mSheet && mSheet.getLastRow() > 1) {
                    rows = rows.concat(mSheet.getDataRange().getValues().slice(1));
                }
            });
        }

        if (rows.length === 0) return getEmptySummary();

        // Use passed year or default to current year
        const targetYear = (year && year !== 'all') ? year.toString() : new Date().getFullYear().toString();

        let totalAmount = 0;
        const monthlyTotals = {};
        const categoryTotals = {};
        const paymentMethods = { 'Credit': 0, 'Cash': 0 };
        const yearlyCategoryCounts = {};

        rows.forEach(row => {
            const amount = parseFloat(row[5]) || 0;
            const dateStr = row[2];
            const month = row[3];
            const category = row[4] || "Uncategorized";

            const creditStr = String(row[6] || '').toLowerCase();
            const credit = (creditStr.includes('✓') || creditStr.includes('credit')) ? 'Credit' : 'Cash';

            // Parse date to check year (Robust logic)
            let rowYear;
            if (dateStr instanceof Date && !isNaN(dateStr.getTime())) {
                rowYear = dateStr.getFullYear().toString();
            } else {
                // Try parsing string
                const dStr = String(dateStr);
                const dateMatch = dStr.match(/^(\w+)\s+(\d+)(?:\s+(\d{4}))?/);
                if (dateMatch && dateMatch[3]) {
                    rowYear = dateMatch[3];
                } else {
                    // Check Tracker Name (Index 8) for year if date string doesn't have it
                    const trackerName = row[8] || ''; // Index 8 is Tracker Name
                    const yearMatch = trackerName && typeof trackerName === 'string' ? trackerName.match(/(\d{4})/) : null;

                    if (yearMatch) {
                        rowYear = yearMatch[1];
                    } else {
                        // Fallback to standard 
                        const d = new Date(dStr);
                        rowYear = !isNaN(d.getTime()) ? d.getFullYear().toString() : new Date().getFullYear().toString();
                    }
                }
            }

            if (rowYear === targetYear) {
                totalAmount += amount;

                // Monthly Totals
                monthlyTotals[month] = (monthlyTotals[month] || 0) + amount;

                // Category Totals
                categoryTotals[category] = (categoryTotals[category] || 0) + amount;
                yearlyCategoryCounts[category] = (yearlyCategoryCounts[category] || 0) + 1;

                // Payment Methods
                paymentMethods[credit] += amount;
            }
        });

        const currentYearTotal = totalAmount;

        // Helper to sort and format
        const topCategories = Object.entries(categoryTotals)
            .map(([cat, amt]) => ({
                category: cat,
                total: amt,
                percentage: currentYearTotal > 0 ? ((amt / currentYearTotal) * 100).toFixed(1) : 0,
                transactions: yearlyCategoryCounts[cat],
                avgPer: yearlyCategoryCounts[cat] ? amt / yearlyCategoryCounts[cat] : 0
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

        const catDist = Object.entries(categoryTotals)
            .map(([cat, amt]) => ({ category: cat, percentage: currentYearTotal > 0 ? ((amt / currentYearTotal) * 100).toFixed(1) : 0 }))
            .sort((a, b) => b.percentage - a.percentage)
            .slice(0, 5);

        const payMethods = Object.entries(paymentMethods)
            .map(([method, amt]) => ({ method: method, amount: amt, percentage: currentYearTotal > 0 ? ((amt / currentYearTotal) * 100).toFixed(1) : 0 }));

        const monthsArr = Object.entries(monthlyTotals)
            .map(([m, amt]) => ({ month: m, amount: amt }))
            .sort((a, b) => b.amount - a.amount);

        const highest = monthsArr.length > 0 ? monthsArr[0] : { month: '-', amount: 0 };
        const lowest = monthsArr.length > 0 ? monthsArr[monthsArr.length - 1] : { month: '-', amount: 0 };

        // Monthly Comparison Mockup (Trend)
        const monthlyComparison = MONTHS.map(m => {
            const amt = monthlyTotals[m] || 0;
            return {
                month: m,
                total: amt,
                dailyAvg: amt / 30, // Approx
                transactions: 0,
                categories: 0,
                trend: amt > (currentYearTotal / 12) ? 'up' : 'down'
            };
        });

        return {
            yearlyTotal: currentYearTotal,
            monthlyAverage: currentYearTotal / 12,
            highestMonth: highest,
            lowestMonth: lowest,
            categoryDistribution: catDist,
            userSpending: [{ user: 'Admin', amount: currentYearTotal, percentage: 100 }], // Placeholder
            paymentMethods: payMethods,
            monthlyComparison: monthlyComparison,
            topCategories: topCategories
        };

    } catch (e) {
        return { error: e.message };
    }
}

function getEmptySummary() {
    return {
        yearlyTotal: 0, monthlyAverage: 0, highestMonth: { month: '-', amount: 0 }, lowestMonth: { month: '-', amount: 0 },
        categoryDistribution: [], userSpending: [], paymentMethods: [], monthlyComparison: [], topCategories: []
    };
}

/**
* Fetches graph data from the 'Data' sheet.
* @param {string} type - Graph type (monthly, category, etc.)
* @param {string} year - Year filter
* @param {string} user - User filter
*/
function getGraphsData(type, year, user) {
    try {
        const ss = SpreadsheetApp.openById(CONSOLIDATED_ID);
        const sheet = ss.getSheetByName("Master");
        if (!sheet) return {}; // Return empty structure

        const data = sheet.getDataRange().getValues();
        const rows = data.slice(1);

        // Filter rows
        const filteredRows = rows.filter(row => {
            const dateStr = row[2];
            // Robust Year Parsing
            let rowYear;
            if (dateStr instanceof Date && !isNaN(dateStr.getTime())) {
                rowYear = dateStr.getFullYear().toString();
            } else {
                const dStr = String(dateStr);
                const dateMatch = dStr.match(/^(\w+)\s+(\d+)(?:\s+(\d{4}))?/);
                if (dateMatch && dateMatch[3]) {
                    rowYear = dateMatch[3];
                } else {
                    // Check Tracker Name (Index 8) for year if date string doesn't have it
                    const trackerName = row[8] || '';
                    const yearMatch = trackerName && typeof trackerName === 'string' ? trackerName.match(/(\d{4})/) : null;

                    if (yearMatch) {
                        rowYear = yearMatch[1];
                    } else {
                        const d = new Date(dStr);
                        rowYear = !isNaN(d.getTime()) ? d.getFullYear().toString() : new Date().getFullYear().toString();
                    }
                }
            }

            return rowYear === year;
        });

        // 1. Main Chart (Monthly Trend)
        const monthlyData = new Array(12).fill(0);
        MONTHS.forEach((m, i) => {
            monthlyData[i] = filteredRows
                .filter(r => r[3] === m)
                .reduce((sum, r) => sum + (parseFloat(r[5]) || 0), 0);
        });

        const mainChart = {
            labels: MONTHS,
            datasets: [{
                label: 'Monthly Expenses',
                data: monthlyData,
                borderColor: '#4361ee',
                backgroundColor: 'rgba(67, 97, 238, 0.1)',
                fill: true,
                tension: 0.4
            }]
        };

        // 2. Pie Chart (Category)
        const catTotals = {};
        filteredRows.forEach(r => {
            const cat = r[4] || 'Other';
            catTotals[cat] = (catTotals[cat] || 0) + (parseFloat(r[5]) || 0);
        });
        const pieChart = {
            labels: Object.keys(catTotals),
            datasets: [{
                data: Object.values(catTotals),
                backgroundColor: ['#4361ee', '#3a0ca3', '#7209b7', '#f72585', '#4cc9f0', '#fee440', '#9b5de5', '#00bbf9']
            }]
        };

        // 3. Bar Chart (Detailed Monthly)
        const barChart = {
            labels: MONTHS,
            datasets: [{
                label: 'Expenses',
                data: monthlyData,
                backgroundColor: '#3a0ca3'
            }]
        };

        // 4. Detailed Chart (Daily Pattern or Cumulative)
        // Let's do cumulative
        let cumulative = 0;
        const cumulativeData = monthlyData.map(val => {
            cumulative += val;
            return cumulative;
        });
        const detailedChart = {
            labels: MONTHS,
            datasets: [{
                label: 'Cumulative Spending',
                data: cumulativeData,
                borderColor: '#f72585',
                tension: 0.2
            }]
        };

        return {
            mainChart,
            pieChart,
            barChart,
            detailedChart
        };

    } catch (e) {
        return { error: e.message };
    }
}
/**
 * Main entry point for setting formulas, converting to values, and applying borders.
 * @param {string} monthName - The sheet name to process.
 */
function runCompleteProcess(monthName) {
    try {
        const ss = SpreadsheetApp.openById(MAIN_ID);
        let sheet = ss.getSheetByName(monthName);
        if (!sheet) throw new Error("Sheet not found: " + monthName);

        // Derived from user's provided logic
        var lastRow = Math.max(2, sheet.getLastRow());

        // Clear contents in A2:A and B2:B
        sheet.getRange('A2:A' + lastRow).clearContent();
        sheet.getRange('B2:B' + lastRow).clearContent();

        // Set the ArrayFormula in A2
        sheet.getRange('A2').setFormula('=ArrayFormula(IF(C2:C="", "", SEQUENCE(COUNTA(C2:C))))');

        // Set the ArrayFormula in B2
        sheet.getRange('B2').setFormula('=ARRAYFORMULA(IF(A2:A="-","",IF(A2:A<>"",A2:A & "-" & E2:E,"")))');

        // Force calculation
        SpreadsheetApp.flush();
        Utilities.sleep(1000); // Wait for calculation

        // Get the range with data (based on column C)
        var lastDataRow = sheet.getRange('C2:C').getValues().filter(String).length;

        if (lastDataRow > 0) {
            var dataRange = sheet.getRange('A2:B' + (lastDataRow + 1));

            // Save all formatting attributes
            var backgrounds = dataRange.getBackgrounds();
            var fontColors = dataRange.getFontColors();
            var fontFamilies = dataRange.getFontFamilies();
            var fontLines = dataRange.getFontLines();
            var fontSizes = dataRange.getFontSizes();
            var fontStyles = dataRange.getFontStyles();
            var fontWeights = dataRange.getFontWeights();
            var horizontalAlignments = dataRange.getHorizontalAlignments();
            var verticalAlignments = dataRange.getVerticalAlignments();
            var numberFormats = dataRange.getNumberFormats();
            var textStyles = dataRange.getTextStyles();
            var textDirections = dataRange.getTextDirections();
            var textRotations = dataRange.getTextRotations();
            var wrapStrategies = dataRange.getWrapStrategies();

            // Get calculated values
            var values = dataRange.getValues();

            // Clear everything to convert formula to static values
            dataRange.clear();

            // Restore values
            dataRange.setValues(values);

            // Restore all formatting
            dataRange.setBackgrounds(backgrounds);
            dataRange.setFontColors(fontColors);
            dataRange.setFontFamilies(fontFamilies);
            dataRange.setFontLines(fontLines);
            dataRange.setFontSizes(fontSizes);
            dataRange.setFontStyles(fontStyles);
            dataRange.setFontWeights(fontWeights);
            dataRange.setHorizontalAlignments(horizontalAlignments);
            dataRange.setVerticalAlignments(verticalAlignments);
            dataRange.setNumberFormats(numberFormats);
            dataRange.setTextStyles(textStyles);
            dataRange.setTextDirections(textDirections);
            dataRange.setTextRotations(textRotations);
            dataRange.setWrapStrategies(wrapStrategies);

            // Apply borders
            dataRange.setBorder(true, true, true, true, true, true);
        }

        logAction("APPLY_FORMULA", "Applied formulas to sheet: " + monthName, "N/A", "");

        return { success: true };
    } catch (e) {
        return { error: e.message };
    }
}

// --- Profile Photo Management ---
function saveProfilePhoto(username, base64Data) {
    if (!username) return { success: false, error: "Username required" };
    try {
        const props = PropertiesService.getScriptProperties();
        props.setProperty('avatar_' + username, base64Data);
        return { success: true };
    } catch (e) {
        return { success: false, error: e.toString() };
    }
}

function getProfilePhoto(username) {
    if (!username) return null;
    try {
        const props = PropertiesService.getScriptProperties();
        return props.getProperty('avatar_' + username);
    } catch (e) {
        return null;
    }
}
