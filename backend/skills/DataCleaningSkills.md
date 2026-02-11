# Data Cleaning & Filtering Best Practices

## Critical Understanding

### FILTER_DATA Behavior
**IMPORTANT**: `FILTER_DATA` **REMOVES/DELETES** rows that match the condition.

```
operator: 'equals', value: 'pending'
→ DELETES all rows where column equals "pending"

operator: 'not_equals', value: 'pending'  
→ DELETES all rows where column does NOT equal "pending"
```

---

## Filter Operators

### Exact Matching
```javascript
// Remove rows with status "cancelled"
{ column: 'Status', operator: 'equals', value: 'cancelled' }

// Remove rows that are NOT "completed"
{ column: 'Status', operator: 'not_equals', value: 'completed' }
```

### Partial Matching
```javascript
// Remove rows containing "test"
{ column: 'Name', operator: 'contains', value: 'test' }

// Remove rows NOT containing "prod"
{ column: 'Name', operator: 'not_contains', value: 'prod' }
```

### Numeric Comparison
```javascript
// Remove rows with price > 100
{ column: 'Price', operator: 'greater', value: 100 }

// Remove rows with quantity < 10
{ column: 'Quantity', operator: 'less', value: 10 }
```

### Empty/Null Handling
```javascript
// Remove empty rows
{ column: 'Email', operator: 'empty', value: null }

// Remove non-empty rows (keep only blanks)
{ column: 'Notes', operator: 'not_empty', value: null }
```

---

## Column Name Matching

### Best Practices
1. **Use exact column names** from schema
2. **Case-insensitive matching** is automatic
3. **Trim whitespace** before comparison

### Examples
```javascript
// Schema shows: "Product Status"
// User says: "remove pending status"
// ✅ CORRECT: column: 'Product Status'
// ❌ WRONG: column: 'Status' (won't match)

// Schema shows: "status" (lowercase)
// User says: "Status" (capitalized)
// ✅ WORKS: Case-insensitive matching handles this
```

---

## Safety Checks

### Prevent Accidental Data Loss

#### Check Impact Before Deletion
```javascript
const totalRows = lastRow - startRow + 1;
const percentageImpact = (rowsToDelete.length / totalRows * 100).toFixed(1);

if (percentageImpact > 50) {
  throw new Error(
    `⚠️ This will delete ${rowsToDelete.length} rows (${percentageImpact}% of data). ` +
    `Please verify the filter condition.`
  );
}
```

#### Validate Column Exists
```javascript
const columnExists = headers.some(h => 
  h.name.toLowerCase() === params.column.toLowerCase()
);

if (!columnExists) {
  throw new Error(
    `Column "${params.column}" not found. ` +
    `Available columns: ${headers.map(h => h.name).join(', ')}`
  );
}
```

---

## Deletion Order (Critical!)

### ALWAYS Delete Bottom-to-Top
```javascript
// ✅ CORRECT: Sort descending, delete from bottom
rowsToDelete.sort((a, b) => b - a);
rowsToDelete.forEach(row => sheet.deleteRow(row));

// ❌ WRONG: Delete from top (causes index shifting)
rowsToDelete.forEach(row => sheet.deleteRow(row));
```

**Why?** Deleting row 5 makes row 6 become row 5. If you delete top-to-bottom, you'll skip rows and delete wrong data.

---

## Common User Intents

### "Remove X" → Delete matching rows
```
User: "Remove cancelled products"
Action: FILTER_DATA
Params: { column: 'Status', operator: 'equals', value: 'cancelled' }
```

### "Keep only X" → Delete non-matching rows
```
User: "Keep only completed orders"
Action: FILTER_DATA
Params: { column: 'Status', operator: 'not_equals', value: 'completed' }
```

### "Delete empty X" → Remove blanks
```
User: "Delete rows with empty email"
Action: FILTER_DATA
Params: { column: 'Email', operator: 'empty', value: null }
```

### "Clean up duplicates"
```
User: "Remove duplicate products"
Action: DELETE_ROWS
Params: { column: 'Product', condition: 'duplicate', value: null }
```

---

## Data Cleaning Operations

### Trim Whitespace
```javascript
// CLEAN_DATA action
{ column: 'Name', operation: 'trim' }
// "  John  " → "John"
```

### Case Conversion
```javascript
// Uppercase
{ column: 'Code', operation: 'uppercase' }
// "abc123" → "ABC123"

// Lowercase
{ column: 'Email', operation: 'lowercase' }
// "USER@EXAMPLE.COM" → "user@example.com"
```

---

## Interpreting Schema for Filtering

### Use topValues to Verify
```javascript
// Schema shows:
{
  name: "Status",
  topValues: [
    { value: "pending", count: 50 },
    { value: "completed", count: 30 },
    { value: "cancelled", count: 2 }
  ]
}

// User: "Remove cancelled products"
// ✅ "cancelled" exists in topValues → safe to filter
// ✅ Only 2 rows will be deleted (low impact)
```

### Handle Missing Values
```javascript
// User: "Remove rejected orders"
// Schema topValues: ["pending", "completed", "cancelled"]
// ❌ "rejected" NOT in topValues

// Response: "No rows found with status 'rejected'. Available values: pending, completed, cancelled"
```

---

## User Feedback

### Good Feedback (Percentage Impact)
```
✅ "Deleted 5 rows (5% of data) where Status equals 'cancelled'"
✅ "Removed 120 rows (12% of data) where Price > 1000"
```

### Bad Feedback (Row Numbers)
```
❌ "Deleted rows: [3, 7, 12, 15, 20, 45, 67, ...]" (confusing for large datasets)
```

---

## Edge Cases

### Empty Dataset
```javascript
if (totalRows === 0) {
  return "No data rows to filter (sheet is empty)";
}
```

### No Matches Found
```javascript
if (rowsToDelete.length === 0) {
  return `No rows found where ${column} ${operator} "${value}"`;
}
```

### All Rows Match
```javascript
if (rowsToDelete.length === totalRows) {
  throw new Error(
    `⚠️ This would delete ALL ${totalRows} rows. ` +
    `Please verify the filter condition.`
  );
}
```

---

## Best Practices Summary

### DO:
- ✅ Use exact column names from schema
- ✅ Check topValues to verify value exists
- ✅ Delete rows bottom-to-top (descending order)
- ✅ Show percentage impact in feedback
- ✅ Warn if >50% of data will be deleted
- ✅ Validate column exists before filtering
- ✅ Handle case-insensitive matching

### DON'T:
- ❌ Delete rows top-to-bottom (causes index shifting)
- ❌ Show row numbers in feedback (confusing)
- ❌ Filter on columns that don't exist
- ❌ Delete all rows without warning
- ❌ Ignore empty/null values
- ❌ Use hardcoded column indices
