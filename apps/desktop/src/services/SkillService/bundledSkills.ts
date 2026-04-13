/**
 * Bundled Skills - Pre-packaged skills shipped with PyIDE
 */

import type { SkillDefinition } from '../../types/skill';

const EDA_SKILL = `---
name: eda
description: Perform exploratory data analysis on a DataFrame
allowed_tools: execute_python_code, inspect_variable
argument_hint: <variable_name>
when_to_use: When user loads a DataFrame or asks to explore data
---

# Exploratory Data Analysis (EDA) Skill

When invoked on a DataFrame, perform these steps systematically:

## 1. Basic Information
- Display shape (rows, columns)
- Show column names and data types
- Identify missing values per column
- Check for duplicate rows

## 2. Summary Statistics
- Generate descriptive statistics (mean, median, std, min, max, quartiles)
- For categorical columns: show value counts
- For numerical columns: show distribution characteristics

## 3. Data Quality Checks
- Identify columns with high missing value percentage (>50%)
- Detect potential outliers using IQR method
- Check for constant or near-constant columns
- Identify columns with unique values (potential IDs)

## 4. Initial Visualizations
- Create histograms for numerical columns
- Generate bar charts for top categorical variables
- Plot correlation heatmap for numerical features
- Create box plots to visualize distributions and outliers

## 5. Insights and Recommendations
- Summarize key findings
- Suggest potential data cleaning steps
- Recommend feature engineering opportunities
- Highlight interesting patterns or anomalies

Example usage: /eda my_dataframe
`;

const CLEAN_SKILL = `---
name: clean
description: Clean and preprocess a DataFrame
allowed_tools: execute_python_code, inspect_variable
argument_hint: <variable_name>
when_to_use: When user wants to clean messy data or handle missing values
---

# Data Cleaning Skill

When invoked, analyze the DataFrame and perform appropriate cleaning operations:

## 1. Missing Value Handling
- Identify columns with missing values
- Suggest strategies based on data type:
  - Numerical: mean/median imputation or interpolation
  - Categorical: mode imputation or 'Unknown' category
  - Time series: forward/backward fill
- Provide options: drop, impute, or flag

## 2. Duplicate Detection
- Check for exact duplicate rows
- Identify near-duplicates (similar but not identical)
- Suggest deduplication strategy

## 3. Data Type Corrections
- Detect columns with incorrect types (e.g., dates as strings)
- Convert to appropriate types
- Parse date/time columns with format detection

## 4. Outlier Treatment
- Detect outliers using statistical methods (Z-score, IQR)
- Offer treatment options: cap, remove, or transform
- Visualize before/after distributions

## 5. String Cleaning
- Strip whitespace from string columns
- Standardize case (lower/upper/title)
- Remove special characters if appropriate
- Handle encoding issues

## 6. Column Operations
- Rename columns for consistency (snake_case)
- Drop irrelevant or redundant columns
- Reorder columns logically

Always show before/after comparisons and allow user to approve changes.

Example usage: /clean my_dataframe
`;

const VIZ_SKILL = `---
name: viz
description: Create effective visualizations for data exploration
allowed_tools: execute_python_code, inspect_variable
argument_hint: <variable_name> [--type <chart_type>]
when_to_use: When user wants to visualize data or explore relationships
---

# Data Visualization Skill

When invoked, create appropriate visualizations based on data characteristics:

## Chart Selection Guide

### Univariate Analysis
- **Numerical**: Histogram, Box plot, Density plot
- **Categorical**: Bar chart, Pie chart (if <10 categories)
- **Time Series**: Line chart, Area chart

### Bivariate Analysis
- **Num vs Num**: Scatter plot, Hexbin, Correlation heatmap
- **Num vs Cat**: Box plot, Violin plot, Grouped bar chart
- **Cat vs Cat**: Stacked bar chart, Mosaic plot

### Multivariate Analysis
- **Multiple Numerical**: Pairplot, Parallel coordinates
- **Geospatial**: Choropleth map, Scatter map
- **Hierarchical**: Treemap, Sunburst chart

## Best Practices

1. **Choose Plotly** for interactive visualizations
2. **Add titles and labels** - always include descriptive axis labels
3. **Color schemes** - use colorblind-friendly palettes
4. **Annotations** - highlight key insights directly on charts
5. **Subplots** - organize related visualizations together
6. **Interactivity** - enable hover tooltips, zoom, pan

## Common Patterns

\`\`\`python
# Distribution
px.histogram(df, x='column', marginal='box')

# Relationship
px.scatter(df, x='col1', y='col2', color='category')

# Comparison
px.bar(df.groupby('category')['value'].mean().reset_index())

# Time series
px.line(df, x='date', y='value', color='series')
\`\`\`

Ask user about specific focus areas if not specified.

Example usage: /viz sales_data --type scatter
`;

