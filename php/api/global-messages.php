<?php
/**
 * Global Messages API (MySQL)
 *
 * Admin broadcasts a message that every reseller sees on login until
 * they acknowledge it ("J'ai lu"). The admin can then see who has
 * read each message and who hasn't.
 *
 * Endpoints:
 *   GET    global-messages.php                       -> all messages (admin view) with read counts
 *   GET    global-messages.php?id=...                -> single message + per-reseller read status
 *   GET    global-messages.php?reseller_id=...&unread=1
 *                                                    -> active messages NOT yet read by this reseller
 *   POST   global-messages.php                       -> create  { title, message, is_active? }
 *   PUT    global-messages.php?id=...                -> update  { title?, message?, is_active? }
 *   PUT    global-messages.php?id=...&action=mark_read  body { reseller_id }
 *   DELETE global-messages.php?id=...                -> delete (also removes read records via FK)
 */

require_once __DIR__ . '/../config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;
$action = $_GET['action'] ?? null;
$resellerId = $_GET['reseller_id'] ?? null;
$unread = $_GET['unread'] ?? null;

switch ($method) {
    case 'GET': {
        $db = getDB();

        // Reseller-facing: list of all active messages (always shown until admin removes)
        if (isset($_GET['active'])) {
            $stmt = $db->query("SELECT * FROM tnsatbeltnd_global_messages WHERE is_active = 1 ORDER BY created_at DESC");
            jsonResponse($stmt->fetchAll());
        }

        // Reseller-facing: list of unread active messages (legacy)
        if ($resellerId && $unread) {
            $stmt = $db->prepare("
                SELECT m.*
                FROM tnsatbeltnd_global_messages m
                WHERE m.is_active = 1
                  AND NOT EXISTS (
                    SELECT 1 FROM tnsatbeltnd_global_message_reads r
                    WHERE r.message_id = m.id AND r.reseller_id = ?
                  )
                ORDER BY m.created_at DESC
            ");
            $stmt->execute([$resellerId]);
            jsonResponse($stmt->fetchAll());
        }

        // Single message — admin view with reads
        if ($id) {
            $stmt = $db->prepare('SELECT * FROM tnsatbeltnd_global_messages WHERE id = ?');
            $stmt->execute([$id]);
            $msg = $stmt->fetch();
            if (!$msg) jsonResponse(['error' => 'Not found'], 404);

            // Reads with reseller info
            $reads = $db->prepare("
                SELECT r.id, r.reseller_id, r.read_at, res.name AS reseller_name, res.email AS reseller_email
                FROM tnsatbeltnd_global_message_reads r
                LEFT JOIN tnsatbeltnd_resellers res ON res.id = r.reseller_id
                WHERE r.message_id = ?
                ORDER BY r.read_at DESC
            ");
            $reads->execute([$id]);
            $msg['reads'] = $reads->fetchAll();

            // Resellers who haven't read (active resellers only)
            $unreadStmt = $db->prepare("
                SELECT res.id AS reseller_id, res.name AS reseller_name, res.email AS reseller_email
                FROM tnsatbeltnd_resellers res
                WHERE res.is_active = 1
                  AND NOT EXISTS (
                    SELECT 1 FROM tnsatbeltnd_global_message_reads r
                    WHERE r.message_id = ? AND r.reseller_id = res.id
                  )
                ORDER BY res.name ASC
            ");
            $unreadStmt->execute([$id]);
            $msg['unread_resellers'] = $unreadStmt->fetchAll();

            jsonResponse($msg);
        }

        // Admin list — all messages with simple read counts
        $stmt = $db->query("
            SELECT m.*,
                   (SELECT COUNT(*) FROM tnsatbeltnd_global_message_reads r WHERE r.message_id = m.id) AS read_count,
                   (SELECT COUNT(*) FROM tnsatbeltnd_resellers WHERE is_active = 1) AS total_resellers
            FROM tnsatbeltnd_global_messages m
            ORDER BY m.created_at DESC
        ");
        jsonResponse($stmt->fetchAll());
        break;
    }

    case 'POST': {
        $body = getRequestBody();
        $title = trim($body['title'] ?? '');
        $message = trim($body['message'] ?? '');
        $imageUrl = isset($body['image_url']) ? trim((string)$body['image_url']) : null;
        if ($imageUrl === '') $imageUrl = null;
        $isActive = isset($body['is_active']) ? intval($body['is_active']) : 1;
        if (!$title || !$message) jsonResponse(['error' => 'title and message required'], 400);

        $db = getDB();
        $newId = bin2hex(random_bytes(16));
        $stmt = $db->prepare('INSERT INTO tnsatbeltnd_global_messages (id, title, message, image_url, is_active) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([$newId, $title, $message, $imageUrl, $isActive]);
        jsonResponse(['id' => $newId, 'success' => true], 201);
        break;
    }

    case 'PUT': {
        if (!$id) jsonResponse(['error' => 'ID required'], 400);
        $db = getDB();

        if ($action === 'mark_read') {
            $body = getRequestBody();
            $rid = $body['reseller_id'] ?? null;
            if (!$rid) jsonResponse(['error' => 'reseller_id required'], 400);

            // Confirm message exists
            $check = $db->prepare('SELECT id FROM tnsatbeltnd_global_messages WHERE id = ?');
            $check->execute([$id]);
            if (!$check->fetch()) jsonResponse(['error' => 'Message not found'], 404);

            // Insert ignore duplicate
            $readId = bin2hex(random_bytes(16));
            try {
                $stmt = $db->prepare('INSERT INTO tnsatbeltnd_global_message_reads (id, message_id, reseller_id) VALUES (?, ?, ?)');
                $stmt->execute([$readId, $id, $rid]);
            } catch (PDOException $e) {
                // duplicate (already read) — ignore
            }
            jsonResponse(['success' => true]);
        }

        $body = getRequestBody();
        $fields = [];
        $params = [];
        if (isset($body['title']))     { $fields[] = 'title = ?';     $params[] = trim($body['title']); }
        if (isset($body['message']))   { $fields[] = 'message = ?';   $params[] = trim($body['message']); }
        if (array_key_exists('image_url', $body)) {
            $img = is_string($body['image_url']) ? trim($body['image_url']) : null;
            $fields[] = 'image_url = ?';
            $params[] = ($img === '' ? null : $img);
        }
        if (isset($body['is_active'])) { $fields[] = 'is_active = ?'; $params[] = intval($body['is_active']); }
        if (!$fields) jsonResponse(['error' => 'No fields to update'], 400);

        $params[] = $id;
        $stmt = $db->prepare('UPDATE tnsatbeltnd_global_messages SET ' . implode(', ', $fields) . ' WHERE id = ?');
        $stmt->execute($params);
        jsonResponse(['success' => true]);
        break;
    }

    case 'DELETE': {
        if (!$id) jsonResponse(['error' => 'ID required'], 400);
        $db = getDB();
        $stmt = $db->prepare('DELETE FROM tnsatbeltnd_global_messages WHERE id = ?');
        $stmt->execute([$id]);
        jsonResponse(['success' => true]);
        break;
    }

    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}
