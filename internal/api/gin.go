package api

import (
	"net/http"
	"strings"
	"time"

	"paperdebugger/internal/api/auth"
	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/logger"
	"paperdebugger/webapp"

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
		AllowOrigins:     []string{"https://overleaf.com", "https://www.overleaf.com", "http://localhost:3000", "http://127.0.0.1:3000"},
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

	webappRouter := ginServer.Group("/_pd/webapp")
	webappRouter.Any("/*path", ginServer.ginWebapp())

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

func (s *GinServer) ginWebapp() gin.HandlerFunc {
	webappFs := webapp.GetWebappFS()
	webappFileServer := http.FileServer(http.FS(webappFs))

	return func(c *gin.Context) {
		fp := strings.TrimPrefix(c.Request.URL.Path, "/_pd/webapp")
		fp = strings.TrimPrefix(fp, "/")
		req := c.Request.Clone(c.Request.Context())
		req.URL.Path = strings.TrimPrefix(c.Request.URL.Path, "/_pd/webapp")
		_, err := webappFs.Open(fp)
		if err != nil {
			req.URL.Path = "/"
		}
		webappFileServer.ServeHTTP(c.Writer, req)
	}
}
