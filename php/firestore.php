<?php
// Caché pública de colecciones de Firestore para el sitio.
// El sitio pide acá en vez de a Firebase: se lee Firestore como mucho una vez cada 10 min por colección,
// sin importar cuántas visitas haya (plan Spark: 50k lecturas/día). El admin sigue leyendo Firestore directo.
// ponytail: una propiedad nueva tarda hasta CACHE_TTL en verse en el sitio público.
//
// Uso: php/firestore.php?c=properties

header('Content-Type: application/json; charset=utf-8');

const PROJECT_ID = 'umen-dev';
const API_KEY    = 'AIzaSyDw30av8qmGjZg9-xeOvPp4o5MILHPDYoI'; // la misma key pública de js/config.js
const CACHE_TTL  = 600;

// Solo colecciones públicas; nunca 'admins'.
const ALLOWED = ['properties', 'categories', 'provinces', 'countries', 'cities', 'localities', 'neighborhoods', 'blogPosts', 'hotelNotes'];

$name = $_GET['c'] ?? '';
if (!in_array($name, ALLOWED, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Colección no permitida']);
    exit;
}

$cache = sys_get_temp_dir() . '/umen-' . PROJECT_ID . '-' . $name . '.json';
if (file_exists($cache) && time() - filemtime($cache) < CACHE_TTL) {
    header('X-Cache: HIT');
    readfile($cache);
    exit;
}

// Firestore REST devuelve valores tipados ({"stringValue": "..."}); los pasamos a JSON plano.
function plain($v) {
    if (array_key_exists('nullValue', $v))    return null;
    if (isset($v['stringValue']))             return $v['stringValue'];
    if (isset($v['integerValue']))            return (int)$v['integerValue'];
    if (isset($v['doubleValue']))             return (float)$v['doubleValue'];
    if (isset($v['booleanValue']))            return (bool)$v['booleanValue'];
    if (isset($v['timestampValue']))          return $v['timestampValue'];
    if (isset($v['referenceValue']))          return $v['referenceValue'];
    if (isset($v['geoPointValue']))           return $v['geoPointValue'];
    if (isset($v['arrayValue']))              return array_map('plain', $v['arrayValue']['values'] ?? []);
    if (isset($v['mapValue']))                return (object)array_map('plain', $v['mapValue']['fields'] ?? []);
    return null;
}

$docs = [];
$pageToken = '';
do {
    $url = 'https://firestore.googleapis.com/v1/projects/' . PROJECT_ID . '/databases/(default)/documents/' . $name
         . '?pageSize=300&key=' . API_KEY . ($pageToken ? '&pageToken=' . urlencode($pageToken) : '');
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15]);
    $res = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $data = json_decode($res, true);
    if ($status !== 200 || !is_array($data)) {
        // Firestore caído o cuota agotada: mejor datos de hace un rato que un sitio vacío.
        if (file_exists($cache)) { header('X-Cache: STALE'); readfile($cache); exit; }
        http_response_code(502);
        echo json_encode(['error' => 'Firestore no disponible']);
        exit;
    }

    foreach ($data['documents'] ?? [] as $d) {
        $doc = ['id' => basename($d['name'])];
        foreach ($d['fields'] ?? [] as $k => $v) $doc[$k] = plain($v);
        $docs[] = $doc;
    }
    $pageToken = $data['nextPageToken'] ?? '';
} while ($pageToken);

$out = json_encode($docs, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
file_put_contents($cache, $out, LOCK_EX);
header('X-Cache: MISS');
echo $out;
