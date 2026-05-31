<?php
/**
 * Order Responses API (MySQL)
 * Resellers/clients respond to fulfilled orders with their info
 */

require_once __DIR__ . '/../config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;
$orderId = $_GET['order_id'] ?? null;

switch ($method) {
    case 'GET':
        $db = getDB();

        if ($orderId) {
            // Get responses for a specific order
            $stmt = $db->prepare('
                SELECT r.*, 
                       res.name as reseller_name, 
                       c.name as client_name
                FROM tnsatbeltnd_order_responses r
                LEFT JOIN tnsatbeltnd_resellers res ON r.reseller_id = res.id
                LEFT JOIN tnsatbeltnd_clients c ON r.client_id = c.id
                WHERE r.order_id = ?
                ORDER BY r.created_at DESC
            ');
            $stmt->execute([$orderId]);
            jsonResponse($stmt->fetchAll());
        }

        // Get all responses (admin view) — optionally filter by reseller
        $resellerId = $_GET['reseller_id'] ?? null;
        $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : null;
        $limit = isset($_GET['limit']) ? max(1, min(100, intval($_GET['limit']))) : 20;

        $conditions = [];
        $params = [];

        if ($resellerId) {
            $conditions[] = 'r.reseller_id = ?';
            $params[] = $resellerId;
        }

        $where = !empty($conditions) ? ' WHERE ' . implode(' AND ', $conditions) : '';

        if ($page !== null) {
            $countStmt = $db->prepare("SELECT COUNT(*) FROM tnsatbeltnd_order_responses r {$where}");
            $countStmt->execute($params);
            $total = intval($countStmt->fetchColumn());

            $offset = ($page - 1) * $limit;
            $stmt = $db->prepare("
                SELECT r.*, 
                       res.name as reseller_name,
                       c.name as client_name,
                       s.name as service_name,
                       o.credentials,
                       o.status as order_status,
                       o.credits_used,
                       o.note as order_note
                FROM tnsatbeltnd_order_responses r
                LEFT JOIN tnsatbeltnd_resellers res ON r.reseller_id = res.id
                LEFT JOIN tnsatbeltnd_clients c ON r.client_id = c.id
                LEFT JOIN tnsatbeltnd_orders o ON r.order_id = o.id
                LEFT JOIN tnsatbeltnd_services s ON o.service_id = s.id
                {$where}
                ORDER BY r.created_at DESC
                LIMIT {$limit} OFFSET {$offset}
            ");
            $stmt->execute($params);
            $rows = $stmt->fetchAll();
            foreach ($rows as &$row) {
                $row['credentials'] = json_decode($row['credentials'] ?? 'null', true);
            }
            jsonResponse(['data' => $rows, 'total' => $total, 'page' => $page, 'limit' => $limit]);
        } else {
            $stmt = $db->prepare("
                SELECT r.*, 
                       res.name as reseller_name,
                       c.name as client_name,
                       s.name as service_name,
                       o.credentials,
                       o.status as order_status,
                       o.credits_used,
                       o.note as order_note
                FROM tnsatbeltnd_order_responses r
                LEFT JOIN tnsatbeltnd_resellers res ON r.reseller_id = res.id
                LEFT JOIN tnsatbeltnd_clients c ON r.client_id = c.id
                LEFT JOIN tnsatbeltnd_orders o ON r.order_id = o.id
                LEFT JOIN tnsatbeltnd_services s ON o.service_id = s.id
                {$where}
                ORDER BY r.created_at DESC
            ");
            $stmt->execute($params);
            $rows = $stmt->fetchAll();
            foreach ($rows as &$row) {
                $row['credentials'] = json_decode($row['credentials'] ?? 'null', true);
            }
            jsonResponse($rows);
        }
        break;

    case 'POST':
        $body = getRequestBody();
        $orderIdBody = $body['order_id'] ?? '';
        $resellerId = $body['reseller_id'] ?? null;
        $clientId = $body['client_id'] ?? null;
        $responseText = trim($body['response_text'] ?? '');

        if (!$orderIdBody) jsonResponse(['error' => 'order_id required'], 400);
        if (!$responseText) jsonResponse(['error' => 'response_text required'], 400);

        $isAdmin = !empty($body['is_admin']);

        if (!$isAdmin && !$resellerId && !$clientId) jsonResponse(['error' => 'reseller_id or client_id required'], 400);

        $db = getDB();

        // Verify the order exists
        $stmt = $db->prepare('SELECT * FROM tnsatbeltnd_orders WHERE id = ?');
        $stmt->execute([$orderIdBody]);
        $order = $stmt->fetch();
        if (!$order) jsonResponse(['error' => 'Order not found'], 404);

        // Create response
        $responseId = bin2hex(random_bytes(16));
        $stmt = $db->prepare('INSERT INTO tnsatbeltnd_order_responses (id, order_id, reseller_id, client_id, response_text) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([$responseId, $orderIdBody, $resellerId, $clientId, $responseText]);

        $stmt = $db->prepare('SELECT name FROM tnsatbeltnd_services WHERE id = ?');
        $stmt->execute([$order['service_id']]);
        $service = $stmt->fetch();
        $serviceName = $service ? $service['name'] : '';

        if ($isAdmin) {
            // Admin approved/responded → notify the reseller who placed the order
            $targetResellerId = $order['reseller_id'];
            $targetClientId = $order['client_id'];

            $notifMessage = 'Admin a approuvé votre commande "' . $serviceName . '" / Admin approved your order "' . $serviceName . '"';
            $notifId = bin2hex(random_bytes(16));
            $stmt = $db->prepare('INSERT INTO tnsatbeltnd_notifications (id, client_id, reseller_id, type, message, order_id, is_read) VALUES (?, ?, ?, ?, ?, ?, 0)');
            $stmt->execute([$notifId, $targetClientId, $targetResellerId, 'order_approved', $notifMessage, $orderIdBody]);
        } else {
            // Reseller/client responded → notify admin
            $notifId = bin2hex(random_bytes(16));
            $buyerName = '';
            if ($resellerId) {
                $stmt = $db->prepare('SELECT name FROM tnsatbeltnd_resellers WHERE id = ?');
                $stmt->execute([$resellerId]);
                $r = $stmt->fetch();
                $buyerName = $r ? $r['name'] : 'Reseller';
            } elseif ($clientId) {
                $stmt = $db->prepare('SELECT name FROM tnsatbeltnd_clients WHERE id = ?');
                $stmt->execute([$clientId]);
                $c = $stmt->fetch();
                $buyerName = $c ? $c['name'] : 'Client';
            }

            $notifMessage = $buyerName . ' a répondu à la commande "' . $serviceName . '" / ' . $buyerName . ' responded to order "' . $serviceName . '"';
            $stmt = $db->prepare('INSERT INTO tnsatbeltnd_notifications (id, client_id, reseller_id, type, message, order_id, is_read) VALUES (?, NULL, NULL, ?, ?, ?, 0)');
            $stmt->execute([$notifId, 'order_response', $notifMessage, $orderIdBody]);
        }

        jsonResponse(['success' => true, 'id' => $responseId], 201);
        break;

    case 'PUT':
        if (!$id) jsonResponse(['error' => 'ID required'], 400);
        $body = getRequestBody();
        $responseText = trim($body['response_text'] ?? '');
        if (!$responseText) jsonResponse(['error' => 'response_text required'], 400);
        $db = getDB();

        // Load the response + linked order so we can notify the reseller/client
        $stmt = $db->prepare('
            SELECT r.*, o.reseller_id AS order_reseller_id, o.client_id AS order_client_id, o.service_id AS order_service_id
            FROM tnsatbeltnd_order_responses r
            LEFT JOIN tnsatbeltnd_orders o ON r.order_id = o.id
            WHERE r.id = ?
        ');
        $stmt->execute([$id]);
        $existing = $stmt->fetch();
        if (!$existing) jsonResponse(['error' => 'Response not found'], 404);

        $stmt = $db->prepare('UPDATE tnsatbeltnd_order_responses SET response_text = ? WHERE id = ?');
        $stmt->execute([$responseText, $id]);

        // If this was an admin response (no reseller_id and no client_id on the response itself),
        // notify the order's reseller / client about the modification.
        $isAdminResponse = empty($existing['reseller_id']) && empty($existing['client_id']);
        if ($isAdminResponse) {
            $serviceName = '';
            if (!empty($existing['order_service_id'])) {
                $s = $db->prepare('SELECT name FROM tnsatbeltnd_services WHERE id = ?');
                $s->execute([$existing['order_service_id']]);
                $svc = $s->fetch();
                $serviceName = $svc ? $svc['name'] : '';
            }
            $notifMessage = 'Admin a modifié la réponse de la commande "' . $serviceName . '" / Admin updated the response on order "' . $serviceName . '"';
            $notifId = bin2hex(random_bytes(16));
            $stmt = $db->prepare('INSERT INTO tnsatbeltnd_notifications (id, client_id, reseller_id, type, message, order_id, is_read) VALUES (?, ?, ?, ?, ?, ?, 0)');
            $stmt->execute([
                $notifId,
                $existing['order_client_id'],
                $existing['order_reseller_id'],
                'order_response_updated',
                $notifMessage,
                $existing['order_id'],
            ]);
        }

        jsonResponse(['success' => true]);
        break;


    case 'DELETE':
        if (!$id) jsonResponse(['error' => 'ID required'], 400);
        $db = getDB();
        $stmt = $db->prepare('DELETE FROM tnsatbeltnd_order_responses WHERE id = ?');
        $stmt->execute([$id]);
        jsonResponse(['success' => true]);
        break;

    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}
