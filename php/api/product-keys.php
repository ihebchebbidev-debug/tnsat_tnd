<?php
/**
 * Product Keys API (MySQL)
 * Manages stock of keys/codes per service
 * 
 * GET    /product-keys.php?service_id=xxx          — list keys for a service
 * GET    /product-keys.php?id=xxx                  — get single key
 * GET    /product-keys.php?service_id=xxx&count=1  — count available keys
 * POST   /product-keys.php                         — add key(s) to a service
 * POST   /product-keys.php?action=assign            — auto-assign a key to an order
 * PUT    /product-keys.php?id=xxx                  — update a key's fields
 * DELETE /product-keys.php?id=xxx                  — delete a key
 * DELETE /product-keys.php?action=bulk_delete       — bulk delete keys
 */

require_once __DIR__ . '/../config.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

// ── GET ──────────────────────────────────────────────────
if ($method === 'GET') {
    $id = $_GET['id'] ?? null;
    $serviceId = $_GET['service_id'] ?? null;
    $countOnly = isset($_GET['count']);

    // Assigned keys history with filters
    $action = $_GET['action'] ?? null;
    if ($action === 'assigned_history') {
        $sql = "SELECT pk.*, s.name as service_name,
                pk.reseller_note as reseller_note,
                COALESCE(o.client_id, '') as buyer_client_id,
                COALESCE(o.reseller_id, '') as buyer_reseller_id,
                COALESCE(c.name, r.name, '') as buyer_name
                FROM tnsatbeltnd_product_keys pk
                LEFT JOIN tnsatbeltnd_services s ON pk.service_id = s.id
                LEFT JOIN tnsatbeltnd_orders o ON pk.order_id = o.id
                LEFT JOIN tnsatbeltnd_clients c ON o.client_id = c.id
                LEFT JOIN tnsatbeltnd_resellers r ON o.reseller_id = r.id
                WHERE pk.status = 'assigned'";
        $params = [];

        $filterService = $_GET['service_id'] ?? null;
        if ($filterService) {
            $sql .= ' AND pk.service_id = ?';
            $params[] = $filterService;
        }

        $filterReseller = $_GET['reseller_id'] ?? null;
        if ($filterReseller) {
            $sql .= ' AND o.reseller_id = ?';
            $params[] = $filterReseller;
        }

        $filterClient = $_GET['client_id'] ?? null;
        if ($filterClient) {
            $sql .= ' AND o.client_id = ?';
            $params[] = $filterClient;
        }

        $dateFrom = $_GET['from'] ?? null;
        $dateTo = $_GET['to'] ?? null;
        if ($dateFrom) {
            $sql .= ' AND pk.assigned_at >= ?';
            $params[] = $dateFrom . ' 00:00:00';
        }
        if ($dateTo) {
            $sql .= ' AND pk.assigned_at <= ?';
            $params[] = $dateTo . ' 23:59:59';
        }

        // Pagination
        $page = max(1, intval($_GET['page'] ?? 1));
        $perPage = intval($_GET['per_page'] ?? 25);
        if ($perPage < 1) $perPage = 25;
        if ($perPage > 200) $perPage = 200;
        $offset = ($page - 1) * $perPage;

        // Count total
        $countSql = preg_replace('/^SELECT .*? FROM/s', 'SELECT COUNT(*) as cnt FROM', $sql, 1);
        $stmtC = $db->prepare($countSql);
        $stmtC->execute($params);
        $total = intval($stmtC->fetch()['cnt']);

        $sql .= ' ORDER BY pk.assigned_at DESC LIMIT ' . $perPage . ' OFFSET ' . $offset;
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) {
            $row['fields'] = json_decode($row['fields'], true);
        }
        jsonResponse([
            'data' => $rows,
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'total_pages' => (int) ceil($total / $perPage),
        ]);
    }

    if ($id) {
        $stmt = $db->prepare('SELECT * FROM tnsatbeltnd_product_keys WHERE id = ?');
        $stmt->execute([$id]);
        $key = $stmt->fetch();
        if (!$key) jsonResponse(['error' => 'Key not found'], 404);
        $key['fields'] = json_decode($key['fields'], true);
        jsonResponse($key);
    }

    // Bulk count for all services
    if (!$serviceId && $countOnly) {
        $stmt = $db->query('SELECT service_id,
            COALESCE(SUM(CASE WHEN status = "available" THEN 1 ELSE 0 END), 0) as available,
            COALESCE(SUM(CASE WHEN status = "assigned" THEN 1 ELSE 0 END), 0) as assigned,
            COUNT(*) as total
            FROM tnsatbeltnd_product_keys GROUP BY service_id');
        $rows = $stmt->fetchAll();
        $result = [];
        foreach ($rows as $r) {
            $result[$r['service_id']] = [
                'total' => intval($r['total']),
                'available' => intval($r['available']),
                'assigned' => intval($r['assigned']),
            ];
        }
        jsonResponse($result);
    }

    if (!$serviceId) {
        jsonResponse(['error' => 'service_id required'], 400);
    }

    if ($countOnly) {
        $stmt = $db->prepare('SELECT 
            COUNT(*) as total,
            COALESCE(SUM(CASE WHEN status = "available" THEN 1 ELSE 0 END), 0) as available,
            COALESCE(SUM(CASE WHEN status = "assigned" THEN 1 ELSE 0 END), 0) as assigned
            FROM tnsatbeltnd_product_keys WHERE service_id = ?');
        $stmt->execute([$serviceId]);
        $row = $stmt->fetch();
        jsonResponse([
            'total' => intval($row['total']),
            'available' => intval($row['available']),
            'assigned' => intval($row['assigned']),
        ]);
    }

    $status = $_GET['status'] ?? null;
    $sql = 'SELECT * FROM tnsatbeltnd_product_keys WHERE service_id = ?';
    $params = [$serviceId];
    if ($status) {
        $sql .= ' AND status = ?';
        $params[] = $status;
    }
    $sql .= ' ORDER BY created_at DESC';

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $keys = $stmt->fetchAll();
    foreach ($keys as &$k) {
        $k['fields'] = json_decode($k['fields'], true);
    }
    jsonResponse($keys);
}

// ── POST ─────────────────────────────────────────────────
if ($method === 'POST') {
    $action = $_GET['action'] ?? null;
    $body = getRequestBody();

    // Auto-assign an available key to an order
    if ($action === 'assign') {
        $serviceId = $body['service_id'] ?? '';
        $orderId = $body['order_id'] ?? '';
        if (!$serviceId || !$orderId) {
            jsonResponse(['error' => 'service_id and order_id required'], 400);
        }

        $db->beginTransaction();
        try {
            // Lock and pick first available key
            $stmt = $db->prepare('SELECT id, fields FROM tnsatbeltnd_product_keys WHERE service_id = ? AND status = "available" ORDER BY created_at ASC LIMIT 1 FOR UPDATE');
            $stmt->execute([$serviceId]);
            $key = $stmt->fetch();

            if (!$key) {
                $db->rollBack();
                jsonResponse(['error' => 'No available keys for this product', 'no_stock' => true], 404);
            }

            $stmt = $db->prepare('UPDATE tnsatbeltnd_product_keys SET status = "assigned", order_id = ?, assigned_at = NOW() WHERE id = ?');
            $stmt->execute([$orderId, $key['id']]);

            // Check remaining stock — notify admin if zero
            $stmtCount = $db->prepare('SELECT COUNT(*) as remaining FROM tnsatbeltnd_product_keys WHERE service_id = ? AND status = "available"');
            $stmtCount->execute([$serviceId]);
            $remaining = intval($stmtCount->fetch()['remaining']);

            $db->commit();

            // If stock is now zero, create an admin notification
            if ($remaining === 0) {
                try {
                    $stmtSvc = $db->prepare('SELECT name FROM tnsatbeltnd_services WHERE id = ?');
                    $stmtSvc->execute([$serviceId]);
                    $svcRow = $stmtSvc->fetch();
                    $svcName = $svcRow ? $svcRow['name'] : $serviceId;
                    // Insert notification visible to admin (no client_id or reseller_id = admin notification)
                    $notifId = bin2hex(random_bytes(16));
                    $db->prepare('INSERT INTO tnsatbeltnd_notifications (id, type, message, created_at) VALUES (?, ?, ?, NOW())')
                        ->execute([$notifId, 'stock_empty', "⚠️ Stock épuisé pour le produit \"$svcName\". Ajoutez de nouvelles clés."]);
                } catch (Exception $ignore) {}
            }

            jsonResponse([
                'success' => true,
                'key_id' => $key['id'],
                'fields' => json_decode($key['fields'], true),
                'remaining_stock' => $remaining,
            ]);
        } catch (Exception $e) {
            $db->rollBack();
            jsonResponse(['error' => 'Failed to assign key: ' . $e->getMessage()], 500);
        }
    }

    // Add one or more keys
    $serviceId = $body['service_id'] ?? '';
    if (!$serviceId) {
        jsonResponse(['error' => 'service_id required'], 400);
    }

    // Verify service exists
    $stmt = $db->prepare('SELECT id FROM tnsatbeltnd_services WHERE id = ?');
    $stmt->execute([$serviceId]);
    if (!$stmt->fetch()) {
        jsonResponse(['error' => 'Service not found'], 404);
    }

    // Accept single key or array of keys
    $keys = $body['keys'] ?? [];
    if (isset($body['fields'])) {
        // Single key mode
        $keys = [['fields' => $body['fields']]];
    }

    if (empty($keys)) {
        jsonResponse(['error' => 'At least one key required (fields or keys array)'], 400);
    }

    $inserted = [];
    foreach ($keys as $keyData) {
        $fields = $keyData['fields'] ?? [];
        if (empty($fields)) continue;

        // Validate fields format: array of {title, value}
        foreach ($fields as &$f) {
            if (!isset($f['title']) || !isset($f['value'])) {
                jsonResponse(['error' => 'Each field must have title and value'], 400);
            }
            $f['title'] = trim(substr($f['title'], 0, 200));
            $f['value'] = trim(substr($f['value'], 0, 2000));
        }
        unset($f);

        $id = bin2hex(random_bytes(16));
        $stmt = $db->prepare('INSERT INTO tnsatbeltnd_product_keys (id, service_id, fields) VALUES (?, ?, ?)');
        $stmt->execute([$id, $serviceId, json_encode($fields)]);
        $inserted[] = ['id' => $id, 'fields' => $fields];
    }

    jsonResponse(['success' => true, 'count' => count($inserted), 'keys' => $inserted], 201);
}

// ── PUT ──────────────────────────────────────────────────
if ($method === 'PUT') {
    $action = $_GET['action'] ?? null;
    $id = $_GET['id'] ?? null;
    if (!$id) jsonResponse(['error' => 'id required'], 400);

    $body = getRequestBody();

    // Update reseller note (free text, max 2000 chars)
    if ($action === 'update_note') {
        $note = isset($body['note']) ? trim(substr((string)$body['note'], 0, 2000)) : '';
        $stmt = $db->prepare('UPDATE tnsatbeltnd_product_keys SET reseller_note = ? WHERE id = ?');
        $stmt->execute([$note === '' ? null : $note, $id]);
        jsonResponse(['success' => true]);
    }

    $fields = $body['fields'] ?? null;

    if (!$fields || !is_array($fields)) {
        jsonResponse(['error' => 'fields array required'], 400);
    }

    foreach ($fields as &$f) {
        if (!isset($f['title']) || !isset($f['value'])) {
            jsonResponse(['error' => 'Each field must have title and value'], 400);
        }
        $f['title'] = trim(substr($f['title'], 0, 200));
        $f['value'] = trim(substr($f['value'], 0, 2000));
    }
    unset($f);

    $stmt = $db->prepare('UPDATE tnsatbeltnd_product_keys SET fields = ? WHERE id = ?');
    $stmt->execute([json_encode($fields), $id]);

    jsonResponse(['success' => true]);
}

// ── DELETE ───────────────────────────────────────────────
if ($method === 'DELETE') {
    $action = $_GET['action'] ?? null;

    if ($action === 'bulk_delete') {
        $body = getRequestBody();
        $ids = $body['ids'] ?? [];
        if (empty($ids)) jsonResponse(['error' => 'ids array required'], 400);

        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $db->prepare("DELETE FROM tnsatbeltnd_product_keys WHERE id IN ($placeholders) AND status = 'available'");
        $stmt->execute($ids);
        jsonResponse(['success' => true, 'deleted' => $stmt->rowCount()]);
    }

    $id = $_GET['id'] ?? null;
    if (!$id) jsonResponse(['error' => 'id required'], 400);

    $stmt = $db->prepare('DELETE FROM tnsatbeltnd_product_keys WHERE id = ?');
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        jsonResponse(['error' => 'Key not found'], 404);
    }

    jsonResponse(['success' => true]);
}

jsonResponse(['error' => 'Method not allowed'], 405);
