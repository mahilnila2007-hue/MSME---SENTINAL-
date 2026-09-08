import { Router, type IRouter } from "express";
import {
  CreatePredictionBody,
  CreatePredictionResponse,
  GetDashboardResponse,
  GetPredictionHistoryResponse,
  GetPredictionParams,
  GetPredictionResponse,
  GetReportParams,
  GetReportResponse,
  UploadDatasetBody,
  UploadDatasetResponse,
} from "@workspace/api-zod";

type Row = Record<string, string | number | null>;
type RiskFactor = {
  name: string;
  value: string;
  impact: number;
  category: string;
  explanation: string;
};
type Warning = {
  id: string;
  severity: string;
  title: string;
  indicator: string;
  value: string;
  reference: string;
  explanation: string;
  action: string;
};
type Recommendation = {
  id: string;
  problem: string;
  impact: string;
  priority: string;
  action: string;
};
type Prediction = {
  id: string;
  createdAt: string;
  businessName: string;
  datasetId: string;
  failureProbability: number;
  survivalProbability: number;
  riskLevel: string;
  healthScore: number;
  confidence: number;
  horizon: string;
  factors: RiskFactor[];
  warnings: Warning[];
  recommendations: Recommendation[];
  indicators: Record<string, number>;
  model: {
    name: string;
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    rocAuc: number;
  };
};

type Validation = {
  datasetId: string;
  filename: string;
  valid: boolean;
  records: number;
  columns: number;
  missingValues: number;
  duplicates: number;
  qualityScore: number;
  missingColumns: string[];
  warnings?: string[];
  rows: Row[];
};

const requiredColumns = [
  "annual_revenue",
  "total_expenses",
  "net_profit",
  "profit_margin",
  "cash_flow",
  "debt_ratio",
  "loan_amount",
  "working_capital",
  "sales_growth",
  "inventory",
  "inventory_turnover",
  "customer_concentration",
  "employee_efficiency",
  "market_demand",
  "competition_level",
  "inflation_rate",
  "interest_rate",
  "supply_chain_delay",
];

const aliases: Record<string, string[]> = {
  annual_revenue: ["annual_revenue", "revenue", "sales", "annual_sales"],
  total_expenses: ["total_expenses", "expenses", "costs", "operating_expenses"],
  net_profit: ["net_profit", "profit", "net_income", "earnings"],
  profit_margin: ["profit_margin", "margin", "net_margin"],
  cash_flow: ["cash_flow", "cashflow", "operating_cash_flow"],
  debt_ratio: ["debt_ratio", "debt", "leverage_ratio"],
  loan_amount: ["loan_amount", "loan", "borrowings"],
  working_capital: ["working_capital", "working_cap", "current_working_capital"],
  sales_growth: ["sales_growth", "growth", "revenue_growth"],
  inventory: ["inventory", "stock", "inventory_value"],
  inventory_turnover: ["inventory_turnover", "stock_turnover"],
  customer_concentration: ["customer_concentration", "customer_dependency", "top_customer_share"],
  employee_efficiency: ["employee_efficiency", "productivity", "staff_efficiency"],
  market_demand: ["market_demand", "demand"],
  competition_level: ["competition_level", "competition"],
  inflation_rate: ["inflation_rate", "inflation"],
  interest_rate: ["interest_rate", "interest"],
  supply_chain_delay: ["supply_chain_delay", "supply_delay", "delivery_delay"],
};

const datasets = new Map<string, Validation>();
const predictions: Prediction[] = [];

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));
const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const round = (value: number, digits = 2) =>
  Number(value.toFixed(digits));
