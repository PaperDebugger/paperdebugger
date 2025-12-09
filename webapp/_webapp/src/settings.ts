/*
 * settings.ts
 *
 * Script for the extension settings page.
 * Handles requesting host permissions and displaying permission status.
 */

interface PermissionItem {
  origin: string;
  granted: boolean;
}

// Get DOM elements
const permissionUrlInput = document.getElementById('permissionUrl') as HTMLInputElement;
const requestPermissionBtn = document.getElementById('requestPermissionBtn') as HTMLButtonElement;
const messageDiv = document.getElementById('message') as HTMLDivElement;
const permissionsListDiv = document.getElementById('permissionsList') as HTMLDivElement;

// Show message to user
function showMessage(text: string, type: 'success' | 'error' | 'info' = 'info') {
  messageDiv.textContent = text;
  messageDiv.className = `message ${type}`;
  messageDiv.style.display = 'block';
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    messageDiv.style.display = 'none';
  }, 5000);
}

// Clear message
function clearMessage() {
  messageDiv.style.display = 'none';
  messageDiv.textContent = '';
  messageDiv.className = '';
}

// Validate URL format
// Returns { valid: true, origin: string } if valid, or { valid: false, error: string } if invalid
function validateUrl(url: string): { valid: true; origin: string } | { valid: false; error: string } {
  if (!url.trim()) {
    return { valid: false, error: 'Please enter a URL' };
  }

  try {
    const urlObj = new URL(url);
    // Ensure it's http or https
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { valid: false, error: 'URL must start with http:// or https://' };
    }
    // Return the origin
    return { valid: true, origin: urlObj.origin + '/' };
  } catch (e) {
    return { valid: false, error: 'Invalid URL format. Please enter a valid URL (e.g., https://www.example.com/)' };
  }
}

// Check if permission is granted
async function checkPermission(origin: string): Promise<boolean> {
  try {
    return await chrome.permissions.contains({ origins: [origin] });
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

// Request host permission
async function requestPermission(origin: string): Promise<boolean> {
  try {
    const response = await chrome.runtime.sendMessage({
      action: "requestHostPermission",
      args: origin,
    });

    if (response?.error) {
      throw new Error(response.error);
    }

    return response === true;
  } catch (error) {
    console.error('Error requesting permission:', error);
    throw error;
  }
}

// Render permissions list
async function renderPermissionsList() {
  // Get all permissions from chrome.permissions.getAll()
  try {
    const permissions = await chrome.permissions.getAll();
    const origins = permissions.origins || [];

    if (origins.length === 0) {
      permissionsListDiv.innerHTML = '<p style="color: #666; font-size: 14px;">No permissions granted yet.</p>';
      return;
    }

    const items: PermissionItem[] = origins.map(origin => ({
      origin,
      granted: true, // If it's in the list, it's granted
    }));

    permissionsListDiv.innerHTML = items
      .map(
        (item) => `
      <div class="permission-item">
        <div class="permission-info">
          <div style="font-weight: 500; margin-bottom: 5px;">Host Permission</div>
          <div class="permission-url">${item.origin}</div>
        </div>
        <div class="permission-status granted">Granted</div>
      </div>
    `,
      )
      .join('');
  } catch (error) {
    console.error('Error rendering permissions list:', error);
    permissionsListDiv.innerHTML = '<p style="color: #d32f2f; font-size: 14px;">Error loading permissions.</p>';
  }
}

// Handle request permission button click
requestPermissionBtn.addEventListener('click', async () => {
  clearMessage();
  requestPermissionBtn.disabled = true;

  const url = permissionUrlInput.value.trim();
  const validation = validateUrl(url);

  if (!validation.valid) {
    showMessage(validation.error, 'error');
    requestPermissionBtn.disabled = false;
    return;
  }

  const origin = validation.origin;

  try {
    // Check if already granted
    const alreadyGranted = await checkPermission(origin);
    if (alreadyGranted) {
      showMessage(`Permission for ${origin} is already granted.`, 'info');
      requestPermissionBtn.disabled = false;
      await renderPermissionsList();
      return;
    }

    // Request permission
    const granted = await requestPermission(origin);

    if (granted) {
      showMessage(`Permission granted for ${origin}`, 'success');
      await renderPermissionsList();
    } else {
      showMessage(`Permission denied for ${origin}`, 'error');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    showMessage(`Error: ${errorMessage}`, 'error');
  } finally {
    requestPermissionBtn.disabled = false;
  }
});

// Allow Enter key to submit
permissionUrlInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !requestPermissionBtn.disabled) {
    requestPermissionBtn.click();
  }
});

// Load permissions list on page load
document.addEventListener('DOMContentLoaded', () => {
  renderPermissionsList();
});

