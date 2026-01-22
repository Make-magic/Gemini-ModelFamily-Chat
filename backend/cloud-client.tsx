// cloud-client.tsx
// version 2.3.0
// Build https://aistudio.google.com/apps/drive/1twd-9p3IDHB5TZ5_ytjec4aOJLOgZIt4?showAssistant=true&showPreview=true
// A browser-side proxy system that communicates with a local-side server via WebSocket
// to handle HTTP requests and return responses.

console.log("%c!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!", "color: red; font-size: 20px; font-weight: bold;");
console.log("%c!!! Cloud Client (backend/cloud-browser-client.tsx) IS RUNNING !!!", "color: red; font-size: 20px; font-weight: bold;");
console.log("%c!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!", "color: red; font-size: 20px; font-weight: bold;");

// Debug output module
const Logger = {
  enabled: true,
  
  output(...messages: any[]) {
    if (!this.enabled) return;
    
    const timestamp = this._getTimestamp();
    const logElement = document.createElement('div');
    logElement.textContent = `[${timestamp}] ${messages.join(' ')}`;
    document.body.appendChild(logElement);
  },
  
  _getTimestamp() {
    const now = new Date();
    // Using 'en-GB' for a 24-hour format that's widely understood.
    const time = now.toLocaleTimeString('en-GB', { hour12: false }); 
    const ms = now.getMilliseconds().toString().padStart(3, '0');
    return `${time}.${ms}`;
  }
};

function b64toBlob(b64Data: string, contentType = '', sliceSize = 512): Blob {
  const byteCharacters = atob(b64Data);
  const byteArrays = [];
  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }
  return new Blob(byteArrays, { type: contentType });
}

// WebSocket Connection Manager
class ConnectionManager extends EventTarget {
  endpoint: string;
  socket: WebSocket | null;
  isConnected: boolean;
  reconnectDelay: number;
  maxReconnectAttempts: number;
  reconnectAttempts: number;

  constructor(endpoint = 'ws://127.0.0.1:9998') {
    super();
    this.endpoint = endpoint;
    this.socket = null;
    this.isConnected = false;
    this.reconnectDelay = 5000;
    this.maxReconnectAttempts = Infinity;
    this.reconnectAttempts = 0;
  }
  
  async establish() {
    if (this.isConnected) {
      Logger.output('[ConnectionManager] Connection already exists.');
      return Promise.resolve();
    }
    
    Logger.output('[ConnectionManager] Establishing connection:', this.endpoint);
    
    return new Promise<void>((resolve, reject) => {
      this.socket = new WebSocket(this.endpoint);
      
      this.socket.addEventListener('open', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        Logger.output('[ConnectionManager] Connection established successfully.');
        this.dispatchEvent(new CustomEvent('connected'));
        resolve();
      });
      
      this.socket.addEventListener('close', () => {
        this.isConnected = false;
        Logger.output('[ConnectionManager] Connection closed, preparing to reconnect.');
        this.dispatchEvent(new CustomEvent('disconnected'));
        this._scheduleReconnect();
      });
      
      this.socket.addEventListener('error', (error) => {
        Logger.output('[ConnectionManager] Connection error:', error);
        this.dispatchEvent(new CustomEvent('error', { detail: error }));
        if (!this.isConnected) reject(error);
      });
      
      this.socket.addEventListener('message', (event) => {
        this.dispatchEvent(new CustomEvent('message', { detail: event.data }));
      });
    });
  }
  
  transmit(data: any) {
    if (!this.isConnected || !this.socket) {
      Logger.output('[ConnectionManager] Cannot send data: connection not established.');
      return false;
    }
    
    this.socket.send(JSON.stringify(data));
    return true;
  }
  
  _scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      Logger.output('[ConnectionManager] Reached maximum reconnect attempts.');
      return;
    }
    
    this.reconnectAttempts++;
    setTimeout(() => {
      Logger.output(`[ConnectionManager] Reconnect attempt ${this.reconnectAttempts}`);
      this.establish().catch(() => {});
    }, this.reconnectDelay);
  }
}

// HTTP Request Processor
class RequestProcessor {
  activeOperations: Map<string, AbortController>;
  targetDomain: string;

  constructor() {
    this.activeOperations = new Map();
    this.targetDomain = 'generativelanguage.googleapis.com';
  }
  
