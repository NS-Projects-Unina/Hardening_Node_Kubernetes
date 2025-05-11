  function sendError(res, statusCode, code, message, details = null) {
    return res.status(statusCode).json({
      error: {
        code,
        message,
        details
      }
    });
  }

  function sendErrorOTP(res, code) {
    const errorMap = {
      1: ['OTP_INVALID_USERID', 'Missing or malformed user ID'],
      2: ['OTP_INVALID_CODE_FORMAT', 'OTP code is missing or malformed'],
      3: ['OTP_NOT_ENABLED', 'Attempting operations on non-enabled OTP'],
      4: ['OTP_ALREADY_ENABLED', 'Attempting to enable already configured OTP'],
      5: ['OTP_SERVER_ERROR', 'Unexpected server-side errors'],
      6: ['OTP_SETUP_REQUIRED', 'Trying to verify without setup'],
      7: ['OTP_INVALID_CODE', 'Incorrect OTP code provided'],
      8: ['OTP_OPERATION_FAILED', 'Failed to complete the requested operation'],
      9: ['UNAUTHORIZED', 'Missing or invalid authentication'],
      10: ['OTP_FORBIDDEN', 'Insufficient permissions or access denied']
    };
  
    const [errorCode, message] = errorMap[code] || ['OTP_SERVER_ERROR', 'Unexpected server-side errors'];
    return sendError(res, 400, errorCode, message);
  }  

  function sendSuccess(res, message, data = null) {
    return res.status(200).json({
      success: true,
      message,
      data
    });
  }
  
  module.exports = { 
    sendError, 
    sendSuccess, 
    sendErrorOTP
  };