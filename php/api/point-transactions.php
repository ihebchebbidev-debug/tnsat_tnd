<?php
/**
 * Credit Transactions API (MySQL) — supports both clients and resellers
 * GET ?client_id=xxx or ?reseller_id=xxx  — list transactions (optional: &type=credit|debit, &from=YYYY-MM-DD, &to=YYYY-MM-DD)
 */

require_once __DIR__ . '/../config.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $clientId = $_GET['client_id'] ?? null;
        $resellerId = $_GET['reseller_id'] ?? null;
        if (!$clientId && !$resellerId) jsonResponse(['error' => 'client_id or reseller_id required'], 400);

        $db = getDB();
        $query = 'SELECT * FROM tnsatbeltnd_point_transactions WHERE ';
        $params = [];

        if ($clientId) {
            $query .= 'client_id = ?';
            $params[] = $clientId;
        } else {
            $query .= 'reseller_id = ?';
            $params[] = $resellerId;
        }

        $type = $_GET['type'] ?? null;
        if ($type && in_array($type, ['credit', 'debit'])) {
            $query .= ' AND type = ?';
            $params[] = $type;
        }

        $from = $_GET['from'] ?? null;
        if ($from) {
            $query .= ' AND created_at >= ?';
            $params[] = $from . ' 00:00:00';
        }

        $to = $_GET['to'] ?? null;
        if ($to) {
            $query .= ' AND created_at <= ?';
            $params[] = $to . ' 23:59:59';
        }

        $query .= ' ORDER BY created_at DESC LIMIT 200';

        $stmt = $db->prepare($query);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        foreach ($rows as &$r) {
            $r['amount'] = floatval($r['amount']);
            $r['balance_after'] = floatval($r['balance_after']);
            $r['is_paid'] = isset($r['is_paid']) ? intval($r['is_paid']) : 0;
        }

        jsonResponse($rows);
        break;

    case 'PUT':
        $id = $_GET['id'] ?? null;
        if (!$id) jsonResponse(['error' => 'id required'], 400);
        $body = getRequestBody();
        if (!array_key_exists('is_paid', $body)) jsonResponse(['error' => 'is_paid required'], 400);
        $isPaid = !empty($body['is_paid']) ? 1 : 0;
        $db = getDB();
        $stmt = $db->prepare('UPDATE tnsatbeltnd_point_transactions SET is_paid = ? WHERE id = ?');
        $stmt->execute([$isPaid, $id]);
        jsonResponse(['success' => true, 'is_paid' => $isPaid]);
        break;

    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}
