package shared

import (
	"fmt"
	"net/http"

	"github.com/samber/lo"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	sharedv1 "paperdebugger/pkg/gen/api/shared/v1"
)

var (
	ErrUnknown            = makeErrorFunc(sharedv1.ErrorCode_ERROR_CODE_UNKNOWN)
	ErrInternal           = makeErrorFunc(sharedv1.ErrorCode_ERROR_CODE_INTERNAL)
	ErrBadRequest         = makeErrorFunc(sharedv1.ErrorCode_ERROR_CODE_BAD_REQUEST)
	ErrInvalidLLMResponse = makeErrorFunc(sharedv1.ErrorCode_ERROR_CODE_INVALID_LLM_RESPONSE)
	ErrRecordNotFound     = makeErrorFunc(sharedv1.ErrorCode_ERROR_CODE_RECORD_NOT_FOUND)
	ErrInvalidCredential  = makeErrorFunc(sharedv1.ErrorCode_ERROR_CODE_INVALID_CREDENTIAL)
	ErrInvalidToken       = makeErrorFunc(sharedv1.ErrorCode_ERROR_CODE_INVALID_TOKEN)
	ErrInvalidActor       = makeErrorFunc(sharedv1.ErrorCode_ERROR_CODE_INVALID_ACTOR)
	ErrPermissionDenied   = makeErrorFunc(sharedv1.ErrorCode_ERROR_CODE_PERMISSION_DENIED)
	ErrInvalidUser        = makeErrorFunc(sharedv1.ErrorCode_ERROR_CODE_INVALID_USER)
	ErrProjectOutOfDate   = makeErrorFunc(sharedv1.ErrorCode_ERROR_CODE_PROJECT_OUT_OF_DATE)
)

var codesMapHttpCode = map[codes.Code]int{
	// Default grpc codes
	codes.OK:                http.StatusOK,
	codes.Unknown:           http.StatusInternalServerError,
	codes.InvalidArgument:   http.StatusBadRequest,
	codes.DeadlineExceeded:  http.StatusRequestTimeout,
	codes.NotFound:          http.StatusNotFound,
	codes.AlreadyExists:     http.StatusConflict,
	codes.PermissionDenied:  http.StatusForbidden,
	codes.ResourceExhausted: http.StatusTooManyRequests,
	codes.Unimplemented:     http.StatusInternalServerError,
	codes.Internal:          http.StatusInternalServerError,
	codes.Unavailable:       http.StatusServiceUnavailable,
	codes.Unauthenticated:   http.StatusUnauthorized,
	// Custom error codes
	codes.Code(sharedv1.ErrorCode_ERROR_CODE_UNKNOWN):              http.StatusInternalServerError,
	codes.Code(sharedv1.ErrorCode_ERROR_CODE_INTERNAL):             http.StatusInternalServerError,
	codes.Code(sharedv1.ErrorCode_ERROR_CODE_BAD_REQUEST):          http.StatusBadRequest,
	codes.Code(sharedv1.ErrorCode_ERROR_CODE_INVALID_LLM_RESPONSE): http.StatusBadRequest,
	codes.Code(sharedv1.ErrorCode_ERROR_CODE_RECORD_NOT_FOUND):     http.StatusNotFound,
	codes.Code(sharedv1.ErrorCode_ERROR_CODE_INVALID_CREDENTIAL):   http.StatusUnauthorized,
	codes.Code(sharedv1.ErrorCode_ERROR_CODE_INVALID_TOKEN):        http.StatusUnauthorized,
	codes.Code(sharedv1.ErrorCode_ERROR_CODE_INVALID_ACTOR):        http.StatusUnauthorized,
	codes.Code(sharedv1.ErrorCode_ERROR_CODE_PERMISSION_DENIED):    http.StatusForbidden,
	codes.Code(sharedv1.ErrorCode_ERROR_CODE_INVALID_USER):         http.StatusUnauthorized,
	codes.Code(sharedv1.ErrorCode_ERROR_CODE_PROJECT_OUT_OF_DATE):  http.StatusBadRequest,
}

func makeErrorFunc(
	errorCode sharedv1.ErrorCode,
) func(details ...interface{}) error {
	return func(details ...interface{}) error {
		detail := lo.FirstOrEmpty(details)
		var errorMessage string
		switch v := detail.(type) {
		case error:
			errorMessage = v.Error()
		case interface{ String() string }:
			errorMessage = v.String()
		default:
			errorMessage = fmt.Sprintf("%v", v)
		}
		return status.Error(codes.Code(errorCode), errorMessage)
	}
}

func GetHTTPCode(err error) int {
	code := status.Code(err)
	httpCode, ok := codesMapHttpCode[code]
	if !ok {
		return http.StatusInternalServerError
	}
	return httpCode
}
