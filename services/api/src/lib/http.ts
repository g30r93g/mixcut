import type { APIGatewayProxyResult } from "aws-lambda";

const defaultHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "OPTIONS,GET,POST",
  "Content-Type": "application/json"
};

export function json(
  statusCode: number,
  body: unknown,
  extraHeaders: Record<string, string> = {}
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      ...defaultHeaders,
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

export function badRequest(message: string): APIGatewayProxyResult {
  return json(400, { error: message });
}

export function notFound(message = "Not found"): APIGatewayProxyResult {
  return json(404, { error: message });
}

export function methodNotAllowed(): APIGatewayProxyResult {
  return json(405, { error: "Method not allowed" });
}

export function internalError(message: string): APIGatewayProxyResult {
  return json(500, { error: message });
}
