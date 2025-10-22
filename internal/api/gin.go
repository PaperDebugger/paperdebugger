package api

import (
	"time"

	"paperdebugger/internal/api/auth"
	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/logger"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

type GinServer struct {
	*gin.Engine
	cfg *cfg.Cfg
}

func NewGinServer(cfg *cfg.Cfg, oauthHandler *auth.OAuthHandler) *GinServer {
	gin.SetMode(gin.ReleaseMode)
	ginServer := &GinServer{Engine: gin.New(), cfg: cfg}
	ginServer.Use(ginServer.ginLogMiddleware(), gin.Recovery())
	ginServer.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"*"},
		ExposeHeaders:    []string{"*"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// This is a general oauth2 endpoint, not related to any specific provider.
	oauthRouter := ginServer.Group("/oauth2")
	oauthRouter.GET("/", oauthHandler.OAuthPage)
	oauthRouter.GET("/callback", oauthHandler.OAuthCallback)
	oauthRouter.GET("/status", oauthHandler.OAuthStatus)

	return ginServer
}

func (s *GinServer) ginLogMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		startTime := time.Now()
		c.Next()
		endTime := time.Now()

		method := c.Request.Method
		code := c.Writer.Status()
		duration := endTime.Sub(startTime)
		uri := c.Request.RequestURI

		logger.GetLogger().Infof("%5s %5d %13v - %s", method, code, duration, uri)
	}
}
