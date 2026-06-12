// adminLogin.js - Lógica para login de admin

import { signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';

const loginForm = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');

// Manejar login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        await signInWithEmailAndPassword(window.auth, email, password);
        // Redirigir al dashboard
        window.location.href = 'admin-dashboard.html';
    } catch (error) {
        errorMessage.textContent = 'Error al iniciar sesión: ' + error.message;
    }
});