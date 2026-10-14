class HttpError extends Error {
  // details 可选：部分旧路由的 500 响应体带 error 字段（如 error.message），透传以保持响应结构一致
  constructor(status, message, details) {
    super(message);
    this.status = status;
    if (details !== undefined) {
      this.details = details;
    }
  }
}
module.exports = HttpError;