const MODEL_SKILL = `---
name: model
description: Build and evaluate machine learning models
allowed_tools: execute_python_code, inspect_variable
argument_hint: <target_variable>
when_to_use: When user wants to build predictive models
---

# Machine Learning Modeling Skill

When invoked, guide through the ML workflow:

## 1. Problem Understanding
- Determine task type: classification, regression, clustering
- Identify target variable(s)
- Assess data readiness for modeling

## 2. Feature Engineering
- Encode categorical variables (OneHot, Label, Target encoding)
- Scale numerical features (StandardScaler, MinMaxScaler)
- Create interaction features if relevant
- Handle high-cardinality categoricals

## 3. Train-Test Split
- Use stratified split for classification
- Time-based split for time series
- Typical ratio: 80/20 or 70/30
- Set random_state for reproducibility

## 4. Model Selection

### Classification
- Baseline: Logistic Regression
- Tree-based: RandomForest, GradientBoosting, XGBoost
- Try multiple and compare

### Regression
- Baseline: Linear Regression
- Regularized: Ridge, Lasso, ElasticNet
- Tree-based: RandomForestRegressor, GradientBoostingRegressor

## 5. Training & Validation
- Use cross-validation (5-fold or 10-fold)
- Track metrics during training
- Implement early stopping if applicable

## 6. Evaluation

### Classification Metrics
- Accuracy, Precision, Recall, F1-Score
- ROC-AUC, PR-AUC
- Confusion Matrix visualization

### Regression Metrics
- MAE, MSE, RMSE, R²
- Residual plots
- Prediction vs Actual scatter

## 7. Hyperparameter Tuning
- GridSearchCV or RandomizedSearchCV
- Focus on most impactful parameters
- Use cross-validation scores

## 8. Model Interpretation
- Feature importance (tree-based models)
- SHAP values for detailed explanations
- Partial dependence plots

Provide code templates and explain each step.

Example usage: /model price
`;

const DEBUG_SKILL = `---
name: debug
description: Debug Python code errors and exceptions
allowed_tools: execute_python_code, inspect_variable
argument_hint: <error_message_or_code>
when_to_use: When code execution fails or produces unexpected results
---

# Debugging Skill

When invoked on an error, follow this systematic debugging approach:

## 1. Error Analysis
- Read the full traceback carefully
- Identify the error type (SyntaxError, TypeError, ValueError, etc.)
- Locate the exact line causing the error
- Understand what the error message means

## 2. Context Examination
- Check variable states at the error point
- Inspect data types of involved variables
- Review recent code changes
- Look for common patterns in the error

## 3. Common Error Patterns

### NameError
- Variable not defined or misspelled
- Check scope (local vs global)
- Verify imports

### TypeError
- Wrong data type for operation
- Function called with wrong arguments
- NoneType where object expected

### ValueError
- Invalid value for operation
- Shape mismatch in arrays/DataFrames
- Conversion failures

### KeyError/IndexError
- Accessing non-existent dictionary key
- Out-of-bounds list/array index
- Check data structure contents

### AttributeError
- Calling method on wrong object type
- Typo in method/attribute name
- Module not imported correctly

## 4. Debugging Strategies

### Print Debugging
\`\`\`python
print(f"Variable type: {type(var)}")
print(f"Variable value: {var}")
print(f"Variable shape: {var.shape if hasattr(var, 'shape') else 'N/A'}")
\`\`\`

### Isolate the Issue
- Create minimal reproducible example
- Test components separately
- Comment out sections to narrow down

### Check Assumptions
- Verify data shapes and types
- Confirm function signatures
- Validate input ranges

## 5. Solution Implementation
- Fix the root cause, not just symptoms
- Add defensive checks if appropriate
- Suggest best practices to prevent recurrence
- Test the fix thoroughly

## 6. Prevention Tips
- Use type hints
- Add input validation
- Write unit tests for critical functions
- Use linters (flake8, pylint)

Provide clear explanation of what went wrong and why the fix works.

Example usage: /debug
`;

export const BUNDLED_SKILLS: SkillDefinition[] = [
  {
    name: 'eda',
    description: 'Exploratory Data Analysis',
    content: EDA_SKILL,
    allowedTools: ['execute_python_code', 'inspect_variable'],
    argumentHint: '<variable_name>',
    whenToUse: 'When user loads a DataFrame or asks to explore data',
    source: 'bundled',
    directory: '/skills/bundled/eda'
  },
  {
    name: 'clean',
    description: 'Data Cleaning and Preprocessing',
    content: CLEAN_SKILL,
    allowedTools: ['execute_python_code', 'inspect_variable'],
    argumentHint: '<variable_name>',
    whenToUse: 'When user wants to clean messy data or handle missing values',
    source: 'bundled',
    directory: '/skills/bundled/clean'
  },
  {
    name: 'viz',
    description: 'Data Visualization',
    content: VIZ_SKILL,
    allowedTools: ['execute_python_code', 'inspect_variable'],
    argumentHint: '<variable_name> [--type <chart_type>]',
    whenToUse: 'When user wants to visualize data or explore relationships',
    source: 'bundled',
    directory: '/skills/bundled/viz'
  },
  {
    name: 'model',
    description: 'Machine Learning Modeling',
    content: MODEL_SKILL,
    allowedTools: ['execute_python_code', 'inspect_variable'],
    argumentHint: '<target_variable>',
    whenToUse: 'When user wants to build predictive models',
    source: 'bundled',
    directory: '/skills/bundled/model'
  },
  {
    name: 'debug',
    description: 'Code Debugging Assistant',
    content: DEBUG_SKILL,
    allowedTools: ['execute_python_code', 'inspect_variable'],
    argumentHint: '<error_message_or_code>',
    whenToUse: 'When code execution fails or produces unexpected results',
    source: 'bundled',
    directory: '/skills/bundled/debug'
  }
];

export function getBundledSkills(): SkillDefinition[] {
  return BUNDLED_SKILLS;
}
