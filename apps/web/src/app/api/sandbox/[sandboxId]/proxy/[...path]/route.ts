/**
 * Sandbox Proxy Catch-All - Handles all paths under the proxy
 *
 * This route catches all requests to /api/sandbox/{sandboxId}/proxy/*
 * and forwards them to the appropriate sandbox container.
 */

import { NextRequest, NextResponse } from "next/server";
import { createSandboxHosting } from "@crayon/core";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

// Create sandbox hosting instance
const sandboxHosting = createSandboxHosting({
  baseUrl: BASE_URL,
});

/**
 * Proxy request to sandbox container
 */
async function proxyRequest(
  request: NextRequest,
  sandboxId: string,
  path: string[]
): Promise<NextResponse> {
  try {
    // Get sandbox hosting info
    const hostInfo = await sandboxHosting.getHostInfo(sandboxId);

    if (hostInfo.status !== "running") {
      return new NextResponse("Sandbox not running", { status: 503 });
    }

    // Build target URL
    const targetPort = hostInfo.container.ports.frontend;
    const targetPath = path.length > 0 ? `/${path.join("/")}` : "/";
    let targetUrl = `http://localhost:${targetPort}${targetPath}`;

    // Add query params
    const searchParams = request.nextUrl.searchParams;
    if (searchParams.size > 0) {
      targetUrl = `${targetUrl}?${searchParams.toString()}`;
    }

    // Prepare request options
    const requestOptions: RequestInit = {
      method: request.method,
      headers: {
        ...Object.fromEntries(request.headers.entries()),
        host: `localhost:${targetPort}`,
      },
    };

    // Add body for non-GET requests
    if (request.method !== "GET" && request.method !== "HEAD") {
      requestOptions.body = await request.text();
    }

    // Forward the request
    const response = await fetch(targetUrl, requestOptions);

    // Copy response headers (excluding problematic ones)
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      const keyLower = key.toLowerCase();
      if (!["transfer-encoding", "connection", "keep-alive"].includes(keyLower)) {
        responseHeaders.set(key, value);
      }
    });

    // Add CORS headers for browser compatibility
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    responseHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    // Return proxied response
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Sandbox proxy error:", error);
    return new NextResponse(
      error instanceof Error ? error.message : "Internal server error",
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sandboxId: string; path: string[] }> }
) {
  const { sandboxId, path } = await params;
  return proxyRequest(request, sandboxId, path);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sandboxId: string; path: string[] }> }
) {
  const { sandboxId, path } = await params;
  return proxyRequest(request, sandboxId, path);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sandboxId: string; path: string[] }> }
) {
  const { sandboxId, path } = await params;
  return proxyRequest(request, sandboxId, path);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sandboxId: string; path: string[] }> }
) {
  const { sandboxId, path } = await params;
  return proxyRequest(request, sandboxId, path);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sandboxId: string; path: string[] }> }
) {
  const { sandboxId, path } = await params;
  return proxyRequest(request, sandboxId, path);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}
