<?php
/**
 * Auth API (MySQL) — supports admin, client, reseller
 */

require_once __DIR__ . '/../config.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

$body = getRequestBody();
$email = trim(strtolower($body['email'] ?? ''));
$password = trim($body['password'] ?? '');
$type = $body['type'] ?? 'client'; // 'admin', 'client', or 'reseller'

if (!$email || !$password) {
    jsonResponse(['error' => 'Email and password required'], 400);
}

// 1. Check Admin login (hardcoded)
if ($email === 'admin@tnsat.net' && $password === 'admin123') {
    jsonResponse(['success' => true, 'type' => 'admin']);
}

$db = getDB();

// 2. Check Reseller login
$stmt = $db->prepare('SELECT * FROM tnsatbeltnd_resellers WHERE email = ? AND password = ?');
$stmt->execute([$email, $password]);
$reseller = $stmt->fetch();

if ($reseller) {
    if (!intval($reseller['is_active'])) {
        jsonResponse(['error' => 'Your account is inactive. Please contact support.'], 403);
    }
    jsonResponse([
        'success' => true,
        'type' => 'reseller',
        'reseller' => [
            'id' => $reseller['id'],
            'name' => $reseller['name'],
            'email' => $reseller['email'],
            'credits' => floatval($reseller['credits']),
            'can_add_resellers' => intval($reseller['can_add_resellers']),
        ]
    ]);
}

// 3. Check Client login
$stmt = $db->prepare('SELECT * FROM tnsatbeltnd_clients WHERE email = ? AND password = ?');
$stmt->execute([$email, $password]);
$client = $stmt->fetch();

if ($client) {
    if (!intval($client['is_active'] ?? 1)) {
        jsonResponse(['error' => 'Your account is inactive. Please contact support.'], 403);
    }
    jsonResponse([
        'success' => true,
        'type' => 'client',
        'client' => [
            'id' => $client['id'],
            'name' => $client['name'],
            'email' => $client['email'],
            'credits' => floatval($client['credits'])
        ]
    ]);
}

// If all checks fail
jsonResponse(['error' => 'Invalid credentials'], 401);
