<?php
/**
 * Clients API (MySQL) — with batch delete, pagination support
 * Uses credits (DECIMAL) instead of points (INT)
 */

require_once __DIR__ . '/../config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;
$action = $_GET['action'] ?? null;

function castClientRow(&$r) {
    $r['credits'] = floatval($r['credits']);
    $r['is_active'] = intval($r['is_active'] ?? 1);
}

switch ($method) {
    case 'GET':
        $db = getDB();
        if ($id) {
            $stmt = $db->prepare('SELECT * FROM tnsatbeltnd_clients WHERE id = ?');
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            if (!$row) jsonResponse(['error' => 'Not found'], 404);
            castClientRow($row);
            jsonResponse($row);
        } else {
            $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : null;
            $limit = isset($_GET['limit']) ? max(1, min(100, intval($_GET['limit']))) : 20;
            $search = $_GET['search'] ?? null;

            $where = '';
            $params = [];
            if ($search) {
                $where = ' WHERE (name LIKE ? OR email LIKE ?)';
                $params[] = "%{$search}%";
                $params[] = "%{$search}%";
            }

            if ($page !== null) {
                $countStmt = $db->prepare("SELECT COUNT(*) FROM tnsatbeltnd_clients{$where}");
                $countStmt->execute($params);
                $total = intval($countStmt->fetchColumn());

                $offset = ($page - 1) * $limit;
                $stmt = $db->prepare("SELECT * FROM tnsatbeltnd_clients{$where} ORDER BY created_at DESC LIMIT {$limit} OFFSET {$offset}");
                $stmt->execute($params);
                $rows = $stmt->fetchAll();
                foreach ($rows as &$r) castClientRow($r);
                jsonResponse(['data' => $rows, 'total' => $total, 'page' => $page, 'limit' => $limit]);
            } else {
                $stmt = $db->prepare("SELECT * FROM tnsatbeltnd_clients{$where} ORDER BY created_at DESC");
                $stmt->execute($params);
                $rows = $stmt->fetchAll();
                foreach ($rows as &$r) castClientRow($r);
                jsonResponse($rows);
            }
        }
        break;

    case 'POST':
        $body = getRequestBody();
        
        if ($action === 'batch_delete') {
            $ids = $body['ids'] ?? [];
            if (empty($ids) || !is_array($ids)) jsonResponse(['error' => 'ids array required'], 400);
            $db = getDB();
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $stmt = $db->prepare("DELETE FROM tnsatbeltnd_clients WHERE id IN ({$placeholders})");
            $stmt->execute($ids);
            jsonResponse(['success' => true, 'deleted' => $stmt->rowCount()]);
            break;
        }

        if ($action === 'batch_toggle_active') {
            $ids = $body['ids'] ?? [];
            if (empty($ids) || !is_array($ids)) jsonResponse(['error' => 'ids array required'], 400);
            $db = getDB();
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $stmt = $db->prepare("UPDATE tnsatbeltnd_clients SET is_active = NOT is_active WHERE id IN ({$placeholders})");
            $stmt->execute($ids);
            jsonResponse(['success' => true, 'updated' => $stmt->rowCount()]);
            break;
        }

        $name = trim($body['name'] ?? '');
        $email = trim(strtolower($body['email'] ?? ''));
        $password = trim($body['password'] ?? '');
        $credits = floatval($body['credits'] ?? 0);
        
        if (!$name || !$email || !$password) {
            jsonResponse(['error' => 'Name, email and password are required'], 400);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            jsonResponse(['error' => 'Invalid email format'], 400);
        }

        if (strlen($password) < 4) {
            jsonResponse(['error' => 'Password must be at least 4 characters'], 400);
        }

        $db = getDB();
        
        $stmt = $db->prepare('SELECT id FROM tnsatbeltnd_clients WHERE email = ?');
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            jsonResponse(['error' => 'Email already exists'], 400);
        }
        
        $id = bin2hex(random_bytes(16));
        $stmt = $db->prepare('INSERT INTO tnsatbeltnd_clients (id, name, email, password, credits) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([$id, $name, $email, $password, $credits]);
        
        jsonResponse(['id' => $id, 'name' => $name, 'email' => $email, 'credits' => $credits], 201);
        break;

    case 'PUT':
        if (!$id) jsonResponse(['error' => 'ID required'], 400);
        
        $body = getRequestBody();
        $db = getDB();
        
        if ($action === 'add_credits') {
            $credits = floatval($body['credits'] ?? 0);
            $note = trim($body['note'] ?? '');
            if ($credits <= 0) jsonResponse(['error' => 'Credits must be positive'], 400);
            $stmt = $db->prepare('UPDATE tnsatbeltnd_clients SET credits = credits + ? WHERE id = ?');
            $stmt->execute([$credits, $id]);

            $stmt = $db->prepare('SELECT credits FROM tnsatbeltnd_clients WHERE id = ?');
            $stmt->execute([$id]);
            $updated = $stmt->fetch();
            $txId = bin2hex(random_bytes(16));
            $desc = $note ? "Crédits ajoutés par admin — $note" : 'Crédits ajoutés par admin';
            $stmt = $db->prepare('INSERT INTO tnsatbeltnd_point_transactions (id, client_id, type, amount, balance_after, description) VALUES (?, ?, ?, ?, ?, ?)');
            $stmt->execute([$txId, $id, 'credit', $credits, floatval($updated['credits']), $desc]);

            jsonResponse(['success' => true]);
            break;
        }

        if ($action === 'remove_credits') {
            $credits = floatval($body['credits'] ?? 0);
            if ($credits <= 0) jsonResponse(['error' => 'Credits must be positive'], 400);
            $stmt = $db->prepare('SELECT credits FROM tnsatbeltnd_clients WHERE id = ?');
            $stmt->execute([$id]);
            $current = $stmt->fetch();
            if (!$current) jsonResponse(['error' => 'Client not found'], 404);
            $currentCredits = floatval($current['credits']);
            $toRemove = min($credits, $currentCredits);
            if ($toRemove <= 0) jsonResponse(['error' => 'No credits to remove'], 400);

            $stmt = $db->prepare('UPDATE tnsatbeltnd_clients SET credits = credits - ? WHERE id = ?');
            $stmt->execute([$toRemove, $id]);

            $stmt = $db->prepare('SELECT credits FROM tnsatbeltnd_clients WHERE id = ?');
            $stmt->execute([$id]);
            $updated = $stmt->fetch();
            $txId = bin2hex(random_bytes(16));
            $stmt = $db->prepare('INSERT INTO tnsatbeltnd_point_transactions (id, client_id, type, amount, balance_after, description) VALUES (?, ?, ?, ?, ?, ?)');
            $stmt->execute([$txId, $id, 'debit', $toRemove, floatval($updated['credits']), 'Crédits retirés par admin']);

            jsonResponse(['success' => true]);
            break;
        }

        if ($action === 'empty_credits') {
            $stmt = $db->prepare('SELECT credits FROM tnsatbeltnd_clients WHERE id = ?');
            $stmt->execute([$id]);
            $current = $stmt->fetch();
            if (!$current) jsonResponse(['error' => 'Client not found'], 404);
            $currentCredits = floatval($current['credits']);

            if ($currentCredits > 0) {
                $stmt = $db->prepare('UPDATE tnsatbeltnd_clients SET credits = 0 WHERE id = ?');
                $stmt->execute([$id]);
                $txId = bin2hex(random_bytes(16));
                $stmt = $db->prepare('INSERT INTO tnsatbeltnd_point_transactions (id, client_id, type, amount, balance_after, description) VALUES (?, ?, ?, ?, ?, ?)');
                $stmt->execute([$txId, $id, 'debit', $currentCredits, 0, 'Solde vidé par admin']);
            }

            jsonResponse(['success' => true]);
            break;
        }

        // Legacy support: redirect old action names
        if ($action === 'add_points') {
            $body['credits'] = $body['points'] ?? $body['credits'] ?? 0;
            $_GET['action'] = 'add_credits';
            // Fall through handled above won't work, so handle inline
            $credits = floatval($body['credits']);
            if ($credits <= 0) jsonResponse(['error' => 'Credits must be positive'], 400);
            $stmt = $db->prepare('UPDATE tnsatbeltnd_clients SET credits = credits + ? WHERE id = ?');
            $stmt->execute([$credits, $id]);
            $stmt = $db->prepare('SELECT credits FROM tnsatbeltnd_clients WHERE id = ?');
            $stmt->execute([$id]);
            $updated = $stmt->fetch();
            $txId = bin2hex(random_bytes(16));
            $stmt = $db->prepare('INSERT INTO tnsatbeltnd_point_transactions (id, client_id, type, amount, balance_after, description) VALUES (?, ?, ?, ?, ?, ?)');
            $stmt->execute([$txId, $id, 'credit', $credits, floatval($updated['credits']), 'Crédits ajoutés par admin']);
            jsonResponse(['success' => true]);
            break;
        }

        if ($action === 'remove_points') {
            $body['credits'] = $body['points'] ?? $body['credits'] ?? 0;
            $credits = floatval($body['credits']);
            if ($credits <= 0) jsonResponse(['error' => 'Credits must be positive'], 400);
            $stmt = $db->prepare('SELECT credits FROM tnsatbeltnd_clients WHERE id = ?');
            $stmt->execute([$id]);
            $current = $stmt->fetch();
            if (!$current) jsonResponse(['error' => 'Client not found'], 404);
            $currentCredits = floatval($current['credits']);
            $toRemove = min($credits, $currentCredits);
            if ($toRemove <= 0) jsonResponse(['error' => 'No credits to remove'], 400);
            $stmt = $db->prepare('UPDATE tnsatbeltnd_clients SET credits = credits - ? WHERE id = ?');
            $stmt->execute([$toRemove, $id]);
            $stmt = $db->prepare('SELECT credits FROM tnsatbeltnd_clients WHERE id = ?');
            $stmt->execute([$id]);
            $updated = $stmt->fetch();
            $txId = bin2hex(random_bytes(16));
            $stmt = $db->prepare('INSERT INTO tnsatbeltnd_point_transactions (id, client_id, type, amount, balance_after, description) VALUES (?, ?, ?, ?, ?, ?)');
            $stmt->execute([$txId, $id, 'debit', $toRemove, floatval($updated['credits']), 'Crédits retirés par admin']);
            jsonResponse(['success' => true]);
            break;
        }

        if ($action === 'empty_points') {
            $_GET['action'] = 'empty_credits';
            $stmt = $db->prepare('SELECT credits FROM tnsatbeltnd_clients WHERE id = ?');
            $stmt->execute([$id]);
            $current = $stmt->fetch();
            if (!$current) jsonResponse(['error' => 'Client not found'], 404);
            $currentCredits = floatval($current['credits']);
            if ($currentCredits > 0) {
                $stmt = $db->prepare('UPDATE tnsatbeltnd_clients SET credits = 0 WHERE id = ?');
                $stmt->execute([$id]);
                $txId = bin2hex(random_bytes(16));
                $stmt = $db->prepare('INSERT INTO tnsatbeltnd_point_transactions (id, client_id, type, amount, balance_after, description) VALUES (?, ?, ?, ?, ?, ?)');
                $stmt->execute([$txId, $id, 'debit', $currentCredits, 0, 'Solde vidé par admin']);
            }
            jsonResponse(['success' => true]);
            break;
        }

        if ($action === 'toggle_active') {
            $stmt = $db->prepare('UPDATE tnsatbeltnd_clients SET is_active = NOT is_active WHERE id = ?');
            $stmt->execute([$id]);
            jsonResponse(['success' => true]);
            break;
        }
        
        $name = trim($body['name'] ?? '');
        $email = trim(strtolower($body['email'] ?? ''));
        $password = trim($body['password'] ?? '');
        $credits = floatval($body['credits'] ?? 0);
        
        if (!$name || !$email || !$password) {
            jsonResponse(['error' => 'Name, email and password are required'], 400);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            jsonResponse(['error' => 'Invalid email format'], 400);
        }
        
        $stmt = $db->prepare('SELECT id FROM tnsatbeltnd_clients WHERE email = ? AND id != ?');
        $stmt->execute([$email, $id]);
        if ($stmt->fetch()) {
            jsonResponse(['error' => 'Email already exists'], 400);
        }
        
        $stmt = $db->prepare('UPDATE tnsatbeltnd_clients SET name=?, email=?, password=?, credits=? WHERE id=?');
        $stmt->execute([$name, $email, $password, $credits, $id]);
        
        jsonResponse(['success' => true]);
        break;

    case 'DELETE':
        if (!$id) jsonResponse(['error' => 'ID required'], 400);
        $db = getDB();
        $stmt = $db->prepare('DELETE FROM tnsatbeltnd_clients WHERE id = ?');
        $stmt->execute([$id]);
        jsonResponse(['success' => true]);
        break;

    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}
