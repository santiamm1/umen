<?php
// Copiar este archivo a config.php (ignorado por git) y completar con la key real.
// La key nunca debe subirse al repositorio ni exponerse en el frontend.
return [
    'RESEND_API_KEY' => 'TU_API_KEY_DE_RESEND',
    'TO_EMAIL'       => 'info@umen.com.ar',
    // Mientras el dominio umen.com.ar no esté verificado en Resend, usar el remitente de pruebas.
    // Una vez verificado el dominio en resend.com/domains, cambiar a algo como notificaciones@umen.com.ar
    'FROM_EMAIL'     => 'UMEN Web <onboarding@resend.dev>',
];
