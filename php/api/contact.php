<?php
/**
 * Contact Messages API (MySQL) — with pagination
 */

require_once __DIR__ . '/../config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

switch ($method) {
    case 'GET':
        $db = getDB();
        $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : null;
        $limit = isset($_GET['limit']) ? max(1, min(100, intval($_GET['limit']))) : 20;

        if ($page !== null) {
            $countStmt = $db->query('SELECT COUNT(*) FROM tnsatbeltnd_contact_messages');
            $total = intval($countStmt->fetchColumn());

            $offset = ($page - 1) * $limit;
            $stmt = $db->prepare("SELECT * FROM tnsatbeltnd_contact_messages ORDER BY created_at DESC LIMIT {$limit} OFFSET {$offset}");
            $stmt->execute();
            $messages = $stmt->fetchAll();
            foreach ($messages as &$m) { $m['is_read'] = intval($m['is_read']); }
            jsonResponse(['data' => $messages, 'total' => $total, 'page' => $page, 'limit' => $limit]);
        } else {
            $stmt = $db->query('SELECT * FROM tnsatbeltnd_contact_messages ORDER BY created_at DESC');
            $messages = $stmt->fetchAll();
            foreach ($messages as &$m) { $m['is_read'] = intval($m['is_read']); }
            jsonResponse($messages);
        }
        break;

    case 'POST':
        $body = getRequestBody();
        $name = trim($body['name'] ?? '');
        $email = trim(strtolower($body['email'] ?? ''));
        $subject = trim($body['subject'] ?? '');
        $message = trim($body['message'] ?? '');

        if (!$name || !$email || !$message) {
            jsonResponse(['error' => 'Name, email, and message are required'], 400);
        }
        if (strlen($name) > 100 || strlen($email) > 255 || strlen($subject) > 200 || strlen($message) > 2000) {
            jsonResponse(['error' => 'Input too long'], 400);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            jsonResponse(['error' => 'Invalid email address'], 400);
        }

        $db = getDB();
        $msgId = bin2hex(random_bytes(16));
        $stmt = $db->prepare('INSERT INTO tnsatbeltnd_contact_messages (id, name, email, subject, message) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([$msgId, $name, $email, $subject, $message]);

        jsonResponse(['id' => $msgId, 'success' => true], 201);
        break;

    case 'PUT':
        if (!$id) jsonResponse(['error' => 'ID required'], 400);
        $db = getDB();
        $stmt = $db->prepare('UPDATE tnsatbeltnd_contact_messages SET is_read = 1 WHERE id = ?');
        $stmt->execute([$id]);
        jsonResponse(['success' => true]);
        break;

    case 'DELETE':
        if (!$id) jsonResponse(['error' => 'ID required'], 400);
        $db = getDB();
        $stmt = $db->prepare('DELETE FROM tnsatbeltnd_contact_messages WHERE id = ?');
        $stmt->execute([$id]);
        jsonResponse(['success' => true]);
        break;

    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}