  async execute(requestSpec: any, operationId: string) {
    Logger.output('[RequestProcessor] Executing request:', requestSpec.method, requestSpec.url || requestSpec.path);
    
    try {
      const abortController = new AbortController();
      this.activeOperations.set(operationId, abortController);
      
      const requestUrl = this._constructUrl(requestSpec);
      const requestConfig = this._buildRequestConfig(requestSpec, abortController.signal);
      
      const response = await fetch(requestUrl, requestConfig);
      
      // Note: We don't throw on !response.ok here to allow the proxy to pass back 4xx/5xx responses intact
      
      return response;
    } catch (error: any) {
      Logger.output('[RequestProcessor] Request execution failed:', error.message);
      throw error;
    } finally {
      this.activeOperations.delete(operationId);
    }
  }
  
  cancelOperation(operationId: string) {
    const controller = this.activeOperations.get(operationId);
    if (controller) {
      controller.abort();
      this.activeOperations.delete(operationId);
      Logger.output('[RequestProcessor] Operation cancelled:', operationId);
    }
  }
  
  cancelAllOperations() {
    this.activeOperations.forEach((controller, id) => {
      controller.abort();
      Logger.output('[RequestProcessor] Cancelling operation:', id);
    });
    this.activeOperations.clear();
  }
  
  _constructUrl(requestSpec: any) {
    let pathAndQuery = requestSpec.url;

    if (!pathAndQuery) {
        const pathSegment = requestSpec.path || '';
        const queryParams = new URLSearchParams(requestSpec.query_params);
        const queryString = queryParams.toString();
        pathAndQuery = `${pathSegment}${queryString ? '?' + queryString : ''}`;
    }

    if (pathAndQuery.match(/^https?:\/\//)) {
        try {
            const urlObj = new URL(pathAndQuery);
            const originalUrl = pathAndQuery;
            pathAndQuery = urlObj.pathname + urlObj.search;
            Logger.output(`[RequestProcessor] Rewriting absolute URL: ${originalUrl} -> ${pathAndQuery}`);
        } catch (e: any) {
            Logger.output('[RequestProcessor] URL parsing warning:', e.message);
        }
    }

    let targetHost = this.targetDomain;
    if (pathAndQuery.includes('__proxy_host__=')) {
        try {
            const tempUrl = new URL(pathAndQuery, 'http://dummy');
            const params = tempUrl.searchParams;
            if (params.has('__proxy_host__')) {
                targetHost = params.get('__proxy_host__')!;
                params.delete('__proxy_host__');
                pathAndQuery = tempUrl.pathname + tempUrl.search;
                Logger.output(`[RequestProcessor] Dynamically switching target host: ${targetHost}`);
            }
        } catch (e: any) {
             Logger.output('[RequestProcessor] Failed to parse proxy host:', e.message);
        }
    }

    let cleanPath = pathAndQuery.replace(/^\/+/, '');
    
    const method = requestSpec.method ? requestSpec.method.toUpperCase() : 'GET';
    
    if (this.targetDomain.includes('generativelanguage')) {
         const versionRegex = /v1[a-z0-9]*\/files/;
         const uploadMatch = cleanPath.match(new RegExp(`upload\/${versionRegex.source}`));
         
         if (uploadMatch) {
             const index = cleanPath.indexOf('upload/'); // 查找通用的 upload 前缀
             if (index > 0) {
                 const fixedPath = cleanPath.substring(index);
                 Logger.output(`[RequestProcessor] Corrected path: ${cleanPath} -> ${fixedPath}`);
                 cleanPath = fixedPath;
             }
         } 
         else if (method === 'POST') {
            // 检测是否以版本号开头且紧跟 files，例如 v1beta/files 或 v1/files
            const filesPathMatch = cleanPath.match(new RegExp(`^${versionRegex.source}`));
            if (filesPathMatch) {
              cleanPath = 'upload/' + cleanPath;
              Logger.output('[RequestProcessor] Auto-completing upload path:', cleanPath);
         }
    }
    }
    const finalUrl = `https://${targetHost}/${cleanPath}`;
    Logger.output(`[RequestProcessor] Constructed URL: ${pathAndQuery} -> ${finalUrl}`);
    return finalUrl;
  }
  
  _buildRequestConfig(requestSpec: any, signal: AbortSignal) {
    const config: any = {
      method: requestSpec.method,
      headers: this._sanitizeHeaders(requestSpec.headers),
      signal
    };
    
    if (['POST', 'PUT', 'PATCH'].includes(requestSpec.method) && requestSpec.body != null) {
      config.body = requestSpec.body;
    }
    
    return config;
  }
  
  _sanitizeHeaders(headers: any) {
    const sanitized = { ...headers };
    const forbiddenHeaders = [
      'host', 'connection', 'content-length', /* 'origin', */
      'referer', 'user-agent', 'sec-fetch-mode',
      'sec-fetch-site', 'sec-fetch-dest'
    ];
    
    forbiddenHeaders.forEach(header => delete sanitized[header]);
    return sanitized;
  }
}

// Stream Response Handler
class StreamHandler {
  communicator: ConnectionManager;