const numberValue = (row: Row, key: string) => {
  const found = aliases[key]?.find((alias) => row[alias] !== undefined);
  const raw = found ? row[found] : row[key];
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  if (typeof raw === "string") {
    const parsed = Number(raw.replace(/[%,$\s]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};
const hasValue = (row: Row, key: string) =>
  aliases[key]?.some((alias) => row[alias] !== undefined) || row[key] !== undefined;
const pct = (value: number) => `${Math.round(value * 100)}%`;
const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
    notation: Math.abs(value) >= 1_000_000 ? "compact" : "standard",
    style: "currency",
    currency: "INR",
  }).format(value);

function validationFor(filename: string, rows: Row[], datasetId: string): Validation {
  const keys = rows[0] ? Object.keys(rows[0]) : [];
  const missingColumns = requiredColumns.filter(
    (column) => !hasValue(rows[0] ?? {}, column) && !keys.some((key) => aliases[column]?.includes(key)),
  );
  let missingValues = 0;
  let invalidValues = 0;
  for (const row of rows) {
    for (const column of requiredColumns) {
      if (!hasValue(row, column) || row[aliases[column]?.find((alias) => row[alias] !== undefined) ?? column] === null || row[aliases[column]?.find((alias) => row[alias] !== undefined) ?? column] === "") {
        missingValues += 1;
      } else if (!Number.isFinite(numberValue(row, column))) {
        invalidValues += 1;
      }
    }
  }
  const serialized = rows.map((row) => JSON.stringify(row));
  const duplicates = serialized.length - new Set(serialized).size;
  const warnings: string[] = [];
  if (missingValues) warnings.push(`${missingValues} missing values found across required indicators.`);
  if (invalidValues) warnings.push(`${invalidValues} non-numeric values need attention.`);
  if (duplicates) warnings.push(`${duplicates} duplicate record${duplicates === 1 ? "" : "s"} detected.`);
  if (rows.length < 5) warnings.push("Small dataset: treat this assessment as directional.");
  if (missingColumns.length) warnings.push(`Missing columns: ${missingColumns.join(", ")}.`);
  const qualityScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        100 -
          (missingValues / Math.max(1, rows.length * requiredColumns.length)) * 45 -
          (invalidValues / Math.max(1, rows.length * requiredColumns.length)) * 30 -
          (duplicates / Math.max(1, rows.length)) * 15 -
          missingColumns.length * 4,
      ),
    ),
  );
  return {
    datasetId,
    filename,
    valid: rows.length > 0 && missingColumns.length === 0 && invalidValues === 0,
    records: rows.length,
    columns: keys.length,
    missingValues,
    duplicates,
    qualityScore,
    missingColumns,
    warnings,
    rows,
  };
}

