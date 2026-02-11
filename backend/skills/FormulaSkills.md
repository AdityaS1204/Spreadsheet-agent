# Google Sheets Formula Best Practices

## Core Principles
- **Always use column letters with row numbers**: `A2`, `B2`, `C2`
- **Avoid hardcoded row numbers**: Use dynamic references
- **Handle edge cases**: Empty cells, division by zero, errors

---

## Common Formula Patterns

### Percentage Calculations
```
Growth Rate: =(New-Old)/Old*100
Percentage of Total: =Value/SUM($A$2:$A$100)*100
```

### Conditional Formulas
```
Basic IF: =IF(A2>100, "High", "Low")
Nested IF: =IF(A2="", "", IF(A2>100, "High", IF(A2>50, "Medium", "Low")))
IFS (cleaner): =IFS(A2>100, "High", A2>50, "Medium", TRUE, "Low")
```

### Text Manipulation
```
Concatenate: =A2&" "&B2
Or: =CONCAT(A2, " ", B2)
Or: =TEXTJOIN(" ", TRUE, A2:C2)
```

### Lookup Functions
```
VLOOKUP: =VLOOKUP(A2, DataRange, 2, FALSE)
INDEX/MATCH: =INDEX(ReturnRange, MATCH(LookupValue, LookupRange, 0))
```

### Array Formulas
```
Apply to entire column: =ARRAYFORMULA(A2:A*B2:B)
Conditional array: =ARRAYFORMULA(IF(A2:A="", "", A2:A*10))
```

---

## Error Prevention

### Division by Zero
```
Safe division: =IF(B2=0, 0, A2/B2)
Or: =IFERROR(A2/B2, 0)
```

### Empty Cell Handling
```
Check if blank: =IF(ISBLANK(A2), "", A2*10)
Skip blanks: =IF(A2="", "", calculation)
```

### Error Handling
```
Catch all errors: =IFERROR(formula, "Error")
Specific handling: =IF(ISERROR(formula), alternative, formula)
```

---

## Column Reference Best Practices

### Dynamic Ranges
```
Entire column from row 2: A2:A
Specific range: A2:A100
Absolute reference: $A$2:$A$100
```

### When Adding Formulas to New Columns
1. **Detect the base row** from the AI-provided formula (e.g., `H2` means base row is 2)
2. **Replace dynamically** for each row: `H2` → `H3`, `H4`, etc.
3. **Support column name syntax**: `[Price]*[Qty]` → `A2*B2`, `A3*B3`, etc.

---

## Best Practices for AI-Generated Formulas

### DO:
- ✅ Use relative references for row numbers (A2, not A$2)
- ✅ Include error handling for production formulas
- ✅ Use named ranges when possible for clarity
- ✅ Test formulas with edge cases (empty, zero, negative)

### DON'T:
- ❌ Hardcode row numbers (use dynamic references)
- ❌ Create circular references
- ❌ Use volatile functions (NOW, TODAY, RAND) unless necessary
- ❌ Ignore error cases

---

## Examples for Common Tasks

### Calculate Total Cost
```
Formula: =[Price]*[Qty]
Translates to: =A2*B2 (for row 2)
```

### Year-over-Year Growth
```
Formula: =IF(B1<>0, (B2-B1)/B1*100, 0)
Handles: Division by zero
```

### Conditional Formatting Helper
```
Formula: =IF(Status="Pending", "⏳", IF(Status="Completed", "✅", "❌"))
```

### Running Total
```
Formula: =SUM($A$2:A2)
Expands: Row 2: =SUM($A$2:A2), Row 3: =SUM($A$2:A3), etc.
```
