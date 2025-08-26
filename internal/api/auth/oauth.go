package auth

import (
	_ "embed"
	"net/http"
	"paperdebugger/internal/services"

	"github.com/gin-gonic/gin"
)

//go:embed static/oauth_landing.html
var oauthLandingHTML []byte

type OAuthHandler struct {
	OAuthService *services.OAuthService
}

func NewOAuthHandler(oauthService *services.OAuthService) *OAuthHandler {
	return &OAuthHandler{oauthService}
}

func (h *OAuthHandler) OAuthPage(c *gin.Context) {
	c.Data(http.StatusOK, "text/html; charset=utf-8", oauthLandingHTML)
}

func (h *OAuthHandler) OAuthCallback(c *gin.Context) {
	code := c.Query("code")
	state := c.Query("state")
	accessToken := c.Query("access_token")
	if code == "" && accessToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing code or access_token"})
		return
	}
	if state == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing state"})
		return
	}

	err := h.OAuthService.CreateOAuthRecord(c.Request.Context(), code, state, accessToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *OAuthHandler) OAuthStatus(c *gin.Context) {
	ctx := c.Request.Context()
	state := c.Query("state")
	if state == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing_state"})
		return
	}

	cb, err := h.OAuthService.GetOAuthRecordByState(ctx, state)
	if err != nil {
		c.JSON(http.StatusAccepted, gin.H{"error": "not_found"})
		return
	}
	if cb.Used {
		c.JSON(http.StatusGone, gin.H{"error": "used"})
		return
	}

	// update used to true
	err = h.OAuthService.OAuthMakeUsed(ctx, cb)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "update_used_failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": cb.Code, "access_token": cb.AccessToken})
}