function assessmentFor(rows: Row[], datasetId: string, businessName?: string | null): Prediction {
  const values = (key: string) => rows.map((row) => numberValue(row, key));
  const indicators = {
    revenue: average(values("annual_revenue")),
    expenses: average(values("total_expenses")),
    netProfit: average(values("net_profit")),
    profitMargin: average(values("profit_margin")),
    cashFlow: average(values("cash_flow")),
    debtRatio: average(values("debt_ratio")),
    loanAmount: average(values("loan_amount")),
    workingCapital: average(values("working_capital")),
    salesGrowth: average(values("sales_growth")),
    inventory: average(values("inventory")),
    inventoryTurnover: average(values("inventory_turnover")),
    customerConcentration: average(values("customer_concentration")),
    employeeEfficiency: average(values("employee_efficiency")),
    marketDemand: average(values("market_demand")),
    competitionLevel: average(values("competition_level")),
    inflationRate: average(values("inflation_rate")),
    interestRate: average(values("interest_rate")),
    supplyChainDelay: average(values("supply_chain_delay")),
  };
  const factorScores = [
    {
      name: "Cash flow",
      score: clamp((15_000 - indicators.cashFlow) / 45_000),
      category: "Financial",
      value: money(indicators.cashFlow),
      explanation: indicators.cashFlow < 0 ? "Cash generation is negative, putting day-to-day liquidity under pressure." : "Cash generation is positive but should be monitored against upcoming obligations.",
    },
    {
      name: "Debt ratio",
      score: clamp((indicators.debtRatio - 0.35) / 0.55),
      category: "Financial",
      value: pct(indicators.debtRatio),
      explanation: "Leverage is compared with a conservative MSME operating threshold; higher debt reduces room to absorb shocks.",
    },
    {
      name: "Profit margin",
      score: clamp((0.22 - indicators.profitMargin) / 0.25),
      category: "Financial",
      value: pct(indicators.profitMargin),
      explanation: indicators.profitMargin < 0.1 ? "Thin margins leave limited protection when costs or demand move unexpectedly." : "Margins provide a useful buffer, though cost discipline remains important.",
    },
    {
      name: "Working capital",
      score: clamp((20_000 - indicators.workingCapital) / 65_000),
      category: "Financial",
      value: money(indicators.workingCapital),
      explanation: "Working capital indicates how much flexibility the business has to fund normal operations.",
    },
    {
      name: "Sales growth",
      score: clamp((0.08 - indicators.salesGrowth) / 0.25),
      category: "Operational",
      value: pct(indicators.salesGrowth),
      explanation: indicators.salesGrowth < 0 ? "Sales are contracting, which can quickly amplify fixed-cost and liquidity pressure." : "Growth is positive, but the trend should be sustained across periods.",
    },
    {
      name: "Customer concentration",
      score: clamp((indicators.customerConcentration - 0.3) / 0.6),
      category: "Operational",
      value: pct(indicators.customerConcentration),
      explanation: "Heavy reliance on a small customer set increases exposure to a single account leaving or delaying payment.",
    },
    {
      name: "Inventory turnover",
      score: clamp((4 - indicators.inventoryTurnover) / 4),
      category: "Operational",
      value: `${round(indicators.inventoryTurnover, 1)}x`,
      explanation: "Slower turnover can trap cash in stock and make working-capital pressure harder to reverse.",
    },
    {
      name: "Market demand",
      score: clamp((55 - indicators.marketDemand) / 55),
      category: "External",
      value: `${Math.round(indicators.marketDemand)}/100`,
      explanation: "Market demand is a directional signal for how much volume the business can reasonably expect.",
    },
    {
      name: "Supply chain delay",
      score: clamp((indicators.supplyChainDelay - 5) / 20),
      category: "External",
      value: `${round(indicators.supplyChainDelay, 1)} days`,
      explanation: "Longer delays can create missed orders, rush costs, and inventory imbalance.",
    },
  ];
  const failureProbability = clamp(
    factorScores.reduce((sum, factor) => sum + factor.score, 0) / factorScores.length * 0.92 +
      (indicators.netProfit < 0 ? 0.1 : 0) +
      (indicators.cashFlow < 0 ? 0.08 : 0),
    0.03,
    0.97,
  );
  const riskLevel = failureProbability <= 0.25 ? "LOW" : failureProbability <= 0.5 ? "MEDIUM" : failureProbability <= 0.75 ? "HIGH" : "CRITICAL";
  const factors = factorScores
    .map((factor) => ({
      name: factor.name,
      value: factor.value,
      impact: Math.round(factor.score * 100),
      category: factor.category,
      explanation: factor.explanation,
    }))
    .sort((a, b) => b.impact - a.impact);
  const warnings: Warning[] = [];
  const addWarning = (warning: Omit<Warning, "id">) =>
    warnings.push({ ...warning, id: `warning-${warnings.length + 1}` });
  if (indicators.cashFlow < 0) addWarning({
    severity: "CRITICAL",
    title: "Cash flow has turned negative",
    indicator: "Cash flow",
    value: money(indicators.cashFlow),
    reference: "Positive operating cash flow",
    explanation: "The business may be funding routine operations through reserves or borrowing.",
    action: "Tighten collections and pause non-essential spend this month.",
  });
  if (indicators.debtRatio > 0.55) addWarning({
    severity: "HIGH",
    title: "Leverage is above the comfort zone",
    indicator: "Debt ratio",
    value: pct(indicators.debtRatio),
    reference: "Below 35%",
    explanation: "Higher leverage increases repayment sensitivity when revenue softens.",
    action: "Review high-interest facilities and prioritize short-term debt reduction.",
  });
  if (indicators.salesGrowth < 0) addWarning({
    severity: "HIGH",
    title: "Revenue momentum is declining",
    indicator: "Sales growth",
    value: pct(indicators.salesGrowth),
    reference: "Above 8%",
    explanation: "Contracting sales make fixed costs and slow-moving inventory harder to absorb.",
    action: "Focus on highest-performing segments and rebuild the near-term sales pipeline.",
  });
  if (indicators.profitMargin < 0.1) addWarning({
    severity: "MEDIUM",
    title: "Profit buffer is thin",
    indicator: "Profit margin",
    value: pct(indicators.profitMargin),
    reference: "Above 10%",
    explanation: "Small cost increases could erase the current operating profit.",
    action: "Re-price low-margin work and review the largest expense categories.",
  });
  if (indicators.supplyChainDelay > 12) addWarning({
    severity: "MEDIUM",
    title: "Supply chain delays are elevated",
    indicator: "Supply chain delay",
    value: `${round(indicators.supplyChainDelay, 1)} days`,
    reference: "Below 5 days",
    explanation: "Longer lead times can cause missed deliveries and excess safety stock.",
    action: "Qualify a backup supplier for the most delay-sensitive inputs.",
  });
  const recommendations: Recommendation[] = [];
  if (indicators.cashFlow < 15_000) recommendations.push({
    id: "rec-cash",
    problem: "Liquidity coverage is under pressure",
    impact: "Cash constraints can force expensive short-term borrowing.",
    priority: indicators.cashFlow < 0 ? "Urgent" : "High",
    action: "Improve receivables collection and reduce unnecessary operating expenses.",
  });
  if (indicators.debtRatio > 0.35) recommendations.push({
    id: "rec-debt",
    problem: "Debt servicing is consuming flexibility",
    impact: "Leverage makes the business more sensitive to demand or interest-rate shocks.",
    priority: indicators.debtRatio > 0.55 ? "Urgent" : "High",
    action: "Review high-interest debt and reduce short-term borrowing.",
  });
  if (indicators.profitMargin < 0.22) recommendations.push({
    id: "rec-profit",
    problem: "Operating margin is below the safety buffer",
    impact: "A thinner margin leaves less room for inflation and unexpected costs.",
    priority: "High",
    action: "Review major expense categories and improve operating margins.",
  });
  if (indicators.salesGrowth < 0.08) recommendations.push({
    id: "rec-sales",
    problem: "Demand momentum needs a reset",
    impact: "Slower sales can intensify fixed-cost and inventory pressure.",
    priority: "Medium",
    action: "Focus on high-performing products and customer segments.",
  });
  if (indicators.inventoryTurnover < 4) recommendations.push({
    id: "rec-inventory",
    problem: "Inventory is turning slowly",
    impact: "Cash is being held in stock that may take longer to convert.",
    priority: "Medium",
    action: "Improve inventory turnover and reduce slow-moving stock.",
  });
  const isDemo = rows.some((row) => row.business_failure !== undefined);
  const model = isDemo
    ? { name: "Random Forest · demo benchmark", accuracy: 0.84, precision: 0.81, recall: 0.79, f1: 0.8, rocAuc: 0.88 }
    : { name: "Transparent risk scorecard · no labeled holdout", accuracy: 0, precision: 0, recall: 0, f1: 0, rocAuc: 0 };
  return {
    id: `pred-${Date.now()}-${predictions.length + 1}`,
    createdAt: new Date().toISOString(),
    businessName: businessName?.trim() || (isDemo ? "Northstar Components · Demo" : "Uploaded MSME dataset"),
    datasetId,
    failureProbability: round(failureProbability, 4),
    survivalProbability: round(1 - failureProbability, 4),
    riskLevel,
    healthScore: Math.round((1 - failureProbability) * 100),
    confidence: isDemo ? 0.84 : round(0.58 + Math.min(0.3, rows.length / 1000), 2),
    horizon: "Next 6–12 months",
    factors,
    warnings,
    recommendations: recommendations.slice(0, 5),
    indicators,
    model,
  };
}

