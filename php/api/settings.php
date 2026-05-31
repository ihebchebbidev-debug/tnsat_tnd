<?php
/**
 * Settings API — key/value store for app configuration
 * GET    → returns all settings (or ?key=xxx for one)
 * PUT    → update a setting: { key, value }
 * POST   → create/upsert a setting: { key, value }
 */
require_once __DIR__ . '/../config.php';

$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $key = $_GET['key'] ?? null;
        if ($key) {
            $stmt = $db->prepare('SELECT * FROM tnsatbeltnd_settings WHERE setting_key = ?');
            $stmt->execute([$key]);
            $row = $stmt->fetch();
            if ($row) {
                jsonResponse(['key' => $row['setting_key'], 'value' => $row['setting_value']]);
            } else {
                jsonResponse(['error' => 'Setting not found'], 404);
            }
        } else {
            $stmt = $db->query('SELECT * FROM tnsatbeltnd_settings ORDER BY setting_key');
            $rows = $stmt->fetchAll();
            $result = [];
            foreach ($rows as $r) {
                $result[$r['setting_key']] = $r['setting_value'];
            }
            jsonResponse($result);
        }
        break;

    case 'POST':
    case 'PUT':
        $data = getRequestBody();
        $key = $data['key'] ?? null;
        $value = $data['value'] ?? null;
        if (!$key) {
            jsonResponse(['error' => 'Key is required'], 400);
        }
        // Upsert
        $stmt = $db->prepare('SELECT id FROM tnsatbeltnd_settings WHERE setting_key = ?');
        $stmt->execute([$key]);
        if ($stmt->fetch()) {
            $stmt = $db->prepare('UPDATE tnsatbeltnd_settings SET setting_value = ? WHERE setting_key = ?');
            $stmt->execute([$value, $key]);
        } else {
            $id = bin2hex(random_bytes(16));
            $stmt = $db->prepare('INSERT INTO tnsatbeltnd_settings (id, setting_key, setting_value) VALUES (?, ?, ?)');
            $stmt->execute([$id, $key, $value]);
        }
        jsonResponse(['success' => true, 'key' => $key, 'value' => $value]);
        break;

    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}