  constructor(communicator: ConnectionManager) {
    this.communicator = communicator;
  }
  
  async processStream(response: Response, operationId: string, proxyHost?: string) {
    const contentType = response.headers.get('content-type') || '';
    
    // --- 核心修复逻辑开始 ---
    // 1. 定义什么是明确的"二进制"文件。
    //    Gemini API 的流式响应 (streamGenerateContent) 即使是复杂的，也是 text/event-stream。
    //    只有图片/视频生成下载时才是 binary。
    const isExplicitBinary = contentType.includes('image/') || 
                             contentType.includes('video/') || 
                             contentType.includes('audio/') ||
                             contentType.includes('application/octet-stream');
    
    // 2. 默认一切皆文本 (Is Text unless Explicit Binary)
    //    这解决了 Content-Type 丢失或被识别为 application/grpc 等情况的问题
    const isText = !isExplicitBinary;

    if (isExplicitBinary) {
      Logger.output('[StreamHandler] Detected binary response:', contentType);
    } else {
      // 调试日志：确认被视为文本
      // Logger.output('[StreamHandler] Treating response as text. Content-Type:', contentType);
    }
    // --- 核心修复逻辑结束 ---
    
    this._transmitHeaders(response, operationId, proxyHost);
    
    if (!response.body) {
        Logger.output('[StreamHandler] No response body.');
        this._transmitStreamEnd(operationId);
        return;
    }

    const reader = response.body.getReader();
    const textDecoder = new TextDecoder();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // 确保流正常结束
          Logger.output('[StreamHandler] Stream processing complete.');
          this._transmitStreamEnd(operationId);
          break;
        }
        
        if (isText) {
          // 文本模式：解码为字符串发送
          // stream: true 选项处理多字节字符被切割的情况
          const textChunk = textDecoder.decode(value, { stream: true });
          if (textChunk) {
             this._transmitChunk(textChunk, operationId);
          }
        } else {
          // 二进制模式：转为 Base64 发送
          // 只有在生成图片/视频文件下载时才会用到
          const base64Chunk = btoa(
            new Uint8Array(value).reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
          this._transmitChunk(base64Chunk, operationId);
        }
      }
    } catch (error: any) {
      Logger.output('[StreamHandler] Stream processing error:', error.message);
      // 发生错误时也要尝试结束流，防止客户端无限挂起
      this._transmitStreamEnd(operationId);
      throw error;
    }
  }
  
  _transmitHeaders(response: Response, operationId: string, proxyHost?: string) {
    const headerMap: any = {};
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      // 保持原有的 Header 重写逻辑不变
      if ((lowerKey === 'location' || lowerKey === 'x-goog-upload-url') && value.includes('googleapis.com')) {
          try {
              const urlObj = new URL(value);
              const host = proxyHost || '127.0.0.1:8889'; // 您的默认端口
              const separator = urlObj.search ? '&' : '?';
              const newSearch = `${urlObj.search}${separator}__proxy_host__=${urlObj.host}`;
              const newUrl = `http://${host}${urlObj.pathname}${newSearch}`;
              headerMap[key] = newUrl;
          } catch (e) {
              headerMap[key] = value;
          }
      } else {
          headerMap[key] = value;
      }
    });
    
    const headerMessage = {
      request_id: operationId,
      event_type: 'response_headers',
      status: response.status,
      headers: headerMap
    };
    
    this.communicator.transmit(headerMessage);
    // Logger.output('[StreamHandler] Response headers transmitted.');
  }
  
  _transmitChunk(chunk: string, operationId: string) {
    const chunkMessage = {
      request_id: operationId,
      event_type: 'chunk',
      data: chunk
    };
    this.communicator.transmit(chunkMessage);
  }
  
  _transmitStreamEnd(operationId: string) {
    const endMessage = {
      request_id: operationId,
      event_type: 'stream_close'
    };
    this.communicator.transmit(endMessage);
  }
}