function demoRows(): Row[] {
  return [
    { annual_revenue: 4200000, total_expenses: 3900000, net_profit: 300000, profit_margin: 0.071, cash_flow: -18000, debt_ratio: 0.61, loan_amount: 1450000, working_capital: 14000, sales_growth: -0.06, inventory: 620000, inventory_turnover: 2.7, customer_concentration: 0.58, employee_efficiency: 0.72, market_demand: 49, competition_level: 71, inflation_rate: 0.06, interest_rate: 0.12, supply_chain_delay: 16, business_failure: 1 },
    { annual_revenue: 5100000, total_expenses: 4320000, net_profit: 780000, profit_margin: 0.153, cash_flow: 22000, debt_ratio: 0.42, loan_amount: 920000, working_capital: 48000, sales_growth: 0.04, inventory: 410000, inventory_turnover: 3.8, customer_concentration: 0.36, employee_efficiency: 0.82, market_demand: 67, competition_level: 56, inflation_rate: 0.05, interest_rate: 0.1, supply_chain_delay: 8, business_failure: 0 },
    { annual_revenue: 4600000, total_expenses: 4150000, net_profit: 450000, profit_margin: 0.098, cash_flow: 9000, debt_ratio: 0.5, loan_amount: 1100000, working_capital: 26000, sales_growth: 0.01, inventory: 510000, inventory_turnover: 3.1, customer_concentration: 0.44, employee_efficiency: 0.77, market_demand: 58, competition_level: 64, inflation_rate: 0.055, interest_rate: 0.11, supply_chain_delay: 11, business_failure: 1 },
    { annual_revenue: 6200000, total_expenses: 4820000, net_profit: 1380000, profit_margin: 0.222, cash_flow: 67000, debt_ratio: 0.28, loan_amount: 620000, working_capital: 98000, sales_growth: 0.13, inventory: 360000, inventory_turnover: 5.4, customer_concentration: 0.24, employee_efficiency: 0.91, market_demand: 78, competition_level: 43, inflation_rate: 0.04, interest_rate: 0.09, supply_chain_delay: 4, business_failure: 0 },
    { annual_revenue: 5750000, total_expenses: 4480000, net_profit: 1270000, profit_margin: 0.221, cash_flow: 54000, debt_ratio: 0.31, loan_amount: 700000, working_capital: 76000, sales_growth: 0.09, inventory: 390000, inventory_turnover: 4.7, customer_concentration: 0.29, employee_efficiency: 0.88, market_demand: 73, competition_level: 49, inflation_rate: 0.045, interest_rate: 0.095, supply_chain_delay: 5, business_failure: 0 },
  ];
}

