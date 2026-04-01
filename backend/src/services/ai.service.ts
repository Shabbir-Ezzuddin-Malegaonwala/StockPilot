const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

interface AnalyzeRequest {
  name: string;
  current_stock: number;
  reorder_level: number;
  category?: string | null;
  recent_movements: Array<{
    movement_type: string;
    quantity: number;
    created_at: string;
  }>;
}

interface AnalyzeResponse {
  recommendation: string;
  suggested_order_quantity: number;
  reasoning: string;
  confidence_score: number;
}

export async function analyzeProduct(data: AnalyzeRequest): Promise<AnalyzeResponse> {
  const response = await fetch(`${AI_SERVICE_URL}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`AI service returned ${response.status}`);
  }

  return response.json();
}

export async function streamProcurementReport(
  products: Array<{
    name: string;
    sku: string;
    current_stock: number;
    reorder_level: number;
    category?: string | null;
    price: string;
  }>
): Promise<ReadableStream> {
  const response = await fetch(`${AI_SERVICE_URL}/generate-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ products }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    throw new Error(`AI service returned ${response.status}`);
  }

  if (!response.body) {
    throw new Error("No response body from AI service");
  }

  return response.body;
}
