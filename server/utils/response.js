export const sendSuccess = (res, { message, data, httpStatus = 200, ...rest } = {}) =>
  res.status(httpStatus).json({
    success: true,
    message,
    ...(data === undefined ? {} : { data }),
    ...rest,
  });

export const sendError = (res, { message, httpStatus = 400, code, details } = {}) =>
  res.status(httpStatus).json({
    success: false,
    message,
    ...(code ? { code } : {}),
    ...(details ? { details } : {}),
  });