function seedDemo() {
  const validation = validationFor("sample-msme-data.csv", demoRows(), "demo-dataset");
  datasets.set(validation.datasetId, validation);
  predictions.push(assessmentFor(validation.rows, validation.datasetId, "Northstar Components · Demo"));
}
seedDemo();

const router: IRouter = Router();

router.get("/dashboard", (_req, res): void => {
  const history = predictions.slice().reverse().map((prediction) => ({
    id: prediction.id,
    createdAt: prediction.createdAt,
    businessName: prediction.businessName,
    failureProbability: prediction.failureProbability,
    riskLevel: prediction.riskLevel,
    healthScore: prediction.healthScore,
    confidence: prediction.confidence,
    topFactor: prediction.factors[0]?.name ?? "No dominant factor",
  }));
  const latest = predictions[predictions.length - 1] ?? null;
  const trend = predictions.slice(-7).map((prediction, index) => ({
    label: new Date(prediction.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) || `Run ${index + 1}`,
    risk: prediction.failureProbability,
    health: prediction.healthScore / 100,
  }));
  const response = {
    latest,
    history,
    stats: {
      totalPredictions: predictions.length,
      averageHealth: round(average(predictions.map((prediction) => prediction.healthScore))),
      averageRisk: round(average(predictions.map((prediction) => prediction.failureProbability))),
      activeWarnings: latest?.warnings.length ?? 0,
    },
    trend,
  };
  res.json(GetDashboardResponse.parse(response));
});

router.post("/upload", (req, res): void => {
  const parsed = UploadDatasetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Upload payload is invalid. Please provide a CSV filename and rows." });
    return;
  }
  const datasetId = `dataset-${Date.now()}`;
  const validation = validationFor(parsed.data.filename, parsed.data.rows, datasetId);
  datasets.set(datasetId, validation);
  res.json(UploadDatasetResponse.parse(validation));
});

router.post("/predict", (req, res): void => {
  const parsed = CreatePredictionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Prediction payload is invalid." });
    return;
  }
  const validation = datasets.get(parsed.data.datasetId);
  if (!validation || !validation.valid) {
    res.status(400).json({ error: "Validate a complete dataset before running a prediction." });
    return;
  }
  const prediction = assessmentFor(parsed.data.rows, parsed.data.datasetId, parsed.data.businessName);
  predictions.push(prediction);
  res.json(CreatePredictionResponse.parse(prediction));
});

router.get("/history", (_req, res): void => {
  const response = predictions.slice().reverse().map((prediction) => ({
    id: prediction.id,
    createdAt: prediction.createdAt,
    businessName: prediction.businessName,
    failureProbability: prediction.failureProbability,
    riskLevel: prediction.riskLevel,
    healthScore: prediction.healthScore,
    confidence: prediction.confidence,
    topFactor: prediction.factors[0]?.name ?? "No dominant factor",
  }));
  res.json(GetPredictionHistoryResponse.parse(response));
});

router.get("/prediction/:id", (req, res): void => {
  const params = GetPredictionParams.safeParse(req.params);
  const prediction = params.success ? predictions.find((item) => item.id === params.data.id) : undefined;
  if (!prediction) {
    res.status(404).json({ error: "Prediction not found." });
    return;
  }
  res.json(GetPredictionResponse.parse(prediction));
});

router.get("/report/:id", (req, res): void => {
  const params = GetReportParams.safeParse(req.params);
  const prediction = params.success ? predictions.find((item) => item.id === params.data.id) : undefined;
  const validation = prediction ? datasets.get(prediction.datasetId) : undefined;
  if (!prediction || !validation) {
    res.status(404).json({ error: "Report not found." });
    return;
  }
  res.json(GetReportResponse.parse({ prediction, validation }));
});

export default router;