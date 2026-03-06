export interface GenerationOptions {
  frontend: "nextjs" | "react" | "vue";
  styling: "tailwind" | "css-modules";
  backend: "express" | "fastify" | "hono";
  database: "sqlite" | "postgres";
  includeSampleData: boolean;
  downloadAssets: boolean;
  generateTests: boolean;
}

export const defaultGenerationOptions: GenerationOptions = {
  frontend: "nextjs",
  styling: "tailwind",
  backend: "express",
  database: "sqlite",
  includeSampleData: true,
  downloadAssets: true,
  generateTests: false,
};

export interface AnalysisResults {
  framework: string;
  frameworkVersion?: string;
  auth: string | null;
  apiRoutes: number;
  widgets: string[];
  database: string | null;
  pages: string[];
  components: string[];
}

export interface GenerationResult {
  success: boolean;
  message: string;
}
