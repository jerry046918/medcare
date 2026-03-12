/**
 * 从错误对象中安全提取错误消息
 * @param {Error} error - 错误对象
 * @param {string} defaultMessage - 默认消息
 * @returns {string}
 */
export function getErrorMessage(error, defaultMessage = '操作失败') {
  if (!error) {
    return defaultMessage;
  }

  // 优先使用 API 拦截器设置的 userMessage
  if (error.userMessage && typeof error.userMessage === 'string') {
    return error.userMessage;
  }

  // 检查 response.data.message
  const responseMessage = error.response?.data?.message;
  if (responseMessage) {
    return typeof responseMessage === 'string' ? responseMessage : JSON.stringify(responseMessage);
  }

  // 检查 response.data.error
  const responseError = error.response?.data?.error;
  if (responseError) {
    return typeof responseError === 'string' ? responseError : JSON.stringify(responseError);
  }

  // 检查 error.message
  if (error.message) {
    return typeof error.message === 'string' ? error.message : JSON.stringify(error.message);
  }

  return defaultMessage;
}

/**
 * 记录错误到控制台（开发环境）
 * @param {string} context - 上下文描述
 * @param {Error} error - 错误对象
 */
export function logError(context, error) {
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${context}]`, error);
  }
}

export default {
  getErrorMessage,
  logError
};
