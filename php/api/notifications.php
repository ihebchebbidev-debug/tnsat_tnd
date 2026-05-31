<?php
/**
 * Notifications API (MySQL) — supports client_id and reseller_id
 */

require_once __DIR__ . '/../config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;
$clientId = $_GET['client_id'] ?? null;
$resellerId = $_GET['reseller_id'] ?? null;
$action = $_GET['action'] ?? null;

switch ($method) {
    case 'GET':
        $db = getDB();
        $admin = $_GET['admin'] ?? null;

        // Admin notifications: those without client_id and reseller_id.
        // Return ALL unread items (so reset requests of every product type are surfaced)
        // plus the 50 most recent read items, to keep history available without truncating
        // pending reset requests when the queue gets long.
        if ($admin) {
            $stmt = $db->query(
                "SELECT * FROM tnsatbeltnd_notifications
                 WHERE client_id IS NULL AND reseller_id IS NULL
                   AND (
                     is_read = 0
                     OR (type = 'reset_request' AND message NOT LIKE '%[ACT:approved]%' AND message NOT LIKE '%[ACT:cancelled]%')
                   )
                 ORDER BY created_at DESC"
            );
            $unread = $stmt->fetchAll();
            $stmt = $db->query(
                "SELECT * FROM tnsatbeltnd_notifications
                 WHERE client_id IS NULL AND reseller_id IS NULL
                   AND is_read = 1
                   AND NOT (type = 'reset_request' AND message NOT LIKE '%[ACT:approved]%' AND message NOT LIKE '%[ACT:cancelled]%')
                 ORDER BY created_at DESC LIMIT 50"
            );
            $read = $stmt->fetchAll();
            jsonResponse(array_merge($unread, $read));
        }

        if (!$clientId && !$resellerId) jsonResponse(['error' => 'client_id or reseller_id required'], 400);
        
        if ($clientId) {
            $stmt = $db->prepare('SELECT * FROM tnsatbeltnd_notifications WHERE client_id = ? ORDER BY created_at DESC LIMIT 50');
            $stmt->execute([$clientId]);
        } else {
            $stmt = $db->prepare('SELECT * FROM tnsatbeltnd_notifications WHERE reseller_id = ? ORDER BY created_at DESC LIMIT 50');
            $stmt->execute([$resellerId]);
        }
        jsonResponse($stmt->fetchAll());
        break;

    case 'POST':
        $body = getRequestBody();
        $type = $body['type'] ?? '';
        $message = $body['message'] ?? '';
        $orderId = $body['order_id'] ?? null;
        $targetClientId = $body['client_id'] ?? null;
        $targetResellerId = $body['reseller_id'] ?? null;
        if (!$type || !$message) jsonResponse(['error' => 'type and message required'], 400);
        $db = getDB();
        $notifId = bin2hex(random_bytes(16));
        $stmt = $db->prepare('INSERT INTO tnsatbeltnd_notifications (id, client_id, reseller_id, type, message, order_id, is_read) VALUES (?, ?, ?, ?, ?, ?, 0)');
        $stmt->execute([$notifId, $targetClientId, $targetResellerId, $type, $message, $orderId]);
        jsonResponse(['success' => true, 'id' => $notifId], 201);
        break;

    case 'PUT':
        $db = getDB();
        
        if ($action === 'read_all') {
            if ($clientId) {
                $stmt = $db->prepare('UPDATE tnsatbeltnd_notifications SET is_read = 1 WHERE client_id = ?');
                $stmt->execute([$clientId]);
            } elseif ($resellerId) {
                $stmt = $db->prepare('UPDATE tnsatbeltnd_notifications SET is_read = 1 WHERE reseller_id = ?');
                $stmt->execute([$resellerId]);
            } else {
                jsonResponse(['error' => 'client_id or reseller_id required'], 400);
            }
            jsonResponse(['success' => true]);
        } elseif ($id) {
            // Optional body keys:
            //   outcome: 'approved' | 'cancelled' — appends a hidden marker
            //   reseller_note: string — updates the reseller's note (does NOT mark read)
            $body = getRequestBody();
            $outcome = $body['outcome'] ?? null;
            $hasNote = array_key_exists('reseller_note', $body);

            if ($hasNote && $outcome === null) {
                $note = trim(substr((string)$body['reseller_note'], 0, 2000));
                $stmt = $db->prepare('UPDATE tnsatbeltnd_notifications SET reseller_note = ? WHERE id = ?');
                $stmt->execute([$note === '' ? null : $note, $id]);
                jsonResponse(['success' => true]);
            }

            if ($outcome === 'approved' || $outcome === 'cancelled') {
                $stmt = $db->prepare('SELECT message FROM tnsatbeltnd_notifications WHERE id = ?');
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                $msg = $row ? (string)$row['message'] : '';
                // Strip any previous [ACT:...] marker, then append the new one.
                $msg = preg_replace('/\s*\[ACT:(approved|cancelled)\]/', '', $msg);
                $msg = rtrim($msg) . "\n[ACT:{$outcome}]";
                $stmt = $db->prepare('UPDATE tnsatbeltnd_notifications SET is_read = 1, message = ? WHERE id = ?');
                $stmt->execute([$msg, $id]);
            } else {
                $stmt = $db->prepare('UPDATE tnsatbeltnd_notifications SET is_read = 1 WHERE id = ?');
                $stmt->execute([$id]);
            }
            jsonResponse(['success' => true]);
        } else {
            jsonResponse(['error' => 'ID or client_id/reseller_id with action required'], 400);
        }
        break;

    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}
