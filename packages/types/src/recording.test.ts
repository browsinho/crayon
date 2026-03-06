import { describe, expect, it } from "vitest";
import {
  RecordingMetadataSchema,
  RecordingSchema,
  RecordingStatsSchema,
} from "./recording.js";

describe("RecordingStatsSchema", () => {
  it("accepts valid stats", () => {
    const stats = {
      domSnapshots: 10,
      networkCalls: 25,
      screenshots: 10,
    };
    expect(RecordingStatsSchema.parse(stats)).toEqual(stats);
  });

  it("accepts zero values", () => {
    const stats = {
      domSnapshots: 0,
      networkCalls: 0,
      screenshots: 0,
    };
    expect(RecordingStatsSchema.parse(stats)).toEqual(stats);
  });

  it("rejects negative values", () => {
    expect(() =>
      RecordingStatsSchema.parse({
        domSnapshots: -1,
        networkCalls: 0,
        screenshots: 0,
      })
    ).toThrow();
  });
});

describe("RecordingMetadataSchema", () => {
  it("accepts valid metadata", () => {
    const metadata = {
      id: "rec-001",
      createdAt: new Date().toISOString(),
      startUrl: "https://example.com",
      status: "recording" as const,
      stats: {
        domSnapshots: 5,
        networkCalls: 10,
        screenshots: 5,
      },
    };
    expect(RecordingMetadataSchema.parse(metadata)).toEqual(metadata);
  });

  it("accepts completed status", () => {
    const metadata = {
      id: "rec-001",
      createdAt: new Date().toISOString(),
      startUrl: "https://example.com",
      status: "completed" as const,
      stats: {
        domSnapshots: 5,
        networkCalls: 10,
        screenshots: 5,
      },
    };
    expect(RecordingMetadataSchema.parse(metadata)).toEqual(metadata);
  });

  it("rejects invalid status", () => {
    expect(() =>
      RecordingMetadataSchema.parse({
        id: "rec-001",
        createdAt: new Date().toISOString(),
        startUrl: "https://example.com",
        status: "pending",
        stats: {
          domSnapshots: 0,
          networkCalls: 0,
          screenshots: 0,
        },
      })
    ).toThrow();
  });
});

describe("RecordingSchema", () => {
  it("accepts valid recording", () => {
    const recording = {
      metadata: {
        id: "rec-001",
        createdAt: new Date().toISOString(),
        startUrl: "https://example.com",
        status: "completed" as const,
        stats: {
          domSnapshots: 1,
          networkCalls: 1,
          screenshots: 1,
        },
      },
      domSnapshots: [
        {
          id: "snap-001",
          timestamp: Date.now(),
          url: "https://example.com",
          type: "full" as const,
          html: "<html></html>",
          viewport: { width: 1920, height: 1080 },
        },
      ],
      networkCalls: [
        {
          id: "call-001",
          timestamp: Date.now(),
          request: {
            method: "GET",
            url: "https://api.example.com",
            headers: {},
          },
          response: {
            status: 200,
            headers: {},
            contentType: "application/json",
          },
        },
      ],
      screenshots: [
        {
          id: "ss-001",
          domSnapshotId: "snap-001",
          timestamp: Date.now(),
          path: "/screenshots/ss-001.png",
          width: 1920,
          height: 1080,
        },
      ],
    };
    expect(RecordingSchema.parse(recording)).toEqual(recording);
  });
});
