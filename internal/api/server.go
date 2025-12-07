package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"

	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/libs/metadatautil"
	"paperdebugger/internal/libs/shared"
	authv1 "paperdebugger/pkg/gen/api/auth/v1"
	chatv1 "paperdebugger/pkg/gen/api/chat/v1"
	commentv1 "paperdebugger/pkg/gen/api/comment/v1"
	projectv1 "paperdebugger/pkg/gen/api/project/v1"
	sharedv1 "paperdebugger/pkg/gen/api/shared/v1"
	userv1 "paperdebugger/pkg/gen/api/user/v1"

	"github.com/gin-gonic/gin"
	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
)

type Server struct {
	grpcServer *GrpcServer
	ginServer  *GinServer

	logger *logger.Logger
}

func NewServer(
	grpcServer *GrpcServer,
	ginServer *GinServer,
	logger *logger.Logger,
) *Server {
	return &Server{
		grpcServer: grpcServer,
		ginServer:  ginServer,
		logger:     logger,
	}
}

func (s *Server) Run(addr string) {
	listener, err := net.Listen("tcp", ":0")
	if err != nil {
		s.logger.Fatalf("failed to start grpc server listener: %v", err)
		return
	}

	port := listener.Addr().(*net.TCPAddr).Port
	go func() {
		if err := s.grpcServer.Serve(listener); err != nil {
			s.logger.Fatalf("failed to start grpc server: %v", err)
		}
	}()

	opts := []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}
	client, err := grpc.NewClient(fmt.Sprintf(":%d", port), opts...)
	if err != nil {
		s.logger.Fatalf("failed to start grpc client: %v", err)
		return
	}

	mux := runtime.NewServeMux(
		runtime.WithMetadata(s.metadataAnnotator()),
		runtime.WithForwardResponseOption(s.forwardResponseOption()),
		runtime.WithErrorHandler(s.errorHandler()),
	)

	err = authv1.RegisterAuthServiceHandler(context.Background(), mux, client)
	if err != nil {
		s.logger.Fatalf("failed to register auth service grpc gateway: %v", err)
		return
	}
	err = chatv1.RegisterChatServiceHandler(context.Background(), mux, client)
	if err != nil {
		s.logger.Fatalf("failed to register chat service grpc gateway: %v", err)
		return
	}
	err = userv1.RegisterUserServiceHandler(context.Background(), mux, client)
	if err != nil {
		s.logger.Fatalf("failed to register user service grpc gateway: %v", err)
		return
	}
	err = projectv1.RegisterProjectServiceHandler(context.Background(), mux, client)
	if err != nil {
		s.logger.Fatalf("failed to register project service grpc gateway: %v", err)
		return
	}
	err = commentv1.RegisterCommentServiceHandler(context.Background(), mux, client)
	if err != nil {
		s.logger.Fatalf("failed to register comment service grpc gateway: %v", err)
		return
	}

	s.logger.Infof("[PAPERDEBUGGER] http server listening on %s", addr)
	s.ginServer.Any("/_pd/api/*path", func(c *gin.Context) { mux.ServeHTTP(c.Writer, c.Request) })
	err = s.ginServer.Run(addr)
	if err != nil {
		s.logger.Fatalf("failed to start http server: %v", err)
	}
}

func (s *Server) metadataAnnotator() func(ctx context.Context, req *http.Request) metadata.MD {
	return func(ctx context.Context, req *http.Request) metadata.MD {
		md := metadata.New(map[string]string{})

		cookie, err := req.Cookie("token")
		if err == nil {
			metadatautil.SetAuthToken(md, cookie.Value)
		}

		authHeader := req.Header.Get("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			token := strings.TrimPrefix(authHeader, "Bearer ")
			metadatautil.SetAuthToken(md, token)
		}

		return md
	}
}

func (s *Server) forwardResponseOption() func(ctx context.Context, w http.ResponseWriter, msg proto.Message) error {
	return func(ctx context.Context, w http.ResponseWriter, msg proto.Message) error {
		md, ok := runtime.ServerMetadataFromContext(ctx)
		if !ok {
			return nil
		}

		// Set cookies
		cookies := md.HeaderMD.Get("x-http-set-cookie")
		if len(cookies) > 0 {
			for _, cookie := range cookies {
				w.Header().Add("Set-Cookie", cookie)
			}
			delete(md.HeaderMD, "x-http-set-cookie")
			delete(w.Header(), "Grpc-Metadata-X-Http-Set-Cookie")
		}

		return nil
	}
}

func (s *Server) errorHandler() func(ctx context.Context, mux *runtime.ServeMux, marshaler runtime.Marshaler, w http.ResponseWriter, r *http.Request, err error) {
	return func(ctx context.Context, mux *runtime.ServeMux, marshaler runtime.Marshaler, w http.ResponseWriter, r *http.Request, reqError error) {
		s.logger.Errorf("request error: %v", reqError)

		code := status.Code(reqError)
		errCode := sharedv1.ErrorCode_ERROR_CODE_UNKNOWN
		if code >= codes.Code(sharedv1.ErrorCode_ERROR_CODE_UNKNOWN) {
			errCode = sharedv1.ErrorCode(code)
		}

		err := &sharedv1.Error{
			Code:    errCode,
			Message: reqError.Error(),
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(shared.GetHTTPCode(reqError))
		data, jsonErr := json.Marshal(err)
		if jsonErr != nil {
			s.logger.Errorf("failed to marshal error message: %v", err)
			return
		}
		_, writeErr := w.Write(data)
		if writeErr != nil {
			s.logger.Errorf("failed to send error message: %v", err)
			return
		}
	}
}
