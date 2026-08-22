<?php
// Endpoint compartido para los formularios de Contacto y Tasaciones.
// Recibe POST JSON, valida, y reenvía el mensaje por email vía Resend (la API key nunca sale del servidor).

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Método no permitido']);
    exit;
}

$configPath = __DIR__ . '/config.php';
if (!file_exists($configPath)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Falta configuración del servidor']);
    exit;
}
$config = require $configPath;

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Datos inválidos']);
    exit;
}

function clean($v) {
    return htmlspecialchars(trim((string)($v ?? '')), ENT_QUOTES, 'UTF-8');
}

$form    = clean($input['form'] ?? 'contacto'); // 'contacto' | 'tasacion'
$nombre  = clean($input['nombre'] ?? '');
$email   = trim((string)($input['email'] ?? ''));
$telefono= clean($input['telefono'] ?? '');
$mensaje = clean($input['mensaje'] ?? '');
$extra   = is_array($input['extra'] ?? null) ? $input['extra'] : [];

if ($nombre === '' || $email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Completá nombre y un email válido']);
    exit;
}

$subject = $form === 'tasacion'
    ? "Nueva solicitud de tasación — $nombre"
    : "Nuevo mensaje de contacto — $nombre";

$rows = "<p><strong>Nombre:</strong> $nombre</p>";
$rows .= "<p><strong>Email:</strong> $email</p>";
if ($telefono !== '') $rows .= "<p><strong>Teléfono:</strong> $telefono</p>";
foreach ($extra as $key => $value) {
    $rows .= '<p><strong>' . clean($key) . ':</strong> ' . clean($value) . '</p>';
}
if ($mensaje !== '') $rows .= '<p><strong>Mensaje:</strong><br>' . nl2br($mensaje) . '</p>';

$html = "<div style=\"font-family:sans-serif\">$rows</div>";

$payload = json_encode([
    'from'     => $config['FROM_EMAIL'],
    'to'       => [$config['TO_EMAIL']],
    'reply_to' => $email,
    'subject'  => $subject,
    'html'     => $html,
]);

$ch = curl_init('https://api.resend.com/emails');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_HTTPHEADER     => [
        'Authorization: Bearer ' . $config['RESEND_API_KEY'],
        'Content-Type: application/json',
    ],
    CURLOPT_TIMEOUT        => 15,
]);
$response = curl_exec($ch);
$status   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

if ($curlErr || $status < 200 || $status >= 300) {
    error_log('Resend error: ' . $curlErr . ' | status=' . $status . ' | body=' . $response);
    http_response_code(502);
    echo json_encode(['ok' => false, 'error' => 'No se pudo enviar el mensaje. Intentá de nuevo más tarde.']);
    exit;
}

echo json_encode(['ok' => true]);
