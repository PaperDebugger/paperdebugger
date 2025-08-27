package api

import (
	"context"
	"strings"

	"paperdebugger/internal/accesscontrol"
	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/contextutil"
	"paperdebugger/internal/libs/metadatautil"
	"paperdebugger/internal/libs/shared"
	"paperdebugger/internal/services"
	authv1 "paperdebugger/pkg/gen/api/auth/v1"
	chatv1 "paperdebugger/pkg/gen/api/chat/v1"
	commentv1 "paperdebugger/pkg/gen/api/comment/v1"
	projectv1 "paperdebugger/pkg/gen/api/project/v1"
	userv1 "paperdebugger/pkg/gen/api/user/v1"

	// "github.com/grpc-ecosystem/go-grpc-middleware"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

type WrappedServerStream struct {
	grpc.ServerStream
	WrappedContext context.Context
}

func (w *WrappedServerStream) Context() context.Context {
	return w.WrappedContext
}

// WrapServerStream returns a ServerStream that has the ability to overwrite context.
func WrapServerStream(stream grpc.ServerStream) *WrappedServerStream {
	if existing, ok := stream.(*WrappedServerStream); ok {
		return existing
	}
	return &WrappedServerStream{ServerStream: stream, WrappedContext: stream.Context()}
}

type GrpcServer struct {
	*grpc.Server
	userService *services.UserService
	cfg         *cfg.Cfg
}

func (s *GrpcServer) grpcUnaryAuthInterceptor(
	ctx context.Context,
	req interface{},
	info *grpc.UnaryServerInfo,
	handler grpc.UnaryHandler,
) (interface{}, error) {
	if strings.HasPrefix(info.FullMethod, "/auth.v1.AuthService/LoginBy") ||
		strings.HasPrefix(info.FullMethod, "/auth.v1.AuthService/RefreshToken") {
		return handler(ctx, req)
	}

	actor, err := s.authUserActor(ctx)
	if err != nil {
		return nil, err
	}

	return handler(contextutil.SetActor(ctx, actor), req)
}

func (s *GrpcServer) grpcStreamAuthInterceptor(
	srv interface{},
	ss grpc.ServerStream,
	info *grpc.StreamServerInfo,
	handler grpc.StreamHandler,
) error {
	if strings.HasPrefix(info.FullMethod, "/auth.v1.AuthService/LoginBy") ||
		strings.HasPrefix(info.FullMethod, "/auth.v1.AuthService/RefreshToken") {
		return handler(srv, ss)
	}

	actor, err := s.authUserActor(ss.Context())
	if err != nil {
		return err
	}
	ctx := contextutil.SetActor(ss.Context(), actor)

	wrapped := WrapServerStream(ss)
	wrapped.WrappedContext = ctx

	return handler(srv, wrapped)
}

func (s *GrpcServer) authUserActor(ctx context.Context) (*accesscontrol.Actor, error) {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return nil, shared.ErrInternal("failed to get metadata")
	}

	token := metadatautil.GetAuthToken(md)
	return parseUserActor(ctx, token, s.userService)
}

func NewGrpcServer(
	userService *services.UserService,
	cfg *cfg.Cfg,
	authServer authv1.AuthServiceServer,
	chatServer chatv1.ChatServiceServer,
	userServer userv1.UserServiceServer,
	projectServer projectv1.ProjectServiceServer,
	commentServer commentv1.CommentServiceServer,
) *GrpcServer {
	grpcServer := &GrpcServer{}
	grpcServer.userService = userService
	grpcServer.cfg = cfg
	grpcServer.Server = grpc.NewServer(
		grpc.UnaryInterceptor(grpcServer.grpcUnaryAuthInterceptor),
		grpc.StreamInterceptor(grpcServer.grpcStreamAuthInterceptor),
	)

	authv1.RegisterAuthServiceServer(grpcServer.Server, authServer)
	chatv1.RegisterChatServiceServer(grpcServer.Server, chatServer)
	userv1.RegisterUserServiceServer(grpcServer.Server, userServer)
	projectv1.RegisterProjectServiceServer(grpcServer.Server, projectServer)
	commentv1.RegisterCommentServiceServer(grpcServer.Server, commentServer)
	return grpcServer
}