// Main Proxy System
class ProxySystem extends EventTarget {
  connectionManager: ConnectionManager;
  requestProcessor: RequestProcessor;
  streamHandler: StreamHandler;

  constructor(websocketEndpoint?: string) {
    super();
    this.connectionManager = new ConnectionManager(websocketEndpoint);
    this.requestProcessor = new RequestProcessor();
    this.streamHandler = new StreamHandler(this.connectionManager);
    
    this._setupEventHandlers();
  }
  
  async initialize() {
    Logger.output('[ProxySystem] System initializing...');
    
    try {
      await this.connectionManager.establish();
      Logger.output('[ProxySystem] System initialization complete.');
      this.dispatchEvent(new CustomEvent('ready'));
    } catch (error: any) {
      Logger.output('[ProxySystem] System initialization failed:', error.message);
      this.dispatchEvent(new CustomEvent('error', { detail: error }));
      throw error;
    }
  }
  
  _setupEventHandlers() {
    this.connectionManager.addEventListener('message', (event: any) => {
      this._handleIncomingMessage(event.detail);
    });
    
    this.connectionManager.addEventListener('disconnected', () => {
      this.requestProcessor.cancelAllOperations();
    });
  }
  
  async _handleIncomingMessage(messageData: string) {
    let requestSpec: any = null;
    try {
      requestSpec = JSON.parse(messageData);
      Logger.output('[ProxySystem] Received request:', requestSpec.method, requestSpec.path);
      
      const { headers, body_b64 } = requestSpec;

      if (body_b64) {
        if (headers) {
            const contentLengthKey = Object.keys(headers).find(k => k.toLowerCase() === 'content-length');
            if (contentLengthKey) {
                delete headers[contentLengthKey];
                Logger.output("[ProxySystem] Removed 'content-length' header.");
            }
        }
        
        const contentType = headers?.['content-type'] || '';
        requestSpec.body = b64toBlob(body_b64, contentType);
        
        delete requestSpec.body_b64;
      }

      await this._processProxyRequest(requestSpec);
    } catch (error: any) {
      Logger.output('[ProxySystem] Message handling error:', error.message);
      this._sendErrorResponse(error, requestSpec?.request_id);
    }
  }
  
  async _processProxyRequest(requestSpec: any) {
    const operationId = requestSpec.request_id;
    
    let proxyHost: string | undefined;
    if (requestSpec.headers) {
        const hostKey = Object.keys(requestSpec.headers).find(k => k.toLowerCase() === 'host');
        if (hostKey) proxyHost = requestSpec.headers[hostKey];
    }
    
    try {
      const response = await this.requestProcessor.execute(requestSpec, operationId);
      await this.streamHandler.processStream(response, operationId, proxyHost);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        Logger.output('[ProxySystem] Request was aborted.');
      } else {
        this._sendErrorResponse(error, operationId);
      }
    }
  }
  
  _sendErrorResponse(error: any, operationId: string) {
    if (!operationId) {
      Logger.output('[ProxySystem] Cannot send error response: missing operation ID.');
      return;
    }
    
    const errorMessage = {
      request_id: operationId,
      event_type: 'error',
      status: 500,
      message: `Proxy system error: ${error.message || 'Unknown error'}`
    };
    
    this.connectionManager.transmit(errorMessage);
    Logger.output('[ProxySystem] Error response sent.');
  }
}

// System startup function
async function initializeProxySystem() {
  const proxySystem = new ProxySystem();
  
  try {
    await proxySystem.initialize();
    console.log('Browser proxy system started successfully.');
  } catch (error) {
    console.error('Proxy system failed to start:', error);
  }
}

// Start the system
initializeProxySystem();
