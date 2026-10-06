import type { AnalysisRequestArtifact, AnalysisResponseArtifact } from "./types";

export type AnalysisProviderMode = "saved_result" | "online";
export type AnalysisProviderStatus = "ready" | "disabled";
export type AnalysisProviderErrorCode =
  | "SAVED_ANALYSIS_RESULT_NOT_FOUND"
  | "PROVIDER_REQUEST_MISMATCH"
  | "ONLINE_PROVIDER_REQUIRES_SERVER_PROXY"
  | "ONLINE_PROVIDER_DISABLED"
  | "ONLINE_HTTP_ERROR"
  | "ONLINE_NETWORK_ERROR"
  | "ONLINE_TIMEOUT"
  | "ONLINE_RESPONSE_NOT_JSON"
  | "ONLINE_SCHEMA_VALIDATION_FAILED"
  | "ONLINE_REFERENCE_VALIDATION_FAILED"
  | "ONLINE_BUSINESS_VALIDATION_FAILED";

export interface AnalysisProviderCapability {
  status: AnalysisProviderStatus;
  strict_json: true;
  server_proxy_required: boolean;
  external_call_enabled: boolean;
  reason_code: AnalysisProviderErrorCode | null;
}

export interface AnalysisProviderError {
  code: AnalysisProviderErrorCode;
  message: string;
  retryable: boolean;
  fallback_allowed: boolean;
}

export type AnalysisProviderResult =
  | {
      ok: true;
      provider_id: string;
      mode: AnalysisProviderMode;
      model: string;
      prompt_version: string;
      response: AnalysisResponseArtifact;
    }
  | {
      ok: false;
      provider_id: string;
      mode: AnalysisProviderMode;
      error: AnalysisProviderError;
    };

export interface AnalysisProvider {
  readonly provider_id: string;
  readonly provider_name: string;
  readonly mode: AnalysisProviderMode;
  readonly model: string;
  readonly prompt_version: string;
  readonly timeout_ms: number;
  readonly capability: AnalysisProviderCapability;
  analyze(request: AnalysisRequestArtifact): Promise<AnalysisProviderResult>;
}

export interface SavedAnalysisProviderOptions {
  provider_id?: string;
  provider_name?: string;
  timeout_ms?: number;
}

export class SavedAnalysisProvider implements AnalysisProvider {
  readonly provider_id: string;
  readonly provider_name: string;
  readonly mode = "saved_result" as const;
  readonly model: string;
  readonly prompt_version: string;
  readonly timeout_ms: number;
  readonly capability: AnalysisProviderCapability = {
    status: "ready",
    strict_json: true,
    server_proxy_required: false,
    external_call_enabled: false,
    reason_code: null
  };

  constructor(
    private readonly savedResponse: AnalysisResponseArtifact | null | undefined,
    options: SavedAnalysisProviderOptions = {}
  ) {
    this.provider_id = options.provider_id ?? "saved-analysis-provider";
    this.provider_name = options.provider_name ?? "Saved Analysis Provider";
    this.model = savedResponse?.model_name ?? "unknown";
    this.prompt_version = savedResponse?.prompt_version ?? "unknown";
    this.timeout_ms = options.timeout_ms ?? 1_000;
  }

  async analyze(request: AnalysisRequestArtifact): Promise<AnalysisProviderResult> {
    if (!this.savedResponse) {
      return {
        ok: false,
        provider_id: this.provider_id,
        mode: this.mode,
        error: {
          code: "SAVED_ANALYSIS_RESULT_NOT_FOUND",
          message: "保存的 AI 分析结果不存在，未生成或伪造替代结果。",
          retryable: false,
          fallback_allowed: false
        }
      };
    }
    if (request.run_id !== this.savedResponse.run_id || request.prompt_version !== this.savedResponse.prompt_version) {
      return {
        ok: false,
        provider_id: this.provider_id,
        mode: this.mode,
        error: {
          code: "PROVIDER_REQUEST_MISMATCH",
          message: "保存结果与请求的 run_id 或 prompt_version 不匹配。",
          retryable: false,
          fallback_allowed: false
        }
      };
    }
    return {
      ok: true,
      provider_id: this.provider_id,
      mode: this.mode,
      model: this.model,
      prompt_version: this.prompt_version,
      response: structuredClone(this.savedResponse)
    };
  }
}

