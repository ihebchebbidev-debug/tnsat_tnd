<?php
/**
 * Resellers API (MySQL) — with batch delete, pagination, credit tx logging
 * Fields: id, name, email, password, credits, can_add_resellers, parent_reseller_id, note, level, country, currency, is_active, created_at
 */

require_once __DIR__ . '/../config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;
$action = $_GET['action'] ?? null;

$cols = 'r.id, r.name, r.email, r.password, r.credits, r.can_add_resellers, r.parent_reseller_id, r.note, r.level, r.country, r.currency, r.image_url, r.is_active, r.created_at';

function castRow(&$r) {
    $r['credits'] = floatval($r['credits']);
    $r['can_add_resellers'] = intval($r['can_add_resellers']);
    $r['is_active'] = intval($r['is_active']);
    $r['level'] = intval($r['level'] ?? 1);
    $r['country'] = $r['country'] ?? 'TN';
    $r['currency'] = $r['currency'] ?? 'TND';
}

switch ($method) {
    case 'GET':
        $db = getDB();
        if ($id) {
            $stmt = $db->prepare("SELECT {$cols}, p.name as parent_name FROM tnsatbeltnd_resellers r LEFT JOIN tnsatbeltnd_resellers p ON r.parent_reseller_id = p.id WHERE r.id = ?");
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            if (!$row) jsonResponse(['error' => 'Not found'], 404);
            castRow($row);
            jsonResponse($row);
        } else {
            $parentId = $_GET['parent_id'] ?? null;
            $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : null;
            $limit = isset($_GET['limit']) ? max(1, min(100, intval($_GET['limit']))) : 20;
            $search = $_GET['search'] ?? null;

            $where = '';
            $params = [];
            $conditions = [];

            if ($parentId) {
                $conditions[] = 'r.parent_reseller_id = ?';
                $params[] = $parentId;
            }
            if ($search) {
                $conditions[] = '(r.name LIKE ? OR r.email LIKE ?)';
                $params[] = "%{$search}%";
                $params[] = "%{$search}%";
            }
            if (!empty($conditions)) {
                $where = ' WHERE ' . implode(' AND ', $conditions);
            }

            if ($page !== null) {
                $countStmt = $db->prepare("SELECT COUNT(*) FROM tnsatbeltnd_resellers r{$where}");
                $countStmt->execute($params);
                $total = intval($countStmt->fetchColumn());

                $offset = ($page - 1) * $limit;
                $stmt = $db->prepare("SELECT {$cols}, p.name as parent_name FROM tnsatbeltnd_resellers r LEFT JOIN tnsatbeltnd_resellers p ON r.parent_reseller_id = p.id{$where} ORDER BY r.created_at DESC LIMIT {$limit} OFFSET {$offset}");
                $stmt->execute($params);
                $rows = $stmt->fetchAll();
                foreach ($rows as &$r) castRow($r);
                jsonResponse(['data' => $rows, 'total' => $total, 'page' => $page, 'limit' => $limit]);
            } else {
                $stmt = $db->prepare("SELECT {$cols}, p.name as parent_name FROM tnsatbeltnd_resellers r LEFT JOIN tnsatbeltnd_resellers p ON r.parent_reseller_id = p.id{$where} ORDER BY r.created_at DESC");
                $stmt->execute($params);
                $rows = $stmt->fetchAll();
                foreach ($rows as &$r) castRow($r);
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
            $stmt = $db->prepare("DELETE FROM tnsatbeltnd_resellers WHERE id IN ({$placeholders})");
            $stmt->execute($ids);
            jsonResponse(['success' => true, 'deleted' => $stmt->rowCount()]);
            break;
        }

        if ($action === 'batch_toggle_active') {
            $ids = $body['ids'] ?? [];
            if (empty($ids) || !is_array($ids)) jsonResponse(['error' => 'ids array required'], 400);
            $db = getDB();
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $stmt = $db->prepare("UPDATE tnsatbeltnd_resellers SET is_active = NOT is_active WHERE id IN ({$placeholders})");
            $stmt->execute($ids);
            jsonResponse(['success' => true, 'updated' => $stmt->rowCount()]);
            break;
        }

        $name = trim($body['name'] ?? '');
        $email = trim(strtolower($body['email'] ?? ''));
        $password = trim($body['password'] ?? '');
        $credits = floatval($body['credits'] ?? 0);
        $canAddResellers = intval($body['can_add_resellers'] ?? 0);
        $parentResellerId = $body['parent_reseller_id'] ?? null;
        $note = trim($body['note'] ?? '');
        $level = intval($body['level'] ?? 1);
        $country = trim($body['country'] ?? 'TN');
        $currency = trim($body['currency'] ?? 'TND');
        $imageUrl = trim($body['image_url'] ?? '');

        if (!$name || !$email || !$password) {
            jsonResponse(['error' => 'name, email, password required'], 400);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            jsonResponse(['error' => 'Invalid email format'], 400);
        }
        if (strlen($password) < 4) {
            jsonResponse(['error' => 'Password must be at least 4 characters'], 400);
        }

        $db = getDB();
        $stmt = $db->prepare('SELECT id FROM tnsatbeltnd_resellers WHERE email = ?');
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            jsonResponse(['error' => 'Email already exists'], 409);
        }

        $id = bin2hex(random_bytes(16));
        $stmt = $db->prepare('INSERT INTO tnsatbeltnd_resellers (id, name, email, password, credits, can_add_resellers, parent_reseller_id, note, level, country, currency, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([$id, $name, $email, $password, $credits, $canAddResellers, $parentResellerId, $note ?: null, $level, $country, $currency, $imageUrl ?: null]);

        jsonResponse(['id' => $id], 201);
        break;

    case 'PUT':
        if (!$id) jsonResponse(['error' => 'ID required'], 400);

        $body = getRequestBody();
        $db = getDB();

        if ($action === 'add_points' || $action === 'add_credits') {
            $credits = floatval($body['credits'] ?? $body['points'] ?? 0);
            $pointNote = trim($body['note'] ?? '');
            $paidByReseller = !empty($body['paid_by_reseller']);
            if ($credits <= 0) jsonResponse(['error' => 'Invalid credits'], 400);
            $stmt = $db->prepare('UPDATE tnsatbeltnd_resellers SET credits = credits + ? WHERE id = ?');
            $stmt->execute([$credits, $id]);

            $stmt = $db->prepare('SELECT credits FROM tnsatbeltnd_resellers WHERE id = ?');
            $stmt->execute([$id]);
            $updated = $stmt->fetch();
            $desc = 'Crédits ajoutés par admin';
            if ($pointNote) $desc .= ' — ' . $pointNote;
            if ($paidByReseller) $desc .= ' (payé par reseller)';
            $txId = bin2hex(random_bytes(16));
            $stmt = $db->prepare('INSERT INTO tnsatbeltnd_point_transactions (id, reseller_id, type, amount, balance_after, description, is_paid) VALUES (?, ?, ?, ?, ?, ?, ?)');
            $stmt->execute([$txId, $id, 'credit', $credits, floatval($updated['credits']), $desc, $paidByReseller ? 1 : 0]);

            jsonResponse(['success' => true]);
        } elseif ($action === 'remove_points' || $action === 'remove_credits') {
            $credits = floatval($body['credits'] ?? $body['points'] ?? 0);
            if ($credits <= 0) jsonResponse(['error' => 'Invalid credits'], 400);
            $stmt = $db->prepare('SELECT credits FROM tnsatbeltnd_resellers WHERE id = ?');
            $stmt->execute([$id]);
            $current = $stmt->fetch();
            if (!$current) jsonResponse(['error' => 'Reseller not found'], 404);
            $currentCredits = floatval($current['credits']);
            $toRemove = min($credits, $currentCredits);
            if ($toRemove <= 0) jsonResponse(['error' => 'No credits to remove'], 400);

            $stmt = $db->prepare('UPDATE tnsatbeltnd_resellers SET credits = credits - ? WHERE id = ?');
            $stmt->execute([$toRemove, $id]);

            $stmt = $db->prepare('SELECT credits FROM tnsatbeltnd_resellers WHERE id = ?');
            $stmt->execute([$id]);
            $updated = $stmt->fetch();
            $txId = bin2hex(random_bytes(16));
            $stmt = $db->prepare('INSERT INTO tnsatbeltnd_point_transactions (id, reseller_id, type, amount, balance_after, description) VALUES (?, ?, ?, ?, ?, ?)');
            $stmt->execute([$txId, $id, 'debit', $toRemove, floatval($updated['credits']), 'Crédits retirés par admin']);

            jsonResponse(['success' => true]);
        } elseif ($action === 'empty_credits' || $action === 'empty_points') {
            $stmt = $db->prepare('SELECT credits FROM tnsatbeltnd_resellers WHERE id = ?');
            $stmt->execute([$id]);
            $current = $stmt->fetch();
            if (!$current) jsonResponse(['error' => 'Reseller not found'], 404);
            $currentCredits = floatval($current['credits']);

            if ($currentCredits > 0) {
                $stmt = $db->prepare('UPDATE tnsatbeltnd_resellers SET credits = 0 WHERE id = ?');
                $stmt->execute([$id]);
                $txId = bin2hex(random_bytes(16));
                $stmt = $db->prepare('INSERT INTO tnsatbeltnd_point_transactions (id, reseller_id, type, amount, balance_after, description) VALUES (?, ?, ?, ?, ?, ?)');
                $stmt->execute([$txId, $id, 'debit', $currentCredits, 0, 'Solde vidé par admin']);
            }

            jsonResponse(['success' => true]);
        } elseif ($action === 'toggle_active') {
            $stmt = $db->prepare('UPDATE tnsatbeltnd_resellers SET is_active = NOT is_active WHERE id = ?');
            $stmt->execute([$id]);
            jsonResponse(['success' => true]);
        } elseif ($action === 'self_update') {
            // Reseller self-update: only name, email, password (no credits/level/etc.)
            $name = trim($body['name'] ?? '');
            $email = trim(strtolower($body['email'] ?? ''));
            $password = trim($body['password'] ?? '');
            $currentPassword = trim($body['current_password'] ?? '');

            if (!$name || !$email) {
                jsonResponse(['error' => 'name and email required'], 400);
            }
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                jsonResponse(['error' => 'Invalid email format'], 400);
            }

            // Verify current password
            $stmt = $db->prepare('SELECT password FROM tnsatbeltnd_resellers WHERE id = ?');
            $stmt->execute([$id]);
            $current = $stmt->fetch();
            if (!$current) jsonResponse(['error' => 'Reseller not found'], 404);
            if ($currentPassword !== $current['password']) {
                jsonResponse(['error' => 'Current password is incorrect'], 403);
            }

            // Check email uniqueness
            $stmt = $db->prepare('SELECT id FROM tnsatbeltnd_resellers WHERE email = ? AND id != ?');
            $stmt->execute([$email, $id]);
            if ($stmt->fetch()) {
                jsonResponse(['error' => 'Email already exists'], 409);
            }

            $updates = 'name = ?, email = ?';
            $params = [$name, $email];
            if ($password && strlen($password) >= 4) {
                $updates .= ', password = ?';
                $params[] = $password;
            }
            if (array_key_exists('image_url', $body)) {
                $updates .= ', image_url = ?';
                $params[] = trim($body['image_url']) ?: null;
            }
            $params[] = $id;
            $stmt = $db->prepare("UPDATE tnsatbeltnd_resellers SET {$updates} WHERE id = ?");
            $stmt->execute($params);
            jsonResponse(['success' => true]);
        } else {
            // Regular update
            $name = trim($body['name'] ?? '');
            $email = trim(strtolower($body['email'] ?? ''));
            $password = trim($body['password'] ?? '');
            $credits = floatval($body['credits'] ?? 0);
            $canAddResellers = intval($body['can_add_resellers'] ?? 0);
            $note = trim($body['note'] ?? '');
            $level = intval($body['level'] ?? 1);
            $country = trim($body['country'] ?? 'TN');
            $imageUrl = trim($body['image_url'] ?? '');

            if (!$name || !$email || !$password) {
                jsonResponse(['error' => 'name, email, password required'], 400);
            }
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                jsonResponse(['error' => 'Invalid email format'], 400);
            }

            $stmt = $db->prepare('SELECT id FROM tnsatbeltnd_resellers WHERE email = ? AND id != ?');
            $stmt->execute([$email, $id]);
            if ($stmt->fetch()) {
                jsonResponse(['error' => 'Email already exists'], 409);
            }

            $stmt = $db->prepare('UPDATE tnsatbeltnd_resellers SET name = ?, email = ?, password = ?, credits = ?, can_add_resellers = ?, note = ?, level = ?, country = ?, image_url = ? WHERE id = ?');
            $stmt->execute([$name, $email, $password, $credits, $canAddResellers, $note ?: null, $level, $country, $imageUrl ?: null, $id]);
            jsonResponse(['success' => true]);
        }
        break;

    case 'DELETE':
        if (!$id) jsonResponse(['error' => 'ID required'], 400);
        $db = getDB();
        $stmt = $db->prepare('DELETE FROM tnsatbeltnd_resellers WHERE id = ?');
        $stmt->execute([$id]);
        jsonResponse(['success' => true]);
        break;

    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}
