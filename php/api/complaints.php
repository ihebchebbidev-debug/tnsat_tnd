<?php
/**
 * Complaints API (MySQL) — with pagination, supports client & reseller
 */

require_once __DIR__ . '/../config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

switch ($method) {
    case 'GET':
        $db = getDB();
        $clientId = $_GET['client_id'] ?? null;
        $resellerId = $_GET['reseller_id'] ?? null;
        $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : null;
        $limit = isset($_GET['limit']) ? max(1, min(100, intval($_GET['limit']))) : 20;

        $baseFrom = '
            FROM tnsatbeltnd_complaints comp
            LEFT JOIN tnsatbeltnd_orders o ON comp.order_id = o.id
            LEFT JOIN tnsatbeltnd_services s ON o.service_id = s.id
            LEFT JOIN tnsatbeltnd_clients c ON comp.client_id = c.id
            LEFT JOIN tnsatbeltnd_resellers r ON comp.reseller_id = r.id
        ';
        $selectCols = 'comp.*, o.service_id, s.name as service_name, c.name as client_name, c.email as client_email, r.name as reseller_name, r.email as reseller_email, o.credentials, o.status as order_status';

        $params = [];
        $conditions = [];
        if ($clientId) { $conditions[] = 'comp.client_id = ?'; $params[] = $clientId; }
        if ($resellerId) { $conditions[] = 'comp.reseller_id = ?'; $params[] = $resellerId; }
        $where = !empty($conditions) ? ' WHERE ' . implode(' AND ', $conditions) : '';

        if ($page !== null) {
            $countStmt = $db->prepare("SELECT COUNT(*) {$baseFrom}{$where}");
            $countStmt->execute($params);
            $total = intval($countStmt->fetchColumn());

            $offset = ($page - 1) * $limit;
            $stmt = $db->prepare("SELECT {$selectCols} {$baseFrom}{$where} ORDER BY comp.created_at DESC LIMIT {$limit} OFFSET {$offset}");
            $stmt->execute($params);
            $complaints = $stmt->fetchAll();
            foreach ($complaints as &$c) {
                $c['credentials'] = json_decode($c['credentials'] ?? 'null', true);
            }
            jsonResponse(['data' => $complaints, 'total' => $total, 'page' => $page, 'limit' => $limit]);
        } else {
            $stmt = $db->prepare("SELECT {$selectCols} {$baseFrom}{$where} ORDER BY comp.created_at DESC");
            $stmt->execute($params);
            $complaints = $stmt->fetchAll();
            foreach ($complaints as &$c) {
                $c['credentials'] = json_decode($c['credentials'] ?? 'null', true);
            }
            jsonResponse($complaints);
        }
        break;

    case 'POST':
        $body = getRequestBody();
        $orderId = $body['order_id'] ?? '';
        $clientId = $body['client_id'] ?? null;
        $resellerId = $body['reseller_id'] ?? null;
        $reason = $body['reason'] ?? 'other';
        $message = trim($body['message'] ?? '');
        
        if (!$orderId || (!$clientId && !$resellerId)) {
            jsonResponse(['error' => 'order_id and (client_id or reseller_id) required'], 400);
        }
        
        $db = getDB();
        $stmt = $db->prepare('SELECT id FROM tnsatbeltnd_complaints WHERE order_id = ? AND status IN (?, ?)');
        $stmt->execute([$orderId, 'open', 'in_review']);
        if ($stmt->fetch()) {
            jsonResponse(['error' => 'An active complaint already exists for this order'], 400);
        }
        
        $compId = bin2hex(random_bytes(16));
        $stmt = $db->prepare('INSERT INTO tnsatbeltnd_complaints (id, order_id, client_id, reseller_id, reason, message, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([$compId, $orderId, $clientId, $resellerId, $reason, $message, 'open']);
        
        $stmt = $db->prepare('UPDATE tnsatbeltnd_orders SET status = ? WHERE id = ?');
        $stmt->execute(['disputed', $orderId]);
        
        jsonResponse(['id' => $compId, 'status' => 'open'], 201);
        break;

    case 'PUT':
        if (!$id) jsonResponse(['error' => 'ID required'], 400);
        
        $body = getRequestBody();
        $db = getDB();
        
        $status = $body['status'] ?? null;
        $adminResponse = $body['admin_response'] ?? null;
        $newCredentials = $body['new_credentials'] ?? null;
        
        $updates = [];
        $params = [];
        
        if ($status) { $updates[] = 'status = ?'; $params[] = $status; }
        if ($adminResponse !== null) { $updates[] = 'admin_response = ?'; $params[] = $adminResponse; }
        if ($status === 'resolved') { $updates[] = 'resolved_at = NOW()'; }
        
        if (empty($updates)) {
            jsonResponse(['error' => 'No fields to update'], 400);
        }
        
        $params[] = $id;
        $stmt = $db->prepare('UPDATE tnsatbeltnd_complaints SET ' . implode(', ', $updates) . ' WHERE id = ?');
        $stmt->execute($params);
        
        $stmt = $db->prepare('SELECT * FROM tnsatbeltnd_complaints WHERE id = ?');
        $stmt->execute([$id]);
        $complaint = $stmt->fetch();
        
        if ($complaint) {
            if ($newCredentials && !empty($newCredentials)) {
                $stmt = $db->prepare('UPDATE tnsatbeltnd_orders SET credentials = ?, status = ? WHERE id = ?');
                $stmt->execute([json_encode($newCredentials), 'fulfilled', $complaint['order_id']]);
            } elseif ($status === 'resolved') {
                $stmt = $db->prepare('UPDATE tnsatbeltnd_orders SET status = ? WHERE id = ?');
                $stmt->execute(['resolved', $complaint['order_id']]);
            }
            
            $notifType = ($status === 'resolved') ? 'complaint_resolved' : 'complaint_updated';
            $notifMessage = ($status === 'resolved') 
                ? 'Your complaint has been resolved. / Votre réclamation a été résolue.' 
                : 'Your complaint has been updated. / Votre réclamation a été mise à jour.';
            if ($adminResponse) {
                $notifMessage .= ' Response / Réponse: ' . $adminResponse;
            }
            
            $notifId = bin2hex(random_bytes(16));
            $stmt = $db->prepare('INSERT INTO tnsatbeltnd_notifications (id, client_id, reseller_id, type, message, order_id, complaint_id, is_read) VALUES (?, ?, ?, ?, ?, ?, ?, 0)');
            $stmt->execute([$notifId, $complaint['client_id'], $complaint['reseller_id'], $notifType, $notifMessage, $complaint['order_id'], $id]);
        }
        
        jsonResponse(['success' => true]);
        break;

    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}
