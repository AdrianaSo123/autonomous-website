// Google Identity Services Auth Module

const CLIENT_ID = '661405791094-f9tos2aibd858h3lrseoj7j0525vjs0d.apps.googleusercontent.com'; // Replace with actual Client ID

export function initAuth() {
    // Check if user is already logged in
    const storedUser = sessionStorage.getItem('google_user');

    if (storedUser) {
        // User is logged in, show user info instead of login button
        try {
            const user = JSON.parse(storedUser);
            renderUserNav(user);
        } catch (e) {
            sessionStorage.removeItem('google_user');
            renderLoginButton();
        }
    } else {
        // Not logged in, render Google button
        renderLoginButton();
    }
}

function renderLoginButton() {
    const authContainer = document.getElementById('auth-container');
    if (!authContainer) return;

    // Clear container
    authContainer.innerHTML = '';

    // Create a div for the button
    const buttonDiv = document.createElement('div');
    authContainer.appendChild(buttonDiv);

    // Make sure GIS is loaded before calling
    if (window.google && window.google.accounts) {
        window.google.accounts.id.initialize({
            client_id: CLIENT_ID,
            callback: handleCredentialResponse
        });

        window.google.accounts.id.renderButton(
            buttonDiv,
            { theme: "outline", size: "medium", type: "standard", shape: "pill" }
        );
    } else {
        // If GIS script hasn't loaded yet, retry in 100ms
        setTimeout(renderLoginButton, 100);
    }
}

function handleCredentialResponse(response) {
    // The credential is a JWT token containing user info
    const credential = response.credential;

    // Decode the JWT (base64)
    const payloadInfo = JSON.parse(atob(credential.split('.')[1]));

    const user = {
        name: payloadInfo.name,
        email: payloadInfo.email,
        picture: payloadInfo.picture
    };

    // Store in sessionStorage
    sessionStorage.setItem('google_user', JSON.stringify(user));

    // Update UI
    renderUserNav(user);
}

export function signOut() {
    sessionStorage.removeItem('google_user');

    if (window.google && window.google.accounts) {
        window.google.accounts.id.disableAutoSelect();
    }

    // Re-render button
    renderLoginButton();
}

function renderUserNav(user) {
    const authContainer = document.getElementById('auth-container');
    if (!authContainer) return;

    // Render an avatar and logout button seamlessly integrated with the nav
    authContainer.innerHTML = `
        <div class="user-profile" style="display: flex; align-items: center; gap: 16px;">
            <img src="${user.picture}" alt="${user.name}" style="width: 28px; height: 28px; border-radius: 50%; opacity: 0.9;">
            <div class="nav-links">
                <a href="javascript:void(0)" onclick="window.handleSignOut()" style="cursor: pointer;">Logout</a>
            </div>
        </div>
    `;

    // Attach signout handler to window so inline onclick works
    window.handleSignOut = signOut;
}

// Auto-init when DOM is fully parsed
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
} else {
    initAuth();
}