export type OnlineRequestFormat = "openai_compatible_json" | "provider_native_json";

export interface OnlineAnalysisProviderConfig {
  provider: string;
  base_url: string;
  model: string;
  prompt_version: string;
  request_format: OnlineRequestFormat;
  timeout_ms: number;
  server_proxy_url?: string | null;
}

export interface OnlineAnalysisCall {
  request: AnalysisRequestArtifact;
  config: OnlineAnalysisProviderConfig;
}

/** Phase 7 intentionally exposes a browser-safe, disabled contract only. */
export class OnlineAnalysisProvider implements AnalysisProvider {
  readonly provider_id: string;
  readonly provider_name: string;
  readonly mode = "online" as const;
  readonly model: string;
  readonly prompt_version: string;
  readonly timeout_ms: number;
  readonly capability: AnalysisProviderCapability;

  constructor(readonly config: OnlineAnalysisProviderConfig) {
    this.provider_id = `online-${config.provider}`;
    this.provider_name = `${config.provider} Online Analysis Provider`;
    this.model = config.model;
    this.prompt_version = config.prompt_version;
    this.timeout_ms = config.timeout_ms;
    this.capability = {
      status: "disabled",
      strict_json: true,
      server_proxy_required: true,
      external_call_enabled: false,
      reason_code: config.server_proxy_url ? "ONLINE_PROVIDER_DISABLED" : "ONLINE_PROVIDER_REQUIRES_SERVER_PROXY"
    };
  }

  async analyze(_request: AnalysisRequestArtifact): Promise<AnalysisProviderResult> {
    const requiresProxy = !this.config.server_proxy_url;
    return {
      ok: false,
      provider_id: this.provider_id,
      mode: this.mode,
      error: {
        code: requiresProxy ? "ONLINE_PROVIDER_REQUIRES_SERVER_PROXY" : "ONLINE_PROVIDER_DISABLED",
        message: requiresProxy
          ? "在线 Provider 需要安全服务端代理；本次演示未发起网络请求。"
          : "在线 Provider 仅完成接口契约，本阶段未启用真实模型调用。",
        retryable: false,
        fallback_allowed: true
      }
    };
  }
}

export interface ProviderExecutionResult {
  result: AnalysisProviderResult;
  fallback: {
    used: boolean;
    from_provider_id: string | null;
    to_provider_id: string | null;
    reason_code: AnalysisProviderErrorCode | null;
    message: string;
  };
}

export async function analyzeWithExplicitSavedFallback(input: {
  primary: AnalysisProvider;
  request: AnalysisRequestArtifact;
  savedFallback?: SavedAnalysisProvider;
  allowFallback?: boolean;
}): Promise<ProviderExecutionResult> {
  const primaryResult = await input.primary.analyze(input.request);
  if (primaryResult.ok || !input.allowFallback || !input.savedFallback) {
    return {
      result: primaryResult,
      fallback: {
        used: false,
        from_provider_id: null,
        to_provider_id: null,
        reason_code: primaryResult.ok ? null : primaryResult.error.code,
        message: primaryResult.ok ? "未发生 Provider 回退。" : "Provider 失败；未执行静默回退。"
      }
    };
  }

  const fallbackResult = await input.savedFallback.analyze(input.request);
  return {
    result: fallbackResult,
    fallback: {
      used: fallbackResult.ok,
      from_provider_id: input.primary.provider_id,
      to_provider_id: input.savedFallback.provider_id,
      reason_code: primaryResult.error.code,
      message: fallbackResult.ok ? "已明确切换至保存结果。" : "保存结果回退失败。"
    }
  };
}

export function describeProvider(provider: AnalysisProvider) {
  return {
    provider_id: provider.provider_id,
    provider_name: provider.provider_name,
    mode: provider.mode,
    model: provider.model,
    prompt_version: provider.prompt_version,
    timeout_ms: provider.timeout_ms,
    capability: provider.capability
  };
}
