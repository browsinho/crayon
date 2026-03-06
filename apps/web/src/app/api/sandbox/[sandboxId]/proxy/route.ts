/**
 * Sandbox Proxy - Reverse proxy for sandbox containers
 *
 * Routes all requests to the sandbox's Docker container frontend port.
 * Supports WebSocket connections for Vite HMR (hot module reload).
 */

import { NextRequest, NextResponse } from "next/server";
import { createSandboxHosting } from "@crayon/core";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

// Create sandbox hosting instance
const sandboxHosting = createSandboxHosting({
  baseUrl: BASE_URL,
});

/**
 * Handle GET requests - proxy to sandbox container
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sandboxId: string }> }
) {
  try {
    const { sandboxId } = await params;

    // Get sandbox hosting info
    const hostInfo = await sandboxHosting.getHostInfo(sandboxId);

    if (hostInfo.status !== "running") {
      return new NextResponse("Sandbox not running", { status: 503 });
    }

    // Build target URL (proxy to frontend port)
    const targetPort = hostInfo.container.ports.frontend;
    const targetUrl = `http://localhost:${targetPort}${request.nextUrl.pathname.replace(`/api/sandbox/${sandboxId}/proxy`, "")}`;

    // Add query params
    const searchParams = request.nextUrl.searchParams;
    const targetUrlWithParams = searchParams.size > 0
      ? `${targetUrl}?${searchParams.toString()}`
      : targetUrl;

    // Forward the request
    const response = await fetch(targetUrlWithParams, {
      method: "GET",
      headers: {
        ...Object.fromEntries(request.headers.entries()),
        // Remove Next.js specific headers
        host: `localhost:${targetPort}`,
      },
    });

    // Copy response headers
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      // Skip certain headers that shouldn't be forwarded
      if (!["transfer-encoding", "connection"].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    // Add CORS headers
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
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

/**
 * Handle POST requests - proxy to sandbox container
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sandboxId: string }> }
) {
  try {
    const { sandboxId } = await params;

    // Get sandbox hosting info
    const hostInfo = await sandboxHosting.getHostInfo(sandboxId);

    if (hostInfo.status !== "running") {
      return new NextResponse("Sandbox not running", { status: 503 });
    }

    // Build target URL
    const targetPort = hostInfo.container.ports.frontend;
    const targetUrl = `http://localhost:${targetPort}${request.nextUrl.pathname.replace(`/api/sandbox/${sandboxId}/proxy`, "")}`;

    // Forward the request with body
    const body = await request.text();
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        ...Object.fromEntries(request.headers.entries()),
        host: `localhost:${targetPort}`,
      },
      body,
    });

    // Copy response headers
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      if (!["transfer-encoding", "connection"].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    // Add CORS headers
    responseHeaders.set("Access-Control-Allow-Origin", "*");

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

/**
 * Handle PUT requests - proxy to sandbox container
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sandboxId: string }> }
) {
  try {
    const { sandboxId } = await params;

    // Get sandbox hosting info
    const hostInfo = await sandboxHosting.getHostInfo(sandboxId);

    if (hostInfo.status !== "running") {
      return new NextResponse("Sandbox not running", { status: 503 });
    }

    // Build target URL
    const targetPort = hostInfo.container.ports.frontend;
    const targetUrl = `http://localhost:${targetPort}${request.nextUrl.pathname.replace(`/api/sandbox/${sandboxId}/proxy`, "")}`;

    // Forward the request with body
    const body = await request.text();
    const response = await fetch(targetUrl, {
      method: "PUT",
      headers: {
        ...Object.fromEntries(request.headers.entries()),
        host: `localhost:${targetPort}`,
      },
      body,
    });

    // Copy response headers
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      if (!["transfer-encoding", "connection"].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    // Add CORS headers
    responseHeaders.set("Access-Control-Allow-Origin", "*");

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

/**
 * Handle DELETE requests - proxy to sandbox container
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sandboxId: string }> }
) {
  try {
    const { sandboxId } = await params;

    // Get sandbox hosting info
    const hostInfo = await sandboxHosting.getHostInfo(sandboxId);

    if (hostInfo.status !== "running") {
      return new NextResponse("Sandbox not running", { status: 503 });
    }

    // Build target URL
    const targetPort = hostInfo.container.ports.frontend;
    const targetUrl = `http://localhost:${targetPort}${request.nextUrl.pathname.replace(`/api/sandbox/${sandboxId}/proxy`, "")}`;

    // Forward the request
    const response = await fetch(targetUrl, {
      method: "DELETE",
      headers: {
        ...Object.fromEntries(request.headers.entries()),
        host: `localhost:${targetPort}`,
      },
    });

    // Copy response headers
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      if (!["transfer-encoding", "connection"].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    // Add CORS headers
    responseHeaders.set("Access-Control-Allow-Origin", "*");

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

/**
 * Handle OPTIONS requests - CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}
